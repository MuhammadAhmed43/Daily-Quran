#!/usr/bin/env python3
"""Extract clean conversation logs from Claude Code sessions."""

import json
import os
import re
import subprocess
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any


def get_git_author() -> str:
    """Get the author for attribution. Checks CLAUDE_AUTHOR env var first, then git config."""
    # Check env var first (takes precedence)
    if author := os.environ.get('CLAUDE_AUTHOR'):
        return author
    # Fall back to git config
    try:
        result = subprocess.run(
            ['git', 'config', 'user.name'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return 'unknown'


def get_github_user() -> str:
    """Get the authenticated GitHub login via `gh`. Returns 'unknown' if unavailable."""
    if login := os.environ.get('GITHUB_USER'):
        return login
    try:
        result = subprocess.run(
            ['gh', 'api', 'user', '--jq', '.login'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return 'unknown'


def get_git_email() -> str:
    """Get the git config user.email for attribution."""
    try:
        result = subprocess.run(
            ['git', 'config', 'user.email'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return 'unknown'


def get_project_session_dir(cwd: Path) -> Path:
    """Get the session directory for a project."""
    claude_dir = Path.home() / '.claude' / 'projects'
    # Claude uses path with / replaced by - (keeps leading dash).
    # Windows compat: Claude Code also replaces ':' and '\' with '-'
    # (e.g. C:\Quran-ChatApp -> C--Quran-ChatApp), so handle all three.
    project_hash = re.sub(r'[/\\:]', '-', str(cwd))
    return claude_dir / project_hash


def is_user_prompt(entry: dict) -> bool:
    """Check if entry is a real user prompt (not meta/command/tool result)."""
    if entry.get('type') != 'user':
        return False
    if entry.get('isMeta') or entry.get('isSidechain'):
        return False

    content = entry.get('message', {}).get('content', '')

    # Skip tool results
    if isinstance(content, list):
        if any(c.get('type') == 'tool_result' for c in content):
            return False
        return False  # Lists are usually tool results

    # Skip commands and system messages
    if isinstance(content, str):
        if content.startswith('<command-name>'):
            return False
        if content.startswith('<local-command'):
            return False
        if content.startswith('Caveat:'):
            return False
        if not content.strip():
            return False
        return True

    return False


def extract_assistant_text(entry: dict) -> Optional[str]:
    """Extract text content from assistant message."""
    if entry.get('type') != 'assistant':
        return None
    if entry.get('isSidechain'):
        return None

    content = entry.get('message', {}).get('content', [])

    if isinstance(content, str):
        return content if content.strip() else None

    if isinstance(content, list):
        texts = []
        for block in content:
            if block.get('type') == 'text':
                text = block.get('text', '').strip()
                if text:
                    texts.append(text)
        return '\n\n'.join(texts) if texts else None

    return None


def extract_clean_log(jsonl_path: Path) -> List[Tuple[str, str, str]]:
    """Extract conversation entries from a JSONL file.

    Returns list of (timestamp, role, content) tuples.
    """
    entries = []

    for line in jsonl_path.read_text(encoding='utf-8', errors='replace').strip().split('\n'):
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue

        timestamp = entry.get('timestamp', '')

        if is_user_prompt(entry):
            content = entry.get('message', {}).get('content', '')
            if isinstance(content, str) and content.strip():
                entries.append((timestamp, 'user', content.strip()))

        elif entry.get('type') == 'assistant':
            text = extract_assistant_text(entry)
            if text:
                entries.append((timestamp, 'assistant', text))

    return entries


def format_timestamp(iso_timestamp: str) -> str:
    """Format ISO timestamp to readable format."""
    try:
        dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M')
    except (ValueError, AttributeError):
        return ''


def dedupe_entries(entries: List[Tuple[str, str, str]]) -> List[Tuple[str, str, str]]:
    """Keep only the final assistant response before each user prompt."""
    if not entries:
        return []

    result = []
    pending_assistant = None

    for timestamp, role, content in entries:
        if role == 'user':
            # Flush any pending assistant response before this user prompt
            if pending_assistant:
                result.append(pending_assistant)
                pending_assistant = None
            result.append((timestamp, role, content))
        elif role == 'assistant':
            # Always replace with the latest assistant response
            pending_assistant = (timestamp, role, content)

    # Don't forget the final assistant response
    if pending_assistant:
        result.append(pending_assistant)

    return result


def detect_paste_indicators(content: str) -> Dict[str, bool]:
    """Detect heuristic indicators that content was pasted."""
    indicators = {
        'has_code_block': '```' in content,
        'has_file_paths': bool(re.search(r'[\w\-/]+\.(ts|js|py|tsx|jsx|json|md|txt|yml|yaml):\d+', content)) or
                         bool(re.search(r'(?:^|[\s\(])/[\w\-/]+\.[\w]+', content, re.MULTILINE)),
        'has_urls': bool(re.search(r'https?://', content)),
        'is_long': len(content) > 500,
        'has_stack_trace': bool(re.search(r'at \w+.*:\d+:\d+', content)) or
                          bool(re.search(r'File ".*", line \d+', content)),
        'has_structured_data': bool(re.search(r'^[\s]*[{\[]', content, re.MULTILINE)) and
                              ('{' in content and '}' in content),
    }

    # Count indicators (likely pasted if 2+ indicators)
    indicator_count = sum(indicators.values())
    indicators['likely_pasted'] = indicator_count >= 2 or indicators['is_long']

    return indicators


def parse_iso_timestamp(timestamp: str) -> Optional[datetime]:
    """Parse ISO timestamp string to datetime."""
    try:
        return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return None


def calculate_session_stats(entries: List[Tuple[str, str, str]]) -> Dict[str, Any]:
    """Calculate comprehensive session statistics."""
    if not entries:
        return {}

    # Separate prompts and responses
    prompts = [(ts, content) for ts, role, content in entries if role == 'user']
    responses = [(ts, content) for ts, role, content in entries if role == 'assistant']

    if not prompts:
        return {}

    stats = {}

    # Timing stats
    first_prompt_dt = parse_iso_timestamp(prompts[0][0])
    last_prompt_dt = parse_iso_timestamp(prompts[-1][0])

    stats['first_prompt_time'] = prompts[0][0]
    stats['last_prompt_time'] = prompts[-1][0]

    if first_prompt_dt and last_prompt_dt:
        duration = (last_prompt_dt - first_prompt_dt).total_seconds() / 60
        stats['session_duration_minutes'] = round(duration, 1)

        if len(prompts) > 1:
            avg_gap = duration / (len(prompts) - 1)
            stats['avg_time_between_prompts_minutes'] = round(avg_gap, 1)

    # Prompt characteristics
    prompt_chars = [len(content) for _, content in prompts]
    prompt_words = [len(content.split()) for _, content in prompts]

    stats['total_prompt_chars'] = sum(prompt_chars)
    stats['total_prompt_words'] = sum(prompt_words)
    stats['avg_prompt_length_chars'] = round(sum(prompt_chars) / len(prompts), 1)
    stats['avg_prompt_length_words'] = round(sum(prompt_words) / len(prompts), 1)
    stats['longest_prompt_words'] = max(prompt_words)
    stats['shortest_prompt_words'] = min(prompt_words)

    # Response stats
    if responses:
        response_chars = [len(content) for _, content in responses]
        stats['total_response_chars'] = sum(response_chars)
        stats['avg_response_length_chars'] = round(sum(response_chars) / len(responses), 1)

        if stats['total_prompt_chars'] > 0:
            stats['response_to_prompt_ratio'] = round(
                stats['total_response_chars'] / stats['total_prompt_chars'], 2
            )

    # Paste detection stats
    paste_data = [detect_paste_indicators(content) for _, content in prompts]
    stats['prompts_with_code_blocks'] = sum(1 for p in paste_data if p['has_code_block'])
    stats['prompts_with_file_paths'] = sum(1 for p in paste_data if p['has_file_paths'])
    stats['prompts_with_urls'] = sum(1 for p in paste_data if p['has_urls'])
    stats['prompts_with_long_content'] = sum(1 for p in paste_data if p['is_long'])
    stats['likely_pasted_count'] = sum(1 for p in paste_data if p['likely_pasted'])

    return stats


def main():
    cwd = Path(os.environ.get('CLAUDE_CWD', os.getcwd()))
    session_dir = get_project_session_dir(cwd)

    if not session_dir.exists():
        return

    # Find main session files (not agent- prefixed)
    session_files = [
        f for f in session_dir.glob('*.jsonl')
        if not f.name.startswith('agent-')
    ]

    if not session_files:
        return

    # Get the most recent session
    latest = max(session_files, key=lambda p: p.stat().st_mtime)
    session_id = latest.stem

    # Extract entries
    entries = extract_clean_log(latest)
    entries = dedupe_entries(entries)

    if not entries:
        return

    # Calculate comprehensive stats
    session_stats = calculate_session_stats(entries)

    # Create output directory
    output_dir = cwd / '.claude-logs'
    output_dir.mkdir(parents=True, exist_ok=True)

    # Check for existing file for this session (any timestamp prefix)
    existing_files = list(output_dir.glob(f"*_{session_id}.md"))
    date = datetime.now().strftime('%Y-%m-%d')
    if existing_files:
        # Use existing file (subsequent prompts in session)
        output_path = existing_files[0]
    else:
        # Create new file with timestamp (first prompt of session)
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        filename = f"{timestamp}_{session_id}.md"
        output_path = output_dir / filename

    # Determine session status based on last entry
    last_entry_type = entries[-1][1] if entries else 'unknown'
    session_status = 'complete' if last_entry_type == 'assistant' else 'awaiting_response'

    # Build markdown content with structured frontmatter
    author = get_git_author()
    github_user = get_github_user()
    git_email = get_git_email()
    lines = ["---"]
    lines.append(f"session_id: {session_id}")
    lines.append(f"date: {date}")
    lines.append(f"author: {author}")
    lines.append(f"github_user: {github_user}")
    lines.append(f"git_email: {git_email}")
    lines.append(f"project: {cwd.name}")
    lines.append(f"session_status: {session_status}")
    lines.append(f"last_entry_type: {last_entry_type}")
    lines.append(f"total_exchanges: {len([e for e in entries if e[1] == 'user'])}")
    lines.append(f"generated_at: {datetime.now().isoformat()}")

    # Add all calculated stats to frontmatter
    for key, value in session_stats.items():
        lines.append(f"{key}: {value}")

    lines.append("---\n")
    lines.append(f"# Claude Session Log - {date}\n")
    lines.append(f"Session: `{session_id}` | Project: `{cwd.name}` | Author: `{author}` | GitHub: `{github_user}`\n")
    lines.append("---\n")

    # Pre-calculate paste indicators for all prompts
    prompts_data = []
    for timestamp, role, content in entries:
        if role == 'user':
            paste_indicators = detect_paste_indicators(content)
            prompts_data.append({
                'timestamp': timestamp,
                'content': content,
                'chars': len(content),
                'words': len(content.split()),
                'paste_indicators': paste_indicators,
            })

    exchange_num = 0
    prompt_index = 0

    for i, (timestamp, role, content) in enumerate(entries):
        time_str = format_timestamp(timestamp)

        if role == 'user':
            exchange_num += 1
            prompt_data = prompts_data[prompt_index]
            indicators = prompt_data['paste_indicators']

            # Use unique delimiter with session ID to prevent collision with content
            lines.append(f"\n[CLAUDE_LOG_ENTRY type=PROMPT num={exchange_num} session={session_id}]")
            lines.append(f"timestamp: {timestamp}")
            lines.append(f"time: {time_str}")
            lines.append(f"chars: {prompt_data['chars']}")
            lines.append(f"words: {prompt_data['words']}")
            lines.append(f"has_code_block: {indicators['has_code_block']}")
            lines.append(f"has_file_paths: {indicators['has_file_paths']}")
            lines.append(f"has_urls: {indicators['has_urls']}")
            lines.append(f"likely_pasted: {indicators['likely_pasted']}")
            lines.append(f"\n{content}\n")

            prompt_index += 1
        else:
            # Use unique delimiter with session ID to prevent collision with content
            lines.append(f"\n[CLAUDE_LOG_ENTRY type=RESPONSE num={exchange_num} session={session_id}]")
            lines.append(f"timestamp: {timestamp}")
            lines.append(f"time: {time_str}")
            lines.append(f"chars: {len(content)}")
            lines.append(f"\n{content}\n")

    output_path.write_text('\n'.join(lines), encoding='utf-8')


if __name__ == '__main__':
    main()

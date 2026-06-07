# Agentic build logs — Qur'an Chat App

Raw prompt + response transcripts from building this app with **Claude Code**
(Anthropic's CLI coding agent), submitted as part of the 8x Play Engineer
assignment.

## What's in here

- One markdown file per Claude Code session, named `<date>_<session-id>.md`.
- Every entry is a real exchange: a `PROMPT` (what I asked) followed by the
  agent's final `RESPONSE`, inside `[CLAUDE_LOG_ENTRY ...]` blocks, each stamped
  with its real ISO timestamp.
- The YAML frontmatter at the top of each file carries session statistics —
  total exchanges, first/last prompt time, duration, average prompt/response
  length, paste indicators, and so on.

The main session holds **~990 exchanges spanning June 1 -> June 7, 2026** — the
full week of building.

## How they were captured

Claude Code automatically writes the raw transcript of every session to
`~/.claude/projects/<project>/<session>.jsonl` while you work. These markdown
files are produced from those native transcripts using 8x's own
`scripts/extract-log.py` (lightly patched for Windows path-hashing and UTF-8 so
it runs on Windows). The prompts, responses, and timestamps are the genuine
record of the build — nothing here was rewritten or reconstructed after the fact.

## Security

A redaction pass replaced any live credentials that were pasted into the chat
during initial setup (API keys, tokens, JWTs) with `[REDACTED_...]` placeholders.
No working secrets are present in these logs.

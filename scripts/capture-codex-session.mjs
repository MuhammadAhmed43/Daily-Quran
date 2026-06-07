#!/usr/bin/env node
/**
 * Capture the latest Codex CLI session as a markdown transcript and write it to
 * `.claude-logs/` so it gets committed alongside code changes.
 *
 * Usage: pnpm logs:capture
 *
 * Source:  ~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<sessionId>.jsonl
 * Target:  .claude-logs/<YYYY-MM-DD>_<HH-MM-SS>_<sessionId-prefix>_codex.md
 */

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const SESSIONS_ROOT = join(homedir(), '.codex', 'sessions');
const OUT_DIR = join(process.cwd(), '.claude-logs');
const SESSION_ID_ENV_KEYS = ['CODEX_SESSION_ID', 'CODEX_THREAD_ID', 'CODEX_LOG_SESSION_ID'];

async function readStdinPayload() {
  return await new Promise((resolvePromise) => {
    if (process.stdin.isTTY) {
      resolvePromise(null);
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      if (!data.trim()) {
        resolvePromise(null);
        return;
      }
      try {
        resolvePromise(JSON.parse(data));
      } catch {
        resolvePromise(null);
      }
    });
  });
}

function getWantedSessionId() {
  for (const key of SESSION_ID_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function readSessionMeta(jsonlPath) {
  try {
    const firstLine = readFileSync(jsonlPath, 'utf8').split('\n', 1)[0];
    if (!firstLine) return null;
    const evt = JSON.parse(firstLine);
    if (evt?.type !== 'session_meta' || !evt.payload || typeof evt.payload !== 'object') {
      return null;
    }
    const payload = evt.payload;
    return {
      id: typeof payload.id === 'string' ? payload.id : null,
      cwd: typeof payload.cwd === 'string' ? payload.cwd : null,
      timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : null,
    };
  } catch {
    return null;
  }
}

function samePath(a, b) {
  if (!a || !b) return false;
  return resolve(a) === resolve(b);
}

function findLatestSessionFile() {
  if (!existsSync(SESSIONS_ROOT)) return null;

  const candidates = [];
  const walk = (dir, depth = 0) => {
    if (depth > 4) return;
    let entries = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const p = join(dir, name);
      let stat;
      try {
        stat = statSync(p);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(p, depth + 1);
      } else if (name.endsWith('.jsonl')) {
        candidates.push({ path: p, mtime: stat.mtimeMs });
      }
    }
  };
  walk(SESSIONS_ROOT);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.mtime - a.mtime);

  const targetCwd = resolve(process.cwd());
  const wantedSessionId = getWantedSessionId();
  let cwdMatch = null;

  for (const candidate of candidates) {
    const meta = readSessionMeta(candidate.path);
    if (!meta) continue;
    if (wantedSessionId && meta.id === wantedSessionId && samePath(meta.cwd, targetCwd)) {
      return candidate.path;
    }
    if (!cwdMatch && samePath(meta.cwd, targetCwd)) {
      cwdMatch = candidate.path;
    }
    if (wantedSessionId && meta.id === wantedSessionId) {
      return candidate.path;
    }
  }

  return cwdMatch;
}

function extractText(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const obj = part;
          if (typeof obj.text === 'string') return obj.text;
          if (typeof obj.input_text === 'string') return obj.input_text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof content === 'object') {
    const obj = content;
    if (typeof obj.text === 'string') return obj.text;
  }
  return '';
}

function renderMarkdown(jsonlPath) {
  const raw = readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean);
  let sessionId = 'unknown';
  let startedAt = null;
  const turns = [];

  for (const line of raw) {
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }

    if (evt.type === 'session_meta' && evt.payload) {
      const p = evt.payload;
      if (typeof p.id === 'string') sessionId = p.id;
      if (typeof p.timestamp === 'string') startedAt = new Date(p.timestamp);
    }

    if (evt.type === 'response_item' && evt.payload) {
      const p = evt.payload;
      if (p.type !== 'message') continue;
      const role = typeof p.role === 'string' ? p.role : 'unknown';
      const text = extractText(p.content).trim();
      if (!text) continue;
      // Skip the tool/permission preamble that Codex injects as a developer message.
      if (role === 'developer' && text.startsWith('<')) continue;
      turns.push(`### ${role}\n\n${text}`);
    }
  }

  if (!startedAt) startedAt = new Date(statSync(jsonlPath).mtimeMs);

  const header = [
    `# Codex Session Log - ${startedAt.toISOString().slice(0, 10)}`,
    '',
    `Session: \`${sessionId}\``,
    `Working directory: \`${process.cwd()}\``,
    `Source: \`${jsonlPath.replace(homedir(), '~')}\``,
    '',
    '---',
    '',
  ].join('\n');

  return {
    md: header + turns.join('\n\n---\n\n') + '\n',
    sessionId,
    startedAt,
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

async function main() {
  const payload = await readStdinPayload();
  const transcriptPath =
    payload && typeof payload.transcript_path === 'string' && payload.transcript_path.trim()
      ? payload.transcript_path.trim()
      : null;

  const latest = transcriptPath ?? findLatestSessionFile();
  if (!latest || !existsSync(latest)) {
    console.log(
      `No matching Codex session found for ${process.cwd()} under ${SESSIONS_ROOT}.`,
    );
    process.exit(0);
  }

  const { md, sessionId, startedAt } = renderMarkdown(latest);
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const date = `${startedAt.getFullYear()}-${pad(startedAt.getMonth() + 1)}-${pad(startedAt.getDate())}`;
  const time = `${pad(startedAt.getHours())}-${pad(startedAt.getMinutes())}-${pad(startedAt.getSeconds())}`;
  const idShort = sessionId.split('-')[0] || 'codex';
  const outPath = join(OUT_DIR, `${date}_${time}_${idShort}_codex.md`);

  writeFileSync(outPath, md);
  console.log(`Wrote ${outPath}`);
}

await main();

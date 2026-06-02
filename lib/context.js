// lib/context.js — the shared "team context" (hot-core L1) injected into agent runs.
//
// Source of truth: ~/.claude/memory-global/team-context.md (distilled, ≤~500 tok).
// We strip frontmatter, enforce a hard char cap (budget guard), and cache by mtime
// so we read the file at most once per edit. The text is injected as a STABLE
// PREFIX of the agent's appended system prompt → prompt-cache eligible across runs.

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";

const CONTEXT_FILE = path.join(os.homedir(), ".claude", "memory-global", "team-context.md");
const CHAR_CAP = 2600; // ~650 tokens hard ceiling (budget 500 + headroom); guards against bloat

let _cache = { mtimeMs: -1, value: null };

const EMPTY = { available: false, text: "", chars: 0, tokensEstimate: 0, capped: false, source: CONTEXT_FILE };

export async function getSharedContext() {
  let stat;
  try {
    stat = await fs.stat(CONTEXT_FILE);
  } catch {
    return EMPTY;
  }
  if (_cache.value && _cache.mtimeMs === stat.mtimeMs) return _cache.value;

  let body;
  try {
    body = matter(await fs.readFile(CONTEXT_FILE, "utf8")).content.trim();
  } catch {
    return EMPTY;
  }

  let capped = false;
  if (body.length > CHAR_CAP) { body = body.slice(0, CHAR_CAP) + "\n…[truncated to budget]"; capped = true; }

  const value = {
    available: body.length > 0,
    text: body,
    chars: body.length,
    tokensEstimate: Math.round(body.length / 4), // rough heuristic, good enough for the meter
    capped,
    source: CONTEXT_FILE,
  };
  _cache = { mtimeMs: stat.mtimeMs, value };
  return value;
}

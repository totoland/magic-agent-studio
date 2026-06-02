// lib/runner.js — run an agent for real via the Claude Code CLI and translate
// its stream-json output into the timeline events the Studio UI renders.
//
// We run the agent's persona as an appended system prompt with its granted tools
// pre-approved (--allowedTools), so tool calls stream at the top level and we can
// show them live. The CLI runs headless (-p / --print).

import { spawn } from "node:child_process";
import os from "node:os";

const TOOL_ICONS = {
  Read: "📄", Write: "📝", Edit: "✏️", MultiEdit: "✏️", NotebookEdit: "✏️",
  Bash: "🖥️", BashOutput: "🖥️", Grep: "🔎", Glob: "🔎",
  WebSearch: "🔎", WebFetch: "🌐", Task: "🧩", TodoWrite: "✅",
};
function iconFor(name) {
  if (TOOL_ICONS[name]) return TOOL_ICONS[name];
  if (name && name.startsWith("mcp__")) return "⚙";
  return "🔧";
}
function prettyTool(name) {
  if (name && name.startsWith("mcp__")) return name.replace(/^mcp__/, "").replace(/__/g, " · ");
  return name || "tool";
}

// One-line summary of a tool's input, picking the most meaningful field.
function summarizeInput(name, input) {
  if (!input || typeof input !== "object") return "";
  const pick = (v) => String(v).replace(/\s+/g, " ").trim().slice(0, 64);
  if (input.command) return pick(input.command);
  if (input.query) return pick(input.query);
  if (input.pattern) return pick(input.pattern);
  if (input.url) { try { return new URL(input.url).host; } catch { return pick(input.url); } }
  if (input.file_path) return pick(String(input.file_path).split("/").pop());
  if (input.path) return pick(String(input.path).split("/").pop());
  if (input.prompt) return pick(input.prompt);
  if (input.description) return pick(input.description);
  const keys = Object.keys(input);
  return keys.length ? pick(`${keys[0]}: ${JSON.stringify(input[keys[0]])}`) : "";
}

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((b) => (typeof b === "string" ? b : b?.text || "")).join("");
  }
  return "";
}

/**
 * Run an agent. Calls `onEvent(evt)` for each UI event and resolves when done.
 * Returns a handle with .stop().
 *
 * Event shapes (match run.jsx EventNode):
 *   { kind:'start', text }
 *   { kind:'thinking', text }
 *   { kind:'tool', id, icon, label, arg }                 // pending
 *   { kind:'tool_update', id, state:'done'|'error', result }
 *   { kind:'result', text, tokens }
 *   { kind:'tokens', tokens }
 *   { kind:'done', status:'completed'|'error', tokens }
 *   { kind:'error', text }
 */
export function runAgent({ task, body, model, tools, cwd, sharedContext }, onEvent) {
  // The prompt is fed via stdin (NOT a positional arg): --allowedTools is a
  // variadic flag and would otherwise swallow a trailing positional task.
  const args = ["--print", "--output-format", "stream-json", "--verbose", "--input-format", "text"];
  if (model && model !== "inherit") args.push("--model", model);
  // Compose the appended system prompt: shared team context FIRST (stable prefix
  // → prompt-cache eligible across runs), then the agent's own persona.
  const appended = sharedContext
    ? `${sharedContext}\n\n---\n\n${body || ""}`
    : (body || "");
  if (appended) args.push("--append-system-prompt", appended);
  const allowed = (tools || []).filter(Boolean);
  if (allowed.length) args.push("--allowedTools", ...allowed); // keep variadic flag last

  onEvent({ kind: "start", text: task || "Run agent" });

  const child = spawn("claude", args, {
    cwd: cwd || os.homedir(),
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.write(task || "");
  child.stdin.end();

  let buf = "";
  let tokens = 0;
  let cached = 0; // cache_read_input_tokens — how much of the prompt (incl. shared context) was a cache hit
  let finished = false;
  let stderr = "";

  function handleLine(line) {
    line = line.trim();
    if (!line) return;
    let evt;
    try { evt = JSON.parse(line); } catch { return; }

    if (evt.type === "assistant" && evt.message) {
      const usage = evt.message.usage;
      if (usage) {
        cached = usage.cache_read_input_tokens || cached;
        tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0) +
                 (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
        onEvent({ kind: "tokens", tokens, cached });
      }
      for (const block of evt.message.content || []) {
        if (block.type === "text" && block.text && block.text.trim()) {
          onEvent({ kind: "thinking", text: block.text.trim() });
        } else if (block.type === "tool_use") {
          onEvent({
            kind: "tool", id: block.id, icon: iconFor(block.name),
            label: prettyTool(block.name), arg: summarizeInput(block.name, block.input),
          });
        }
      }
    } else if (evt.type === "user" && evt.message) {
      for (const block of evt.message.content || []) {
        if (block.type === "tool_result") {
          const txt = textFromContent(block.content).replace(/\s+/g, " ").trim();
          onEvent({
            kind: "tool_update", id: block.tool_use_id,
            state: block.is_error ? "error" : "done",
            result: txt.slice(0, 70) || (block.is_error ? "error" : "ok"),
          });
        }
      }
    } else if (evt.type === "result") {
      if (typeof evt.result === "string" && evt.result.trim()) {
        onEvent({ kind: "result", text: evt.result.trim(), tokens });
      }
      if (evt.usage) {
        const u = evt.usage;
        cached = u.cache_read_input_tokens || cached;
        tokens = (u.input_tokens || 0) + (u.output_tokens || 0) +
                 (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) || tokens;
      }
    }
  }

  child.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      handleLine(line);
    }
  });

  child.stderr.on("data", (c) => { stderr += c.toString(); });

  child.on("error", (err) => {
    if (finished) return;
    finished = true;
    onEvent({ kind: "error", text: `Failed to launch claude: ${err.message}` });
    onEvent({ kind: "done", status: "error", tokens });
  });

  child.on("close", (code) => {
    if (finished) return;
    finished = true;
    if (buf.trim()) handleLine(buf);
    if (code !== 0) {
      const msg = stderr.trim().split("\n").slice(-3).join(" ").slice(0, 200);
      onEvent({ kind: "error", text: msg || `claude exited with code ${code}` });
      onEvent({ kind: "done", status: "error", tokens, cached });
    } else {
      onEvent({ kind: "done", status: "completed", tokens, cached });
    }
  });

  return {
    stop() {
      if (finished) return;
      finished = true;
      child.kill("SIGTERM");
      onEvent({ kind: "done", status: "stopped", tokens, cached });
    },
  };
}

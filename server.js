// server.js — Agent Studio backend.
// Serves the React prototype from public/ and exposes a real API over the
// local ~/.claude/agents/ files, a live run streamer, and routine metadata.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listAgents, getAgent, createAgent, updateAgent, deleteAgent, duplicateAgent,
  AVATARS_DIR,
} from "./lib/agents.js";
import { runAgent } from "./lib/runner.js";
import { listRoutines, setEnabled } from "./lib/routines.js";
import { getSharedContext } from "./lib/context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4317;

app.use(express.json({ limit: "12mb" })); // base64 avatars can be chunky

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(400).json({ error: err.message });
});

// ── Agents CRUD ──────────────────────────────────────────────────────────────
app.get("/api/agents", wrap(async (_req, res) => res.json(await listAgents())));
app.get("/api/agents/:id", wrap(async (req, res) => res.json(await getAgent(req.params.id))));
app.post("/api/agents", wrap(async (req, res) => res.json(await createAgent(req.body))));
app.put("/api/agents/:id", wrap(async (req, res) => res.json(await updateAgent(req.params.id, req.body))));
app.delete("/api/agents/:id", wrap(async (req, res) => res.json(await deleteAgent(req.params.id))));
app.post("/api/agents/:id/duplicate", wrap(async (req, res) => res.json(await duplicateAgent(req.params.id))));

// ── Routines ─────────────────────────────────────────────────────────────────
app.get("/api/routines", wrap(async (_req, res) => res.json(await listRoutines())));
app.put("/api/routines/:id", wrap(async (req, res) => res.json(await setEnabled(req.params.id, !!req.body.enabled))));

// ── Shared "team context" (hot-core L1) preview, for the Run-tab meter ──────────
app.get("/api/context", wrap(async (_req, res) => {
  const c = await getSharedContext();
  res.json({ available: c.available, tokensEstimate: c.tokensEstimate, chars: c.chars, capped: c.capped });
}));

// ── Run (Server-Sent Events) ─────────────────────────────────────────────────
// GET /api/run?agentId=...&task=...&label=...
app.get("/api/run", async (req, res) => {
  const { agentId, task = "", label } = req.query;
  const wantContext = (req.query.context ?? "on") !== "off";
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (evt) => res.write(`data: ${JSON.stringify(evt)}\n\n`);

  let agent;
  try {
    agent = await getAgent(agentId);
  } catch (err) {
    send({ kind: "error", text: `Agent not found: ${agentId}` });
    send({ kind: "done", status: "error", tokens: 0 });
    return res.end();
  }
  if (label) send({ kind: "label", text: label });

  let sharedContext = null;
  if (wantContext) {
    const ctx = await getSharedContext();
    if (ctx.available) { sharedContext = ctx.text; send({ kind: "context", tokens: ctx.tokensEstimate }); }
  }

  const handle = runAgent(
    { task: String(task), body: agent.body, model: agent.model, tools: agent.tools, sharedContext },
    (evt) => {
      send(evt);
      if (evt.kind === "done") res.end();
    }
  );

  // keep-alive ping so proxies/browsers don't drop the idle stream
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => { clearInterval(ping); handle.stop(); });
  res.on("close", () => clearInterval(ping));
});

// ── Chat (Server-Sent Events) — multi-turn, resumes a session ─────────────────
// GET /api/chat?agentId=...&message=...&session=<id?>&context=on|off
// First turn (no session): injects persona (+ optional context). Resume turns
// (session given): no re-inject — the stored session already has the system prompt.
app.get("/api/chat", async (req, res) => {
  const { agentId, message = "", session } = req.query;
  const isResume = !!session;
  const wantContext = (req.query.context ?? "off") !== "off"; // chat relies on CLAUDE.md by default
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (evt) => res.write(`data: ${JSON.stringify(evt)}\n\n`);

  let agent;
  try {
    agent = await getAgent(agentId);
  } catch {
    send({ kind: "error", text: `Agent not found: ${agentId}` });
    send({ kind: "done", status: "error", tokens: 0 });
    return res.end();
  }

  let sharedContext = null;
  if (!isResume && wantContext) {
    const ctx = await getSharedContext();
    if (ctx.available) { sharedContext = ctx.text; send({ kind: "context", tokens: ctx.tokensEstimate }); }
  }

  const handle = runAgent(
    {
      task: String(message), model: agent.model, tools: agent.tools,
      body: isResume ? null : agent.body,
      sharedContext: isResume ? null : sharedContext,
      resumeSessionId: isResume ? String(session) : null,
    },
    (evt) => { send(evt); if (evt.kind === "done") res.end(); }
  );

  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => { clearInterval(ping); handle.stop(); });
  res.on("close", () => clearInterval(ping));
});

// ── Static: avatars + the app ────────────────────────────────────────────────
app.use("/avatars", express.static(AVATARS_DIR));
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`\n  🎛  Agent Studio  →  http://localhost:${PORT}\n`);
});

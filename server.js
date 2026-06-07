// server.js — Agent Studio backend.
// Serves the React prototype from public/ and exposes a real API over the
// local ~/.claude/agents/ files, a live run streamer, and routine metadata.

import express from "express";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  listAgents, getAgent, createAgent, updateAgent, deleteAgent, duplicateAgent,
  addSpriteFrame, clearSpriteState, setSpriteHeight, AVATARS_DIR,
} from "./lib/agents.js";
import { runAgent } from "./lib/runner.js";
import { listRoutines, setEnabled } from "./lib/routines.js";
import { getSharedContext } from "./lib/context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4317;
// Bind localhost by default (the app has no auth and runs tools — don't expose it
// raw on a LAN). Put Cloudflare Tunnel / SSH in front. Set HOST=0.0.0.0 only with
// an auth proxy ahead of it.
const HOST = process.env.HOST || "127.0.0.1";
const UPLOADS_DIR = path.join(os.homedir(), ".claude", "agents", ".studio", "uploads");

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
app.post("/api/agents/:id/sprite", wrap(async (req, res) => res.json(await addSpriteFrame(req.params.id, req.body.state, req.body.dataB64))));
app.delete("/api/agents/:id/sprite", wrap(async (req, res) => res.json(await clearSpriteState(req.params.id, req.query.state))));
app.post("/api/agents/:id/sprite-height", wrap(async (req, res) => res.json(await setSpriteHeight(req.params.id, req.body.height))));

// ── Routines ─────────────────────────────────────────────────────────────────
app.get("/api/routines", wrap(async (_req, res) => res.json(await listRoutines())));
app.put("/api/routines/:id", wrap(async (req, res) => res.json(await setEnabled(req.params.id, !!req.body.enabled))));

// ── Upload a chat attachment (base64) → saved to disk; agents Read it by path ──
app.post("/api/upload", wrap(async (req, res) => {
  const { name, dataB64 } = req.body || {};
  if (!dataB64) throw new Error("no file data");
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataB64);
  const b64 = m ? m[2] : dataB64;
  const mime = m ? m[1] : "";
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const safe = (name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
  const fname = `${Date.now()}-${safe}`;
  await fs.writeFile(path.join(UPLOADS_DIR, fname), Buffer.from(b64, "base64"));
  const isImage = mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name || "");
  res.json({ name: name || fname, path: path.join(UPLOADS_DIR, fname), url: `/uploads/${encodeURIComponent(fname)}`, isImage });
}));

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
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, HOST, () => {
  console.log(`\n  🎛  Agent Studio  →  http://${HOST}:${PORT}  (bound: ${HOST})\n`);
});

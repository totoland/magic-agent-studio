# 🎛 Totoland Agent Studio

A local dashboard for managing your Claude Code subagents — edit personas, run
them with live streaming activity, manage avatars, and view scheduled routines.

The polished UI came from a Claude Design mockup; this repo wires it to a **real
backend** that operates on your actual `~/.claude/agents/*.md` files and runs
agents through the Claude Code CLI.

## Run it

```bash
npm install
npm start
# → http://localhost:4317
```

(Set `PORT=xxxx` / `HOST=xxxx` to change port/bind — defaults to `127.0.0.1:4317`. See `.env.example`.)

**Deploy to an always-on server (Mac mini):** see [`deploy/README.md`](deploy/README.md) —
`bash deploy/setup.sh` installs a launchd service; reach it securely via Cloudflare Tunnel + Access.

## What's real

| Feature | Backed by |
|---|---|
| **Agent list / persona editor** | reads & writes `~/.claude/agents/<name>.md` (YAML frontmatter + system-prompt body) |
| **Create / duplicate / delete** | real files created/copied/removed on disk |
| **Run + live activity** | spawns `claude --print --output-format stream-json` with the agent's persona (`--append-system-prompt`), its granted tools (`--allowedTools`), and model; the NDJSON stream is parsed into the timeline you see |
| **Avatars** | preset illustrations, or upload an image → stored under `~/.claude/agents/.studio/avatars/` |
| **Dark / light theme, tweaks** | client-side |
| **Routines** | see note below |

Studio-only metadata (avatar, color, glyph) lives in a sidecar
`~/.claude/agents/.studio/meta.json` so your `.md` files stay clean and valid as
Claude Code agent definitions.

## How a run works

When you hit **Run**, the backend executes (roughly):

```
claude --print --output-format stream-json --verbose \
       --model <model> \
       --append-system-prompt "<the agent's persona>" \
       --allowedTools <the agent's tools> \
       "<your task>"
```

- The agent runs with **its declared tools pre-approved** (so it can actually do
  the work). Tools the agent doesn't list are auto-denied — no interactive
  prompts. Because tools like `Bash`/`Write`/`Edit` can change files, only run
  agents you trust with the tools you granted them.
- Output streams back over Server-Sent Events (`GET /api/run`) and is mapped to
  the live timeline (tool calls, thinking, result, token & elapsed counters).
- MCP tools (Crypto.com, Google Drive, …) work only if those MCP servers are
  configured in your Claude Code CLI.

## Routines (scheduled remote agents)

Routines run in Anthropic's cloud (claude.ai), which needs an OAuth session this
local server doesn't hold. So Studio shows routines **read-mostly**: you can see
the schedule, flip the local enabled flag, **Run now** (runs the routine's agent
locally), and deep-link to claude.ai to manage the real schedule. The seeded
`daily-tech-briefing` links to your actual cloud routine.

## Architecture

```
server.js            Express: REST + SSE, serves public/ and /avatars
lib/agents.js        parse/serialize agent .md files + sidecar meta
lib/runner.js        spawn claude, map stream-json → UI events
lib/routines.js      local routine store (seeded)
public/              the React (Babel-in-browser) prototype
  app.jsx            orchestrator — fetches the API, runs via EventSource
  data.jsx           constants (tools, models, templates)
  *.jsx              presentational components from the design
```

## API

```
GET    /api/agents
GET    /api/agents/:id
POST   /api/agents                 {name, description, model, tools[], body, avatar, color, glyph}
PUT    /api/agents/:id             (same shape; supports rename)
DELETE /api/agents/:id
POST   /api/agents/:id/duplicate
GET    /api/run?agentId=&task=&label=     (Server-Sent Events)
GET    /api/routines
PUT    /api/routines/:id           {enabled}
```

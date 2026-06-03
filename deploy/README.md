# Deploying Agent Studio to a Mac mini

Run Agent Studio as an always-on service on a Mac mini and reach it securely.
Assumes the Mac mini username is the same as your laptop (`totoland`), so the
hardcoded vault path `/Users/totoland/Documents/Obsidian Vault/...` in the agent
personas resolves unchanged.

## 1. Prerequisites (on the Mac mini)

```bash
brew install node
npm i -g @anthropic-ai/claude-code
claude          # log in (the app shells out to this CLI)
```

> The app's runtime state lives in `~/.claude` and it spawns `claude`, so Claude
> Code must be installed **and authenticated** as the user that runs the service.

## 2. Clone + install + service

```bash
git clone https://github.com/totoland/magic-agent-studio.git
cd magic-agent-studio
bash deploy/setup.sh           # installs deps + a launchd service (boot + auto-restart)
```

`setup.sh` writes `~/Library/LaunchAgents/com.totoland.agent-studio.plist`,
binds `127.0.0.1:4317` by default, and logs to `~/Library/Logs/agent-studio/`.
Override with `PORT=... HOST=... bash deploy/setup.sh`.

Manage it:
```bash
launchctl unload ~/Library/LaunchAgents/com.totoland.agent-studio.plist   # stop
launchctl load   ~/Library/LaunchAgents/com.totoland.agent-studio.plist   # start
tail -f ~/Library/Logs/agent-studio/err.log
```

## 3. Bring over your state (one-time, from the laptop)

The code is in git, but your **agents, memory, and vault are not** — copy them:

```bash
# agents (definitions + studio metadata/avatars)
rsync -av  ~/.claude/agents/            totoland@macmini:~/.claude/agents/
# global memory (L1 hot-core + CLAUDE.md)
rsync -av  ~/.claude/memory-global/     totoland@macmini:~/.claude/memory-global/
rsync -av  ~/.claude/CLAUDE.md          totoland@macmini:~/.claude/CLAUDE.md
# project memory (L2)
rsync -av  ~/.claude/projects/-Users-totoland-git-workspace/memory/ \
           totoland@macmini:~/.claude/projects/-Users-totoland-git-workspace/memory/
# Obsidian vault (notes, journal, PRDs) — skip if you set up continuous sync below
rsync -av  ~/Documents/"Obsidian Vault"/  totoland@macmini:~/Documents/"Obsidian Vault"/
```

## 4. Keep the vault in sync (free options — Obsidian Sync is paid)

Agents on the Mac mini **read and write** the vault, so you want continuous,
bidirectional sync with your laptop:

- **Syncthing** (recommended) — free, open-source, headless, bidirectional.
  `brew install syncthing` on both machines, share the `Obsidian Vault` folder.
- **Obsidian Git** plugin — vault as a git repo, auto commit/pull. Git-native, but
  needs a periodic `git pull/push` (cron) on the server side and handles conflicts
  less gracefully than Syncthing.
- **iCloud Drive** — free up to 5GB if the vault lives in iCloud; simplest, but
  small-file sync can lag.

Apply the same idea to `~/.claude/agents` + `~/.claude/memory-global` if you want
both machines to share one source of truth (Syncthing, or a private git repo).

## 5. Reach it securely with Cloudflare (you already have Cloudflare)

The app has **no built-in auth** and its agents can run shell/file tools — never
expose it raw. Use a Cloudflare Tunnel + Access:

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create agent-studio
# route a hostname → the local service
cloudflared tunnel route dns agent-studio studio.yourdomain.com
cloudflared tunnel run --url http://localhost:4317 agent-studio
```

Then in **Cloudflare Zero Trust → Access**, add an application for
`studio.yourdomain.com` with a policy (e.g. allow only your email). That puts
login in front of the app — no open ports, authenticated access from anywhere.
Run `cloudflared` itself as a launchd service too (`cloudflared service install`).

## 6. Routines

Scheduled routines run in **Anthropic's cloud** (claude.ai), tied to your account,
not the machine — they keep firing regardless of which box runs the Studio. Manage
them at https://claude.ai/code/routines (or ask Claude Code to `/schedule`).

## Updating later

```bash
cd magic-agent-studio && git pull && npm install
launchctl unload ~/Library/LaunchAgents/com.totoland.agent-studio.plist
launchctl load   ~/Library/LaunchAgents/com.totoland.agent-studio.plist
```

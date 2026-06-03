#!/usr/bin/env bash
# Agent Studio — Mac mini setup.
# Installs deps and a launchd service that runs the server at boot (auto-restart).
# Run from anywhere: bash deploy/setup.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.totoland.agent-studio"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/agent-studio"
PORT="${PORT:-4317}"
HOST="${HOST:-127.0.0.1}"

echo "▸ Repo:  $REPO_DIR"
echo "▸ Bind:  $HOST:$PORT"

# 1. Prerequisites
command -v node >/dev/null || { echo "✗ node not found. Install: brew install node"; exit 1; }
NODE_BIN="$(command -v node)"
echo "▸ node:  $NODE_BIN ($(node -v))"
if command -v claude >/dev/null; then
  echo "▸ claude: $(command -v claude) ($(claude --version 2>/dev/null | head -1))"
else
  echo "⚠ claude CLI not found. Install + log in:"
  echo "    npm i -g @anthropic-ai/claude-code && claude"
fi

# 2. Dependencies
echo "▸ Installing npm dependencies…"
( cd "$REPO_DIR" && npm install )

# 3. launchd service
mkdir -p "$LOG_DIR" "$(dirname "$PLIST")"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$REPO_DIR/server.js</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>$PORT</string>
    <key>HOST</key><string>$HOST</string>
    <key>PATH</key><string>$(dirname "$NODE_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/out.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/err.log</string>
</dict>
</plist>
PLISTEOF
echo "▸ Wrote $PLIST"

# 4. (Re)load
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
sleep 1

echo
echo "✓ Agent Studio service is running → http://$HOST:$PORT"
echo "  logs:    $LOG_DIR/out.log  ·  $LOG_DIR/err.log"
echo "  stop:    launchctl unload $PLIST"
echo "  start:   launchctl load $PLIST"
echo
echo "Next:"
echo "  • the agent .md files + memory live in ~/.claude — rsync them from your laptop (see deploy/README.md)"
echo "  • expose securely with Cloudflare Tunnel + Access (see deploy/README.md)"

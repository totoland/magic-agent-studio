#!/usr/bin/env bash
# Push local agents + knowledge base (optionally memory) to the Mac mini.
# Manual one-time/on-demand sync — NOT continuous. Non-destructive: never deletes
# remote files (no --delete). Re-run any time after editing on the laptop.
#
# Usage:
#   bash deploy/sync-to-macmini.sh                 # sync agents + knowledge base
#   bash deploy/sync-to-macmini.sh -n              # dry run (preview, change nothing)
#   bash deploy/sync-to-macmini.sh --with-memory   # also sync global memory (CLAUDE.md + memory-global)
#   REMOTE=totoland@192.168.0.103 bash deploy/sync-to-macmini.sh   # override SSH target
set -euo pipefail

REMOTE="${REMOTE:-macmini}"               # SSH host/alias (see ~/.ssh/config)
VAULT="$HOME/Documents/Obsidian Vault"    # local Obsidian vault
WITH_MEM=0
RSYNC=(rsync -a --itemize-changes --human-readable --exclude='.obsidian/workspace*.json')

for a in "$@"; do
  case "$a" in
    -n|--dry-run)  RSYNC+=(-n); echo "▸ DRY RUN — no changes will be made" ;;
    --with-memory) WITH_MEM=1 ;;
    -h|--help)     grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown arg: $a (try --help)"; exit 1 ;;
  esac
done

echo "▸ Remote: $REMOTE"

echo "── agents → ~/.claude/agents/"
"${RSYNC[@]}" "$HOME/.claude/agents/" "$REMOTE:.claude/agents/"

echo "── knowledge base → ~/Documents/Obsidian Vault/"
# remote path has a space → escape it so the remote shell keeps it as one arg
"${RSYNC[@]}" "$VAULT/" "$REMOTE:Documents/Obsidian\\ Vault/"

if [ "$WITH_MEM" = "1" ]; then
  echo "── global memory → ~/.claude/ (CLAUDE.md + memory-global)"
  "${RSYNC[@]}" "$HOME/.claude/CLAUDE.md"        "$REMOTE:.claude/CLAUDE.md"
  "${RSYNC[@]}" "$HOME/.claude/memory-global/"   "$REMOTE:.claude/memory-global/"
  # NB: L2 project memory is keyed to a project path and isn't portable across machines — skipped.
fi

echo "✓ sync complete"

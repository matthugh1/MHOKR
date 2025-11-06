#!/bin/bash
#
# tmux Development Helper
# 
# Creates a tmux session with panes for API, Web, and live status monitoring.
# Optional helper - devctl works without tmux.
#
# Usage: ./scripts/dev/tmux-dev.sh
#

set -e

SESSION_NAME="okr-dev"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Check if tmux is available
if ! command -v tmux &> /dev/null; then
  echo "❌ tmux is not installed. Skipping tmux setup."
  echo "💡 You can still use 'npm run dev:all' without tmux."
  exit 1
fi

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "⚠️  Session '$SESSION_NAME' already exists."
  echo "💡 Attach with: tmux attach -t $SESSION_NAME"
  echo "💡 Kill with: tmux kill-session -t $SESSION_NAME"
  exit 1
fi

echo "🚀 Creating tmux session: $SESSION_NAME"
echo "📦 Root directory: $ROOT_DIR"
echo ""

# Create new session (detached)
tmux new-session -d -s "$SESSION_NAME" -c "$ROOT_DIR"

# Split window horizontally (top/bottom)
tmux split-window -h -t "$SESSION_NAME"

# Split left pane vertically (top left / bottom left)
tmux split-window -v -t "$SESSION_NAME:0.0"

# Configure panes:
# - Pane 0 (left): API service
# - Pane 1 (middle): Web service  
# - Pane 2 (right): Status monitor

# Pane 0: API
tmux send-keys -t "$SESSION_NAME:0.0" "cd $ROOT_DIR && echo '🚀 Starting API...' && npm run dev:core-api" C-m
tmux select-pane -t "$SESSION_NAME:0.0" -T "API"

# Pane 1: Web
tmux send-keys -t "$SESSION_NAME:0.1" "cd $ROOT_DIR && echo '🚀 Starting Web...' && npm run dev:web" C-m
tmux select-pane -t "$SESSION_NAME:0.1" -T "Web"

# Pane 2: Status (refresh every 5s)
tmux send-keys -t "$SESSION_NAME:0.2" "cd $ROOT_DIR && echo '📊 Health Status Monitor' && while true; do clear; npm run dev:status; sleep 5; done" C-m
tmux select-pane -t "$SESSION_NAME:0.2" -T "Status"

# Select first pane and attach
tmux select-pane -t "$SESSION_NAME:0.0"
tmux select-layout -t "$SESSION_NAME" tiled

echo "✅ tmux session created!"
echo ""
echo "📝 Useful commands:"
echo "   Attach:    tmux attach -t $SESSION_NAME"
echo "   Detach:    Press Ctrl+b then d"
echo "   Kill:      tmux kill-session -t $SESSION_NAME"
echo "   Switch:    Ctrl+b then arrow keys"
echo ""
echo "🔗 Attaching to session..."
sleep 1
tmux attach -t "$SESSION_NAME"


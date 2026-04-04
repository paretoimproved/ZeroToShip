#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Claude Code Remote Dev Server Setup — Debian (Beelink Mini S12)
# Run as your normal user (not root). Uses sudo where needed.
# ============================================================

echo "=== 1/6 System update ==="
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git tmux build-essential

echo "=== 2/6 Install Node.js 22 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
echo "Node: $(node -v) | npm: $(npm -v)"

echo "=== 3/6 Install Claude Code ==="
sudo npm install -g @anthropic-ai/claude-code
echo "Claude Code: $(claude --version)"

echo "=== 4/6 Create project workspace ==="
mkdir -p ~/projects
echo "Workspace ready at ~/projects/"

echo "=== 5/6 Setup tmux config ==="
cat > ~/.tmux.conf << 'TMUX'
set -g mouse on
set -g history-limit 50000
set -g status-style 'bg=#333333 fg=#ffffff'
set -g status-right '#S'
set -g default-terminal "screen-256color"
TMUX

echo "=== 6/6 Create launcher script ==="
cat > ~/start-claude.sh << 'LAUNCHER'
#!/usr/bin/env bash
# Usage: ./start-claude.sh <project-name>
# Example: ./start-claude.sh ideaforge

PROJECT="${1:?Usage: ./start-claude.sh <project-name>}"
PROJECT_DIR="$HOME/projects/$PROJECT"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Directory $PROJECT_DIR not found."
  echo "Clone your repo first: git clone <repo-url> $PROJECT_DIR"
  exit 1
fi

SESSION="claude-$PROJECT"

# Kill existing session if running
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Start new tmux session with Claude Code
tmux new-session -d -s "$SESSION" -c "$PROJECT_DIR" \
  "claude --dangerously-skip-permissions"

echo "Started Claude Code for $PROJECT in tmux session: $SESSION"
echo "Attach with: tmux attach -t $SESSION"
LAUNCHER
chmod +x ~/start-claude.sh

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Set your Anthropic API key:"
echo "     export ANTHROPIC_API_KEY='your-key-here'"
echo "     (Add to ~/.bashrc to persist)"
echo ""
echo "  2. Clone your repos:"
echo "     cd ~/projects"
echo "     git clone git@github.com:YOUR_USER/IdeaForge.git ideaforge"
echo ""
echo "  3. Setup GitHub SSH key (if needed):"
echo "     ssh-keygen -t ed25519 -C 'beelink-dev'"
echo "     cat ~/.ssh/id_ed25519.pub"
echo "     (Add to GitHub → Settings → SSH Keys)"
echo ""
echo "  4. Start Claude Code for a project:"
echo "     ./start-claude.sh ideaforge"
echo ""
echo "  5. Configure Telegram bot:"
echo "     - Create a new bot via @BotFather on Telegram"
echo "     - Attach to the tmux session: tmux attach -t claude-ideaforge"
echo "     - Run: /telegram:configure"
echo "     - Then pair from Telegram by DMing the bot"
echo ""

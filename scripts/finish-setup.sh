#!/usr/bin/env bash
set -euo pipefail

echo "=== Fixing PiHole SSH key ==="
sudo -u claude ssh pve "pct exec 100 -- bash -c 'echo ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIByQIOFAsJ2xDPJ/n1cOiiZTv1DVuJMpiPEboRLnd+EG claude@claude-admin > /root/.ssh/authorized_keys'"
echo "PiHole key fixed"

echo "=== Testing PiHole SSH ==="
sudo -u claude ssh -o StrictHostKeyChecking=no pihole "echo pihole-connected" || echo "WARNING: PiHole SSH failed, check manually"

echo "=== Creating workspace ==="
sudo -u claude mkdir -p /home/claude/projects

echo "=== Setting up tmux config ==="
cat > /home/claude/.tmux.conf << 'TMXCONF'
set -g mouse on
set -g history-limit 50000
set -g status-style 'bg=#333333 fg=#ffffff'
set -g status-right '#S'
set -g default-terminal "screen-256color"
TMXCONF
chown claude:claude /home/claude/.tmux.conf

echo "=== Creating launcher script ==="
cat > /home/claude/start-claude.sh << 'LAUNCHER'
#!/usr/bin/env bash
PROJECT="${1:-admin}"
if [ "$PROJECT" = "admin" ]; then
  WORK_DIR="$HOME"
else
  WORK_DIR="$HOME/projects/$PROJECT"
  if [ ! -d "$WORK_DIR" ]; then
    echo "Directory $WORK_DIR not found."
    echo "Clone your repo first: git clone <repo-url> $WORK_DIR"
    exit 1
  fi
fi
SESSION="claude-$PROJECT"
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -c "$WORK_DIR" "claude --dangerously-skip-permissions"
echo "Started Claude Code ($PROJECT) in tmux session: $SESSION"
echo "Attach with: tmux attach -t $SESSION"
LAUNCHER
chmod +x /home/claude/start-claude.sh
chown claude:claude /home/claude/start-claude.sh

echo "=== Creating CLAUDE.md ==="
cat > /home/claude/CLAUDE.md << 'CLAUDEMD'
# Homelab Admin Assistant

You are running on a Proxmox LXC container (CT 104) on a Beelink Mini S12 (Intel N95).

## Infrastructure

| Host     | SSH alias | Type   | Purpose              |
|----------|-----------|--------|----------------------|
| pve      | pve       | Host   | Proxmox hypervisor   |
| CT 100   | pihole    | LXC    | PiHole DNS           |
| CT 104   | localhost | LXC    | This container       |
| VM 101   | haos      | QEMU   | Home Assistant OS    |

## SSH Access
- Use `ssh pve` to access the Proxmox host (run pct/qm commands here)
- Use `ssh pihole` to manage PiHole
- Use `ssh haos` to manage Home Assistant (if SSH addon installed)

## Proxmox Commands (run via ssh pve)
- `pct list` — list LXC containers
- `pct start/stop <id>` — manage containers
- `qm list` — list VMs
- `qm start/stop <id>` — manage VMs

## PiHole Commands (run via ssh pihole)
- `pihole status` — check status
- `pihole -g` — update gravity (blocklists)
- `pihole -t` — tail the log

## Coding Projects
Projects live in ~/projects/. Start Claude Code for a project:
  ./start-claude.sh <project-name>

## Constraints
- Never reboot the Proxmox host without explicit confirmation
- Never delete LXC containers or VMs without confirmation
- Never modify PiHole DNS settings without confirmation
- Always check current state before making changes
CLAUDEMD
chown claude:claude /home/claude/CLAUDE.md

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Remaining manual steps:"
echo ""
echo "1. Switch to claude user:"
echo "   su - claude"
echo ""
echo "2. Start Claude Code in admin mode:"
echo "   ./start-claude.sh"
echo ""
echo "3. Attach to the session:"
echo "   tmux attach -t claude-admin"
echo ""
echo "4. Inside Claude Code, configure Telegram:"
echo "   /telegram:configure"
echo "   (paste your bot token from @BotFather)"
echo ""

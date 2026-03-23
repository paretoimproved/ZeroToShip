#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Claude Code Admin Container Setup — Proxmox LXC (Debian 12)
#
# This script runs INSIDE the LXC container after creation.
# It sets up Claude Code with SSH access to other containers
# and the Proxmox host for full homelab administration.
#
# Prerequisites (done in Proxmox UI):
#   1. Create CT 104 (claude-admin), Debian 12, 32GB disk,
#      2 cores, 2048MB RAM, DHCP networking
#   2. Start the container and open its console
#   3. Run this script as root
# ============================================================

echo "=== 1/8 System update ==="
apt update && apt upgrade -y
apt install -y curl git tmux build-essential openssh-client sudo

echo "=== 2/8 Create non-root user ==="
if id "claude" &>/dev/null; then
  echo "User 'claude' already exists, skipping..."
else
  useradd -m -s /bin/bash claude
  echo "claude ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/claude
  echo "Created user 'claude' with passwordless sudo"
fi

echo "=== 3/8 Install Node.js 22 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
echo "Node: $(node -v) | npm: $(npm -v)"

echo "=== 4/8 Install Claude Code ==="
npm install -g @anthropic-ai/claude-code
echo "Claude Code installed"

echo "=== 5/8 Setup SSH keys for admin access ==="
sudo -u claude mkdir -p /home/claude/.ssh
sudo -u claude ssh-keygen -t ed25519 -f /home/claude/.ssh/id_ed25519 -N "" -C "claude-admin-ct104"
echo ""
echo "=========================================="
echo "  PUBLIC KEY (copy this — you'll need it)"
echo "=========================================="
cat /home/claude/.ssh/id_ed25519.pub
echo "=========================================="
echo ""

echo "=== 6/8 Create workspace and config ==="
sudo -u claude mkdir -p /home/claude/projects
sudo -u claude mkdir -p /home/claude/.claude

# SSH config for easy access to other hosts
sudo -u claude tee /home/claude/.ssh/config > /dev/null << 'SSHCONFIG'
# Proxmox host
Host pve
  HostName 192.168.1.233
  User root
  IdentityFile ~/.ssh/id_ed25519

# PiHole (LXC 100)
Host pihole
  HostName PIHOLE_IP
  User root
  IdentityFile ~/.ssh/id_ed25519

# Home Assistant OS (QEMU 101) — uses port 22222 by default
Host haos
  HostName HAOS_IP
  User root
  Port 22222
  IdentityFile ~/.ssh/id_ed25519
SSHCONFIG
chmod 600 /home/claude/.ssh/config
chown claude:claude /home/claude/.ssh/config

echo "=== 7/8 Setup tmux config ==="
sudo -u claude tee /home/claude/.tmux.conf > /dev/null << 'TMUX'
set -g mouse on
set -g history-limit 50000
set -g status-style 'bg=#333333 fg=#ffffff'
set -g status-right '#S'
set -g default-terminal "screen-256color"
TMUX

echo "=== 8/8 Create launcher script ==="
sudo -u claude tee /home/claude/start-claude.sh > /dev/null << 'LAUNCHER'
#!/usr/bin/env bash
# Usage: ./start-claude.sh [project-name]
# No args = start in home dir (admin mode)
# With arg = start in ~/projects/<name>

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

# Kill existing session if running
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Start new tmux session with Claude Code
tmux new-session -d -s "$SESSION" -c "$WORK_DIR" \
  "claude --dangerously-skip-permissions"

echo "Started Claude Code ($PROJECT) in tmux session: $SESSION"
echo "Attach with: tmux attach -t $SESSION"
LAUNCHER
chmod +x /home/claude/start-claude.sh

# Create a CLAUDE.md in home dir for admin context
sudo -u claude tee /home/claude/CLAUDE.md > /dev/null << 'CLAUDEMD'
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

echo ""
echo "============================================"
echo "  Container setup complete!"
echo "============================================"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. UPDATE SSH CONFIG with correct IPs:"
echo "   Edit /home/claude/.ssh/config"
echo "   Replace PIHOLE_IP and HAOS_IP with actual IPs"
echo "   (Proxmox host IP is set to 192.168.1.233)"
echo ""
echo "2. DISTRIBUTE THE SSH KEY to each host:"
echo ""
echo "   On the Proxmox host (from this container):"
echo "     su - claude"
echo "     ssh-copy-id pve"
echo ""
echo "   On PiHole (from Proxmox host console):"
echo "     pct exec 100 -- mkdir -p /root/.ssh"
echo "     Copy the public key above into /root/.ssh/authorized_keys on CT 100"
echo ""
echo "   For Home Assistant: install the SSH addon from the HA UI first"
echo ""
echo "3. SET ANTHROPIC API KEY:"
echo "   su - claude"
echo "   echo 'export ANTHROPIC_API_KEY=your-key' >> ~/.bashrc"
echo "   source ~/.bashrc"
echo ""
echo "4. SETUP GITHUB (for coding projects):"
echo "   su - claude"
echo "   cat ~/.ssh/id_ed25519.pub"
echo "   (Add to GitHub → Settings → SSH Keys)"
echo ""
echo "5. START CLAUDE CODE:"
echo "   su - claude"
echo "   ./start-claude.sh          # admin mode"
echo "   ./start-claude.sh ideaforge # project mode"
echo ""
echo "6. CONFIGURE TELEGRAM BOT:"
echo "   Create a new bot via @BotFather"
echo "   Attach to tmux: tmux attach -t claude-admin"
echo "   Run: /telegram:configure"
echo ""

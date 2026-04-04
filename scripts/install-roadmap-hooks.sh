#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

chmod +x "${REPO_ROOT}/.githooks/pre-commit"
git config core.hooksPath .githooks

echo "Installed git hooks for roadmap workflow enforcement."
echo "Active hooks path: $(git config --get core.hooksPath)"

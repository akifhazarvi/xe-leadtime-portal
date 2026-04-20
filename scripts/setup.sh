#!/bin/bash
# Xe Analytics Intelligence — Setup Script
# This script ensures the required sibling repos are available and the environment is ready.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PARENT_DIR="$(dirname "$PROJECT_DIR")"

echo "=== Xe Analytics Intelligence Setup ==="
echo ""

# Check for sibling repos
GALILEO_DIR="$PARENT_DIR/galileo-site"
APOLLO_DIR="$PARENT_DIR/xe-apollo"

check_repo() {
  local dir=$1
  local name=$2
  local clone_url=$3

  if [ -d "$dir" ]; then
    echo "[OK] $name found at $dir"
  else
    echo "[MISSING] $name not found at $dir"
    if [ -n "$clone_url" ]; then
      read -p "Clone $name? (y/n): " answer
      if [ "$answer" = "y" ]; then
        echo "Cloning $name..."
        git clone "$clone_url" "$dir"
        echo "[OK] $name cloned"
      else
        echo "[SKIP] $name not cloned — some features will be limited"
      fi
    else
      echo "[INFO] Please clone $name to $dir for full code cross-referencing"
    fi
  fi
}

echo "Checking sibling repositories..."
echo ""
check_repo "$GALILEO_DIR" "galileo-site" ""
check_repo "$APOLLO_DIR" "xe-apollo" ""
echo ""

# Check for required tools
echo "Checking tools..."

if command -v gh &> /dev/null; then
  echo "[OK] GitHub CLI (gh) found"
else
  echo "[INFO] GitHub CLI (gh) not found — install with 'brew install gh' for GitHub issue filing"
fi

echo ""

# Validate config
echo "Checking configuration..."
if [ -f "$PROJECT_DIR/config/amplitude.json" ]; then
  echo "[OK] Amplitude config found"
else
  echo "[ERROR] config/amplitude.json missing"
  exit 1
fi

if [ -f "$PROJECT_DIR/config/funnels.json" ]; then
  echo "[OK] Funnels config found"
else
  echo "[ERROR] config/funnels.json missing"
  exit 1
fi

if [ -f "$PROJECT_DIR/config/kpis.json" ]; then
  echo "[OK] KPIs config found"
else
  echo "[ERROR] config/kpis.json missing"
  exit 1
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Available skills:"
echo "  /analyze-funnel  — Deep funnel analysis with code cross-referencing"
echo "  /analyze-kpi     — KPI trend analysis with anomaly detection"
echo "  /audit-events    — Compare code events vs Amplitude events"
echo "  /find-issues     — Scan for problems across all metrics"
echo "  /growth-opportunities — Identify conversion optimization opportunities"
echo "  /health-check    — Weekly executive health report"
echo ""
echo "Quick start: Open this directory in Claude Code and run /health-check"

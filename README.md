# Xe Analytics Intelligence

AI-powered analytics investigation platform for Xe's money transfer products. Connects Amplitude data with source code to automatically find problems, diagnose issues, and identify growth opportunities.

## What It Does

- **Funnel Analysis** — Deep dive into conversion funnels with code cross-referencing
- **KPI Monitoring** — Trend analysis with automatic anomaly detection
- **Event Auditing** — Compare tracked events in code vs what's firing in Amplitude
- **Issue Detection** — Scan for error spikes, conversion drops, and broken tracking
- **Growth Opportunities** — Find highest-impact conversion improvements
- **Health Checks** — Weekly executive reports covering all metrics

## Setup

### Prerequisites

1. **Claude Code** with Amplitude MCP integration connected
2. Access to the Xe Amplitude org (Ria)
3. Sibling repos (optional but recommended for code cross-referencing):
   - `galileo-site` — Xe web app
   - `xe-apollo` — Xe mobile app

### Quick Start

```bash
# Clone this repo alongside galileo-site and xe-apollo
cd /path/to/your/projects/
git clone <this-repo-url> xe-analytics-intelligence

# Run setup
cd xe-analytics-intelligence
./scripts/setup.sh

# Open in Claude Code and start analyzing
# /health-check
```

### Directory Structure

```
xe-analytics-intelligence/
├── CLAUDE.md                    # Master instructions for Claude
├── .claude/skills/              # 6 analysis skills
│   ├── analyze-funnel.md        # Deep funnel analysis
│   ├── analyze-kpi.md           # KPI trend analysis
│   ├── audit-events.md          # Event tracking audit
│   ├── find-issues.md           # Anomaly & issue detection
│   ├── growth-opportunities.md  # Growth analysis
│   └── health-check.md          # Weekly health report
├── config/                      # Configuration
│   ├── amplitude.json           # Amplitude projects, dashboards, charts
│   ├── funnels.json             # Funnel definitions & thresholds
│   └── kpis.json                # KPI definitions & alert thresholds
├── knowledge/                   # Reference documentation
│   ├── architecture.md          # How analytics tracking works
│   ├── event-catalog.md         # All events with code locations
│   ├── funnel-definitions.md    # Funnel details & expected rates
│   ├── kpi-definitions.md       # KPI details & monitoring
│   └── platform-mapping.md      # Event-to-platform-to-code mapping
└── scripts/
    ├── setup.sh                 # One-command setup
    └── sync-events.sh           # Regenerate event registry from code
```

## Available Skills

| Command | Description | Example Use |
|---------|-------------|------------|
| `/health-check` | Weekly executive health report | "Give me a status update" |
| `/analyze-funnel send-money` | Deep funnel analysis | "Why did conversion drop?" |
| `/analyze-kpi transactions` | KPI trend analysis | "How are transactions trending?" |
| `/audit-events` | Event tracking audit | "Are all events firing?" |
| `/find-issues` | Anomaly & issue detection | "What's broken?" |
| `/growth-opportunities` | Growth opportunity analysis | "Where can we improve?" |

## Amplitude Projects

| Project | ID | Purpose |
|---------|-----|---------|
| Xe [Prod] Web & App | 295336 | Primary — all web + app events |
| Xe [Prod] App | 295341 | App-specific events |
| XE[Staging] App & Web | 313612 | Staging environment |

## Supported Platforms

- Web (desktop) — galileo-site
- Mobile Web — galileo-site
- iOS — xe-apollo
- Android — xe-apollo

## Issue Filing

When analysis finds problems, you can file issues directly:
- **GitHub** — Creates issues via `gh` CLI with labels and code references
- **Jira** — Generates formatted descriptions or creates via API

## Updating

After code changes to galileo-site or xe-apollo:
```bash
./scripts/sync-events.sh  # Regenerate event registry
```

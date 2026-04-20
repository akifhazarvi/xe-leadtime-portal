# Research: Amplitude MCP Marketplace Skills

Source: https://github.com/amplitude/mcp-marketplace

## Available Skills (11)
1. analyze-account-health — B2B account health for QBRs, renewal risk, expansion
2. analyze-chart — Chart data analysis
3. analyze-dashboard — Dashboard review and analysis
4. analyze-experiment — Experiment results and statistical significance
5. analyze-feedback — User feedback synthesis
6. create-chart — Chart generation
7. create-dashboard — Dashboard building
8. daily-brief — Daily analytics summaries
9. discover-opportunities — Product opportunities with RICE scoring
10. monitor-experiments — Ongoing experiment tracking
11. weekly-brief — Weekly trend summaries

## Key Design Patterns (from discover-opportunities and daily-brief)

### Multi-Phase Workflow
- Phase 1: Understand context (get_context, get_project_context, parallel searches)
- Phase 2: Gather evidence (parallel queries — dashboards, funnels, experiments, feedback, session replays, deployments)
- Phase 3: Synthesize findings (structured opportunity format with RICE scoring)
- Phase 4: Validate and filter (check for false positives, seasonality, already-shipped fixes)
- Phase 5: Deliver as narrative memo (not tables/dashboards)

### Parallel Discovery Pattern
Always run TWO parallel searches first:
- Search A: Official content, sorted by viewCount (what org values)
- Search B: Recent activity, sorted by lastModified (what's being worked on)
- Content in BOTH = highest priority

### Evidence Requirements
- Multi-source evidence required: analytics + feedback, funnel + replays, etc.
- Single-source signals labeled "emerging" not full opportunities
- Confidence scoring: 100% (multi-source), 80% (corroborating), 50% (single source), 20% (anecdotal)

### RICE Scoring
- Reach: Users/events affected per quarter (absolute count)
- Impact: 0.25 (minimal) to 3 (massive) per user
- Confidence: 0-100%
- Effort: Person-months (adjusted for AI/agent assistance)
- Quality gate: RICE >= 100 for full opportunities

### Output Format
- Narrative memo, NOT database records
- 800-1200 words for main opportunities
- "Numbers are evidence, not the story. Lead with the insight."
- Approximate: "~42%" not "42.37%"
- Active voice only
- Always state time anchor
- Link every chart/dashboard/experiment inline
- End with follow-on question

### Persona Calibration (from daily-brief)
- Executives: strategic outcomes, revenue, competitive position
- PMs: feature-oriented, conversion, adoption
- Analysts: methodological rigor
- Growth: channel focus
- Engineers: technical signals (errors, latency, crashes)

### Validation Checklist
1. Partial-data artifacts (incomplete periods)
2. Day-of-week / seasonality effects
3. Already-shipped fixes (check deployments)
4. Correlation vs causation
5. "So what" filter — must lead to concrete action

### Account Health Scoring
- Healthy: Growing MAU, DAU/MAU >40%, positive WoW
- At-Risk: Flat/declining MAU, DAU/MAU 20-40%, negative WoW
- Critical: Steep decline, DAU/MAU <20%, sustained negative WoW

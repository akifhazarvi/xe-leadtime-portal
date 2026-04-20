# Xe Analytics Intelligence

## What This Is

AI-powered analytics investigation platform for Xe's money transfer products. Connects **Amplitude** (via MCP) with **source code** in galileo-site and xe-apollo to do analysis humans can't practically do — comparing every funnel step across 4 platforms, correlating errors with conversion drops, tracing metrics to exact code lines.

## Prerequisites

- **Amplitude MCP** connected (Claude.ai Amplitude integration)
- **Source repos**: `galileo-site` and `xe-apollo` as sibling directories (run `scripts/setup.sh` if not)
- Default project: **Xe [Prod] Web & App** (ID: 295336)

## Skills (16 total)

### Platform War Room
| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `/platform-compare` | Every funnel × 4 platforms matrix. Finds exact divergence points. | "platform comparison", "which platform is worse" |
| `/platform-drift` | This week vs 4 weeks ago per platform. Finds regressions. | "platform regression", "is iOS getting worse" |
| `/ios-vs-android` | Head-to-head across every metric: txns, errors, retention, features. | "iOS vs Android", "app comparison" |
| `/web-vs-mobile-web` | Same code, different UX. Finds where mobile web breaks. | "web vs mobile", "mobile web problems" |

### Deep Funnel Surgery
| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `/funnel-xray [name]` | 360° funnel analysis: platform, country, payment method, time-to-complete, errors between steps, code paths. | "funnel deep dive", "why is send-money dropping" |
| `/funnel-compare [a] [b]` | Side-by-side funnel comparison (e.g., card vs bank). | "compare funnels", "card vs bank" |
| `/conversion-matrix` | Every funnel × platform × region ranked. Finds worst combinations. | "worst conversion", "weakest link" |

### Error Forensics
| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `/error-forensics` | Traces each error to code, analyzes by platform/country/payment method. | "error analysis", "why are payments failing" |
| `/error-correlation` | Correlates error volumes with funnel conversion rates. Finds causal links. | "do errors affect conversion", "error impact" |

### Tracking Quality
| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `/tracking-gaps` | Code events vs Amplitude events. Finds dead, orphaned, and broken tracking. | "tracking audit", "missing events" |
| `/event-quality [name]` | Single event deep dive: volume, platforms, properties, code locations. | "check event [name]", "is [event] working" |

### Growth Intelligence
| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `/corridor-analysis` | Money transfer corridors: volume, growth, conversion, errors per route. | "corridor analysis", "which routes" |
| `/retention-deep-dive` | Retention curves by platform, country, registration method. Finds aha moments. | "retention analysis", "churn" |
| `/feature-adoption` | Adoption of every feature across platforms. | "feature adoption", "underused features" |

### Diagnostics
| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `/diagnose [metric]` | Auto-diagnostic tree: platform → country → errors → upstream → code changes. | "why did X drop", "root cause" |
| `/health-check` | Weekly executive briefing. Meta-skill that surfaces top issues and recommends deep skills. | "health check", "weekly review" |

## Research-First Methodology

**CRITICAL: Code is the source of truth. Amplitude is validation.**

Before building ANY funnel, dashboard, or analysis:

### Step 1: Deep code research
- Read the ACTUAL source code in both `galileo-site` and `xe-apollo` to find every event in the user journey
- Follow the code flow, not the event list — trace from router entry to completion
- For each event: find file:line, full traits object, what triggers it, whether it's conditional
- Understand the user experience: new user vs existing, anonymous vs logged in, different payment types

### Step 2: Validate against Amplitude
- Query each code-discovered event in Amplitude grouped by platform to verify it actually fires
- Check volumes — events with 0 volume on a platform are either dead code or wrong event names
- Events found ONLY in Amplitude (not in code) are backend/server-side events — list them separately
- Events found ONLY in code (not in Amplitude) are dead code or bugs — flag them

### Step 3: Build understanding
- Map the complete journey including ALL micro-interactions, errors, conditional paths
- Separate new user journey (needs recipient creation, KYC, card addition) from existing user journey
- Document platform differences (mobile has anonymous quotes, web requires login)
- Note which events are payment-type-specific (card auth only for cards, Plaid only for bank, etc.)

### Step 4: Update knowledge base
When mistakes are found, immediately update:
- `knowledge/` docs with corrections
- `config/funnels.json` with correct event sequences
- `.claude/skills/` with corrected query patterns
- This `CLAUDE.md` with new learnings

### Known pitfalls (learned from experience)
- **Quote Calculated ≠ Quote Created**: "Quote Calculated" is a low-volume public site calculator event (~1.8k/week, web-only). "Quote Created" is the real funnel step (96k/week, all platforms).
- **Platform groupBy**: Use `{"type": "user", "value": "platform"}` NOT `{"type": "event", "value": "platform"}` in Amplitude queries.
- **Mobile anonymous quotes**: iOS/Android let users browse quotes without logging in. Don't compare raw top-of-funnel numbers across platforms.
- **Transaction Created vs Client Side**: "Transaction Created" is server-side (all platforms). "Transaction Created - Client Side" is app-only.
- **Login Failed casing**: Web fires "Login Failed", mobile fires "Login failed" — these are TWO SEPARATE EVENTS in Amplitude.
- **Send money journey is 100+ events**, not 6. The main funnel is the happy path — the full journey includes recipient creation, KYC, EDD, payment method addition, error recovery, and more.
- **Convert Balance ≠ outflow**: Convert Balance is internal currency exchange (USD→CAD) — money stays in the system. Only Send via Balance (Transfer + paymentMethod=balance) removes money. Never subtract converts from remaining balance.
- **Dashboard data updates — never mix old/new queries**: When refreshing data, Amplitude can return different values for the same week across queries (late events, reprocessing). Always recalculate totals, cumulative, and utilization programmatically from weekly arrays — never hand-compute or adjust old totals. Verify with: `sum(weekly) == total` and `cumulative[last] == remaining`.
- **Balance sends require 3 filters**: "Send money via balance" = `paymentMethod="balance"` + `transactionType="Transfer"` + `accountType IN ("Private","(none)")`. Without `transactionType="Transfer"`, you include Fund Balance and Convert Balance operations. Without `(none)` in accountType, you miss some consumer records. The `transactionType` property distinguishes Transfer (real send) from other balance operations.
- **Consumer accountType values**: Consumer = `accountType IN ("Private", "(none)")`, NOT just "Private" or "personal". Corporate = "Corporate". Always include "(none)" when filtering for consumer data — many consumer records have no accountType set.

## Skill Design Philosophy

Skills follow the **Amplitude MCP marketplace pattern** (multi-phase workflows):
1. **Bootstrap** — read config, parallel Amplitude discovery searches
2. **Gather** — parallel queries, batch chart fetches, cross-reference code
3. **Synthesize** — structured findings with confidence scoring
4. **Validate** — check false positives, partial data, seasonality
5. **Deliver** — narrative memo format with code references and follow-on question

**Our unique advantage over Amplitude's own skills:** code cross-referencing. We trace metrics to file:line, correlate git changes with dips, and compare tracking across codebases.

## Configuration

- `config/amplitude.json` — Projects, dashboards, charts
- `config/funnels.json` — 8 funnel definitions with steps, thresholds, chart IDs
- `config/kpis.json` — 8 KPIs with alert thresholds + 7 error events

## Knowledge Base

- `knowledge/event-catalog.md` — All events with code constants, source files, platforms
- `knowledge/funnel-definitions.md` — Funnel details with Amplitude query examples
- `knowledge/kpi-definitions.md` — KPI details with monitoring thresholds
- `knowledge/architecture.md` — Data pipeline (Segment → Amplitude) + code structure
- `knowledge/platform-mapping.md` — Event-to-platform-to-code mapping
- `knowledge/tracking-pipeline.md` — Deep mechanics: how track()/identify()/page() work, consent gating, auto-injected properties, multi-provider architecture, session linking
- `knowledge/event-properties.md` — Property schemas for every event category: what data is sent, types, sources. Includes the 84-property quote pricing matrix.
- `knowledge/tracking-issues.md` — All known bugs, dead code, TODOs, naming mismatches, data quality issues with file:line references

## Research

- `knowledge/research/amplitude-mcp-marketplace-skills.md` — Amplitude's official skill patterns
- `knowledge/research/skill-best-practices.md` — Anthropic + community best practices

## Code References

### galileo-site (Web + Mobile Web)
- Event constants: `src/constants/segmentAnalytics.ts` — `SEGMENT_EVENTS` (236 events)
- Analytics store: `src/stores/analytics.ts` — `track()`, `page()`, `identify()`
- Send Money: `src/views/SendMoney/` | Quick Transfer: `src/views/QuickTransfer.vue`
- Login: `src/views/Login.vue` | Recipients: `src/views/Recipients.vue`
- Corporate: `src/corporate/`

### xe-apollo (iOS + Android)
- Event enum: `src/model/types/analytics.const.ts` — `AnalyticsEventType` (470+ events)
- Analytics providers: `src/providers/analytics/` — segment, firebase, appsflyer, tealium
- Send flow: `src/providers/send-flow/send-flow.ts`
- Payment: `src/providers/payment/payment.ts`

## Analysis Playbooks

### Something dropped
1. `/diagnose [metric]` — confirms anomaly, breaks down by platform/country, checks errors and code
2. If platform-specific: `/platform-drift` or `/ios-vs-android` / `/web-vs-mobile-web`
3. If funnel-related: `/funnel-xray [name]`
4. If error-related: `/error-forensics`

### Weekly review
1. `/health-check` — executive summary with recommended next skills
2. Follow the recommended deep skills for any flagged issues

### Quarterly planning
1. `/conversion-matrix` — find worst-performing combinations
2. `/corridor-analysis` — find best growth corridors
3. `/retention-deep-dive` — find retention improvement opportunities
4. `/feature-adoption` — find underused features to invest in

### Tracking quality
1. `/tracking-gaps` — systematic code vs Amplitude comparison
2. `/event-quality [event]` — deep dive on suspicious events

## Event Documentation Portal

`portal/` — standalone web app for looking up any analytics event. Searchable, filterable, with deep documentation per event.

- **Run locally**: `cd portal && python3 -m http.server 8765` → http://localhost:8765
- **Regenerate data**: `node portal/scripts/generate-events.js` (scans both codebases)
- **Add intelligence**: edit `portal/manual-annotations.json` then regenerate
- **454 events** documented with code locations, properties, platform coverage, sample payloads, funnel context, and business intelligence

## Filing Issues

Skills offer to file findings as issues:
- **GitHub**: Via `gh` CLI with title, description, labels, code references
- **Jira**: Generates formatted description or creates via API

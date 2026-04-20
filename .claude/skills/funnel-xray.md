---
name: funnel-xray
description: >
  360-degree analysis of a single funnel. Segments by platform, country, payment method, and account type simultaneously. Measures time-to-complete, finds error events between steps, traces each step's code path, and shows weekly trends per step. Use when user asks "analyze funnel", "funnel deep dive", "why is [funnel] dropping", or specifies a funnel name like "send-money", "registration", "card-payment", "bank-transfer", "login", "biometric", "plaid", "recipient".
user-invocable: true
---

# Funnel X-Ray

You are performing a 360° analysis of a single funnel that would take a human analyst hours of manual chart building. You query every dimension simultaneously and cross-reference with source code.

## Phase 1: Identify and Load

1. Parse the funnel name from user input. Map to config:
   - send-money, registration, card-payment, bank-transfer, login, biometric, plaid, recipient
2. Read `config/funnels.json` for step definitions, expected conversion, chart IDs.
3. If a chart ID exists, note it for comparison.

## Phase 2: Gather Data (8-12 queries)

Run in parallel where possible:

### 2a. Overall Funnel
Query with `query_dataset` (type: funnels) for last 30 days:
```json
{
  "name": "[Funnel] - Overall",
  "type": "funnels",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [{"event_type": "[step1]", "filters": [], "group_by": []}, ...],
    "countGroup": "User",
    "segments": [{"conditions": []}]
  }
}
```

### 2b. Platform Breakdown
Same funnel query with:
```json
"groupBy": [{"type": "user", "value": "platform"}]
```

### 2c. Country Breakdown
Same funnel with:
```json
"groupBy": [{"type": "user", "value": "country", "group_type": "User"}]
```
Use `groupByLimit: 10` for top 10 countries.

### 2d. Payment Method Breakdown (for payment funnels only)
If this is send-money, card-payment, or bank-transfer:
```json
"groupBy": [{"type": "event", "value": "gp:paymentMethod", "group_type": "Event"}]
```

### 2e. Error Events Between Steps
Query error events for the same 30-day period:
```json
{
  "type": "eventsSegmentation",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [
      {"event_type": "Something Went Wrong", "filters": [], "group_by": []},
      {"event_type": "Quote Error", "filters": [], "group_by": []},
      {"event_type": "Payment Failed", "filters": [], "group_by": []}
    ],
    "metric": "totals", "countGroup": "Event", "interval": 7
  }
}
```

### 2f. Weekly Trend
Query the funnel for last 8 weeks with weekly intervals to see trend per step.

### 2g. Code Analysis
For each funnel step:
1. Look up the code constant in `knowledge/event-catalog.md`
2. Search the relevant codebase for where it's fired:
   - `grep -r "SEGMENT_EVENTS.[CONSTANT]" ../galileo-site/src/`
   - `grep -r "AnalyticsEventType.[Constant]" ../xe-apollo/src/`
3. Read the surrounding code to understand conditions, validations, error handling

## Phase 3: Synthesize

For each step transition (Step N → Step N+1):
1. **Conversion rate** overall and per platform/country
2. **Absolute drop-off** — how many users lost at this step
3. **Platform gap** — is one platform significantly worse?
4. **Country gap** — any regional issues?
5. **Error correlation** — do errors spike at this step?
6. **Code complexity** — what conditions/validations exist?
7. **Trend** — getting better or worse over 8 weeks?

Rank all step transitions by **absolute user impact** (users lost × conversion delta).

## Phase 4: Validate

1. Check if the current period includes partial weeks
2. Compare to expected conversion from `config/funnels.json`
3. Verify code references point to actual files

## Phase 5: Deliver

Write as a narrative memo (800-1200 words):

1. **Headline** — The single most impactful finding (e.g., "Mobile web users drop off 3x more at payment selection than desktop")

2. **Funnel overview** — Overall conversion, trend direction, comparison to expected rate

3. **Step-by-step findings** — For the top 3 problem steps, write a narrative paragraph each:
   - What's happening (numbers, conversion, drop-off)
   - Platform differences at this step
   - Country/regional patterns
   - Error events at this step
   - Code analysis (what the code does, what could cause the drop)
   - Specific recommendation

4. **Platform comparison table** — Quick reference of conversion per platform

5. **Code references** — File paths for each step's tracking code

6. **Follow-on**: "Want me to run `/error-forensics` on the [error] spike, `/platform-drift` to check if [platform] regression is recent, or `/funnel-compare` to compare this with [alternative funnel]?"

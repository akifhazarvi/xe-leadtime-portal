---
name: error-forensics
description: >
  Deep error investigation that goes beyond counting. For each error event, traces it to its exact code source, analyzes patterns by platform, country, currency pair, and payment method. Correlates with funnel drop-offs and recent code changes. Use when user asks "error analysis", "why are payments failing", "investigate errors", "what's breaking", or mentions a specific error like "Quote Error" or "Payment Failed".
user-invocable: true
---

# Error Forensics

You don't just count errors — you trace them. For each error event, you find the code that fires it, analyze the patterns, and connect errors to their impact on conversion.

## Phase 1: Scope

1. Read `config/kpis.json` → `error_events` for the 7 monitored errors:
   - Something Went Wrong (HIGH), Quote Error (HIGH), Payment Failed (CRITICAL)
   - Card Authorisation Failed (HIGH), Login Failed (MEDIUM)
   - Open Banking Payment Failed (HIGH), Transaction Failed (CRITICAL)
2. If user specified a particular error, focus on that one. Otherwise, analyze all 7.

## Phase 2: Gather Data (10-14 queries)

### 2a. Daily Trend (1 query)
Query all 7 errors for last 30 days, daily interval:
```json
{
  "name": "Error Trends - 30 Days",
  "type": "eventsSegmentation",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [
      {"event_type": "Something Went Wrong", "filters": [], "group_by": []},
      {"event_type": "Quote Error", "filters": [], "group_by": []},
      {"event_type": "Payment Failed", "filters": [], "group_by": []},
      {"event_type": "Card Authorisation Failed", "filters": [], "group_by": []},
      {"event_type": "Login Failed", "filters": [], "group_by": []},
      {"event_type": "Open Banking Payment Failed", "filters": [], "group_by": []},
      {"event_type": "Transaction Failed", "filters": [], "group_by": []}
    ],
    "metric": "totals",
    "countGroup": "Event",
    "interval": 1,
    "segments": [{"conditions": []}]
  }
}
```

### 2b. Platform Breakdown (1-2 queries)
Same events grouped by platform:
```json
"groupBy": [{"type": "user", "value": "platform"}]
```

### 2c. Country Breakdown (1-2 queries)
Same events grouped by country (top 10).

### 2d. Error-Specific Properties (2-4 queries)
Use `get_event_properties` for the top 3 errors by volume to discover available properties. Then query grouped by the most relevant property:
- Quote Error: group by currency-related properties
- Payment Failed: group by payment method type
- Card Auth Failed: group by card-related properties
- Something Went Wrong: group by any error-type property

### 2e. Funnel Correlation (2-3 queries)
For the top 3 errors, query the related funnel's daily conversion for the same 30-day period:
- Quote Error ↔ Send Money funnel
- Card Auth Failed ↔ Card Payment funnel
- Payment Failed ↔ Send Money funnel
- Login Failed ↔ Login funnel

## Phase 3: Code Trace

For each error event:
1. Find the code constant in `knowledge/event-catalog.md`
2. Search the codebase for where it's fired:
   ```bash
   grep -rn "SEGMENT_EVENTS.SOMETHING_WENT_WRONG\|SomethingWentWrong" ../galileo-site/src/ ../xe-apollo/src/
   ```
3. Read the surrounding code:
   - What condition triggers the error?
   - What user action leads to it?
   - What error message does the user see?
   - Is there retry logic?
4. Check recent git changes:
   ```bash
   git -C ../galileo-site log --oneline --since="30 days ago" -- [error-file]
   ```

## Phase 4: Synthesize

For each error, assign:
- **Severity**: CRITICAL (revenue impact), HIGH (UX), MEDIUM (friction), LOW (cosmetic)
- **Trend**: Spiking, elevated, stable, declining
- **Platform concentration**: All platforms, or specific to one
- **Confidence**: How certain the root cause hypothesis is

## Phase 5: Deliver

Narrative report (800-1200 words):

1. **Headline** — The most dangerous error: "Quote Errors hit ~7K/day — 30% higher than last month and correlated with a 3% send money conversion drop"

2. **Error severity ranking** — Brief ranking of all 7 errors by impact

3. **Deep dive per error** (top 3-4) — Each as a narrative paragraph:
   - Volume and trend (with daily pattern)
   - Platform split (is it worse on one platform?)
   - What triggers it in the code (file:line, conditions)
   - Impact on conversion (correlation with funnel)
   - Recent code changes that might explain it
   - Recommended fix

4. **Code change timeline** — Recent commits that touched error-handling code

5. **Follow-on**: "Want me to `/error-correlation` to quantify the conversion impact, `/diagnose [metric]` for a specific drop, or file these as issues on GitHub/Jira?"

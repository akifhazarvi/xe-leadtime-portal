---
name: diagnose
description: >
  Automatic diagnostic engine for any metric drop or anomaly. Runs a systematic diagnostic tree: confirms the anomaly, breaks down by platform, country, errors, upstream/downstream funnels, and git history. Produces a diagnosis with confidence level. Use when user asks "diagnose [metric]", "why did X drop", "investigate [event]", "what happened to [KPI]", "root cause analysis", or "why".
user-invocable: true
---

# Automatic Diagnostic Engine

You run a systematic diagnostic tree for any metric anomaly — the kind of investigation that takes a human analyst half a day compressed into one skill.

## Phase 1: Identify and Confirm

1. **Parse the target** from user input. Match to:
   - A KPI from `config/kpis.json` (e.g., "transactions" → Transaction Created)
   - A funnel from `config/funnels.json` (e.g., "send money conversion")
   - A specific event name (e.g., "MT Profile Created")
   - A specific chart ID

2. **Confirm the anomaly** — Query the metric for last 30 days, daily:
   ```json
   {
     "type": "eventsSegmentation",
     "app": "295336",
     "params": {
       "range": "Last 30 Days",
       "events": [{"event_type": "[metric]", "filters": [], "group_by": []}],
       "metric": "uniques", "countGroup": "User", "interval": 1,
       "segments": [{"conditions": []}]
     }
   }
   ```
   Calculate trailing 7-day average vs previous 7-day average. If delta < -10%, anomaly is confirmed. If not anomalous, report "No significant anomaly detected for [metric] — within normal variance" and suggest what to investigate instead.

## Phase 2: Diagnostic Tree (run in parallel where possible)

### Branch A: Platform Breakdown
Same metric query grouped by platform. Check:
- Is the drop concentrated on ONE platform? → Platform-specific issue
- All platforms equally affected? → Systemic issue

### Branch B: Country Breakdown
Same metric grouped by country (top 10). Check:
- Is the drop concentrated in specific countries? → Regional issue
- Is it one major market driving the overall drop?

### Branch C: Error Correlation
Query the 7 error events for the same 30-day period:
- Did any error spike BEFORE or DURING the metric drop?
- Calculate which error has the strongest inverse correlation with the metric

### Branch D: Upstream Check
If the metric is a funnel step, query the preceding steps:
- Did upstream steps also drop? → Issue is earlier in the funnel
- Upstream stable but this step dropped? → Issue is specifically at this step

### Branch E: Downstream Impact
Query downstream metrics:
- What's the blast radius of this drop?
- How many other metrics are affected?

### Branch F: Code Changes
Check git history in both repos for the anomaly timeframe:
```bash
git -C ../galileo-site log --oneline --after="[drop_start_date]" --before="[current_date]" -- [relevant files]
git -C ../xe-apollo log --oneline --after="[drop_start_date]" --before="[current_date]" -- [relevant files]
```

## Phase 3: Synthesize Diagnosis

Combine all evidence into a diagnosis:

**Confidence levels:**
- **HIGH** (80-100%): Platform-specific drop + code change found in that period + error correlation confirmed. "We're confident the cause is [X]."
- **MEDIUM** (50-79%): Clear pattern identified but no single confirmatory signal. "The most likely cause is [X] based on [evidence]."
- **LOW** (20-49%): Anomaly confirmed but cause unclear. "The drop is real but the cause is ambiguous. Possible explanations: [X, Y, Z]."

**Diagnosis template:**
```
METRIC: [name]
STATUS: [ANOMALY CONFIRMED / NO ANOMALY]
DROP: [X%] over [timeframe]
CONCENTRATED ON: [platform / country / all]
ERROR CORRELATION: [error event] ([correlation strength])
UPSTREAM: [healthy / also affected]
DOWNSTREAM IMPACT: [list of affected metrics]
CODE CHANGES: [commits if found]
DIAGNOSIS: [narrative explanation]
CONFIDENCE: [HIGH / MEDIUM / LOW]
RECOMMENDED ACTION: [specific next step]
```

## Phase 4: Deliver

Narrative diagnosis (600-900 words):

1. **Headline** — "MT Profile Created dropped 67% between Jan 26 and Feb 9 — concentrated on both iOS and Android equally, suggesting a backend or tracking change, not a code regression"

2. **Anomaly confirmation** — Exact numbers, timeframe, magnitude

3. **What the diagnostic tree found:**
   - Platform result: [platform-specific or systemic]
   - Country result: [regional or global]
   - Error correlation: [which errors spiked]
   - Upstream/downstream: [funnel context]
   - Code changes: [relevant commits]

4. **Diagnosis** — The most likely explanation, with confidence level

5. **Alternative hypotheses** — If confidence is MEDIUM or LOW, list other possibilities

6. **Recommended actions** — What to investigate next or fix

7. **Follow-on**: Based on findings, suggest the most relevant next skill:
   - Platform issue → `/platform-drift`
   - Error-related → `/error-forensics`
   - Funnel-related → `/funnel-xray [name]`
   - Tracking issue → `/tracking-gaps` or `/event-quality [event]`

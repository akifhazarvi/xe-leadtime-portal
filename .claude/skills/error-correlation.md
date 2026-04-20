---
name: error-correlation
description: >
  Correlates error event volumes with funnel conversion rates over time. Finds which errors actually CAUSE conversion drops versus just coincide. Identifies lagging indicators where error spikes precede conversion drops by 1-2 days. Use when user asks "do errors affect conversion", "error impact", "correlation analysis", "which errors matter most", or "error vs conversion".
user-invocable: true
---

# Error-Conversion Correlation

You align error volumes with funnel conversion rates day-by-day to find causal relationships that no dashboard shows. When Quote Error spikes on Tuesday, does send money conversion actually drop on Tuesday or Wednesday?

## Phase 1: Setup

1. Read `config/kpis.json` for the 7 error events.
2. Read `config/funnels.json` for the 4 highest-impact funnels: send-money, registration, card-payment, login.
3. Define error-funnel pairs to test:
   - Quote Error ↔ Send Money conversion
   - Payment Failed ↔ Send Money conversion
   - Card Authorisation Failed ↔ Card Payment conversion
   - Login Failed ↔ Login conversion
   - Open Banking Payment Failed ↔ Bank Transfer conversion
   - Transaction Failed ↔ Send Money conversion
   - Something Went Wrong ↔ All funnels

## Phase 2: Gather Daily Data (8-10 queries)

### 2a. Error Volumes (1 query)
Query all 7 errors daily for last 30 days (same as error-forensics 2a).

### 2b. Funnel Daily Conversion (4 queries)
For each of the 4 funnels, query daily conversion. Use `query_dataset` with funnels type:
```json
{
  "type": "funnels",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [<funnel steps>],
    "countGroup": "User",
    "interval": 1,
    "segments": [{"conditions": []}]
  }
}
```

### 2c. Baseline Comparison (2-3 queries)
Query the same metrics for the PREVIOUS 30 days to establish baseline correlation strength.

## Phase 3: Correlation Analysis

For each error×funnel pair:

1. **Same-day correlation**: Align daily error volume with daily funnel conversion. When errors are high, is conversion low?

2. **Lagged correlation (1-day)**: Shift error data forward by 1 day. Does yesterday's error spike predict today's conversion drop?

3. **Threshold analysis**: Find the error volume threshold above which conversion drops. "When Quote Error exceeds ~5K/day, send money conversion drops ~3%"

4. **Direction check**: Verify the relationship makes logical sense from the code path. Does this error actually occur in this funnel's flow?

Assign correlation strength:
- **Strong (>0.7)**: Error clearly impacts conversion
- **Moderate (0.4-0.7)**: Error likely impacts conversion
- **Weak (<0.4)**: Coincidental or indirect

## Phase 4: Code Path Verification

For each strong correlation:
1. Trace the error event to its code location
2. Verify it fires within the funnel's code path
3. Explain the mechanism: "Quote Error fires in `sendMoney.ts:2644` during quote creation. Users who hit this error cannot proceed to Quote Confirmed, directly blocking the funnel."

## Phase 5: Deliver

Narrative report (600-900 words):

1. **Headline** — The strongest correlation: "Quote Error has a strong correlation with Send Money conversion — every 1,000 additional errors costs ~50 lost transactions"

2. **Correlation ranking** — All pairs ranked by strength:
   ```
   STRONG: Quote Error → Send Money (-0.82, same-day)
   STRONG: Card Auth Failed → Card Payment (-0.76, same-day)
   MODERATE: Payment Failed → Send Money (-0.55, 1-day lag)
   WEAK: Login Failed → Login (-0.31)
   ```

3. **Impact quantification** — For each strong correlation, quantify the impact: "Reducing Quote Error by 50% (~2,500/day) would recover an estimated ~125 transactions/day"

4. **Code mechanism** — How each error blocks conversion in the code

5. **Recommendations** — Prioritized by impact: fix the error with the strongest conversion correlation first

6. **Follow-on**: "Want me to `/error-forensics` for a deep dive on the highest-impact error, or `/diagnose` a specific metric drop?"

---
name: platform-drift
description: >
  Detects platform-specific regressions by comparing this week's conversion rates vs 4 weeks ago at every funnel step. Finds steps where one platform is getting worse while others remain stable. Checks git history for platform-specific code changes. Use when user asks "platform regression", "is iOS getting worse", "platform drift", "what changed on Android", or "platform-specific bug".
user-invocable: true
---

# Platform Drift Detection

You compare every funnel step across platforms over time to find regressions that only affect one platform — the clearest signal of a platform-specific bug or code change.

## Phase 1: Bootstrap

1. Read `config/funnels.json` for all funnel definitions.
2. Define two time windows: **this week** and **4 weeks ago** (same day-of-week alignment).

## Phase 2: Gather Data (8-10 queries)

### 2a. Current Week — All Funnels by Platform
For each of the top 4 funnels (send-money, registration, card-payment, login):
```json
{
  "type": "funnels",
  "app": "295336",
  "params": {
    "range": "Last 7 Days",
    "events": [<steps>],
    "countGroup": "User",
    "groupBy": [{"type": "user", "value": "platform"}],
    "segments": [{"conditions": []}]
  }
}
```

### 2b. 4 Weeks Ago — Same Funnels by Platform
Same queries but with explicit start/end dates for the week 4 weeks ago.

### 2c. OS/App Version Breakdown (for flagged platforms)
If a mobile platform (iOS/Android) shows drift, query grouped by app version:
```json
"groupBy": [{"type": "event", "value": "version", "group_type": "Event"}]
```

## Phase 3: Detect Drift

For each funnel step × platform:
1. Calculate **delta** = (this week conversion) - (4 weeks ago conversion)
2. **Flag drift** if:
   - One platform's delta < -5% AND other platforms' deltas are within ±2%
   - This indicates platform-specific regression, not a global change

Categorize:
- **Platform-specific regression**: One platform down, others stable
- **Platform-specific improvement**: One platform up, others stable
- **Global change**: All platforms moved similarly (not platform-specific)

## Phase 4: Code Investigation

For each flagged platform drift:

### If Web or Mobile Web drifted:
```bash
git -C ../galileo-site log --oneline --since="4 weeks ago" --until="1 week ago"
```
Look for changes to the affected funnel step's code.

### If iOS or Android drifted:
```bash
git -C ../xe-apollo log --oneline --since="4 weeks ago" --until="1 week ago"
```
Check for platform-specific code (Cordova plugins, native modules).

### If version-specific:
Identify the app version where drift starts. Check release notes.

## Phase 5: Deliver

Narrative (600-900 words):

1. **Headline** — "Android card payment success dropped 8% over 4 weeks while iOS held steady — a platform-specific regression"

2. **Drift summary** — How many platform-specific drifts detected across all funnels

3. **Detailed findings** — For each drift:
   - Which platform, which funnel step, magnitude
   - Other platforms' behavior at the same step (proving it's platform-specific)
   - If version-specific: which version introduced the regression
   - Git commits in the relevant repo during the drift period
   - Confidence level (HIGH if code change found, MEDIUM if pattern clear, LOW if unclear)

4. **Global changes** — Steps where all platforms moved together (for context)

5. **Follow-on**: "Want me to `/ios-vs-android` for a full mobile comparison, `/error-forensics` to check if errors explain the drift, or `/diagnose [metric]` for root cause?"

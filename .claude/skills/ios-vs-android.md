---
name: ios-vs-android
description: >
  Head-to-head iOS vs Android comparison across every metric: transactions, registration conversion, error rates, session length, retention, feature adoption, and app version distribution. Traces systematic differences to xe-apollo code paths. Use when user asks "iOS vs Android", "app comparison", "mobile platform comparison", "which app performs better", or "mobile metrics".
user-invocable: true
---

# iOS vs Android Deep Comparison

You run a comprehensive head-to-head comparison across EVERY metric dimension — transactions, funnels, errors, sessions, retention, and features — all from a single investigation.

## Phase 1: Bootstrap

1. Read `config/funnels.json`, `config/kpis.json`, `config/amplitude.json`.
2. Platform filters: iOS = `{"op": "is", "prop": "platform", "values": ["iOS"]}`, Android = `{"op": "is", "prop": "platform", "values": ["Android"]}`.

## Phase 2: Gather Data (10-14 queries)

### 2a. Transaction Volume (1 query)
Transaction Created, last 30 days, weekly, grouped by platform (iOS, Android):
```json
{
  "type": "eventsSegmentation",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [{"event_type": "Transaction Created", "filters": [], "group_by": [{"type": "user", "value": "platform"}]}],
    "metric": "uniques", "countGroup": "User", "interval": 7,
    "segments": [{"conditions": [{"op": "is", "prop": "platform", "type": "property", "values": ["iOS", "Android"], "prop_type": "user", "group_type": "User"}]}]
  }
}
```

### 2b. Core Funnels (3 queries)
Query send-money, registration, and card-payment funnels each grouped by platform (iOS, Android filter in segments).

### 2c. Error Events (1 query)
All 7 errors grouped by platform, last 30 days.

### 2d. Session Metrics (1 query)
Average session length by platform:
```json
{
  "type": "sessions",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "sessions": [{"filters": [], "group_by": []}],
    "countGroup": "User",
    "sessionType": "average",
    "segments": [
      {"name": "iOS", "conditions": [{"op": "is", "prop": "platform", "type": "property", "values": ["iOS"], "prop_type": "user", "group_type": "User"}]},
      {"name": "Android", "conditions": [{"op": "is", "prop": "platform", "type": "property", "values": ["Android"], "prop_type": "user", "group_type": "User"}]}
    ]
  }
}
```

### 2e. Retention (1 query)
```json
{
  "type": "retention",
  "app": "295336",
  "params": {
    "range": "Last 90 Days",
    "startEvent": {"event_type": "_new", "filters": [], "group_by": []},
    "retentionEvents": [{"event_type": "_active", "filters": [], "group_by": []}],
    "retentionMethod": "nday", "countGroup": "User", "interval": 7,
    "segments": [
      {"name": "iOS", "conditions": [{"op": "is", "prop": "platform", "type": "property", "values": ["iOS"], "prop_type": "user", "group_type": "User"}]},
      {"name": "Android", "conditions": [{"op": "is", "prop": "platform", "type": "property", "values": ["Android"], "prop_type": "user", "group_type": "User"}]}
    ]
  }
}
```

### 2f. Feature Adoption (2-3 queries)
Query key feature events grouped by platform:
- Rate Alert Created, Refer a Friend Code Shared, Quick Transfer Accessed
- Add Funds Accessed, eSim Setup Started, Widget Added

### 2g. App Version Distribution (1 query)
Active users grouped by `version` property, filtered to iOS and Android separately.

## Phase 3: Synthesize

Build comparison scorecard:

| Dimension | iOS | Android | Winner | Gap |
|-----------|-----|---------|--------|-----|
| Transactions/week | X | Y | | |
| Send Money conversion | X% | Y% | | |
| Registration conversion | X% | Y% | | |
| Card payment success | X% | Y% | | |
| Error rate (all) | X | Y | | |
| Avg session length | Xs | Ys | | |
| Day 7 retention | X% | Y% | | |
| Day 30 retention | X% | Y% | | |
| Feature adoption (avg) | X% | Y% | | |

Identify systematic patterns: Does one platform consistently win, or do they trade wins?

## Phase 4: Code Analysis

For the largest gap:
1. Check xe-apollo code for platform-specific branches (`if (platform === 'ios')`)
2. Check for iOS-only or Android-only features
3. Check for different native plugin behavior

## Phase 5: Deliver

Narrative (800-1000 words):

1. **Headline** — "iOS outperforms Android on conversion (+7%) and retention (+12%) — but Android drives 38% of total volume"

2. **Overall verdict** — Which platform is healthier and by what margin

3. **Dimension-by-dimension** — Narrative paragraphs for the 3-4 largest gaps, with numbers and code references

4. **Retention comparison** — D1, D7, D30 for each platform

5. **Feature adoption comparison** — Which features are used more on which platform

6. **Recommendations** — What to fix on the weaker platform

7. **Follow-on**: "Want me to `/platform-drift` to check if this gap is widening, `/funnel-xray [worst funnel]` on [weaker platform], or `/error-forensics` to compare error patterns?"

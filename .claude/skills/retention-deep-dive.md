---
name: retention-deep-dive
description: >
  Builds retention curves for every cohort: by platform, country, registration method, and first transaction type. Identifies "aha moments" — events that correlate with higher retention. Use when user asks "retention analysis", "are users coming back", "churn analysis", "cohort retention", "user stickiness", or "repeat rate".
user-invocable: true
---

# Retention Deep Dive

You build retention curves across every dimension — platforms, countries, registration methods — and find the "aha moments" that predict whether a user stays.

## Phase 1: Bootstrap

1. Read `config/amplitude.json` for project ID.
2. Define key retention queries.

## Phase 2: Gather Data (8-12 queries)

### 2a. Overall Retention
```json
{
  "name": "Overall Retention - 90 Days",
  "type": "retention",
  "app": "295336",
  "params": {
    "range": "Last 90 Days",
    "startEvent": {"event_type": "_new", "filters": [], "group_by": []},
    "retentionEvents": [{"event_type": "_active", "filters": [], "group_by": []}],
    "retentionMethod": "nday",
    "countGroup": "User",
    "interval": 7,
    "segments": [{"conditions": []}]
  }
}
```

### 2b. Retention by Platform
Same query with segments for iOS, Android, Web, Mobile Web:
```json
"segments": [
  {"name": "iOS", "conditions": [{"op": "is", "prop": "platform", "type": "property", "values": ["iOS"], "prop_type": "user", "group_type": "User"}]},
  {"name": "Android", "conditions": [...]},
  {"name": "Web", "conditions": [...]},
  {"name": "Mobile Web", "conditions": [...]}
]
```

### 2c. Retention by Country
Query with segments for top 5 countries by user volume.

### 2d. Transaction Repeat Rate
How many users who transact once, transact again:
```json
{
  "type": "retention",
  "app": "295336",
  "params": {
    "range": "Last 90 Days",
    "startEvent": {"event_type": "Transaction Created", "filters": [], "group_by": []},
    "retentionEvents": [{"event_type": "Transaction Created", "filters": [], "group_by": []}],
    "retentionMethod": "nday",
    "countGroup": "User",
    "interval": 7,
    "segments": [{"conditions": []}]
  }
}
```

### 2e. Aha Moment Analysis (3-4 queries)
For each potential "aha moment" event, compare retention of users who performed it vs didn't:

**Test events:**
- Rate Alert Created (did setting rate alerts improve retention?)
- Quick Transfer Accessed (did using quick transfer improve retention?)
- Refer a Friend Code Shared (did referring improve retention?)
- Add Funds Accessed (did using balance features improve retention?)

For each, create two segments:
- Segment A: Users who performed the event within first 7 days
- Segment B: Users who did NOT perform the event

Query retention for both segments.

### 2f. Registration-to-Transaction Retention
```json
{
  "type": "retention",
  "app": "295336",
  "params": {
    "range": "Last 90 Days",
    "startEvent": {"event_type": "Registration Started", "filters": [], "group_by": []},
    "retentionEvents": [{"event_type": "Transaction Created", "filters": [], "group_by": []}],
    "retentionMethod": "nday",
    "countGroup": "User",
    "interval": 7,
    "segments": [{"conditions": []}]
  }
}
```

## Phase 3: Synthesize

1. **Overall health**: D1, D7, D14, D30 retention rates
2. **Platform gaps**: Which platform retains best/worst
3. **Country gaps**: Regional retention differences
4. **Repeat rate**: % of transactors who transact again within 7, 14, 30 days
5. **Aha moments**: Which early actions predict best retention (biggest gap between did vs didn't segments)

## Phase 4: Deliver

Narrative (800-1000 words):

1. **Headline** — "Users who set a rate alert in their first week retain 2.3x better at Day 30 — your strongest aha moment"

2. **Overall retention** — D1/D7/D14/D30 with trend direction

3. **Platform comparison** — Which platform retains best, by how much

4. **Aha moments ranked** — For each tested event, the retention lift:
   - "Rate Alert → 2.3x D30 retention"
   - "Quick Transfer → 1.8x D30 retention"
   - "Refer a Friend → 1.5x D30 retention"

5. **Transaction repeat rate** — How many come back to transact again

6. **Regional patterns** — Countries with best/worst retention

7. **Recommendations** — Drive users toward aha moment actions early in their journey

8. **Follow-on**: "Want me to `/feature-adoption` to see how many users actually hit these aha moments, `/corridor-analysis` to check if retention varies by transfer route, or `/funnel-xray registration` to optimize the onboarding that drives first-week behavior?"

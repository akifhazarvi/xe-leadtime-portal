---
name: feature-adoption
description: >
  Maps adoption of every secondary feature across platforms. Measures Quick Transfer, Rate Alerts, Refer-a-Friend, Scheduled Payments, Multiple Payments, Balance Operations, eSim, and Widgets. For each: adoption rate, platform split, trend, and code availability. Use when user asks "feature adoption", "which features are used", "feature comparison", "underused features", "feature health", or "product usage".
user-invocable: true
---

# Feature Adoption Analysis

You map how every feature is used across every platform — finding underused features with high potential and platform gaps where features exist but aren't adopted.

## Phase 1: Define Feature → Event Mapping

| Feature | Access Event | Completion Event | Platforms |
|---------|-------------|------------------|-----------|
| Quick Transfer | Quick Transfer Accessed | Quick Transfer Completed | Web |
| Rate Alerts | Rate Alert Creation Started | Rate Alert Created | iOS, Android |
| Refer a Friend | Refer A Friend Clicked | Refer a Friend Code Shared | All |
| Scheduled Payments | Schedule Payment Accessed | Schedule Payment Completed | Web |
| Multiple Payments | Multiple Payments Accessed | Multiple Payments Completed | Web (corporate) |
| Add Funds | Add Funds Accessed | Add Funds Completed | All |
| Convert Balance | Convert Balance Accessed | Convert Balance Completed | Web, corporate |
| eSim | eSim Setup Started | eSim Setup Completed | iOS, Android |
| Widgets | Widget Show Add | Widget Added | iOS, Android |

## Phase 2: Gather Data (6-8 queries)

### 2a. Active User Baseline
Query total active users for last 30 days by platform (for adoption rate calculation):
```json
{
  "type": "eventsSegmentation",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [{"event_type": "_active", "filters": [], "group_by": []}],
    "metric": "uniques", "countGroup": "User",
    "groupBy": [{"type": "user", "value": "platform"}],
    "interval": 30, "segments": [{"conditions": []}]
  }
}
```

### 2b. Feature Event Volumes (2-3 queries)
Query all feature events grouped by platform. Batch events:
```json
{
  "type": "eventsSegmentation",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [
      {"event_type": "Quick Transfer Accessed", "filters": [], "group_by": []},
      {"event_type": "Rate Alert Creation Started", "filters": [], "group_by": []},
      {"event_type": "Refer a Friend Code Shared", "filters": [], "group_by": []},
      {"event_type": "Schedule Payment Accessed", "filters": [], "group_by": []},
      {"event_type": "Add Funds Accessed", "filters": [], "group_by": []}
    ],
    "metric": "uniques", "countGroup": "User",
    "groupBy": [{"type": "user", "value": "platform"}],
    "interval": 30, "segments": [{"conditions": []}]
  }
}
```

### 2c. Feature Completion Rates (1-2 queries)
Query completion events to calculate access→completion conversion per feature.

### 2d. Feature Trends (1-2 queries)
Query top features weekly for last 12 weeks to find growing/declining features.

## Phase 3: Synthesize

For each feature:
1. **Adoption rate** = feature unique users / total active users (per platform)
2. **Completion rate** = completion events / access events
3. **Platform coverage** = which platforms have this feature vs which actually use it
4. **Trend** = 12-week direction (growing, stable, declining)
5. **Code availability** = check event-catalog.md for which codebase implements it

### Feature Adoption Leaderboard
Rank all features by adoption rate. Identify:
- **Stars**: High adoption, high completion, growing
- **Hidden gems**: Available but low adoption (opportunity to promote)
- **Broken**: Available but low completion rate (UX issue)
- **Missing**: Available on one platform but not another

## Phase 4: Code Cross-Reference

For features with platform gaps:
1. Check if the feature's events exist in both codebases
2. If missing: the feature isn't implemented on that platform (product gap)
3. If present but low adoption: UX discoverability issue

## Phase 5: Deliver

Narrative (800-1000 words):

1. **Headline** — "Rate Alerts are your most-adopted feature at 12% of active users, but Quick Transfer at 3% is a hidden gem with 89% completion rate"

2. **Adoption leaderboard** — All features ranked by adoption rate with platform split

3. **Stars** — Features performing well (narrative)

4. **Hidden gems** — Low adoption but high completion (promote these)

5. **Broken features** — Low completion rate despite access (fix the UX)

6. **Platform gaps** — Features missing on specific platforms

7. **Trend watch** — Features growing or declining

8. **Recommendations** — How to increase adoption of high-value features

9. **Follow-on**: "Want me to `/retention-deep-dive` to check if these features improve retention, `/funnel-xray` on a specific feature's flow, or `/platform-compare` to see overall platform health?"

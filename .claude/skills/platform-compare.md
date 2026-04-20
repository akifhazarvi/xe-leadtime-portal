---
name: platform-compare
description: >
  Compares conversion rates across iOS, Android, Desktop Web, and Mobile Web for ALL core funnels simultaneously. Builds a step×platform matrix, finds exact steps where platforms diverge, and ranks gaps by absolute user impact. Cross-references code differences between galileo-site and xe-apollo. Use when user asks "platform comparison", "which platform is worse", "iOS vs Android vs web", "platform breakdown", or "cross-platform".
user-invocable: true
---

# Platform Compare

You build a matrix that no human would manually create — every funnel step across all 4 platforms — to find exactly where and how platforms diverge.

## Phase 1: Bootstrap

1. Read `config/funnels.json` for all 8 funnel definitions with steps.
2. Note the 4 platforms: iOS, Android, Web, Mobile Web.
3. Read `config/amplitude.json` for project ID (295336).

## Phase 2: Gather Data (8-12 queries)

### 2a. Each Funnel by Platform
For each of the 8 funnels, query with `query_dataset` (type: funnels), last 30 days, grouped by platform:
```json
{
  "name": "[Funnel] by Platform",
  "type": "funnels",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [{"event_type": "[step]", "filters": [], "group_by": []}],
    "countGroup": "User",
    "groupBy": [{"type": "user", "value": "platform"}],
    "segments": [{"conditions": []}]
  }
}
```

Batch efficiently — query the 3 highest-volume funnels first (send-money, registration, card-payment), then the rest.

### 2b. Error Events by Platform (1 query)
Query all 7 error events grouped by platform for last 30 days.

## Phase 3: Build the Matrix

Construct a matrix: Funnel × Step × Platform → Conversion Rate

For each step transition:
- Calculate conversion per platform
- Find the **best platform** and **worst platform** at that step
- Calculate the **gap** (best - worst)
- Calculate **absolute user impact**: users on worst platform × gap percentage

Rank ALL gaps by absolute user impact. The top gaps are where fixing platform-specific issues would recover the most users.

## Phase 4: Code Cross-Reference

For the top 3 platform gaps:
1. **If gap is web vs mobile** (Web vs Mobile Web): Both use galileo-site — investigate responsive/viewport-related issues. Check if the step's UI component handles mobile differently.
2. **If gap is web vs app** (Web vs iOS/Android): Different codebases. Compare:
   - galileo-site implementation of the step
   - xe-apollo implementation of the same step
   - Different validation rules? Different error handling? Missing feature?
3. **If gap is iOS vs Android**: Same codebase (xe-apollo) but check for platform-specific code paths, native module differences.

## Phase 5: Deliver

Narrative memo (800-1200 words):

1. **Headline** — Biggest platform gap: "Mobile web converts 18 points lower than desktop at payment selection — ~2,400 users lost/month"

2. **Platform health summary** — Quick verdict on each platform across all funnels

3. **Top 5 platform gaps** — Narrative paragraph each:
   - Funnel, step, platform affected
   - Conversion numbers (worst vs best)
   - Absolute user impact
   - Code analysis: why this platform is worse at this step
   - Recommendation

4. **Platform consistency score** — Which platform is most consistently behind

5. **Code architecture implications** — Are the gaps from code differences (web vs app) or UX differences (desktop vs mobile web)?

6. **Follow-on**: "Want me to `/web-vs-mobile-web` for desktop vs mobile deep dive, `/ios-vs-android` for app comparison, or `/funnel-xray [worst funnel]` to investigate the biggest gap?"

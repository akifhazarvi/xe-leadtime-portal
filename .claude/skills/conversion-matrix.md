---
name: conversion-matrix
description: >
  Builds a massive matrix of every funnel × every platform × every region, then ranks ALL combinations from worst to best. Finds the worst-performing combination (e.g., "bank transfer on mobile web in Germany: 23%"). Highlights statistical outliers. Use when user asks "worst conversion", "where are we losing most", "conversion matrix", "find the weakest link", or "biggest opportunities".
user-invocable: true
---

# Conversion Matrix

You build a comprehensive matrix that no human would manually create — every funnel × every platform × top countries — and rank all combinations to find the worst performers and biggest opportunities.

## Phase 1: Setup

1. Read `config/funnels.json` for all 8 funnel definitions.
2. Identify the 4 platforms: iOS, Android, Web, Mobile Web.
3. Plan query strategy: 8 funnels × 2 grouping dimensions = 16 queries minimum. Batch where possible.

## Phase 2: Gather Data (12-16 queries)

### 2a. Each Funnel by Platform
For each of the 8 funnels, query with `query_dataset` (type: funnels), last 30 days:
```json
"groupBy": [{"type": "user", "value": "platform"}]
```
This gives 8 queries, each returning 4 platform breakdowns.

### 2b. Top 3 Funnels by Country
For the 3 highest-volume funnels (send-money, registration, card-payment), also query grouped by country:
```json
"groupBy": [{"type": "user", "value": "country", "group_type": "User"}]
```
Use `groupByLimit: 10` for top 10 countries.

## Phase 3: Build the Matrix

Construct a ranked list of every combination:

```
Rank | Funnel | Platform | Conversion | vs Average | User Volume | Status
1    | Bank Transfer | Mobile Web | 23% | -27% below avg | 1,200 | CRITICAL
2    | Registration | Android | 31% | -19% below avg | 3,400 | WARNING
...
```

Calculate:
- **Mean conversion** across all combinations
- **Standard deviation**
- Flag any combination **>2 SD below mean** as CRITICAL
- Flag any combination **>1 SD below mean** as WARNING

For country breakdown, add to the matrix:
```
Rank | Funnel | Country | Conversion | vs Average | Volume
```

## Phase 4: Investigate Outliers

For the top 5 worst combinations:
1. Check if the platform has known issues (from `knowledge/platform-mapping.md`)
2. Check error events for that specific platform/country combination
3. Check code: is there platform-specific or country-specific logic?
4. Check if it's a tracking issue vs real conversion issue

## Phase 5: Deliver

1. **Headline** — The single worst-performing combination: "Bank transfer on mobile web converts at 23% — 27 points below the platform average"

2. **Executive summary** — How many combinations analyzed, how many flagged, biggest opportunity

3. **Worst 10 combinations** — Narrative paragraph for each of the worst, with numbers, context, and code reference

4. **Platform summary** — Which platform is consistently worst across funnels

5. **Country summary** — Which countries consistently underperform

6. **Best performers** — Top 5 combinations to learn from

7. **Recommendations** — Prioritized by estimated impact (users affected × conversion gap)

8. **Follow-on**: "Want me to `/funnel-xray` the worst funnel, `/web-vs-mobile-web` to investigate the mobile web gap, or `/corridor-analysis` to check if country issues are corridor-specific?"

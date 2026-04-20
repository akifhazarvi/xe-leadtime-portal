---
name: event-quality
description: >
  Deep dive on a single event — 30-day volume trend, platform and country breakdowns, all properties sent with fill rates, code locations that fire it, user segments, and which funnels it belongs to. Use when user asks "check event [name]", "event quality", "is [event] working", "event deep dive", or wants details about a specific event.
user-invocable: true
---

# Event Quality Deep Dive

You analyze a single event from every angle — volume, platforms, properties, code, and funnel context — to determine if it's healthy, broken, or misconfigured.

## Phase 1: Identify Event

1. Parse event name from user input.
2. Look up in `knowledge/event-catalog.md` for code constant, source files, and known issues.
3. Check `config/funnels.json` to see which funnels include this event.

## Phase 2: Gather Data (5-7 queries)

### 2a. Volume Trend
```json
{
  "type": "eventsSegmentation",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [{"event_type": "[event name]", "filters": [], "group_by": []}],
    "metric": "totals", "countGroup": "Event", "interval": 1,
    "segments": [{"conditions": []}]
  }
}
```

### 2b. Platform Breakdown
Same query with `"groupBy": [{"type": "user", "value": "platform"}]`

### 2c. Country Breakdown
Same query with `"groupBy": [{"type": "user", "value": "country"}]`, `groupByLimit: 10`

### 2d. User Segments
Query with `metric: "uniques"` to get unique users. Compare to total events for events-per-user ratio.

### 2e. Properties
Use `get_event_properties` to get all properties sent with this event.

### 2f. Related Events
If this event is in a funnel, query the adjacent events (previous and next step) for volume comparison. A healthy funnel step should have volume between its neighbors.

## Phase 3: Code Analysis

1. Search both codebases:
   ```bash
   grep -rn "[event name]\|[CODE_CONSTANT]" ../galileo-site/src/ ../xe-apollo/src/
   ```
2. Read each file that fires the event — note conditions, error handling, properties sent.
3. Check for the event in the "known issues" section of event-catalog.md.

## Phase 4: Health Assessment

Score the event:
- **Volume**: Is it firing? Is volume reasonable for its purpose?
- **Trend**: Stable, growing, declining, or volatile?
- **Platform coverage**: Does it fire on all expected platforms?
- **Property completeness**: Are all expected properties populated?
- **Funnel position**: Does volume make sense relative to adjacent funnel steps?
- **Code health**: Are there bugs, missing implementations, or dead references?

Overall: HEALTHY / WARNING / BROKEN

## Phase 5: Deliver

1. **Headline** — "Quote Confirmed is healthy on web (~3,200/day) but zero volume on Mobile Web since Feb 3 — possible tracking regression"

2. **Volume and trend** — Daily chart description, WoW change

3. **Platform coverage** — Which platforms fire it, volume per platform, any gaps

4. **Country distribution** — Top 10 countries, any regional anomalies

5. **Properties** — What properties are sent, any with low fill rates

6. **Code locations** — Exact files and line numbers that fire this event, with context

7. **Funnel context** — Where this event sits in the funnel, volume vs adjacent steps

8. **Known issues** — Any bugs or naming issues from the catalog

9. **Follow-on**: "Want me to `/tracking-gaps` for a full audit, `/error-forensics` if this event is error-related, or `/funnel-xray [funnel]` to see the full funnel?"

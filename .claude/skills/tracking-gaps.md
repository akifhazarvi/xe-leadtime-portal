---
name: tracking-gaps
description: >
  Systematically compares events defined in code vs events firing in Amplitude. For cross-platform events, checks volume balance. Finds dead events (in code, zero volume), orphaned events (in Amplitude, not in code), silent failures (undefined constant references), and property completeness gaps. Use when user asks "tracking audit", "are events firing", "tracking gaps", "missing events", "event health", or "tracking quality".
user-invocable: true
---

# Tracking Gap Analysis

You systematically compare what the code defines vs what Amplitude receives — finding dead tracking, orphaned events, and silent failures that no dashboard would reveal.

## Phase 1: Collect Code Events

1. Read `knowledge/event-catalog.md` for the pre-analyzed catalog including:
   - galileo-site SEGMENT_EVENTS (~236 constants)
   - xe-apollo AnalyticsEventType (~470 constants)
   - Known bugs (NEW_PAYMENT_METHOD_COMPLETED undefined reference)
   - Known duplicates (BANK_VERIFICATION_COMPLETED = BANK_VERIFICATION_SUCCESS)
   - 31 dead events in galileo-site, ~30 unused in xe-apollo

2. If catalog needs refreshing, read the source files directly:
   - `../galileo-site/src/constants/segmentAnalytics.ts`
   - `../xe-apollo/src/model/types/analytics.const.ts`

## Phase 2: Collect Amplitude Events

Search for all events in Amplitude:
```json
{
  "appIds": [295336],
  "entityTypes": ["EVENT"],
  "limitPerQuery": 200
}
```

## Phase 3: Cross-Reference

### 3a. Code → Amplitude Match
For each code-defined event, check if it exists in Amplitude results.

**Categories:**
- **Healthy**: Event exists in both code and Amplitude
- **Dead code**: Event in code but NOT in Amplitude (never fires)
- **Orphaned**: Event in Amplitude but NOT in any code (server-side, deprecated, or third-party)

### 3b. Cross-Platform Volume Balance
For events defined in BOTH galileo-site and xe-apollo (from event-catalog.md cross-platform list), query their volume grouped by platform:
```json
{
  "type": "eventsSegmentation",
  "app": "295336",
  "params": {
    "range": "Last 7 Days",
    "events": [{"event_type": "[event]", "filters": [], "group_by": []}],
    "metric": "totals",
    "countGroup": "Event",
    "groupBy": [{"type": "user", "value": "platform"}],
    "segments": [{"conditions": []}]
  }
}
```
Flag events with >90% volume on one platform (should be more balanced for cross-platform events).

### 3c. Zero Volume Check
For events that exist in Amplitude but seem low, query last 7 days volume. Flag zero-volume events.

### 3d. Property Completeness
For 5 critical events (Transaction Created, Quote Confirmed, Registration Started, Payment Method Selected, Login Completed), use `get_event_properties` to check what properties are sent. Compare to expected properties.

### 3e. Known Issues
Flag the pre-identified bugs from the event catalog:
- `NEW_PAYMENT_METHOD_COMPLETED` references undefined constant
- `BANK_VERIFICATION_COMPLETED` and `BANK_VERIFICATION_SUCCESS` are duplicate strings
- `Promo  Added` (double space) vs `Promo Added`

## Phase 4: Find Untracked Flows

Search galileo-site for views without any tracking:
```bash
find ../galileo-site/src/views -name "*.vue" -exec grep -L "analyticsStore" {} \;
```
These are pages with no analytics coverage.

## Phase 5: Deliver

Narrative report (800-1200 words):

1. **Headline** — "31 dead events in web, 1 bug firing undefined, and 12 views with zero tracking coverage"

2. **Tracking health score** — X% of code events are firing correctly

3. **Dead events** — List with categories (truly dead, mobile-only, deprecated)

4. **Bugs** — Undefined references, duplicate strings, naming issues

5. **Platform imbalance** — Cross-platform events with suspicious skew

6. **Untracked flows** — Views/pages with no analytics

7. **Property gaps** — Critical events missing expected properties

8. **Prioritized fixes** — Ordered by impact

9. **Follow-on**: "Want me to `/event-quality [event]` for a deep dive on a specific event, or file these tracking bugs as issues on GitHub/Jira?"

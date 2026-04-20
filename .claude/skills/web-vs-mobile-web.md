---
name: web-vs-mobile-web
description: >
  Compares Desktop Web vs Mobile Web performance across every funnel, error rate, and engagement metric. Same codebase (galileo-site) but different UX — finds where mobile web breaks. Analyzes payment method distribution, quote error rates, and drop-off timing. Use when user asks "web vs mobile", "mobile web problems", "desktop vs mobile", "responsive issues", or "mobile web conversion".
user-invocable: true
---

# Web vs Mobile Web

Same code (galileo-site), completely different user experience. You find exactly where mobile web breaks — which steps, which errors, which flows — despite running the same codebase.

## Phase 1: Bootstrap

1. Read `config/funnels.json` and `config/kpis.json`.
2. Platform filters: Web = `"values": ["Web"]`, Mobile Web = `"values": ["Mobile Web"]`.
3. Note: both platforms run galileo-site code. Differences are UX/viewport, not code logic.

## Phase 2: Gather Data (8-10 queries)

### 2a. All Core Funnels by Platform (4 queries)
Query the top 4 funnels (send-money, registration, card-payment, bank-transfer) each with two segments:
```json
"segments": [
  {"name": "Web", "conditions": [{"op": "is", "prop": "platform", "type": "property", "values": ["Web"], "prop_type": "user", "group_type": "User"}]},
  {"name": "Mobile Web", "conditions": [{"op": "is", "prop": "platform", "type": "property", "values": ["Mobile Web"], "prop_type": "user", "group_type": "User"}]}
]
```

### 2b. Error Events by Platform (1 query)
All 7 errors with Web vs Mobile Web segments.

### 2c. Payment Method Distribution (1 query)
Payment Method Selected grouped by payment method type, with Web vs Mobile Web segments. This reveals if mobile web users choose different (potentially more friction-prone) payment methods.

### 2d. Quote Behavior (1 query)
Quote Accessed, Quote Created, Quote Error — with Web vs Mobile Web segments. Mobile web might have more quote errors due to connectivity. Note: Do NOT use "Quote Calculated" — that is a low-volume public site calculator event, not part of the consumer send money flow.

### 2e. Session Metrics (1 query)
Sessions query with Web vs Mobile Web segments: average length, sessions per user.

## Phase 3: Synthesize

For each funnel, identify the **mobile web penalty** — the conversion gap between Web and Mobile Web at each step.

Calculate:
- **Biggest mobile web penalty**: The step with the largest Web → Mobile Web gap
- **Payment method shift**: Do mobile web users use different payment methods?
- **Error amplification**: Are errors proportionally more common on mobile web?
- **Session difference**: Do mobile web users have shorter sessions (indicating impatience/friction)?

## Phase 4: Code Investigation

Since both platforms run the same galileo-site code:
1. Check for responsive breakpoints in affected components
2. Look for mobile-specific CSS/viewport issues
3. Check if payment forms render differently on mobile
4. Look for touch-specific interaction issues vs click-based

Search:
```bash
grep -r "mobile\|viewport\|responsive\|touch\|@media" ../galileo-site/src/views/SendMoney/ | head -20
```

## Phase 5: Deliver

Narrative (700-1000 words):

1. **Headline** — "Mobile web converts 15 points lower than desktop at quote confirmation — the same code, a very different experience"

2. **Overall gap** — Mobile web vs desktop overall performance delta

3. **Step-by-step mobile penalties** — For each funnel, the step where mobile web falls behind most

4. **Payment method impact** — If mobile web users choose different (worse-converting) payment methods

5. **Error comparison** — Which errors are disproportionately mobile web

6. **Session behavior** — How mobile web sessions differ (shorter? fewer pages?)

7. **Code investigation** — What in the galileo-site code might explain the gap (responsive issues, form complexity, viewport problems)

8. **Recommendations** — Specific UX improvements for mobile web

9. **Follow-on**: "Want me to `/funnel-xray` the worst mobile web funnel, `/error-forensics` filtered to mobile web, or `/platform-compare` to see the full 4-platform picture?"

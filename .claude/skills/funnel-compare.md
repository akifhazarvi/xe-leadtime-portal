---
name: funnel-compare
description: >
  Side-by-side comparison of two funnels — e.g., card payment vs bank transfer, send money vs quick transfer. Compares overall conversion, step timing, error rates, platform performance, and code complexity. Finds where one outperforms the other and why from the code. Use when user asks "compare funnels", "card vs bank", "X vs Y funnel", "which flow is better", or "funnel comparison".
user-invocable: true
---

# Funnel Compare

You compare two funnels head-to-head across every dimension — conversion, platforms, errors, and code complexity. This reveals why one flow outperforms another.

## Phase 1: Identify Funnels

1. Parse two funnel names from user input. Map to `config/funnels.json`.
2. If user gives descriptions instead of names, map to closest funnel (e.g., "card vs bank" → card_payment vs bank_transfer).
3. Load step definitions, expected conversions, and chart IDs for both.

## Phase 2: Gather Data (6-8 queries)

### 2a. Both Funnels — Overall (2 queries)
Query each funnel with `query_dataset` (type: funnels) for last 30 days.

### 2b. Both Funnels — Platform Breakdown (2 queries)
Same queries with `"groupBy": [{"type": "user", "value": "platform"}]`

### 2c. Error Events During Each Funnel (1-2 queries)
Query error events for last 30 days. Map which errors are relevant to which funnel:
- Card payment: Card Authorisation Failed, Payment Failed
- Bank transfer: Open Banking Payment Failed, Bank Verification Failed
- Send money: Quote Error, Transaction Failed, Payment Failed
- Login: Login Failed

### 2d. Code Complexity (read, no queries)
For each funnel, count:
- Number of distinct code files involved
- Number of conditions/validations in the step code
- Number of error handlers

## Phase 3: Synthesize

Build comparison across these dimensions:

| Dimension | Funnel A | Funnel B | Winner |
|-----------|----------|----------|--------|
| Overall conversion | X% | Y% | |
| Steps count | N | M | |
| Error rate | X% | Y% | |
| Best platform | [name] at X% | [name] at Y% | |
| Worst platform | [name] at X% | [name] at Y% | |
| Code complexity | N files, M conditions | N files, M conditions | |

For each step where the funnels overlap (e.g., both have payment method selection), compare directly.

## Phase 4: Deliver

Narrative memo (600-900 words):

1. **Headline** — "Card payments convert 15% higher than bank transfers, but mobile web gap is larger for cards"
2. **Overall comparison** — Which funnel wins and by how much
3. **Where Funnel A wins** — Steps and platforms where A outperforms
4. **Where Funnel B wins** — Steps and platforms where B outperforms
5. **Error comparison** — Which funnel has more error friction
6. **Code analysis** — Why one flow might be simpler/faster (fewer steps, less validation, better error handling)
7. **Recommendations** — What to improve on the losing funnel based on the winning funnel's patterns
8. **Follow-on**: "Want me to `/funnel-xray` the weaker funnel, or `/error-forensics` on its error events?"

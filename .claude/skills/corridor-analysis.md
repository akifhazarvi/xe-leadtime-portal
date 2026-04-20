---
name: corridor-analysis
description: >
  Analyzes money transfer corridors (TBU region + sendCurrency → payoutCurrency). Finds highest-volume, fastest-growing, declining, and worst-converting corridors. Cross-references quote error rates per corridor to find problematic routes. Use when user asks "corridor analysis", "which routes", "country pairs", "top corridors", "transfer routes", or "destination countries".
user-invocable: true
---

# Corridor Analysis

You analyze every money transfer corridor to find which routes drive the most volume, which are growing, and which have conversion or error problems.

## Corridor Definition

A corridor is: **TBU Region + sendCurrency → payoutCurrency**

- TBU Region = user property `gp:TBU` (numeric ID mapped to region name)
- sendCurrency = event property on Quote Confirmed / Transaction Completed
- payoutCurrency = event property on Quote Confirmed / Transaction Completed

### TBU ID → Region Mapping

| TBU ID | Region |
|--------|--------|
| 60 | US |
| 42 | UK |
| 800 | EU |
| 150 | AU |
| 700 | CA |
| 90 | NZ |

Always translate TBU IDs to region names in output.

## Critical Rules

- **Conversion is ALWAYS a funnel query** — never divide two separate event segmentation counts. Use Amplitude funnel type with ordered steps tracking the SAME users through both steps.
- **Funnel**: Quote Confirmed → Transaction Completed (not Transaction Created)
- **7-day conversion window** (604800 seconds) — captures slow settlement corridors like US/ACH
- **Consumer only** — filter `accountType is not Corporate` on ALL events.
- **Transfers only** — filter `transactionType = Transfer` on Transaction Completed to exclude fund/convert balance.
- **Group by**: `gp:TBU` (user property), `sendCurrency` (event), `payoutCurrency` (event)
- **Do NOT use `senderCountry`** as group by — it's missing on ~9.4k web Quote Confirmed events/month, causing (none) buckets with 0% fake conversion.
- **Quote Created** for demand analysis, NOT "Quote Calculated" (low-volume public site calculator event).
- **Unique users** (`countGroup: "User"`), not event totals.

## Phase 1: Bootstrap

1. Read `config/amplitude.json` for project ID (default: 295336).
2. Corridor = TBU Region + sendCurrency → payoutCurrency.

## Phase 2: Gather Data (5-8 queries)

### 2a. Core Corridor Conversion Funnel

**This is the primary corridor metric.** Funnel: Quote Confirmed → Transaction Completed, grouped by TBU + currency pair.

```json
{
  "type": "funnels",
  "app": "295336",
  "name": "Corridor Conversion: TBU + sendCurrency → payoutCurrency",
  "params": {
    "range": "Last 30 Days",
    "events": [
      {
        "event_type": "Quote Confirmed",
        "filters": [{"subprop_type": "event", "subprop_key": "accountType", "subprop_op": "is not", "subprop_value": ["Corporate"]}],
        "group_by": []
      },
      {
        "event_type": "Transaction Completed",
        "filters": [
          {"subprop_type": "event", "subprop_key": "accountType", "subprop_op": "is not", "subprop_value": ["Corporate"]},
          {"subprop_type": "event", "subprop_key": "transactionType", "subprop_op": "is", "subprop_value": ["Transfer"]}
        ],
        "group_by": []
      }
    ],
    "mode": "ordered",
    "conversionSeconds": 604800,
    "countGroup": "User",
    "metric": "ALL",
    "segments": [{"conditions": []}],
    "groupBy": [
      {"type": "user", "value": "gp:TBU", "group_type": "User"},
      {"type": "event", "value": "sendCurrency"},
      {"type": "event", "value": "payoutCurrency"}
    ]
  }
}
```

Use `groupByLimit: 40` and `timeSeriesLimit: 0` for totals only.

Returns per corridor: conversion %, Quote Confirmed users, Transaction Completed users, average time, median time.

### 2b. Conversion by TBU Region Only

Same funnel as 2a but grouped by TBU only — for a rolled-up region view:

```json
"groupBy": [{"type": "user", "value": "gp:TBU", "group_type": "User"}]
```

### 2c. Quote Errors by Corridor

Query Quote Error grouped by sendCurrency and payoutCurrency. Use `get_event_properties` for "Quote Error" first to confirm property names.

```json
{
  "type": "eventsSegmentation",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [{
      "event_type": "Quote Error",
      "filters": [{"subprop_type": "event", "subprop_key": "accountType", "subprop_op": "is not", "subprop_value": ["Corporate"]}],
      "group_by": [
        {"type": "event", "value": "sendCurrency"},
        {"type": "event", "value": "payoutCurrency"}
      ]
    }],
    "metric": "uniques",
    "countGroup": "User",
    "interval": 30,
    "segments": [{"conditions": []}]
  }
}
```

### 2d. Growth Trend (Weekly)

Corridor funnel over 90 days, weekly interval, grouped by TBU to find growth/decline:

```json
{
  "type": "funnels",
  "app": "295336",
  "name": "Corridor Growth Trend by TBU",
  "params": {
    "range": "Last 90 Days",
    "interval": 7,
    "events": [
      {
        "event_type": "Quote Confirmed",
        "filters": [{"subprop_type": "event", "subprop_key": "accountType", "subprop_op": "is not", "subprop_value": ["Corporate"]}],
        "group_by": []
      },
      {
        "event_type": "Transaction Completed",
        "filters": [
          {"subprop_type": "event", "subprop_key": "accountType", "subprop_op": "is not", "subprop_value": ["Corporate"]},
          {"subprop_type": "event", "subprop_key": "transactionType", "subprop_op": "is", "subprop_value": ["Transfer"]}
        ],
        "group_by": []
      }
    ],
    "mode": "ordered",
    "conversionSeconds": 604800,
    "countGroup": "User",
    "metric": "ALL",
    "segments": [{"conditions": []}],
    "groupBy": [{"type": "user", "value": "gp:TBU", "group_type": "User"}]
  }
}
```

### 2e. Demand Volume (Quote Created by Currency Pair)

Event segmentation to see where demand is flowing:

```json
{
  "type": "eventsSegmentation",
  "app": "295336",
  "params": {
    "range": "Last 30 Days",
    "events": [{
      "event_type": "Quote Created",
      "filters": [{"subprop_type": "event", "subprop_key": "accountType", "subprop_op": "is not", "subprop_value": ["Corporate"]}],
      "group_by": [
        {"type": "event", "value": "sendCurrency"},
        {"type": "event", "value": "payoutCurrency"}
      ]
    }],
    "metric": "uniques",
    "countGroup": "User",
    "interval": 30,
    "segments": [{"conditions": []}]
  }
}
```

### 2f. Payment Method Breakdown for Problem Corridors

For corridors with low conversion or long median times, filter by TBU and add paymentMethod:

```json
{
  "type": "funnels",
  "app": "295336",
  "name": "US Corridors by Payment Method",
  "params": {
    "range": "Last 30 Days",
    "events": [
      {
        "event_type": "Quote Confirmed",
        "filters": [
          {"subprop_type": "event", "subprop_key": "accountType", "subprop_op": "is not", "subprop_value": ["Corporate"]}
        ],
        "group_by": []
      },
      {
        "event_type": "Transaction Completed",
        "filters": [
          {"subprop_type": "event", "subprop_key": "accountType", "subprop_op": "is not", "subprop_value": ["Corporate"]},
          {"subprop_type": "event", "subprop_key": "transactionType", "subprop_op": "is", "subprop_value": ["Transfer"]}
        ],
        "group_by": []
      }
    ],
    "mode": "ordered",
    "conversionSeconds": 604800,
    "countGroup": "User",
    "metric": "ALL",
    "segments": [{"conditions": [{"type": "property", "group_type": "User", "prop_type": "user", "prop": "gp:TBU", "op": "is", "values": ["60"]}]}],
    "groupBy": [{"type": "event", "value": "paymentMethod"}]
  }
}
```

Repeat for other problem corridors (any with conversion <70% or median time >1 hour). Change TBU value: 60=US, 42=UK, 800=EU, 150=AU, 700=CA, 90=NZ.

### 2g. Revenue by Corridor (Optional)

If revenue analysis is requested, add computeProp on revenueUSD:

```json
"computeProp": {"type": "event", "value": "revenueUSD"},
"computePropFunction": "SUM"
```

## Phase 3: Synthesize

Build corridor rankings from funnel data:

1. **Top 30 by volume** — Highest Transaction Completed users per corridor triplet
2. **Top 10 growing** — Largest WoW increase in completed transactions (from 2d)
3. **Top 10 declining** — Largest WoW decrease
4. **Worst converting** — Lowest funnel conversion % (Quote Confirmed → Transaction Completed)
5. **Slowest to complete** — Highest median completion time (signals payment method / settlement friction)
6. **Error-prone** — Highest quote error count per corridor (2c errors vs 2a quote volume)
7. **Broken corridors** — (none) TBU or 0% conversion = tracking bugs or unregistered users

For each notable corridor report:
- Corridor: TBU Region + sendCurrency → payoutCurrency (translate TBU IDs to names)
- Volume (completed transactions, unique users)
- Conversion rate (Quote Confirmed → Transaction Completed, same-user funnel)
- Median completion time (signals payment method mix / settlement speed)
- Error rate (quote errors / quote volume)
- Growth trend (WoW change from weekly funnel)
- Payment method breakdown (for problem corridors)

### Known Patterns (validated March 2026)
- **US corridors have multi-day median times** — ACH/bank settlement dominates US payment method mix
- **UK/EU corridors convert 85-95% in under 1 hour** — card-first, instant settlement
- **US; USD → USD at ~11%** — same-currency "transfers" barely convert, likely confused users or internal moves
- **(none) TBU corridors at 0%** — users without TBU set, likely unregistered/anonymous sessions that never complete
- **→INR corridors vary by region**: EU 87%, AU 84%, NZ 87%, UK 82%, but CA only 62% — investigate CA→INR specifically
- **EU; EUR → USD at 52%** — surprisingly low for EU, with 13hr median — investigate payment rails

## Phase 4: Code Investigation

For error-prone or low-converting corridors:
1. Check if there are country-specific or currency-specific restrictions in the code
2. Search for country codes in galileo-site/xe-apollo
3. Check for currency pair validation logic

## Phase 5: Deliver

Narrative (800-1200 words):

1. **Headline** — e.g. "US; USD→INR is your #1 corridor at 7,196 completions/month (77% conversion), but UK; GBP→EUR converts at 90.1% in 21 minutes vs US's 4.6 days"

2. **Top corridors table** — TBU Region + currency pair, volume, conversion %, median time

3. **Growth corridors** — Fastest growing routes (marketing opportunity)

4. **Declining corridors** — Routes losing volume (investigate or deprioritize)

5. **Problem corridors** — Low conversion, long completion times, or high error rates. Include payment method breakdown explaining WHY

6. **Broken corridors** — (none) TBU, 0% conversion, same-currency anomalies

7. **Settlement insights** — Group corridors by median completion time bands (<1hr, 1-24hr, 1-7 days) to show payment rail differences

8. **Recommendations** — Invest in growing corridors, fix error-prone ones, investigate slow-settlement corridors

9. **Follow-on**: "Want me to `/funnel-xray send-money` filtered to a specific corridor, `/error-forensics` for corridor-specific errors, or `/diagnose` a declining corridor?"

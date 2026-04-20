# EU Payment Speed — Lead Time Update Proposal

Hey team,

We've been doing deep analysis on our EU payment delivery speeds using Amplitude transaction data (last 90 days, ~27,000 consumer transactions) and comparing them against what our lead time CSV currently promises users on the quote page.

**TL;DR: We're significantly under-promising delivery speed on 65 EU corridors. Our actual speeds are much faster than what we tell users.**

## The Problem

The EU lead time CSV (used by launchpad-api to show delivery estimates on quotes) hasn't been updated to reflect real performance. When a user in Europe sends money, they see delivery estimates like "Typically within 24 hours" or "Up to 3 days" — but for many corridors and payment methods, we're actually delivering in **minutes**.

## What We Did

- Pulled fresh Amplitude data: **Transaction Created → Transaction Completed** funnels for every EU corridor
- Broke it down by **payment method** (debit, credit, bank transfer, open banking)
- Analyzed **weekday vs weekend** speeds (maps to the CSV's IN/OUT columns)
- Compared every cell in the current EU.csv against actual measured speeds
- Built an updated CSV that **only tightens** (promises faster) — zero loosening

## The Numbers

| Metric | Value |
|--------|-------|
| Cells improved | **556** |
| Corridors affected | **65 payout currencies** |
| Cells loosened | **0** (we only update where we're genuinely faster) |

## Big Wins — Top Revenue Corridors

These are our highest-volume EU corridors — together representing **22,000+ transactions per quarter**. Every one gets a faster delivery promise.

**EU → INR (India)** — Our #1 corridor with 11,400 txns/quarter. Currently tells users "Up to 3 days" across all payment methods. In reality, debit and credit card transfers complete in minutes and bank transfers within 24 hours. This is our single biggest under-promise.

**EU → EUR (Intra-Europe)** — 3,200 txns/quarter. SEPA transfers are genuinely fast but we're telling every user "Typically within 24 hours". Debit card users actually get their money in minutes, and even bank transfers complete in hours. We can confidently promise much faster.

**EU → MAD (Morocco)** — 2,660 txns/quarter, our top remittance corridor. Debit and credit cards deliver in minutes but we're promising "Within 24 hours". Open Banking also completes in under an hour — way faster than the current "Up to 3 days" promise.

**EU → USD (United States)** — 1,590 txns/quarter. Currently says "Same day" but card payments actually complete in hours, not a full day. A meaningful improvement for a high-value corridor.

**EU → THB (Thailand)** — 659 txns/quarter. Debit cards deliver in minutes but we're showing "Within 48 hours" — a 2-day over-promise on a popular APAC corridor.

**EU → NAD (Namibia)** — 511 txns/quarter. Currently shows "3 business days" for debit — actual delivery is under 30 minutes. One of our biggest gaps between promise and reality.

**EU → COP (Colombia)** — 477 txns/quarter. "Up to 3 days" for debit when we're actually delivering in minutes. Same story for credit cards.

**EU → AED (UAE)** — 367 txns/quarter. Debit and credit cards complete in minutes but we promise "Within 24 hours". Open Banking also under an hour.

**EU → PHP (Philippines)** — 357 txns/quarter. "Within 48 hours" for debit when actual median is 12 minutes.

**EU → ETB (Ethiopia)** — 354 txns/quarter. The most dramatic improvement — going from "Typically 3 business days" to "Typically minutes" for debit and credit. This is the biggest tier jump in the entire update.

**EU → ZAR (South Africa)** — 307 txns/quarter. Credit and debit both deliver in minutes, currently promised as "Within 24 hours".

**EU → SAR (Saudi Arabia)** and **EU → PKR (Pakistan)** — 189 and 175 txns/quarter respectively. Both currently show "Within 24 hours" or "Up to 3 days" for card payments that actually complete in minutes.

## What Users Will See — Before & After Examples

| Corridor | Payment Method | Current (Before) | Updated (After) |
|----------|---------------|-------------------|-----------------|
| EU → EUR | Bank Transfer | "Typically within 24 hours" | **"Typically hours"** |
| EU → EUR | Debit Card | "Typically within 24 hours" | **"Typically minutes"** |
| EU → INR | Bank Transfer | "Up to 3 days" | **"Typically within 24 hours"** |
| EU → THB | Debit Card | "Typically within 24 hours" | **"Typically minutes"** |
| EU → NAD | Debit Card | "Typically within 24 hours" | **"Typically minutes"** |
| EU → ZAR | Credit Card | "Typically within 24 hours" | **"Typically minutes"** |
| EU → AED | Debit Card | "Typically within 24 hours" | **"Typically minutes"** |
| EU → USD | Credit Card | "Typically same day" | **"Typically hours"** |

## Issues Found

**Open Banking is consistently slower than cards**
OB median is ~0.9h for Ria corridors vs 0.2h for debit. This is expected (OB settlement adds ~45 min), but the old CSV doesn't differentiate — it gives OB the same speed as cards. Our update fixes this where applicable.

**Weekend speeds differ significantly for banking corridors**
EU → GBP, USD, CAD, AUD are much slower on weekends (no SWIFT processing). The CSV's OUT columns should reflect this — our update keeps these conservative.

## Interactive Dashboard

Explore every corridor, see old vs new side-by-side, and click any row to preview the quote experience:

- **Full comparison (click any row for quote preview):** https://akifhazarvi.github.io/xe-leadtime-portal/compare.html
- **Interactive quote simulator:** https://akifhazarvi.github.io/xe-leadtime-portal/quote.html

## Success Metrics — How We'll Measure Impact

The hypothesis: **faster delivery estimates → higher quote confirmation rate**. Users who see "Typically minutes" are more likely to proceed than those who see "Up to 3 days".

### Primary Metric
**Quote Created → Quote Confirmed conversion rate** for the 65 affected EU corridors, segmented by payment method.

### Measurement Plan

| Phase | Period | What |
|-------|--------|------|
| **Baseline (Pre)** | 30 days before deploy | Quote Created → Quote Confirmed by payoutCurrency × paymentMethod for EU senders |
| **Post-deploy** | 30 days after deploy | Same funnel, same segmentation |
| **Comparison** | Baseline vs Post | Conversion rate lift per corridor |

### Corridors to Watch (Highest Expected Impact)

These had the biggest SLA tier jump AND high volume — most likely to show measurable lift:

| Corridor | Payment Method | Old Estimate | New Estimate | Quarterly Txns | Why it matters |
|----------|---------------|-------------|-------------|----------------|----------------|
| EU → INR | Debit Card | "Up to 3 days" | "Typically minutes" | 4,096 | #1 corridor, biggest jump |
| EU → INR | Bank Transfer | "Up to 3 days" | "Within 24 hours" | 3,510 | Highest volume single cell |
| EU → EUR | Bank Transfer | "Within 24 hours" | "Typically hours" | 2,216 | #2 corridor, SEPA speed |
| EU → MAD | Debit Card | "Within 24 hours" | "Typically minutes" | 1,557 | #3 corridor |
| EU → EUR | Debit Card | "Within 24 hours" | "Typically minutes" | 807 | High volume fast corridor |
| EU → THB | Debit Card | "Within 48 hours" | "Typically minutes" | 226 | Big tier jump |
| EU → ETB | Debit/Credit | "3 business days" | "Typically minutes" | 204 | Biggest tier jump |
| EU → NAD | Debit Card | "3 business days" | "Typically minutes" | 249 | Major improvement |

### What "Good" Looks Like

- **+2-5% conversion lift** on corridors where estimate moved from "days" to "minutes" (INR, ETB, XOF, DOP, IDR)
- **+1-2% conversion lift** on corridors where estimate moved from "24 hours" to "minutes" (EUR, MAD, THB, NAD, ZAR, AED)
- **No regression** on corridors we didn't change

### Secondary Metrics
- **Transaction Created → Transaction Completed rate** — should remain stable (we're only changing the promise, not the actual speed)
- **Quote abandonment rate** — expect decrease if faster estimates reduce hesitation
- **Payment method selection shift** — users may gravitate toward debit/credit (shown as "minutes") over bank transfer ("hours")

### How to Run the Baseline

Amplitude funnel: **Quote Created → Quote Confirmed**
- Filter: `senderTbu IN (80001, 80002, 82021, 82022, 80042)`, `accountType != Corporate`
- Group by: `payoutCurrency`
- Conversion window: 24 hours
- Period: Last 30 Days
- Run once before deploy, save the chart, re-run 30 days post-deploy

## Next Steps

1. Review the updated CSV and dashboard
2. **Pull baseline metrics** (Quote Created → Quote Confirmed per corridor) before deploy
3. Decide on the Ria bank transfer issue (separate PR to differentiate by payment method?)
4. Deploy to staging and verify lead times render correctly on quotes
5. Ship to production
6. **Re-measure at 30 days** — compare conversion rates per corridor

Happy to walk through the data in more detail. The dashboard has everything — filter by currency, payment method, or click any corridor to see the exact before/after quote.

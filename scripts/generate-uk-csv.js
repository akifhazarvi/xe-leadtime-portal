#!/usr/bin/env node
// Generate improved UK.csv — only adds per-destination rows where measured P80 fits a TIGHTER tier than current currency-level row.
// Never loosens. Never removes existing rows. Appends DestinationCountry column.

const fs = require('fs');
const path = require('path');

const SRC_CSV = path.join(__dirname, '..', 'launchpad-api-main', 'src', 'Xe.Api.BackOfficeIntegration', 'LeadTimes', 'Data', 'UK.csv');
const SPEED = path.join(__dirname, '..', 'portal', 'data', 'uk-full-speed-data.json');
const OUT_CSV = path.join(__dirname, '..', 'portal', 'data', 'UK_new.csv');

const MIN_PAYMENTS = 30;
const BANK_PAYOUT = new Set(['Sepa', 'Swift', 'FPS', 'RIA', 'Ria', 'Domestic']);

// Leg 1 median (Funds Received → Transaction Completed) by payment method, for UK sender.
// Source: Amplitude, Last 30 Days, senderCountry=GB, Funds Received filtered by senderAddressCountryCode=GB.
// Chart edit: https://app.amplitude.com/analytics/ria/chart/new/xx1fx9ni
// Applied to IN_BankTransfer / OUT_BankTransfer columns so bank-to-bank E2E = Leg1 + Leg2.
const LEG1_MEDIAN_S = {
  bank_account: 397,    // 6.6 min
  // open_banking: 1848, // 30.8 min — not applied yet (scope: bank-to-bank only)
  // cards: near-zero (Funds Received doesn't fire reliably for cards)
};

const TIER_RANK = {
  'minutes': 1,
  'hours': 2,
  'same_day': 3,
  'next_day': 4,
  'h24': 5,
  'h48': 6,
  'up_to_3_days': 7,
  'three_business_days': 8,
  'more_than_3_days': 9,
};

const TIER_TO_RAW = {
  'minutes': '5mins',
  'hours': '2hrs',
  'same_day': 'Same Day',
  'next_day': 'Next Day',
  'h24': '<24hrs',
  'h48': '<48hrs',
  'up_to_3_days': '<3 days',
  'three_business_days': 'Three Days',
  'more_than_3_days': '<4days',
};

function rawToTier(raw) {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (/^\s*n\/a\s*$/.test(v)) return null;
  if (/^\s*<?\s*\d+\s*(mins?|minutes?|min)\s*$/.test(v)) return 'minutes';
  if (/^\s*>?\d+-<\d+\s*(mins?|minutes?|min)\s*$/.test(v)) return 'minutes';
  if (/^\s*<?\s*24\s*(hrs|hours)\s*$/.test(v)) return 'h24';
  if (/^\s*<?\s*48\s*(hrs|hours)\s*$/.test(v)) return 'h48';
  if (/^same\s*day\s*$/.test(v)) return 'same_day';
  if (/^next\s*day\s*$/.test(v)) return 'next_day';
  if (/^\s*\d+\-\d+\s*(hrs|hours)\s*$/.test(v)) return 'hours';
  if (/^\s*<?\s*\d+\s*(hrs|hours|hr|hour)\s*$/.test(v)) return 'hours';
  if (/^three\s*days\s*$/.test(v)) return 'three_business_days';
  if (/^\s*<?\s*(\d+)\s*(day|days)\s*$/.test(v)) {
    const m = v.match(/\d+/); const d = parseInt(m[0], 10);
    if (d <= 2) return 'up_to_3_days';
    if (d === 3) return 'up_to_3_days';
    return 'more_than_3_days';
  }
  return null;
}

function secondsToTier(sec) {
  if (sec == null) return null;
  if (sec <= 60 * 60) return 'minutes';              // <= 1h
  if (sec <= 12 * 3600) return 'hours';              // <= 12h
  if (sec <= 24 * 3600) return 'h24';                // <= 24h
  if (sec <= 48 * 3600) return 'h48';                // <= 48h
  if (sec <= 72 * 3600) return 'up_to_3_days';       // <= 3d
  if (sec <= 96 * 3600) return 'three_business_days';// <= 4d
  return 'more_than_3_days';
}

// Parse UK.csv into { header, rows: Array<{cells, ccy, ccyType, isRia}> }
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines[0].split(',').map(s => s.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows = lines.slice(1).map(line => {
    const cells = line.split(',').map(s => s.trim());
    return {
      cells,
      ccy: cells[idx['Currency']],
      ccyType: cells[idx['CCY']] || '',
      isRia: (cells[idx['CCY']] || '').toLowerCase().includes('ria'),
    };
  });
  return { header, idx, rows };
}

// Pick the effective row for a currency (Ria wins if present) — replicates launchpad EmbeddedLeadTimeProvider.ToMap.
function effectiveRowForCurrency(csv, ccy) {
  const candidates = csv.rows.filter(r => r.ccy.toLowerCase() === ccy.toLowerCase());
  if (candidates.length === 0) return null;
  return candidates.find(r => r.isRia) || candidates[0];
}

// Weighted P80 for bank-delivery payout methods at (ccy, destination).
function aggregateDestination(dstObj) {
  // dstObj.payoutMethods: { Sepa: {all, in, out}, ... }
  const in_parts = [];
  const out_parts = [];
  let in_n = 0, out_n = 0;
  for (const [method, stats] of Object.entries(dstObj.payoutMethods)) {
    if (!BANK_PAYOUT.has(method)) continue;
    if (stats.in) { in_parts.push({ n: stats.in.n, p80: stats.in.p80_s }); in_n += stats.in.n; }
    if (stats.out) { out_parts.push({ n: stats.out.n, p80: stats.out.p80_s }); out_n += stats.out.n; }
  }
  const weightedMax = parts => {
    if (parts.length === 0) return null;
    // Use volume-weighted P80 — a stable aggregate across methods.
    const total = parts.reduce((s, p) => s + p.n, 0);
    return Math.round(parts.reduce((s, p) => s + p.p80 * p.n, 0) / total);
  };
  return { in_p80: weightedMax(in_parts), out_p80: weightedMax(out_parts), in_n, out_n };
}

function main() {
  const csvText = fs.readFileSync(SRC_CSV, 'utf8');
  const csv = parseCsv(csvText);
  const speed = JSON.parse(fs.readFileSync(SPEED, 'utf8'));

  const header = [...csv.header, 'DestinationCountry'];
  const outLines = [header.join(',')];

  // Preserve all existing rows unchanged (append empty DestinationCountry column).
  for (const r of csv.rows) {
    outLines.push([...r.cells, ''].join(','));
  }

  const newRows = [];
  const summary = { candidates: 0, improved: 0, skipped_no_current: 0, skipped_insufficient_volume: 0, skipped_not_improving: 0 };

  for (const [ccy, ccyObj] of Object.entries(speed.corridors)) {
    const effective = effectiveRowForCurrency(csv, ccy);
    if (!effective) { summary.skipped_no_current++; continue; }

    // Current tiers per bucket (bank delivery columns).
    const currentInTier = rawToTier(effective.cells[csv.idx['IN_BankTransfer']]);
    const currentOutTier = rawToTier(effective.cells[csv.idx['OUT_BankTransfer']]);

    for (const [dst, dstObj] of Object.entries(ccyObj.destinations || {})) {
      summary.candidates++;
      const agg = aggregateDestination(dstObj);
      if ((agg.in_n + agg.out_n) < MIN_PAYMENTS) { summary.skipped_insufficient_volume++; continue; }

      // Bank-to-bank E2E = Leg1 (Funds Received → Txn Completed) + Leg2 (payout network) P80.
      // Applies to IN_BankTransfer / OUT_BankTransfer columns.
      const leg1Bank = LEG1_MEDIAN_S.bank_account;
      const inE2eBank = agg.in_p80 != null ? agg.in_p80 + leg1Bank : null;
      const outE2eBank = agg.out_p80 != null ? agg.out_p80 + leg1Bank : null;

      const measuredInTier = inE2eBank != null ? secondsToTier(inE2eBank) : null;
      const measuredOutTier = outE2eBank != null ? secondsToTier(outE2eBank) : null;

      const improveIn = measuredInTier && currentInTier && TIER_RANK[measuredInTier] < TIER_RANK[currentInTier];
      const improveOut = measuredOutTier && currentOutTier && TIER_RANK[measuredOutTier] < TIER_RANK[currentOutTier];

      if (!improveIn && !improveOut) { summary.skipped_not_improving++; continue; }

      // Build new row starting from effective (current) row; override only improved buckets.
      const newCells = [...effective.cells];
      const setCol = (col, value) => { newCells[csv.idx[col]] = value; };

      if (improveIn) {
        const raw = TIER_TO_RAW[measuredInTier];
        setCol('IN_BankTransfer', raw);
        setCol('IN_CreditCard', raw);
        setCol('IN_DebitCard', raw);
        setCol('IN_OpenBanking', raw);
        // IN_ACH stays as N/A (UK doesn't use ACH)
      }
      if (improveOut) {
        const raw = TIER_TO_RAW[measuredOutTier];
        setCol('OUT_BankTransfer', raw);
        setCol('OUT_CreditCard', raw);
        setCol('OUT_DebitCard', raw);
        setCol('OUT_OpenBanking', raw);
      }

      summary.improved++;
      newRows.push({
        ccy,
        dst,
        in_n: agg.in_n,
        out_n: agg.out_n,
        in_p80: agg.in_p80,
        out_p80: agg.out_p80,
        currentInTier,
        currentOutTier,
        measuredInTier,
        measuredOutTier,
        improveIn,
        improveOut,
        cells: [...newCells, dst],
      });
    }
  }

  // Sort new rows by currency, destination for readability.
  newRows.sort((a, b) => a.ccy.localeCompare(b.ccy) || a.dst.localeCompare(b.dst));
  for (const nr of newRows) {
    outLines.push(nr.cells.join(','));
  }

  fs.writeFileSync(OUT_CSV, outLines.join('\n') + '\n');
  console.log(`Wrote ${OUT_CSV}`);
  console.log(`Summary: ${JSON.stringify(summary, null, 2)}`);
  console.log(`New per-destination rows: ${newRows.length}`);

  // Breakdown by currency.
  const byCcy = {};
  for (const nr of newRows) {
    byCcy[nr.ccy] = (byCcy[nr.ccy] || 0) + 1;
  }
  console.log(`\nNew rows by currency:`);
  Object.entries(byCcy).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  // Sample a few for review.
  console.log(`\nSample new rows:`);
  newRows.slice(0, 10).forEach(nr => {
    console.log(`  ${nr.ccy} → ${nr.dst} | IN ${nr.improveIn ? `${nr.currentInTier}→${nr.measuredInTier}` : '-'} | OUT ${nr.improveOut ? `${nr.currentOutTier}→${nr.measuredOutTier}` : '-'} | n=${nr.in_n + nr.out_n}`);
  });
}

main();

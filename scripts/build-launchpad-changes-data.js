#!/usr/bin/env node
// Build JSON describing the launchpad branch changes — code summary + per-destination CSV improvements with revenue.
// Consumed by portal/leadtime/uk-launchpad-changes.html.

const fs = require('fs');
const path = require('path');

const SRC_CSV_ORIG = path.join(__dirname, '..', 'launchpad-api-main', 'src', 'Xe.Api.BackOfficeIntegration', 'LeadTimes', 'Data', 'UK.csv');
const SRC_CSV_NEW = path.join(__dirname, '..', 'portal', 'data', 'UK_new.csv');
const SLA_COMPLETE = path.join(__dirname, '..', 'portal', 'data', 'uk-sla-complete.json');
const DASHBOARD = path.join(__dirname, '..', 'portal', 'data', 'uk-dashboard.json');
const OUT = path.join(__dirname, '..', 'portal', 'data', 'uk-launchpad-changes.json');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines[0].split(',').map(s => s.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows = lines.slice(1).map(line => {
    const cells = line.split(',').map(s => s.trim());
    return { cells, ccy: cells[idx['Currency']], dest: cells[idx['DestinationCountry']] || '', ccyType: cells[idx['CCY']] || '' };
  });
  return { header, idx, rows };
}

function rawToTier(raw) {
  if (!raw) return null;
  const v = raw.trim();
  if (/^\s*n\/a\s*$/i.test(v)) return null;
  if (/^\s*>?\d+-<\d+\s*(mins?|minutes?|min)\s*$/i.test(v)) return 'Typically minutes';
  if (/^\s*<?\s*\d+\s*(mins?|minutes?|min)\s*$/i.test(v)) return 'Typically minutes';
  if (/^\s*<?\s*24\s*(hrs|hours)\s*$/i.test(v)) return 'Typically within 24 hours';
  if (/^\s*<?\s*48\s*(hrs|hours)\s*$/i.test(v)) return 'Typically within 48 hours';
  if (/^same\s*day\s*$/i.test(v)) return 'Typically same day';
  if (/^next\s*day\s*$/i.test(v)) return 'Typically next day';
  if (/^\s*\d+\-\d+\s*(hrs|hours)\s*$/i.test(v)) return 'Typically hours';
  if (/^\s*<?\s*\d+\s*(hrs|hours|hr|hour)\s*$/i.test(v)) return 'Typically hours';
  if (/^three\s*days\s*$/i.test(v)) return 'Typically 3 business days';
  const m = v.match(/^\s*<?\s*(\d+)\s*(day|days)\s*$/i);
  if (m) { const d = parseInt(m[1], 10); return d <= 3 ? `Up to ${d} days` : `More than ${d - 1} days`; }
  return v;
}

const TIER_RANK = {
  'Typically minutes': 1,
  'Typically hours': 2,
  'Typically same day': 3,
  'Typically next day': 4,
  'Typically within 24 hours': 5,
  'Typically within 48 hours': 6,
  'Up to 2 days': 7,
  'Up to 3 days': 8,
  'Typically 3 business days': 9,
  'More than 3 days': 10,
  'More than 4 days': 11,
};

function main() {
  const orig = parseCsv(fs.readFileSync(SRC_CSV_ORIG, 'utf8'));
  const updated = parseCsv(fs.readFileSync(SRC_CSV_NEW, 'utf8'));
  const sla = JSON.parse(fs.readFileSync(SLA_COMPLETE, 'utf8'));
  const dashboard = JSON.parse(fs.readFileSync(DASHBOARD, 'utf8'));

  // Build a map of (currency, destination) → volume + leg2 stats from sla-complete.
  const stats = new Map();
  for (const r of sla.rows) {
    if (r.deliveryMethod !== 'BankAccount') continue;
    const key = `${r.currency}|${r.destination}`;
    const cur = stats.get(key) || { vol: 0, in_vol: 0, out_vol: 0, in_p80: 0, out_p80: 0, in_w: 0, out_w: 0 };
    cur.vol += r.all_volume;
    if (r.in_volume) { cur.in_vol += r.in_volume; cur.in_p80 += (r.in_p80_s || 0) * r.in_volume; cur.in_w += r.in_volume; }
    if (r.out_volume) { cur.out_vol += r.out_volume; cur.out_p80 += (r.out_p80_s || 0) * r.out_volume; cur.out_w += r.out_volume; }
    stats.set(key, cur);
  }
  for (const [k, v] of stats) {
    v.in_p80 = v.in_w ? Math.round(v.in_p80 / v.in_w) : null;
    v.out_p80 = v.out_w ? Math.round(v.out_p80 / v.out_w) : null;
  }

  // Revenue per corridor (from dashboard).
  const revenue = {};
  for (const c of (dashboard.corridors || [])) {
    revenue[c.currency || c.ccy] = c.revenue_usd || c.revenueUsd || 0;
  }

  // Currency default (original) — Ria-priority replicated.
  const origByCcy = {};
  for (const r of orig.rows) {
    const isRia = (r.ccyType || '').toLowerCase().includes('ria');
    if (!origByCcy[r.ccy] || isRia) {
      origByCcy[r.ccy] = r;
    }
  }

  // Group rows by currency so we can show all variants and flag the active one.
  const allRowsByCcy = {};
  for (const r of orig.rows) {
    if (!allRowsByCcy[r.ccy]) allRowsByCcy[r.ccy] = [];
    const isRia = (r.ccyType || '').toLowerCase().includes('ria');
    allRowsByCcy[r.ccy].push({
      ccyType: r.ccyType,
      isRia,
      in_raw: r.cells[orig.idx['IN_BankTransfer']],
      out_raw: r.cells[orig.idx['OUT_BankTransfer']],
      cpo_raw: r.cells[orig.idx['CPO']],
    });
  }
  // Mark winner per currency (Ria wins; else first row).
  const multiRowCurrencies = [];
  for (const [ccy, rows] of Object.entries(allRowsByCcy)) {
    const winnerIdx = rows.findIndex(r => r.isRia);
    const winner = winnerIdx >= 0 ? winnerIdx : 0;
    rows.forEach((r, i) => r.active = i === winner);
    if (rows.length > 1) {
      multiRowCurrencies.push({ currency: ccy, variants: rows });
    }
  }
  multiRowCurrencies.sort((a, b) => a.currency.localeCompare(b.currency));

  // Identify new per-destination rows (have non-empty DestinationCountry).
  const improvements = [];
  for (const r of updated.rows) {
    if (!r.dest) continue;
    const origRow = origByCcy[r.ccy];
    if (!origRow) continue;

    const origIn = rawToTier(origRow.cells[orig.idx['IN_BankTransfer']]);
    const origOut = rawToTier(origRow.cells[orig.idx['OUT_BankTransfer']]);
    const newIn = rawToTier(r.cells[updated.idx['IN_BankTransfer']]);
    const newOut = rawToTier(r.cells[updated.idx['OUT_BankTransfer']]);

    const rawOrigIn = origRow.cells[orig.idx['IN_BankTransfer']];
    const rawOrigOut = origRow.cells[orig.idx['OUT_BankTransfer']];
    const rawNewIn = r.cells[updated.idx['IN_BankTransfer']];
    const rawNewOut = r.cells[updated.idx['OUT_BankTransfer']];

    const improveIn = rawNewIn !== rawOrigIn && newIn && origIn && (TIER_RANK[newIn] < TIER_RANK[origIn]);
    const improveOut = rawNewOut !== rawOrigOut && newOut && origOut && (TIER_RANK[newOut] < TIER_RANK[origOut]);

    const s = stats.get(`${r.ccy}|${r.dest}`) || {};
    improvements.push({
      currency: r.ccy,
      destination: r.dest,
      ccyType: r.ccyType,
      volume: s.vol || 0,
      in_volume: s.in_vol || 0,
      out_volume: s.out_vol || 0,
      in_p80_s: s.in_p80,
      out_p80_s: s.out_p80,
      revenue_usd: revenue[r.ccy] || 0,
      current: {
        in_raw: rawOrigIn,
        out_raw: rawOrigOut,
        in_tier: origIn,
        out_tier: origOut,
      },
      proposed: {
        in_raw: rawNewIn,
        out_raw: rawNewOut,
        in_tier: newIn,
        out_tier: newOut,
      },
      improveIn: rawNewIn !== rawOrigIn,
      improveOut: rawNewOut !== rawOrigOut,
    });
  }

  improvements.sort((a, b) => (b.volume || 0) - (a.volume || 0));

  const payload = {
    generated: new Date().toISOString().slice(0, 10),
    branch: 'feature/uk-leadtime-destination-country',
    repo_path: '/Users/akif.hazarvi/Xe-AI-Projects/launchpad-api',
    methodology: {
      bank_to_bank_sla: 'Leg1 (Funds Received \u2192 Transaction Completed median, 397s) + Leg2 (payout network P80 per destination)',
      bank_to_bank_leg1_s: 397,
      leg1_source: 'Amplitude funnel: Funds Received (senderAddressCountryCode=GB) \u2192 Transaction Completed (senderCountry=GB, paymentMethod=bank_account). Last 30 days. n=3058. Median 397s, average 32,357s.',
      leg1_chart: 'https://app.amplitude.com/analytics/ria/chart/new/xx1fx9ni',
      leg2_source: 'Weekly UK payout report (Jimmy), P80 per (currency, destination) across bank payout methods (Sepa/Swift/FPS/RIA/Domestic), volume-weighted.',
      rationale: 'Transaction Created \u2192 Transaction Completed would include the customer\'s bank-clearing time which we don\'t control. Using Funds Received as Leg 1 start excludes bank clearing, so the measured Leg 1 is our actual post-funding processing time. Adding this to Leg 2 P80 gives a realistic end-to-end SLA.',
    },
    code_changes: [
      { file: 'src/Xe.Api.BackOfficeIntegration/LeadTimes/LeadTimeEntry.cs', change: 'Add optional DestinationCountry property (kept old ctor for backward compat)' },
      { file: 'src/Xe.Api.BackOfficeIntegration/LeadTimes/LeadTimeMap.cs', change: 'Composite key (ccy, country) + TryFindEntry with fallback to currency default' },
      { file: 'src/Xe.Api.BackOfficeIntegration/LeadTimes/EmbeddedLeadTimeProvider.cs', change: 'Read optional DestinationCountry column; group by (ccy, country); preserve Ria priority per group' },
      { file: 'src/Xe.Api.BackOfficeIntegration/LeadTimes/LeadTimesLoader.cs', change: 'Overloads accept destinationCountry; fallback to currency default if no match' },
      { file: 'src/Xe.Api.BackOfficeIntegration/LeadTimes/ILeadTimeProvider.cs', change: 'New overload with destinationCountry parameter' },
      { file: 'src/Xe.Api.BackOfficeIntegration/LeadTimes/LeadTimeProvider.cs', change: 'New overload threads destinationCountry through; old signature delegates with null (back-compat)' },
      { file: 'src/Xe.Api.Launchpad/Controllers/QuoteControllerV2.cs', change: 'Pass quote.Quote.CountryTo to _leadTimes.GetLeadTime' },
      { file: 'src/Xe.Api.BackOfficeIntegration/LeadTimes/Data/UK.csv', change: '156 existing rows preserved + 35 per-destination improvement rows + trailing DestinationCountry column' },
      { file: 'test/UnitTest/Xe.Api.BackOfficeIntegration.UnitTest/LeadTimes/LeadTimeLoaderTests.cs', change: '3 new tests: destination-specific match, unknown-country fallback, no-country backward compat' },
      { file: 'NuGet.config', change: 'Added Xe artifactory feeds (xemt, gdt-nuget) alongside nuget.org so restore works locally' },
      { file: 'tools/LeadTimeProbe/', change: 'New CLI to preview Quote-response lead-time string for any (country, ccy, dest, pm, dm, time)' },
    ],
    stats: {
      existing_rows: orig.rows.length,
      new_rows: improvements.length,
      total_rows: updated.rows.length,
      payments_analysed: sla.total_payments,
      currencies_improved: new Set(improvements.map(i => i.currency)).size,
      multi_row_currencies: multiRowCurrencies.length,
    },
    improvements,
    multiRowCurrencies,
    rowSelection: {
      description: 'When UK.csv has multiple rows for the same currency, the launchpad loader picks one — Ria variant wins.',
      code_snippet: 'map[key] = g.FirstOrDefault(x => x.IsRia) ?? g.First();',
      code_file: 'src/Xe.Api.BackOfficeIntegration/LeadTimes/EmbeddedLeadTimeProvider.cs',
      code_line: 59,
      is_ria_detection: 'c[13].Contains("Ria", StringComparison.InvariantCultureIgnoreCase)',
      is_ria_detection_file: 'src/Xe.Api.BackOfficeIntegration/LeadTimes/EmbeddedLeadTimeProvider.cs',
      is_ria_detection_line: 152,
      is_ria_explanation: 'c[13] is the CCY column. If the cell contains "Ria" (case-insensitive) \u2014 i.e. "Ria CCY" \u2014 the row is flagged IsRia=true.',
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(`  ${payload.stats.new_rows} improvement rows across ${payload.stats.currencies_improved} currencies`);
}

main();

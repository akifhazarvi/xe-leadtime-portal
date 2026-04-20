#!/usr/bin/env node
/**
 * Generate Lead Time Comparison Data
 * Compares EU.csv SLA values vs actual Amplitude-measured speeds
 */

const fs = require('fs');
const path = require('path');

// --- 1. Parse EU CSV ---
const csvPath = path.join(__dirname, '../../../launchpad-api/src/Xe.Api.BackOfficeIntegration/LeadTimes/Data/EU.csv');
const csvText = fs.readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, ''); // strip BOM
const lines = csvText.split('\n').filter(l => l.trim());
const headers = lines[0].split(',').map(h => h.trim());

const csvRows = [];
for (let i = 1; i < lines.length; i++) {
  const cells = lines[i].split(',').map(c => c.trim());
  const row = {};
  headers.forEach((h, idx) => { row[h] = cells[idx] || ''; });
  csvRows.push(row);
}

// Group by currency — Ria takes priority (same as C# code)
const csvByCurrency = {};
for (const row of csvRows) {
  const ccy = row.Currency.trim();
  if (!ccy) continue;
  const isRia = (row.CCY || '').toLowerCase().includes('ria');
  if (!csvByCurrency[ccy] || isRia) {
    csvByCurrency[ccy] = {
      currency: ccy,
      ccyType: row.CCY,
      isRia: isRia,
      businessHours: {
        bankTransfer: row.IN_BankTransfer,
        creditCard: row.IN_CreditCard,
        debitCard: row.IN_DebitCard,
        openBanking: row.IN_OpenBanking,
        ach: row.IN_ACH,
      },
      afterHours: {
        bankTransfer: row.OUT_BankTransfer,
        creditCard: row.OUT_CreditCard,
        debitCard: row.OUT_DebitCard,
        openBanking: row.OUT_OpenBanking,
        ach: row.OUT_ACH,
      },
      cpo: row.CPO,
      mobileWallet: row.MobileWallet,
      balance: row.Balance,
      peerToPeer: row.PeerToPeer,
    };
  }
  // Also store the non-Ria entry separately
  if (!csvByCurrency[ccy + '_all']) csvByCurrency[ccy + '_all'] = [];
  csvByCurrency[ccy + '_all'].push({
    ccyType: row.CCY,
    isRia: isRia,
    businessHours: {
      bankTransfer: row.IN_BankTransfer,
      creditCard: row.IN_CreditCard,
      debitCard: row.IN_DebitCard,
      openBanking: row.IN_OpenBanking,
    },
    afterHours: {
      bankTransfer: row.OUT_BankTransfer,
      creditCard: row.OUT_CreditCard,
      debitCard: row.OUT_DebitCard,
      openBanking: row.OUT_OpenBanking,
    },
    peerToPeer: row.PeerToPeer,
  });
}

// --- 2. Load Amplitude data ---
const ampPath = path.join(__dirname, '../data/eu-payment-speed.json');
const ampData = JSON.parse(fs.readFileSync(ampPath, 'utf-8'));
const ampCurrencies = ampData.currencies;

// --- 3. SLA text to hours conversion ---
function slaToHours(sla) {
  if (!sla) return null;
  const s = sla.toLowerCase().trim();
  if (s === 'n/a' || s === '') return null;
  if (/^<?\s*5\s*min/.test(s)) return 0.08;
  if (/^<?\s*10\s*min/.test(s)) return 0.17;
  if (/^15\s*min/.test(s)) return 0.25;
  if (/^<?\s*30\s*min/.test(s)) return 0.5;
  if (/>\s*5.*<\s*60\s*min/.test(s)) return 1.0;
  if (/^<?\s*1\s*hr/.test(s) || /^1\s*hr/.test(s)) return 1.0;
  if (/^<?\s*2\s*hr/.test(s) || /^2\s*hr/.test(s)) return 2.0;
  if (/^1-12\s*hour/i.test(s)) return 12.0;
  if (/same\s*day/i.test(s)) return 24.0;
  if (/next\s*day/i.test(s)) return 24.0;
  if (/^<?\s*24\s*(hrs|hour)/i.test(s) || s === '24hrs') return 24.0;
  if (/^<?\s*48\s*(hrs|hour)/i.test(s) || s === '48hrs') return 48.0;
  if (/^>\s*48\s*(hrs|hour)/i.test(s)) return 72.0;
  if (/three\s*day/i.test(s)) return 72.0;
  if (/^<?\s*3\s*day/i.test(s)) return 72.0;
  if (/^<?\s*4\s*day/i.test(s)) return 96.0;
  if (/^<?\s*5\s*day/i.test(s)) return 120.0;
  return null;
}

function slaToLabel(sla) {
  if (!sla) return 'N/A';
  return sla.trim();
}

function speedBucket(hours) {
  if (hours === null || hours === undefined) return 'unknown';
  if (hours <= 0.08) return '<5min';
  if (hours <= 0.5) return '<30min';
  if (hours <= 1) return '<1hr';
  if (hours <= 6) return '<6hrs';
  if (hours <= 24) return '<24hrs';
  if (hours <= 48) return '<48hrs';
  if (hours <= 72) return '<3days';
  if (hours <= 96) return '<4days';
  return '>4days';
}

function status(slaHrs, actualHrs) {
  if (slaHrs === null || actualHrs === null) return 'no-data';
  if (actualHrs <= slaHrs) {
    if (actualHrs <= slaHrs * 0.1) return 'much-faster';
    if (actualHrs <= slaHrs * 0.5) return 'faster';
    return 'on-track';
  }
  if (actualHrs <= slaHrs * 1.5) return 'slightly-over';
  return 'exceeds';
}

// --- 4. Build comparison ---
const comparison = [];

// Get all unique currencies from CSV (excluding _all keys)
const csvCurrencies = Object.keys(csvByCurrency).filter(k => !k.endsWith('_all'));

for (const ccy of csvCurrencies) {
  const csv = csvByCurrency[ccy];
  const amp = ampCurrencies[ccy] || {};
  const allRows = csvByCurrency[ccy + '_all'] || [];

  const overall = amp.overall || {};
  const debit = amp.debit || {};
  const credit = amp.credit || {};
  const bank = amp.bank_account || {};
  const ob = amp.open_banking || {};

  // Business hours SLA (what most users see during the day)
  const sla_bh = csv.businessHours;
  // After hours SLA
  const sla_ah = csv.afterHours;

  const entry = {
    currency: ccy,
    ccyType: csv.ccyType,
    isRia: csv.isRia,
    volume: overall.volume || 0,
    completed: overall.completed || 0,
    completionRate: overall.rate || 0,
    allRows: allRows,

    // Overall measured speed
    overall: {
      median_hrs: overall.median_hrs,
      avg_hrs: overall.avg_hrs,
      bucket: speedBucket(overall.median_hrs),
    },

    // Per payment method: SLA vs Actual
    methods: {
      debitCard: {
        sla_bh: slaToLabel(sla_bh.debitCard),
        sla_bh_hrs: slaToHours(sla_bh.debitCard),
        sla_ah: slaToLabel(sla_ah.debitCard),
        sla_ah_hrs: slaToHours(sla_ah.debitCard),
        actual_median: debit.median_hrs ?? null,
        actual_avg: debit.avg_hrs ?? null,
        actual_volume: debit.volume || 0,
        actual_bucket: speedBucket(debit.median_hrs),
        status_bh: status(slaToHours(sla_bh.debitCard), debit.median_hrs),
        status_ah: status(slaToHours(sla_ah.debitCard), debit.median_hrs),
      },
      creditCard: {
        sla_bh: slaToLabel(sla_bh.creditCard),
        sla_bh_hrs: slaToHours(sla_bh.creditCard),
        sla_ah: slaToLabel(sla_ah.creditCard),
        sla_ah_hrs: slaToHours(sla_ah.creditCard),
        actual_median: credit.median_hrs ?? null,
        actual_avg: credit.avg_hrs ?? null,
        actual_volume: credit.volume || 0,
        actual_bucket: speedBucket(credit.median_hrs),
        status_bh: status(slaToHours(sla_bh.creditCard), credit.median_hrs),
        status_ah: status(slaToHours(sla_ah.creditCard), credit.median_hrs),
      },
      bankTransfer: {
        sla_bh: slaToLabel(sla_bh.bankTransfer),
        sla_bh_hrs: slaToHours(sla_bh.bankTransfer),
        sla_ah: slaToLabel(sla_ah.bankTransfer),
        sla_ah_hrs: slaToHours(sla_ah.bankTransfer),
        actual_median: bank.median_hrs ?? null,
        actual_avg: bank.avg_hrs ?? null,
        actual_volume: bank.volume || 0,
        actual_bucket: speedBucket(bank.median_hrs),
        status_bh: status(slaToHours(sla_bh.bankTransfer), bank.median_hrs),
        status_ah: status(slaToHours(sla_ah.bankTransfer), bank.median_hrs),
      },
      openBanking: {
        sla_bh: slaToLabel(sla_bh.openBanking),
        sla_bh_hrs: slaToHours(sla_bh.openBanking),
        sla_ah: slaToLabel(sla_ah.openBanking),
        sla_ah_hrs: slaToHours(sla_ah.openBanking),
        actual_median: ob.median_hrs ?? null,
        actual_avg: ob.avg_hrs ?? null,
        actual_volume: ob.volume || 0,
        actual_bucket: speedBucket(ob.median_hrs),
        status_bh: status(slaToHours(sla_bh.openBanking), ob.median_hrs),
        status_ah: status(slaToHours(sla_ah.openBanking), ob.median_hrs),
      },
    },

    // Special delivery methods
    special: {
      cpo: csv.cpo,
      mobileWallet: csv.mobileWallet,
      balance: csv.balance,
      peerToPeer: csv.peerToPeer,
    },
  };

  // Add send currency breakdown from amplitude data
  const scBreakdown = ampData.by_send_currency || {};
  const scData = scBreakdown[ccy] || {};
  entry.bySendCurrency = {};
  for (const [sc, d] of Object.entries(scData)) {
    entry.bySendCurrency[sc] = {
      volume: d.volume || 0,
      completed: d.completed || 0,
      rate: d.rate || 0,
      median_hrs: d.median_hrs,
      avg_hrs: d.avg_hrs,
      bucket: speedBucket(d.median_hrs),
      status_bh: status(slaToHours((csv.businessHours.debitCard || '').trim()), d.median_hrs),
    };
  }

  comparison.push(entry);
}

// Sort by volume descending
comparison.sort((a, b) => b.volume - a.volume);

// --- 5. Summary stats ---
const summary = {
  total_currencies: comparison.length,
  with_data: comparison.filter(c => c.volume > 0).length,
  no_data: comparison.filter(c => c.volume === 0).length,
  total_volume: comparison.reduce((s, c) => s + c.volume, 0),
  violations: { exceeds: 0, slightly_over: 0 },
  faster: { much_faster: 0, faster: 0 },
  on_track: 0,
};

for (const c of comparison) {
  for (const m of Object.values(c.methods)) {
    if (m.status_bh === 'exceeds') summary.violations.exceeds++;
    if (m.status_bh === 'slightly-over') summary.violations.slightly_over++;
    if (m.status_bh === 'much-faster') summary.faster.much_faster++;
    if (m.status_bh === 'faster') summary.faster.faster++;
    if (m.status_bh === 'on-track') summary.on_track++;
  }
}

const output = {
  generated: new Date().toISOString().split('T')[0],
  period: 'Last 90 Days',
  region: 'EU',
  source_csv: 'launchpad-api/src/Xe.Api.BackOfficeIntegration/LeadTimes/Data/EU.csv',
  send_currencies: ['EUR', 'GBP', 'Other'],
  send_currency_labels: { EUR: 'EUR', GBP: 'GBP', Other: 'DKK/SEK/CHF/NOK/PLN' },
  note: 'Each row = EU -> [payout currency] corridor. IN columns = business hours (before 14:00 GMT), OUT columns = after hours. Ria row takes priority when present. Amplitude data: EU consumer Transfer only (senderTbu EU codes), 30-day conversion window. Send currencies: EUR (85%), GBP (9.4%), DKK/SEK/CHF/NOK/PLN (3%). The same CSV SLA applies regardless of send currency.',
  summary,
  currencies: comparison,
};

// --- 6. Load weekday/weekend data ---
const wdwePath = path.join(__dirname, '../data/eu-weekday-weekend.json');
let wdweData = { weekday: {}, weekend: {} };
try { wdweData = JSON.parse(fs.readFileSync(wdwePath, 'utf-8')); } catch(e) {}

for (const c of comparison) {
  const wd = wdweData.weekday[c.currency] || {};
  const we = wdweData.weekend[c.currency] || {};
  c.weekday = { volume: wd.vol || 0, median_hrs: wd.med ?? null, avg_hrs: wd.avg ?? null };
  c.weekend = { volume: we.vol || 0, median_hrs: we.med ?? null, avg_hrs: we.avg ?? null };
}

const outPath = path.join(__dirname, '../data/leadtime-comparison.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Generated ${outPath}`);
console.log(`  ${summary.total_currencies} currencies, ${summary.with_data} with Amplitude data`);
console.log(`  ${summary.total_volume} total transactions (90 days)`);
console.log(`  ${summary.violations.exceeds} SLA violations, ${summary.faster.much_faster} much faster than SLA`);

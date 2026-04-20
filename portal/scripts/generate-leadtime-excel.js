#!/usr/bin/env node
/**
 * Generate Lead Time Excel — EU Improved
 * 3 tabs: Current EU, Improved EU, Changes Only
 * Exact same format as launchpad CSV
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Load CSVs
const oldCsvPath = path.join(__dirname, '../data/EU_current.csv');
const newCsvPath = path.join(__dirname, '../data/EU_improved.csv');
const changesPath = path.join(__dirname, '../data/eu-improvements.json');

function parseCsv(filepath) {
  const text = fs.readFileSync(filepath, 'utf-8').replace(/^\uFEFF/, '');
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim());
    const row = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows };
}

const old = parseCsv(oldCsvPath);
const improved = parseCsv(newCsvPath);
const changes = JSON.parse(fs.readFileSync(changesPath, 'utf-8'));

// --- Tab 1: Current EU (exact replica) ---
function buildSheet(data) {
  const ws = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows.map(r => data.headers.map(h => r[h]))]);
  // Set column widths
  ws['!cols'] = data.headers.map(h => ({ wch: h === 'Currency' ? 10 : h === 'CCY' ? 12 : 16 }));
  return ws;
}

// --- Tab 3: Changes Only ---
function buildChangesSheet() {
  const changeHeaders = ['Currency', 'CCY Type', 'Column', 'Payment Method', 'OLD Value', 'NEW Value', 'Median (hrs)', 'Avg (hrs)', 'Volume'];
  const changeRows = changes.changes.map(c => [
    c.ccy, c.type, c.col, c.method, c.old, c.new,
    c.med.toFixed(1), c.avg.toFixed(1), c.vol
  ]);
  const ws = XLSX.utils.aoa_to_sheet([changeHeaders, ...changeRows]);
  ws['!cols'] = [
    { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 8 }
  ];
  ws['!autofilter'] = { ref: `A1:I${changeRows.length + 1}` };
  return ws;
}

// --- Tab 4: Summary by Currency ---
function buildSummarySheet() {
  // Group changes by currency
  const byCcy = {};
  for (const c of changes.changes) {
    const key = c.ccy;
    if (!byCcy[key]) byCcy[key] = { ccy: c.ccy, type: c.type, changes: [] };
    byCcy[key].changes.push(c);
  }

  const summaryHeaders = [
    'Currency', 'CCY Type', '# Changes',
    'IN_BankTransfer', 'IN_CreditCard', 'IN_DebitCard', 'IN_OpenBanking',
    'OUT_BankTransfer', 'OUT_CreditCard', 'OUT_DebitCard', 'OUT_OpenBanking'
  ];
  const summaryRows = [];

  for (const [ccy, data] of Object.entries(byCcy).sort((a, b) => b[1].changes.length - a[1].changes.length)) {
    const row = [data.ccy, data.type, data.changes.length];
    const cols = ['IN_BankTransfer', 'IN_CreditCard', 'IN_DebitCard', 'IN_OpenBanking',
                  'OUT_BankTransfer', 'OUT_CreditCard', 'OUT_DebitCard', 'OUT_OpenBanking'];
    for (const col of cols) {
      const change = data.changes.find(c => c.col === col);
      if (change) {
        row.push(`${change.old} → ${change.new}`);
      } else {
        row.push('');
      }
    }
    summaryRows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  ws['!cols'] = [
    { wch: 8 }, { wch: 12 }, { wch: 10 },
    { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 },
    { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }
  ];
  ws['!autofilter'] = { ref: `A1:K${summaryRows.length + 1}` };
  return ws;
}

// Build workbook
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, buildSheet(old), 'Current EU');
XLSX.utils.book_append_sheet(wb, buildSheet(improved), 'Improved EU');
XLSX.utils.book_append_sheet(wb, buildChangesSheet(), 'All Changes');
XLSX.utils.book_append_sheet(wb, buildSummarySheet(), 'Summary by Currency');

const outPath = path.join(__dirname, '../exports/EU_leadtime_improved.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`Written to ${outPath}`);
console.log(`  Tab 1: Current EU (${old.rows.length} rows — exact replica of launchpad CSV)`);
console.log(`  Tab 2: Improved EU (${improved.rows.length} rows — only faster values updated)`);
console.log(`  Tab 3: All Changes (${changes.changes.length} cells tightened)`);
console.log(`  Tab 4: Summary by Currency (${Object.keys(changes.changes.reduce((a, c) => { a[c.ccy] = 1; return a; }, {})).length} currencies improved)`);

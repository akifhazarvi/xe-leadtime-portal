#!/usr/bin/env node
/**
 * Export Payment Speed data as Excel (.xlsx) with separate tabs + auto-filters.
 * Run: node portal/export-speed-csv.js
 * Output: portal/exports/payment-speed.xlsx
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/payment-speed.json'), 'utf8'));
const outDir = path.join(__dirname, 'exports');
fs.mkdirSync(outDir, { recursive: true });

const COLS = ['Volume', 'Completed', 'Completion %', 'Median (hrs)', 'Avg (hrs)',
  '% within 1h', '% within 6h', '% within 1d', '% within 3d', '% within 7d'];

function vals(d) {
  return [d.volume, d.completed, d.completion_rate, d.median_hours, d.avg_hours,
    d.pct_1h, d.pct_6h, d.pct_1d, d.pct_3d, d.pct_7d];
}

function makeSheet(header, rows) {
  const aoa = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Auto-filter on header row
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: header.length - 1 } }) };
  // Column widths
  ws['!cols'] = header.map((h, i) => ({ wch: i === 0 ? 20 : i === 1 ? 20 : 14 }));
  return ws;
}

const wb = XLSX.utils.book_new();

// 1. Overall
const overallWs = makeSheet(COLS, [vals(data.overall)]);
XLSX.utils.book_append_sheet(wb, overallWs, 'Overall');

// 2. Payment Method
const pmRows = Object.entries(data.by_payment_method).map(([m, d]) => [m, ...vals(d)]);
XLSX.utils.book_append_sheet(wb, makeSheet(['Payment Method', ...COLS], pmRows), 'By Payment Method');

// 3. Payout Method
const poRows = Object.entries(data.by_payout_method).map(([m, d]) => [m, ...vals(d)]);
XLSX.utils.book_append_sheet(wb, makeSheet(['Payout Method', ...COLS], poRows), 'By Payout Method');

// 4. Send Currency
const scRows = Object.entries(data.by_send_currency).map(([c, d]) => [c, ...vals(d)]);
XLSX.utils.book_append_sheet(wb, makeSheet(['Send Currency', ...COLS], scRows), 'By Send Currency');

// 5. Payout Currency
const pcRows = Object.entries(data.by_payout_currency || {}).map(([c, d]) => [c, ...vals(d)]);
XLSX.utils.book_append_sheet(wb, makeSheet(['Payout Currency', ...COLS], pcRows), 'By Payout Currency');

// 6. Corridors 30d
const c30Rows = Object.entries(data.corridor_pairs || {}).map(([c, d]) => [c, d.send || '', d.payout || '', ...vals(d)]);
XLSX.utils.book_append_sheet(wb, makeSheet(['Corridor', 'Send', 'Payout', ...COLS], c30Rows), 'Corridors 30d');

// 7. Corridors 90d
const c90Rows = Object.entries(data.corridor_pairs_90d || {}).map(([c, d]) => [c, d.send || '', d.payout || '', ...vals(d)]);
XLSX.utils.book_append_sheet(wb, makeSheet(['Corridor', 'Send', 'Payout', ...COLS], c90Rows), 'Corridors 90d');

// 8. Regions
const regRows = Object.entries(data.regions || {}).flatMap(([reg, corridors]) =>
  Object.entries(corridors).map(([c, d]) => [reg, c, ...vals(d)])
);
XLSX.utils.book_append_sheet(wb, makeSheet(['Region', 'Corridor', ...COLS], regRows), 'Regions');

// 9. Payment Method × Corridor
const mxcRows = Object.entries(data.payment_method_x_corridor_pairs || {}).flatMap(([method, corridors]) =>
  Object.entries(corridors).map(([c, d]) => [method, c, ...vals(d)])
);
XLSX.utils.book_append_sheet(wb, makeSheet(['Payment Method', 'Corridor', ...COLS], mxcRows), 'Method x Corridor');

const outFile = path.join(outDir, 'payment-speed.xlsx');
XLSX.writeFile(wb, outFile);

const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log(`✓ Exported portal/exports/payment-speed.xlsx (${kb} KB, ${wb.SheetNames.length} tabs)`);
console.log(`  Tabs: ${wb.SheetNames.join(', ')}`);

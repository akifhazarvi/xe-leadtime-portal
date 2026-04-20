#!/usr/bin/env node
// Build Remitly recipient-requirements HTML for USD + GBP corridors.
// Inputs: two bootstrap audit JSON files (USA session + GBR session).
// Output: HTML dashboard with per-corridor comparison.

const fs = require('fs');
const path = require('path');

const USA_FILE = process.argv[2];
const GBR_FILE = process.argv[3];
const OUT = process.argv[4] || '/Users/akif.hazarvi/Xe-AI-Projects/xe-analytics-intelligence/remitly-recipient-requirements-usd-gbp.html';

if (!USA_FILE || !GBR_FILE) {
  console.error('Usage: node build-remitly-recipient-analysis.js <usa.json> <gbr.json> [out.html]');
  process.exit(1);
}

console.log('Loading USA bootstrap…');
const usa = JSON.parse(fs.readFileSync(USA_FILE, 'utf8'));
console.log('Loading GBR bootstrap…');
const gbr = JSON.parse(fs.readFileSync(GBR_FILE, 'utf8'));

// Top 20 corridors by remittance volume / strategic importance
const TOP_TARGETS = [
  { code: 'IND', name: 'India 🇮🇳' },
  { code: 'MEX', name: 'Mexico 🇲🇽' },
  { code: 'PHL', name: 'Philippines 🇵🇭' },
  { code: 'PAK', name: 'Pakistan 🇵🇰' },
  { code: 'NGA', name: 'Nigeria 🇳🇬' },
  { code: 'BGD', name: 'Bangladesh 🇧🇩' },
  { code: 'NPL', name: 'Nepal 🇳🇵' },
  { code: 'VNM', name: 'Vietnam 🇻🇳' },
  { code: 'LKA', name: 'Sri Lanka 🇱🇰' },
  { code: 'KEN', name: 'Kenya 🇰🇪' },
  { code: 'ETH', name: 'Ethiopia 🇪🇹' },
  { code: 'EGY', name: 'Egypt 🇪🇬' },
  { code: 'COL', name: 'Colombia 🇨🇴' },
  { code: 'GTM', name: 'Guatemala 🇬🇹' },
  { code: 'DOM', name: 'Dominican Republic 🇩🇴' },
  { code: 'BRA', name: 'Brazil 🇧🇷' },
  { code: 'ZAF', name: 'South Africa 🇿🇦' },
  { code: 'CHN', name: 'China 🇨🇳' },
  { code: 'IDN', name: 'Indonesia 🇮🇩' },
  { code: 'JPN', name: 'Japan 🇯🇵' },
];

// Extract a compact "recipient profile" for a corridor
const profile = (data) => {
  if (!data) return null;
  const cc = data.corridor_config || {};
  const f = cc.features || {};
  const d = cc.data || {};
  const dests = data.destinations || [];
  const byType = {};
  for (const dx of dests) {
    byType[dx.destination_type] = byType[dx.destination_type] || [];
    byType[dx.destination_type].push(dx);
  }
  const summarizeType = (type, max = 5) => {
    const list = byType[type] || [];
    return {
      count: list.length,
      topNames: list.slice(0, max).map(x => x.name),
      accountTypes: [...new Set(list.map(x => x.destination_account_type).filter(Boolean))],
    };
  };
  // Pick a representative bank destination to show account format rules
  const sampleBank = (byType.BANK_DEPOSIT || [])[0];
  const sampleBankRegex = sampleBank?.attributes?.ACCOUNT_NUMBER?.validators?.[0]?.regex;
  const sampleBankField = sampleBank?.configuration?.recipient_account_config?.recipient_account_form_config?.recipient_account_form_label;
  const sampleBankExample = sampleBank?.configuration?.recipient_account_config?.account_number_placeholder;
  const sampleBankBranch = sampleBank?.configuration?.branch_code_required
    ? sampleBank?.configuration?.branch_code_type || 'required'
    : 'not required';

  return {
    destinationCount: dests.length,
    bankDeposit: summarizeType('BANK_DEPOSIT'),
    cashPickup: summarizeType('CASH_PICKUP'),
    directToPhone: summarizeType('DIRECT_TO_PHONE'),
    pushToCard: summarizeType('PUSH_TO_CARD'),
    other: Object.keys(byType).filter(t => !['BANK_DEPOSIT','CASH_PICKUP','DIRECT_TO_PHONE','PUSH_TO_CARD'].includes(t)),
    // Corridor-level recipient rules
    middleName: f.collect_receiver_middle_name ? 'Required' : 'Not collected',
    secondLastName: f.collect_receiver_second_last_name ? 'Required' : 'Not collected',
    sendReason: f.collect_send_reason ? 'Required' : 'Not collected',
    reasonOptions: Object.entries(d.reasons_for_sending || {}).map(([k, v]) => ({ code: k, label: v.message })),
    defaultReason: d.default_reason_for_sending,
    mobileOnly: f.recipient_mobile_phone_only,
    dateFormat: f.date_collection_format,
    supportedBankTypes: f.supported_bank_types || [],
    supportedCards: f.supported_payment_cards || [],
    lastNameFirst: cc.display?.last_name_first,
    cashPickupLocations: d.cash_pickup_locations,
    // Sample bank account format
    sampleBank: sampleBank ? {
      name: sampleBank.name,
      accountField: sampleBankField,
      example: sampleBankExample,
      regex: sampleBankRegex,
      branchCode: sampleBankBranch,
      accountType: sampleBank.destination_account_type,
    } : null,
  };
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const sourceSummary = (bootstrap, label) => {
  const dests = Object.values(bootstrap.results).flatMap(r => r.destinations || []);
  const byType = dests.reduce((a, d) => { a[d.destination_type] = (a[d.destination_type] || 0) + 1; return a; }, {});
  return { label, corridors: Object.keys(bootstrap.results).length, total: dests.length, byType };
};
const usaSummary = sourceSummary(usa, 'USA (USD)');
const gbrSummary = sourceSummary(gbr, 'GBR (GBP)');

// Render
const renderProfile = (p) => {
  if (!p) return '<p><em>Not available</em></p>';
  const reasonList = p.reasonOptions.length
    ? p.reasonOptions.map(r => `<code>${esc(r.code)}</code> ${esc(r.label)}`).join(', ')
    : '—';
  return `
    <table>
      <tr><th colspan="2" style="background:#00754a;color:white;">Destinations (${p.destinationCount})</th></tr>
      <tr><td>Bank deposit</td><td><strong>${p.bankDeposit.count}</strong> ${p.bankDeposit.topNames.length ? '— e.g. ' + esc(p.bankDeposit.topNames.slice(0,3).join(', ')) : ''}</td></tr>
      <tr><td>Cash pickup</td><td><strong>${p.cashPickup.count}</strong> ${p.cashPickup.topNames.length ? '— e.g. ' + esc(p.cashPickup.topNames.slice(0,3).join(', ')) : ''}</td></tr>
      <tr><td>Mobile wallet (direct to phone)</td><td><strong>${p.directToPhone.count}</strong> ${p.directToPhone.topNames.length ? '— e.g. ' + esc(p.directToPhone.topNames.slice(0,3).join(', ')) : ''}</td></tr>
      <tr><td>Push to card</td><td><strong>${p.pushToCard.count}</strong> ${p.pushToCard.topNames.length ? '— e.g. ' + esc(p.pushToCard.topNames.slice(0,3).join(', ')) : ''}</td></tr>
      ${p.other.length ? `<tr><td>Other rails</td><td>${p.other.map(esc).join(', ')}</td></tr>` : ''}
      <tr><th colspan="2" style="background:#00754a;color:white;">Recipient rules</th></tr>
      <tr><td>Middle name</td><td>${esc(p.middleName)}</td></tr>
      <tr><td>Second last name</td><td>${esc(p.secondLastName)}</td></tr>
      <tr><td>Last name first?</td><td>${p.lastNameFirst ? 'Yes' : 'No'}</td></tr>
      <tr><td>Date format</td><td>${esc(p.dateFormat)}</td></tr>
      <tr><td>Mobile-only phone?</td><td>${p.mobileOnly ? 'Yes' : 'No'}</td></tr>
      <tr><td>Send reason</td><td>${esc(p.sendReason)} ${p.defaultReason ? `(default <code>${esc(p.defaultReason)}</code>)` : ''}</td></tr>
      <tr><td>Reason options</td><td style="font-size:12px;">${reasonList}</td></tr>
      <tr><td>Supported bank types</td><td>${p.supportedBankTypes.map(esc).join(', ') || '—'}</td></tr>
      <tr><td>Supported cards</td><td>${p.supportedCards.map(esc).join(', ') || '—'}</td></tr>
      ${p.cashPickupLocations ? `<tr><td>Cash pickup locations</td><td>${p.cashPickupLocations.toLocaleString()}</td></tr>` : ''}
      ${p.sampleBank ? `
      <tr><th colspan="2" style="background:#00754a;color:white;">Sample bank account format (${esc(p.sampleBank.name)})</th></tr>
      <tr><td>Field label</td><td>${esc(p.sampleBank.accountField)}</td></tr>
      <tr><td>Example / placeholder</td><td><code>${esc(p.sampleBank.example)}</code></td></tr>
      <tr><td>Validation regex</td><td><code style="font-size:11px;">${esc(p.sampleBank.regex || '—')}</code></td></tr>
      <tr><td>Branch code</td><td>${esc(p.sampleBank.branchCode)}</td></tr>
      <tr><td>Account type</td><td>${esc(p.sampleBank.accountType)}</td></tr>
      ` : ''}
    </table>
  `;
};

const renderCorridor = (t) => {
  const usaP = profile(usa.results[`USA-${t.code}`]);
  const gbrP = profile(gbr.results[`GBR-${t.code}`]);
  return `
    <h2>${t.name}</h2>
    <div class="vs-grid">
      <div class="vs-card">
        <h3>🇺🇸 USD → ${t.code}</h3>
        ${renderProfile(usaP)}
      </div>
      <div class="vs-card">
        <h3>🇬🇧 GBP → ${t.code}</h3>
        ${renderProfile(gbrP)}
      </div>
    </div>
  `;
};

const findings = [];
// Compute some cross-corridor findings
for (const t of TOP_TARGETS) {
  const u = usa.results[`USA-${t.code}`];
  const g = gbr.results[`GBR-${t.code}`];
  if (!u || !g) continue;
  const ud = u.destinations?.length || 0;
  const gd = g.destinations?.length || 0;
  if (Math.abs(gd - ud) > ud * 0.3 && ud + gd > 20) {
    findings.push(`<li>${t.name}: ${gd > ud ? 'GBP' : 'USD'} has significantly more destinations (${gd} vs ${ud})</li>`);
  }
  const uc = u.corridor_config?.features || {};
  const gc = g.corridor_config?.features || {};
  if (uc.collect_send_reason !== gc.collect_send_reason) {
    findings.push(`<li>${t.name}: reason-for-sending rule differs — USD ${uc.collect_send_reason ? 'requires' : 'skips'}, GBP ${gc.collect_send_reason ? 'requires' : 'skips'}</li>`);
  }
  if (uc.collect_receiver_middle_name !== gc.collect_receiver_middle_name) {
    findings.push(`<li>${t.name}: middle name differs — USD ${uc.collect_receiver_middle_name ? 'required' : 'not'}, GBP ${gc.collect_receiver_middle_name ? 'required' : 'not'}</li>`);
  }
}

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Remitly Recipient Requirements — USD & GBP Corridors</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1200px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 28px; border-bottom: 3px solid #00754a; padding-bottom: 12px; }
  h2 { font-size: 22px; margin-top: 48px; color: #00754a; border-top: 1px solid #eee; padding-top: 24px; }
  h3 { font-size: 16px; margin-top: 0; color: #333; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th { background: #f0f4f3; text-align: left; padding: 6px 10px; border: 1px solid #ddd; font-size: 12px; }
  td { padding: 6px 10px; border: 1px solid #ddd; font-size: 12px; vertical-align: top; }
  tr:nth-child(even) { background: #fafafa; }
  code { font-family: 'SF Mono', Menlo, monospace; font-size: 11px; background: #f5f5f5; padding: 1px 4px; border-radius: 3px; }
  .vs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }
  .vs-card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; background: #fff; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
  .summary-card { background: #f0f4f3; border-left: 4px solid #00754a; padding: 16px; border-radius: 0 8px 8px 0; }
  .summary-card h3 { color: #00754a; margin: 0 0 8px 0; }
  .metric { font-size: 28px; font-weight: 700; color: #00754a; }
  .toc { background: #fafafa; border-left: 4px solid #ccc; padding: 12px 20px; border-radius: 0 8px 8px 0; }
  .toc a { color: #00754a; text-decoration: none; margin-right: 12px; font-size: 13px; }
  .toc a:hover { text-decoration: underline; }
  .finding { background: #fff8e1; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 12px 0; border-radius: 0 8px 8px 0; }
  .finding ul { margin: 4px 0 0 20px; padding: 0; font-size: 13px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
</style>
</head>
<body>

<h1>Remitly Recipient Requirements — USD &amp; GBP Corridors</h1>
<p class="meta">Generated ${new Date().toISOString().slice(0,10)} · Source: <code>/v28/bootstrap</code> · Top 20 receive markets</p>

<div class="summary-grid">
  <div class="summary-card">
    <h3>🇺🇸 USA source (USD)</h3>
    <div class="metric">${usaSummary.total.toLocaleString()}</div>
    <div>destinations across ${usaSummary.corridors} corridors</div>
    <div style="font-size:12px; margin-top:8px;">
      BANK_DEPOSIT: ${usaSummary.byType.BANK_DEPOSIT || 0} ·
      CASH_PICKUP: ${usaSummary.byType.CASH_PICKUP || 0} ·
      DIRECT_TO_PHONE: ${usaSummary.byType.DIRECT_TO_PHONE || 0} ·
      PUSH_TO_CARD: ${usaSummary.byType.PUSH_TO_CARD || 0} ·
      CRYPTO: ${usaSummary.byType.CRYPTO || 0}
    </div>
  </div>
  <div class="summary-card">
    <h3>🇬🇧 GBR source (GBP)</h3>
    <div class="metric">${gbrSummary.total.toLocaleString()}</div>
    <div>destinations across ${gbrSummary.corridors} corridors</div>
    <div style="font-size:12px; margin-top:8px;">
      BANK_DEPOSIT: ${gbrSummary.byType.BANK_DEPOSIT || 0} ·
      CASH_PICKUP: ${gbrSummary.byType.CASH_PICKUP || 0} ·
      DIRECT_TO_PHONE: ${gbrSummary.byType.DIRECT_TO_PHONE || 0} ·
      PUSH_TO_CARD: ${gbrSummary.byType.PUSH_TO_CARD || 0} ·
      CRYPTO: ${gbrSummary.byType.CRYPTO || 0}
    </div>
  </div>
</div>

${findings.length ? `
<div class="finding">
  <strong>USD vs GBP differences worth noting:</strong>
  <ul>${findings.join('')}</ul>
</div>
` : ''}

<div class="toc">
  <strong>Jump to:</strong>
  ${TOP_TARGETS.map(t => `<a href="#${t.code}">${t.code}</a>`).join(' ')}
</div>

${TOP_TARGETS.map(t => `<a id="${t.code}"></a>${renderCorridor(t)}`).join('\n')}

</body>
</html>`;

fs.writeFileSync(OUT, html);
const sizeKB = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`\n✓ Wrote ${OUT} (${sizeKB} KB)`);
console.log(`  Open in browser: file://${OUT}`);

#!/usr/bin/env node
// Analyze recipient-requirement gaps: Xe vs Wise vs Remitly.
// Outputs portal/data/recipient-gap-analysis.json for use by the portal page.

const fs = require('fs');

const xe = JSON.parse(fs.readFileSync('portal/data/recipient-requirements.json'));
const wise = JSON.parse(fs.readFileSync('portal/data/wise-normalized.json'));
const rem = JSON.parse(fs.readFileSync('portal/data/remitly-normalized.json'));
const countryNames = JSON.parse(fs.readFileSync('portal/data/country-names.json'));

// Normalize field "semantic identity" across providers.
const norm = (label) => (label || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
  .replace(/\b(mobile|cell)\b/g, 'phone')
  .replace(/\b(surname|family name|second last name)\b/g, 'last name')
  .replace(/\bgiven name\b/g, 'first name')
  .replace(/\brecipient\s+/g, '')
  .replace(/\bfull name of the account holder\b/g, 'full name')
  .replace(/\b(account name|name on account)\b/g, 'full name')
  .replace(/\baccount (number|no)\b/g, 'account number')
  .replace(/\b(iban or account number|iban)\b/g, 'account number')
  .replace(/\b(clabe|cbu|cvu|vpa)\b/g, 'account number')
  .replace(/\b(ifsc|swift|bic|sort code|routing number|bsb|transit|ifsc code|branch code)\b/g, 'branch code')
  .replace(/\bnat clear code\b/g, 'branch code')
  .replace(/\b(post(al)? code|zip|zipcode)\b/g, 'postal code')
  .replace(/\b(state|province|region|subdivision)\b/g, 'state')
  .replace(/\b(address line 1|street address|address)\b/g, 'address line 1')
  .replace(/\baddress line 2\b/g, 'address line 2')
  .replace(/\b(city|town)\b/g, 'city')
  .replace(/\bbank address.*\b/g, 'bank address')
  .replace(/\s+/g, ' ').trim();

// Get a unified field list per provider
const extractXeFields = (key) => {
  const corr = xe.corridors[key];
  if (!corr) return null;
  return corr.fields.filter(f => !(xe.meanings[f.id] || {}).hidden).map(f => ({
    norm: norm(f.label), id: f.id, label: f.label, category: f.category, mandatory: f.mandatory,
    hasRegex: !!f.regex, enrichable: !!f.enrichable,
  }));
};
const extractWiseFields = (currency) => {
  const cur = wise.currencies[currency];
  if (!cur) return null;
  const branch = cur.branches[0];
  return branch.fields.map(f => ({
    norm: norm(f.label), id: f.id, label: f.label, category: f.category, mandatory: f.mandatory,
    hasRegex: !!f.regex, enrichable: !!f.refreshOnChange,
  }));
};
const extractRemFields = (iso3) => {
  const entry = rem.byTarget[iso3];
  if (!entry) return null;
  return entry.fields.map(f => ({
    norm: norm(f.label), id: f.id, label: f.label, category: f.category, mandatory: f.mandatory,
    hasRegex: !!f.regex, enrichable: false,
  }));
};

// ISO-3 → ISO-2 for Remitly lookup
const ISO3_TO_ISO2 = Object.fromEntries(
  Object.values(rem.byTarget).map(e => [e.target, e.countryCode])
);

// Build per-country analysis
const byCountry = {};
for (const [key, corr] of Object.entries(xe.corridors)) {
  const iso2 = corr.country;
  const iso3 = Object.entries(ISO3_TO_ISO2).find(([, v]) => v === iso2)?.[0];
  const ccy = corr.currency;
  const xeF = extractXeFields(key);
  const wiseF = extractWiseFields(ccy);
  const remF = iso3 ? extractRemFields(iso3) : null;

  if (!xeF) continue;
  const xeReqSet = new Set(xeF.filter(f => f.mandatory).map(f => f.norm));
  const wiseReqSet = wiseF ? new Set(wiseF.filter(f => f.mandatory).map(f => f.norm)) : null;
  const remReqSet = remF ? new Set(remF.filter(f => f.mandatory).map(f => f.norm)) : null;

  const competitorReq = new Set();
  if (wiseReqSet) wiseReqSet.forEach(k => competitorReq.add(k));
  if (remReqSet) remReqSet.forEach(k => competitorReq.add(k));

  // Fields competitors require but Xe doesn't
  const xeMissing = [...competitorReq].filter(k => !xeReqSet.has(k)).map(k => ({
    norm: k,
    askedByWise: wiseReqSet?.has(k) || false,
    askedByRemitly: remReqSet?.has(k) || false,
    label: (wiseF?.find(f => f.norm === k) || remF?.find(f => f.norm === k))?.label,
  }));

  // Fields Xe requires but no competitor does
  const xeExtra = [...xeReqSet].filter(k => !competitorReq.has(k)).map(k => ({
    norm: k,
    label: xeF.find(f => f.norm === k)?.label,
    category: xeF.find(f => f.norm === k)?.category,
  }));

  // Validation gaps — fields present in Xe but without regex, where competitor has regex
  const validationGaps = [];
  for (const xf of xeF) {
    if (xf.hasRegex) continue;
    const wf = wiseF?.find(f => f.norm === xf.norm && f.hasRegex);
    const rf = remF?.find(f => f.norm === xf.norm && f.hasRegex);
    if (wf || rf) validationGaps.push({
      field: xf.label, norm: xf.norm,
      wiseValidates: !!wf, remitlyValidates: !!rf,
    });
  }

  byCountry[key] = {
    country: iso2,
    countryName: countryNames[iso2] || iso2,
    currency: ccy,
    xeRequired: xeF.filter(f => f.mandatory).length,
    wiseRequired: wiseF ? wiseF.filter(f => f.mandatory).length : null,
    remitlyRequired: remF ? remF.filter(f => f.mandatory).length : null,
    frictionDeltaWise: wiseF ? xeF.filter(f => f.mandatory).length - wiseF.filter(f => f.mandatory).length : null,
    frictionDeltaRemitly: remF ? xeF.filter(f => f.mandatory).length - remF.filter(f => f.mandatory).length : null,
    xeMissing,
    xeExtra,
    validationGaps,
  };
}

// Global insights
const withBoth = Object.values(byCountry).filter(c => c.wiseRequired != null || c.remitlyRequired != null);
const withWise = withBoth.filter(c => c.wiseRequired != null);
const withRem = withBoth.filter(c => c.remitlyRequired != null);
const avgDeltaWise = withWise.reduce((a, c) => a + c.frictionDeltaWise, 0) / withWise.length;
const avgDeltaRem = withRem.reduce((a, c) => a + c.frictionDeltaRemitly, 0) / withRem.length;

// Top corridors where Xe asks most extra
const mostFriction = [...withBoth]
  .map(c => ({...c, maxDelta: Math.max(c.frictionDeltaWise || 0, c.frictionDeltaRemitly || 0)}))
  .sort((a, b) => b.maxDelta - a.maxDelta).slice(0, 15);

const leastFriction = [...withBoth]
  .filter(c => c.wiseRequired != null && c.remitlyRequired != null)
  .map(c => ({...c, maxDelta: Math.max(c.frictionDeltaWise, c.frictionDeltaRemitly)}))
  .sort((a, b) => a.maxDelta - b.maxDelta).slice(0, 10);

// Count field types competitors commonly validate but Xe doesn't
const validationGapCounts = {};
for (const c of Object.values(byCountry)) {
  for (const g of c.validationGaps) {
    validationGapCounts[g.norm] = (validationGapCounts[g.norm] || 0) + 1;
  }
}

// Fields Xe uniformly requires that competitors don't (friction candidates)
const xeExtraCounts = {};
for (const c of Object.values(byCountry)) {
  for (const x of c.xeExtra) {
    xeExtraCounts[x.norm] = (xeExtraCounts[x.norm] || 0) + 1;
  }
}

// Things competitors collect that Xe doesn't
const xeMissingCounts = {};
for (const c of Object.values(byCountry)) {
  for (const x of c.xeMissing) {
    xeMissingCounts[x.norm] = (xeMissingCounts[x.norm] || 0) + 1;
  }
}

const output = {
  meta: {
    generated: new Date().toISOString(),
    countriesAnalyzed: Object.keys(byCountry).length,
    countriesWithWise: withWise.length,
    countriesWithRemitly: withRem.length,
  },
  global: {
    avgFrictionDeltaVsWise: +avgDeltaWise.toFixed(2),
    avgFrictionDeltaVsRemitly: +avgDeltaRem.toFixed(2),
    xeExtraFieldsTop: Object.entries(xeExtraCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([field, count]) => ({ field, count, pctOfCorridors: +(count / withBoth.length * 100).toFixed(0) })),
    xeMissingFieldsTop: Object.entries(xeMissingCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([field, count]) => ({ field, count, pctOfCorridors: +(count / withBoth.length * 100).toFixed(0) })),
    validationGapsTop: Object.entries(validationGapCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([field, count]) => ({ field, count })),
    mostFrictionCorridors: mostFriction.map(c => ({
      country: c.country, countryName: c.countryName, currency: c.currency,
      xeRequired: c.xeRequired, wiseRequired: c.wiseRequired, remitlyRequired: c.remitlyRequired,
      maxDelta: c.maxDelta,
    })),
    parityCorridors: leastFriction.map(c => ({
      country: c.country, countryName: c.countryName, currency: c.currency,
      xeRequired: c.xeRequired, wiseRequired: c.wiseRequired, remitlyRequired: c.remitlyRequired,
    })),
  },
  byCountry,
};

fs.writeFileSync('portal/data/recipient-gap-analysis.json', JSON.stringify(output, null, 2));
console.log('✓ Wrote portal/data/recipient-gap-analysis.json');
console.log(`  ${output.meta.countriesAnalyzed} countries analyzed`);
console.log(`  Avg Xe friction vs Wise: +${output.global.avgFrictionDeltaVsWise} required fields`);
console.log(`  Avg Xe friction vs Remitly: +${output.global.avgFrictionDeltaVsRemitly} required fields`);
console.log(`\nTop Xe extra fields (asked by Xe, not by competitors):`);
output.global.xeExtraFieldsTop.slice(0, 5).forEach(x => console.log(`  ${x.field.padEnd(25)} ${x.count} corridors (${x.pctOfCorridors}%)`));
console.log(`\nTop Xe missing fields (asked by competitors, not by Xe):`);
output.global.xeMissingFieldsTop.slice(0, 5).forEach(x => console.log(`  ${x.field.padEnd(25)} ${x.count} corridors (${x.pctOfCorridors}%)`));

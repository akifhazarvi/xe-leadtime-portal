#!/usr/bin/env node
// Merge Remitly USA bootstrap (full per-target destinations + requirements)
// with the first audit (per-source corridor_config + recipientAddressConfig).
//
// Logic:
//   - destinations are TARGET-dependent (Nigerian bank accepts any source currency)
//     → reuse USA-{target} destinations list for all sources
//   - corridor_config / recipientAddressConfig are source×target specific
//     → pull from first audit per exact (src, dst) pair
//
// Output: merged-recipient-requirements.json
//   { meta, corridors: { "SRC-DST": { destinations, corridor_config, addressConfig } } }

const fs = require('fs');
const path = require('path');

const BOOTSTRAP = process.argv[2];
const FIRST_AUDIT = process.argv[3];
const OUT = process.argv[4] || '/Users/akif.hazarvi/Downloads/remitly-merged-recipient-requirements.json';

if (!BOOTSTRAP || !FIRST_AUDIT) {
  console.error('Usage: node merge-remitly-audits.js <bootstrap.json> <first-audit.json> [out.json]');
  process.exit(1);
}

console.log('Loading bootstrap…');
const boot = JSON.parse(fs.readFileSync(BOOTSTRAP, 'utf8'));
console.log(`  ${Object.keys(boot.results).length} USA corridors, ${boot.meta.totalDestinations} destinations`);

console.log('Loading first audit…');
const first = JSON.parse(fs.readFileSync(FIRST_AUDIT, 'utf8'));
console.log(`  ${Object.keys(first.results).length} corridors, ${first.subdivisions ? Object.keys(first.subdivisions).length : 0} subdivisions`);

// Index bootstrap destinations by target country
const destsByTarget = {};
const configByTarget = {};
for (const [key, r] of Object.entries(boot.results)) {
  const target = key.split('-')[1];
  destsByTarget[target] = r.destinations;
  configByTarget[target] = {
    destination_type_config: r.destination_type_config,
    destination_account_type_configs: r.destination_account_type_configs,
    country_details: r.country_details,
    currency_details: r.currency_details,
  };
}

// Merge
const corridors = {};
let matched = 0, destsOnly = 0, configOnly = 0;

const allKeys = new Set([...Object.keys(first.results), ...Object.keys(boot.results)]);
for (const key of allKeys) {
  const target = key.split('-')[1];
  const firstData = first.results[key];
  const bootData = boot.results[key];
  const destinations = destsByTarget[target] || null;

  const entry = {
    destinations,
    destinationCount: destinations?.length || 0,
    destinations_source: bootData ? 'usa_bootstrap_exact' : (destinations ? 'usa_bootstrap_by_target' : null),
    corridor_config: firstData?.corridorConfig || null,
    recipientAddressConfig: firstData?.recipientAddressConfig || null,
    destination_type_config: configByTarget[target]?.destination_type_config || null,
    destination_account_type_configs: configByTarget[target]?.destination_account_type_configs || null,
    country_details: configByTarget[target]?.country_details || null,
    currency_details: configByTarget[target]?.currency_details || null,
    subdivisions: first.subdivisions?.[target] || null,
  };

  if (firstData && destinations) matched++;
  else if (destinations) destsOnly++;
  else if (firstData) configOnly++;

  corridors[key] = entry;
}

const out = {
  meta: {
    generatedAt: new Date().toISOString(),
    bootstrapSource: path.basename(BOOTSTRAP),
    firstAuditSource: path.basename(FIRST_AUDIT),
    totalCorridors: Object.keys(corridors).length,
    fullyMerged: matched,
    destinationsOnly: destsOnly,
    configOnly: configOnly,
    destinationsByTarget: Object.fromEntries(Object.entries(destsByTarget).map(([k, v]) => [k, v.length])),
  },
  corridors,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const sizeKB = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log(`\n✓ Wrote ${OUT} (${sizeKB} MB)`);
console.log(`  total corridors: ${Object.keys(corridors).length}`);
console.log(`  fully merged (config + destinations): ${matched}`);
console.log(`  destinations only: ${destsOnly}`);
console.log(`  config only: ${configOnly}`);
console.log(`  targets with destinations: ${Object.keys(destsByTarget).length}`);

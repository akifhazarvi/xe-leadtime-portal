#!/usr/bin/env node
// Flatten Wise's JSON Schema recipient-requirements dump into the same shape
// as portal/data/recipient-requirements.json so the UI can render Xe + Wise
// side-by-side.
//
// Input:  portal/data/wise-recipient-requirements.json   (raw from browser audit)
// Output: portal/data/wise-normalized.json

const fs = require('fs');
const path = require('path');

const IN  = path.join(__dirname, '..', 'data', 'wise-recipient-requirements.json');
const OUT = path.join(__dirname, '..', 'data', 'wise-normalized.json');

const raw = JSON.parse(fs.readFileSync(IN, 'utf8'));

// Hidden / metadata fields that Wise embeds as JSON schema props but the user
// never sees or fills. We drop these so the comparison shows real friction only.
const SKIP_IDS = new Set([
  'profileId', 'currency', 'preRefreshCurrencyState', 'legalEntityType',
  'ownedByCustomer', 'type', 'isInternal', 'creatorId', 'isChineseNational',
  'expiryMonth', 'expiryYear', // card subfields — Wise hides these, user enters card #
  'cannotHavePatronymicName', // RU checkbox tied to patronymicName
]);

// Field → UI category. Anything not matched falls to "additional".
const CATEGORY_RULES = [
  { test: /^(fullName|familyName|givenName|patronymicName|dateOfBirth)$/i, cat: 'recipient' },
  { test: /^(country|city|firstLine|postCode|state|postalCode|address)$/i, cat: 'address' },
  { test: /^(taxId|taxNumber|rut|cpf|idDocumentType|idDocumentNumber|identificationNumber|nationalId)$/i, cat: 'id' },
  { test: /^(email|phoneNumber|russiaRegion|interacAccount|cardToken|accountType|identifierType)$/i, cat: 'additional' },
  { test: /^(accountNumber|iban|bic|bankCode|branchCode|sortCode|ifscCode|clabe|abartn|institutionNumber|transitNumber|prefix)$/i, cat: 'bank' },
];

function categorise(fieldId) {
  for (const r of CATEGORY_RULES) if (r.test.test(fieldId)) return r.cat;
  return 'additional';
}

// Walk a JSON-Schema "object" node and emit flat fields.
// `parentRequired` is the set of required keys for THIS object level.
function extractFieldsFromProps(props, required, prefix = '') {
  const out = [];
  const req = new Set(required || []);
  for (const [key, def] of Object.entries(props || {})) {
    if (SKIP_IDS.has(key)) continue;

    // Nested object (e.g., name.fullName, details.*, address.*) → recurse.
    if (def.type === 'object' && def.properties) {
      out.push(...extractFieldsFromProps(def.properties, def.required, key));
      continue;
    }

    // Hidden const fields (server-set) — skip, not user input.
    if (def.hidden && def.const !== undefined) continue;

    // Dropdowns: `oneOf` with simple {title, const} entries = enum.
    const isEnum = Array.isArray(def.oneOf) && def.oneOf.every(o => o.const !== undefined);

    out.push({
      id: key,
      label: def.title || key,
      mandatory: req.has(key),
      type: def.type === 'number' ? 'Number' : 'String',
      category: categorise(key),
      regex: def.pattern || null,
      placeholder: def.placeholder || null,
      help: def.help?.markdown || null,
      example: def.placeholder || null,
      minLength: def.minLength ?? null,
      maxLength: def.maxLength ?? null,
      options: isEnum ? def.oneOf.map(o => ({ label: o.title, value: o.const })) : null,
      optionCount: isEnum ? def.oneOf.length : null,
      control: def.control || null,
      refreshOnChange: !!def.refreshFormOnChange,
      parent: prefix || null, // e.g., "name", "details", "address"
    });
  }
  return out;
}

// A Wise payload for a currency contains `schemas[0].allOf` — usually two blocks:
//   [0] metadata (profileId, currency, legalEntityType, optionally email/dateOfBirth)
//   [1] the "Recipient's bank details" block (type=object OR oneOf[...])
// Some currencies (KRW, ZAR) put email/dateOfBirth in the metadata block — those
// ARE user-input, so we must walk that block too. We de-dupe via SKIP_IDS.
function parseCurrency(currency, payload) {
  const schema = payload.schemas?.[0];
  if (!schema || !Array.isArray(schema.allOf)) return null;

  const country = payload.model?.country || null;
  const branches = [];

  for (const block of schema.allOf) {
    // Single-branch: type:object with properties
    if (block.type === 'object' && block.properties) {
      const fields = extractFieldsFromProps(block.properties, block.required);
      if (fields.length) {
        branches.push({
          name: block.title || 'Default',
          analyticsId: block.analyticsId || null,
          fields,
        });
      }
      continue;
    }

    // Multi-branch: oneOf[{type:object, properties}, ...]
    if (Array.isArray(block.oneOf)) {
      for (const branch of block.oneOf) {
        if (branch.type !== 'object' || !branch.properties) continue;
        const fields = extractFieldsFromProps(branch.properties, branch.required);
        branches.push({
          name: branch.title || branch.analyticsId || 'Unnamed',
          analyticsId: branch.analyticsId || null,
          alert: branch.alert?.markdown || null,
          fields,
        });
      }
    }
  }

  // Merge top-level (metadata) fields (email, dateOfBirth) into every bank-detail branch
  // so each branch shows the COMPLETE user-visible form.
  const topLevelFields = branches[0]?.fields?.filter(f => !f.parent || f.parent === 'name' || f.parent === 'address') || [];
  const metaFields = [];
  for (const block of schema.allOf) {
    if (block.type === 'object' && block.properties) {
      for (const [key, def] of Object.entries(block.properties)) {
        if (SKIP_IDS.has(key)) continue;
        if (def.hidden && def.const !== undefined) continue;
        if (def.type === 'object') continue; // nested handled inside branches
        // These are the top-level user-input fields (email, dateOfBirth for KRW/ZAR)
        if (!['email', 'dateOfBirth'].includes(key)) continue;
        metaFields.push({
          id: key,
          label: def.title || key,
          mandatory: (block.required || []).includes(key),
          type: def.type === 'number' ? 'Number' : 'String',
          category: categorise(key),
          regex: def.pattern || null,
          placeholder: def.placeholder || null,
          help: def.help?.markdown || null,
          example: def.placeholder || null,
          minLength: def.minLength ?? null,
          maxLength: def.maxLength ?? null,
          options: null,
          optionCount: null,
          control: def.control || null,
          refreshOnChange: !!def.refreshFormOnChange,
          parent: null,
          topLevel: true,
        });
      }
    }
  }

  // Prepend metaFields to every branch (only if not already present by id).
  for (const b of branches) {
    for (const mf of metaFields) {
      if (!b.fields.some(f => f.id === mf.id)) b.fields.unshift(mf);
    }
  }

  const defaultBranch = branches[0]?.name || null;

  return {
    currency,
    country,
    defaultBranch,
    branchCount: branches.length,
    branches,
  };
}

// ------------------------------------------------------------------------
const normalized = {
  meta: {
    source: 'wise',
    generated: raw.meta?.timestamp || new Date().toISOString(),
    profileId: raw.meta?.profileId,
    totalQueried: raw.meta?.totalQueried,
    successful: raw.meta?.successful,
    errorCount: raw.meta?.errorCount,
  },
  currencies: {},
  errors: raw.errors || [],
};

for (const [currency, payload] of Object.entries(raw.results || {})) {
  const parsed = parseCurrency(currency, payload);
  if (parsed) normalized.currencies[currency] = parsed;
}

fs.writeFileSync(OUT, JSON.stringify(normalized, null, 2));

// Summary
const currencyCodes = Object.keys(normalized.currencies).sort();
const totalBranches = currencyCodes.reduce((a, c) => a + normalized.currencies[c].branches.length, 0);
const totalFields = currencyCodes.reduce((a, c) =>
  a + normalized.currencies[c].branches.reduce((b, br) => b + br.fields.length, 0), 0);

console.log(`Wrote ${OUT}`);
console.log(`  ${currencyCodes.length} currencies, ${totalBranches} branches, ${totalFields} total fields`);
console.log(`  currencies: ${currencyCodes.join(', ')}`);

// Quick friction diagnostics: how many branches require address fields?
let addrBranches = 0;
for (const c of currencyCodes) {
  for (const b of normalized.currencies[c].branches) {
    if (b.fields.some(f => f.category === 'address' && f.mandatory)) addrBranches++;
  }
}
console.log(`  branches requiring address: ${addrBranches} / ${totalBranches}`);

#!/usr/bin/env node
// Flatten Remitly's corridor-keyed audit dump into the same field shape used
// by Xe (portal/data/recipient-requirements.json) and Wise
// (portal/data/wise-normalized.json) so the UI can render all three side-by-side.
//
// Input:  portal/data/remitly-recipient-requirements.json
// Output: portal/data/remitly-normalized.json
//
// Remitly data is keyed by corridor (SRC-TGT), not currency, because its
// address form and feature flags vary per source country. We preserve that
// keying but emit a flat `fields[]` per corridor mirroring Wise's branch shape.

const fs = require('fs');
const path = require('path');

const IN  = path.join(__dirname, '..', 'data', 'remitly-recipient-requirements.json');
const OUT = path.join(__dirname, '..', 'data', 'remitly-normalized.json');

const raw = JSON.parse(fs.readFileSync(IN, 'utf8'));

// Remitly address-field type → portal field id + category (aligned with Xe ids)
const ADDR_TYPE_MAP = {
  street1:     { id: 'ADDRESS_LINE1',  category: 'address' },
  street2:     { id: 'ADDRESS_LINE2',  category: 'address' },
  city:        { id: 'CITY',           category: 'address' },
  subdivision: { id: 'STATE',          category: 'address' },
  postal:      { id: 'POSTAL_CODE',    category: 'address' },
  country:     { id: 'COUNTRY',        category: 'address' },
  district:    { id: 'DISTRICT',       category: 'address' },
};

function inferSourceCurrency(alpha3) {
  const m = {
    USA: 'USD', GBR: 'GBP', CAN: 'CAD', AUS: 'AUD', NZL: 'NZD',
    SGP: 'SGD', HKG: 'HKD', JPN: 'JPY', KOR: 'KRW', CHE: 'CHF',
    SWE: 'SEK', NOR: 'NOK', DNK: 'DKK', POL: 'PLN',
  };
  if (m[alpha3]) return m[alpha3];
  const eur = ['AUT','BEL','CYP','EST','FIN','FRA','DEU','GRC','IRL','ITA','LVA','LTU','LUX','MLT','NLD','PRT','SVK','SVN','ESP','HRV'];
  if (eur.includes(alpha3)) return 'EUR';
  return 'USD';
}

// Build address fields from recipientAddressConfig.fieldConfigs[]
function buildAddressFields(addrCfg) {
  if (!addrCfg || !Array.isArray(addrCfg.fieldConfigs)) return [];
  return addrCfg.fieldConfigs.map(fc => {
    const mapped = ADDR_TYPE_MAP[fc.type] || { id: fc.type.toUpperCase(), category: 'address' };
    const regex = fc.validators?.[0]?.regex || null;
    return {
      id: mapped.id,
      label: fc.label || mapped.id,
      mandatory: !!fc.required,
      type: fc.fieldType === 'numeric' ? 'Number' : 'String',
      category: mapped.category,
      regex,
      example: fc.example || null,
      validatorMessage: fc.validators?.[0]?.message || null,
      source: 'addressConfig',
    };
  });
}

// Build recipient-name fields from destinationRecipientConfig.recipientNameConfig (when present)
// and from corridorConfig.features (middle name / second last name flags) as fallback.
function buildNameFields(destCfg, features) {
  const fields = [];
  const nc = destCfg?.recipientNameConfig;

  // First + Last are always required whenever Remitly collects recipient name.
  // If destCfg absent, we still assume these two (every Remitly corridor collects a name).
  fields.push({
    id: 'FIRST_NAME',
    label: nc?.firstNameLabel || 'First name',
    mandatory: true,
    type: 'String',
    category: 'recipient',
    regex: null,
    example: nc?.firstNamePlaceholder || null,
    source: destCfg ? 'destinationConfig' : 'inferred',
  });
  fields.push({
    id: 'LAST_NAME',
    label: nc?.lastNameLabel || 'Last name',
    mandatory: true,
    type: 'String',
    category: 'recipient',
    regex: null,
    example: nc?.lastNamePlaceholder || null,
    source: destCfg ? 'destinationConfig' : 'inferred',
  });

  // Middle name — prefer explicit nameConfig flag, fall back to corridorConfig.features
  const collectMiddle = nc ? nc.collectMiddleName : !!features?.collect_receiver_middle_name;
  if (collectMiddle) {
    fields.push({
      id: 'MIDDLE_NAME',
      label: nc?.middleNameLabel || 'Middle name',
      mandatory: !!nc?.middleNameRequired,
      type: 'String',
      category: 'recipient',
      regex: null,
      example: nc?.middleNamePlaceHolder || null,
      source: nc ? 'destinationConfig' : 'featureFlag',
    });
  }

  // Second last name (common in LATAM corridors)
  const collectSecond = nc ? nc.collectSecondLastName : !!features?.collect_receiver_second_last_name;
  if (collectSecond) {
    fields.push({
      id: 'SECOND_LAST_NAME',
      label: nc?.secondLastNameLabel || 'Second last name',
      mandatory: !!nc?.secondLastNameRequired,
      type: 'String',
      category: 'recipient',
      regex: null,
      example: nc?.secondLastNamePlaceholder || null,
      source: nc ? 'destinationConfig' : 'featureFlag',
    });
  }

  return fields;
}

// Build extra fields inferred from corridorConfig.features: phone, send reason, etc.
function buildFeatureFields(destCfg, features) {
  const fields = [];
  if (!features) return fields;

  if (features.recipient_mobile_phone_only) {
    fields.push({
      id: 'PHONE',
      label: 'Recipient mobile phone',
      mandatory: true,
      type: 'String',
      category: 'additional',
      regex: null,
      example: null,
      source: 'featureFlag',
      note: destCfg?.acceptInternationalPhoneNumber ? 'International format accepted' : null,
    });
  }

  // Reason for sending — prefer destCfg.reasonForSendingConfig when present
  const reasonCfg = destCfg?.reasonForSendingConfig;
  const collectReason = reasonCfg ? reasonCfg.collect : !!features.collect_send_reason;
  if (collectReason) {
    fields.push({
      id: 'REASON',
      label: 'Reason for sending',
      mandatory: true,
      type: 'String',
      category: 'additional',
      regex: null,
      example: null,
      options: reasonCfg?.reasons?.length ? reasonCfg.reasons.map(r => ({ label: r.value, value: r.key })) : null,
      optionCount: reasonCfg?.reasons?.length || null,
      source: reasonCfg ? 'destinationConfig' : 'featureFlag',
    });
  }

  return fields;
}

// Build bank-account fields from destinationRecipientConfig.recipientAccountConfig (when captured).
// Most corridors return null here because we only have destinationRecipientConfigId for 2 so far.
function buildAccountFields(destCfg) {
  const ac = destCfg?.recipientAccountConfig;
  if (!ac) return [];
  const fields = [];
  const inputConfigs = ac.inputConfigsPerType || [];
  // inputConfigsPerType is an array of {key: accountType, value: {name, label, placeholder, validator, ...}}
  // Emit one field per unique account-type-specific input, tagging with accountType in note.
  for (const entry of inputConfigs) {
    const acctType = entry.key;
    const v = entry.value;
    if (!v) continue;
    fields.push({
      id: (v.name || 'ACCOUNT_FIELD').toUpperCase(),
      label: v.label || v.name || 'Account field',
      mandatory: true,
      type: 'String',
      category: 'bank',
      regex: v.validator || null,
      example: v.example || null,
      placeholder: v.placeholder || null,
      source: 'destinationConfig',
      note: `account type: ${acctType}`,
    });
  }
  return fields;
}

function normalizeCorridor(key, rec) {
  const [source, target] = key.split('-');
  const features = rec.corridorConfig?.features || null;
  const destCfg = rec.destinationRecipientConfig || null;

  const fields = [
    ...buildNameFields(destCfg, features),
    ...buildAddressFields(rec.recipientAddressConfig),
    ...buildAccountFields(destCfg),
    ...buildFeatureFields(destCfg, features),
  ];

  // Capture the subset of feature flags that materially affect the form.
  const flagsOfInterest = {};
  if (features) {
    const keys = [
      'collect_receiver_middle_name',
      'collect_receiver_second_last_name',
      'collect_send_reason',
      'collect_sender_middle_name',
      'collect_sender_ssn',
      'recipient_mobile_phone_only',
      'recipient_notifications_required',
      'recipient_address_autocomplete',
      'sender_address_autocomplete',
      'bank_verification_enabled',
      'date_collection_format',
    ];
    for (const k of keys) if (k in features) flagsOfInterest[k] = features[k];
  }

  return {
    source,
    target,
    sourceCurrency: inferSourceCurrency(source),
    fields,
    features: flagsOfInterest,
    supportedPaymentCards: features?.supported_payment_cards || null,
    supportedBankTypes: features?.supported_bank_types || null,
    hasDestinationRecipientConfig: !!destCfg,
  };
}

// ------------------------------------------------------------------------
const normalized = {
  meta: {
    source: 'remitly',
    generated: raw.meta?.timestamp || new Date().toISOString(),
    sendAmount: raw.meta?.sendAmount,
    sendCountries: raw.meta?.sendCountries,
    receiveCountriesCount: raw.meta?.receiveCountriesCount,
    corridorsQueried: raw.meta?.corridorsQueried,
    successful: raw.meta?.successful,
    errorCount: raw.meta?.errorCount,
  },
  corridors: {},
  subdivisions: raw.subdivisions || {},
  errors: raw.errors || [],
};

for (const [key, rec] of Object.entries(raw.results || {})) {
  normalized.corridors[key] = normalizeCorridor(key, rec);
}

fs.writeFileSync(OUT, JSON.stringify(normalized, null, 2));

// ---- Summary --------------------------------------------------------
const keys = Object.keys(normalized.corridors);
const totalFields = keys.reduce((a, k) => a + normalized.corridors[k].fields.length, 0);
const avgFields = keys.length ? (totalFields / keys.length).toFixed(1) : 0;
const requiredFields = keys.reduce((a, k) => a + normalized.corridors[k].fields.filter(f => f.mandatory).length, 0);
const avgRequired = keys.length ? (requiredFields / keys.length).toFixed(1) : 0;
const withDestCfg = keys.filter(k => normalized.corridors[k].hasDestinationRecipientConfig).length;
const withMiddle = keys.filter(k => normalized.corridors[k].fields.some(f => f.id === 'MIDDLE_NAME')).length;
const withSecondLast = keys.filter(k => normalized.corridors[k].fields.some(f => f.id === 'SECOND_LAST_NAME')).length;
const withPhone = keys.filter(k => normalized.corridors[k].fields.some(f => f.id === 'PHONE')).length;
const withReason = keys.filter(k => normalized.corridors[k].fields.some(f => f.id === 'REASON')).length;
const withAddrRequired = keys.filter(k => normalized.corridors[k].fields.some(f => f.category === 'address' && f.mandatory)).length;

console.log(`Wrote ${OUT}`);
console.log(`  corridors: ${keys.length}`);
console.log(`  avg fields / corridor: ${avgFields}  (avg required: ${avgRequired})`);
console.log(`  corridors with full DestinationRecipientConfig: ${withDestCfg}`);
console.log(`  corridors collecting middle name:      ${withMiddle}`);
console.log(`  corridors collecting second last name: ${withSecondLast}`);
console.log(`  corridors requiring phone:             ${withPhone}`);
console.log(`  corridors requiring send reason:       ${withReason}`);
console.log(`  corridors requiring ANY address field: ${withAddrRequired}`);

// Reads raw audit.json + field-meanings.json → writes portal/data/recipient-requirements.json
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'portal/data/recipient-fields-raw/audit.json'), 'utf8'));
const meanings = JSON.parse(fs.readFileSync(path.join(ROOT, 'portal/data/field-meanings.json'), 'utf8'));

// Fields excluded from display (system-only or always-optional metadata)
const HIDDEN_GROUPS = new Set(['GRP_INTERMEDIARY_DETAILS']);
const HIDDEN_IDS = new Set(['IS_BUSINESS', 'ADDRESS_COUNTRY_CODE']);
const HIDDEN_TYPES = new Set(['PaymentCountry']);

const groupCategory = (g) => ({
  GRP_RECIPIENT_DETAILS: 'recipient',
  GRP_BANK_DETAILS: 'bank',
  GRP_ADDITIONAL_DETAILS: 'additional',
}[g] || 'additional');

const addressIds = new Set(['ADDRESS_LINE1','ADDRESS_LINE2','RECIPIENT_CITY','RECIPIENT_STATE','RECIPIENT_POST_CODE']);
const idIds = new Set(['RECIPIENT_ID_NUMBER','ID_NUMBER_TYPE_CODE','RECIPIENT_TAX_NUMBER']);

const categorize = (field) => {
  if (addressIds.has(field.id)) return 'address';
  if (idIds.has(field.id)) return 'id';
  return groupCategory(field.group);
};

const visibleField = (f) => {
  if (HIDDEN_IDS.has(f.id)) return false;
  if (HIDDEN_GROUPS.has(f.group)) return false;
  if (HIDDEN_TYPES.has(f.type)) return false;
  return true;
};

const corridors = {};
for (const [key, resp] of Object.entries(raw.results)) {
  const [country, currency] = key.split('_');
  const fields = [];
  const walk = (arr) => {
    for (const f of (arr || [])) {
      if (!visibleField(f)) continue;
      const entry = {
        id: f.id,
        label: f.displayName?.text || f.id,
        mandatory: !!f.mandatory,
        type: f.type,
        category: categorize(f),
        regex: f.validation?.regex || null,
        tip: f.tip || null,
        enrichable: !!(f.onChangeCanSubmitForEnrichment || f.onChangeCanSubmitForValidation),
      };
      if (f.type === 'Selection' && f.validation?.values) {
        entry.options = f.validation.values.map(v => ({ id: v.id, label: v.description }));
      }
      if (f.children && f.children.length) {
        entry.children = [];
        for (const c of f.children) {
          if (!visibleField(c)) continue;
          entry.children.push({
            id: c.id,
            label: c.displayName?.text || c.id,
            mandatory: !!c.mandatory,
            regex: c.validation?.regex || null,
            tip: c.tip || null,
          });
        }
      }
      fields.push(entry);
    }
  };
  walk(resp.fieldDefinitions);

  corridors[key] = {
    country,
    currency,
    fields,
    mandatoryCount: fields.filter(f => f.mandatory).length,
    optionalCount: fields.filter(f => !f.mandatory).length,
  };
}

const out = {
  meta: { generated: new Date().toISOString(), corridorCount: Object.keys(corridors).length },
  meanings,
  corridors,
};
fs.writeFileSync(path.join(ROOT, 'portal/data/recipient-requirements.json'), JSON.stringify(out, null, 2));
console.log(`wrote ${Object.keys(corridors).length} corridors`);

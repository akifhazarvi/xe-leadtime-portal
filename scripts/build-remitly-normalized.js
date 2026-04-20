#!/usr/bin/env node
// Build a normalized Remitly recipient-requirements feed keyed by TARGET country (ISO-3).
// Send currency is not distinguishable at the target level — Remitly's recipient
// requirements are a function of the destination (bank account type, regex, reasons,
// name rules), not the source.
//
// Schema (matches Xe/Wise shape where practical):
//   {
//     meta: {...},
//     byTarget: {
//       "IND": {
//         target: "IND", countryCode: "IN", receiveCurrency: "INR",
//         destinationCount, destinationTypes, topInstitutions,
//         fields: [{id, label, mandatory, type, category, regex, example, placeholder, help, minLength, maxLength, optionCount, options}],
//         sampleBank: {...},
//         reasonForSending: {collect, default, options},
//         nameConfig, dateFormat, mobileOnly, supportedBankTypes, supportedCards,
//       }
//     }
//   }

const fs = require('fs');

const USA_FILE = process.argv[2];
const GBR_FILE = process.argv[3];
const OUT = process.argv[4] || '/Users/akif.hazarvi/Xe-AI-Projects/xe-analytics-intelligence/portal/data/remitly-normalized.json';

if (!USA_FILE || !GBR_FILE) {
  console.error('Usage: node build-remitly-normalized.js <usa-bootstrap.json> <gbr-bootstrap.json> [out.json]');
  process.exit(1);
}

// ISO-3 → ISO-2 for the 128 target countries (plus a few sources). Kept inline
// to avoid a runtime dep.
const ISO3_TO_ISO2 = {
  AFG:'AF',ALB:'AL',DZA:'DZ',ARG:'AR',ARM:'AM',AUS:'AU',AUT:'AT',AZE:'AZ',
  BGD:'BD',BHR:'BH',BHS:'BS',BEL:'BE',BLR:'BY',BOL:'BO',BWA:'BW',BRA:'BR',
  BRB:'BB',BGR:'BG',KHM:'KH',CMR:'CM',CAN:'CA',CHE:'CH',CHL:'CL',CHN:'CN',
  CIV:'CI',COL:'CO',CRI:'CR',CUB:'CU',CYP:'CY',CZE:'CZ',DNK:'DK',DEU:'DE',
  DOM:'DO',ECU:'EC',EGY:'EG',SLV:'SV',EST:'EE',ETH:'ET',FJI:'FJ',FIN:'FI',
  FRA:'FR',GEO:'GE',GHA:'GH',GRC:'GR',GTM:'GT',HTI:'HT',HND:'HN',HKG:'HK',
  HUN:'HU',ISL:'IS',IND:'IN',IDN:'ID',IRQ:'IQ',IRL:'IE',ISR:'IL',ITA:'IT',
  JAM:'JM',JPN:'JP',JOR:'JO',KAZ:'KZ',KEN:'KE',KOR:'KR',KWT:'KW',KGZ:'KG',
  LAO:'LA',LVA:'LV',LBN:'LB',LTU:'LT',LUX:'LU',MDG:'MG',MWI:'MW',MYS:'MY',
  MLT:'MT',MUS:'MU',MEX:'MX',MDA:'MD',MNG:'MN',MAR:'MA',MMR:'MM',NPL:'NP',
  NLD:'NL',NZL:'NZ',NIC:'NI',NGA:'NG',NOR:'NO',OMN:'OM',PAK:'PK',PAN:'PA',
  PNG:'PG',PRY:'PY',PER:'PE',PHL:'PH',POL:'PL',PRT:'PT',QAT:'QA',ROU:'RO',
  RUS:'RU',RWA:'RW',SAU:'SA',SEN:'SN',SGP:'SG',SVK:'SK',SVN:'SI',ZAF:'ZA',
  ESP:'ES',LKA:'LK',SWE:'SE',TJK:'TJ',TZA:'TZ',THA:'TH',TON:'TO',TTO:'TT',
  TUN:'TN',TUR:'TR',UGA:'UG',UKR:'UA',ARE:'AE',GBR:'GB',USA:'US',URY:'UY',
  UZB:'UZ',VEN:'VE',VNM:'VN',WSM:'WS',YEM:'YE',ZMB:'ZM',ZWE:'ZW',HRV:'HR',
  TWN:'TW',
};

const RECEIVE_CURRENCY = {
  IND:'INR',PHL:'PHP',MEX:'MXN',PAK:'PKR',BGD:'BDT',NGA:'NGN',CHN:'CNY',VNM:'VND',
  EGY:'EGP',COL:'COP',GTM:'GTQ',DOM:'DOP',HND:'HNL',SLV:'USD',NPL:'NPR',LKA:'LKR',
  KEN:'KES',GHA:'GHS',MAR:'MAD',KHM:'KHR',IDN:'IDR',THA:'THB',MYS:'MYR',JPN:'JPY',
  KOR:'KRW',PER:'PEN',ECU:'USD',BRA:'BRL',ARG:'ARS',CHL:'CLP',BOL:'BOB',PRY:'PYG',
  URY:'UYU',VEN:'VES',CRI:'CRC',PAN:'USD',NIC:'NIO',CUB:'CUP',JAM:'JMD',HTI:'HTG',
  TTO:'TTD',BRB:'BBD',BHS:'BSD',ZAF:'ZAR',ETH:'ETB',UGA:'UGX',TZA:'TZS',RWA:'RWF',
  SEN:'XOF',CIV:'XOF',CMR:'XAF',ZMB:'ZMW',ZWE:'ZWL',MWI:'MWK',BWA:'BWP',MUS:'MUR',
  MDG:'MGA',DZA:'DZD',TUN:'TND',JOR:'JOD',LBN:'LBP',TUR:'TRY',ISR:'ILS',ARE:'AED',
  SAU:'SAR',QAT:'QAR',KWT:'KWD',BHR:'BHD',OMN:'OMR',IRQ:'IQD',AFG:'AFN',ARM:'AMD',
  GEO:'GEL',AZE:'AZN',KAZ:'KZT',UZB:'UZS',KGZ:'KGS',TJK:'TJS',MNG:'MNT',MMR:'MMK',
  LAO:'LAK',TWN:'TWD',HKG:'HKD',SGP:'SGD',NZL:'NZD',FJI:'FJD',PNG:'PGK',WSM:'WST',
  TON:'TOP',GBR:'GBP',USA:'USD',CAN:'CAD',AUS:'AUD',DEU:'EUR',FRA:'EUR',ITA:'EUR',
  ESP:'EUR',NLD:'EUR',PRT:'EUR',POL:'PLN',GRC:'EUR',IRL:'EUR',AUT:'EUR',BEL:'EUR',
  CHE:'CHF',SWE:'SEK',NOR:'NOK',DNK:'DKK',FIN:'EUR',CZE:'CZK',SVK:'EUR',HUN:'HUF',
  ROU:'RON',BGR:'BGN',HRV:'EUR',SVN:'EUR',EST:'EUR',LVA:'EUR',LTU:'EUR',MLT:'EUR',
  CYP:'EUR',LUX:'EUR',ISL:'ISK',ALB:'ALL',UKR:'UAH',RUS:'RUB',BLR:'BYN',MDA:'MDL',
};

console.log('Loading USA bootstrap…');
const usa = JSON.parse(fs.readFileSync(USA_FILE, 'utf8'));
console.log(`  ${Object.keys(usa.results).length} corridors`);
console.log('Loading GBR bootstrap…');
const gbr = JSON.parse(fs.readFileSync(GBR_FILE, 'utf8'));
console.log(`  ${Object.keys(gbr.results).length} corridors`);

// Index by target — prefer USA, fall back to GBR for sanctioned-from-USA targets
const byTarget = {};
const collect = (bootstrap, srcCode) => {
  for (const [key, r] of Object.entries(bootstrap.results)) {
    const target = key.split('-')[1];
    if (byTarget[target]) continue;   // already have USA data
    byTarget[target] = { _src: srcCode, raw: r };
  }
};
collect(usa, 'USA');
collect(gbr, 'GBR');

// ---- Category classifier for Remitly field IDs ----------------------------
const CATEGORY = {
  FIRST_NAME: 'recipient', MIDDLE_NAME: 'recipient', LAST_NAME: 'recipient', SECOND_LAST_NAME: 'recipient',
  ACCOUNT_NUMBER: 'bank', BRANCH_CODE: 'bank', BANK_ACCOUNT_TYPE: 'bank',
  ADDRESS_LINE1: 'address', ADDRESS_LINE2: 'address', CITY: 'address',
  STATE: 'address', SUBDIVISION: 'address', POSTAL_CODE: 'address',
  NATIONAL_ID: 'id',
  PHONE_NUMBER: 'additional', REASON_FOR_SENDING: 'additional', EMAIL: 'additional',
};

// ---- Pick representative bank for account regex / example -----------------
const pickSampleBank = (destinations) => {
  if (!destinations?.length) return null;
  // Prefer the bank with ui_order=0 (most prominent), else first bank with a regex
  const banks = destinations.filter(d => d.destination_type === 'BANK_DEPOSIT');
  if (!banks.length) return null;
  banks.sort((a, b) => (a.ui_order ?? 99) - (b.ui_order ?? 99));
  return banks.find(b => b.attributes?.ACCOUNT_NUMBER?.validators?.[0]?.regex) || banks[0];
};

// ---- Regex → length hint --------------------------------------------------
const lengthFromRegex = (regex) => {
  if (!regex) return { minLength: null, maxLength: null };
  const m = regex.match(/\{(\d+)(?:,(\d+))?\}/);
  if (!m) return { minLength: null, maxLength: null };
  return { minLength: +m[1], maxLength: m[2] ? +m[2] : +m[1] };
};

// ---- Build unified field list for one target ------------------------------
const buildFields = (entry, target) => {
  const r = entry.raw;
  const f = r.corridor_config?.features || {};
  const d = r.corridor_config?.data || {};
  const cfg = r.destination_type_config || {};
  const addressFields = []; // from any one destination's recipient_info_config (similar across dests)
  // Actually: address config is at the corridor level via recipientAddressConfig, NOT in bootstrap.
  // Bootstrap includes destinations[].configuration.recipient_info_config.field_configs which is per-destination.

  const sampleBank = pickSampleBank(r.destinations);
  const bankRegex = sampleBank?.attributes?.ACCOUNT_NUMBER?.validators?.[0]?.regex || null;
  const bankMsg = sampleBank?.attributes?.ACCOUNT_NUMBER?.validators?.[0]?.message || null;
  const bankExample = sampleBank?.configuration?.recipient_account_config?.account_number_placeholder || null;
  const bankLabel = sampleBank?.configuration?.recipient_account_config?.recipient_account_form_config?.recipient_account_form_label || 'Account number';
  const bankAccountType = sampleBank?.destination_account_type || null;
  const branchCodeType = sampleBank?.configuration?.branch_code_type || null;
  const branchCodeRequired = !!sampleBank?.configuration?.branch_code_required;
  const bankLen = lengthFromRegex(bankRegex);

  const fields = [];

  // Recipient name
  fields.push({ id: 'FIRST_NAME', label: 'First name', mandatory: true, type: 'String', category: 'recipient' });
  if (f.collect_receiver_middle_name) {
    fields.push({ id: 'MIDDLE_NAME', label: 'Middle name', mandatory: false, type: 'String', category: 'recipient' });
  }
  fields.push({ id: 'LAST_NAME', label: 'Last name', mandatory: true, type: 'String', category: 'recipient' });
  if (f.collect_receiver_second_last_name) {
    fields.push({ id: 'SECOND_LAST_NAME', label: 'Second last name', mandatory: false, type: 'String', category: 'recipient' });
  }

  // Bank account
  if (sampleBank) {
    fields.push({
      id: 'ACCOUNT_NUMBER',
      label: bankLabel,
      mandatory: true,
      type: 'String',
      category: 'bank',
      regex: bankRegex,
      placeholder: bankExample,
      example: bankExample,
      minLength: bankLen.minLength,
      maxLength: bankLen.maxLength,
      help: bankMsg,
      accountType: bankAccountType,
    });
    if (branchCodeRequired || branchCodeType) {
      fields.push({
        id: 'BRANCH_CODE',
        label: (branchCodeType || 'Branch code').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        mandatory: !!branchCodeRequired,
        type: 'String',
        category: 'bank',
      });
    }
    if (sampleBank.configuration?.recipient_bank_account_type_required) {
      fields.push({
        id: 'BANK_ACCOUNT_TYPE',
        label: 'Bank account type',
        mandatory: true,
        type: 'Dropdown',
        category: 'bank',
        options: f.supported_bank_types || [],
        optionCount: (f.supported_bank_types || []).length,
      });
    }
  }

  // Address (Remitly address fields are at corridor level — we infer from USA
  // bootstrap if subdivisions are present, or from sample bank's recipient_info_config)
  // Bootstrap doesn't explicitly have address config for the target; use subdivision_details existence.
  if (r.subdivision_details?.length) {
    fields.push({ id: 'SUBDIVISION', label: 'State / Province', mandatory: false, type: 'Dropdown', category: 'address', optionCount: r.subdivision_details.length });
  }

  // ID / Tax
  if (sampleBank?.configuration?.national_identifier_required) {
    fields.push({ id: 'NATIONAL_ID', label: 'National ID', mandatory: true, type: 'String', category: 'id' });
  } else if (sampleBank?.configuration?.national_identifier_optional) {
    fields.push({ id: 'NATIONAL_ID', label: 'National ID', mandatory: false, type: 'String', category: 'id' });
  }

  // Phone — Remitly requires mobile phone for some corridors
  if (f.recipient_mobile_phone_only) {
    fields.push({ id: 'PHONE_NUMBER', label: 'Mobile phone', mandatory: false, type: 'String', category: 'additional', help: 'Must be a mobile number' });
  } else {
    fields.push({ id: 'PHONE_NUMBER', label: 'Phone number', mandatory: false, type: 'String', category: 'additional' });
  }

  // Reason for sending
  if (f.collect_send_reason) {
    const opts = Object.entries(d.reasons_for_sending || {}).map(([k, v]) => ({ code: k, label: v.message }));
    fields.push({
      id: 'REASON_FOR_SENDING',
      label: 'Reason for sending',
      mandatory: true,
      type: 'Dropdown',
      category: 'additional',
      options: opts,
      optionCount: opts.length,
      example: d.default_reason_for_sending,
    });
  }

  return fields;
};

// ---- Build the final output -----------------------------------------------
const out = {
  meta: {
    source: 'remitly',
    generated: new Date().toISOString(),
    endpoint: '/v28/bootstrap',
    usaCorridors: Object.keys(usa.results).length,
    gbrCorridors: Object.keys(gbr.results).length,
    targetsCovered: Object.keys(byTarget).length,
    note: 'Keyed by receiver (ISO-3 target country). Send currency does not affect recipient requirements at the target level.',
  },
  byTarget: {},
};

for (const [target, entry] of Object.entries(byTarget)) {
  const r = entry.raw;
  const dests = r.destinations || [];
  const byType = {};
  for (const dx of dests) byType[dx.destination_type] = (byType[dx.destination_type] || 0) + 1;
  const topInstitutions = dests.slice(0, 10).map(d => ({
    name: d.name,
    type: d.destination_type,
    institution_code: d.institution_code,
  }));
  const sampleBank = pickSampleBank(dests);

  out.byTarget[target] = {
    target,
    countryCode: ISO3_TO_ISO2[target] || target,
    receiveCurrency: RECEIVE_CURRENCY[target] || null,
    sourceUsed: entry._src,
    destinationCount: dests.length,
    destinationTypes: byType,
    topInstitutions,
    fields: buildFields(entry, target),
    sampleBank: sampleBank ? {
      name: sampleBank.name,
      institution_code: sampleBank.institution_code,
      accountType: sampleBank.destination_account_type,
      formLabel: sampleBank.configuration?.recipient_account_config?.recipient_account_form_config?.recipient_account_form_label,
      placeholder: sampleBank.configuration?.recipient_account_config?.account_number_placeholder,
      regex: sampleBank.attributes?.ACCOUNT_NUMBER?.validators?.[0]?.regex,
      validatorMessage: sampleBank.attributes?.ACCOUNT_NUMBER?.validators?.[0]?.message,
      branchCodeType: sampleBank.configuration?.branch_code_type,
      branchCodeRequired: !!sampleBank.configuration?.branch_code_required,
    } : null,
    reasonForSending: {
      collect: !!r.corridor_config?.features?.collect_send_reason,
      default: r.corridor_config?.data?.default_reason_for_sending || null,
      options: Object.entries(r.corridor_config?.data?.reasons_for_sending || {}).map(([k, v]) => ({ code: k, label: v.message })),
    },
    nameConfig: {
      middleName: !!r.corridor_config?.features?.collect_receiver_middle_name,
      secondLastName: !!r.corridor_config?.features?.collect_receiver_second_last_name,
      lastNameFirst: !!r.corridor_config?.display?.last_name_first,
    },
    dateFormat: r.corridor_config?.features?.date_collection_format,
    mobileOnly: !!r.corridor_config?.features?.recipient_mobile_phone_only,
    supportedBankTypes: r.corridor_config?.features?.supported_bank_types || [],
    supportedCards: r.corridor_config?.features?.supported_payment_cards || [],
    cashPickupLocations: r.corridor_config?.data?.cash_pickup_locations || null,
  };
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const sizeKB = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`\n✓ Wrote ${OUT} (${sizeKB} KB)`);
console.log(`  targets: ${Object.keys(out.byTarget).length}`);
console.log(`  sample entry keys:`, Object.keys(Object.values(out.byTarget)[0]).join(', '));

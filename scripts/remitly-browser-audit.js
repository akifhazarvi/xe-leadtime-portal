// =========================================================================
// REMITLY RECIPIENT REQUIREMENTS AUDIT — Browser Console Script
// =========================================================================
// Run this from a logged-in https://www.remitly.com tab.
//
// Remitly uses bearer-token auth (short-lived, ~43 chars) + a device env ID.
// Both are session-specific, so paste fresh values into the CONFIG block
// below before each run. Get them from DevTools → Network → any call to
// parasol.remitly.io/graphql → Request Headers:
//   authorization: Bearer <TOKEN>
//   remitly-deviceenvironmentid: <DEVICE_ID>
//
// What this audit collects per corridor (source × target country):
//   1. REST corridor_config   → features, supported cards, policy flags
//   2. RecipientAddressConfig → address form fields + regex validators
//   3. Subdivisions           → state/province codes per target country (1x)
//
// Does NOT yet collect bank-account field requirements (needs the
// destinationRecipientConfigId list query — TBD).
// =========================================================================

(async () => {
  // ---- CONFIG — paste fresh values per session ------------------------
  const AUTH_TOKEN = 'PASTE_FRESH_TOKEN_HERE';
  const DEVICE_ENV_ID = 'PASTE_FRESH_DEVICE_ID_HERE';
  const SEND_AMOUNT = '100.00';

  // Send countries — Remitly's primary sender markets
  const SEND_COUNTRIES = [
    'USA', 'GBR', 'CAN', 'AUS', 'IRL',
    'FRA', 'DEU', 'ITA', 'ESP', 'NLD',
    'BEL', 'AUT', 'POL', 'SWE', 'NOR',
    'DNK', 'FIN', 'CHE', 'LUX', 'SGP',
  ];

  // Known destinationRecipientConfigId values, keyed by "SRC-DST".
  // Populate by visiting corridors in the Remitly UI and copying the ID from
  // the DestinationRecipientConfig request payload (DevTools → Network).
  // Corridors without an entry here still get REST + address audit; only
  // DestinationRecipientConfig (name + reason + maybe account) is skipped.
  const DEST_RECIPIENT_CONFIG_IDS = {
    'GBR-AUT': '898417446ff44b40a0a43f5ee36c4841',
    'GBR-USA': '4bc65f40ce694a61a2fb85e0360e8697',
  };

  // Receive countries — top remittance destinations (~90 countries)
  const RECEIVE_COUNTRIES = [
    'IND','PHL','MEX','PAK','BGD','NGA','CHN','VNM','EGY','COL',
    'GTM','DOM','HND','SLV','NPL','LKA','KEN','GHA','MAR','KHM',
    'IDN','THA','MYS','JPN','KOR','PER','ECU','BRA','ARG','CHL',
    'BOL','PRY','URY','VEN','CRI','PAN','NIC','CUB','JAM','HTI',
    'TTO','BRB','BHS','ZAF','ETH','UGA','TZA','RWA','SEN','CIV',
    'CMR','ZMB','ZWE','MWI','BWA','MUS','MDG','DZA','TUN','JOR',
    'LBN','TUR','ISR','ARE','SAU','QAT','KWT','BHR','OMN','IRQ',
    'AFG','ARM','GEO','AZE','KAZ','UZB','KGZ','TJK','MNG','MMR',
    'LAO','TWN','HKG','SGP','NZL','FJI','PNG','WSM','TON',
    'GBR','USA','CAN','AUS','DEU','FRA','ITA','ESP','NLD','PRT',
    'POL','GRC','IRL','AUT','BEL','CHE','SWE','NOR','DNK','FIN',
    'CZE','SVK','HUN','ROU','BGR','HRV','SVN','EST','LVA','LTU',
    'MLT','CYP','LUX','ISL','ALB','UKR','RUS','BLR','MDA',
  ];

  // ---- UNWRAPPED fetch FROM SAME-ORIGIN IFRAME ------------------------
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  const rawFetch = iframe.contentWindow.fetch.bind(iframe.contentWindow);
  console.log('%c[setup] Using raw fetch from iframe', 'color:green');

  if (!location.hostname.endsWith('remitly.com')) {
    console.error('%c[setup] Run this on https://www.remitly.com (logged in). Current host: ' + location.hostname, 'color:red;font-weight:bold');
    iframe.remove();
    return;
  }
  if (!AUTH_TOKEN || AUTH_TOKEN.length < 20) {
    console.error('%c[setup] Paste a fresh AUTH_TOKEN from DevTools → Network → any parasol.remitly.io/graphql request', 'color:red;font-weight:bold');
    iframe.remove();
    return;
  }

  // ---- HEADERS ---------------------------------------------------------
  const GQL_HEADERS = {
    'accept': '*/*',
    'accept-language': 'en',
    'apollographql-client-name': 'narwhal-client-web',
    'apollographql-client-version': '100.0.0',
    'authorization': `Bearer ${AUTH_TOKEN}`,
    'client-app-version-name': '100.0.0',
    'content-type': 'application/json',
    'origin': 'https://www.remitly.com',
    'referer': 'https://www.remitly.com/',
    'remitly-deviceenvironmentid': DEVICE_ENV_ID,
    'remittance-distro-id': 'app_id_core',
  };
  const REST_HEADERS = {
    'accept': 'application/json',
    'authorization': `Bearer ${AUTH_TOKEN}`,
    'origin': 'https://www.remitly.com',
    'referer': 'https://www.remitly.com/',
    'remitly-deviceenvironmentid': DEVICE_ENV_ID,
    'remittance-distro-id': 'app_id_core',
  };

  // ---- GRAPHQL QUERIES -------------------------------------------------
  const Q_RECIPIENT_ADDRESS = `query RecipientAddressConfig($corridor: CorridorInput, $destinationId: String, $sendAmount: String) {
  recipientAddressConfig(corridor: $corridor, destinationId: $destinationId, sendAmount: $sendAmount) {
    autoCompleteFieldType
    fieldConfigs {
      type
      fieldType
      required
      label
      example
      validators { type field message regex validationVariant __typename }
      __typename
    }
    lineBreakBeforePostalCode
    __typename
  }
}`;

  const Q_DEST_RECIPIENT = `query DestinationRecipientConfig($destinationRecipientConfigId: ID!, $corridor: CorridorInput!) {
  destinationRecipientConfig(id: $destinationRecipientConfigId, corridor: $corridor) {
    recipientAccountConfig { ...RecipientAccountConfig __typename }
    recipientNameConfig { ...RecipientNameConfig __typename }
    reasonForSendingConfig { ...ReasonForSendingConfig __typename }
    acceptInternationalPhoneNumber
    __typename
  }
}
fragment RecipientAccountConfig on RecipientAccountConfig {
  accountFormConfig { title subtitle accountTypeLabel __typename }
  defaultAccountType
  inputConfigsPerType {
    key
    value { example hint label name prefix placeholder validator __typename }
    __typename
  }
  __typename
}
fragment RecipientNameConfig on RecipientNameConfig {
  title subtitle firstNameLabel firstNamePlaceholder middleNameLabel middleNamePlaceHolder
  lastNameLabel lastNamePlaceholder secondLastNameLabel secondLastNamePlaceholder
  lastNameFirst collectMiddleName middleNameRequired collectSecondLastName secondLastNameRequired
  __typename
}
fragment ReasonForSendingConfig on ReasonForSendingConfig {
  collect default
  reasons { key value __typename }
  __typename
}`;

  const Q_SUBDIVISIONS = `query SubdivisionDetailsForAlpha3Country($alpha3Country: String!) {
  subdivisionDetailsForAlpha3Country(alpha3Country: $alpha3Country) {
    name
    fullCode
    __typename
  }
}`;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Retry on 429 with exponential backoff; up to 5 attempts
  const withRetry = async (label, doFetch) => {
    let delay = 1000;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const r = await doFetch();
      if (r.status === 429) {
        const retryAfter = parseInt(r.headers.get('retry-after') || '0', 10);
        const waitMs = (retryAfter > 0 ? retryAfter * 1000 : delay) + Math.random() * 500;
        if (attempt === 1) console.warn(`[ratelimit] ${label} — waiting ${Math.round(waitMs)}ms`);
        await sleep(waitMs);
        delay = Math.min(delay * 2, 15000);
        continue;
      }
      return r;
    }
    throw new Error(`${label} — gave up after 5 retries on 429`);
  };

  const gqlCall = async (operationName, query, variables, extraHeaders = {}) => {
    const r = await withRetry(operationName, () => rawFetch('https://parasol.remitly.io/graphql', {
      method: 'POST',
      headers: {
        ...GQL_HEADERS,
        'x-apollo-operation-name': operationName,
        ...extraHeaders,
      },
      credentials: 'include',
      mode: 'cors',
      body: JSON.stringify({ operationName, variables, extensions: { breadcrumbs: [] }, query }),
    }));
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`${operationName} ${r.status}: ${text.slice(0, 300)}`);
    }
    const json = await r.json();
    if (json.errors) throw new Error(`${operationName} errors: ${JSON.stringify(json.errors).slice(0, 300)}`);
    return json.data;
  };

  const restCall = async (url) => {
    const r = await withRetry(`GET ${url}`, () => rawFetch(url, {
      method: 'GET',
      headers: REST_HEADERS,
      credentials: 'include',
      mode: 'cors',
    }));
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`GET ${url} ${r.status}: ${text.slice(0, 300)}`);
    }
    return r.json();
  };

  // ---- DIAGNOSTIC PROBE ------------------------------------------------
  console.log('%c[probe] Testing GBR→USA...', 'color:cyan');
  try {
    const cfg = await restCall('https://api.remitly.io/v2/configs/corridor_config?corridor=GBR-USA');
    console.log('  corridor_config OK, features keys:', Object.keys(cfg.features || {}).length);
    const addr = await gqlCall('RecipientAddressConfig', Q_RECIPIENT_ADDRESS, {
      corridor: { source: 'GBR', target: 'USA' },
      sendAmount: `${SEND_AMOUNT} GBP`,
    });
    console.log('  RecipientAddressConfig OK, field count:', addr.recipientAddressConfig?.fieldConfigs?.length);
    console.log('%c[probe] SUCCESS — auth works', 'color:green;font-weight:bold');
  } catch (e) {
    console.error('[probe] FAILED:', e.message);
    console.error('  Likely causes: stale AUTH_TOKEN, wrong DEVICE_ENV_ID, or logged out.');
    iframe.remove();
    return;
  }

  // ---- MAIN LOOP -------------------------------------------------------
  const corridors = [];
  for (const src of SEND_COUNTRIES) {
    for (const dst of RECEIVE_COUNTRIES) {
      corridors.push({ source: src, target: dst });
    }
  }
  console.log(`%c[audit] Starting — ${corridors.length} corridors`, 'color:cyan;font-weight:bold');

  const results = {};
  const errors = [];
  const subdivisions = {};
  let done = 0;

  const fetchCorridor = async ({ source, target }) => {
    const key = `${source}-${target}`;
    const out = {};
    try {
      out.corridorConfig = await restCall(`https://api.remitly.io/v2/configs/corridor_config?corridor=${source}-${target}`);
    } catch (e) {
      out.corridorConfigError = e.message;
    }
    try {
      const data = await gqlCall('RecipientAddressConfig', Q_RECIPIENT_ADDRESS, {
        corridor: { source, target },
        sendAmount: `${SEND_AMOUNT} ${inferCurrency(source)}`,
      });
      out.recipientAddressConfig = data.recipientAddressConfig;
    } catch (e) {
      out.recipientAddressConfigError = e.message;
    }
    const destId = DEST_RECIPIENT_CONFIG_IDS[key];
    if (destId) {
      try {
        const data = await gqlCall('DestinationRecipientConfig', Q_DEST_RECIPIENT, {
          corridor: { source, target },
          destinationRecipientConfigId: destId,
        });
        out.destinationRecipientConfig = data.destinationRecipientConfig;
        out.destinationRecipientConfigId = destId;
      } catch (e) {
        out.destinationRecipientConfigError = e.message;
      }
    }
    if (out.corridorConfigError && out.recipientAddressConfigError) {
      errors.push({ key, corridorConfigError: out.corridorConfigError, addrError: out.recipientAddressConfigError });
    } else {
      results[key] = out;
    }
    done++;
    if (done % 20 === 0 || done === corridors.length) {
      console.log(`  ${done}/${corridors.length} — ${Object.keys(results).length} ok, ${errors.length} err`);
    }
  };

  // Fetch subdivisions once per unique target (parallel with main loop)
  const fetchSubdivisions = async (alpha3) => {
    try {
      const data = await gqlCall('SubdivisionDetailsForAlpha3Country', Q_SUBDIVISIONS, { alpha3Country: alpha3 });
      subdivisions[alpha3] = data.subdivisionDetailsForAlpha3Country;
    } catch (e) {
      subdivisions[alpha3] = { error: e.message };
    }
  };

  const uniqueTargets = [...new Set(RECEIVE_COUNTRIES)];
  console.log(`%c[audit] Fetching subdivisions for ${uniqueTargets.length} targets in background`, 'color:gray');
  const subdivisionsPromise = (async () => {
    const queue = [...uniqueTargets];
    await Promise.all(Array(4).fill(0).map(async () => {
      while (queue.length) await fetchSubdivisions(queue.shift());
    }));
  })();

  const CONCURRENCY = 3;
  const queue = [...corridors];
  await Promise.all(Array(CONCURRENCY).fill(0).map(async () => {
    while (queue.length) await fetchCorridor(queue.shift());
  }));
  await subdivisionsPromise;

  console.log(`%c[done] ${Object.keys(results).length} ok, ${errors.length} err`, 'color:green;font-weight:bold');

  const payload = {
    meta: {
      timestamp: new Date().toISOString(),
      source: 'remitly',
      sendAmount: SEND_AMOUNT,
      sendCountries: SEND_COUNTRIES,
      receiveCountriesCount: RECEIVE_COUNTRIES.length,
      corridorsQueried: corridors.length,
      successful: Object.keys(results).length,
      errorCount: errors.length,
    },
    results,
    subdivisions,
    errors,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `remitly-recipient-requirements-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  iframe.remove();
  window._REMITLY_AUDIT = payload;
  console.log('%cFile downloaded — send to Claude!', 'color:green;font-weight:bold');

  // ---- helpers ---------------------------------------------------------
  function inferCurrency(alpha3) {
    const m = {
      USA: 'USD', GBR: 'GBP', CAN: 'CAD', AUS: 'AUD', NZL: 'NZD',
      SGP: 'SGD', HKG: 'HKD', JPN: 'JPY', KOR: 'KRW', CHE: 'CHF',
      SWE: 'SEK', NOR: 'NOK', DNK: 'DKK', POL: 'PLN',
    };
    if (m[alpha3]) return m[alpha3];
    // Eurozone senders
    const eur = ['AUT','BEL','CYP','EST','FIN','FRA','DEU','GRC','IRL','ITA','LVA','LTU','LUX','MLT','NLD','PRT','SVK','SVN','ESP','HRV'];
    if (eur.includes(alpha3)) return 'EUR';
    return 'USD';
  }
})();

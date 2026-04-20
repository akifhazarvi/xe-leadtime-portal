// =========================================================================
// REMITLY BOOTSTRAP AUDIT — Full recipient requirements per corridor
// =========================================================================
// Run from a logged-in https://www.remitly.com tab.
//
// One endpoint — /v28/bootstrap?corridor=X-Y — returns EVERYTHING per corridor:
//   - destinations[] (all banks / cash partners / wallets with destination_id,
//     name, type, account_type, recipient_info_config, recipient_account_config,
//     account_number validators, institution_code, ...)
//   - corridor_config (features flags, reasons_for_sending, display rules)
//   - destination_type_config (UI config per payout type)
//   - subdivision_details (states/provinces for receive country)
//   - transaction_limits
//   - pricing_configs / forex_rates
//
// Skipped entities: customer, draft, promo_state, receivers (keeps response
// lean and session-independent).
//
// Paste fresh AUTH_TOKEN + DEVICE_ENV_ID from DevTools → Network → any
// api.remitly.io request headers.
// =========================================================================

(async () => {
  // ---- CONFIG ---------------------------------------------------------
  const AUTH_TOKEN = 'PASTE_FRESH_TOKEN_HERE';
  const DEVICE_ENV_ID = 'PASTE_FRESH_DEVICE_ID_HERE';

  // /v28/bootstrap is customer-country-gated — only the country you're logged
  // in as will succeed. Run once per login:
  //   USA session → ['USA']
  //   GBR session → ['GBR']
  //   CAN session → ['CAN']
  //   AUS session → ['AUS']
  //   NZL session → ['NZL']
  //   EUR session → ['DEU'] (or FRA/IRL/ESP depending on account)
  const SEND_COUNTRIES = ['GBR'];

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

  // ---- Raw fetch from iframe -----------------------------------------
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  const rawFetch = iframe.contentWindow.fetch.bind(iframe.contentWindow);

  if (!location.hostname.endsWith('remitly.com')) {
    console.error('%c[setup] Run on https://www.remitly.com (logged in).', 'color:red;font-weight:bold');
    iframe.remove(); return;
  }
  if (!AUTH_TOKEN || AUTH_TOKEN.startsWith('PASTE_')) {
    console.error('%c[setup] Paste fresh AUTH_TOKEN', 'color:red;font-weight:bold');
    iframe.remove(); return;
  }

  // Match headers the real Remitly web app sends on api.remitly.io REST calls
  const HEADERS = {
    'accept': 'application/json',
    'accept-language': 'en, en;q=0.5',
    'content-type': 'application/json',
    'authorization': `Bearer ${AUTH_TOKEN}`,
    'origin': 'https://www.remitly.com',
    'referer': 'https://www.remitly.com/',
    'remitly-deviceenvironmentid': DEVICE_ENV_ID,
    'priority': 'u=1, i',
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const withRetry = async (label, doFetch) => {
    let delay = 1000;
    for (let attempt = 1; attempt <= 6; attempt++) {
      const r = await doFetch();
      if (r.status === 429 || r.status === 503) {
        const retryAfter = parseInt(r.headers.get('retry-after') || '0', 10);
        const waitMs = (retryAfter > 0 ? retryAfter * 1000 : delay) + Math.random() * 500;
        if (attempt === 1) console.warn(`[ratelimit] ${label} ${r.status} — waiting ${Math.round(waitMs)}ms`);
        await sleep(waitMs);
        delay = Math.min(delay * 2, 20000);
        continue;
      }
      return r;
    }
    throw new Error(`${label} — gave up after 6 retries`);
  };

  const bootstrapUrl = (src, dst) =>
    `https://api.remitly.io/v28/bootstrap?corridor=${src}-${dst}` +
    `&skippedEntities=customer&skippedEntities=draft&skippedEntities=promo_state&skippedEntities=receivers`;

  const fetchBootstrap = async (src, dst) => {
    const r = await withRetry(`${src}-${dst}`, () =>
      rawFetch(bootstrapUrl(src, dst), { method: 'GET', headers: HEADERS, credentials: 'include', mode: 'cors' })
    );
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`${r.status}: ${text.slice(0, 200)}`);
    }
    return r.json();
  };

  // ---- Probe (uses first SEND_COUNTRY against a well-supported target) ---
  const probeSrc = SEND_COUNTRIES[0];
  const probeDst = probeSrc === 'USA' ? 'MEX' : 'IND';  // IND/MEX are supported from every major source
  console.log(`%c[probe] Testing ${probeSrc}-${probeDst} bootstrap...`, 'color:cyan');
  try {
    const probe = await fetchBootstrap(probeSrc, probeDst);
    console.log(`  OK — ${probe.destinations?.length || 0} destinations, corridor_config present: ${!!probe.corridor_config}`);
    console.log('%c[probe] SUCCESS', 'color:green;font-weight:bold');
  } catch (e) {
    console.error('[probe] FAILED:', e.message);
    console.error('  If this is a 400, your logged-in account country does not match the SEND_COUNTRIES you configured.');
    iframe.remove(); return;
  }

  // ---- Build corridor list ------------------------------------------
  const corridors = [];
  for (const src of SEND_COUNTRIES) {
    for (const dst of RECEIVE_COUNTRIES) {
      if (src === dst) continue;
      corridors.push({ source: src, target: dst });
    }
  }
  console.log(`%c[audit] ${corridors.length} corridors — starting`, 'color:cyan;font-weight:bold');

  // ---- Fetch with concurrency ---------------------------------------
  const results = {};
  const errors = [];
  let done = 0;

  const slim = (boot) => ({
    corridor: boot.corridor,
    destinationCount: boot.destinations?.length || 0,
    destinations: (boot.destinations || []).map(d => ({
      destination_id: d.destination_id,
      name: d.name,
      destination_type: d.destination_type,
      destination_account_type: d.destination_account_type,
      institution_code: d.institution_code,
      ui_order: d.ui_order,
      delivery_promise: d.delivery_promise,
      receive_market: d.receive_market,
      location_count_text: d.location_count_text,
      network_members: d.network_members,
      configuration: d.configuration,   // full recipient_info + recipient_account config
      attributes: d.attributes,         // validators
    })),
    corridor_config: boot.corridor_config,
    destination_type_config: boot.destination_type_config,
    destination_account_type_configs: boot.destination_account_type_configs,
    subdivision_details: boot.subdivision_details,
    transaction_limits: boot.transaction_limits,
    pricing_configs: boot.pricing_configs,
    country_details: boot.country_details,
    currency_details: boot.currency_details,
  });

  const fetchCorridor = async ({ source, target }) => {
    const key = `${source}-${target}`;
    try {
      const data = await fetchBootstrap(source, target);
      results[key] = slim(data);
    } catch (e) {
      errors.push({ key, error: e.message });
    }
    done++;
    if (done % 25 === 0 || done === corridors.length) {
      const totalDests = Object.values(results).reduce((a, r) => a + (r.destinationCount || 0), 0);
      console.log(`  ${done}/${corridors.length} — ${Object.keys(results).length} ok, ${errors.length} err, ${totalDests} total destinations`);
    }
  };

  const CONCURRENCY = 4;
  const queue = [...corridors];
  await Promise.all(Array(CONCURRENCY).fill(0).map(async () => {
    while (queue.length) await fetchCorridor(queue.shift());
  }));

  const totalDestinations = Object.values(results).reduce((a, r) => a + (r.destinationCount || 0), 0);
  console.log(`%c[done] ${Object.keys(results).length} corridors, ${totalDestinations} destinations total, ${errors.length} errors`, 'color:green;font-weight:bold');

  const payload = {
    meta: {
      timestamp: new Date().toISOString(),
      source: 'remitly',
      endpoint: '/v28/bootstrap',
      sendCountries: SEND_COUNTRIES,
      receiveCountriesCount: RECEIVE_COUNTRIES.length,
      corridorsQueried: corridors.length,
      successful: Object.keys(results).length,
      totalDestinations,
      errorCount: errors.length,
    },
    results,
    errors,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `remitly-bootstrap-audit-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  iframe.remove();
  window._REMITLY_BOOTSTRAP = payload;
  console.log('%cFile downloaded — send to Claude!', 'color:green;font-weight:bold');
})();

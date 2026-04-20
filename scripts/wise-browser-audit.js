// =========================================================================
// WISE RECIPIENT REQUIREMENTS AUDIT — Browser Console Script
// =========================================================================
// Run this from a logged-in Wise tab (https://wise.com/...).
// Mirrors scripts/browser-audit.js (Xe) but targets Wise's contact-requirements
// endpoint. Wise auth is cookie-based, so we use credentials:'include' and a
// same-origin iframe fetch to bypass any page-level fetch wrappers.
//
// Wise keys requirements by TARGET CURRENCY (not country+currency like Xe),
// so the matrix is ~60 currencies instead of ~210 pairs.
// =========================================================================

(async () => {
  const BASE_URL = 'https://wise.com';
  const PROFILE_ID = 3732365;          // from the sample URL in the task
  const LEGAL_ENTITY = 'PERSON';       // matches Xe isBusiness=false

  // ---- UNWRAPPED fetch FROM SAME-ORIGIN IFRAME ------------------------
  // Cookies on wise.com are sent because the iframe is same-origin.
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  const rawFetch = iframe.contentWindow.fetch.bind(iframe.contentWindow);
  console.log('%c[setup] Using raw fetch from iframe', 'color:green');

  if (!location.hostname.endsWith('wise.com')) {
    console.error('%c[setup] Run this on https://wise.com (logged in). Current host: ' + location.hostname, 'color:red;font-weight:bold');
    iframe.remove();
    return;
  }

  // ---- AUTH ------------------------------------------------------------
  // Wise's /gateway/ uses cookie auth (HttpOnly oauthToken) + a static
  // x-access-token magic header. No bearer token needed — credentials:'include'
  // sends the HttpOnly cookie automatically from the same-origin iframe fetch.
  const flowId = (crypto.randomUUID ? crypto.randomUUID() : 'f85fcffa-3e62-4179-9741-855c2eb180aa');
  const HEADERS = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'x-access-token': 'Tr4n5f3rw153',
    'x-contact-flow-id': flowId,
    'x-visual-context': 'personal::light',
  };
  console.log('%c[setup] Using cookie auth + x-access-token magic header', 'color:gray');

  const bodyFor = (currency) => JSON.stringify({
    action: 'SEND',
    targetCurrency: currency,
    payInMethod: 'DEFAULT',
    ownedByCustomer: true,
    legalEntityType: LEGAL_ENTITY,
    emailRecipientEnabled: true,
    uniqueIdRecipientEnabled: true,
    contactsEnabled: true,
    creationOptionMetadata: {
      contactCreationOptionType: 'BANK_DETAILS',
      accountDetailsTypes: [],
      ocrEntrypoint: true,
    },
  });

  const endpoint = `${BASE_URL}/gateway/v2/profiles/${PROFILE_ID}/contact-requirements`;

  // ---- DIAGNOSTIC TEST ------------------------------------------------
  console.log('%c[test] PKR probe...', 'color:cyan');
  try {
    const r = await rawFetch(endpoint, {
      method: 'POST',
      headers: HEADERS,
      credentials: 'include',
      mode: 'cors',
      body: bodyFor('PKR'),
    });
    const text = await r.text();
    console.log(`  status: ${r.status}`);
    if (!r.ok) {
      console.error('[test] HTTP error body:', text.slice(0, 600));
      console.error('[test] Check you are logged in and PROFILE_ID (' + PROFILE_ID + ') matches the session.');
      iframe.remove();
      return;
    }
    console.log('%c[test] SUCCESS', 'color:green;font-weight:bold');
    console.log('  sample:', text.slice(0, 300));
  } catch (e) {
    console.error('[test] FETCH FAILED:', e);
    iframe.remove();
    return;
  }

  // ---- CURRENCY LIST --------------------------------------------------
  // Comprehensive list of currencies Wise has supported as SEND targets.
  // A few may 4xx for your profile/region — those go to errors, not results.
  const CURRENCIES = [
    'AED','ARS','AUD','BDT','BGN','BRL','BWP','CAD','CHF','CLP','CNY','COP',
    'CRC','CZK','DKK','EGP','EUR','FJD','GBP','GEL','GHS','GTQ','HKD','HNL',
    'HRK','HUF','IDR','ILS','INR','ISK','JPY','KES','KRW','LKR','MAD','MXN',
    'MYR','NGN','NOK','NPR','NZD','PEN','PHP','PKR','PLN','QAR','RON','RUB',
    'SAR','SEK','SGD','THB','TRY','TWD','TZS','UAH','UGX','USD','UYU','VND',
    'XOF','ZAR','ZMW',
  ];
  console.log(`%c[audit] Starting — ${CURRENCIES.length} currencies`, 'color:cyan;font-weight:bold');

  const results = {};
  const errors = [];
  let done = 0;

  const fetchOne = async (currency) => {
    const key = currency;
    try {
      const r = await rawFetch(endpoint, {
        method: 'POST',
        headers: HEADERS,
        credentials: 'include',
        mode: 'cors',
        body: bodyFor(currency),
      });
      if (r.ok) {
        results[key] = await r.json();
      } else {
        const errText = await r.text().catch(() => '');
        errors.push({ key, status: r.status, body: errText.slice(0, 300) });
      }
    } catch (e) {
      errors.push({ key, err: String(e) });
    }
    done++;
    if (done % 10 === 0 || done === CURRENCIES.length) {
      console.log(`  ${done}/${CURRENCIES.length} — ${Object.keys(results).length} ok, ${errors.length} err`);
    }
  };

  const CONCURRENCY = 4;
  const queue = [...CURRENCIES];
  await Promise.all(Array(CONCURRENCY).fill(0).map(async () => {
    while (queue.length) await fetchOne(queue.shift());
  }));

  console.log(`%c[done] ${Object.keys(results).length} ok, ${errors.length} err`, 'color:green;font-weight:bold');

  const payload = {
    meta: {
      timestamp: new Date().toISOString(),
      source: 'wise',
      profileId: PROFILE_ID,
      legalEntityType: LEGAL_ENTITY,
      baseUrl: BASE_URL,
      endpoint,
      totalQueried: CURRENCIES.length,
      successful: Object.keys(results).length,
      errorCount: errors.length,
    },
    results,
    errors,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `wise-recipient-requirements-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  iframe.remove();
  window._WISE_AUDIT = payload;
  console.log('%cFile downloaded — send to Claude!', 'color:green;font-weight:bold');
})();

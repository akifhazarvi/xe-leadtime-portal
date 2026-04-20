// =========================================================================
// XE RECIPIENT FIELDS AUDIT — Browser Console Script (v3)
// =========================================================================
// v3 fix: LogRocket monkey-patches window.fetch and forces credentials:include,
// which breaks CORS. We bypass it by grabbing `fetch` from a fresh iframe's
// window — that `fetch` is untouched by the page's patches.
// =========================================================================

(async () => {
  const BASE_URL = 'https://launchpad-api.xe.com';
  const PROFILE_ID = 7855690;

  // ---- GET UNWRAPPED fetch FROM IFRAME --------------------------------
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  const rawFetch = iframe.contentWindow.fetch.bind(iframe.contentWindow);
  console.log('%c[setup] Using raw fetch from iframe (bypasses LogRocket)', 'color:green');

  // ---- TOKEN -----------------------------------------------------------
  let bearer = null;
  for (const k of ['token','authToken','accessToken','id_token','access_token','galileo_token']) {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (v && v.length > 50) { bearer = v.replace(/^Bearer\s+/i,'').replace(/^"|"$/g,''); break; }
  }
  if (!bearer) {
    bearer = prompt('Paste Bearer token (from any /v2/... Network request → Authorization header):');
    if (!bearer) { console.error('No token. Aborting.'); iframe.remove(); return; }
    bearer = bearer.replace(/^Bearer\s+/i,'').trim();
  }
  console.log('%c[setup] Token:', 'color:green', bearer.slice(0,30) + '...');

  const HEADERS = { 'authorization': `Bearer ${bearer}`, 'accept': 'application/json' };
  const FETCH_OPTS = { method: 'GET', headers: HEADERS, credentials: 'omit', mode: 'cors' };

  // ---- DIAGNOSTIC TEST -------------------------------------------------
  console.log('%c[test] IN/INR with raw fetch...', 'color:cyan');
  try {
    const r = await rawFetch(`${BASE_URL}/v2/recipients/fields/${PROFILE_ID}/IN/INR?isBusiness=false`, FETCH_OPTS);
    const text = await r.text();
    console.log(`  status: ${r.status}`);
    if (!r.ok) {
      console.error('[test] HTTP error body:', text.slice(0,400));
      iframe.remove();
      return;
    }
    console.log('%c[test] SUCCESS', 'color:green;font-weight:bold');
    console.log('  sample:', text.slice(0,300));
  } catch (e) {
    console.error('[test] FETCH FAILED:', e);
    iframe.remove();
    return;
  }

  // ---- FULL AUDIT ------------------------------------------------------
  const COUNTRIES = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
  const LOCAL = [
    ['GB','GBP'],['IN','INR'],['CA','CAD'],['AU','AUD'],['NZ','NZD'],
    ['BR','BRL'],['GG','GBP'],['IM','GBP'],['JE','GBP'],
    ['DE','EUR'],['FR','EUR'],['ES','EUR'],['IT','EUR'],['NL','EUR'],
    ['IE','EUR'],['PT','EUR'],['AT','EUR'],['BE','EUR'],['FI','EUR'],
    ['PK','PKR'],['MX','MXN'],['ZA','ZAR'],['PH','PHP'],['NG','NGN'],
    ['KE','KES'],['JP','JPY'],['CN','CNY'],['HK','HKD'],['SG','SGD'],
    ['TH','THB'],['ID','IDR'],['VN','VND'],['MY','MYR'],['BD','BDT'],
    ['LK','LKR'],['NP','NPR'],['CH','CHF'],['SE','SEK'],['NO','NOK'],
    ['DK','DKK'],['PL','PLN'],['TR','TRY'],['AE','AED'],['SA','SAR'],
    ['IL','ILS'],['EG','EGP'],['AR','ARS'],['CL','CLP'],['CO','COP'],
    ['PE','PEN'],['GT','GTQ'],['DO','DOP'],['JM','JMD'],['TT','TTD'],
    ['BB','BBD'],['BS','BSD'],['KR','KRW'],['TW','TWD'],
  ];
  const pairs = [...COUNTRIES.map(c => [c,'USD']), ...LOCAL];
  console.log(`%c[audit] Starting — ${pairs.length} pairs`, 'color:cyan;font-weight:bold');

  const results = {};
  const errors = [];
  let done = 0;

  const fetchOne = async ([country, currency]) => {
    const key = `${country}_${currency}`;
    try {
      const r = await rawFetch(`${BASE_URL}/v2/recipients/fields/${PROFILE_ID}/${country}/${currency}?isBusiness=false`, FETCH_OPTS);
      if (r.ok) results[key] = await r.json();
      else errors.push({ key, status: r.status });
    } catch (e) {
      errors.push({ key, err: String(e) });
    }
    done++;
    if (done % 20 === 0 || done === pairs.length) {
      console.log(`  ${done}/${pairs.length} — ${Object.keys(results).length} ok, ${errors.length} err`);
    }
  };

  const CONCURRENCY = 5;
  const queue = [...pairs];
  await Promise.all(Array(CONCURRENCY).fill(0).map(async () => {
    while (queue.length) await fetchOne(queue.shift());
  }));

  console.log(`%c[done] ${Object.keys(results).length} ok, ${errors.length} err`, 'color:green;font-weight:bold');

  const payload = {
    meta: { timestamp: new Date().toISOString(), profileId: PROFILE_ID, baseUrl: BASE_URL, totalQueried: pairs.length, successful: Object.keys(results).length, errorCount: errors.length },
    results, errors,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `recipient-fields-audit-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  iframe.remove();
  window._XE_AUDIT = payload;
  console.log('%cFile downloaded — send to Claude!', 'color:green;font-weight:bold');
})();

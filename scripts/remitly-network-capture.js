// =========================================================================
// REMITLY NETWORK CAPTURE — Browser Console Script
// =========================================================================
// Paste into DevTools console on https://www.remitly.com BEFORE browsing.
// Then navigate naturally — pick a send country, pick a destination country,
// start a send flow, pick payout method, enter recipient, etc.
//
// Captures every request+response to:
//   - parasol.remitly.io/graphql   (GraphQL — operation name, query, vars, data)
//   - api.remitly.io/*             (REST — URL, response JSON)
//
// When done browsing, run:
//   downloadCaptures()
// to download a JSON file. Send it to Claude.
//
// Auth tokens are redacted in the dump (we don't need them — just the shapes).
// =========================================================================

(() => {
  if (window._remitlyCaptureInstalled) {
    console.warn('[capture] Already installed — call downloadCaptures() when done, or reload to reinstall.');
    return;
  }
  window._remitlyCaptureInstalled = true;

  const captures = [];
  window._remitlyCaptures = captures;

  const MATCH = /(parasol\.remitly\.io|api\.remitly\.io|www\.remitly\.com\/api)/;
  const REDACT_HEADERS = new Set(['authorization', 'cookie', 'remitly-deviceenvironmentid']);

  const redactHeaders = (h) => {
    const out = {};
    for (const [k, v] of Object.entries(h || {})) {
      out[k] = REDACT_HEADERS.has(k.toLowerCase()) ? '[REDACTED]' : v;
    }
    return out;
  };

  const safeParse = (s) => {
    if (typeof s !== 'string') return s;
    try { return JSON.parse(s); } catch { return s; }
  };

  const summarize = (rec) => {
    if (rec.kind === 'graphql') {
      return `GQL ${rec.operationName || '?'} ← ${rec.status}`;
    }
    return `${rec.method} ${rec.url.replace(/^https?:\/\/[^/]+/, '')} ← ${rec.status}`;
  };

  // ---- fetch patch ---------------------------------------------------
  const origFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (!MATCH.test(url)) return origFetch(input, init);

    const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    let bodyParsed = null;
    if (init.body && typeof init.body === 'string') bodyParsed = safeParse(init.body);

    const startedAt = Date.now();
    let resp;
    try {
      resp = await origFetch(input, init);
    } catch (e) {
      captures.push({
        kind: 'fetch-error', url, method, startedAt, error: String(e),
        requestHeaders: redactHeaders(init.headers), requestBody: bodyParsed,
      });
      throw e;
    }

    // Clone so we don't consume the body for the caller
    const clone = resp.clone();
    const contentType = clone.headers.get('content-type') || '';
    let respBody = null;
    try {
      respBody = contentType.includes('application/json')
        ? await clone.json()
        : (await clone.text()).slice(0, 5000);
    } catch (e) {
      respBody = { _parseError: String(e) };
    }

    const isGql = /\/graphql(\?|$)/.test(url);
    const rec = isGql
      ? {
          kind: 'graphql',
          url, method, status: resp.status, durationMs: Date.now() - startedAt,
          operationName: bodyParsed?.operationName || null,
          variables: bodyParsed?.variables || null,
          query: bodyParsed?.query || null,
          data: respBody,
          requestHeaders: redactHeaders(init.headers),
        }
      : {
          kind: 'rest',
          url, method, status: resp.status, durationMs: Date.now() - startedAt,
          requestBody: bodyParsed,
          response: respBody,
          requestHeaders: redactHeaders(init.headers),
        };

    captures.push(rec);
    const count = captures.length;
    if (count <= 50 || count % 10 === 0) {
      console.log(`%c[capture #${count}] ${summarize(rec)}`, 'color:#4af');
    }
    return resp;
  };

  // ---- XHR patch -----------------------------------------------------
  const XHR = window.XMLHttpRequest.prototype;
  const origOpen = XHR.open;
  const origSend = XHR.send;
  const origSetHeader = XHR.setRequestHeader;

  XHR.open = function (method, url) {
    this.__capture = { method: method.toUpperCase(), url, headers: {} };
    return origOpen.apply(this, arguments);
  };
  XHR.setRequestHeader = function (name, value) {
    if (this.__capture) this.__capture.headers[name] = value;
    return origSetHeader.apply(this, arguments);
  };
  XHR.send = function (body) {
    if (this.__capture && MATCH.test(this.__capture.url)) {
      const startedAt = Date.now();
      const parsedBody = typeof body === 'string' ? safeParse(body) : null;
      this.addEventListener('loadend', () => {
        const isGql = /\/graphql(\?|$)/.test(this.__capture.url);
        const respBody = safeParse(this.responseText || '');
        const rec = isGql
          ? {
              kind: 'graphql', via: 'xhr',
              url: this.__capture.url, method: this.__capture.method,
              status: this.status, durationMs: Date.now() - startedAt,
              operationName: parsedBody?.operationName || null,
              variables: parsedBody?.variables || null,
              query: parsedBody?.query || null,
              data: respBody,
              requestHeaders: redactHeaders(this.__capture.headers),
            }
          : {
              kind: 'rest', via: 'xhr',
              url: this.__capture.url, method: this.__capture.method,
              status: this.status, durationMs: Date.now() - startedAt,
              requestBody: parsedBody, response: respBody,
              requestHeaders: redactHeaders(this.__capture.headers),
            };
        captures.push(rec);
        const count = captures.length;
        if (count <= 50 || count % 10 === 0) {
          console.log(`%c[capture #${count}] ${summarize(rec)}`, 'color:#4af');
        }
      });
    }
    return origSend.apply(this, arguments);
  };

  // ---- extract Apollo cache (where all seen destinations live) -------
  const extractApolloCache = () => {
    try {
      // Common places Apollo stores the cache
      const candidates = [
        window.__APOLLO_STATE__,
        window.__APOLLO_CLIENT__?.cache?.data?.data,
        window.__APOLLO_CLIENT__?.cache?.extract?.(),
      ].filter(Boolean);
      if (!candidates.length) return { note: 'no apollo cache found on window' };
      const state = candidates[0];
      const keys = Object.keys(state);
      // Pull everything destination / recipient / corridor related
      const filter = /Destination|Recipient|Corridor|ReasonForSending|BranchCode|Address/i;
      const relevant = {};
      for (const k of keys) if (filter.test(k)) relevant[k] = state[k];
      return { totalKeys: keys.length, relevantKeyCount: Object.keys(relevant).length, relevant };
    } catch (e) { return { error: String(e) }; }
  };

  // ---- extract per-corridor destinationIds seen ----------------------
  const indexCorridorDestinations = () => {
    const byCorridor = {};
    const push = (corridor, destId, source) => {
      if (!corridor || !destId) return;
      if (!byCorridor[corridor]) byCorridor[corridor] = {};
      if (!byCorridor[corridor][destId]) byCorridor[corridor][destId] = { sources: [], meta: {} };
      if (!byCorridor[corridor][destId].sources.includes(source)) byCorridor[corridor][destId].sources.push(source);
    };
    for (const c of captures) {
      if (c.kind !== 'graphql') continue;
      const v = c.variables || {};
      const corridor = v.corridor ? `${v.corridor.source}-${v.corridor.target}` : null;
      // DestinationRecipientConfig → destinationRecipientConfigId
      if (c.operationName === 'DestinationRecipientConfig' && v.destinationRecipientConfigId) {
        push(corridor, v.destinationRecipientConfigId, 'DestinationRecipientConfig');
      }
      // RecipientAddressConfig with destinationId
      if (c.operationName === 'RecipientAddressConfig' && v.destinationId) {
        push(corridor, v.destinationId, 'RecipientAddressConfig');
      }
      // UpdateDraft / CreateDraft input.destinationId + input.corridor
      if ((c.operationName === 'UpdateDraft' || c.operationName === 'CreateDraft') && v.input?.destinationId && v.input?.corridor) {
        const corr = `${v.input.corridor.source}-${v.input.corridor.target}`;
        push(corr, v.input.destinationId, c.operationName);
      }
      // ValidateClearingCode → returned destination_public_id (bank-specific)
      if (c.operationName === 'ValidateClearingCode' && v.input) {
        const meta = c.data?.data?.validateClearingCode?.metadata;
        if (meta?.destination_public_id) {
          const corr = `${v.input.recipientCountry ? '?-' + v.input.recipientCountry : '?'}`;
          push(corr, meta.destination_public_id, `ValidateClearingCode:${meta.institution_code || 'bank'}`);
          if (byCorridor[corr]?.[meta.destination_public_id]) {
            byCorridor[corr][meta.destination_public_id].meta = {
              institution_code: meta.institution_code, name: meta.name, status: meta.status,
            };
          }
        }
      }
      // DestinationForRecipientAccount → destination object
      if (c.operationName === 'DestinationForRecipientAccount') {
        const d = c.data?.data?.destination;
        if (d?.publicId && v.corridor) {
          const corr = `${v.corridor.source}-${v.corridor.target}`;
          push(corr, d.publicId, `DestinationForRecipientAccount:${d.institutionCode || d.type}`);
          if (byCorridor[corr]?.[d.publicId]) {
            byCorridor[corr][d.publicId].meta = {
              name: d.name, type: d.type, institutionCode: d.institutionCode, accountType: d.accountType,
            };
          }
        }
      }
    }
    return byCorridor;
  };

  // ---- export --------------------------------------------------------
  window.downloadCaptures = function (filename) {
    const operations = [...new Set(captures.filter(c => c.kind === 'graphql').map(c => c.operationName).filter(Boolean))].sort();
    const corridorDestinations = indexCorridorDestinations();
    const apolloCache = extractApolloCache();
    const payload = {
      meta: {
        capturedAt: new Date().toISOString(),
        url: location.href,
        count: captures.length,
        graphqlOperations: operations,
        corridorsWithDestinations: Object.keys(corridorDestinations).length,
      },
      corridorDestinations,
      apolloCache,
      captures,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || `remitly-capture-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    console.log(`%c[capture] Downloaded ${captures.length} records, ${operations.length} GQL ops, destinations for ${Object.keys(corridorDestinations).length} corridors`, 'color:#0c0;font-weight:bold');
    console.table(Object.fromEntries(Object.entries(corridorDestinations).map(([k, v]) => [k, Object.keys(v).length])));
  };

  window.clearCaptures = function () { captures.length = 0; console.log('[capture] cleared'); };
  window.captureStats = function () {
    const byOp = {};
    for (const c of captures) {
      const k = c.kind === 'graphql' ? `gql:${c.operationName}` : `${c.method} ${c.url.split('?')[0].split('/').slice(3).join('/')}`;
      byOp[k] = (byOp[k] || 0) + 1;
    }
    console.table(byOp);
  };

  console.log('%c[capture] Installed. Browse normally — every Remitly API call is captured.', 'color:#0c0;font-weight:bold');
  console.log('%cWhen done: downloadCaptures()   |   Peek: captureStats()   |   Reset: clearCaptures()', 'color:#888');
})();

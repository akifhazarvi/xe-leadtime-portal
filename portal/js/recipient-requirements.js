// Portal page: Recipient Requirements — Xe vs Wise
(async () => {
  const [xeData, countryNames, wiseData, remitlyData, gapAnalysis] = await Promise.all([
    fetch('data/recipient-requirements.json').then(r => r.json()),
    fetch('data/country-names.json').then(r => r.json()),
    fetch('data/wise-normalized.json').then(r => r.json()).catch(() => null),
    fetch('data/remitly-normalized.json').then(r => r.json()).catch(() => null),
    fetch('data/recipient-gap-analysis.json').then(r => r.json()).catch(() => null),
  ]);

  // Populate hero metrics from gap analysis
  if (gapAnalysis?.global) {
    const g = gapAnalysis.global;
    const heroAvgWise = document.getElementById('hero-avg-wise');
    const heroAvgRemitly = document.getElementById('hero-avg-remitly');
    const heroTopExtra = document.getElementById('hero-top-extra');
    const heroTopExtraPct = document.getElementById('hero-top-extra-pct');
    if (heroAvgWise) heroAvgWise.textContent = '+' + g.avgFrictionDeltaVsWise;
    if (heroAvgRemitly) heroAvgRemitly.textContent = '+' + g.avgFrictionDeltaVsRemitly;
    // Find the most impactful Xe extra field (highest % that isn't "name" which is universal)
    const topExtra = g.xeExtraFieldsTop.find(x => !['name', 'full name'].includes(x.field)) || g.xeExtraFieldsTop[0];
    if (topExtra) {
      if (heroTopExtra) heroTopExtra.textContent = topExtra.field.replace(/\b\w/g, c => c.toUpperCase());
      if (heroTopExtraPct) heroTopExtraPct.textContent = topExtra.pctOfCorridors + '%';
    }
  }

  // Index Remitly byTarget → also by ISO-2 countryCode for easy lookup
  const remitlyByCountry = {};
  if (remitlyData?.byTarget) {
    for (const [iso3, entry] of Object.entries(remitlyData.byTarget)) {
      if (entry.countryCode) remitlyByCountry[entry.countryCode] = entry;
    }
  }

  const CATEGORIES = [
    { id: 'recipient', label: 'Recipient', icon: 'person' },
    { id: 'bank',      label: 'Bank Details', icon: 'bank' },
    { id: 'address',   label: 'Address', icon: 'pin' },
    { id: 'id',        label: 'ID & Tax', icon: 'id' },
    { id: 'additional',label: 'Additional', icon: 'plus' },
  ];

  const $ = (id) => document.getElementById(id);
  const countrySel = $('country-select');
  const currencySel = $('currency-select');
  const searchInp = $('country-search');
  const results = $('results');
  const resultsWise = $('results-wise');
  const resultsRemitly = $('results-remitly');
  const meta = $('meta-summary');
  const cmpBanner = $('comparison-summary');
  const wiseTabs = $('wise-branch-tabs');
  const xeStats = $('xe-stats');
  const wiseStats = $('wise-stats');
  const remitlyStats = $('remitly-stats');
  const remitlyMeta = $('remitly-meta');
  const fieldMatrix = $('field-matrix');

  // ---- Build country list from Xe (source of truth for "destinations") ----
  const byCountry = {};
  for (const corr of Object.values(xeData.corridors)) {
    if (!byCountry[corr.country]) byCountry[corr.country] = new Set();
    byCountry[corr.country].add(corr.currency);
  }
  const countriesSorted = Object.keys(byCountry).sort((a, b) =>
    (countryNames[a] || a).localeCompare(countryNames[b] || b)
  );

  const populateCountries = (filter = '') => {
    const f = filter.toLowerCase();
    countrySel.innerHTML = '';
    for (const code of countriesSorted) {
      const name = countryNames[code] || code;
      if (f && !name.toLowerCase().includes(f) && !code.toLowerCase().includes(f)) continue;
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${name} (${code})`;
      countrySel.appendChild(opt);
    }
  };
  populateCountries();

  const populateCurrencies = (country) => {
    currencySel.innerHTML = '';
    const currencies = [...byCountry[country]].sort((a, b) => a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b));
    for (const c of currencies) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      currencySel.appendChild(opt);
    }
  };

  // ---- Regex → human hint ------------------------------------------------
  const regexToHint = (regex) => {
    if (!regex) return null;
    const lenMatch = regex.match(/\{(\d+)(?:,(\d+))?\}/);
    const digitOnly = /\^\\d/.test(regex) || /\[0-9\]/.test(regex);
    if (lenMatch) {
      const [, min, max] = lenMatch;
      const type = digitOnly ? 'digits' : 'characters';
      if (max && max !== min) return `${min}–${max} ${type}`;
      return `${min} ${type}`;
    }
    return null;
  };
  const lenHint = (f) => {
    if (f.minLength && f.maxLength) {
      if (f.minLength === f.maxLength) return `${f.minLength} chars`;
      return `${f.minLength}–${f.maxLength} chars`;
    }
    if (f.maxLength) return `max ${f.maxLength} chars`;
    return regexToHint(f.regex);
  };

  // ---- Xe field card (unchanged structure) -------------------------------
  const renderXeField = (f, country) => {
    const meaning = xeData.meanings[f.id] || {};
    const countrySpec = meaning.countrySpecific?.[country];
    const displayLabel = countrySpec?.label || meaning.shortName || f.label;
    const description = countrySpec?.description || meaning.description || '';
    const example = countrySpec?.example || meaning.example;
    const hint = regexToHint(f.regex);

    const card = document.createElement('div');
    card.className = 'field-card';
    card.setAttribute('data-mandatory', f.mandatory ? '1' : '0');
    card.innerHTML = `
      <div class="field-title">
        <span class="field-label">${displayLabel}</span>
        <span class="field-id">${f.id}</span>
        <span class="field-badge ${f.mandatory ? 'req' : 'opt'}">${f.mandatory ? 'Required' : 'Optional'}</span>
      </div>
      ${description ? `<p class="field-desc">${description}</p>` : ''}
      <div class="field-meta">
        ${hint ? `<span>Length: ${hint}</span>` : ''}
        ${example ? `<span>Example: <code>${example}</code></span>` : ''}
        ${f.enrichable ? `<span class="tag tag-auto">Auto-enriched</span>` : ''}
      </div>
    `;
    return card;
  };

  // ---- Wise field card ---------------------------------------------------
  const renderWiseField = (f) => {
    const card = document.createElement('div');
    card.className = 'field-card';
    card.setAttribute('data-mandatory', f.mandatory ? '1' : '0');
    const hint = lenHint(f);
    const dropdownNote = f.optionCount ? `<span>Dropdown: ${f.optionCount} options</span>` : '';
    card.innerHTML = `
      <div class="field-title">
        <span class="field-label">${f.label}</span>
        <span class="field-id">${f.id}</span>
        <span class="field-badge ${f.mandatory ? 'req' : 'opt'}">${f.mandatory ? 'Required' : 'Optional'}</span>
      </div>
      ${f.help ? `<p class="field-desc">${f.help.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')}</p>` : ''}
      <div class="field-meta">
        ${hint ? `<span>Length: ${hint}</span>` : ''}
        ${f.placeholder ? `<span>Example: <code>${f.placeholder}</code></span>` : ''}
        ${dropdownNote}
        ${f.refreshOnChange ? `<span class="tag tag-auto">Validates live</span>` : ''}
      </div>
    `;
    return card;
  };

  // ---- Remitly field card ------------------------------------------------
  const renderRemitlyField = (f) => {
    const card = document.createElement('div');
    card.className = 'field-card';
    card.setAttribute('data-mandatory', f.mandatory ? '1' : '0');
    const hint = lenHint(f);
    const optionNote = f.optionCount ? `<span>Dropdown: ${f.optionCount} options</span>` : '';
    const typeNote = f.accountType ? `<span>Account type: <code>${f.accountType}</code></span>` : '';
    card.innerHTML = `
      <div class="field-title">
        <span class="field-label">${f.label}</span>
        <span class="field-id">${f.id}</span>
        <span class="field-badge ${f.mandatory ? 'req' : 'opt'}">${f.mandatory ? 'Required' : 'Optional'}</span>
      </div>
      ${f.help ? `<p class="field-desc">${f.help}</p>` : ''}
      <div class="field-meta">
        ${hint ? `<span>Length: ${hint}</span>` : ''}
        ${f.example ? `<span>Example: <code>${f.example}</code></span>` : ''}
        ${optionNote}
        ${typeNote}
      </div>
    `;
    return card;
  };

  // ---- Render a pane (categories + field cards) --------------------------
  const renderPane = (container, fields, renderFieldFn) => {
    container.innerHTML = '';
    const visible = (fields || []).filter(f => {
      if (renderFieldFn === renderXeField) {
        const m = xeData.meanings[f.id] || {};
        return !m.hidden;
      }
      return true;
    });
    for (const cat of CATEGORIES) {
      const catFields = visible.filter(f => f.category === cat.id);
      if (!catFields.length) continue;
      catFields.sort((a, b) => (b.mandatory - a.mandatory));
      const section = document.createElement('section');
      section.className = 'category';
      section.innerHTML = `<h2 class="category-title"><span class="cat-icon cat-${cat.icon}"></span>${cat.label} <span class="count">${catFields.length}</span></h2>`;
      const grid = document.createElement('div');
      grid.className = 'field-grid';
      for (const f of catFields) grid.appendChild(renderFieldFn(f));
      section.appendChild(grid);
      container.appendChild(section);
    }
    return visible;
  };

  // ---- Wise branch tabs --------------------------------------------------
  let currentWiseCurrency = null;
  let currentWiseBranchIdx = 0;

  const renderWiseBranch = () => {
    wiseTabs.innerHTML = '';
    resultsWise.innerHTML = '';
    const cur = wiseData?.currencies?.[currentWiseCurrency];

    if (!cur) {
      wiseStats.innerHTML = '<span class="pane-stat">—</span>';
      resultsWise.innerHTML = `<div class="pane-missing">
        Wise does not support <strong>${currentWiseCurrency || '—'}</strong> as a send-to currency,
        or the audit didn't capture it.<br>
        <small>Wise covers ~56 currencies via local rails; other destinations go via SWIFT using the <code>USD</code> or <code>EUR</code> entry.</small>
      </div>`;
      updateComparison(null);
      return;
    }

    if (cur.branches.length > 1) {
      cur.branches.forEach((b, i) => {
        const tab = document.createElement('button');
        tab.className = 'branch-tab' + (i === currentWiseBranchIdx ? ' active' : '');
        tab.textContent = b.name;
        tab.addEventListener('click', () => {
          currentWiseBranchIdx = i;
          renderWiseBranch();
        });
        wiseTabs.appendChild(tab);
      });
    }

    const branch = cur.branches[currentWiseBranchIdx] || cur.branches[0];
    if (!branch) return;

    if (branch.alert) {
      const alert = document.createElement('div');
      alert.className = 'branch-alert';
      alert.textContent = branch.alert.replace(/\s+/g, ' ').trim();
      resultsWise.appendChild(alert);
    }

    const visible = renderPane(resultsWise, branch.fields, renderWiseField);
    const req = visible.filter(f => f.mandatory).length;
    wiseStats.innerHTML = `
      <span class="pane-stat"><span class="pane-stat-num">${req}</span>required</span>
      <span class="pane-stat"><span class="pane-stat-num">${visible.length - req}</span>optional</span>
    `;
    currentWiseFields = visible;
    updateComparison({ required: req, total: visible.length, fields: visible, branch: branch.name });
    buildFieldMatrix();
  };
  let currentWiseFields = [];

  // ---- Remitly pane render ------------------------------------------------
  let currentRemitlyMetrics = null;
  const renderRemitly = (countryCodeISO2) => {
    resultsRemitly.innerHTML = '';
    remitlyMeta.innerHTML = '';
    const entry = remitlyByCountry[countryCodeISO2];
    if (!entry) {
      remitlyStats.innerHTML = '<span class="pane-stat">—</span>';
      resultsRemitly.innerHTML = `<div class="pane-missing">
        Remitly does not operate on <strong>${countryNames[countryCodeISO2] || countryCodeISO2}</strong>,
        or not captured in this session.
      </div>`;
      currentRemitlyMetrics = null;
      return;
    }
    // Meta strip — destinations summary + key rules
    const typeBadges = Object.entries(entry.destinationTypes || {})
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `<span class="pill"><strong>${n}</strong> ${t.replace(/_/g, ' ').toLowerCase()}</span>`)
      .join('');
    const sampleB = entry.sampleBank;
    remitlyMeta.innerHTML = `
      <div class="remitly-meta-row">
        <span class="remitly-stat"><strong>${entry.destinationCount}</strong> destinations</span>
        ${entry.receiveCurrency ? `<span class="remitly-stat">receives <strong>${entry.receiveCurrency}</strong></span>` : ''}
        ${entry.nameConfig?.lastNameFirst ? '<span class="remitly-stat">last name first</span>' : ''}
        ${entry.mobileOnly ? '<span class="remitly-stat">mobile-only phone</span>' : ''}
      </div>
      <div class="remitly-pills">${typeBadges}</div>
      ${sampleB ? `<div class="remitly-sample">
        <strong>Sample bank:</strong> ${sampleB.name}
        ${sampleB.accountType ? ` · ${sampleB.accountType}` : ''}
        ${sampleB.placeholder ? ` · e.g. <code>${sampleB.placeholder}</code>` : ''}
      </div>` : ''}
    `;
    const visible = renderPane(resultsRemitly, entry.fields, renderRemitlyField);
    const req = visible.filter(f => f.mandatory).length;
    remitlyStats.innerHTML = `
      <span class="pane-stat"><span class="pane-stat-num">${req}</span>required</span>
      <span class="pane-stat"><span class="pane-stat-num">${visible.length - req}</span>optional</span>
    `;
    currentRemitlyMetrics = { required: req, total: visible.length, fields: visible };
  };

  // ---- Unified field matrix — shows all fields across Xe / Wise / Remitly ---
  const CATEGORY_ORDER = ['recipient', 'bank', 'address', 'id', 'additional'];
  const buildFieldMatrix = () => {
    if (!window.__xeMetrics && !currentRemitlyMetrics) {
      fieldMatrix.innerHTML = '';
      fieldMatrix.classList.remove('active');
      return;
    }
    // Normalize each provider's fields to a common key so we can align rows.
    // Key = category + semantic label (since IDs differ between providers).
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
      .replace(/\b(mobile|cell)\b/g, 'phone')
      .replace(/\b(surname|family name|second last name)\b/g, 'last name')
      .replace(/\bgiven name\b/g, 'first name')
      .replace(/\baccount (number|no)\b/g, 'account number')
      .replace(/\b(iban|clabe|cbu|cvu|vpa)\b/g, 'account number')
      .replace(/\b(ifsc|swift|bic|sort code|routing number|bsb|transit)\b/g, 'branch code')
      .replace(/\b(post(al)? code|zip|zipcode)\b/g, 'postal code')
      .replace(/\b(state|province|region|subdivision)\b/g, 'state');

    const makeRow = (f) => ({
      key: `${f.category}::${norm(f.label || f.id)}`,
      category: f.category || 'additional',
      label: f.label || f.id,
      mandatory: !!f.mandatory,
    });

    const matrix = new Map();
    const addFields = (fields, provider) => {
      for (const f of fields || []) {
        const row = makeRow(f);
        if (!matrix.has(row.key)) {
          matrix.set(row.key, { category: row.category, label: row.label, providers: { xe: null, wise: null, remitly: null } });
        }
        const rec = matrix.get(row.key);
        rec.providers[provider] = { mandatory: row.mandatory, label: f.label };
      }
    };
    if (window.__xeMetrics) addFields(window.__xeMetrics.fields, 'xe');
    addFields(currentWiseFields, 'wise');
    if (currentRemitlyMetrics) addFields(currentRemitlyMetrics.fields, 'remitly');

    // Group by category, sort rows: required-by-anyone first, then alpha
    const byCat = {};
    for (const row of matrix.values()) {
      const cat = row.category;
      (byCat[cat] ||= []).push(row);
    }
    for (const cat of Object.keys(byCat)) {
      byCat[cat].sort((a, b) => {
        const ar = Object.values(a.providers).some(p => p?.mandatory) ? 0 : 1;
        const br = Object.values(b.providers).some(p => p?.mandatory) ? 0 : 1;
        if (ar !== br) return ar - br;
        return a.label.localeCompare(b.label);
      });
    }

    const cell = (p) => {
      if (!p) return '<td class="matrix-cell matrix-na" title="Not asked"><span>—</span></td>';
      if (p.mandatory) return '<td class="matrix-cell matrix-req" title="Required"><span>●</span></td>';
      return '<td class="matrix-cell matrix-opt" title="Optional"><span>○</span></td>';
    };

    let html = `
      <div class="matrix-header">
        <h2>What each provider asks</h2>
        <div class="matrix-legend">
          <span><span class="matrix-dot req">●</span> Required</span>
          <span><span class="matrix-dot opt">○</span> Optional</span>
          <span><span class="matrix-dot na">—</span> Not asked</span>
        </div>
      </div>
      <table class="matrix-table"><thead><tr>
        <th style="width:42%;">Field</th>
        <th style="width:10%;">Category</th>
        <th class="provider-col xe-col">Xe</th>
        <th class="provider-col wise-col">Wise</th>
        <th class="provider-col remitly-col">Remitly</th>
      </tr></thead><tbody>`;

    const catLabels = { recipient: '👤 Recipient', bank: '🏦 Bank Details', address: '📍 Address', id: '🆔 ID / Tax', additional: '➕ Additional' };
    for (const cat of CATEGORY_ORDER) {
      const rows = byCat[cat];
      if (!rows?.length) continue;
      html += `<tr class="matrix-category-header"><td colspan="5">${catLabels[cat] || cat}</td></tr>`;
      for (const row of rows) {
        const anyReq = Object.values(row.providers).some(p => p?.mandatory);
        const missingFromSome = Object.values(row.providers).some(p => !p) && Object.values(row.providers).some(p => p);
        const rowClass = missingFromSome ? 'matrix-row-gap' : (anyReq ? 'matrix-row-req' : '');
        html += `<tr class="${rowClass}">
          <td class="matrix-field-label">${row.label}</td>
          <td class="matrix-category">${cat}</td>
          ${cell(row.providers.xe)}
          ${cell(row.providers.wise)}
          ${cell(row.providers.remitly)}
        </tr>`;
      }
    }
    html += '</tbody></table>';
    fieldMatrix.innerHTML = html;
    fieldMatrix.classList.add('active');
  };

  // ---- Comparison banner --------------------------------------------------
  const updateComparison = (wiseMetrics) => {
    const xeMeta = window.__xeMetrics;
    if (!xeMeta || !wiseMetrics) { cmpBanner.classList.remove('active'); return; }
    const delta = xeMeta.required - wiseMetrics.required;
    const xeHasAddr = xeMeta.fields.some(f => f.category === 'address' && f.mandatory);
    const wiseHasAddr = wiseMetrics.fields.some(f => f.category === 'address' && f.mandatory);
    const xeHasId = xeMeta.fields.some(f => f.category === 'id' && f.mandatory);
    const wiseHasId = wiseMetrics.fields.some(f => f.category === 'id' && f.mandatory);

    const deltaClass = delta > 0 ? 'delta-worse' : delta < 0 ? 'delta-better' : '';
    const deltaLabel = delta > 0
      ? `Xe asks for ${delta} more required field${delta === 1 ? '' : 's'}`
      : delta < 0
      ? `Wise asks for ${-delta} more required field${-delta === 1 ? '' : 's'}`
      : 'Same number of required fields';

    cmpBanner.classList.add('active');
    cmpBanner.innerHTML = `
      <div class="cmp-title">Friction comparison for ${countryNames[currentCountry] || currentCountry} · ${currentCurrency}</div>
      <div class="cmp-metrics">
        <div class="cmp-metric">
          <div class="cmp-metric-label">Required fields</div>
          <div class="cmp-metric-value">Xe ${xeMeta.required} · Wise ${wiseMetrics.required}</div>
          <div class="cmp-metric-sub ${deltaClass}">${deltaLabel}</div>
        </div>
        <div class="cmp-metric">
          <div class="cmp-metric-label">Address required?</div>
          <div class="cmp-metric-value">Xe ${xeHasAddr ? 'YES' : 'NO'} · Wise ${wiseHasAddr ? 'YES' : 'NO'}</div>
          <div class="cmp-metric-sub">${xeHasAddr && !wiseHasAddr ? 'Wise skips it (lower friction)' : xeHasAddr === wiseHasAddr ? 'Parity' : 'Wise asks, Xe does not'}</div>
        </div>
        <div class="cmp-metric">
          <div class="cmp-metric-label">ID / Tax required?</div>
          <div class="cmp-metric-value">Xe ${xeHasId ? 'YES' : 'NO'} · Wise ${wiseHasId ? 'YES' : 'NO'}</div>
          <div class="cmp-metric-sub">${wiseHasId === xeHasId ? 'Parity' : wiseHasId ? 'Wise asks, Xe does not' : 'Xe asks, Wise does not'}</div>
        </div>
        <div class="cmp-metric">
          <div class="cmp-metric-label">Wise rail</div>
          <div class="cmp-metric-value">${wiseMetrics.branch || '—'}</div>
          <div class="cmp-metric-sub">${wiseData.currencies[currentWiseCurrency]?.branchCount > 1 ? wiseData.currencies[currentWiseCurrency].branchCount + ' rail options' : 'Single rail'}</div>
        </div>
      </div>
    `;
  };

  // ---- Render full corridor (both panes) ---------------------------------
  let currentCountry = null;
  let currentCurrency = null;

  const render = (country, currency) => {
    currentCountry = country;
    currentCurrency = currency;
    currentWiseCurrency = currency;
    currentWiseBranchIdx = 0;

    const key = `${country}_${currency}`;
    const corr = xeData.corridors[key];

    // Xe pane
    if (!corr) {
      results.innerHTML = `<div class="empty">No Xe data for ${country} / ${currency}</div>`;
      xeStats.innerHTML = '<span class="pane-stat">—</span>';
      meta.textContent = '';
      window.__xeMetrics = null;
    } else {
      const visible = renderPane(results, corr.fields, (f) => renderXeField(f, country));
      const req = visible.filter(f => f.mandatory).length;
      xeStats.innerHTML = `
        <span class="pane-stat"><span class="pane-stat-num">${req}</span>required</span>
        <span class="pane-stat"><span class="pane-stat-num">${visible.length - req}</span>optional</span>
      `;
      window.__xeMetrics = { required: req, total: visible.length, fields: visible };

      const countryName = countryNames[country] || country;
      meta.innerHTML = `<strong>${countryName}</strong> · ${currency} · Bank transfer`;
    }

    // Wise pane
    renderWiseBranch();

    // Remitly pane
    renderRemitly(country);
    buildFieldMatrix();
    renderGapSpotlight(country, currency);
  };

  // ---- Gap spotlight (per-country insight card) --------------------------
  const gapSpotlight = document.getElementById('gap-spotlight');
  const renderGapSpotlight = (country, currency) => {
    if (!gapAnalysis?.byCountry) { gapSpotlight.classList.remove('active'); return; }
    const key = `${country}_${currency}`;
    const g = gapAnalysis.byCountry[key];
    if (!g) { gapSpotlight.classList.remove('active'); return; }

    const maxCount = Math.max(g.xeRequired, g.wiseRequired || 0, g.remitlyRequired || 0, 1);
    const xePct = (g.xeRequired / maxCount) * 100;
    const wisePct = g.wiseRequired != null ? (g.wiseRequired / maxCount) * 100 : 0;
    const remPct = g.remitlyRequired != null ? (g.remitlyRequired / maxCount) * 100 : 0;
    const bestProvider = [
      { name: 'Xe', count: g.xeRequired },
      { name: 'Wise', count: g.wiseRequired },
      { name: 'Remitly', count: g.remitlyRequired },
    ].filter(p => p.count != null).sort((a, b) => a.count - b.count)[0];
    const worstDelta = Math.max(g.frictionDeltaWise || 0, g.frictionDeltaRemitly || 0);

    const missingChips = g.xeMissing.length
      ? g.xeMissing.map(m => {
          const tag = m.askedByWise && m.askedByRemitly ? 'Both' : m.askedByWise ? 'Wise' : 'Remitly';
          return `<span class="gap-chip miss">${m.norm}<span class="gap-chip-tag">${tag}</span></span>`;
        }).join('')
      : '<span class="gap-empty">Nothing competitors require that Xe misses.</span>';

    const extraChips = g.xeExtra.length
      ? g.xeExtra.map(e => `<span class="gap-chip extra">${e.norm}</span>`).join('')
      : '<span class="gap-empty">Xe is not asking for anything extra on this corridor.</span>';

    const summaryText = worstDelta > 0
      ? `<strong>${countryNames[country] || country}</strong> · ${currency} — Xe asks <strong>${worstDelta} more required fields</strong> than ${bestProvider.name}.`
      : `<strong>${countryNames[country] || country}</strong> · ${currency} — Xe is at parity or lighter than competitors on this corridor.`;

    gapSpotlight.innerHTML = `
      <div class="gap-spotlight-header">
        <div class="gap-spotlight-title">${summaryText}</div>
      </div>
      <div class="gap-bars">
        <div class="gap-bar-block">
          <div class="gap-bar-provider xe">Xe</div>
          <div class="gap-bar-count">${g.xeRequired}</div>
          <div class="gap-bar-label">required fields</div>
          <div class="gap-bar-viz"><div class="gap-bar-fill xe" style="width:${xePct}%;"></div></div>
        </div>
        <div class="gap-bar-block">
          <div class="gap-bar-provider wise">Wise</div>
          <div class="gap-bar-count">${g.wiseRequired ?? '—'}</div>
          <div class="gap-bar-label">${g.wiseRequired != null ? 'required fields' : 'not on this currency'}</div>
          <div class="gap-bar-viz"><div class="gap-bar-fill wise" style="width:${wisePct}%;"></div></div>
        </div>
        <div class="gap-bar-block">
          <div class="gap-bar-provider remitly">Remitly</div>
          <div class="gap-bar-count">${g.remitlyRequired ?? '—'}</div>
          <div class="gap-bar-label">${g.remitlyRequired != null ? 'required fields' : 'not on this corridor'}</div>
          <div class="gap-bar-viz"><div class="gap-bar-fill remitly" style="width:${remPct}%;"></div></div>
        </div>
      </div>
      <div class="gap-details">
        <div class="gap-detail-box">
          <div class="gap-detail-title xe-missing">
            <span class="gap-detail-icon miss">−</span>
            What Xe is <strong style="color:var(--color-req);">missing</strong>
          </div>
          <div class="gap-chips">${missingChips}</div>
        </div>
        <div class="gap-detail-box">
          <div class="gap-detail-title xe-extra">
            <span class="gap-detail-icon extra">+</span>
            Extra friction Xe adds (competitors don't ask)
          </div>
          <div class="gap-chips">${extraChips}</div>
        </div>
      </div>
    `;
    gapSpotlight.classList.add('active');
  };

  // ---- Global insights (bottom) ------------------------------------------
  const renderGlobalInsights = () => {
    const el = document.getElementById('global-insights');
    if (!gapAnalysis?.global) { el.innerHTML = ''; return; }
    const g = gapAnalysis.global;
    const cap = (s) => s.replace(/\b\w/g, c => c.toUpperCase());
    const missingRows = g.xeMissingFieldsTop.slice(0, 6).map(m => `
      <div class="insight-bar">
        <div class="insight-bar-label">${m.field}</div>
        <div class="insight-bar-meter"><div class="insight-bar-meter-fill" style="width:${m.pctOfCorridors}%"></div></div>
        <div class="insight-bar-count">${m.count} / ${m.pctOfCorridors}%</div>
      </div>
    `).join('');
    const extraRows = g.xeExtraFieldsTop.slice(0, 6).map(m => `
      <div class="insight-bar">
        <div class="insight-bar-label">${m.field}</div>
        <div class="insight-bar-meter"><div class="insight-bar-meter-fill" style="width:${m.pctOfCorridors}%"></div></div>
        <div class="insight-bar-count">${m.count} / ${m.pctOfCorridors}%</div>
      </div>
    `).join('');
    const frictionRows = g.mostFrictionCorridors.slice(0, 10).map(c => `
      <tr>
        <td>${c.countryName} · ${c.currency}</td>
        <td class="friction-count-xe">${c.xeRequired}</td>
        <td class="friction-count-other">${c.wiseRequired ?? '—'}</td>
        <td class="friction-count-other">${c.remitlyRequired ?? '—'}</td>
        <td class="friction-delta">+${c.maxDelta}</td>
      </tr>
    `).join('');

    el.innerHTML = `
      <h2>Global patterns across ${gapAnalysis.meta.countriesAnalyzed} corridors</h2>
      <div class="insight-grid">
        <div class="insight-card missing">
          <div class="insight-card-title">
            <span class="gap-detail-icon miss">−</span>
            Fields competitors require that Xe doesn't
          </div>
          ${missingRows}
        </div>
        <div class="insight-card extra">
          <div class="insight-card-title">
            <span class="gap-detail-icon extra">+</span>
            Fields Xe requires that competitors don't
          </div>
          ${extraRows}
        </div>
      </div>
      <div class="friction-leaderboard">
        <h3>Corridors with the biggest Xe friction delta</h3>
        <table class="friction-table">
          <thead>
            <tr>
              <th>Corridor</th>
              <th>Xe</th>
              <th>Wise</th>
              <th>Remitly</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>${frictionRows}</tbody>
        </table>
      </div>
    `;
  };
  renderGlobalInsights();

  // ---- Pane toggle -------------------------------------------------------
  const paneToggle = document.getElementById('pane-toggle');
  const resultsSplit = document.getElementById('results-split');
  let panesOpen = false;
  paneToggle.addEventListener('click', () => {
    panesOpen = !panesOpen;
    resultsSplit.style.display = panesOpen ? 'grid' : 'none';
    paneToggle.textContent = panesOpen ? '▲ Hide provider detail views' : '▼ Show provider detail views';
  });

  // ---- Events ------------------------------------------------------------
  const refresh = () => {
    const country = countrySel.value;
    populateCurrencies(country);
    render(country, currencySel.value);
  };

  searchInp.addEventListener('input', () => {
    populateCountries(searchInp.value);
    if (countrySel.options.length) { countrySel.selectedIndex = 0; refresh(); }
  });
  countrySel.addEventListener('change', refresh);
  currencySel.addEventListener('change', () => render(countrySel.value, currencySel.value));

  // Init — default to IN (India)
  const defaultCountry = countriesSorted.includes('IN') ? 'IN' : countriesSorted[0];
  countrySel.value = defaultCountry;
  populateCurrencies(defaultCountry);
  const localPref = { IN: 'INR', GB: 'GBP', CA: 'CAD', AU: 'AUD', PK: 'PKR', BR: 'BRL', MX: 'MXN', DE: 'EUR' };
  if (localPref[defaultCountry] && [...currencySel.options].some(o => o.value === localPref[defaultCountry])) {
    currencySel.value = localPref[defaultCountry];
  }
  render(defaultCountry, currencySel.value);

  // Footer timestamps
  $('audit-timestamp').textContent = new Date(xeData.meta.generated).toLocaleDateString();
  if (wiseData) {
    $('wise-timestamp').textContent = new Date(wiseData.meta.generated).toLocaleDateString();
    $('wise-coverage').textContent = `${wiseData.meta.successful} currencies, ${Object.keys(wiseData.currencies).length} captured`;
  } else {
    $('wise-timestamp').textContent = '—';
    $('wise-coverage').textContent = 'data not loaded';
  }
  if (remitlyData?.meta) {
    $('remitly-timestamp').textContent = new Date(remitlyData.meta.generated).toLocaleDateString();
    $('remitly-coverage').textContent = `${remitlyData.meta.targetsCovered} target countries`;
  } else {
    $('remitly-timestamp').textContent = '—';
    $('remitly-coverage').textContent = 'data not loaded';
  }
})();

/**
 * Xe Event Documentation Portal
 * Main application — data loading, routing, rendering
 */

let DATA = null;
let ERROR_REF = null;
let HEALTH = null;
let BALANCE = null;
let SPEED = null;
let RETENTION = null;
let MOBILEWEB = null;
let BALSENDS = null;
let mobileWebView = 'overview'; // overview | corridor_detail
let retentionView = 'overview'; // overview | frequency | amount | currency
let fuseIndex = null;
let currentFilter = { category: null, platform: null, source: null };
let speedPaymentFilter = 'all';
let speedRegionFilter = 'all';
let speedPeriod = '30d'; // 30d | 90d
let speedView = 'corridor';

// --- Init ---
async function init() {
  try {
    const [evtRes, errRes, hlthRes, balRes, spdRes, retRes, mwRes, bsRes] = await Promise.all([
      fetch('data/events.json'),
      fetch('data/error-reference.json').catch(() => null),
      fetch('data/health-check.json').catch(() => null),
      fetch('data/balance-tracker.json').catch(() => null),
      fetch('data/payment-speed.json?v=' + Date.now()).catch(() => null),
      fetch('data/retention-intent.json').catch(() => null),
      fetch('data/mobile-web-funnels.json').catch(() => null),
      fetch('data/balance-sends.json').catch(() => null)
    ]);
    DATA = await evtRes.json();
    if (errRes && errRes.ok) ERROR_REF = await errRes.json();
    if (hlthRes && hlthRes.ok) HEALTH = await hlthRes.json();
    if (balRes && balRes.ok) BALANCE = await balRes.json();
    if (spdRes && spdRes.ok) SPEED = await spdRes.json();
    if (retRes && retRes.ok) RETENTION = await retRes.json();
    if (mwRes && mwRes.ok) MOBILEWEB = await mwRes.json();
    if (bsRes && bsRes.ok) BALSENDS = await bsRes.json();
    initSearch();
    renderSidebar();
    renderStats();
    handleRoute();
    window.addEventListener('hashchange', handleRoute);
  } catch (e) {
    document.getElementById('content').innerHTML =
      '<div class="loading">Error: ' + e.message + '<br><br>Stack: ' + e.stack.replace(/\n/g, '<br>') + '</div>';
    console.error(e);
  }
}

// --- Search ---
function initSearch() {
  const events = Object.values(DATA.events);
  fuseIndex = new Fuse(events, {
    keys: [
      { name: 'name', weight: 1.0 },
      { name: 'constants.web', weight: 0.6 },
      { name: 'constants.app', weight: 0.6 },
      { name: 'trigger', weight: 0.4 },
      { name: 'category', weight: 0.3 },
    ],
    threshold: 0.35,
    includeMatches: true,
    minMatchCharLength: 2,
  });

  const input = document.getElementById('search-input');
  const dropdown = document.getElementById('search-dropdown');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 2) {
      dropdown.classList.remove('active');
      return;
    }
    const results = fuseIndex.search(q, { limit: 12 });
    if (results.length === 0) {
      dropdown.classList.remove('active');
      return;
    }
    dropdown.innerHTML = results.map(r => {
      const e = r.item;
      const catName = getCategoryName(e.category);
      const badges = e.platforms.map(p => `<span class="badge badge-${p.toLowerCase().replace(' ', '-')}">${p}</span>`).join('');
      return `<a class="search-result-item" href="#/event/${encodeURIComponent(e.name)}">
        <span class="search-result-name">${escapeHtml(e.name)}</span>
        ${badges}
        <span class="search-result-category">${catName}</span>
      </a>`;
    }).join('');
    dropdown.classList.add('active');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q.length >= 2) {
        dropdown.classList.remove('active');
        location.hash = `#/search/${encodeURIComponent(q)}`;
      }
    }
    if (e.key === 'Escape') {
      dropdown.classList.remove('active');
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
      dropdown.classList.remove('active');
    }
  });
}

// --- Routing ---
function handleRoute() {
  const hash = location.hash || '#/';
  const content = document.getElementById('content');

  if (hash.startsWith('#/event/')) {
    const name = decodeURIComponent(hash.replace('#/event/', ''));
    renderEventDetail(name);
  } else if (hash.startsWith('#/category/')) {
    const cat = hash.replace('#/category/', '');
    currentFilter.category = cat;
    renderEventList();
    setActiveCategory(cat);
  } else if (hash.startsWith('#/search/')) {
    const q = decodeURIComponent(hash.replace('#/search/', ''));
    document.getElementById('search-input').value = q;
    renderSearchResults(q);
  } else if (hash === '#/funnels') {
    renderFunnelView();
  } else if (hash === '#/errors') {
    renderErrorReference();
  } else if (hash === '#/health') {
    renderHealthCheck();
  } else if (hash.startsWith('#/balance')) {
    renderBalanceTracker();
  } else if (hash.startsWith('#/speed')) {
    renderPaymentSpeed();
  } else if (hash.startsWith('#/retention')) {
    renderRetentionIntent();
  } else if (hash.startsWith('#/mobile-web')) {
    renderMobileWeb();
  } else {
    currentFilter = { category: null, platform: null, source: null };
    renderEventList();
    setActiveCategory(null);
  }
}

// --- Sidebar ---
function renderSidebar() {
  const list = document.getElementById('category-list');
  list.innerHTML = `<li><a class="category-item active" href="#/" data-cat="">
    All Events <span class="category-count">${Object.keys(DATA.events).length}</span>
  </a></li>` +
  DATA.categories.map(c => `<li><a class="category-item" href="#/category/${c.id}" data-cat="${c.id}">
    ${c.name} <span class="category-count">${c.eventCount}</span>
  </a></li>`).join('') +
  `<li style="margin-top:12px"><a class="category-item" href="#/funnels" data-cat="funnels">
    Funnels <span class="category-count">${Object.keys(DATA.funnels).length}</span>
  </a></li>` +
  `<li><a class="category-item" href="#/errors" data-cat="errors" style="color:var(--color-error)">
    Error Reference <span class="category-count">${ERROR_REF ? Object.keys(ERROR_REF.errors).length : '?'}</span>
  </a></li>` +
  `<li><a class="category-item" href="#/health" data-cat="health" style="color:var(--color-success); font-weight:700">
    Health Check
  </a></li>` +
  `<li><a class="category-item" href="#/balance" data-cat="balance" style="color:var(--color-warning); font-weight:700">
    Balance Tracker
  </a></li>` +
  `<li><a class="category-item" href="#/speed" data-cat="speed" style="color:#4A90D9; font-weight:700">
    Payment Speed
  </a></li>` +
  `<li><a class="category-item" href="#/retention" data-cat="retention" style="color:#9B59B6; font-weight:700">
    Retention vs Intent
  </a></li>` +
  `<li><a class="category-item" href="#/mobile-web" data-cat="mobile-web" style="color:#E67E22; font-weight:700">
    Mobile Web Funnels
  </a></li>`;
}

function setActiveCategory(cat) {
  document.querySelectorAll('.category-item').forEach(el => {
    el.classList.toggle('active', el.dataset.cat === (cat || ''));
  });
}

// --- Stats ---
function renderStats() {
  document.getElementById('header-stats').textContent =
    `${DATA.meta.totalEvents} events | ${DATA.meta.crossPlatform} cross-platform | ${DATA.meta.serverSide || 0} backend | ${DATA.meta.withCodeLocations} with code refs`;
}

// --- Event List ---
function renderEventList() {
  const content = document.getElementById('content');
  let events = Object.values(DATA.events);

  if (currentFilter.category) {
    events = events.filter(e => e.category === currentFilter.category);
  }
  if (currentFilter.platform) {
    events = events.filter(e => e.platforms.includes(currentFilter.platform));
  }
  if (currentFilter.source) {
    events = events.filter(e => e.source === currentFilter.source);
  }

  events.sort((a, b) => a.name.localeCompare(b.name));

  const catTitle = currentFilter.category
    ? getCategoryName(currentFilter.category)
    : 'All Events';

  content.innerHTML = `
    <div class="filter-bar">
      <button class="filter-pill ${!currentFilter.source ? 'active' : ''}" onclick="setSourceFilter(null)">All Sources</button>
      <button class="filter-pill ${currentFilter.source === 'cross_platform' ? 'active' : ''}" onclick="setSourceFilter('cross_platform')">Cross-Platform</button>
      <button class="filter-pill ${currentFilter.source === 'web_only' ? 'active' : ''}" onclick="setSourceFilter('web_only')">Web Only</button>
      <button class="filter-pill ${currentFilter.source === 'mobile_only' ? 'active' : ''}" onclick="setSourceFilter('mobile_only')">Mobile Only</button>
      <button class="filter-pill ${currentFilter.source === 'server_side' ? 'active' : ''}" onclick="setSourceFilter('server_side')">Backend</button>
      <button class="filter-pill ${currentFilter.source === 'third_party' ? 'active' : ''}" onclick="setSourceFilter('third_party')">Third-Party</button>
    </div>
    <div class="filter-bar">
      <button class="filter-pill ${!currentFilter.platform ? 'active' : ''}" onclick="setPlatformFilter(null)">All Platforms</button>
      <button class="filter-pill ${currentFilter.platform === 'Web' ? 'active' : ''}" onclick="setPlatformFilter('Web')">Web</button>
      <button class="filter-pill ${currentFilter.platform === 'iOS' ? 'active' : ''}" onclick="setPlatformFilter('iOS')">iOS</button>
      <button class="filter-pill ${currentFilter.platform === 'Android' ? 'active' : ''}" onclick="setPlatformFilter('Android')">Android</button>
    </div>
    <h2 style="font-size:16px; margin-bottom:12px; color:var(--color-text-secondary)">${catTitle} (${events.length})</h2>
    <div class="event-grid">
      ${events.map(e => renderEventCard(e)).join('')}
    </div>
  `;
}

function renderEventCard(e) {
  const badges = e.platforms.map(p =>
    `<span class="badge badge-${p.toLowerCase()}">${p}</span>`
  ).join('');

  const locCount = (e.codeLocations?.galileo?.length || 0) + (e.codeLocations?.apollo?.length || 0);
  const propCount = e.properties?.length || 0;

  return `<a class="event-card" href="#/event/${encodeURIComponent(e.name)}">
    <span class="event-card-name">${escapeHtml(e.name)}</span>
    <span class="event-card-category">${getCategoryName(e.category)}</span>
    <span class="event-card-locations">${locCount} refs | ${propCount} props</span>
    <span class="event-card-badges">${badges}</span>
  </a>`;
}

// --- Search Results ---
function renderSearchResults(q) {
  const results = fuseIndex.search(q, { limit: 50 });
  const content = document.getElementById('content');

  content.innerHTML = `
    <a class="back-link" href="#/">&#8592; All events</a>
    <h2 style="font-size:16px; margin-bottom:12px; color:var(--color-text-secondary)">
      Search results for "${escapeHtml(q)}" (${results.length})
    </h2>
    <div class="event-grid">
      ${results.map(r => renderEventCard(r.item)).join('')}
    </div>
  `;
}

// --- Event Detail ---
function renderEventDetail(name) {
  const e = DATA.events[name];
  const content = document.getElementById('content');

  if (!e) {
    content.innerHTML = `<div class="loading">Event "${escapeHtml(name)}" not found.</div>`;
    return;
  }

  const sourceBadge = {
    cross_platform: '<span class="badge badge-cross">Cross-Platform</span>',
    web_only: '<span class="badge badge-web-only">Web Only</span>',
    mobile_only: '<span class="badge badge-mobile-only">Mobile Only</span>',
    server_side: '<span class="badge badge-server">Backend/Server</span>',
    third_party: '<span class="badge badge-third-party">Third-Party</span>',
    appsflyer: '<span class="badge badge-appsflyer">AppsFlyer</span>',
  }[e.source] || '';

  const platformBadges = e.platforms.map(p =>
    `<span class="badge badge-${p.toLowerCase()}">${p}</span>`
  ).join(' ');

  content.innerHTML = `
    <a class="back-link" href="#/">&#8592; All events</a>
    <div class="event-detail">
      ${renderDetailHeader(e, sourceBadge, platformBadges)}
      ${renderConstants(e)}
      ${renderCodeLocations(e)}
      ${renderProperties(e)}
      ${renderSamplePayload(e)}
      ${renderFunnelContext(e)}
      ${renderIntelligence(e)}
      ${renderIssues(e)}
    </div>
  `;
}

function renderDetailHeader(e, sourceBadge, platformBadges) {
  const catName = getCategoryName(e.category);
  return `<div class="event-detail-header">
    <div class="event-detail-breadcrumb">
      <a href="#/category/${e.category}">${catName}</a> ${sourceBadge}
    </div>
    <h1 class="event-detail-name">${escapeHtml(e.name)}</h1>
    ${e.trigger ? `<p class="event-detail-trigger">${escapeHtml(e.trigger)}</p>` : ''}
    <div class="event-detail-badges">${platformBadges}</div>
  </div>`;
}

function renderConstants(e) {
  const rows = [];
  if (e.constants.web) {
    rows.push(`<tr><td>galileo-site</td><td><code class="constant-value">${escapeHtml(e.constants.web)}</code>
      <button class="copy-btn" onclick="copyText('${escapeHtml(e.constants.web)}')">&#128203;</button></td></tr>`);
  }
  if (e.constants.app) {
    rows.push(`<tr><td>xe-apollo</td><td><code class="constant-value">${escapeHtml(e.constants.app)}</code>
      <button class="copy-btn" onclick="copyText('${escapeHtml(e.constants.app)}')">&#128203;</button></td></tr>`);
  }
  if (rows.length === 0) return '';

  return `<div class="event-detail-section">
    <h3 class="section-title">Code Constants</h3>
    <table class="constants-table">${rows.join('')}</table>
  </div>`;
}

function renderCodeLocations(e) {
  const galileoLocs = e.codeLocations?.galileo || [];
  const apolloLocs = e.codeLocations?.apollo || [];
  if (galileoLocs.length === 0 && apolloLocs.length === 0) {
    return `<div class="event-detail-section">
      <h3 class="section-title">Code Locations</h3>
      <p style="color:var(--color-text-muted); font-size:13px">No code references found. This event may be server-side or from a third-party integration.</p>
    </div>`;
  }

  let html = '<div class="event-detail-section"><h3 class="section-title">Where It Fires</h3>';

  if (galileoLocs.length > 0) {
    html += `<div class="code-location-repo">galileo-site (${galileoLocs.length} location${galileoLocs.length > 1 ? 's' : ''})</div>`;
    html += galileoLocs.map(loc => `<div class="code-location">
      <div class="code-location-file">${escapeHtml(loc.file)}:${loc.line}</div>
      ${loc.context ? `<div class="code-location-context">${escapeHtml(loc.context)}</div>` : ''}
    </div>`).join('');
  }

  if (apolloLocs.length > 0) {
    html += `<div class="code-location-repo">xe-apollo (${apolloLocs.length} location${apolloLocs.length > 1 ? 's' : ''})</div>`;
    html += apolloLocs.map(loc => `<div class="code-location">
      <div class="code-location-file">${escapeHtml(loc.file)}:${loc.line}</div>
      ${loc.context ? `<div class="code-location-context">${escapeHtml(loc.context)}</div>` : ''}
    </div>`).join('');
  }

  html += '</div>';
  return html;
}

function renderProperties(e) {
  const props = e.properties || [];
  if (props.length === 0 && !DATA.autoProperties) return '';

  // Split explicit and auto-injected
  const explicit = props.filter(p => p.source !== 'auto');
  const auto = props.filter(p => p.source === 'auto');

  // Add platform auto-properties if not already listed
  const autoNames = new Set(auto.map(p => p.name));
  if (e.platforms.includes('Web')) {
    for (const ap of DATA.autoProperties.web) {
      if (!autoNames.has(ap.name)) {
        auto.push({ ...ap, source: 'auto', platforms: ['Web'] });
        autoNames.add(ap.name);
      }
    }
  }
  if (e.platforms.includes('iOS') || e.platforms.includes('Android')) {
    for (const ap of DATA.autoProperties.mobile) {
      if (!autoNames.has(ap.name)) {
        auto.push({ ...ap, source: 'auto', platforms: e.platforms.filter(p => p !== 'Web') });
        autoNames.add(ap.name);
      }
    }
  }

  const allProps = [...explicit, ...auto];
  if (allProps.length === 0) return '';

  const rows = allProps.map(p => {
    const isAuto = p.source === 'auto';
    const platStr = Array.isArray(p.platforms)
      ? (p.platforms.length >= 3 ? 'All' : p.platforms.join(', '))
      : 'All';
    const example = p.example !== undefined && p.example !== ''
      ? `<span class="prop-example">${typeof p.example === 'string' ? `"${escapeHtml(p.example)}"` : p.example}</span>`
      : '<span style="color:var(--color-text-muted)">—</span>';

    return `<tr class="${isAuto ? 'auto-prop' : ''}">
      <td><span class="prop-name">${escapeHtml(p.name)}</span> ${isAuto ? '<span class="badge badge-auto">auto</span>' : ''}</td>
      <td><span class="prop-type">${p.type || 'string'}</span></td>
      <td>${escapeHtml(p.description || '')}</td>
      <td>${example}</td>
      <td>${platStr}</td>
    </tr>`;
  }).join('');

  return `<div class="event-detail-section">
    <h3 class="section-title">Properties</h3>
    <table class="props-table">
      <thead><tr><th>Property</th><th>Type</th><th>Description</th><th>Example</th><th>Platforms</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderSamplePayload(e) {
  if (!e.samplePayload) return '';

  const json = JSON.stringify(e.samplePayload, null, 2);
  return `<div class="event-detail-section">
    <h3 class="section-title">Sample Payload</h3>
    <div class="sample-payload"><button class="copy-btn" onclick="copyText(this.parentElement.textContent)">&#128203;</button>${escapeHtml(json)}</div>
  </div>`;
}

function renderFunnelContext(e) {
  if (!e.funnels || e.funnels.length === 0) return '';

  let html = '<div class="event-detail-section"><h3 class="section-title">Funnel Context</h3>';

  for (const funnelKey of e.funnels) {
    const funnel = DATA.funnels[funnelKey];
    if (!funnel) continue;

    html += `<div class="funnel-name">${escapeHtml(funnel.name)}</div><div class="funnel-steps">`;
    html += funnel.steps.map((step, i) => {
      const isCurrent = step === e.name;
      const arrow = i < funnel.steps.length - 1 ? '<span class="funnel-arrow">&#8594;</span>' : '';
      return `<a class="funnel-step ${isCurrent ? 'current' : ''}" href="#/event/${encodeURIComponent(step)}">${escapeHtml(step)}</a>${arrow}`;
    }).join('');
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function renderIntelligence(e) {
  if (!e.intelligence) return '';
  const intel = e.intelligence;
  let html = '<div class="event-detail-section">';

  if (intel.businessContext || intel.whyItMatters) {
    html += '<div class="intel-section">';
    html += '<h3 class="section-title">Why This Event Matters</h3>';
    if (intel.businessContext) html += `<p class="intel-text">${escapeHtml(intel.businessContext)}</p>`;
    if (intel.whyItMatters) html += `<p class="intel-text" style="margin-top:8px; font-weight:600">${escapeHtml(intel.whyItMatters)}</p>`;
    html += '</div>';
  }

  if (intel.whatToWatchFor && intel.whatToWatchFor.length > 0) {
    html += '<div class="intel-section"><div class="intel-title">What to Watch For</div>';
    html += `<ul class="intel-list watch">${intel.whatToWatchFor.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>`;
  }

  if (intel.platformDifferences) {
    html += `<div class="intel-section"><div class="intel-title">Platform Differences</div>
      <p class="intel-text">${escapeHtml(intel.platformDifferences)}</p></div>`;
  }

  if (intel.commonMistakes && intel.commonMistakes.length > 0) {
    html += '<div class="intel-section"><div class="intel-title">Common Mistakes</div>';
    html += `<ul class="intel-list mistakes">${intel.commonMistakes.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul></div>`;
  }

  if (intel.analysisQuestions && intel.analysisQuestions.length > 0) {
    html += '<div class="intel-section"><div class="intel-title">Analysis Questions You Can Answer</div>';
    html += `<ul class="intel-list questions">${intel.analysisQuestions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul></div>`;
  }

  html += '</div>';
  return html;
}

function renderIssues(e) {
  const notes = e.notes;
  const issues = e.issues || [];

  if (!notes && issues.length === 0) return '';

  let html = '<div class="event-detail-section"><h3 class="section-title">Notes & Known Issues</h3>';

  if (notes) {
    html += `<p class="intel-text">${escapeHtml(notes)}</p>`;
  }

  if (issues.length > 0) {
    html += `<ul class="intel-list mistakes" style="margin-top:8px">${issues.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
  }

  html += '</div>';
  return html;
}

// --- Funnel View ---
function renderFunnelView() {
  const content = document.getElementById('content');
  let html = '<a class="back-link" href="#/">&#8592; All events</a>';
  html += '<h2 style="font-size:20px; margin-bottom:20px">Funnels</h2>';

  for (const [key, funnel] of Object.entries(DATA.funnels)) {
    html += `<div style="margin-bottom:24px; background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:20px">`;
    html += `<div style="font-weight:700; font-size:16px; margin-bottom:12px">${escapeHtml(funnel.name)}</div>`;
    html += '<div class="funnel-steps">';
    html += funnel.steps.map((step, i) => {
      const arrow = i < funnel.steps.length - 1 ? '<span class="funnel-arrow">&#8594;</span>' : '';
      return `<a class="funnel-step" href="#/event/${encodeURIComponent(step)}">${escapeHtml(step)}</a>${arrow}`;
    }).join('');
    html += '</div></div>';
  }

  content.innerHTML = html;
}

// --- Mobile Web Funnels ---
function renderMobileWeb() {
  const content = document.getElementById('content');
  if (!MOBILEWEB || MOBILEWEB.status !== 'ready') {
    content.innerHTML = '<div class="loading">Mobile web funnel data not loaded.</div>';
    return;
  }
  // Delegate to the new data-driven renderer
  renderMobileWebV2();
}
function renderMobileWebV2() {
  const content = document.getElementById('content');
  if (!MOBILEWEB) { content.innerHTML = '<div class="loading">No data.</div>'; return; }

  const M = MOBILEWEB;
  const fmtPct = v => typeof v === 'number' ? v.toFixed(1) + '%' : '-';
  const fmtNum = v => typeof v === 'number' ? v.toLocaleString() : '-';
  const dropColor = pct => pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-error)';
  const gapColor = g => g > 0 ? 'var(--color-success)' : g < -10 ? 'var(--color-error)' : 'var(--color-warning)';
  const stepNames = M.funnel_steps;
  const round2 = v => Math.round(v * 10) / 10;

  let html = '';
  html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">';
  html += '<h2 style="font-size:20px; margin:0">Mobile Web Funnels (Phone Only)</h2>';
  html += `<div style="font-size:11px; color:var(--color-text-muted)">${M.period} | ${M.generated}</div>`;
  html += '</div>';
  html += `<div style="font-size:12px; color:var(--color-text-muted); margin-bottom:16px">${M.note} Funnel: <strong>${stepNames.join(' \u2192 ')}</strong></div>`;

  // Summary cards
  const mw = M.overall.mobile_web;
  const mw0 = M.overall.mobile_web_0d;
  html += '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:20px">';
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid #E67E22">
    <div style="font-size:11px; color:var(--color-text-muted)">Mobile Phone Conv</div>
    <div style="font-size:22px; font-weight:700; color:#E67E22">${fmtPct(mw.conversion)}</div>
    <div style="font-size:10px; color:var(--color-text-muted)">${fmtNum(mw.steps[0])} confirmed quotes</div>
  </div>`;
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-accent)">
    <div style="font-size:11px; color:var(--color-text-muted)">0-Day Conv</div>
    <div style="font-size:22px; font-weight:700; color:var(--color-accent)">${fmtPct(mw0.conversion)}</div>
    <div style="font-size:10px; color:var(--color-text-muted)">Same-day completion</div>
  </div>`;
  const mw5 = M.overall.mobile_web_5d || {};
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-success)">
    <div style="font-size:11px; color:var(--color-text-muted)">5-Day Conv</div>
    <div style="font-size:22px; font-weight:700; color:var(--color-success)">${fmtPct(mw5.conversion || 0)}</div>
    <div style="font-size:10px; color:var(--color-text-muted)">Incl bank/ACH settlement</div>
  </div>`;
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-text-muted)">
    <div style="font-size:11px; color:var(--color-text-muted)">Desktop Comparison</div>
    <div style="font-size:22px; font-weight:700">${fmtPct(M.overall.desktop.conversion)}</div>
    <div style="font-size:10px; color:var(--color-error)">Gap: -${M.overall.gap_pp}pp</div>
  </div>`;
  html += '</div>';

  // Insights
  if (M.insights) {
    html += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:20px">';
    Object.entries(M.insights).forEach(([key, text]) => {
      const color = key.includes('broken') || key.includes('problem') ? 'var(--color-error)' : key.includes('best') || key.includes('strong') ? 'var(--color-success)' : 'var(--color-warning)';
      html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:12px; border-left:3px solid ${color}">
        <div style="font-size:11px; color:var(--color-text-muted); line-height:1.5">${text}</div>
      </div>`;
    });
    html += '</div>';
  }

  // === BY PAYMENT METHOD ===
  if (M.by_payment_method) {
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:16px">';
    html += '<div style="font-size:14px; font-weight:700; margin-bottom:12px">By Payment Method (post Quote Confirmed)</div>';
    html += '<table class="props-table" style="font-size:12px; width:100%"><thead><tr><th style="text-align:left">Payment Method</th><th>Users</th><th>0-Day</th><th>5-Day</th><th style="min-width:140px">0-Day vs 5-Day</th></tr></thead><tbody>';
    const pm0d = M.by_payment_method.zero_day || {};
    const pm5d = M.by_payment_method.five_day || {};
    const pmAll = {...pm5d};
    Object.keys(pm0d).forEach(k => { if (!pmAll[k]) pmAll[k] = pm0d[k]; });
    Object.entries(pmAll).sort((a, b) => (b[1].entered || 0) - (a[1].entered || 0)).forEach(([pm, d5]) => {
      const z = pm0d[pm] || {};
      const c0 = z.conv_0d || z.conv || 0;
      const c5 = d5.conv || 0;
      html += `<tr>
        <td style="font-weight:700">${pm}</td>
        <td style="text-align:center">${fmtNum(d5.entered || 0)}</td>
        <td style="text-align:center; color:${dropColor(c0)}; font-weight:600">${fmtPct(c0)}</td>
        <td style="text-align:center; color:${dropColor(c5)}; font-weight:600">${fmtPct(c5)}</td>
        <td><div style="display:flex; height:14px; border-radius:3px; overflow:hidden; background:var(--color-border)">
          <div style="width:${c0 * 0.5}%; background:var(--color-accent)" title="0-day: ${fmtPct(c0)}"></div>
          <div style="width:${Math.max(0, c5 - c0) * 0.5}%; background:var(--color-success)" title="1-5 day: ${fmtPct(c5 - c0)}"></div>
        </div>
        <div style="font-size:9px; color:var(--color-text-muted); margin-top:2px"><span style="color:var(--color-accent)">&#9632;</span> 0-day <span style="color:var(--color-success)">&#9632;</span> 1-5 day</div></td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }

  // === BY REGION ===
  if (M.by_region) {
    const regions = Object.entries(M.by_region.full).sort((a, b) => b[1].steps[0] - a[1].steps[0]);
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:16px; overflow-x:auto">';
    html += '<div style="font-size:14px; font-weight:700; margin-bottom:4px">By Region (Quote Confirmed \u2192 Transaction Completed)</div>';
    html += '<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:12px">Full conversion + 0-day + desktop comparison</div>';
    const r5d = M.by_region.five_day || {};
    html += '<table class="props-table" style="font-size:12px; width:100%"><thead><tr><th style="text-align:left">Region</th><th>Quote Conf</th><th>0-Day</th><th>5-Day</th><th>Desktop</th><th>Gap vs Dk</th></tr></thead><tbody>';
    // Use 5-day regions (TBU only)
    const regionSource = Object.keys(r5d).length > 0 ? Object.entries(r5d).sort((a, b) => b[1].entered - a[1].entered) : regions;
    (Array.isArray(regionSource) ? regionSource : regionSource).forEach(([name, rd]) => {
      const z = (M.by_region.zero_day && M.by_region.zero_day[name]) || {};
      const full = (M.by_region.full && M.by_region.full[name]) || {};
      const c0d = z.conv_0d || 0;
      const c5d = rd.conv || 0;
      const dkConv = full.desktop_conv || 0;
      const gap = dkConv ? round2(c5d - dkConv) : null;
      html += `<tr>
        <td style="font-weight:700">${name}</td>
        <td style="text-align:center">${fmtNum(rd.entered)}</td>
        <td style="text-align:center; color:${dropColor(c0d)}">${fmtPct(c0d)}</td>
        <td style="text-align:center; color:${dropColor(c5d)}; font-weight:600">${fmtPct(c5d)}</td>
        <td style="text-align:center">${dkConv ? fmtPct(dkConv) : '-'}</td>
        <td style="text-align:center; color:${gap !== null ? gapColor(gap) : 'var(--color-text-muted)'}; font-weight:600">${gap !== null ? (gap > 0 ? '+' : '') + fmtPct(gap) : '-'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }

  // === PLAID + BANK TRANSFER ===
  if (M.plaid_funnel) {
    const pf = M.plaid_funnel;
    html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px">';

    // Plaid Connection
    const pc = pf.plaid_connection;
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px">';
    html += `<div style="font-size:14px; font-weight:700; margin-bottom:4px">${pc.title}</div>`;
    html += `<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:12px">${pc.description}</div>`;
    html += '<table class="props-table" style="font-size:12px; width:100%"><thead><tr><th style="text-align:left">Platform</th><th>Started</th><th>Completed</th><th>Conv</th></tr></thead><tbody>';
    Object.entries(pc.platforms).forEach(([plat, pd]) => {
      html += `<tr><td style="font-weight:700">${plat}</td>
        <td style="text-align:center">${fmtNum(pd.started)}</td>
        <td style="text-align:center">${fmtNum(pd.completed)}</td>
        <td style="text-align:center; font-weight:700; color:${dropColor(pd.conv)}">${fmtPct(pd.conv)}</td></tr>`;
    });
    html += '</tbody></table>';
    html += `<div style="font-size:10px; color:var(--color-text-muted); margin-top:8px">${pc.key_finding}</div>`;
    html += '</div>';

    // Bank Transfer Completion
    const bt = pf.bank_transfer_completion;
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px">';
    html += `<div style="font-size:14px; font-weight:700; margin-bottom:4px">${bt.title}</div>`;
    html += `<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:12px">${bt.description}</div>`;
    html += '<table class="props-table" style="font-size:12px; width:100%"><thead><tr><th style="text-align:left">Platform</th><th>Txn Created</th><th>Completed</th><th>Conv (5d)</th></tr></thead><tbody>';
    Object.entries(bt.platforms).forEach(([plat, pd]) => {
      html += `<tr><td style="font-weight:700">${plat}</td>
        <td style="text-align:center">${fmtNum(pd.created)}</td>
        <td style="text-align:center">${fmtNum(pd.completed)}</td>
        <td style="text-align:center; font-weight:700; color:${dropColor(pd.conv)}">${fmtPct(pd.conv)}</td></tr>`;
    });
    html += '</tbody></table>';
    html += `<div style="font-size:10px; color:var(--color-text-muted); margin-top:8px">${bt.key_finding}</div>`;
    html += '</div>';

    html += '</div>';
  }

  // === CORRIDOR PAIRS BY REGION ===
  const corridorSource = M.corridor_pairs || M.corridor_comparison || {};
  if (Object.keys(corridorSource).length > 0) {
    const regionMap = {'USD': 'US', 'GBP': 'UK', 'EUR': 'Europe', 'AUD': 'Australia', 'CAD': 'Canada', 'NZD': 'New Zealand'};
    const regionOrder = ['USD', 'GBP', 'EUR', 'AUD', 'CAD', 'NZD'];

    // Group corridors by send currency (region)
    const byRegion = {};
    Object.entries(corridorSource).forEach(([key, c]) => {
      const sendCcy = key.split('\u2192')[0];
      if (!byRegion[sendCcy]) byRegion[sendCcy] = [];
      byRegion[sendCcy].push([key, c]);
    });

    // Sort each region's corridors by revenue
    Object.values(byRegion).forEach(arr => arr.sort((a, b) => (b[1].revenue_usd || 0) - (a[1].revenue_usd || 0)));

    html += '<div style="font-size:16px; font-weight:700; margin-bottom:12px">Corridor Pairs by Region (5-day window)</div>';
    html += '<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:16px">Quote Confirmed \u2192 Transaction Completed. Grouped by sender region, sorted by revenue. <span style="color:#E67E22">&#9632;</span> Mobile Web &nbsp; <span style="color:#9B59B6">&#9632;</span> Native App &nbsp; <span style="color:#4A90D9">&#9632;</span> Desktop</div>';

    // Render each region
    regionOrder.forEach(sendCcy => {
      const corridors = byRegion[sendCcy];
      if (!corridors || corridors.length === 0) return;
      const regionName = regionMap[sendCcy] || sendCcy;

      // Region totals
      const totalRev = corridors.reduce((s, [, c]) => s + (c.revenue_usd || 0), 0);
      const totalMW = corridors.reduce((s, [, c]) => s + (c.mobile_web?.entered || 0), 0);
      const totalApp = corridors.reduce((s, [, c]) => s + (c.native_app?.entered || 0), 0);
      const totalDk = corridors.reduce((s, [, c]) => s + (c.desktop?.entered || 0), 0);
      const totalRevStr = totalRev >= 1e6 ? '$' + (totalRev/1e6).toFixed(1) + 'M' : '$' + Math.round(totalRev/1e3) + 'K';

      html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); margin-bottom:12px; overflow:hidden">`;

      // Region header
      html += `<div style="padding:10px 16px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center; background:var(--color-bg)">
        <div><span style="font-size:15px; font-weight:700">${regionName}</span> <span style="font-size:12px; color:var(--color-text-muted)">(${sendCcy}) \u2014 ${corridors.length} corridors</span></div>
        <div style="display:flex; gap:16px; font-size:11px">
          <span style="color:var(--color-success); font-weight:700">${totalRevStr} rev</span>
          <span style="color:#E67E22">MW: ${fmtNum(totalMW)}</span>
          <span style="color:#9B59B6">App: ${fmtNum(totalApp)}</span>
          <span style="color:#4A90D9">Dk: ${fmtNum(totalDk)}</span>
        </div>
      </div>`;

      // Corridor table
      html += '<div style="padding:0; overflow-x:auto">';
      html += '<table class="props-table" style="font-size:11px; width:100%; margin:0"><thead><tr>';
      html += '<th style="text-align:left">Corridor</th>';
      html += '<th style="font-size:10px">Rev</th>';
      html += '<th style="font-size:10px; background:rgba(230,126,34,0.08)">MW QC</th>';
      html += '<th style="font-size:10px; background:rgba(230,126,34,0.08)">MW Conv</th>';
      html += '<th style="font-size:10px; background:rgba(155,89,182,0.08)">App QC</th>';
      html += '<th style="font-size:10px; background:rgba(155,89,182,0.08)">App Conv</th>';
      html += '<th style="font-size:10px; background:rgba(74,144,217,0.08)">Dk QC</th>';
      html += '<th style="font-size:10px; background:rgba(74,144,217,0.08)">Dk Conv</th>';
      html += '</tr></thead><tbody>';

      corridors.forEach(([key, c]) => {
        const payout = key.split('\u2192')[1];
        const m = c.mobile_web || {}, a = c.native_app || {}, d = c.desktop || {};
        const rev = c.revenue_usd;
        const revStr = rev ? (rev >= 1e6 ? '$' + (rev/1e6).toFixed(1) + 'M' : '$' + Math.round(rev/1e3) + 'K') : '-';
        html += `<tr>
          <td style="font-weight:600">${sendCcy}\u2192<strong>${payout}</strong></td>
          <td style="text-align:center; font-size:10px; color:var(--color-success)">${revStr}</td>
          <td style="text-align:center; font-size:10px; background:rgba(230,126,34,0.03)">${m.entered ? fmtNum(m.entered) : '-'}</td>
          <td style="text-align:center; color:${dropColor(m.conv || 0)}; font-weight:600; background:rgba(230,126,34,0.03)">${m.conv ? fmtPct(m.conv) : '-'}</td>
          <td style="text-align:center; font-size:10px; background:rgba(155,89,182,0.03)">${a.entered ? fmtNum(a.entered) : '-'}</td>
          <td style="text-align:center; color:${dropColor(a.conv || 0)}; font-weight:600; background:rgba(155,89,182,0.03)">${a.conv ? fmtPct(a.conv) : '-'}</td>
          <td style="text-align:center; font-size:10px; background:rgba(74,144,217,0.03)">${d.entered ? fmtNum(d.entered) : '-'}</td>
          <td style="text-align:center; color:${dropColor(d.conv || 0)}; font-weight:600; background:rgba(74,144,217,0.03)">${d.conv ? fmtPct(d.conv) : '-'}</td>
        </tr>`;
      });

      html += '</tbody></table></div></div>';
    });

    // Non-TBU corridors (AED→, etc.)
    const otherCorridors = [];
    Object.entries(byRegion).forEach(([sendCcy, arr]) => {
      if (!regionOrder.includes(sendCcy)) otherCorridors.push(...arr);
    });
    if (otherCorridors.length > 0) {
      otherCorridors.sort((a, b) => (b[1].revenue_usd || 0) - (a[1].revenue_usd || 0));
      html += '<details style="margin-bottom:16px"><summary style="cursor:pointer; font-size:12px; color:var(--color-accent); font-weight:600">Other corridors (' + otherCorridors.length + ' pairs)</summary>';
      html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:0; margin-top:8px; overflow-x:auto">';
      html += '<table class="props-table" style="font-size:11px; width:100%; margin:0"><thead><tr>';
      html += '<th style="text-align:left">Corridor</th><th style="font-size:10px">Rev</th>';
      html += '<th style="font-size:10px">MW Conv</th><th style="font-size:10px">App Conv</th><th style="font-size:10px">Dk Conv</th>';
      html += '</tr></thead><tbody>';
      otherCorridors.forEach(([key, c]) => {
        const m = c.mobile_web || {}, a = c.native_app || {}, d = c.desktop || {};
        const rev = c.revenue_usd;
        const revStr = rev ? '$' + Math.round(rev/1e3) + 'K' : '-';
        html += `<tr><td style="font-weight:600">${key}</td><td style="text-align:center; font-size:10px; color:var(--color-success)">${revStr}</td>
          <td style="text-align:center; color:${dropColor(m.conv || 0)}">${m.conv ? fmtPct(m.conv) : '-'}</td>
          <td style="text-align:center; color:${dropColor(a.conv || 0)}">${a.conv ? fmtPct(a.conv) : '-'}</td>
          <td style="text-align:center; color:${dropColor(d.conv || 0)}">${d.conv ? fmtPct(d.conv) : '-'}</td></tr>`;
      });
      html += '</tbody></table></div></details>';
    }
  }

  // === ISSUES LIST ===
  if (M.issues && M.issues.length > 0) {
    const sevOrder = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3};
    const sevColor = {'critical': '#dc2626', 'high': '#ea580c', 'medium': '#d97706', 'low': '#65a30d'};
    const sevBg = {'critical': '#fef2f2', 'high': '#fff7ed', 'medium': '#fffbeb', 'low': '#f0fdf4'};
    const catColor = {'funnel-gap': '#3b82f6', 'error-recovery': '#ef4444', 'error-rate': '#f97316', 'payment-failure': '#8b5cf6', 'geo-specific': '#06b6d4', 'tracking': '#6b7280', 'adoption': '#10b981'};
    const sorted = M.issues.slice().sort((a, b) => (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9));
    const counts = {};
    sorted.forEach(i => { counts[i.severity] = (counts[i.severity] || 0) + 1; });
    const cats = [...new Set(sorted.map(i => i.category).filter(Boolean))];

    html += '<div style="margin-top:24px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center">';
    html += `<h2 style="font-size:18px; margin:0">All Issues (${sorted.length})</h2>`;
    html += `<div style="display:flex; gap:8px; font-size:11px">`;
    Object.entries(counts).forEach(([sev, cnt]) => {
      html += `<span style="padding:2px 8px; border-radius:10px; background:${sevBg[sev]}; color:${sevColor[sev]}; font-weight:600">${cnt} ${sev}</span>`;
    });
    html += '</div></div>';

    // Category filter buttons
    html += '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px">';
    html += '<button class="mw-cat-btn active" onclick="document.querySelectorAll(\'.mw-issue-card\').forEach(c=>c.style.display=\'\');document.querySelectorAll(\'.mw-cat-btn\').forEach(b=>b.classList.remove(\'active\'));this.classList.add(\'active\')" style="font-size:11px; padding:4px 10px; border:1px solid var(--color-border); border-radius:12px; background:var(--color-bg-card); cursor:pointer; font-weight:600">All (' + sorted.length + ')</button>';
    cats.forEach(cat => {
      const n = sorted.filter(i => i.category === cat).length;
      html += `<button class="mw-cat-btn" onclick="document.querySelectorAll('.mw-issue-card').forEach(c=>{c.style.display=c.dataset.cat==='${cat}'?'':'none'});document.querySelectorAll('.mw-cat-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')" style="font-size:11px; padding:4px 10px; border:1px solid ${catColor[cat] || '#ccc'}; border-radius:12px; background:var(--color-bg-card); cursor:pointer; color:${catColor[cat] || 'inherit'}">${cat} (${n})</button>`;
    });
    html += '</div>';

    sorted.forEach(issue => {
      html += `<div class="mw-issue-card" data-cat="${issue.category || ''}" style="background:var(--color-bg-card); border:1px solid var(--color-border); border-left:4px solid ${sevColor[issue.severity] || '#ccc'}; border-radius:var(--radius); padding:12px 14px; margin-bottom:8px">`;
      html += `<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px">`;
      html += `<span style="font-size:10px; padding:2px 6px; border-radius:3px; background:${sevBg[issue.severity]}; color:${sevColor[issue.severity]}; font-weight:700; text-transform:uppercase">${issue.severity}</span>`;
      html += `<span style="font-size:10px; color:var(--color-text-muted)">${issue.id}</span>`;
      if (issue.category) html += `<span style="font-size:10px; padding:2px 6px; border-radius:3px; background:#e0e7ff; color:${catColor[issue.category] || '#3730a3'}">${issue.category}</span>`;
      html += `<span style="font-size:13px; font-weight:700">${issue.title}</span>`;
      html += '</div>';
      html += `<div style="font-size:12px; color:var(--color-text-secondary); margin-bottom:6px">${issue.description}</div>`;
      if (issue.data) {
        html += '<div style="font-size:10px; color:var(--color-text-muted); margin-bottom:4px">Data: ' + Object.entries(issue.data).map(([k,v]) => `<strong>${k}</strong>=${v}`).join(', ') + '</div>';
      }
      const meta = [];
      if (issue.impact) meta.push(`<span style="font-size:11px; color:#dc2626; font-weight:600">${issue.impact}</span>`);
      if (issue.codeRef) meta.push(`<span style="font-size:10px; font-family:monospace; background:var(--color-bg-alt); padding:1px 4px; border-radius:2px">${issue.codeRef}</span>`);
      if (meta.length) html += `<div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:4px">${meta.join('')}</div>`;
      if (issue.recommendation) html += `<div style="font-size:11px; color:var(--color-success)"><strong>Fix:</strong> ${issue.recommendation}</div>`;
      html += '</div>';
    });
  }

  // === RECOMMENDATIONS ===
  if (M.recommendations && M.recommendations.length > 0) {
    html += '<div style="margin-top:24px; margin-bottom:12px"><h2 style="font-size:18px; margin:0">Prioritized Recommendations (' + M.recommendations.length + ')</h2></div>';
    M.recommendations.forEach(r => {
      html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:12px 14px; margin-bottom:8px; display:grid; grid-template-columns:40px 1fr auto auto; gap:12px; align-items:center">`;
      html += `<div style="font-size:20px; font-weight:800; color:var(--color-accent); text-align:center">#${r.priority}</div>`;
      html += `<div><div style="font-size:13px; font-weight:600">${r.action}</div><div style="font-size:11px; color:var(--color-text-muted)">${r.team}</div></div>`;
      html += `<div style="font-size:12px; color:var(--color-success); font-weight:600; white-space:nowrap">${r.impact}</div>`;
      html += `<div style="font-size:11px; color:var(--color-text-muted); white-space:nowrap">${r.effort}</div>`;
      html += '</div>';
    });
  }

  content.innerHTML = html;
}

// --- Retention vs Intent ---
function renderRetentionIntent() {
  const content = document.getElementById('content');
  if (!RETENTION) { content.innerHTML = '<div class="loading">Retention data not loaded.</div>'; return; }
  const R = RETENTION;
  const fmtPct = v => v.toFixed(1) + '%';
  const healthIcon = h => h === 'strong' ? '<span style="color:var(--color-success)">&#9679;</span>' : h === 'moderate' ? '<span style="color:var(--color-warning)">&#9679;</span>' : h === 'critical' ? '<span style="color:var(--color-error)">&#9679; CRITICAL</span>' : '<span style="color:var(--color-error)">&#9679;</span>';
  const healthBorder = h => h === 'strong' ? 'var(--color-success)' : h === 'moderate' ? 'var(--color-warning)' : 'var(--color-error)';
  const retColor = pct => pct >= 10 ? 'var(--color-success)' : pct >= 5 ? 'var(--color-warning)' : 'var(--color-error)';

  let html = '';
  html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
    <h2 style="font-size:20px; margin:0">Retention vs Registration Intent</h2>
    <div style="font-size:11px; color:var(--color-text-muted)">${R.period} | ${R.overall.registrations.toLocaleString()} registrations</div>
  </div>`;
  html += `<div style="font-size:12px; color:var(--color-text-muted); margin-bottom:16px">What users say during registration vs what they actually do. Source: <strong>${R.source_event}</strong> (mobile app onboarding).</div>`;

  // Overall benchmark bar
  const ov = R.overall;
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px 16px; margin-bottom:20px">
    <div style="font-size:13px; font-weight:700; margin-bottom:8px">Platform Benchmark — All Corridors</div>
    <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap">
      <span style="font-size:12px">Registered: <strong>${ov.registrations.toLocaleString()}</strong></span>
      <span style="font-size:12px">Converted (W0): <strong style="color:var(--color-accent)">${fmtPct(ov.retention.w0)}</strong></span>
      <span style="font-size:12px">W4: <strong>${fmtPct(ov.retention.w4)}</strong></span>
      <span style="font-size:12px">W8: <strong>${fmtPct(ov.retention.w8)}</strong></span>
      <span style="font-size:12px">W12: <strong>${fmtPct(ov.retention.w12)}</strong></span>
    </div>
    <div style="display:flex; height:8px; border-radius:4px; overflow:hidden; margin-top:8px; background:var(--color-border)">
      <div style="width:${ov.retention.w0}%; background:var(--color-accent)" title="W0: ${fmtPct(ov.retention.w0)}"></div>
    </div>
  </div>`;

  // Corridor ranking table
  const corridors = Object.entries(R.corridors).sort((a, b) => b[1].registrations - a[1].registrations);
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:20px; overflow-x:auto">';
  html += '<div style="font-size:14px; font-weight:700; margin-bottom:4px">All Corridors — Ranked by Volume</div>';
  html += '<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:12px">Click any row to jump to detailed analysis</div>';
  html += '<table class="props-table" style="font-size:12px; width:100%"><thead><tr><th style="text-align:left">Corridor</th><th>Regs</th><th>Conv</th><th>W0</th><th>W1</th><th>W4</th><th>W8</th><th>W12</th><th>Health</th><th style="min-width:140px">Retention Curve</th></tr></thead><tbody>';
  corridors.forEach(([ccy, d]) => {
    const ret = d.retention;
    const weeks = [ret.w0, ret.w1, ret.w4, ret.w8, ret.w12];
    const maxW = Math.max(...weeks, 1);
    html += `<tr style="cursor:pointer" onclick="document.getElementById('corridor-${ccy}').scrollIntoView({behavior:'smooth', block:'start'})">
      <td style="font-weight:700">${d.name}</td>
      <td style="text-align:center">${d.registrations.toLocaleString()}</td>
      <td style="text-align:center; font-weight:600; color:${d.conversion_pct >= 30 ? 'var(--color-success)' : d.conversion_pct >= 20 ? 'var(--color-warning)' : 'var(--color-error)'}">${fmtPct(d.conversion_pct)}</td>
      <td style="text-align:center; color:${retColor(ret.w0)}">${fmtPct(ret.w0)}</td>
      <td style="text-align:center; color:${retColor(ret.w1)}">${fmtPct(ret.w1)}</td>
      <td style="text-align:center; color:${retColor(ret.w4)}">${fmtPct(ret.w4)}</td>
      <td style="text-align:center; color:${retColor(ret.w8)}">${fmtPct(ret.w8)}</td>
      <td style="text-align:center; color:${retColor(ret.w12)}">${fmtPct(ret.w12)}</td>
      <td style="text-align:center">${healthIcon(d.health)}</td>
      <td><div style="display:flex; align-items:end; gap:1px; height:24px">${weeks.map(w => `<div style="flex:1; height:${Math.max(1, (w/maxW)*24)}px; background:${retColor(w)}; border-radius:1px"></div>`).join('')}</div></td>
    </tr>`;
  });
  html += '</tbody></table></div>';

  // Individual corridor cards
  corridors.forEach(([ccy, d]) => {
    const ret = d.retention;
    const weeks = ['w0','w1','w2','w3','w4','w5','w6','w7','w8','w12'];
    const weekLabels = ['W0','W1','W2','W3','W4','W5','W6','W7','W8','W12'];
    const maxR = Math.max(...weeks.map(w => ret[w] || 0), 1);

    html += `<div id="corridor-${ccy}" style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); margin-bottom:16px; border-left:4px solid ${healthBorder(d.health)}">`;

    // Header
    html += `<div style="padding:14px 16px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center">
      <div>
        <span style="font-size:16px; font-weight:700">${d.name}</span>
        <span style="margin-left:12px; font-size:12px; color:var(--color-text-muted)">${d.registrations.toLocaleString()} registrations</span>
      </div>
      <div style="display:flex; gap:16px; align-items:center">
        <span style="font-size:24px; font-weight:700; color:${d.conversion_pct >= 30 ? 'var(--color-success)' : d.conversion_pct >= 20 ? 'var(--color-warning)' : 'var(--color-error)'}">${fmtPct(d.conversion_pct)}</span>
        <span style="font-size:11px; color:var(--color-text-muted)">convert</span>
      </div>
    </div>`;

    // Body: 3 columns
    html += '<div style="padding:14px 16px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px">';

    // Col 1: Retention curve
    html += '<div>';
    html += '<div style="font-size:12px; font-weight:700; margin-bottom:8px">Retention Curve</div>';
    html += `<div style="display:flex; align-items:end; gap:2px; height:60px; margin-bottom:4px">`;
    weeks.forEach((w, i) => {
      const val = ret[w] || 0;
      const h = Math.max(1, (val / maxR) * 60);
      html += `<div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:end; height:60px">
        <div style="font-size:8px; color:var(--color-text-muted); margin-bottom:2px">${fmtPct(val)}</div>
        <div style="width:100%; height:${h}px; background:${retColor(val)}; border-radius:2px"></div>
      </div>`;
    });
    html += '</div>';
    html += `<div style="display:flex; gap:2px">${weekLabels.map(w => `<div style="flex:1; text-align:center; font-size:8px; color:var(--color-text-muted)">${w}</div>`).join('')}</div>`;
    // vs benchmark
    const w4delta = ret.w4 - ov.retention.w4;
    const w4color = w4delta > 0 ? 'var(--color-success)' : 'var(--color-error)';
    html += `<div style="margin-top:8px; font-size:11px">W4 vs benchmark: <strong style="color:${w4color}">${w4delta > 0 ? '+' : ''}${fmtPct(w4delta)}</strong></div>`;
    html += '</div>';

    // Col 2: What users said
    html += '<div>';
    html += '<div style="font-size:12px; font-weight:700; margin-bottom:8px">What Users Said</div>';
    const freq = d.frequency_split;
    const freqItems = [
      {label: 'Multiple/month', pct: freq.multiple_per_month},
      {label: 'Monthly', pct: freq.monthly},
      {label: 'Quarterly+', pct: freq.quarterly_plus},
      {label: 'One-time', pct: freq.one_time}
    ];
    freqItems.forEach(f => {
      html += `<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px">
        <div style="width:90px; font-size:10px">${f.label}</div>
        <div style="flex:1; height:12px; background:var(--color-border); border-radius:2px; overflow:hidden">
          <div style="width:${f.pct}%; height:100%; background:#9B59B6; opacity:0.6"></div>
        </div>
        <div style="width:28px; font-size:10px; text-align:right">${f.pct}%</div>
      </div>`;
    });
    html += '<div style="margin-top:6px; font-size:10px; color:var(--color-text-muted)">Amount intent:</div>';
    const amt = d.amount_split;
    const amtItems = [
      {label: '<$5K', pct: amt.under_5k},
      {label: '$5-20K', pct: amt['5k_20k']},
      {label: '$20-50K', pct: amt['20k_50k']},
      {label: '$50K+', pct: amt.over_50k}
    ];
    amtItems.forEach(a => {
      html += `<div style="display:flex; align-items:center; gap:6px; margin-bottom:3px">
        <div style="width:60px; font-size:10px">${a.label}</div>
        <div style="flex:1; height:10px; background:var(--color-border); border-radius:2px; overflow:hidden">
          <div style="width:${a.pct}%; height:100%; background:var(--color-accent); opacity:0.5"></div>
        </div>
        <div style="width:28px; font-size:10px; text-align:right">${a.pct}%</div>
      </div>`;
    });
    html += '</div>';

    // Col 3: Analysis + Action
    html += '<div>';
    html += '<div style="font-size:12px; font-weight:700; margin-bottom:6px">Analysis</div>';
    html += `<div style="font-size:11px; color:var(--color-text-muted); line-height:1.5; margin-bottom:10px">${d.analysis}</div>`;
    html += `<div style="font-size:12px; font-weight:700; margin-bottom:4px; color:var(--color-accent)">Action</div>`;
    html += `<div style="font-size:11px; line-height:1.5; color:var(--color-text); background:rgba(74,144,217,0.05); padding:8px; border-radius:4px">${d.action}</div>`;
    html += '</div>';

    html += '</div></div>'; // close grid + card
  });

  content.innerHTML = html;
}

function _skipOldRetention(R, fmtPct, convColor, retColor) { /* removed */ }
function _oldRenderRetentionOverview(R, fmtPct, convColor, retColor) {
  let html = '';

  // Key insights cards
  const ins = R.insights;
  html += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:24px">';
  const insightCards = [
    {title: 'Frequency Mismatch', text: ins.frequency_mismatch, color: 'var(--color-warning)'},
    {title: 'Amount Sweet Spot', text: ins.amount_sweet_spot, color: 'var(--color-success)'},
    {title: 'INR is King', text: ins.inr_is_king, color: '#9B59B6'},
    {title: 'ETB Stickiest Corridor', text: ins.etb_sticky, color: 'var(--color-accent)'},
    {title: 'NGN & BDT Struggle', text: ins.ngn_bdt_struggle, color: 'var(--color-error)'},
    {title: 'EUR/USD Paradox', text: ins.eur_usd_paradox, color: 'var(--color-text-muted)'}
  ];
  insightCards.forEach(c => {
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid ${c.color}">
      <div style="font-size:13px; font-weight:700; margin-bottom:6px">${c.title}</div>
      <div style="font-size:11px; color:var(--color-text-muted); line-height:1.5">${c.text}</div>
    </div>`;
  });
  html += '</div>';

  // Registration intent distribution
  html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px">';

  // Frequency distribution
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px">';
  html += '<div style="font-size:14px; font-weight:700; margin-bottom:12px">What Users Say: Transfer Frequency</div>';
  const freqData = R.intent_distribution.frequency;
  Object.entries(freqData).forEach(([label, d]) => {
    html += `<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px">
      <div style="width:180px; font-size:11px; white-space:nowrap">${label}</div>
      <div style="flex:1; height:18px; background:var(--color-border); border-radius:3px; overflow:hidden">
        <div style="width:${d.pct}%; height:100%; background:#9B59B6; opacity:0.7"></div>
      </div>
      <div style="width:60px; font-size:11px; text-align:right; font-weight:600">${d.registrations.toLocaleString()}</div>
      <div style="width:40px; font-size:10px; text-align:right; color:var(--color-text-muted)">${fmtPct(d.pct)}</div>
    </div>`;
  });
  html += '</div>';

  // Amount distribution
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px">';
  html += '<div style="font-size:14px; font-weight:700; margin-bottom:12px">What Users Say: Send Amount</div>';
  const amtData = R.intent_distribution.amount_range;
  Object.entries(amtData).forEach(([label, d]) => {
    html += `<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px">
      <div style="width:120px; font-size:11px; white-space:nowrap">${label}</div>
      <div style="flex:1; height:18px; background:var(--color-border); border-radius:3px; overflow:hidden">
        <div style="width:${d.pct}%; height:100%; background:var(--color-accent); opacity:0.7"></div>
      </div>
      <div style="width:60px; font-size:11px; text-align:right; font-weight:600">${d.registrations.toLocaleString()}</div>
      <div style="width:40px; font-size:10px; text-align:right; color:var(--color-text-muted)">${fmtPct(d.pct)}</div>
    </div>`;
  });
  html += '</div>';
  html += '</div>';

  // Conversion comparison table — all dimensions
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:16px">';
  html += '<div style="font-size:14px; font-weight:700; margin-bottom:4px">Conversion to First Transaction — Intent vs Reality</div>';
  html += '<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:12px">Does what users say at registration predict whether they actually transact?</div>';
  html += '<table class="props-table" style="font-size:12px; width:100%"><thead><tr><th style="text-align:left">Segment</th><th>Registrations</th><th>Conversion %</th><th>Retention Week 4</th><th>Retention Week 8</th></tr></thead><tbody>';

  // Frequency rows
  html += '<tr><td colspan="5" style="font-weight:700; background:var(--color-bg); padding:8px 12px; font-size:11px; text-transform:uppercase; color:#9B59B6">By Frequency Intent</td></tr>';
  const freqConv = R.conversion_to_first_txn.by_frequency;
  const freqRet = R.retention_curves.by_frequency;
  Object.entries(freqConv).sort((a, b) => b[1].conv - a[1].conv).forEach(([label, d]) => {
    const ret = freqRet[label] || {};
    html += `<tr>
      <td>${label}</td>
      <td style="text-align:center">${d.vol.toLocaleString()}</td>
      <td style="text-align:center; color:${convColor(d.conv)}; font-weight:600">${fmtPct(d.conv)}</td>
      <td style="text-align:center; color:${retColor(ret.week4 || 0)}">${fmtPct(ret.week4 || 0)}</td>
      <td style="text-align:center; color:${retColor(ret.week8 || 0)}">${fmtPct(ret.week8 || 0)}</td>
    </tr>`;
  });

  // Amount rows
  html += '<tr><td colspan="5" style="font-weight:700; background:var(--color-bg); padding:8px 12px; font-size:11px; text-transform:uppercase; color:var(--color-accent)">By Amount Intent</td></tr>';
  const amtConv = R.conversion_to_first_txn.by_amount;
  const amtRet = R.retention_curves.by_amount;
  Object.entries(amtConv).sort((a, b) => b[1].conv - a[1].conv).forEach(([label, d]) => {
    const ret = amtRet[label] || {};
    html += `<tr>
      <td>${label}</td>
      <td style="text-align:center">${d.vol.toLocaleString()}</td>
      <td style="text-align:center; color:${convColor(d.conv)}; font-weight:600">${fmtPct(d.conv)}</td>
      <td style="text-align:center; color:${retColor(ret.week4 || 0)}">${fmtPct(ret.week4 || 0)}</td>
      <td style="text-align:center; color:${retColor(ret.week8 || 0)}">${fmtPct(ret.week8 || 0)}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  return html;
}

function renderRetentionByDimension(R, dimKey, dimLabel, fmtPct, convColor, retColor) {
  let html = '';
  const convData = dimKey === 'frequency' ? R.conversion_to_first_txn.by_frequency : R.conversion_to_first_txn.by_amount;
  const retData = dimKey === 'frequency' ? R.retention_curves.by_frequency : R.retention_curves.by_amount;
  const weeks = ['week0', 'week1', 'week2', 'week3', 'week4', 'week5', 'week6', 'week7', 'week8', 'week12'];
  const weekLabels = ['W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W12'];

  // Conversion summary
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:16px">';
  html += `<div style="font-size:14px; font-weight:700; margin-bottom:12px">Registration → First Transaction by ${dimLabel}</div>`;
  html += '<table class="props-table" style="font-size:12px; width:100%"><thead><tr><th style="text-align:left">' + dimLabel + '</th><th>Registrations</th><th>Conversion</th></tr></thead><tbody>';
  Object.entries(convData).sort((a, b) => b[1].conv - a[1].conv).forEach(([label, d]) => {
    const barW = Math.max(2, d.conv);
    html += `<tr><td style="font-weight:600">${label}</td><td style="text-align:center">${d.vol.toLocaleString()}</td>
      <td><div style="display:flex; align-items:center; gap:8px"><div style="width:${barW}%; height:16px; background:${convColor(d.conv)}; border-radius:3px; min-width:4px"></div><span style="font-weight:600; color:${convColor(d.conv)}">${fmtPct(d.conv)}</span></div></td></tr>`;
  });
  html += '</tbody></table></div>';

  // Retention curves table
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:16px">';
  html += `<div style="font-size:14px; font-weight:700; margin-bottom:4px">Weekly Retention Curves by ${dimLabel}</div>`;
  html += '<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:12px">% of users who registered and then created a transaction on or after each week</div>';
  html += '<table class="props-table" style="font-size:11px; width:100%"><thead><tr><th style="text-align:left">' + dimLabel + '</th><th>Users</th>';
  weekLabels.forEach(w => { html += `<th>${w}</th>`; });
  html += '</tr></thead><tbody>';

  Object.entries(retData).sort((a, b) => (b[1].week0 || 0) - (a[1].week0 || 0)).forEach(([label, d]) => {
    html += `<tr><td style="font-weight:600">${label}</td><td style="text-align:center">${(d.users || 0).toLocaleString()}</td>`;
    weeks.forEach(w => {
      const val = d[w] || 0;
      const bg = val >= 10 ? 'rgba(46,204,113,0.2)' : val >= 5 ? 'rgba(241,196,15,0.2)' : val >= 1 ? 'rgba(231,76,60,0.1)' : '';
      html += `<td style="text-align:center; background:${bg}; color:${retColor(val)}; font-weight:600">${fmtPct(val)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  // Visual retention curves
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px">';
  html += `<div style="font-size:14px; font-weight:700; margin-bottom:12px">Retention Curves (Visual)</div>`;
  const chartH = 120;
  const maxRet = Math.max(...Object.values(retData).map(d => d.week0 || 0));
  const colors = ['#9B59B6', '#3498DB', '#2ECC71', '#E74C3C', '#F39C12', '#1ABC9C', '#E67E22', '#95A5A6'];
  let colorIdx = 0;
  html += `<div style="position:relative; height:${chartH + 30}px">`;
  Object.entries(retData).sort((a, b) => (b[1].week0 || 0) - (a[1].week0 || 0)).forEach(([label, d]) => {
    const color = colors[colorIdx++ % colors.length];
    const points = weeks.map((w, i) => {
      const x = (i / (weeks.length - 1)) * 100;
      const y = chartH - ((d[w] || 0) / maxRet) * chartH;
      return `${x}%,${y}px`;
    });
    // Draw as dots connected by implied lines (CSS limitation — use dots)
    weeks.forEach((w, i) => {
      const x = (i / (weeks.length - 1)) * 100;
      const y = chartH - ((d[w] || 0) / maxRet) * chartH;
      html += `<div style="position:absolute; left:${x}%; top:${y}px; width:6px; height:6px; background:${color}; border-radius:50%; transform:translate(-3px,0)" title="${label}: ${fmtPct(d[w] || 0)} at ${weekLabels[i]}"></div>`;
    });
  });
  html += '</div>';
  // Legend
  colorIdx = 0;
  html += '<div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:8px">';
  Object.keys(retData).sort((a, b) => (retData[b].week0 || 0) - (retData[a].week0 || 0)).forEach(label => {
    const color = colors[colorIdx++ % colors.length];
    html += `<span style="font-size:10px; display:flex; align-items:center; gap:4px"><span style="width:8px; height:8px; background:${color}; border-radius:50%; display:inline-block"></span>${label}</span>`;
  });
  html += '</div></div>';

  return html;
}

function renderRetentionByCurrency(R, fmtPct, convColor, retColor) {
  let html = '';
  const convData = R.conversion_to_first_txn.by_payout_currency;
  const retData = R.retention_curves.by_payout_currency;
  const weeks = ['week0', 'week1', 'week2', 'week4', 'week8', 'week12'];
  const weekLabels = ['W0', 'W1', 'W2', 'W4', 'W8', 'W12'];

  // Full table
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:16px; overflow-x:auto">';
  html += '<div style="font-size:14px; font-weight:700; margin-bottom:4px">Payout Currency: Registration Intent vs Actual Behavior</div>';
  html += '<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:12px">Sorted by conversion rate. Green = strong, Red = weak.</div>';
  html += '<table class="props-table" style="font-size:12px; width:100%"><thead><tr>';
  html += '<th style="text-align:left">Currency</th><th>Registrations</th><th>Conversion</th>';
  weekLabels.forEach(w => { html += `<th>${w}</th>`; });
  html += '<th>Verdict</th></tr></thead><tbody>';

  Object.entries(convData).sort((a, b) => b[1].conv - a[1].conv).forEach(([ccy, d]) => {
    const ret = retData[ccy] || {};
    const w4 = ret.week4 || 0;
    const w8 = ret.week8 || 0;
    let verdict = '';
    if (d.conv >= 30 && w4 >= 8) verdict = '<span style="color:var(--color-success); font-weight:700">Strong</span>';
    else if (d.conv >= 20 && w4 >= 4) verdict = '<span style="color:var(--color-warning)">Moderate</span>';
    else if (d.conv >= 15) verdict = '<span style="color:var(--color-error)">Weak</span>';
    else verdict = '<span style="color:var(--color-error); font-weight:700">At Risk</span>';

    html += `<tr><td style="font-weight:700">${ccy}</td><td style="text-align:center">${d.vol.toLocaleString()}</td>`;
    html += `<td style="text-align:center; color:${convColor(d.conv)}; font-weight:600">${fmtPct(d.conv)}</td>`;
    weeks.forEach(w => {
      const val = ret[w] || 0;
      const bg = val >= 10 ? 'rgba(46,204,113,0.2)' : val >= 5 ? 'rgba(241,196,15,0.2)' : val >= 1 ? 'rgba(231,76,60,0.1)' : '';
      html += `<td style="text-align:center; background:${bg}; color:${retColor(val)}">${fmtPct(val)}</td>`;
    });
    html += `<td style="text-align:center">${verdict}</td></tr>`;
  });

  html += '</tbody></table></div>';

  // Highlight cards for best/worst
  html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">';
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; border-left:3px solid var(--color-success)">';
  html += '<div style="font-size:14px; font-weight:700; margin-bottom:8px; color:var(--color-success)">Best Performing Corridors</div>';
  html += '<div style="font-size:12px; line-height:1.8"><strong>INR</strong> — 39% conversion, 10.2% W4 retention. Users know what they want.<br>';
  html += '<strong>ETB</strong> — 31.8% conversion, incredible 17% W4 retention. Regular senders.<br>';
  html += '<strong>AED</strong> — 33.6% conversion. Strong Gulf corridor.<br>';
  html += '<strong>THB</strong> — 30.5% conversion, 9.1% W4. Consistent Thai corridor.</div></div>';

  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; border-left:3px solid var(--color-error)">';
  html += '<div style="font-size:14px; font-weight:700; margin-bottom:8px; color:var(--color-error)">Needs Attention</div>';
  html += '<div style="font-size:12px; line-height:1.8"><strong>NGN</strong> — 12.3% conversion despite 2,733 registrations. Huge drop-off.<br>';
  html += '<strong>BDT</strong> — 15.8% conversion, 0% retention after W6. Users vanish.<br>';
  html += '<strong>EUR/USD</strong> — 18.4% conversion. Top 2 corridors by volume but below average. Price shoppers?<br>';
  html += '<strong>KES</strong> — 17.1% conversion, weak retention. Product friction likely.</div></div>';
  html += '</div>';

  return html;
}

// --- Payment Speed ---
function renderPaymentSpeed() {
  const content = document.getElementById('content');
  if (!SPEED) { content.innerHTML = '<div class="loading">Payment speed data not loaded.</div>'; return; }
  try {

  const S = SPEED;
  const fmtPct = v => v.toFixed(1) + '%';
  const fmtHrs = h => h < 1 ? Math.round(h * 60) + ' min' : h < 24 ? h.toFixed(1) + 'h' : (h / 24).toFixed(1) + 'd';
  const speedColor = pct => pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-error)';
  const barWidth = (pct) => Math.max(2, pct) + '%';
  const methodLabels = { all: 'All Methods', debit: 'Debit Card', credit: 'Credit Card', bank_account: 'Bank Account', direct_debit: 'Direct Debit', open_banking: 'Open Banking' };

  let html = '';

  // Title + meta
  html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px">
    <h2 style="font-size:20px; margin:0">Payment Speed Tracker</h2>
    <div style="font-size:11px; color:var(--color-text-muted)">Data: ${S.period} | Generated: ${S.generated} | Bank payout only</div>
  </div>`;

  // Period toggle
  html += '<div style="margin-bottom:6px; font-size:12px; font-weight:700; color:var(--color-text-muted)">TIME PERIOD</div>';
  html += '<div style="display:flex; gap:6px; margin-bottom:16px">';
  ['30d', '90d'].forEach(p => {
    const active = p === speedPeriod;
    const label = p === '30d' ? 'Last 30 Days' : 'Last 90 Days (3 Months)';
    html += `<button class="filter-pill ${active ? 'active' : ''}" onclick="speedPeriod='${p}'; renderPaymentSpeed()">${label}</button>`;
  });
  html += '</div>';

  // Overall summary cards — show 3 cards (no percentile data from funnel API)
  const ov = S.overall;
  html += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:16px">';
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-accent)">
    <div style="font-size:11px; color:var(--color-text-muted)">Transactions</div>
    <div style="font-size:20px; font-weight:700; color:var(--color-accent)">${ov.volume.toLocaleString()}</div>
    <div style="font-size:10px; color:var(--color-text-muted)">${fmtPct(ov.completion_rate)} completed</div>
  </div>`;
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid #4A90D9">
    <div style="font-size:11px; color:var(--color-text-muted)">Median</div>
    <div style="font-size:20px; font-weight:700; color:#4A90D9">${fmtHrs(ov.median_hours)}</div>
  </div>`;
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-text-muted)">
    <div style="font-size:11px; color:var(--color-text-muted)">Average</div>
    <div style="font-size:20px; font-weight:700">${fmtHrs(ov.avg_hours)}</div>
  </div>`;
  html += '</div>';

  // Region filter (uses correct period's regions)
  const regionKeysSource = (speedPeriod === '90d') ? (S.regions_90d || S.regions || {}) : (S.regions || {});
  const regionKeys = ['all', ...Object.keys(regionKeysSource)];
  html += '<div style="margin-bottom:6px; font-size:12px; font-weight:700; color:var(--color-text-muted)">REGION</div>';
  html += '<div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap">';
  regionKeys.forEach(r => {
    const active = r === speedRegionFilter;
    const label = r === 'all' ? 'All Regions' : `${regionKeysSource[r] ? regionKeysSource[r].name : r} (${r})`;
    const vol = r === 'all' ? '' : ` \u00B7 ${(regionKeysSource[r]?.total_volume || 0).toLocaleString()}`;
    html += `<button class="filter-pill ${active ? 'active' : ''}" onclick="speedRegionFilter='${r}'; renderPaymentSpeed()">${label}${vol}</button>`;
  });
  html += '</div>';

  // Payment method filter
  const methods = ['all', 'debit', 'credit', 'bank_account', 'direct_debit', 'open_banking'];
  html += '<div style="margin-bottom:6px; font-size:12px; font-weight:700; color:var(--color-text-muted)">PAYMENT METHOD</div>';
  html += '<div style="display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap">';
  methods.forEach(m => {
    const active = m === speedPaymentFilter;
    html += `<button class="filter-pill ${active ? 'active' : ''}" onclick="speedPaymentFilter='${m}'; renderPaymentSpeed()">${methodLabels[m]}</button>`;
  });
  html += '</div>';

  // Get filtered corridor pairs based on period and payment method
  const pmKey = speedPaymentFilter;
  const is90d = speedPeriod === '90d';
  let corridors;
  let regions = is90d ? (S.regions_90d || S.regions || {}) : (S.regions || {});
  const allCorridors = is90d ? (S.corridor_pairs_90d || S.corridor_pairs || {}) : (S.corridor_pairs || {});
  const pmCorridors = (pmKey !== 'all' && S.payment_method_x_corridor_pairs) ? (S.payment_method_x_corridor_pairs[pmKey] || {}) : null;

  if (pmKey === 'all') {
    corridors = Object.assign({}, allCorridors);
  } else {
    corridors = Object.assign({}, pmCorridors || {});
  }

  // Filter by region (only for 'all' payment methods where corridors have send field)
  if (speedRegionFilter !== 'all' && pmKey === 'all') {
    const filtered = {};
    Object.entries(corridors).forEach(([k, v]) => {
      if (v.send === speedRegionFilter) filtered[k] = v;
    });
    corridors = filtered;
  }

  // Sort by volume
  const sorted = Object.entries(corridors).sort((a, b) => b[1].volume - a[1].volume);

  // Comparison data (30d data for delta when viewing 90d, or vice versa)
  const compareCorridors = is90d ? (S.corridor_pairs || {}) : (S.corridor_pairs_90d || {});

  // If corridors lack 'send' field (per-payment-method data), show flat list
  const hasSendField = sorted.length > 0 && sorted[0][1].send;
  if (speedRegionFilter === 'all' && hasSendField) {
    html += renderAllRegionsView(regions, corridors, pmKey, S, fmtPct, fmtHrs, speedColor, barWidth, methodLabels, compareCorridors, is90d);
  } else if (sorted.length > 0 && !hasSendField) {
    // Flat corridor list for specific payment method
    html += '<div style="margin-bottom:24px">';
    html += `<div style="font-size:14px; font-weight:700; margin-bottom:8px">Payout Destinations (${methodLabels[pmKey] || pmKey}) — ${sorted.length} corridors</div>`;
    html += '<table class="props-table" style="font-size:12px; width:100%"><thead><tr><th style="text-align:left">Payout</th><th>Volume</th><th>Complete</th><th>Median</th><th>Avg</th></tr></thead><tbody>';
    sorted.forEach(([key, d]) => {
      html += `<tr><td style="font-weight:700">${d.payout || key}</td><td style="text-align:center">${d.volume.toLocaleString()}</td><td style="text-align:center">${fmtPct(d.completion_rate)}</td><td style="text-align:center; font-weight:600">${fmtHrs(d.median_hours)}</td><td style="text-align:center">${fmtHrs(d.avg_hours)}</td></tr>`;
    });
    html += '</tbody></table></div>';
  } else {
    // Single region selected
    const regionInfo = regions[speedRegionFilter];
    if (sorted.length > 0) {
      if (regionInfo) {
        html += `<div style="font-size:14px; font-weight:700; margin-bottom:12px">${regionInfo.name} (${speedRegionFilter}) — ${sorted.length} corridors</div>`;
      }
      html += '<table class="props-table" style="font-size:12px; width:100%"><thead><tr><th style="text-align:left">Corridor</th><th>Volume</th><th>Complete</th><th>Median</th><th>Avg</th></tr></thead><tbody>';
      sorted.forEach(([key, d]) => {
        html += `<tr><td style="font-weight:700">${d.payout || key}</td><td style="text-align:center">${d.volume.toLocaleString()}</td><td style="text-align:center">${fmtPct(d.completion_rate)}</td><td style="text-align:center; font-weight:600">${fmtHrs(d.median_hours)}</td><td style="text-align:center">${fmtHrs(d.avg_hours)}</td></tr>`;
      });
      html += '</tbody></table>';
    } else {
      html += `<div style="color:var(--color-text-muted); padding:20px">No corridor data for ${speedRegionFilter}.</div>`;
    }
  }

  content.innerHTML = html;
  } catch(e) { content.innerHTML = '<div class="loading">Speed error: ' + e.message + '<br>' + e.stack.replace(/\n/g,'<br>') + '</div>'; }
}

function renderAllRegionsView(regions, allCorridors, pmKey, S, fmtPct, fmtHrs, speedColor, barWidth, methodLabels, compareCorridors, is90d) {
  let html = '';
  Object.entries(regions).forEach(([ccy, region]) => {
    // Filter corridors for this region
    const regionCorridors = Object.entries(allCorridors)
      .filter(([k, v]) => v.send === ccy)
      .sort((a, b) => b[1].volume - a[1].volume);

    if (regionCorridors.length === 0) return;
    // Debug: verify different data per region
    const debugFirst = regionCorridors[0] ? regionCorridors[0][0] : 'none';

    // Region header with summary
    const totalVol = regionCorridors.reduce((s, [, v]) => s + v.volume, 0);
    const totalCompleted = regionCorridors.reduce((s, [, v]) => s + v.completed, 0);
    const avgMedian = regionCorridors.reduce((s, [, v]) => s + v.median_hours * v.volume, 0) / totalVol;

    html += `<div style="margin-bottom:24px; border:1px solid var(--color-border); border-radius:var(--radius); overflow:hidden">`;
    html += `<div style="padding:12px 16px; background:var(--color-bg-card); border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center; cursor:pointer" onclick="this.parentElement.querySelector('.region-body').classList.toggle('collapsed')">
      <div>
        <span style="font-size:16px; font-weight:700">${region.name}</span>
        <span style="font-size:13px; color:var(--color-text-muted); margin-left:8px">${ccy} \u2192 ${regionCorridors.length} destinations (top: ${debugFirst})</span>
      </div>
      <div style="display:flex; gap:16px; align-items:center">
        <span style="font-size:12px">${totalVol.toLocaleString()} txns</span>
        <span style="font-size:12px">${fmtPct(totalCompleted / totalVol * 100)} complete</span>
        <span style="font-size:12px; color:#4A90D9; font-weight:600">Median ${fmtHrs(avgMedian)}</span>
      </div>
    </div>`;

    html += `<div class="region-body" style="padding:12px 16px">`;
    html += renderCorridorTable(regionCorridors, fmtPct, fmtHrs, speedColor, barWidth, compareCorridors, is90d);

    // Add matrix if showing all payment methods
    if (pmKey === 'all' && S.payment_method_x_corridor_pairs) {
      html += '<details style="margin-top:12px"><summary style="cursor:pointer; font-size:12px; color:var(--color-accent); font-weight:600">Show payment method breakdown</summary>';
      html += '<div style="margin-top:8px">';
      html += renderCorridorMatrix(regionCorridors.map(e => e[0]), S.payment_method_x_corridor_pairs, fmtPct, fmtHrs, speedColor, methodLabels);
      html += '</div></details>';
    }

    html += '</div></div>';
  });
  return html;
}

function renderCorridorTable(entries, fmtPct, fmtHrs, speedColor, barWidth, compareCorridors, is90d) {
  const hasCompare = compareCorridors && Object.keys(compareCorridors).length > 0;
  const hasPctCols = entries.length > 0 && entries.some(([, v]) => v.pct_1h > 0 || v.pct_1d > 0);
  const compareLabel = is90d ? '30d' : '90d';

  let html = '<div style="overflow-x:auto">';
  html += `<table class="props-table" style="font-size:12px; width:100%">
    <thead><tr>
      <th style="text-align:left">Corridor</th>
      <th>Volume</th>
      <th>Complete</th>`;
  if (hasPctCols) {
    html += `<th>&lt; 1h</th>
      <th>&lt; 6h</th>
      <th>&lt; 1d</th>
      <th>&lt; 3d</th>
      <th>&lt; 7d</th>`;
  }
  html += `<th>Median</th>
      <th>Avg</th>`;
  if (hasCompare) {
    html += `<th style="font-size:10px">Median (${compareLabel})</th>`;
    html += `<th style="font-size:10px">Delta</th>`;
  }
  if (hasPctCols) {
    html += `<th style="min-width:120px">Speed</th>`;
  }
  html += `</tr></thead><tbody>`;

  entries.forEach(([key, d]) => {
    const c1h = hasPctCols ? speedColor(d.pct_1h) : '';
    const c1d = hasPctCols ? speedColor(d.pct_1d) : '';
    const comp = hasCompare ? compareCorridors[key] : null;

    html += `<tr>
      <td style="font-weight:700; white-space:nowrap">${escapeHtml(key)}</td>
      <td style="text-align:center">${d.volume.toLocaleString()}</td>
      <td style="text-align:center">${fmtPct(d.completion_rate)}</td>`;
    if (hasPctCols) {
      html += `<td style="text-align:center; color:${c1h}; font-weight:600">${fmtPct(d.pct_1h)}</td>
      <td style="text-align:center">${fmtPct(d.pct_6h)}</td>
      <td style="text-align:center; color:${c1d}; font-weight:600">${fmtPct(d.pct_1d)}</td>
      <td style="text-align:center">${fmtPct(d.pct_3d)}</td>
      <td style="text-align:center">${fmtPct(d.pct_7d)}</td>`;
    }
    html += `<td style="text-align:center; font-weight:600">${fmtHrs(d.median_hours)}</td>
      <td style="text-align:center">${fmtHrs(d.avg_hours)}</td>`;

    if (hasCompare) {
      if (comp) {
        const delta = d.median_hours - comp.median_hours;
        const deltaColor = delta > 0.5 ? 'var(--color-error)' : delta < -0.5 ? 'var(--color-success)' : 'var(--color-text-muted)';
        const deltaSign = delta > 0 ? '+' : '';
        html += `<td style="text-align:center; font-size:11px">${fmtHrs(comp.median_hours)}</td>`;
        html += `<td style="text-align:center; color:${deltaColor}; font-weight:600; font-size:11px">${deltaSign}${fmtHrs(Math.abs(delta))}</td>`;
      } else {
        html += '<td style="text-align:center; color:var(--color-text-muted)">-</td><td>-</td>';
      }
    }

    if (hasPctCols) {
      html += `<td>
        <div style="display:flex; height:14px; border-radius:3px; overflow:hidden; background:var(--color-border)">
          <div style="width:${barWidth(d.pct_1h)}; background:var(--color-success)" title="< 1h: ${fmtPct(d.pct_1h)}"></div>
          <div style="width:${barWidth(d.pct_1d - d.pct_1h)}; background:var(--color-warning)" title="1h-1d: ${fmtPct(d.pct_1d - d.pct_1h)}"></div>
          <div style="width:${barWidth(d.pct_7d - d.pct_1d)}; background:var(--color-error)" title="1d-7d: ${fmtPct(d.pct_7d - d.pct_1d)}"></div>
        </div>
      </td>`;
    }
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

function renderCorridorMatrix(corridorKeys, pmData, fmtPct, fmtHrs, speedColor, methodLabels) {
  const methods = ['debit', 'credit', 'bank_account', 'direct_debit', 'open_banking'];
  let html = '<div style="overflow-x:auto">';
  html += '<table class="props-table" style="font-size:11px; width:100%"><thead><tr>';
  html += '<th style="text-align:left">Corridor</th>';
  methods.forEach(m => { html += `<th style="text-align:center">${methodLabels[m]}</th>`; });
  html += '</tr></thead><tbody>';

  corridorKeys.forEach(c => {
    html += `<tr><td style="font-weight:700; white-space:nowrap">${escapeHtml(c)}</td>`;
    methods.forEach(m => {
      const d = pmData[m] && pmData[m][c];
      if (!d || d.volume < 5) {
        html += '<td style="text-align:center; color:var(--color-text-muted)">-</td>';
      } else {
        const color = speedColor(d.pct_1h);
        html += `<td style="text-align:center; font-weight:600; color:${color}" title="Vol: ${d.volume}, Median: ${fmtHrs(d.median_hours)}, <1h: ${fmtPct(d.pct_1h)}, <1d: ${fmtPct(d.pct_1d)}">
          ${fmtPct(d.pct_1h)}
          <div style="font-size:9px; font-weight:400; color:var(--color-text-muted)">${d.volume}</div>
        </td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

// --- Balance Tracker ---
let balanceRegion = 'ALL';
let balanceWeeks = 27; // default: all

function renderBalanceTracker() {
  const content = document.getElementById('content');
  if (!BALANCE) { content.innerHTML = '<div class="loading">Balance tracker not loaded.</div>'; return; }

  const region = balanceRegion;
  const rd = BALANCE.regions[region];
  if (!rd) { content.innerHTML = '<div class="loading">Region not found.</div>'; return; }

  const totalWeeks = BALANCE.dates.length;
  const startIdx = Math.max(0, totalWeeks - balanceWeeks);
  const dates = BALANCE.dates.slice(startIdx);
  const cumRemaining = rd.cumulative_remaining.slice(startIdx);
  const weeklyIn = rd.weekly_in.slice(startIdx);
  const weeklyOut = rd.weekly_out.slice(startIdx);
  const weeklyFunded = rd.weekly_funded.slice(startIdx);
  const weeklySent = rd.weekly_sent.slice(startIdx);
  const weeklyConverted = rd.weekly_converted.slice(startIdx);

  let html = '<a class="back-link" href="#/health">&#8592; Health Check</a>';

  // Title + filters
  html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px">
    <h2 style="font-size:20px; margin:0">Balance Tracker — Money In vs Out</h2>
    <div style="display:flex; gap:6px">`;

  // Region filter
  ['ALL', 'US', 'CA', 'NZ'].forEach(r => {
    const active = r === region;
    html += `<button class="filter-pill ${active ? 'active' : ''}" onclick="balanceRegion='${r}'; renderBalanceTracker()">${r}</button>`;
  });
  html += '</div><div style="display:flex; gap:6px">';

  // Week range filter
  [{ label: '4W', val: 4 }, { label: '8W', val: 8 }, { label: '12W', val: 12 }, { label: '24W', val: 24 }, { label: 'All', val: 27 }].forEach(w => {
    const active = w.val === balanceWeeks;
    html += `<button class="filter-pill ${active ? 'active' : ''}" onclick="balanceWeeks=${w.val}; renderBalanceTracker()">${w.label}</button>`;
  });
  html += '</div></div>';

  // Region flag warning
  if (rd.flag) {
    html += `<div style="background:#FFF3CD; border:1px solid #FFEEBA; border-radius:var(--radius); padding:12px; margin-bottom:16px; font-size:12px; color:#856404">
      <strong>&#9888; Data Note:</strong> ${rd.flag}
    </div>`;
  }

  // Summary cards
  const fmtUSD = v => v >= 1e6 ? '$' + (v/1e6).toFixed(2) + 'M' : v >= 1e3 ? '$' + (v/1e3).toFixed(0) + 'K' : '$' + v;
  const lastRemaining = cumRemaining[cumRemaining.length - 2] || cumRemaining[cumRemaining.length - 1]; // last complete week

  html += '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:20px">';
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-accent)">
    <div style="font-size:11px; color:var(--color-text-muted)">Total Funded</div>
    <div style="font-size:22px; font-weight:700; color:var(--color-accent)">${fmtUSD(rd.total_funded)}</div>
  </div>`;
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-success)">
    <div style="font-size:11px; color:var(--color-text-muted)">Total Sent</div>
    <div style="font-size:22px; font-weight:700; color:var(--color-success)">${fmtUSD(rd.total_sent)}</div>
  </div>`;
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-cross)">
    <div style="font-size:11px; color:var(--color-text-muted)">Total Converted</div>
    <div style="font-size:22px; font-weight:700; color:var(--color-cross)">${fmtUSD(rd.total_converted)}</div>
  </div>`;
  const remColor = rd.remaining >= 0 ? 'var(--color-warning)' : 'var(--color-success)';
  html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid ${remColor}">
    <div style="font-size:11px; color:var(--color-text-muted)">Remaining (Held)</div>
    <div style="font-size:22px; font-weight:700; color:${remColor}">${rd.remaining < 0 ? '-' : ''}${fmtUSD(Math.abs(rd.remaining))}</div>
    <div style="font-size:11px; color:var(--color-text-muted)">Utilization: ${rd.utilization}%</div>
  </div>`;
  html += '</div>';

  // Cumulative Remaining chart (area)
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:16px">';
  html += '<div style="font-size:13px; font-weight:700; margin-bottom:10px">Cumulative Balance Remaining (USD)</div>';
  const maxRem = Math.max(...cumRemaining.map(Math.abs), 1);
  const chartH = 120;
  const baseline = cumRemaining.some(v => v < 0) ? chartH * 0.7 : chartH; // if negatives, shift baseline

  html += `<div style="position:relative; height:${chartH + 20}px; margin-bottom:4px">`;
  // Bars
  html += '<div style="display:flex; gap:1px; align-items:end; height:' + chartH + 'px; position:relative">';
  cumRemaining.forEach((v, i) => {
    const h = Math.max(1, (Math.abs(v) / maxRem) * (chartH * 0.8));
    const isPositive = v >= 0;
    const color = isPositive ? 'var(--color-warning)' : 'var(--color-success)';
    const bottom = isPositive ? 0 : 0;
    html += `<div style="flex:1; height:${h}px; background:${color}; border-radius:1px; opacity:${i >= dates.length - 2 ? 1 : 0.7}" title="${dates[i]}: ${fmtUSD(v)}"></div>`;
  });
  html += '</div>';
  html += `<div style="display:flex; justify-content:space-between; font-size:9px; color:var(--color-text-muted); margin-top:4px"><span>${dates[0]}</span><span>${dates[dates.length - 1]}</span></div>`;
  html += '</div></div>';

  // Weekly In vs Out chart
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:16px">';
  html += '<div style="font-size:13px; font-weight:700; margin-bottom:4px">Weekly: Money In (Funded) vs Money Out (Sent)</div>';
  html += '<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:10px"><span style="color:var(--color-accent)">&#9632;</span> Funded &nbsp; <span style="color:var(--color-error)">&#9632;</span> Sent &nbsp; <span style="font-size:10px">(Converts are internal — not outflows)</span></div>';

  const maxInOut = Math.max(...weeklyIn, ...weeklyOut, 1);
  html += '<div style="display:flex; gap:2px; align-items:end; height:80px">';
  dates.forEach((d, i) => {
    const hIn = Math.max(0, (weeklyIn[i] / maxInOut) * 80);
    const hOut = Math.max(0, (weeklyOut[i] / maxInOut) * 80);
    html += `<div style="flex:1; display:flex; flex-direction:column; gap:1px; align-items:stretch; justify-content:end; height:80px" title="${d}: In ${fmtUSD(weeklyIn[i])}, Out ${fmtUSD(weeklyOut[i])}">
      <div style="height:${hIn}px; background:var(--color-accent); border-radius:1px; opacity:0.7"></div>
      <div style="height:${hOut}px; background:var(--color-error); border-radius:1px; opacity:0.7"></div>
    </div>`;
  });
  html += '</div>';
  html += `<div style="display:flex; justify-content:space-between; font-size:9px; color:var(--color-text-muted); margin-top:4px"><span>${dates[0]}</span><span>${dates[dates.length - 1]}</span></div>`;
  html += '</div>';

  // Weekly data table
  html += '<details><summary style="cursor:pointer; font-size:12px; color:var(--color-accent); font-weight:600">Weekly data table</summary>';
  html += '<table class="props-table" style="font-size:11px; margin-top:8px"><thead><tr><th>Week</th><th>Funded</th><th>Sent</th><th>Converted (internal)</th><th>Net (Funded-Sent)</th><th>Cumulative Remaining</th></tr></thead><tbody>';
  dates.forEach((d, i) => {
    const net = weeklyFunded[i] - weeklySent[i];
    const netColor = net >= 0 ? 'var(--color-success)' : 'var(--color-error)';
    if (weeklyFunded[i] > 0 || weeklySent[i] > 0 || weeklyConverted[i] > 0) {
      html += `<tr>
        <td>${d}</td>
        <td style="color:var(--color-accent)">${fmtUSD(weeklyFunded[i])}</td>
        <td>${fmtUSD(weeklySent[i])}</td>
        <td>${fmtUSD(weeklyConverted[i])}</td>
        <td style="color:${netColor}; font-weight:600">${net >= 0 ? '+' : '-'}${fmtUSD(Math.abs(net))}</td>
        <td style="font-weight:700">${fmtUSD(cumRemaining[i])}</td>
      </tr>`;
    }
  });
  html += '</tbody></table></details>';

  // === REVENUE BY BALANCE TYPE ===
  if (BALANCE.revenue) {
    const rev = BALANCE.revenue;
    const revDates = rev.by_type.dates;
    const revStartIdx = Math.max(0, revDates.length - balanceWeeks);
    const rDates = revDates.slice(revStartIdx);
    const fundRev = rev.by_type.fund_balance.slice(revStartIdx);
    const convertRev = rev.by_type.convert_balance.slice(revStartIdx);
    const sendRev = rev.by_type.send_via_balance.slice(revStartIdx);
    const txnFund = rev.txn_counts.fund_balance.slice(revStartIdx);
    const txnConvert = rev.txn_counts.convert_balance.slice(revStartIdx);
    const txnSend = rev.txn_counts.send_via_balance.slice(revStartIdx);
    const usersFund = rev.unique_users.fund_balance.slice(revStartIdx);
    const usersConvert = rev.unique_users.convert_balance.slice(revStartIdx);
    const usersSend = rev.unique_users.send_via_balance.slice(revStartIdx);

    html += '<div style="margin-top:24px; border-top:2px solid var(--color-border); padding-top:20px">';
    html += '<h3 style="font-size:18px; margin:0 0 16px">Balance Revenue</h3>';

    // Revenue summary cards
    const rt = rev.by_type.totals;
    html += '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:20px">';
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-accent)">
      <div style="font-size:11px; color:var(--color-text-muted)">Fund Balance Revenue</div>
      <div style="font-size:20px; font-weight:700; color:var(--color-accent)">$${(rt.fund_balance/1e3).toFixed(1)}K</div>
      <div style="font-size:10px; color:var(--color-text-muted)">${rev.txn_counts.totals.fund_balance} txns</div>
    </div>`;
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-cross)">
      <div style="font-size:11px; color:var(--color-text-muted)">Convert Balance Revenue</div>
      <div style="font-size:20px; font-weight:700; color:var(--color-cross)">$${(rt.convert_balance/1e3).toFixed(1)}K</div>
      <div style="font-size:10px; color:var(--color-text-muted)">${rev.txn_counts.totals.convert_balance} txns</div>
    </div>`;
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-success)">
      <div style="font-size:11px; color:var(--color-text-muted)">Send via Balance Revenue</div>
      <div style="font-size:20px; font-weight:700; color:var(--color-success)">$${(rt.send_via_balance/1e3).toFixed(1)}K</div>
      <div style="font-size:10px; color:var(--color-text-muted)">${rev.txn_counts.totals.send_via_balance} txns</div>
    </div>`;
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid var(--color-warning)">
      <div style="font-size:11px; color:var(--color-text-muted)">Total Balance Revenue</div>
      <div style="font-size:20px; font-weight:700; color:var(--color-warning)">$${(rt.total/1e3).toFixed(1)}K</div>
      <div style="font-size:10px; color:var(--color-text-muted)">${rt.insight}</div>
    </div>`;
    html += '</div>';

    // Revenue by type stacked bar chart
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:16px">';
    html += '<div style="font-size:13px; font-weight:700; margin-bottom:4px">Weekly Revenue by Type</div>';
    html += '<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:10px"><span style="color:var(--color-accent)">&#9632;</span> Fund &nbsp; <span style="color:var(--color-cross)">&#9632;</span> Convert &nbsp; <span style="color:var(--color-success)">&#9632;</span> Send via Balance</div>';
    const maxRev = Math.max(...rDates.map((_, i) => fundRev[i] + convertRev[i] + sendRev[i]), 1);
    html += '<div style="display:flex; gap:2px; align-items:end; height:100px">';
    rDates.forEach((d, i) => {
      const total = fundRev[i] + convertRev[i] + sendRev[i];
      const hF = (fundRev[i] / maxRev) * 100;
      const hC = (convertRev[i] / maxRev) * 100;
      const hS = (sendRev[i] / maxRev) * 100;
      html += `<div style="flex:1; display:flex; flex-direction:column; justify-content:end; height:100px" title="${d}: Fund $${fundRev[i]}, Convert $${convertRev[i]}, Send $${sendRev[i]} = $${total}">
        <div style="height:${hF}px; background:var(--color-accent); opacity:0.8"></div>
        <div style="height:${hC}px; background:var(--color-cross); opacity:0.8"></div>
        <div style="height:${hS}px; background:var(--color-success); opacity:0.8"></div>
      </div>`;
    });
    html += '</div>';
    html += `<div style="display:flex; justify-content:space-between; font-size:9px; color:var(--color-text-muted); margin-top:4px"><span>${rDates[0]}</span><span>${rDates[rDates.length - 1]}</span></div>`;
    html += '</div>';

    // === NEW vs EXISTING ===
    html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px">';

    // New vs Existing card
    const ne = rev.new_vs_existing.totals;
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px">';
    html += '<div style="font-size:13px; font-weight:700; margin-bottom:12px">New vs Existing Users</div>';
    // Stacked bar visual
    const existPct = parseFloat(ne.existing.share);
    const newPct = parseFloat(ne.new.share);
    html += `<div style="display:flex; height:28px; border-radius:4px; overflow:hidden; margin-bottom:12px">
      <div style="width:${existPct}%; background:var(--color-accent); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:white">Existing ${ne.existing.share}</div>
      <div style="width:${newPct}%; background:var(--color-warning); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:white">${ne.new.share}</div>
    </div>`;
    html += '<table class="props-table" style="font-size:11px"><thead><tr><th></th><th>Fund+Convert</th><th>Send</th><th>Total</th></tr></thead><tbody>';
    html += `<tr><td><strong>Existing</strong></td><td>$${(ne.existing.fund_convert/1e3).toFixed(1)}K</td><td>$${(ne.existing.send/1e3).toFixed(1)}K</td><td style="font-weight:700">$${(ne.existing.total/1e3).toFixed(1)}K</td></tr>`;
    html += `<tr><td><strong>New</strong></td><td>$${(ne.new.fund_convert/1e3).toFixed(1)}K</td><td>$${(ne.new.send/1e3).toFixed(1)}K</td><td style="font-weight:700">$${(ne.new.total/1e3).toFixed(1)}K</td></tr>`;
    html += '</tbody></table>';
    html += `<div style="font-size:10px; color:var(--color-text-muted); margin-top:8px">${ne.insight}</div>`;
    html += '</div>';

    // === PLATFORM BREAKDOWN ===
    const pl = rev.by_platform.totals;
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px">';
    html += '<div style="font-size:13px; font-weight:700; margin-bottom:12px">Revenue by Platform</div>';
    // Stacked bar
    const galPct = (pl.Galileo.total / rt.total * 100).toFixed(0);
    const iosPct = (pl.ApolloIOS.total / rt.total * 100).toFixed(0);
    const andPct = (pl.ApolloAndroid.total / rt.total * 100).toFixed(0);
    html += `<div style="display:flex; height:28px; border-radius:4px; overflow:hidden; margin-bottom:12px">
      <div style="width:${galPct}%; background:#4A90D9; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:white">Web ${galPct}%</div>
      <div style="width:${iosPct}%; background:#888; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:white">iOS ${iosPct}%</div>
      <div style="width:${andPct}%; background:#34A853; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:white">And ${andPct}%</div>
    </div>`;
    html += '<table class="props-table" style="font-size:11px"><thead><tr><th>Platform</th><th>Fund+Convert</th><th>Send</th><th>Total</th></tr></thead><tbody>';
    html += `<tr><td><span style="display:inline-block;width:8px;height:8px;background:#4A90D9;border-radius:2px;margin-right:4px"></span><strong>Web</strong></td><td>$${(pl.Galileo.fund_convert/1e3).toFixed(1)}K</td><td>$${(pl.Galileo.send/1e3).toFixed(1)}K</td><td style="font-weight:700">$${(pl.Galileo.total/1e3).toFixed(1)}K</td></tr>`;
    html += `<tr><td><span style="display:inline-block;width:8px;height:8px;background:#888;border-radius:2px;margin-right:4px"></span><strong>iOS</strong></td><td>$${(pl.ApolloIOS.fund_convert/1e3).toFixed(1)}K</td><td>$${(pl.ApolloIOS.send/1e3).toFixed(1)}K</td><td style="font-weight:700">$${(pl.ApolloIOS.total/1e3).toFixed(1)}K</td></tr>`;
    html += `<tr><td><span style="display:inline-block;width:8px;height:8px;background:#34A853;border-radius:2px;margin-right:4px"></span><strong>Android</strong></td><td>$${(pl.ApolloAndroid.fund_convert/1e3).toFixed(1)}K</td><td>$${(pl.ApolloAndroid.send/1e3).toFixed(1)}K</td><td style="font-weight:700">$${(pl.ApolloAndroid.total/1e3).toFixed(1)}K</td></tr>`;
    html += '</tbody></table>';
    html += `<div style="font-size:10px; color:var(--color-text-muted); margin-top:8px">${pl.note}</div>`;
    html += '</div>';

    html += '</div>'; // close grid

    // Revenue weekly data table
    html += '<details><summary style="cursor:pointer; font-size:12px; color:var(--color-accent); font-weight:600">Revenue weekly data</summary>';
    html += '<table class="props-table" style="font-size:11px; margin-top:8px"><thead><tr><th>Week</th><th>Fund Rev</th><th>Convert Rev</th><th>Send Rev</th><th>Total Rev</th><th>Fund Txns</th><th>Convert Txns</th><th>Send Txns</th><th>Fund Users</th><th>Convert Users</th><th>Send Users</th></tr></thead><tbody>';
    rDates.forEach((d, i) => {
      const totalR = fundRev[i] + convertRev[i] + sendRev[i];
      if (totalR > 0 || txnFund[i] > 0 || txnSend[i] > 0) {
        html += `<tr>
          <td>${d}</td>
          <td style="color:var(--color-accent)">$${fundRev[i].toLocaleString()}</td>
          <td style="color:var(--color-cross)">$${convertRev[i].toLocaleString()}</td>
          <td style="color:var(--color-success)">$${sendRev[i].toLocaleString()}</td>
          <td style="font-weight:700">$${totalR.toLocaleString()}</td>
          <td>${txnFund[i]}</td>
          <td>${txnConvert[i]}</td>
          <td>${txnSend[i]}</td>
          <td>${usersFund[i]}</td>
          <td>${usersConvert[i]}</td>
          <td>${usersSend[i]}</td>
        </tr>`;
      }
    });
    html += '</tbody></table></details>';

    html += '</div>'; // close revenue section
  }

  // === BALANCE SENDS ANALYSIS ===
  if (BALSENDS) {
    const BS = BALSENDS;
    const S = BS.summary;
    const fmtK2 = n => n >= 1000000 ? '$' + (n/1000000).toFixed(1) + 'M' : n >= 1000 ? '$' + (n/1000).toFixed(0) + 'K' : '$' + n;

    html += '<div style="margin-top:24px; border-top:2px solid var(--color-border); padding-top:20px">';
    html += '<h3 style="font-size:18px; margin:0 0 4px">Balance Sends — Transfer Analysis</h3>';
    html += `<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:16px">Consumer (Private) accounts only | ${BS.period}</div>`;

    // Summary cards
    html += '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:16px">';
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid #27AE60">
      <div style="font-size:11px; color:var(--color-text-muted)">Balance Sends</div>
      <div style="font-size:22px; font-weight:700; color:#27AE60">${S.total_transactions.toLocaleString()}</div>
    </div>`;
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid #27AE60">
      <div style="font-size:11px; color:var(--color-text-muted)">Send Volume (USD)</div>
      <div style="font-size:22px; font-weight:700; color:#27AE60">${fmtK2(S.total_send_volume_usd)}</div>
    </div>`;
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid #27AE60">
      <div style="font-size:11px; color:var(--color-text-muted)">Avg Transaction</div>
      <div style="font-size:22px; font-weight:700; color:#27AE60">${fmtK2(S.avg_transaction_usd)}</div>
    </div>`;
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid #27AE60">
      <div style="font-size:11px; color:var(--color-text-muted)">Revenue</div>
      <div style="font-size:22px; font-weight:700; color:#27AE60">${fmtK2(S.total_revenue_usd)}</div>
      <div style="font-size:10px; color:var(--color-text-muted)">${S.revenue_margin_pct}% margin</div>
    </div>`;
    html += '</div>';

    // Quick facts strip
    html += '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:16px">';
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:10px; text-align:center">
      <div style="font-size:18px; font-weight:700">${S.cross_currency_pct}%</div><div style="font-size:10px; color:var(--color-text-muted)">Cross-currency</div></div>`;
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:10px; text-align:center">
      <div style="font-size:18px; font-weight:700">${S.same_currency_pct}%</div><div style="font-size:10px; color:var(--color-text-muted)">Same-currency</div></div>`;
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:10px; text-align:center">
      <div style="font-size:18px; font-weight:700">${S.repeat_sender_pct}%</div><div style="font-size:10px; color:var(--color-text-muted)">Repeat senders</div></div>`;
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:10px; text-align:center">
      <div style="font-size:18px; font-weight:700">100%</div><div style="font-size:10px; color:var(--color-text-muted)">Individual recipients</div></div>`;
    html += '</div>';

    // Weekly trend + Platform + Payout Method row
    const maxW = Math.max(...BS.weekly_trend.counts);
    html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:16px">';

    // Weekly trend
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px">';
    html += '<div style="font-size:12px; font-weight:700; margin-bottom:8px">Weekly Trend</div>';
    html += '<div style="display:flex; align-items:flex-end; gap:3px; justify-content:center; height:70px">';
    BS.weekly_trend.weeks.forEach((w, i) => {
      const v = BS.weekly_trend.counts[i];
      const h = Math.max(4, Math.round(v / maxW * 60));
      const isPartial = i === BS.weekly_trend.weeks.length - 1;
      html += `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <span style="font-size:9px;color:var(--color-text-muted)">${v}</span>
        <div style="width:22px;height:${h}px;background:${isPartial ? 'var(--color-text-muted)' : '#27AE60'};border-radius:2px"></div>
        <span style="font-size:8px;color:var(--color-text-muted)">${w.replace('Jan ','1/').replace('Feb ','2/').replace('Mar ','3/')}</span>
      </div>`;
    });
    html += '</div></div>';

    // Platform
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px">';
    html += '<div style="font-size:12px; font-weight:700; margin-bottom:8px">Platform</div>';
    const platColors2 = { iOS: '#007AFF', Web: '#4A90D9', Android: '#34A853' };
    Object.entries(BS.platform).forEach(([name, d]) => {
      html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">
        <span style="width:50px;font-size:11px">${name}</span>
        <div style="flex:1;background:var(--color-surface);border-radius:3px;height:16px;overflow:hidden">
          <div style="width:${d.pct}%;height:100%;background:${platColors2[name]||'#888'};border-radius:3px;display:flex;align-items:center;padding-left:4px">
            <span style="font-size:9px;color:#fff;font-weight:600">${d.count} (${d.pct}%)</span>
          </div>
        </div>
      </div>`;
    });
    html += '</div>';

    // Payout method
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px">';
    html += '<div style="font-size:12px; font-weight:700; margin-bottom:8px">Payout Method</div>';
    if (BS.payout_method) {
      const poColors = { Bank: '#2C3E50', Balance: '#27AE60', Wallet: '#8E44AD', Cash: '#E67E22' };
      Object.entries(BS.payout_method).forEach(([name, d]) => {
        html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">
          <span style="width:50px;font-size:11px">${name}</span>
          <div style="flex:1;background:var(--color-surface);border-radius:3px;height:16px;overflow:hidden">
            <div style="width:${d.pct}%;height:100%;background:${poColors[name]||'#888'};border-radius:3px;display:flex;align-items:center;padding-left:4px">
              <span style="font-size:9px;color:#fff;font-weight:600">${d.count} (${d.pct}%)</span>
            </div>
          </div>
        </div>`;
      });
    } else {
      html += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><span style="font-size:11px;color:var(--color-text-muted)">Bank payout only (transactionType=Transfer)</span></div>';
    }
    html += '</div>';
    html += '</div>'; // close 3-col grid

    // Overall Transfer Reasons
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:16px">';
    html += '<div style="font-size:13px; font-weight:700; margin-bottom:8px">Transfer Reasons (All Regions)</div>';
    html += '<table class="props-table" style="font-size:11px"><thead><tr><th style="text-align:left">Reason</th><th>Count</th><th>%</th><th style="width:30%">Distribution</th></tr></thead><tbody>';
    BS.transfer_reasons.forEach(r => {
      html += `<tr><td>${r.reason}</td><td style="text-align:right">${r.count}</td><td style="text-align:right">${r.pct}%</td>
      <td><div style="width:${Math.min(r.pct * 4, 100)}%;height:10px;background:#27AE60;border-radius:2px"></div></td></tr>`;
    });
    html += '</tbody></table></div>';

    // Region sections
    html += '<div style="font-size:15px; font-weight:700; margin-bottom:4px; border-bottom:1px solid var(--color-border); padding-bottom:6px">By Region</div>';
    html += '<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:12px">Balance sends only available in US, CA, NZ for consumer. UK, EU, AU = zero.</div>';

    Object.entries(BS.regions).forEach(([code, reg]) => {
      html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:12px">`;
      html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
        <h4 style="margin:0; font-size:15px">${reg.name} (${code})</h4>
        <div style="display:flex; gap:14px; font-size:12px">
          <span><strong>${reg.transactions.toLocaleString()}</strong> txns</span>
          <span><strong>${fmtK2(reg.volume_usd)}</strong> vol</span>
          <span>Avg <strong>${fmtK2(reg.avg_txn_usd)}</strong></span>
        </div>
      </div>`;

      html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">';

      // Transfer reasons
      html += '<div><div style="font-size:12px; font-weight:600; color:var(--color-text-muted); margin-bottom:6px">Transfer Reasons</div>';
      html += '<table class="props-table" style="font-size:11px"><thead><tr><th style="text-align:left">Reason</th><th>Count</th><th>%</th></tr></thead><tbody>';
      reg.transfer_reasons.forEach(r => {
        html += `<tr><td>${r.reason}</td><td style="text-align:right">${r.count}</td><td style="text-align:right">${r.pct}%</td></tr>`;
      });
      html += '</tbody></table></div>';

      // Corridors
      html += `<div><div style="font-size:12px; font-weight:600; color:var(--color-text-muted); margin-bottom:6px">Corridors (${reg.currency} → Payout)</div>`;
      html += '<table class="props-table" style="font-size:11px"><thead><tr><th style="text-align:left">Corridor</th><th>Txns</th><th>Volume</th><th>Avg</th></tr></thead><tbody>';
      reg.corridors.forEach(c => {
        html += `<tr><td style="font-weight:600">${reg.currency} → ${c.payout}</td><td style="text-align:right">${c.count}</td><td style="text-align:right">${fmtK2(c.volume_usd)}</td><td style="text-align:right">${c.count > 0 ? fmtK2(Math.round(c.volume_usd / c.count)) : '-'}</td></tr>`;
      });
      html += '</tbody></table></div>';
      html += '</div>'; // close grid

      // Top corridor reason breakdowns
      if (reg.top_corridor_reasons) {
        html += '<div style="margin-top:12px; display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:12px">';
        Object.entries(reg.top_corridor_reasons).forEach(([key, reasons]) => {
          const label = key.replace('_', ' → ');
          const total = reasons.reduce((s, r) => s + r.count, 0);
          html += `<div><div style="font-size:12px; font-weight:600; margin-bottom:4px">${label} Reasons</div>`;
          reasons.forEach(r => {
            const w = Math.max(5, Math.round(r.count / total * 100));
            html += `<div style="display:flex;align-items:center;gap:4px;margin:2px 0">
              <span style="width:120px;font-size:10px;text-align:right;color:var(--color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.reason}</span>
              <div style="width:${w}%;max-width:150px;height:12px;background:#27AE60;border-radius:2px;display:flex;align-items:center;padding-left:3px">
                <span style="font-size:8px;color:#fff">${r.count}</span>
              </div>
            </div>`;
          });
          html += '</div>';
        });
        html += '</div>';
      }

      html += '</div>'; // close region card
    });

    // Corridor × Transfer Reason breakdown
    if (BS.corridor_reasons) {
      html += '<div style="font-size:15px; font-weight:700; margin-bottom:4px; border-bottom:1px solid var(--color-border); padding-bottom:6px">Transfer Reasons by Corridor</div>';
      html += '<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:12px">Top 12 corridors with per-corridor reason breakdown</div>';
      html += '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px; margin-bottom:16px">';
      Object.values(BS.corridor_reasons).forEach(cr => {
        const total = cr.reasons.reduce((s, r) => s + r.count, 0);
        html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px">`;
        html += `<div style="display:flex; justify-content:space-between; margin-bottom:8px"><span style="font-size:13px; font-weight:700">${cr.corridor}</span><span style="font-size:11px; color:var(--color-text-muted)">${cr.txns} txns</span></div>`;
        cr.reasons.forEach(r => {
          const w = Math.max(5, Math.round(r.count / total * 100));
          html += `<div style="display:flex; align-items:center; gap:4px; margin:2px 0">
            <span style="width:120px; font-size:10px; text-align:right; color:var(--color-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${r.reason}">${r.reason}</span>
            <div style="width:${w}%; max-width:120px; height:12px; background:#27AE60; border-radius:2px; display:flex; align-items:center; padding-left:3px">
              <span style="font-size:8px; color:#fff">${r.count}</span>
            </div>
          </div>`;
        });
        html += '</div>';
      });
      html += '</div>';
    }

    // Insights
    html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:16px">';
    html += '<div style="font-size:13px; font-weight:700; margin-bottom:8px">Key Insights</div>';
    html += '<ul style="margin:0; padding-left:16px">';
    BS.insights.forEach(i => { html += `<li style="margin:4px 0; font-size:12px; line-height:1.5">${i}</li>`; });
    html += '</ul></div>';

    html += '</div>'; // close balance sends section
  }

  content.innerHTML = html;
}

// --- Health Check ---
function renderHealthCheck() {
  const content = document.getElementById('content');
  if (!HEALTH) { content.innerHTML = '<div class="loading">Health check data not loaded.</div>'; return; }

  const statusColor = s => s === 'healthy' ? 'var(--color-success)' : s === 'WARNING' || s === 'ELEVATED' ? 'var(--color-warning)' : s === 'CRITICAL' ? 'var(--color-error)' : 'var(--color-text-muted)';
  const impactColor = i => i === 'HIGH' ? 'var(--color-error)' : i === 'MEDIUM' ? 'var(--color-warning)' : 'var(--color-text-muted)';

  let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px">
    <h2 style="font-size:22px">Health Check</h2>
    <div style="display:flex; gap:8px; align-items:center">
      <span style="font-size:11px; color:var(--color-text-muted)">Last updated: ${new Date(HEALTH.generatedAt).toLocaleDateString()}</span>
      <a href="${HEALTH.amplitudeDashboard}" target="_blank" style="padding:8px 16px; background:var(--color-accent); color:white; border-radius:var(--radius); text-decoration:none; font-size:13px; font-weight:600">Open Live Dashboard in Amplitude</a>
    </div>
  </div>`;

  // KPIs Grid
  html += '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; margin-bottom:24px">';
  for (const [key, kpi] of Object.entries(HEALTH.kpis)) {
    const sc = statusColor(kpi.trend);
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; border-left:3px solid ${sc}">
      <div style="font-size:11px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.04em">${escapeHtml(kpi.label)}</div>
      <div style="font-size:24px; font-weight:700; margin:4px 0">${kpi.value.toLocaleString()}</div>
      <div style="font-size:12px; color:${sc}; font-weight:600">${escapeHtml(kpi.wow_change)} WoW &middot; ${escapeHtml(kpi.trend)}</div>
      ${kpi.benchmark_note ? `<div style="font-size:11px; color:var(--color-text-muted); margin-top:4px">${escapeHtml(kpi.benchmark_note)}</div>` : ''}
    </div>`;
  }
  html += '</div>';

  // Revenue Section
  if (HEALTH.revenue) {
    const rev = HEALTH.revenue;
    html += `<h3 style="font-size:16px; margin-bottom:4px">Consumer Revenue & Send Volume
      <a href="${HEALTH.revenueDashboard || '#'}" target="_blank" style="font-size:12px; font-weight:400; margin-left:8px; color:var(--color-accent)">Open Live Dashboard</a>
    </h3>`;
    html += `<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:12px">${escapeHtml(rev.filter)}</div>`;

    // Weekly sparklines (6 months)
    if (rev.weekly) {
      const w = rev.weekly;
      const metrics = [
        { label: 'Revenue (USD)', data: w.revenueUSD, fmt: v => '$' + (v/1e6).toFixed(2) + 'M', color: 'var(--color-accent)' },
        { label: 'Send Volume', data: w.sendVolumeUSD, fmt: v => '$' + (v/1e6).toFixed(0) + 'M', color: 'var(--color-success)' },
        { label: 'Transactions', data: w.txnCount, fmt: v => v.toLocaleString(), color: 'var(--color-web)' },
        { label: 'Unique Senders', data: w.uniqueSenders, fmt: v => v.toLocaleString(), color: 'var(--color-cross)' }
      ];

      html += '<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; margin-bottom:16px">';
      metrics.forEach(m => {
        const max = Math.max(...m.data);
        const last = m.data[m.data.length - 2]; // last complete week
        const prev = m.data[m.data.length - 3];
        const wow = prev > 0 ? ((last - prev) / prev * 100).toFixed(1) : '0';
        const wowColor = parseFloat(wow) >= 0 ? 'var(--color-success)' : 'var(--color-error)';

        html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px">
            <span style="font-size:11px; color:var(--color-text-muted)">${m.label}</span>
            <span style="font-size:11px; color:${wowColor}; font-weight:600">${wow > 0 ? '+' : ''}${wow}% WoW</span>
          </div>
          <div style="font-size:20px; font-weight:700; color:${m.color}; margin-bottom:6px">${m.fmt(last)}</div>
          <div style="display:flex; gap:1px; align-items:end; height:28px">`;
        m.data.forEach((v, i) => {
          const h = max > 0 ? Math.max(1, (v / max) * 28) : 1;
          const isLast = i >= m.data.length - 2;
          html += `<div style="flex:1; height:${h}px; background:${isLast ? m.color : m.color + '40'}; border-radius:1px" title="${w.dates[i]}: ${m.fmt(v)}"></div>`;
        });
        html += '</div><div style="display:flex; justify-content:space-between; font-size:9px; color:var(--color-text-muted); margin-top:2px"><span>${w.dates[0]}</span><span>${w.dates[w.dates.length-1]}</span></div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Monthly table
    html += '<details style="margin-bottom:16px"><summary style="cursor:pointer; font-size:12px; color:var(--color-accent); font-weight:600">Monthly breakdown</summary>';
    html += '<table class="props-table" style="font-size:12px; margin-top:8px"><thead><tr><th>Month</th><th>Revenue</th><th>Send Volume</th><th>Fees</th><th>Txns</th><th>Senders</th></tr></thead><tbody>';
    rev.monthly.forEach(m => {
      html += `<tr${m.note ? ' style="opacity:0.6"' : ''}>
        <td>${m.month}</td>
        <td style="font-weight:700">$${(m.revenueUSD/1e6).toFixed(2)}M</td>
        <td>$${(m.sendVolumeUSD/1e6).toFixed(0)}M</td>
        <td>$${(m.feesUSD/1e3).toFixed(0)}K</td>
        <td>${m.txnCount.toLocaleString()}</td>
        <td>${m.uniqueSenders.toLocaleString()}</td>
      </tr>`;
    });
    html += '</tbody></table></details>';

    // New vs repeat
    if (rev.new_vs_repeat) {
      html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; margin-bottom:12px">
        <div style="display:flex; gap:24px; align-items:center">
          <div><span style="font-size:11px; color:var(--color-text-muted)">First-time volume</span><br><span style="font-size:16px; font-weight:700">${rev.new_vs_repeat.first_time_share}</span> <span style="font-size:12px; color:var(--color-text-muted)">($${(rev.new_vs_repeat.first_time_volume_monthly/1e6).toFixed(0)}M/mo)</span></div>
          <div><span style="font-size:11px; color:var(--color-text-muted)">Repeat volume</span><br><span style="font-size:16px; font-weight:700">${rev.new_vs_repeat.repeat_share}</span> <span style="font-size:12px; color:var(--color-text-muted)">($${(rev.new_vs_repeat.repeat_volume_monthly/1e6).toFixed(0)}B/mo)</span></div>
          <div style="flex:1; font-size:12px; color:var(--color-text-secondary)">${escapeHtml(rev.new_vs_repeat.insight)}</div>
        </div>
      </div>`;
    }

    // Consumer platform breakdown (exclude corporate)
    if (rev.by_platform) {
      html += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:12px">';
      ['Web', 'iOS', 'Android'].forEach(p => {
        const pl = rev.by_platform[p];
        if (!pl) return;
        html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:12px">
          <div style="font-size:11px; color:var(--color-text-muted)">${p}</div>
          <div style="font-size:16px; font-weight:700">$${(pl.revenueUSD/1e6).toFixed(1)}M/mo</div>
          <div style="font-size:11px; color:var(--color-text-muted)">Avg txn: $${pl.avgTxnUSD.toLocaleString()} | Freq: ${rev.frequency[p]}x/mo</div>
        </div>`;
      });
      html += '</div>';
    }

    // Retention
    if (rev.retention_brackets) {
      html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; margin-bottom:16px">
        <div style="font-size:13px; font-weight:700; margin-bottom:8px">Sender Retention</div>
        <div style="display:flex; gap:4px; margin-bottom:8px">`;
      for (const [key, val] of Object.entries(rev.retention_brackets)) {
        if (key === 'insight') continue;
        const label = key.replace('day_', '').replace('_', '-') + 'd';
        const rate = parseFloat(val.rate);
        const color = rate >= 50 ? 'var(--color-success)' : rate >= 25 ? 'var(--color-warning)' : 'var(--color-error)';
        html += `<div style="flex:1; text-align:center; padding:8px 4px; background:${color}10; border-radius:var(--radius-sm)">
          <div style="font-size:16px; font-weight:700; color:${color}">${val.rate}</div>
          <div style="font-size:10px; color:var(--color-text-muted)">${label}</div>
        </div>`;
      }
      html += `</div><div style="font-size:11px; color:var(--color-text-muted)">${escapeHtml(rev.retention_brackets.insight)}</div></div>`;
    }
  }

  // Balance Section
  if (HEALTH.balance_health) {
    const bal = HEALTH.balance_health;
    html += `<h3 style="font-size:16px; margin-bottom:12px">Balance Product Health (US/CA/NZ Consumer)
      <a href="${bal.existingDashboard || HEALTH.revenueDashboard || '#'}" target="_blank" style="font-size:12px; font-weight:400; margin-left:8px; color:var(--color-accent)">Open Team Balance Dashboard</a>
    </h3>`;
    html += `<p style="font-size:13px; color:var(--color-text-secondary); margin-bottom:12px">${escapeHtml(bal.summary)}</p>`;

    // Transaction Completed breakdown
    if (bal.transaction_completed_breakdown) {
      const tcb = bal.transaction_completed_breakdown;
      html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; margin-bottom:12px">';
      html += '<div style="font-size:13px; font-weight:700; margin-bottom:8px">Weekly Completed Transactions (Transaction Completed by transactionType)</div>';
      html += '<table class="props-table" style="font-size:12px"><thead><tr><th>Type</th><th>US</th><th>CA</th><th>NZ</th></tr></thead><tbody>';
      html += `<tr><td><strong>Fund Balance</strong> (top-ups)</td><td>${tcb.fund_balance_weekly.US}</td><td>${tcb.fund_balance_weekly.CA}</td><td>${tcb.fund_balance_weekly.NZ}</td></tr>`;
      html += `<tr><td><strong>Convert Balance</strong> (exchange)</td><td>${tcb.convert_balance_weekly.US}</td><td>${tcb.convert_balance_weekly.CA}</td><td>${tcb.convert_balance_weekly.NZ}</td></tr>`;
      html += `<tr><td><strong>Send via Balance</strong> (transfers)</td><td>${tcb.send_via_balance_weekly.US}</td><td>${tcb.send_via_balance_weekly.CA}</td><td>${tcb.send_via_balance_weekly.NZ}</td></tr>`;
      html += '</tbody></table>';
      if (bal.daily_volume_usd) {
        html += `<div style="font-size:11px; color:var(--color-text-muted); margin-top:6px">Daily USD volume: Fund Balance ${bal.daily_volume_usd.fund_balance}, Send via Balance ${bal.daily_volume_usd.send_via_balance}</div>`;
      }
      html += '</div>';
    }

    // Registration to Activation funnel
    if (bal.registration_to_activation) {
      const rta = bal.registration_to_activation;
      html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; margin-bottom:12px">';
      html += '<div style="font-size:13px; font-weight:700; margin-bottom:6px">Registration → Balance Activation (users from balance entry points)</div>';
      html += '<div style="display:flex; gap:12px; margin-bottom:6px">';
      for (const [region, rate] of Object.entries(rta.conversion)) {
        html += `<div style="padding:8px 16px; background:var(--color-bg-alt); border-radius:var(--radius-sm); text-align:center">
          <div style="font-size:18px; font-weight:700; color:var(--color-accent)">${rate}</div>
          <div style="font-size:11px; color:var(--color-text-muted)">${region}</div>
        </div>`;
      }
      html += '</div>';
      if (rta.note) html += `<div style="font-size:11px; color:var(--color-text-muted)">${escapeHtml(rta.note)}</div>`;
      html += '</div>';
    }

    // 6-month weekly trends
    if (bal.weekly_trends_6mo) {
      const wt = bal.weekly_trends_6mo;
      const series = [
        { label: 'Fund Balance Users', data: wt.fund_balance_users, color: 'var(--color-accent)' },
        { label: 'Send via Balance Users', data: wt.send_via_balance_users, color: 'var(--color-success)' },
        { label: 'Fund Balance Volume ($)', data: wt.fund_balance_volume_usd, color: 'var(--color-web)', fmt: v => '$' + (v/1e3).toFixed(0) + 'K' },
        { label: 'Send via Balance Volume ($)', data: wt.send_via_balance_volume_usd, color: 'var(--color-cross)', fmt: v => '$' + (v/1e3).toFixed(0) + 'K' }
      ];

      html += '<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; margin-bottom:16px">';
      series.forEach(s => {
        const max = Math.max(...s.data);
        const last = s.data[s.data.length - 2];
        const fmt = s.fmt || (v => v.toLocaleString());

        html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px">
          <div style="font-size:11px; color:var(--color-text-muted); margin-bottom:4px">${s.label}</div>
          <div style="font-size:18px; font-weight:700; color:${s.color}; margin-bottom:6px">${fmt(last)}</div>
          <div style="display:flex; gap:1px; align-items:end; height:28px">`;
        s.data.forEach((v, i) => {
          const h = max > 0 ? Math.max(0, (v / max) * 28) : 0;
          const isRecent = i >= s.data.length - 4;
          html += `<div style="flex:1; height:${h}px; background:${isRecent ? s.color : s.color + '30'}; border-radius:1px" title="${wt.dates[i]}: ${fmt(v)}"></div>`;
        });
        html += `</div>
          <div style="display:flex; justify-content:space-between; font-size:9px; color:var(--color-text-muted); margin-top:2px">
            <span>${wt.dates[0]}</span><span>${wt.dates[wt.dates.length-1]}</span>
          </div>
        </div>`;
      });
      html += '</div>';
      if (wt.note) html += `<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:12px">${escapeHtml(wt.note)}</div>`;
    }

    // Add Funds
    if (bal.add_funds) {
      const af = bal.add_funds;
      html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:12px; border-left:3px solid var(--color-success)">`;
      html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
        <span style="font-weight:700">Add Funds</span>
        <span style="font-size:14px; font-weight:700; color:var(--color-success)">${af.growth}</span>
      </div>`;

      // Mini sparkline
      if (af.weekly_trend) {
        const max = Math.max(...af.weekly_trend);
        html += '<div style="display:flex; gap:2px; align-items:end; height:32px; margin-bottom:8px">';
        af.weekly_trend.forEach(v => {
          const h = Math.max(2, (v / max) * 32);
          html += `<div style="flex:1; height:${h}px; background:var(--color-success); border-radius:1px; opacity:0.6" title="${v}"></div>`;
        });
        html += '</div>';
      }

      // Platform breakdown (consumer only)
      html += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-bottom:8px">';
      ['iOS', 'Android', 'Web'].forEach(p => {
        const pl = af.by_platform[p];
        if (!pl) return;
        html += `<div style="padding:6px; background:var(--color-bg-alt); border-radius:var(--radius-sm); font-size:12px">
          <strong>${p}</strong>: ${pl.accessed}/wk → ${pl.completed} completed (${pl.conversion})
        </div>`;
      });
      html += '</div>';

      // Top currencies
      html += '<div style="font-size:12px; color:var(--color-text-muted); margin-bottom:8px">Top currencies: ';
      html += af.by_currency.slice(0, 5).map(c => `${c.currency} ${c.share}`).join(', ');
      html += '</div>';

      // Issues
      if (af.issues) {
        af.issues.forEach(i => {
          const color = i.status === 'CONFIRMED' ? 'var(--color-error)' : 'var(--color-warning)';
          html += `<div style="font-size:12px; padding:8px; background:${color}10; border-radius:var(--radius-sm); margin-bottom:4px; border-left:2px solid ${color}">
            <strong style="color:${color}">${escapeHtml(i.issue)}</strong><br>
            <span style="color:var(--color-text-secondary)">${escapeHtml(i.detail)}</span>
            ${i.fix ? `<br><strong>Fix:</strong> ${escapeHtml(i.fix)}` : ''}
          </div>`;
        });
      }
      html += '</div>';
    }

    // Currency Activation
    if (bal.currency_activation) {
      const ca = bal.currency_activation;
      html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:12px; border-left:3px solid var(--color-success)">`;
      html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
        <span style="font-weight:700">Currency Account Activation</span>
        <span style="font-size:14px; font-weight:700; color:var(--color-success)">${ca.growth}</span>
      </div>`;

      html += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-bottom:8px">';
      ['iOS', 'Android', 'Web'].forEach(p => {
        const pl = ca.by_platform[p];
        if (!pl) return;
        html += `<div style="padding:6px; background:var(--color-bg-alt); border-radius:var(--radius-sm); font-size:12px">
          <strong>${p}</strong>: ${pl.conversion} completion
        </div>`;
      });
      html += '</div>';
      html += `<div style="font-size:11px; color:var(--color-text-muted)">${escapeHtml(ca.insight)}</div>`;
      html += '</div>';
    }

    // Balance Usage & Idle Money
    if (bal.balance_usage) {
      const bu = bal.balance_usage;
      html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px; margin-bottom:12px; border-left:3px solid var(--color-warning)">`;
      html += `<div style="font-weight:700; font-size:15px; margin-bottom:8px">${escapeHtml(bu.title)}</div>`;

      // Fund → Send rate
      html += `<div style="display:flex; gap:16px; margin-bottom:12px">
        <div style="padding:12px 20px; background:var(--color-error)10; border-radius:var(--radius-sm); text-align:center">
          <div style="font-size:28px; font-weight:700; color:var(--color-error)">${bu.fund_then_send_rate}</div>
          <div style="font-size:11px; color:var(--color-text-muted)">Fund → Send within 30d</div>
        </div>
        <div style="flex:1; font-size:12px; color:var(--color-text-secondary); line-height:1.6">${escapeHtml(bu.fund_then_send_detail)}</div>
      </div>`;

      // Unique users trend
      if (bu.unique_users_monthly) {
        const uu = bu.unique_users_monthly;
        html += '<div style="font-size:13px; font-weight:600; margin-bottom:6px">Monthly Unique Users</div>';
        html += '<table class="props-table" style="font-size:12px; margin-bottom:8px"><thead><tr><th></th>';
        uu.months.forEach(m => { html += `<th>${m}</th>`; });
        html += '</tr></thead><tbody>';
        html += '<tr><td>Fund Balance</td>' + uu.fund_balance.map(v => `<td>${v}</td>`).join('') + '</tr>';
        html += '<tr><td><strong>Send via Balance</strong></td>' + uu.send_via_balance.map(v => `<td style="color:var(--color-success); font-weight:700">${v}</td>`).join('') + '</tr>';
        html += '<tr><td>Convert Balance</td>' + uu.convert_balance.map(v => `<td>${v}</td>`).join('') + '</tr>';
        html += '</tbody></table>';
        html += `<div style="font-size:11px; color:var(--color-success); font-weight:600">${escapeHtml(uu.insight)}</div>`;
      }

      // User growth by region
      if (bu.user_growth_by_region) {
        const ug = bu.user_growth_by_region;
        html += `<div style="font-size:13px; font-weight:700; margin:16px 0 8px">New Balance Users by Region (Monthly)</div>`;
        html += `<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:8px">${escapeHtml(ug.insight)}</div>`;

        ['US', 'CA', 'NZ'].forEach(r => {
          const rd = ug[r];
          if (!rd || !rd.new_activated.some(v => v > 0)) return;

          html += `<div style="margin-bottom:12px; padding:10px; background:var(--color-bg-alt); border-radius:var(--radius-sm)">`;
          html += `<div style="font-weight:700; font-size:13px; margin-bottom:6px">${r} <span style="font-weight:400; color:var(--color-text-muted); font-size:11px">— Cumulative pool: ${rd.cumulative_pool[rd.cumulative_pool.length - 1].toLocaleString()} users</span></div>`;
          html += '<table class="props-table" style="font-size:11px"><thead><tr><th></th>';
          ug.months.forEach(m => { html += `<th style="text-align:right">${m}</th>`; });
          html += '</tr></thead><tbody>';

          html += '<tr><td style="font-weight:600; color:var(--color-accent)">New Activated</td>';
          rd.new_activated.forEach(v => { html += `<td style="text-align:right; color:var(--color-accent); font-weight:700">${v > 0 ? v.toLocaleString() : '-'}</td>`; });
          html += '</tr>';

          html += '<tr><td>Cum. User Pool</td>';
          rd.cumulative_pool.forEach(v => { html += `<td style="text-align:right">${v > 0 ? v.toLocaleString() : '-'}</td>`; });
          html += '</tr>';

          html += '<tr style="border-top:1px solid var(--color-border)"><td style="font-weight:600">Funded</td>';
          rd.funded_users.forEach(v => { html += `<td style="text-align:right; font-weight:600">${v > 0 ? v.toLocaleString() : '-'}</td>`; });
          html += '</tr>';

          html += '<tr><td>Sent via Balance</td>';
          rd.sent_users.forEach(v => { html += `<td style="text-align:right; color:var(--color-success)">${v > 0 ? v.toLocaleString() : '-'}</td>`; });
          html += '</tr>';

          html += '<tr><td>Converted</td>';
          rd.convert_users.forEach(v => { html += `<td style="text-align:right">${v > 0 ? v.toLocaleString() : '-'}</td>`; });
          html += '</tr>';

          html += '<tr style="border-top:1px solid var(--color-border)"><td style="font-size:10px; color:var(--color-text-muted)">Balance Registrations</td>';
          rd.balance_registrations.forEach(v => { html += `<td style="text-align:right; font-size:10px; color:var(--color-text-muted)">${v > 0 ? v.toLocaleString() : '-'}</td>`; });
          html += '</tr>';

          html += '</tbody></table>';
          if (rd.note) html += `<div style="font-size:10px; color:var(--color-text-muted); margin-top:4px">${escapeHtml(rd.note)}</div>`;
          html += '</div>';
        });
      }

      // Fraud & Account Closures
      if (bu.user_growth_by_region && bu.user_growth_by_region.fraud_and_closures) {
        const fc = bu.user_growth_by_region.fraud_and_closures;
        html += `<div style="font-size:13px; font-weight:700; margin:16px 0 8px; color:var(--color-error)">${escapeHtml(fc.title)}</div>`;
        html += `<div style="font-size:11px; color:var(--color-text-secondary); margin-bottom:8px">${escapeHtml(fc.insight)}</div>`;

        // US breakdown (main fraud issue)
        if (fc.US) {
          const us = fc.US;
          html += `<div style="background:var(--color-error)08; border:1px solid var(--color-error)30; border-radius:var(--radius); padding:14px; margin-bottom:12px">`;
          html += '<div style="font-weight:700; margin-bottom:8px">US Balance Users — Fraud Impact</div>';

          html += '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:10px">';
          html += `<div style="text-align:center; padding:8px; background:var(--color-bg-card); border-radius:var(--radius-sm)">
            <div style="font-size:20px; font-weight:700">${us.total_activated.toLocaleString()}</div>
            <div style="font-size:10px; color:var(--color-text-muted)">Activated</div>
          </div>`;
          html += `<div style="text-align:center; padding:8px; background:var(--color-bg-card); border-radius:var(--radius-sm)">
            <div style="font-size:20px; font-weight:700; color:var(--color-error)">${us.account_closed_within_30d.toLocaleString()}</div>
            <div style="font-size:10px; color:var(--color-text-muted)">Closed (${us.closure_rate})</div>
          </div>`;
          html += `<div style="text-align:center; padding:8px; background:var(--color-bg-card); border-radius:var(--radius-sm)">
            <div style="font-size:20px; font-weight:700; color:var(--color-warning)">${us.fraud_checked.toLocaleString()}</div>
            <div style="font-size:10px; color:var(--color-text-muted)">Fraud Checked (${us.fraud_check_rate})</div>
          </div>`;
          html += `<div style="text-align:center; padding:8px; background:var(--color-bg-card); border-radius:var(--radius-sm)">
            <div style="font-size:20px; font-weight:700; color:var(--color-error)">${us.fraud_referred.toLocaleString()}</div>
            <div style="font-size:10px; color:var(--color-text-muted)">Fraud Referred (${us.fraud_referral_rate})</div>
          </div>`;
          html += '</div>';

          // Monthly closures sparkline
          if (us.monthly_closures) {
            html += '<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:4px">Monthly Account Closures (US, all users in balance regions):</div>';
            const max = Math.max(...us.monthly_closures);
            html += '<div style="display:flex; gap:2px; align-items:end; height:32px; margin-bottom:4px">';
            us.monthly_closures.forEach((v, i) => {
              const h = Math.max(2, (v / max) * 32);
              html += `<div style="flex:1; height:${h}px; background:var(--color-error); border-radius:1px; opacity:0.7" title="${us.monthly_closures_months[i]}: ${v.toLocaleString()} closed"></div>`;
            });
            html += '</div>';
            html += '<div style="display:flex; justify-content:space-between; font-size:9px; color:var(--color-text-muted)">';
            html += `<span>${us.monthly_closures_months[0]}</span><span>${us.monthly_closures_months[us.monthly_closures_months.length-1]}</span></div>`;
          }

          if (us.note) html += `<div style="font-size:11px; color:var(--color-text-secondary); margin-top:6px">${escapeHtml(us.note)}</div>`;
          html += '</div>';
        }

        // CA and NZ summary
        html += '<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-bottom:12px">';
        ['CA', 'NZ'].forEach(r => {
          const rd = fc[r];
          if (!rd) return;
          html += `<div style="padding:10px; background:var(--color-bg-alt); border-radius:var(--radius-sm); font-size:12px">
            <strong>${r}</strong>: ${rd.total_activated.toLocaleString()} activated, ${rd.account_closed_within_30d} closed (${rd.closure_rate}), ${rd.fraud_referred} fraud-referred
            <div style="font-size:10px; color:var(--color-text-muted); margin-top:2px">${escapeHtml(rd.note)}</div>
          </div>`;
        });
        html += '</div>';
      }

      // Avg amounts
      if (bu.avg_amounts) {
        const aa = bu.avg_amounts;
        html += '<div style="font-size:13px; font-weight:600; margin:12px 0 6px">Avg Transaction Amount (USD)</div>';
        html += '<table class="props-table" style="font-size:12px; margin-bottom:8px"><thead><tr><th></th>';
        aa.months.forEach(m => { html += `<th>${m}</th>`; });
        html += '</tr></thead><tbody>';
        html += '<tr><td>Avg Top-up</td>' + aa.avg_topup_usd.map(v => `<td>$${v.toLocaleString()}</td>`).join('') + '</tr>';
        html += '<tr><td>Avg Send via Balance</td>' + aa.avg_send_via_balance_usd.map(v => `<td style="color:var(--color-success); font-weight:700">$${v.toLocaleString()}</td>`).join('') + '</tr>';
        html += '</tbody></table>';
        html += `<div style="font-size:11px; color:var(--color-text-muted)">${escapeHtml(aa.insight)}</div>`;
      }

      // Frequency
      if (bu.frequency) {
        html += `<div style="margin-top:8px; font-size:12px; color:var(--color-text-secondary)">
          Frequency: ${bu.frequency.fund_balance_per_user_per_month}x top-ups/user/month, ${bu.frequency.send_via_balance_per_user_per_month}x sends/user/month
        </div>`;
      }

      // Balance remaining by region
      if (bu.balance_remaining_by_region) {
        const br = bu.balance_remaining_by_region;
        html += `<div style="font-size:13px; font-weight:700; margin:16px 0 8px">${escapeHtml(br.title)}</div>`;
        html += `<div style="font-size:11px; color:var(--color-text-muted); margin-bottom:8px">${escapeHtml(br.period)}</div>`;
        html += '<table class="props-table" style="font-size:12px; margin-bottom:8px"><thead><tr><th>Region</th><th>Funded</th><th>Sent (Out)</th><th>Converted (Internal)</th><th>Remaining (Held)</th><th>Utilization (Sent/Funded)</th></tr></thead><tbody>';
        ['US', 'CA', 'NZ'].forEach(r => {
          const rd = br[r];
          if (!rd) return;
          const isNeg = rd.remaining < 0;
          const remColor = isNeg ? 'var(--color-success)' : 'var(--color-warning)';
          html += `<tr>
            <td><strong>${r}</strong></td>
            <td>$${(rd.total_funded/1e6).toFixed(2)}M</td>
            <td>$${(rd.total_sent/1e6).toFixed(2)}M</td>
            <td>$${(rd.total_converted/1e3).toFixed(0)}K</td>
            <td style="font-weight:700; color:${remColor}">${isNeg ? '-' : ''}$${(Math.abs(rd.remaining)/1e6).toFixed(2)}M</td>
            <td>${rd.utilization}</td>
          </tr>`;
        });
        if (br.total) {
          const t = br.total;
          html += `<tr style="border-top:2px solid var(--color-border); font-weight:700">
            <td>TOTAL</td>
            <td>$${(t.total_funded/1e6).toFixed(2)}M</td>
            <td>$${(t.total_sent/1e6).toFixed(2)}M</td>
            <td>$${(t.total_converted/1e6).toFixed(2)}M</td>
            <td style="color:var(--color-warning)">$${(t.remaining/1e6).toFixed(2)}M</td>
            <td>${t.utilization}</td>
          </tr>`;
        }
        html += '</tbody></table>';
        if (br.total && br.total.insight) {
          html += `<div style="font-size:11px; color:var(--color-text-secondary)">${escapeHtml(br.total.insight)}</div>`;
        }
      }

      // Idle money insight
      if (bu.idle_money_insight) {
        html += `<div style="margin-top:10px; padding:8px 12px; background:var(--color-warning)10; border-radius:var(--radius-sm); font-size:12px; color:var(--color-text-secondary); border-left:2px solid var(--color-warning)">
          <strong style="color:var(--color-warning)">Idle Money Opportunity:</strong> ${escapeHtml(bu.idle_money_insight)}
        </div>`;
      }

      html += '</div>';
    }

    // Convert Balance
    if (bal.convert_balance) {
      html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; margin-bottom:16px">
        <span style="font-weight:700">Convert Balance</span>
        <span style="font-size:12px; color:var(--color-text-muted); margin-left:8px">${escapeHtml(bal.convert_balance.volume)}</span>
        <div style="font-size:11px; color:var(--color-warning); margin-top:4px">${escapeHtml(bal.convert_balance.naming_issue)}</div>
      </div>`;
    }
  }

  // Funnel Health
  html += '<h3 style="font-size:16px; margin-bottom:12px">Funnel Health</h3>';
  html += '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px; margin-bottom:24px">';
  for (const [key, funnel] of Object.entries(HEALTH.funnel_health)) {
    const sc = statusColor(funnel.status);
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:14px; border-left:3px solid ${sc}">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <span style="font-weight:600; font-size:13px">${escapeHtml(funnel.label)}</span>
        <span style="font-size:18px; font-weight:700; color:${sc}">${funnel.conversion || funnel.rate}</span>
      </div>
      <div style="font-size:11px; color:${sc}; font-weight:600; margin-top:2px">${escapeHtml(funnel.status)}</div>
      ${funnel.note ? `<div style="font-size:11px; color:var(--color-text-muted); margin-top:4px">${escapeHtml(funnel.note)}</div>` : ''}
    </div>`;
  }
  html += '</div>';

  // Top Corridors
  html += '<h3 style="font-size:16px; margin-bottom:12px">Top Corridors (This Week)</h3>';
  html += '<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); overflow:hidden; margin-bottom:24px">';
  html += '<table class="props-table"><thead><tr><th>#</th><th>Country</th><th>Volume</th><th>Share</th><th></th></tr></thead><tbody>';
  HEALTH.top_corridors.forEach((c, i) => {
    const barWidth = (c.volume / HEALTH.top_corridors[0].volume * 100);
    html += `<tr><td>${i+1}</td><td><strong>${escapeHtml(c.name)}</strong> (${c.country})</td>
      <td style="text-align:right; font-weight:600">${c.volume.toLocaleString()}</td>
      <td style="text-align:right">${c.share}</td>
      <td style="width:120px"><div style="height:8px; background:var(--color-accent-light); border-radius:4px; overflow:hidden"><div style="height:100%; width:${barWidth}%; background:var(--color-accent); border-radius:4px"></div></div></td></tr>`;
  });
  html += '</tbody></table></div>';

  // Error Health
  if (HEALTH.error_health) {
    html += '<h3 style="font-size:16px; margin-bottom:12px">Error Health (Per Case)</h3>';
    for (const [key, errGroup] of Object.entries(HEALTH.error_health)) {
      html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); margin-bottom:16px; overflow:hidden">`;
      html += `<div style="padding:14px 20px; background:var(--color-bg-alt); border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center">
        <div>
          <span style="font-weight:700; font-size:15px">${escapeHtml(errGroup.event)}</span>
          ${errGroup.total_last_week ? `<span style="font-size:13px; color:var(--color-text-muted); margin-left:8px">${errGroup.total_last_week.toLocaleString()}/week</span>` : ''}
        </div>
        ${errGroup.trend ? `<span style="font-size:12px; color:${errGroup.trend.includes('SPIKE') || errGroup.trend.includes('ELEVATED') ? 'var(--color-error)' : 'var(--color-text-muted)'}; font-weight:600">${escapeHtml(errGroup.trend)}</span>` : ''}
      </div>`;

      if (errGroup.cases) {
        html += '<div style="padding:0 20px">';
        errGroup.cases.forEach(c => {
          const caseStatus = c.status || 'monitor';
          const caseColor = caseStatus.includes('SPIKE') || caseStatus.includes('ELEVATED') || caseStatus.includes('RISING') ? 'var(--color-error)' :
                           caseStatus === 'DECLINING' ? 'var(--color-success)' :
                           caseStatus === 'stable' ? 'var(--color-text-muted)' : 'var(--color-warning)';

          html += `<div style="padding:10px 0; border-bottom:1px solid var(--color-border)">`;
          html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px">
            <span style="font-size:13px; font-weight:600">${escapeHtml(c.case)}</span>
            <div style="display:flex; align-items:center; gap:8px">
              ${c.last_week !== undefined ? `<span style="font-weight:700; font-size:14px">${typeof c.last_week === 'number' ? c.last_week.toLocaleString() : c.last_week}</span>` : ''}
              <span style="font-size:11px; font-weight:600; color:${caseColor}; background:${caseColor}15; padding:2px 8px; border-radius:10px">${escapeHtml(caseStatus)}</span>
            </div>
          </div>`;

          // Mini sparkline from weekly data
          if (c.weekly && c.weekly.length > 1) {
            const max = Math.max(...c.weekly);
            html += '<div style="display:flex; gap:2px; align-items:end; height:24px; margin:4px 0">';
            c.weekly.forEach(v => {
              const h = max > 0 ? Math.max(2, (v / max) * 24) : 2;
              const barColor = v === Math.max(...c.weekly) && caseStatus !== 'stable' ? caseColor : 'var(--color-border)';
              html += `<div style="flex:1; height:${h}px; background:${barColor}; border-radius:1px" title="${v.toLocaleString()}"></div>`;
            });
            html += '</div>';
          }

          if (c.note) html += `<div style="font-size:11px; color:var(--color-text-muted); margin-top:2px">${escapeHtml(c.note)}</div>`;
          if (c.action) html += `<div style="font-size:11px; color:var(--color-error); font-weight:600; margin-top:4px">${escapeHtml(c.action)}</div>`;
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    }
  }

  // Growth Opportunities
  html += '<h3 style="font-size:16px; margin-bottom:12px">Growth Opportunities</h3>';
  HEALTH.growth_opportunities.forEach(opp => {
    const ic = impactColor(opp.impact);
    html += `<div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); padding:16px 20px; margin-bottom:12px; border-left:3px solid ${ic}">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px">
        <span style="font-size:15px; font-weight:700">${escapeHtml(opp.title)}</span>
        <span class="badge" style="background:${ic}20; color:${ic}; font-weight:700">${opp.impact}</span>
        <span style="font-size:11px; color:var(--color-text-muted); background:var(--color-bg-alt); padding:2px 8px; border-radius:10px">${escapeHtml(opp.category)}</span>
        ${opp.metric ? `<span style="font-size:12px; font-weight:600; color:var(--color-accent)">${escapeHtml(opp.metric)}</span>` : ''}
      </div>
      <p style="font-size:13px; color:var(--color-text-secondary); line-height:1.6; margin-bottom:8px">${escapeHtml(opp.description)}</p>
      ${opp.action ? `<div style="font-size:12px; color:var(--color-text); background:var(--color-bg-alt); padding:8px 12px; border-radius:var(--radius-sm)"><strong>Action:</strong> ${escapeHtml(opp.action)}</div>` : ''}
    </div>`;
  });

  content.innerHTML = html;
}

// --- Error Reference ---
function renderErrorReference() {
  const content = document.getElementById('content');
  if (!ERROR_REF) {
    content.innerHTML = '<div class="loading">Error reference not loaded.</div>';
    return;
  }

  let html = '<a class="back-link" href="#/">&#8592; All events</a>';
  html += '<h2 style="font-size:20px; margin-bottom:8px">Error Event Reference</h2>';
  html += '<p style="color:var(--color-text-secondary); font-size:13px; margin-bottom:20px">Real attribute values from Amplitude production data (last 30 days). Every error code and its meaning.</p>';

  for (const [eventName, err] of Object.entries(ERROR_REF.errors)) {
    html += `<div style="margin-bottom:24px; background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius); overflow:hidden">`;

    // Header
    html += `<div style="padding:16px 20px; background:var(--color-bg-alt); border-bottom:1px solid var(--color-border)">`;
    html += `<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px">`;
    html += `<a href="#/event/${encodeURIComponent(eventName)}" style="font-size:18px; font-weight:700; color:var(--color-text); text-decoration:none">${escapeHtml(eventName)}</a>`;
    html += `<span class="badge badge-${err.source === 'server_side' ? 'server' : 'cross'}">${err.source === 'server_side' ? 'Backend' : 'Client'}</span>`;
    html += err.platforms.map(p => `<span class="badge badge-${p.toLowerCase()}">${p}</span>`).join(' ');
    html += `</div>`;
    html += `<p style="font-size:13px; color:var(--color-text-secondary)">${escapeHtml(err.description)}</p>`;
    if (err.volume_30d) html += `<p style="font-size:12px; color:var(--color-text-muted); margin-top:4px">Volume: ${escapeHtml(err.volume_30d)}</p>`;
    if (err.issues) {
      html += err.issues.map(i => `<p style="font-size:12px; color:var(--color-error); margin-top:4px; font-weight:600">${escapeHtml(i)}</p>`).join('');
    }
    html += `</div>`;

    // Attributes
    const attrs = err.attributes || err.attributes_web || {};
    html += `<div style="padding:16px 20px">`;

    for (const [propName, prop] of Object.entries(attrs)) {
      html += `<div style="margin-bottom:16px">`;
      html += `<div style="font-family:var(--font-mono); font-size:13px; font-weight:700; color:var(--color-text); margin-bottom:4px">${escapeHtml(propName)} <span style="font-weight:400; color:var(--color-text-muted); font-size:11px">${escapeHtml(prop.type || '')}</span></div>`;
      html += `<div style="font-size:12px; color:var(--color-text-secondary); margin-bottom:6px">${escapeHtml(prop.description || '')}</div>`;

      // If has values breakdown
      if (prop.values && typeof prop.values === 'object' && !Array.isArray(prop.values)) {
        html += `<table class="props-table" style="font-size:12px">`;
        html += `<thead><tr><th>Value</th><th>Count</th><th>Meaning</th></tr></thead><tbody>`;
        for (const [val, info] of Object.entries(prop.values)) {
          const count = typeof info === 'object' ? (info.count || '') : info;
          const meaning = typeof info === 'object' ? (info.meaning || '') : '';
          html += `<tr><td><code style="font-size:11px; background:var(--color-bg-alt); padding:1px 6px; border-radius:3px">${escapeHtml(val)}</code></td>`;
          html += `<td style="text-align:right; color:var(--color-text-muted)">${typeof count === 'number' ? count.toLocaleString() : count}</td>`;
          html += `<td>${escapeHtml(meaning)}</td></tr>`;
        }
        html += `</tbody></table>`;
      }

      // If has top_values (array)
      if (prop.top_values && Array.isArray(prop.top_values)) {
        html += `<table class="props-table" style="font-size:12px">`;
        html += `<thead><tr><th>Value</th><th>Count</th><th>Meaning</th></tr></thead><tbody>`;
        for (const item of prop.top_values) {
          if (typeof item === 'string') {
            html += `<tr><td colspan="3"><code style="font-size:11px; background:var(--color-bg-alt); padding:1px 6px; border-radius:3px">${escapeHtml(item)}</code></td></tr>`;
          } else {
            html += `<tr><td><code style="font-size:11px; background:var(--color-bg-alt); padding:1px 6px; border-radius:3px; word-break:break-all">${escapeHtml(item.value || '')}</code></td>`;
            html += `<td style="text-align:right; color:var(--color-text-muted)">${item.count ? item.count.toLocaleString() : ''}</td>`;
            html += `<td>${escapeHtml(item.meaning || '')}</td></tr>`;
          }
        }
        html += `</tbody></table>`;
      }

      // If has note
      if (prop.note) {
        html += `<div style="font-size:11px; color:var(--color-text-muted); font-style:italic; margin-top:4px">${escapeHtml(prop.note)}</div>`;
      }

      html += `</div>`;
    }

    // Mobile-specific attributes
    if (err.attributes_mobile) {
      html += `<div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--color-border)">`;
      html += `<div style="font-size:12px; font-weight:700; color:var(--color-text-muted); margin-bottom:8px">MOBILE-SPECIFIC ATTRIBUTES (Login failed — lowercase f)</div>`;
      for (const [propName, prop] of Object.entries(err.attributes_mobile)) {
        html += `<div style="margin-bottom:8px">`;
        html += `<span style="font-family:var(--font-mono); font-size:12px; font-weight:600">${escapeHtml(propName)}</span>`;
        html += ` <span style="font-size:11px; color:var(--color-text-muted)">${escapeHtml(prop.type || '')}</span>`;
        html += ` — <span style="font-size:12px; color:var(--color-text-secondary)">${escapeHtml(prop.description || '')}</span>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    html += `</div></div>`;
  }

  content.innerHTML = html;
}

// --- Helpers ---
function getCategoryName(id) {
  const cat = DATA.categories.find(c => c.id === id);
  return cat ? cat.name : id || 'Other';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function setSourceFilter(source) {
  currentFilter.source = source;
  renderEventList();
}

function setPlatformFilter(platform) {
  currentFilter.platform = platform;
  renderEventList();
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', init);

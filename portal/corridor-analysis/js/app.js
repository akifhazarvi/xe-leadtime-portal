(function() {
  'use strict';

  let DATA = null;
  let sortField = 'completed';
  let sortAsc = false;
  let filterRegion = 'all';
  let filterSendCurrency = 'all';

  // --- Region flag/emoji map ---
  const REGION_FLAGS = {
    'US': '\u{1F1FA}\u{1F1F8}', 'UK': '\u{1F1EC}\u{1F1E7}',
    'EU': '\u{1F1EA}\u{1F1FA}', 'AU': '\u{1F1E6}\u{1F1FA}',
    'CA': '\u{1F1E8}\u{1F1E6}', 'NZ': '\u{1F1F3}\u{1F1FF}',
    '(none)': '\u26A0\uFE0F'
  };

  function regionFlag(r) { return REGION_FLAGS[r] || ''; }
  function fmt(n) { return n.toLocaleString(); }
  function pct(n) { return n.toFixed(1) + '%'; }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => (o || {})[k], obj);
  }

  function conversionColor(rate) {
    if (rate >= 85) return 'var(--color-success)';
    if (rate >= 70) return 'var(--color-warning)';
    if (rate >= 50) return '#d97706';
    return 'var(--color-error)';
  }

  function medianTimeColor(seconds) {
    if (seconds === 0) return 'var(--color-text-secondary)';
    if (seconds < 3600) return 'var(--color-success)';
    if (seconds < 86400) return 'var(--color-warning)';
    return 'var(--color-error)';
  }

  // --- Load data ---
  async function init() {
    const resp = await fetch('data/corridors.json');
    DATA = await resp.json();
    setupNav();
    setupFilters();
    renderCorridors();
    renderRegionSummary();
    renderMobileWebHealth();
    renderWorstPerformers();
    updateHeaderStats();
  }

  function updateHeaderStats() {
    const m = DATA.metadata;
    document.getElementById('header-stats').textContent =
      `${m.totalCorridors} corridors | ${fmt(m.totalQuotedUsers)} quoted | ${fmt(m.totalCompletedUsers)} completed | ${m.overallConversion}% conversion | ${m.period}`;
  }

  // --- Navigation ---
  function setupNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('view-' + btn.dataset.view).classList.add('active');
      });
    });
  }

  // --- Filters & Sorting ---
  function setupFilters() {
    const regions = [...new Set(DATA.corridors.map(c => c.tbuRegion))].sort();
    const currencies = [...new Set(DATA.corridors.map(c => c.sendCurrency))].sort();

    const fRegion = document.getElementById('filter-region');
    const fCurrency = document.getElementById('filter-currency');

    fRegion.innerHTML = '<option value="all">All Regions</option>' +
      regions.map(r => `<option value="${r}">${regionFlag(r)} ${r}</option>`).join('');
    fCurrency.innerHTML = '<option value="all">All Currencies</option>' +
      currencies.map(c => `<option value="${c}">${c}</option>`).join('');

    fRegion.addEventListener('change', () => { filterRegion = fRegion.value; renderCorridors(); });
    fCurrency.addEventListener('change', () => { filterSendCurrency = fCurrency.value; renderCorridors(); });

    document.getElementById('sort-by').addEventListener('change', e => {
      sortField = e.target.value;
      renderCorridors();
    });

    document.getElementById('sort-dir').addEventListener('click', e => {
      sortAsc = !sortAsc;
      e.target.classList.toggle('asc', sortAsc);
      renderCorridors();
    });
  }

  // --- Corridor Table ---
  function renderCorridors() {
    let corridors = DATA.corridors.slice();

    if (filterRegion !== 'all') corridors = corridors.filter(c => c.tbuRegion === filterRegion);
    if (filterSendCurrency !== 'all') corridors = corridors.filter(c => c.sendCurrency === filterSendCurrency);

    corridors.sort((a, b) => {
      const va = getNestedValue(a, sortField) || 0;
      const vb = getNestedValue(b, sortField) || 0;
      return sortAsc ? va - vb : vb - va;
    });

    const tbody = document.getElementById('corridor-tbody');
    tbody.innerHTML = corridors.map((c, i) => `
      <tr data-id="${c.id}" class="${c.tbuId === '(none)' ? 'row-broken' : ''}">
        <td class="rank-col">${i + 1}</td>
        <td>
          <div class="corridor-name">
            <span class="corridor-flag">${regionFlag(c.tbuRegion)}</span>
            <strong>${c.tbuRegion}</strong>
            <span class="corridor-currencies">${c.sendCurrency} &rarr; ${c.payoutCurrency}</span>
          </div>
        </td>
        <td class="num-col">${fmt(c.quoted)}</td>
        <td class="num-col">${fmt(c.completed)}</td>
        <td class="num-col">
          <div class="conversion-bar">
            <div class="conversion-bar-fill" style="width:${Math.min(c.conversion, 100) * 0.8}px;background:${conversionColor(c.conversion)}"></div>
            ${pct(c.conversion)}
          </div>
        </td>
        <td class="num-col" style="color:${medianTimeColor(c.medianTimeSeconds)}">${c.medianTimeFormatted}</td>
        <td class="num-col">
          <span class="${c.trend.wow > 0 ? 'trend-positive' : c.trend.wow < 0 ? 'trend-negative' : 'trend-neutral'}">
            ${c.trend.wow > 0 ? '+' : ''}${pct(c.trend.wow)}
          </span>
        </td>
        <td>${c.issues.length > 0
          ? `<span class="issue-badge">${c.issues.length}</span>`
          : '<span class="issue-badge issue-count-0"></span>'
        }</td>
      </tr>
    `).join('');

    // Row click -> detail
    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const id = tr.dataset.id;
        const c = DATA.corridors.find(x => x.id === id);
        if (c) showDetail(c);
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
      });
    });
  }

  // --- Detail Panel ---
  function showDetail(c) {
    const panel = document.getElementById('corridor-detail');
    const content = document.getElementById('detail-content');
    panel.classList.remove('hidden');

    content.innerHTML = `
      <div class="detail-title">${regionFlag(c.tbuRegion)} ${c.tbuRegion}: ${c.sendCurrency} &rarr; ${c.payoutCurrency}</div>

      <div class="detail-grid">
        <div class="detail-stat">
          <div class="detail-stat-label">Quoted Users</div>
          <div class="detail-stat-value">${fmt(c.quoted)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Completed Users</div>
          <div class="detail-stat-value">${fmt(c.completed)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Conversion</div>
          <div class="detail-stat-value" style="color:${conversionColor(c.conversion)}">${pct(c.conversion)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Median Time</div>
          <div class="detail-stat-value" style="color:${medianTimeColor(c.medianTimeSeconds)}">${c.medianTimeFormatted}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Demand (Quote Created)</div>
          <div class="detail-stat-value">${c.demand > 0 ? fmt(c.demand) : '-'}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Severity Score</div>
          <div class="detail-stat-value ${c.severity >= 40 ? 'stat-error' : c.severity >= 20 ? 'stat-warning' : ''}">${c.severity}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
        <div style="padding:12px;background:var(--color-bg-alt);border-radius:var(--radius)">
          <div style="font-weight:600;margin-bottom:4px">Week-over-Week</div>
          <div style="font-size:28px;font-weight:700;color:${c.trend.wow >= 0 ? 'var(--color-success)' : 'var(--color-error)'}">${c.trend.wow > 0 ? '+' : ''}${pct(c.trend.wow)}</div>
          <div style="font-size:12px;color:var(--color-text-secondary)">TBU ${c.tbuRegion} region trend</div>
        </div>
        <div style="padding:12px;background:var(--color-bg-alt);border-radius:var(--radius)">
          <div style="font-weight:600;margin-bottom:4px">Month-over-Month</div>
          <div style="font-size:28px;font-weight:700;color:${c.trend.mom >= 0 ? 'var(--color-success)' : 'var(--color-error)'}">${c.trend.mom > 0 ? '+' : ''}${pct(c.trend.mom)}</div>
          <div style="font-size:12px;color:var(--color-text-secondary)">TBU ${c.tbuRegion} region trend</div>
        </div>
      </div>

      ${c.medianTimeSeconds > 0 ? `
        <div style="margin-top:16px;padding:12px;background:${c.medianTimeSeconds > 86400 ? '#fef2f2' : '#f0fdf4'};border-radius:var(--radius);border-left:3px solid ${medianTimeColor(c.medianTimeSeconds)}">
          <strong>Settlement Speed:</strong> Median ${c.medianTimeFormatted} (avg ${formatTime(c.avgTimeSeconds)})
          ${c.medianTimeSeconds > 86400 ? ' &mdash; multi-day settlement, likely ACH/bank transfer dominant' : ''}
          ${c.medianTimeSeconds < 3600 ? ' &mdash; fast settlement, likely card/instant payment' : ''}
        </div>
      ` : ''}

      ${c.issues.length > 0 ? `
        <div class="detail-issues">
          <h3 style="margin-bottom:8px">Issues (${c.issues.length})</h3>
          ${c.issues.map(issue => `
            <div class="detail-issue-item">${issue}</div>
          `).join('')}
        </div>
      ` : ''}

      <div style="margin-top:16px;padding:12px;background:var(--color-bg-alt);border-radius:var(--radius);font-size:12px;color:var(--color-text-secondary)">
        <strong>Methodology:</strong> Funnel: Quote Confirmed &rarr; Transaction Completed (7-day window, same users, ordered). Consumer only. Transfer only. Grouped by TBU (gp:TBU user property) + sendCurrency + payoutCurrency.
      </div>
    `;

    document.querySelector('.close-detail').addEventListener('click', () => {
      panel.classList.add('hidden');
      document.querySelectorAll('#corridor-tbody tr').forEach(r => r.classList.remove('selected'));
    });

    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function formatTime(seconds) {
    if (seconds === 0) return 'N/A';
    if (seconds < 60) return seconds + 's';
    if (seconds < 3600) return Math.round(seconds / 60) + ' min';
    if (seconds < 86400) return (seconds / 3600).toFixed(1) + ' hrs';
    return (seconds / 86400).toFixed(1) + ' days';
  }

  // --- Region Summary ---
  function renderRegionSummary() {
    if (!DATA.regions) return;
    const container = document.getElementById('region-summary');
    if (!container) return;

    container.innerHTML = DATA.regions.map(r => `
      <div class="region-card">
        <div class="region-card-header">
          <span class="region-flag">${regionFlag(r.tbuRegion)}</span>
          <span class="region-name">${r.tbuRegion}</span>
        </div>
        <div class="region-stats">
          <div>
            <div class="region-stat-label">Completed</div>
            <div class="region-stat-value">${fmt(r.completed)}</div>
          </div>
          <div>
            <div class="region-stat-label">Conversion</div>
            <div class="region-stat-value" style="color:${conversionColor(r.conversion)}">${pct(r.conversion)}</div>
          </div>
          <div>
            <div class="region-stat-label">Median Time</div>
            <div class="region-stat-value" style="color:${medianTimeColor(r.medianTimeSeconds)}">${r.medianTimeFormatted}</div>
          </div>
          <div>
            <div class="region-stat-label">WoW</div>
            <div class="region-stat-value" style="color:${r.trend.wow >= 0 ? 'var(--color-success)' : 'var(--color-error)'}">${r.trend.wow > 0 ? '+' : ''}${pct(r.trend.wow)}</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // --- Mobile Web Health Check ---
  function renderMobileWebHealth() {
    const mw = DATA.mobileWebHealthCheck;
    if (!mw) {
      const mwSection = document.getElementById('view-mobile-web');
      if (mwSection) mwSection.innerHTML = '<div class="view-header"><h2>Mobile Web Health Check</h2><p>No data available</p></div>';
      return;
    }

    // Overview cards
    const ov = mw.overview;
    document.getElementById('mw-overview').innerHTML = [
      { label: 'MW Users (30d)', value: fmt(ov.totalUsers), note: 'Quote Accessed on mobile browser' },
      { label: 'MW Transactions', value: fmt(ov.totalTransactions), note: `${ov.shareOfAllTransactions} of all web transactions` },
      { label: 'MW Conversion', value: '28.7%', note: 'vs 44.7% desktop (-16pp)', cls: 'error' },
      { label: 'Share of Web Traffic', value: ov.shareOfWebTraffic, note: 'Of galileo-site sessions' },
      { label: 'Bounce Rate', value: ov.bounceRate, note: 'vs ~35% desktop web' },
      { label: 'Issues Found', value: mw.platformSpecificIssues.length, note: mw.platformSpecificIssues.filter(i => i.severity === 'critical').length + ' critical', cls: 'error' },
    ].map(c => `
      <div class="stat-card">
        <div class="stat-card-label">${c.label}</div>
        <div class="stat-card-value${c.cls ? ' stat-' + c.cls : ''}">${c.value}</div>
        ${c.note ? `<div class="stat-card-note">${c.note}</div>` : ''}
      </div>
    `).join('');

    // Funnel
    const f = mw.funnelPerformance.sendMoney;
    const sevColors = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#65a30d', ok: '#16a34a' };
    document.getElementById('mw-funnel').innerHTML = `
      <div class="section-title"><span class="section-icon">&#x1F4CA;</span> Send Money Funnel (Mobile Web vs Desktop Web)</div>
      <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:12px">${f.note}</p>
      <div class="funnel-legend">
        <div class="legend-item"><div class="legend-dot legend-mw"></div> Mobile Web</div>
        <div class="legend-item"><div class="legend-dot legend-web"></div> Desktop Web</div>
      </div>
      <div class="funnel-step" style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-secondary)">
        <div>Step</div><div>Comparison</div><div>MW Rate</div><div>Web Rate</div><div>Gap</div>
      </div>
      ${f.stepDropoffs.map(s => `
        <div class="funnel-step" style="border-left:3px solid ${sevColors[s.severity] || '#ccc'}">
          <div class="funnel-step-name">${s.from} &rarr; ${s.to}${s.usersLost ? ' <span style=\"font-size:10px;color:#dc2626\">(' + fmt(s.usersLost) + ' lost)</span>' : ''}</div>
          <div class="funnel-bar-container">
            <div class="funnel-bar-web" style="width:${s.webRate}"></div>
            <div class="funnel-bar-mobile-web" style="width:${s.rate}"></div>
          </div>
          <div class="funnel-rate">${s.rate}</div>
          <div class="funnel-web-rate">${s.webRate}</div>
          <div class="funnel-gap" style="color:${s.gap.startsWith('+') ? '#16a34a' : '#dc2626'}">${s.gap}</div>
        </div>
        ${s.diagnosis ? '<div style=\"font-size:11px;color:var(--color-text-secondary);padding:2px 0 8px 16px\">' + s.diagnosis + '</div>' : ''}
      `).join('')}
      <div style="margin-top:16px;padding:12px;background:#fff7ed;border-radius:var(--radius);border-left:3px solid var(--color-mobile-web)">
        <strong>Overall: Mobile Web ${f.overallConversion}</strong> vs Desktop Web ${f.desktopConversion} (${f.gap}) &mdash; significant gap across every step
      </div>

      <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
        <div style="padding:12px;background:var(--color-bg-alt);border-radius:var(--radius)">
          <div style="font-weight:600;margin-bottom:4px">Recipient Creation</div>
          <div style="font-size:28px;font-weight:700;color:var(--color-mobile-web)">${mw.funnelPerformance.recipientCreation.overallConversion}</div>
          <div style="font-size:12px;color:var(--color-text-secondary)">vs ${mw.funnelPerformance.recipientCreation.desktopConversion} desktop (${mw.funnelPerformance.recipientCreation.gap})</div>
          <div style="font-size:12px;margin-top:4px">${mw.funnelPerformance.recipientCreation.diagnosis.substring(0, 120)}...</div>
        </div>
        <div style="padding:12px;background:var(--color-bg-alt);border-radius:var(--radius)">
          <div style="font-weight:600;margin-bottom:4px">Card Payment</div>
          <div style="font-size:28px;font-weight:700;color:var(--color-mobile-web)">${mw.funnelPerformance.cardPayment.overallConversion}</div>
          <div style="font-size:12px;color:var(--color-text-secondary)">vs ${mw.funnelPerformance.cardPayment.desktopConversion} desktop (${mw.funnelPerformance.cardPayment.gap})</div>
          <div style="font-size:12px;margin-top:4px">${mw.funnelPerformance.cardPayment.diagnosis.substring(0, 120)}...</div>
        </div>
        <div style="padding:12px;background:var(--color-bg-alt);border-radius:var(--radius)">
          <div style="font-weight:600;margin-bottom:4px">Biometric (KYC)</div>
          <div style="font-size:28px;font-weight:700;color:var(--color-mobile-web)">${mw.funnelPerformance.biometricVerification.overallConversion}</div>
          <div style="font-size:12px;color:var(--color-text-secondary)">vs ${mw.funnelPerformance.biometricVerification.desktopConversion} desktop (${mw.funnelPerformance.biometricVerification.gap})</div>
          <div style="font-size:12px;margin-top:4px">${mw.funnelPerformance.biometricVerification.diagnosis.substring(0, 120)}...</div>
        </div>
      </div>

      <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div style="padding:12px;background:var(--color-bg-alt);border-radius:var(--radius)">
          <div style="font-weight:600;margin-bottom:4px">Login (Accessed &rarr; Started)</div>
          <div style="font-size:28px;font-weight:700;color:var(--color-mobile-web)">${mw.funnelPerformance.login.accessedToStarted}</div>
          <div style="font-size:12px;color:var(--color-text-secondary)">vs ${mw.funnelPerformance.login.desktopAccessedToStarted} desktop (${mw.funnelPerformance.login.gap})</div>
          <div style="font-size:12px;margin-top:4px">${mw.funnelPerformance.login.diagnosis.substring(0, 150)}...</div>
          ${mw.funnelPerformance.login.trackingIssue ? '<div style=\"margin-top:4px;font-size:11px;color:#dc2626;font-weight:600\">TRACKING ISSUE: ' + mw.funnelPerformance.login.trackingNote + '</div>' : ''}
        </div>
        <div style="padding:12px;background:var(--color-bg-alt);border-radius:var(--radius)">
          <div style="font-weight:600;margin-bottom:4px">Registration</div>
          <div style="font-size:28px;font-weight:700;color:#dc2626">${mw.funnelPerformance.registration.overallConversion}</div>
          <div style="font-size:12px;color:var(--color-text-secondary)">vs ${mw.funnelPerformance.registration.desktopConversion} desktop</div>
          <div style="font-size:12px;margin-top:4px">${mw.funnelPerformance.registration.diagnosis.substring(0, 150)}...</div>
        </div>
      </div>

      <div style="margin-top:16px;padding:12px;background:#fef2f2;border-radius:var(--radius);border-left:3px solid var(--color-error)">
        <strong>Error Recovery: ${mw.funnelPerformance.errorRecovery.recoveryRate}</strong> vs ${mw.funnelPerformance.errorRecovery.webRecoveryRate} desktop (${mw.funnelPerformance.errorRecovery.gap}) &mdash; ${mw.funnelPerformance.errorRecovery.diagnosis}
      </div>
    `;

    // Errors
    const ep = mw.errorProfile;
    document.getElementById('mw-errors').innerHTML = `
      <div class="section-title"><span class="section-icon">&#x26A0;</span> Error Profile (Mobile Web vs Desktop Web)</div>
      <div class="error-row" style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">
        <div>Error Event</div><div>MW Count</div><div>Desktop Count</div><div>MW Rate</div><div>Desktop Rate</div><div>Notes</div>
      </div>
      ${Object.entries(ep).map(([key, e]) => `
        <div class="error-row">
          <div class="error-name">${key.replace(/([A-Z])/g, ' $1').trim()}</div>
          <div>${fmt(e.mobileWeb)}</div>
          <div>${e.desktop === 'N/A' ? 'N/A' : fmt(e.desktop)}</div>
          <div class="error-highlight">${e.mobileWebRate || '-'}</div>
          <div>${e.desktopRate || '-'}</div>
          <div style="color:var(--color-text-secondary);font-size:12px">${e.note}${e.trackingIssue ? ' <span style=\"color:#dc2626;font-weight:600\">[TRACKING BUG]</span>' : ''}</div>
        </div>
      `).join('')}
    `;

    // Issues
    const categories = [...new Set(mw.platformSpecificIssues.map(i => i.category || 'other'))];
    document.getElementById('mw-issues').innerHTML = `
      <div class="section-title"><span class="section-icon">&#x1F6A8;</span> All Issues (${mw.platformSpecificIssues.length} found: ${mw.platformSpecificIssues.filter(i=>i.severity==='critical').length} critical, ${mw.platformSpecificIssues.filter(i=>i.severity==='high').length} high, ${mw.platformSpecificIssues.filter(i=>i.severity==='medium').length} medium, ${mw.platformSpecificIssues.filter(i=>i.severity==='low').length} low)</div>
      <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="filter-btn active" data-cat="all" onclick="this.parentElement.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');document.querySelectorAll('.issue-card').forEach(c=>c.style.display='')">All (${mw.platformSpecificIssues.length})</button>
        ${categories.map(cat => `<button class="filter-btn" data-cat="${cat}" onclick="this.parentElement.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');document.querySelectorAll('.issue-card').forEach(c=>{c.style.display=c.dataset.cat==='${cat}'?'':'none'})">${cat} (${mw.platformSpecificIssues.filter(i=>i.category===cat).length})</button>`).join('')}
      </div>
      ${mw.platformSpecificIssues.map(issue => `
        <div class="issue-card ${issue.severity}" data-cat="${issue.category || 'other'}">
          <div class="issue-card-header">
            <span class="issue-severity ${issue.severity}">${issue.severity.toUpperCase()}</span>
            <span style="font-size:11px;color:var(--color-text-secondary);margin-left:4px">${issue.id || ''}</span>
            <span class="issue-card-title">${issue.title}</span>
          </div>
          <div class="issue-card-desc">${issue.description}</div>
          <div class="issue-card-meta">
            ${issue.impact ? `<span class="issue-impact">${issue.impact}</span>` : ''}
            ${issue.codeRef ? `<span class="issue-code">${issue.codeRef}</span>` : ''}
            ${issue.category ? `<span style="font-size:11px;padding:2px 6px;border-radius:3px;background:#e0e7ff;color:#3730a3">${issue.category}</span>` : ''}
          </div>
          ${issue.amplitudeData ? `<div style="margin-top:6px;font-size:11px;color:var(--color-text-secondary)">Amplitude: ${Object.entries(issue.amplitudeData).map(([k,v]) => k + '=' + v).join(', ')}</div>` : ''}
          ${issue.recommendation ? `<div style="margin-top:8px;font-size:12px;color:var(--color-success)"><strong>Fix:</strong> ${issue.recommendation}</div>` : ''}
        </div>
      `).join('')}
    `;

    // Country breakdown
    const bc = mw.byCountry;
    if (bc) {
      const countryHtml = `
        <div class="section-title"><span class="section-icon">&#x1F30D;</span> Mobile Web by Sender Country</div>
        <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:12px">${bc.note}</p>
        <div class="mw-corridor-row" style="font-weight:600;font-size:11px;text-transform:uppercase">
          <div>Country</div><div>MW Users</div><div>MW Conv.</div><div>Transactions</div><div>Conversion Bar</div><div>Issue</div>
        </div>
        ${bc.countries.map(c => `
          <div class="mw-corridor-row">
            <div style="font-weight:600">${c.country}</div>
            <div>${fmt(c.mwUsers)}</div>
            <div style="color:${c.mwConversion < 25 ? '#dc2626' : c.mwConversion < 35 ? '#ea580c' : '#16a34a'};font-weight:600">${c.mwConversion}%</div>
            <div>${fmt(c.transactions)}</div>
            <div><div class="mw-share-bar"><div class="mw-share-fill" style="width:${c.mwConversion}%;background:${c.mwConversion < 25 ? '#dc2626' : c.mwConversion < 35 ? '#ea580c' : '#16a34a'}"></div></div></div>
            <div style="font-size:11px;color:var(--color-text-secondary)">${c.issue || ''}</div>
          </div>
        `).join('')}
      `;
      document.getElementById('mw-corridors').innerHTML = countryHtml;
    }

    // Recommendations
    document.getElementById('mw-recommendations').innerHTML = `
      <div class="section-title"><span class="section-icon">&#x2705;</span> Prioritized Recommendations (${mw.recommendations.length})</div>
      ${mw.recommendations.map(r => `
        <div class="rec-card">
          <div class="rec-priority">${r.priority}</div>
          <div>
            <div class="rec-action">${r.action}</div>
            <div style="font-size:12px;color:var(--color-text-muted)">${r.team} team</div>
          </div>
          <div class="rec-impact">${r.expectedImpact}</div>
          <div class="rec-effort">${r.effort}</div>
        </div>
      `).join('')}
    `;
  }

  // --- Worst Performers ---
  function renderWorstPerformers() {
    const scored = DATA.corridors
      .filter(c => c.tbuId !== '(none)')
      .filter(c => c.severity > 0)
      .sort((a, b) => b.severity - a.severity);

    document.getElementById('worst-list').innerHTML = scored.map((c, i) => {
      const scoreClass = c.severity >= 40 ? 'score-critical' : c.severity >= 25 ? 'score-high' : 'score-medium';

      return `
        <div class="worst-card">
          <div class="worst-card-header">
            <div class="worst-card-title">${i + 1}. ${regionFlag(c.tbuRegion)} ${c.tbuRegion}: ${c.sendCurrency} &rarr; ${c.payoutCurrency}</div>
            <div class="worst-score ${scoreClass}">Severity: ${c.severity}</div>
          </div>
          <div class="worst-card-stats">
            <div>
              <div class="worst-stat-label">Conversion</div>
              <div class="worst-stat-value" style="color:${conversionColor(c.conversion)}">${pct(c.conversion)}</div>
            </div>
            <div>
              <div class="worst-stat-label">Quoted</div>
              <div class="worst-stat-value">${fmt(c.quoted)}</div>
            </div>
            <div>
              <div class="worst-stat-label">Completed</div>
              <div class="worst-stat-value">${fmt(c.completed)}</div>
            </div>
            <div>
              <div class="worst-stat-label">Median Time</div>
              <div class="worst-stat-value" style="color:${medianTimeColor(c.medianTimeSeconds)}">${c.medianTimeFormatted}</div>
            </div>
            <div>
              <div class="worst-stat-label">WoW Trend</div>
              <div class="worst-stat-value" style="color:${c.trend.wow < 0 ? 'var(--color-error)' : 'var(--color-success)'}">${c.trend.wow > 0 ? '+' : ''}${pct(c.trend.wow)}</div>
            </div>
          </div>
          ${c.issues.length > 0 ? `
            <div class="worst-card-issues">
              <strong>Issues:</strong>
              <ul>${c.issues.map(issue => `<li>${issue}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // --- Boot ---
  document.addEventListener('DOMContentLoaded', init);
})();

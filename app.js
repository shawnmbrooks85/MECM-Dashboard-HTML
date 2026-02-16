/* ============================================================
   MECM Master Health Dashboard — Application Logic
   Cockpit Theme Edition
   ============================================================ */

(async function () {
  'use strict';

  // ─── Chart.js Defaults — cockpit style ─────────────────────
  Chart.defaults.color = 'rgba(255,255,255,0.40)';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  Chart.defaults.font.family = "'JetBrains Mono', 'Consolas', monospace";
  Chart.defaults.font.size = 10;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.padding = 10;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(11,14,17,0.95)';
  Chart.defaults.plugins.tooltip.titleFont = { weight: '600', family: "'JetBrains Mono', monospace" };
  Chart.defaults.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace" };
  Chart.defaults.plugins.tooltip.padding = 8;
  Chart.defaults.plugins.tooltip.cornerRadius = 4;
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.10)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;

  const COLORS = {
    green: '#00e676',
    amber: '#ffab40',
    red: '#ff5252',
    cyan: '#00e5ff',
    blue: '#448aff',
    purple: '#b388ff',
    pink: '#ff80ab',
    emerald: '#00e676',
    yellow: '#ffab40',
    rose: '#ff5252',
  };
  const CHART_PALETTE = [COLORS.blue, COLORS.purple, COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.red, COLORS.pink];

  // Gradient fill helpers
  function makeGradient(ctx, color, alpha = 0.15) {
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
    gradient.addColorStop(1, color + '00');
    return gradient;
  }

  // ─── Load Data ────────────────────────────────────────────
  let DATA;
  try {
    const res = await fetch('data/mock_data.json');
    DATA = await res.json();
  } catch (e) {
    document.body.innerHTML = '<div style="padding:40px;color:#ff5252;font-family:monospace;">Failed to load data. Make sure <code>data/mock_data.json</code> exists.</div>';
    return;
  }

  // ─── Helpers ──────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const fmt = (n) => (n != null ? n.toLocaleString() : '0');
  const pct = (n) => (n != null ? n.toFixed(1) + '%' : '0.0%');
  const noData = (msg = 'No data available') => `<div style="padding:24px;text-align:center;color:var(--text-dim,rgba(255,255,255,0.25));font-size:0.8rem;letter-spacing:1px;">${msg}</div>`;

  function ragClass(val, thresholds = [90, 75]) {
    if (val >= thresholds[0]) return 'rag-green';
    if (val >= thresholds[1]) return 'rag-amber';
    return 'rag-red';
  }

  function ragColor(val, thresholds = [90, 75]) {
    if (val >= thresholds[0]) return COLORS.green;
    if (val >= thresholds[1]) return COLORS.amber;
    return COLORS.red;
  }

  function progressBar(label, value, max, colorClass = 'progress-green') {
    const p = max > 0 ? (value / max * 100).toFixed(1) : '0.0';
    return `
      <div class="progress-bar-container ${colorClass}">
        <div class="progress-bar-label">
          <span class="progress-bar-label-text">${label}</span>
          <span class="progress-bar-label-value">${fmt(value)} / ${fmt(max)} (${p}%)</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width:${p}%"></div>
        </div>
      </div>`;
  }

  function statRow(label, value, extra = '') {
    return `<div class="stat-row">
      <span class="stat-row-label">${label}</span>
      <span class="stat-row-value">${value} ${extra}</span>
    </div>`;
  }

  // ─── Header ───────────────────────────────────────────────
  const dt = new Date(DATA.lastRefresh);
  $('#lastRefresh').textContent = dt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  // ─── Overall Health Ring ──────────────────────────────────
  const overallScore = DATA.securityOverview.overallHealthScore;
  const circumference = 2 * Math.PI * 56;
  const offset = circumference - (overallScore / 100) * circumference;
  const ringEl = $('#overallRingFill');
  ringEl.style.stroke = ragColor(overallScore, [85, 65]);
  requestAnimationFrame(() => { ringEl.style.strokeDashoffset = offset; });
  $('#overallScore').textContent = overallScore;
  $('#overallScore').style.color = ragColor(overallScore, [85, 65]);
  $('#overallScore').style.textShadow = `0 0 20px ${ragColor(overallScore, [85, 65])}55`;

  const riskMap = { low: 'pill-green', medium: 'pill-amber', high: 'pill-red', critical: 'pill-red' };
  const riskPill = $('#overallRiskPill');
  riskPill.className = `pill ${riskMap[DATA.securityOverview.riskLevel] || 'pill-amber'}`;
  riskPill.textContent = DATA.securityOverview.riskLevel.toUpperCase() + ' RISK';

  // ─── Health Score Cards ───────────────────────────────────
  const domains = [
    { key: 'clients', label: 'Client Health', icon: '💻', value: DATA.clientHealth.clientHealthPercent, detail: `${fmt(DATA.clientHealth.healthyClients)} / ${fmt(DATA.clientHealth.totalDevices)} healthy`, trend: '+2.1%', trendDir: 'up' },
    { key: 'content', label: 'Content Dist.', icon: '📦', value: (() => { const d = DATA.contentDistribution; return d.totalPackages > 0 ? +(d.distributedSuccess / d.totalPackages * 100).toFixed(1) : 0; })(), detail: `${DATA.contentDistribution.healthyDPs}/${DATA.contentDistribution.totalDPs} DPs healthy`, trend: '+0.4%', trendDir: 'up' },
    { key: 'compliance', label: 'Patch Compliance', icon: '🔒', value: DATA.softwareUpdateCompliance.compliancePercent, detail: `${fmt(DATA.softwareUpdateCompliance.compliantDevices)} / ${fmt(DATA.softwareUpdateCompliance.totalManagedDevices)}`, trend: '+4.6%', trendDir: 'up' },
    { key: 'deployments', label: 'Deployments', icon: '🚀', value: DATA.softwareUpdateDeployment.deploymentSuccessRate, detail: `${DATA.softwareUpdateDeployment.activeDeployments} active`, trend: '-1.2%', trendDir: 'down' },
    { key: 'edge', label: 'Edge Mgmt', icon: '🌐', value: 100 - DATA.edgeManagement.vulnerablePercent, detail: `${fmt(DATA.edgeManagement.vulnerableEdgeClients)} vulnerable`, trend: '+3.0%', trendDir: 'up' },
  ];

  const scoreCardsHtml = domains.map((d, i) => {
    const rag = ragClass(d.value);
    return `
      <div class="glass-card score-card ${rag} fade-in fade-in-delay-${i + 1}" onclick="document.getElementById('section-${d.key}').scrollIntoView({behavior:'smooth'})">
        <div class="score-label"><span class="icon">${d.icon}</span> ${d.label}</div>
        <div class="score-value">${pct(d.value)}</div>
        <div class="score-detail">${d.detail}</div>
        <span class="score-trend trend-${d.trendDir}">${d.trendDir === 'up' ? '▲' : '▼'} ${d.trend}</span>
      </div>`;
  }).join('');
  $('#healthScoreCards').innerHTML = scoreCardsHtml;

  // ─── Security Alerts ──────────────────────────────────────
  const alertsHtml = DATA.securityOverview.criticalFindings.map(f => `
    <div class="alert-item">
      <span class="alert-severity ${f.severity}">${f.severity}</span>
      <span class="alert-text">${f.finding}</span>
      <span class="alert-domain">${f.domain}</span>
    </div>`).join('');
  $('#alertList').innerHTML = alertsHtml;

  // ─── CLIENT HEALTH ────────────────────────────────────────
  const ch = DATA.clientHealth;
  const healthClass = ragClass(ch.clientHealthPercent).replace('rag-', 'progress-');
  $('#clientDeviceSummary').innerHTML = `
    <div class="big-number" style="margin-bottom:12px;color:${ragColor(ch.clientHealthPercent)};text-shadow:0 0 20px ${ragColor(ch.clientHealthPercent)}44;">${pct(ch.clientHealthPercent)}</div>
    ${progressBar('Healthy Clients', ch.healthyClients, ch.totalDevices, healthClass)}
    ${progressBar('Active Clients', ch.activeClients, ch.totalDevices, 'progress-blue')}
    ${statRow('Inactive (>30d)', fmt(ch.inactiveClients), '<span class="pill pill-amber">⚠</span>')}
    ${statRow('Remediations', `${ch.remediationSuccess}/${ch.remediationTotal} succeeded`)}
  `;

  const ca = ch.activityBreakdown;
  $('#clientActivity').innerHTML = `
    ${statRow('Last 24 hours', fmt(ca.last24h))}
    ${statRow('Last 48 hours', fmt(ca.last48h))}
    ${statRow('Last 7 days', fmt(ca.last7d))}
    ${statRow('Stale (>30 days)', fmt(ca.over30d), '<span class="pill pill-red">!</span>')}
  `;

  // Health trend chart
  if (ch.healthTrend && ch.healthTrend.length > 0) {
    const trendCtx = $('#chartClientTrend').getContext('2d');
    new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: ch.healthTrend.map(t => t.date.slice(5)),
        datasets: [{
          label: 'Health %',
          data: ch.healthTrend.map(t => t.percent),
          borderColor: COLORS.cyan,
          backgroundColor: makeGradient(trendCtx, COLORS.cyan, 0.12),
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointBackgroundColor: COLORS.cyan,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: COLORS.cyan,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 1,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 85, max: 95, ticks: { callback: v => v + '%' } },
          x: { grid: { display: false } }
        }
      }
    });
  } else {
    $('#chartClientTrend').parentElement.innerHTML = noData('No trend data');
  }

  // OS distribution chart
  if (ch.osBuildDistribution && ch.osBuildDistribution.length > 0) {
    new Chart($('#chartOsDist'), {
      type: 'doughnut',
      data: {
        labels: ch.osBuildDistribution.map(o => o.os),
        datasets: [{
          data: ch.osBuildDistribution.map(o => o.count),
          backgroundColor: CHART_PALETTE,
          borderWidth: 0,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { position: 'right', labels: { font: { size: 9 } } } }
      }
    });
  } else {
    $('#chartOsDist').parentElement.innerHTML = noData('No OS data');
  }

  // Top issues table
  if (ch.topIssues && ch.topIssues.length > 0) {
    const issueRows = ch.topIssues.map(i => {
      const sevClass = { critical: 'pill-red', high: 'pill-amber', medium: 'pill-blue' }[i.severity] || 'pill-blue';
      return `<tr>
        <td><span class="pill ${sevClass}">${i.severity}</span></td>
        <td>${i.issue}</td>
        <td style="text-align:right;font-weight:600;">${i.count}</td>
      </tr>`;
    }).join('');
    $('#clientTopIssues').innerHTML = `
      <table class="data-table">
        <thead><tr><th>Severity</th><th>Issue</th><th>Devices</th></tr></thead>
        <tbody>${issueRows}</tbody>
      </table>`;
  } else {
    $('#clientTopIssues').innerHTML = noData('No issues detected');
  }

  // ─── CONTENT DISTRIBUTION ─────────────────────────────────
  const cd = DATA.contentDistribution;
  const dpHealthPct = cd.totalDPs > 0 ? (cd.healthyDPs / cd.totalDPs * 100) : 0;
  $('#dpSummary').innerHTML = `
    <div class="big-number" style="margin-bottom:12px;color:${ragColor(dpHealthPct)};text-shadow:0 0 20px ${ragColor(dpHealthPct)}44;">${cd.healthyDPs}<span class="big-number-unit">/ ${cd.totalDPs} DPs</span></div>
    ${statRow('Healthy', cd.healthyDPs, '<span class="pill pill-green">●</span>')}
    ${statRow('Warning', cd.warningDPs, '<span class="pill pill-amber">●</span>')}
    ${statRow('Error', cd.errorDPs, '<span class="pill pill-red">●</span>')}
    <div style="margin-top:12px;">
      ${statRow('Total Packages', fmt(cd.totalPackages))}
      ${statRow('Content Size', fmt(cd.totalContentSizeGB) + ' GB')}
      ${statRow('Failed Distributions', cd.distributedFailed, '<span class="pill pill-red">!</span>')}
    </div>
  `;

  // Content type chart
  if (cd.contentTypeBreakdown && cd.contentTypeBreakdown.length > 0) {
    new Chart($('#chartContentType'), {
      type: 'bar',
      data: {
        labels: cd.contentTypeBreakdown.map(ct => ct.type),
        datasets: [{
          label: 'Packages',
          data: cd.contentTypeBreakdown.map(ct => ct.count),
          backgroundColor: CHART_PALETTE.map(c => c + '44'),
          borderColor: CHART_PALETTE,
          borderWidth: 1,
          borderRadius: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true },
          x: { grid: { display: false }, ticks: { font: { size: 9 } } }
        }
      }
    });
  } else {
    $('#chartContentType').parentElement.innerHTML = noData('No content data');
  }

  // Distribution trend
  if (cd.distributionTrend && cd.distributionTrend.length > 0) {
    const distCtx = $('#chartDistTrend').getContext('2d');
    new Chart(distCtx, {
      type: 'line',
      data: {
        labels: cd.distributionTrend.map(t => t.date.slice(5)),
        datasets: [
          { label: 'Success', data: cd.distributionTrend.map(t => t.success), borderColor: COLORS.green, backgroundColor: makeGradient(distCtx, COLORS.green, 0.08), fill: true, tension: 0.4, pointRadius: 1, borderWidth: 2 },
          { label: 'Failed', data: cd.distributionTrend.map(t => t.failed), borderColor: COLORS.red, tension: 0.4, pointRadius: 1, borderWidth: 2 },
          { label: 'In Progress', data: cd.distributionTrend.map(t => t.inProgress), borderColor: COLORS.amber, tension: 0.4, pointRadius: 1, borderDash: [4, 3], borderWidth: 1.5 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { grid: { display: false } } }
      }
    });
  } else {
    $('#chartDistTrend').parentElement.innerHTML = noData('No trend data');
  }

  // DP group table
  if (cd.dpGroups && cd.dpGroups.length > 0) {
    const dpGroupRows = cd.dpGroups.map(g => {
      const pClass = ragClass(g.compliance).replace('rag-', 'progress-');
      return `<div style="margin-bottom:6px;">
        ${progressBar(g.name + ` (${g.members} DPs)`, Math.round(g.compliance * g.packages / 100), g.packages, pClass)}
      </div>`;
    }).join('');
    $('#dpGroupTable').innerHTML = dpGroupRows;
  } else {
    $('#dpGroupTable').innerHTML = noData('No DP group data');
  }

  // Failed packages
  if (cd.failedPackages && cd.failedPackages.length > 0) {
    const failedHtml = cd.failedPackages.map(fp => `
      <div class="deployment-item">
        <div class="deployment-header">
          <span class="deployment-name">${fp.name}</span>
          <span class="pill pill-red">${fp.failedDPs} DP${fp.failedDPs > 1 ? 's' : ''}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
          <span style="color:var(--text-dim);">${fp.packageId}</span> · ${fp.type}
        </div>
        <div style="font-size:0.75rem;color:var(--red);margin-top:4px;">${fp.error}</div>
      </div>
    `).join('');
    $('#failedPackages').innerHTML = failedHtml;
  } else {
    $('#failedPackages').innerHTML = noData('No failed packages — all clear');
  }

  // ─── SOFTWARE UPDATE COMPLIANCE ───────────────────────────
  const sc = DATA.softwareUpdateCompliance;
  const compClass = ragClass(sc.compliancePercent, [90, 75]).replace('rag-', 'progress-');
  $('#complianceOverview').innerHTML = `
    <div class="big-number" style="margin-bottom:12px;color:${ragColor(sc.compliancePercent, [90, 75])};text-shadow:0 0 20px ${ragColor(sc.compliancePercent, [90, 75])}44;">${pct(sc.compliancePercent)}</div>
    ${progressBar('Compliant Devices', sc.compliantDevices, sc.totalManagedDevices, compClass)}
    ${progressBar('Scan Coverage', Math.round(sc.scanCoverage * sc.totalManagedDevices / 100), sc.totalManagedDevices, 'progress-blue')}
    ${statRow('Not Scanned (>7d)', fmt(sc.lastScanDistribution.over7d), '<span class="pill pill-red">!</span>')}
  `;

  // Missing by severity chart
  const sevData = sc.missingUpdatesBySeverity || {};
  const sevTotal = (sevData.critical || 0) + (sevData.important || 0) + (sevData.moderate || 0) + (sevData.low || 0) + (sevData.unrated || 0);
  if (sevTotal > 0) {
    new Chart($('#chartMissingSeverity'), {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'Important', 'Moderate', 'Low', 'Unrated'],
        datasets: [{
          data: [sevData.critical, sevData.important, sevData.moderate, sevData.low, sevData.unrated],
          backgroundColor: [COLORS.red, COLORS.pink, COLORS.amber, COLORS.green, 'rgba(255,255,255,0.15)'],
          borderWidth: 0,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: { legend: { position: 'right', labels: { font: { size: 9 } } } }
      }
    });
  } else {
    $('#chartMissingSeverity').parentElement.innerHTML = noData('No severity data');
  }

  // Compliance trend
  if (sc.complianceTrend && sc.complianceTrend.length > 0) {
    const compCtx = $('#chartComplianceTrend').getContext('2d');
    new Chart(compCtx, {
      type: 'line',
      data: {
        labels: sc.complianceTrend.map(t => t.date.slice(5)),
        datasets: [{
          label: 'Compliance %',
          data: sc.complianceTrend.map(t => t.percent),
          borderColor: COLORS.green,
          backgroundColor: makeGradient(compCtx, COLORS.green, 0.10),
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointBackgroundColor: COLORS.green,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 60, max: 80, ticks: { callback: v => v + '%' } },
          x: { grid: { display: false } }
        }
      }
    });
  } else {
    $('#chartComplianceTrend').parentElement.innerHTML = noData('No trend data');
  }

  // Top missing updates
  if (sc.topMissingUpdates && sc.topMissingUpdates.length > 0) {
    const missingRows = sc.topMissingUpdates.map(u => {
      const sev = u.severity.toLowerCase();
      const cls = { critical: 'pill-red', important: 'pill-amber' }[sev] || 'pill-blue';
      return `<tr>
        <td><span class="pill ${cls}">${u.severity}</span></td>
        <td style="max-width:400px;">${u.title}</td>
        <td style="text-align:right;font-weight:600;">${fmt(u.missing)}</td>
        <td style="color:var(--text-dim);">${u.released}</td>
      </tr>`;
    }).join('');
    $('#topMissingUpdates').innerHTML = `
      <table class="data-table">
        <thead><tr><th>Sev</th><th>Update</th><th>Missing</th><th>Released</th></tr></thead>
        <tbody>${missingRows}</tbody>
      </table>`;
  } else {
    $('#topMissingUpdates').innerHTML = noData('No missing update data');
  }

  // Compliance by collection
  if (sc.complianceByCollection && sc.complianceByCollection.length > 0) {
    const collHtml = sc.complianceByCollection.map(col => {
      const pClass = ragClass(col.percent, [90, 75]).replace('rag-', 'progress-');
      return progressBar(col.collection, col.compliant, col.total, pClass);
    }).join('');
    $('#complianceByCollection').innerHTML = collHtml;
  } else {
    $('#complianceByCollection').innerHTML = noData('No collection data');
  }

  // ─── SOFTWARE UPDATE DEPLOYMENTS ──────────────────────────
  const sd = DATA.softwareUpdateDeployment;
  $('#pendingRestartsBadge').textContent = `⏳ ${fmt(sd.pendingRestarts)} pending restarts`;

  if (sd.deployments && sd.deployments.length > 0) {
    const deployHtml = sd.deployments.map(dep => {
      const total = dep.total || 1;
      const pctInstalled = (dep.installed / total * 100).toFixed(1);
      const statusPill = dep.status === 'warning'
        ? '<span class="pill pill-amber">⚠ PAST DUE</span>'
        : '<span class="pill pill-green">ACTIVE</span>';
      return `
        <div class="deployment-item">
          <div class="deployment-header">
            <div>
              <div class="deployment-name">${dep.name}</div>
              <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;letter-spacing:0.5px;">${dep.collection}</div>
            </div>
            <div style="text-align:right;">
              ${statusPill}
              <div class="deployment-deadline">DUE: ${dep.deadline}</div>
            </div>
          </div>
          <div class="segmented-bar" style="margin:8px 0;">
            <div class="segment segment-green" style="width:${(dep.installed / total * 100)}%" title="Installed: ${dep.installed}"></div>
            <div class="segment segment-blue" style="width:${(dep.downloading / total * 100)}%" title="Downloading: ${dep.downloading}"></div>
            <div class="segment segment-amber" style="width:${((dep.waiting + dep.pendingRestart) / total * 100)}%" title="Waiting/Restart: ${dep.waiting + dep.pendingRestart}"></div>
            <div class="segment segment-red" style="width:${(dep.failed / total * 100)}%" title="Failed: ${dep.failed}"></div>
          </div>
          <div class="deployment-stats">
            <span class="deployment-stat"><span class="dot dot-green"></span> ${fmt(dep.installed)} installed (${pctInstalled}%)</span>
            <span class="deployment-stat"><span class="dot dot-blue"></span> ${dep.downloading} downloading</span>
            <span class="deployment-stat"><span class="dot dot-amber"></span> ${dep.waiting + dep.pendingRestart} waiting/restart</span>
            <span class="deployment-stat"><span class="dot dot-red"></span> ${dep.failed} failed</span>
          </div>
        </div>`;
    }).join('');
    $('#deploymentList').innerHTML = deployHtml;
  } else {
    $('#deploymentList').innerHTML = noData('No active deployments');
  }

  // Error codes
  if (sd.errorCodeBreakdown && sd.errorCodeBreakdown.length > 0) {
    const errHtml = sd.errorCodeBreakdown.map(e => `
      <div class="deployment-item" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="color:var(--red);font-weight:600;letter-spacing:0.5px;">${e.code}</span>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">${e.description}</div>
        </div>
        <span style="font-weight:700;color:var(--text-primary);font-size:0.85rem;">${e.count}</span>
      </div>`).join('');
    $('#errorCodes').innerHTML = errHtml;
  } else {
    $('#errorCodes').innerHTML = noData('No error data');
  }

  // ─── EDGE MANAGEMENT ─────────────────────────────────────
  const em = DATA.edgeManagement;
  const edgeSafePercent = 100 - (em.vulnerablePercent || 0);
  const bu = em.browserUsageLast30d || {};
  $('#edgeOverview').innerHTML = `
    <div class="big-number" style="margin-bottom:12px;color:${ragColor(em.edgePenetration || 0)};text-shadow:0 0 20px ${ragColor(em.edgePenetration || 0)}44;">${pct(em.edgePenetration || 0)}</div>
    ${progressBar('Edge Installed', em.totalEdgeInstalled || 0, em.totalDevicesWithBrowser || 1, 'progress-green')}
    ${statRow('Vulnerable Clients', fmt(em.vulnerableEdgeClients || 0), '<span class="pill pill-red">!</span>')}
    ${statRow('Secure (Current/Recent)', pct(edgeSafePercent))}
    <div style="margin-top:12px;">
      <div class="stat-card-title" style="margin-bottom:8px;">BROWSER USAGE (30D)</div>
      ${statRow('Edge', pct(bu.edge || 0))}
      ${statRow('Chrome', pct(bu.chrome || 0))}
      ${statRow('Firefox', pct(bu.firefox || 0))}
      ${statRow('Other', pct(bu.other || 0))}
    </div>
  `;

  // Edge version distribution chart
  if (em.edgeVersionDistribution && em.edgeVersionDistribution.length > 0) {
    new Chart($('#chartEdgeVersions'), {
      type: 'bar',
      data: {
        labels: em.edgeVersionDistribution.map(v => v.version.length > 18 ? v.version.slice(0, 18) + '…' : v.version),
        datasets: [{
          label: 'Devices',
          data: em.edgeVersionDistribution.map(v => v.count),
          backgroundColor: em.edgeVersionDistribution.map(v => {
            if (v.status === 'current') return COLORS.green + '66';
            if (v.status === 'recent') return COLORS.blue + '66';
            if (v.status === 'outdated') return COLORS.amber + '66';
            return COLORS.red + '66';
          }),
          borderColor: em.edgeVersionDistribution.map(v => {
            if (v.status === 'current') return COLORS.green;
            if (v.status === 'recent') return COLORS.blue;
            if (v.status === 'outdated') return COLORS.amber;
            return COLORS.red;
          }),
          borderWidth: 1,
          borderRadius: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true },
          y: { grid: { display: false }, ticks: { font: { size: 9 } } }
        }
      }
    });
  } else {
    $('#chartEdgeVersions').parentElement.innerHTML = noData('No Edge version data');
  }

  // Default browser chart
  const dbs = em.defaultBrowserStats || {};
  const dbsTotal = (dbs.edge || 0) + (dbs.chrome || 0) + (dbs.firefox || 0) + (dbs.other || 0);
  if (dbsTotal > 0) {
    new Chart($('#chartDefaultBrowser'), {
      type: 'doughnut',
      data: {
        labels: ['Edge', 'Chrome', 'Firefox', 'Other'],
        datasets: [{
          data: [dbs.edge, dbs.chrome, dbs.firefox, dbs.other],
          backgroundColor: [COLORS.blue, COLORS.amber, COLORS.red, 'rgba(255,255,255,0.12)'],
          borderWidth: 0,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { font: { size: 9 } } } }
      }
    });
  } else {
    $('#chartDefaultBrowser').parentElement.innerHTML = noData('No browser data');
  }

})();

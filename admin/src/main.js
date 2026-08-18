import { adminRouteHash, parseAdminRoute } from './router.mjs';

async function request(path, options = {}) {
  const response = await fetch(`/api/admin${path}`, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.message || 'Permintaan gagal.'), { status: response.status });
  return body;
}

function showAuthenticated(user) {
  document.querySelector('#authView').classList.add('hidden');
  document.querySelector('#appView').classList.remove('hidden');
  document.querySelectorAll('[data-admin-name]').forEach(el => { el.textContent = user.name; });
  const initials = user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  document.querySelectorAll('[data-admin-initial]').forEach(el => { el.textContent = initials; });
}

async function requireAdmin() {
  const controller = new AbortController();
  let resolveLogin;
  const loginPromise = new Promise(resolve => { resolveLogin = resolve; });
  document.querySelector('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#loginButton');
    const errorEl = document.querySelector('#loginError');
    button.disabled = true;
    button.querySelector('span').textContent = 'Memverifikasi...';
    errorEl.textContent = '';
    try {
      const result = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: document.querySelector('#adminUsername').value,
          password: document.querySelector('#adminPassword').value,
        }),
      });
      document.querySelector('#adminPassword').value = '';
      showAuthenticated(result.user);
      resolveLogin(result.user);
    } catch (error) {
      errorEl.textContent = error.message;
    } finally {
      button.disabled = false;
      button.querySelector('span').textContent = 'Masuk ke dashboard';
    }
  }, { signal: controller.signal });

  try {
    const session = await request('/session');
    controller.abort();
    showAuthenticated(session.user);
    return session.user;
  } catch (error) {
    if (error.status !== 401) document.querySelector('#loginError').textContent = error.message;
  }

  const user = await loginPromise;
  controller.abort();
  return user;
}

await requireAdmin();
let overviewState = null;
let overviewLoading = null;

const icons = {
  grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  swap: '<path d="m7 7-4 4 4 4M3 11h14M17 17l4-4-4-4M21 13H7"/>', chart: '<path d="M3 3v18h18M7 16v-5M12 16V7M17 16v-2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9 1.65 1.65 0 0 0 4.27 7.2l-.06-.06 2.83-2.83.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V2h4v.49A1.65 1.65 0 0 0 15 4a1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9c.12.61.66 1.04 1.28 1.04H21v4h-.32c-.62 0-1.16.43-1.28 1Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>', chevron: '<path d="m9 18 6-6-6-6"/>', download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', refresh: '<path d="M20 6v5h-5M4 18v-5h5M6.1 9a7 7 0 0 1 11.5-2.6L20 11M4 13l2.4 4.6A7 7 0 0 0 17.9 15"/>',
  pulse: '<path d="M3 12h4l2-7 4 14 2-7h6"/>', receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3ZM8 8h8M8 12h6"/>', wallet: '<path d="M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13M16 12h5"/>', spark: '<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3ZM5 16l.7 2.3L8 19l-2.3.7L5 22l-.7-2.3L2 19l2.3-.7L5 16Z"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  food: '<path d="M7 3v8M4 3v5c0 2 6 2 6 0V3M7 11v10M16 3c-3 4-3 8 1 9v9M17 3v9"/>', car: '<path d="m5 17-2-2 2-7h14l2 7-2 2H5ZM7 17v3M17 17v3M7 13h.01M17 13h.01"/>', bag: '<path d="M5 8h14l-1 13H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2"/>', bolt: '<path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>', userPlus: '<path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/>', alert: '<path d="M12 3 2 20h20L12 3ZM12 9v4M12 17h.01"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
};

function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.grid}</svg>`; }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });

const toast = (message) => { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); };

function makePath(values, width, height, maximum) {
  const denominator = Math.max(1, values.length - 1);
  return values.map((value, index) => `${index ? 'L' : 'M'} ${(index * width / denominator).toFixed(1)} ${(height - value / maximum * height).toFixed(1)}`).join(' ');
}

function renderOverview(data) {
  overviewState = data;
  const { metrics, growth, health, categories, activities, period } = data;
  document.querySelector('#dateLabel').textContent = period.label;
  document.querySelector('#metricGrid').innerHTML = metrics.map(metric => `<a class="metric-card metric-link" href="${adminRouteHash({ view: 'detail', key: metric.key })}" data-metric-key="${escapeHtml(metric.key)}" aria-label="Buka detail ${escapeHtml(metric.label)}"><div class="metric-icon ${escapeHtml(metric.tone)}">${icon(metric.icon)}</div><p>${escapeHtml(metric.label)}</p><strong>${escapeHtml(metric.value)}</strong><div><span>${metric.trend.startsWith('-') ? '↘' : '↗'} ${escapeHtml(metric.trend)}</span><small>${escapeHtml(metric.note)}</small></div></a>`).join('');

  const chart = document.querySelector('#growthChart');
  const width = 700;
  const height = 205;
  const largestGrowth = Math.max(1, ...growth.active, ...growth.newUsers);
  const chartMaximum = Math.max(4, Math.ceil((largestGrowth * 1.15) / 4) * 4);
  document.querySelectorAll('.y-axis span').forEach((label, index) => {
    const value = chartMaximum * (4 - index) / 4;
    label.textContent = value >= 1000 ? `${(value / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}k` : Math.round(value);
  });
  chart.setAttribute('viewBox', `0 0 ${width} ${height + 32}`);
  chart.innerHTML = `<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8060" stop-opacity=".22"/><stop offset="1" stop-color="#2f8060" stop-opacity="0"/></linearGradient></defs>${[0, .25, .5, .75, 1].map(value => `<line x1="0" y1="${height * value}" x2="${width}" y2="${height * value}"/>`).join('')}<path class="area" d="${makePath(growth.active, width, height, chartMaximum)} L ${width} ${height} L 0 ${height} Z"/><path class="active-line" d="${makePath(growth.active, width, height, chartMaximum)}"/><path class="new-line" d="${makePath(growth.newUsers, width, height, chartMaximum)}"/>${growth.active.map((value, index) => `<circle class="point" cx="${index * width / Math.max(1, growth.active.length - 1)}" cy="${height - value / chartMaximum * height}" r="4"/>`).join('')}${growth.labels.map((label, index) => `<text x="${index * width / Math.max(1, growth.labels.length - 1)}" y="${height + 27}" text-anchor="middle">${escapeHtml(label)}</text>`).join('')}`;

  const stops = health.reduce((result, item) => {
    const start = result.total;
    result.total += item.value;
    result.parts.push(`${item.color} ${start}% ${result.total}%`);
    return result;
  }, { total: 0, parts: [] });
  document.querySelector('#healthDonut').style.background = stops.parts.length ? `conic-gradient(${stops.parts.join(',')})` : '#edf2ef';
  document.querySelector('#healthDonut strong').textContent = metrics.find(metric => metric.key === 'active-users')?.value || '0';
  document.querySelector('#healthLegend').innerHTML = health.map(item => `<div><span><i style="background:${item.color}"></i>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}% <small>${escapeHtml(item.count)}</small></strong></div>`).join('');
  document.querySelector('.insight-note p').innerHTML = health.length
    ? `<strong>Insight</strong><br>${escapeHtml(health[0].value)}% pengguna aktif memiliki cash flow sehat pada periode ini.`
    : '<strong>Insight</strong><br>Belum ada data kesehatan cash flow pada periode ini.';
  document.querySelector('#categories').innerHTML = categories.length ? categories.map(item => `<div class="category"><span class="category-icon" style="color:${item.color};background:${item.color}18">${icon(item.icon)}</span><div class="category-main"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.count)}</small></div><div class="bar"><i style="width:${item.percent}%;background:${item.color}"></i></div></div><b>${escapeHtml(item.amount)}</b></div>`).join('') : '<p class="admin-empty">Belum ada pengeluaran pada periode ini.</p>';
  document.querySelector('#activities').innerHTML = activities.length ? activities.map(item => `<div class="activity"><span class="activity-icon ${escapeHtml(item.tone)}">${icon(item.icon)}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p><small>${escapeHtml(item.time)}</small></div></div>`).join('') : '<p class="admin-empty">Belum ada aktivitas terbaru.</p>';
}

function renderOverviewError(error) {
  overviewState = null;
  const message = escapeHtml(error.message);
  document.querySelector('#dateLabel').textContent = 'Data tidak tersedia';
  document.querySelector('#metricGrid').innerHTML = `<p class="admin-empty">Insight gagal dimuat: ${message}</p>`;
  document.querySelector('#growthChart').innerHTML = '';
  document.querySelector('#healthDonut').style.background = '#edf2ef';
  document.querySelector('#healthDonut strong').textContent = '—';
  document.querySelector('#healthLegend').innerHTML = '<p class="admin-empty">Data tidak tersedia.</p>';
  document.querySelector('.insight-note p').innerHTML = '<strong>Insight</strong><br>Data belum dapat dimuat.';
  document.querySelector('#categories').innerHTML = `<p class="admin-empty">${message}</p>`;
  document.querySelector('#activities').innerHTML = `<p class="admin-empty">${message}</p>`;
}

async function loadOverview() {
  if (overviewState) return overviewState;
  if (overviewLoading) return overviewLoading;
  document.querySelector('#dateLabel').textContent = 'Memuat periode...';
  document.querySelector('#metricGrid').innerHTML = '<p class="admin-empty">Memuat insight dari database...</p>';
  overviewLoading = request('/insights').then(data => {
    renderOverview(data);
    return data;
  }).catch(error => {
    if (error.status === 401) return window.location.reload();
    renderOverviewError(error);
    return null;
  }).finally(() => { overviewLoading = null; });
  return overviewLoading;
}

document.querySelector('#exportButton').addEventListener('click', () => {
  if (!overviewState) return toast('Insight belum siap diekspor.');
  const rows = [['Metrik', 'Nilai', 'Perubahan'], ...overviewState.metrics.map(metric => [metric.label, metric.value, metric.trend])];
  const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `cashly-insight-${overviewState.period.end || overviewState.period.key || 'terbaru'}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast('Laporan berhasil diekspor');
});
document.querySelector('#dateButton').addEventListener('click', () => toast(overviewState ? `Periode aktif: ${overviewState.period.label}` : 'Insight belum tersedia.'));
document.querySelector('#menuBtn').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));

const userState = { page: 1, limit: 10, q: '', status: 'all', loaded: false };
const transactionState = {
  page: 1, limit: 10, q: '', type: 'all', direction: 'all', period: 'month',
  loaded: false, requestId: 0, hasPreviousPage: false, hasNextPage: false,
};
const reportState = { period: 'month', loaded: false, requestId: 0, data: null };
const detailState = {
  key: null, page: 1, limit: 10, requestId: 0,
  hasPreviousPage: false, hasNextPage: false,
};

function renderUserSummary(summary) {
  document.querySelector('#usersTotal').textContent = summary.total.toLocaleString('id-ID');
  document.querySelector('#usersActive').textContent = summary.active.toLocaleString('id-ID');
  document.querySelector('#usersNew').textContent = summary.new.toLocaleString('id-ID');
  document.querySelector('#usersTransactions').textContent = (summary.totalTransactions || 0).toLocaleString('id-ID');
}

function renderUsers(data) {
  const body = document.querySelector('#usersTableBody');
  renderUserSummary(data.summary);
  document.querySelector('#usersResultLabel').textContent = `${data.pagination.totalItems.toLocaleString('id-ID')} pengguna ditemukan`;
  if (!data.items.length) {
    body.innerHTML = '<tr><td colspan="6" class="users-loading">Tidak ada pengguna yang sesuai dengan pencarian.</td></tr>';
  } else {
    body.innerHTML = data.items.map(user => {
      const initials = user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
      return `<tr>
        <td><div class="table-user"><span>${escapeHtml(initials)}</span><div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)} · ${user.onboardingDone ? 'Onboarding selesai' : 'Onboarding belum selesai'}</small></div></div></td>
        <td><span class="user-status ${escapeHtml(user.status)}"><i></i>${escapeHtml(user.statusLabel)}</span></td>
        <td><strong class="table-number">${user.transactionCount.toLocaleString('id-ID')}</strong></td>
        <td><strong class="table-number">${escapeHtml(user.totalVolumeLabel)}</strong></td>
        <td><span class="table-date">${escapeHtml(user.lastActivityLabel)}</span></td>
        <td><span class="table-date">${escapeHtml(user.joinedAtLabel)}</span></td>
      </tr>`;
    }).join('');
  }
  const { page, limit, totalItems, totalPages, hasPreviousPage, hasNextPage } = data.pagination;
  const first = totalItems ? (page - 1) * limit + 1 : 0;
  const last = Math.min(page * limit, totalItems);
  document.querySelector('#usersRange').textContent = totalItems ? `Menampilkan ${first}–${last} dari ${totalItems.toLocaleString('id-ID')}` : '0 pengguna';
  document.querySelector('#usersPageLabel').textContent = `Halaman ${page} dari ${totalPages}`;
  document.querySelector('#usersPrev').disabled = !hasPreviousPage;
  document.querySelector('#usersNext').disabled = !hasNextPage;
  userState.page = page;
  userState.loaded = true;
}

async function loadUsers() {
  const body = document.querySelector('#usersTableBody');
  body.innerHTML = '<tr><td colspan="6" class="users-loading">Memuat pengguna dari database...</td></tr>';
  const params = new URLSearchParams({ page: userState.page, limit: userState.limit, status: userState.status });
  if (userState.q) params.set('q', userState.q);
  try {
    renderUsers(await request(`/users?${params}`));
  } catch (error) {
    if (error.status === 401) return window.location.reload();
    body.innerHTML = `<tr><td colspan="6" class="users-loading error">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderTransactionSummary(summary) {
  document.querySelector('#transactionsTotal').textContent = summary.countLabel;
  document.querySelector('#transactionsVolume').textContent = summary.volumeLabel;
  document.querySelector('#transactionsInflow').textContent = summary.inflowLabel;
  document.querySelector('#transactionsOutflow').textContent = summary.outflowLabel;
}

function resetTransactionSummary() {
  ['transactionsTotal', 'transactionsVolume', 'transactionsInflow', 'transactionsOutflow']
    .forEach(id => { document.querySelector(`#${id}`).textContent = '—'; });
}

function setTransactionsLoading() {
  transactionState.loaded = false;
  transactionState.hasPreviousPage = false;
  transactionState.hasNextPage = false;
  resetTransactionSummary();
  document.querySelector('#transactionsResultLabel').textContent = 'Memuat transaksi dari database...';
  document.querySelector('#transactionsRange').textContent = 'Menyiapkan data...';
  document.querySelector('#transactionsPageLabel').textContent = '—';
  document.querySelector('#transactionsPrev').disabled = true;
  document.querySelector('#transactionsNext').disabled = true;
  const body = document.querySelector('#transactionsTableBody');
  body.setAttribute('aria-busy', 'true');
  body.innerHTML = '<tr class="table-state-row"><td colspan="6" class="table-state"><span class="detail-loading-spinner" aria-hidden="true"></span>Memuat transaksi dari database...</td></tr>';
}

function setTransactionsError(error) {
  transactionState.loaded = false;
  transactionState.hasPreviousPage = false;
  transactionState.hasNextPage = false;
  resetTransactionSummary();
  document.querySelector('#transactionsResultLabel').textContent = 'Transaksi gagal dimuat';
  document.querySelector('#transactionsRange').textContent = 'Data tidak tersedia';
  document.querySelector('#transactionsPageLabel').textContent = '—';
  document.querySelector('#transactionsPrev').disabled = true;
  document.querySelector('#transactionsNext').disabled = true;
  const body = document.querySelector('#transactionsTableBody');
  body.setAttribute('aria-busy', 'false');
  body.innerHTML = `<tr class="table-state-row"><td colspan="6" class="table-state error">${escapeHtml(error.message)}</td></tr>`;
}

function renderAdminTransactions(data) {
  renderTransactionSummary(data.summary);
  const body = document.querySelector('#transactionsTableBody');
  body.setAttribute('aria-busy', 'false');
  body.innerHTML = data.items.length
    ? data.items.map(transactionTableRow).join('')
    : '<tr class="table-state-row"><td colspan="6" class="table-state">Tidak ada transaksi yang sesuai dengan filter.</td></tr>';
  const { page, limit, totalItems, totalPages, hasPreviousPage, hasNextPage } = data.pagination;
  const first = totalItems ? (page - 1) * limit + 1 : 0;
  const last = Math.min(page * limit, totalItems);
  document.querySelector('#transactionsResultLabel').textContent = `${totalItems.toLocaleString('id-ID')} transaksi · ${data.filters.periodLabel}`;
  document.querySelector('#transactionsRange').textContent = totalItems ? `Menampilkan ${first}–${last} dari ${totalItems.toLocaleString('id-ID')}` : '0 transaksi';
  document.querySelector('#transactionsPageLabel').textContent = `Halaman ${page} dari ${totalPages}`;
  document.querySelector('#transactionsPrev').disabled = !hasPreviousPage;
  document.querySelector('#transactionsNext').disabled = !hasNextPage;
  transactionState.page = page;
  transactionState.hasPreviousPage = hasPreviousPage;
  transactionState.hasNextPage = hasNextPage;
  transactionState.loaded = true;
}

async function loadAdminTransactions() {
  const requestId = ++transactionState.requestId;
  setTransactionsLoading();
  const params = new URLSearchParams({
    page: transactionState.page,
    limit: transactionState.limit,
    type: transactionState.type,
    direction: transactionState.direction,
    period: transactionState.period,
  });
  if (transactionState.q) params.set('q', transactionState.q);
  try {
    const data = await request(`/transactions?${params}`);
    if (requestId !== transactionState.requestId) return;
    renderAdminTransactions(data);
  } catch (error) {
    if (requestId !== transactionState.requestId) return;
    if (error.status === 401) return window.location.reload();
    setTransactionsError(error);
  }
}

function renderDetailHighlights(items) {
  const container = document.querySelector('#detailHighlights');
  container.innerHTML = items.length ? items.map(item => `<article class="detail-highlight ${escapeHtml(item.tone || '')}"><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.valueLabel ?? item.value)}</strong><p>${escapeHtml(item.note || '')}</p></article>`).join('') : '<p class="detail-empty">Belum ada ringkasan tambahan.</p>';
}

function renderDetailBreakdown(items) {
  const container = document.querySelector('#detailBreakdown');
  container.innerHTML = items.length ? items.map(item => {
    const percent = Math.max(0, Math.min(100, Number(item.percent) || 0));
    return `<div class="detail-breakdown-row"><div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.valueLabel ?? item.value)}</strong></div><div class="detail-progress"><i style="width:${percent}%"></i></div><small>${percent.toLocaleString('id-ID')}% dari total</small></div>`;
  }).join('') : '<p class="detail-empty">Belum ada distribusi data pada periode ini.</p>';
}

function renderDetailUsers(items) {
  document.querySelector('#detailTableHead').innerHTML = '<tr><th>Pengguna</th><th>Status</th><th>Transaksi</th><th>Volume</th><th>Aktivitas terakhir</th><th>Bergabung</th></tr>';
  document.querySelector('#detailTableBody').innerHTML = items.length ? items.map(user => {
    const initials = String(user.name || 'P').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const status = user.status || (user.transactionCount ? 'active' : 'inactive');
    const statusLabel = user.statusLabel || (status === 'active' ? 'Aktif periode ini' : 'Tidak aktif periode ini');
    return `<tr><td><div class="table-user"><span>${escapeHtml(initials)}</span><div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)} · ${user.onboardingDone ? 'Onboarding selesai' : 'Onboarding belum selesai'}</small></div></div></td><td><span class="user-status ${escapeHtml(status)}"><i></i>${escapeHtml(statusLabel)}</span></td><td><strong class="table-number">${Number(user.transactionCount || 0).toLocaleString('id-ID')}</strong></td><td><strong class="table-number">${escapeHtml(user.totalVolumeLabel || 'Rp 0')}</strong></td><td><span class="table-date">${escapeHtml(user.lastActivityLabel || 'Belum ada aktivitas')}</span></td><td><span class="table-date">${escapeHtml(user.joinedAtLabel || '—')}</span></td></tr>`;
  }).join('') : '<tr><td colspan="6" class="detail-loading">Belum ada pengguna pada detail ini.</td></tr>';
}

function transactionTableRow(transaction) {
  const type = escapeHtml(transaction.type || '');
  const direction = escapeHtml(transaction.direction || '');
  return `<tr><td><div class="detail-transaction transaction-cell"><span class="summary-icon ${transaction.direction === 'masuk' ? 'green' : 'orange'}">${icon(transaction.direction === 'masuk' ? 'wallet' : 'receipt')}</span><div><strong>${escapeHtml(transaction.category)}</strong><small>${escapeHtml(transaction.description || 'Tanpa catatan')}</small></div></div></td><td><div class="detail-owner transaction-owner"><strong>${escapeHtml(transaction.userName || 'Pengguna')}</strong><small>${escapeHtml(transaction.userEmail || '—')}</small></div></td><td><span class="detail-type transaction-type ${type}">${escapeHtml(transaction.typeLabel || transaction.type || '—')}</span></td><td><span class="detail-direction transaction-direction ${direction}">${escapeHtml(transaction.directionLabel || '—')}</span></td><td><strong class="detail-amount transaction-amount ${direction}">${escapeHtml(transaction.amountLabel || 'Rp 0')}</strong></td><td><span class="table-date transaction-date">${escapeHtml(transaction.dateLabel || transaction.date || '—')}</span></td></tr>`;
}

function renderDetailTransactions(items) {
  document.querySelector('#detailTableHead').innerHTML = '<tr><th>Transaksi</th><th>Pengguna</th><th>Tipe</th><th>Arah</th><th>Nominal</th><th>Tanggal</th></tr>';
  document.querySelector('#detailTableBody').innerHTML = items.length ? items.map(transactionTableRow).join('') : '<tr><td colspan="6" class="detail-loading">Belum ada transaksi pada periode ini.</td></tr>';
}

function renderMetricDetail(data) {
  const metric = data.metric;
  document.querySelector('#detailTitle').textContent = data.title;
  document.querySelector('#detailDescription').textContent = data.description;
  const metricIcon = document.querySelector('#detailMetricIcon');
  metricIcon.className = `detail-metric-icon ${metric.tone}`;
  metricIcon.innerHTML = icon(metric.icon);
  document.querySelector('#detailMetricLabel').textContent = metric.label;
  document.querySelector('#detailMetricValue').textContent = metric.value;
  const trend = document.querySelector('#detailMetricTrend');
  trend.className = metric.trend.startsWith('-') ? 'down' : 'up';
  trend.textContent = `${metric.trend.startsWith('-') ? '↘' : '↗'} ${metric.trend}`;
  document.querySelector('#detailMetricNote').textContent = metric.note;
  document.querySelector('#detailPeriod').textContent = data.period.label;
  renderDetailHighlights(data.highlights || []);
  renderDetailBreakdown(data.breakdown || []);
  document.querySelector('#detailListTitle').textContent = data.itemType === 'users' ? 'Pengguna terkait' : 'Transaksi terkait';
  if (data.itemType === 'users') renderDetailUsers(data.items || []);
  else renderDetailTransactions(data.items || []);

  const { page, limit, totalItems, totalPages, hasPreviousPage, hasNextPage } = data.pagination;
  const first = totalItems ? (page - 1) * limit + 1 : 0;
  const last = Math.min(page * limit, totalItems);
  document.querySelector('#detailResultLabel').textContent = `${totalItems.toLocaleString('id-ID')} data ditemukan`;
  document.querySelector('#detailRange').textContent = totalItems ? `Menampilkan ${first}–${last} dari ${totalItems.toLocaleString('id-ID')}` : '0 data';
  document.querySelector('#detailPageLabel').textContent = `Halaman ${page} dari ${totalPages}`;
  document.querySelector('#detailPrev').disabled = !hasPreviousPage;
  document.querySelector('#detailNext').disabled = !hasNextPage;
  detailState.page = page;
  detailState.hasPreviousPage = hasPreviousPage;
  detailState.hasNextPage = hasNextPage;
}

async function loadMetricDetail(key) {
  const requestId = ++detailState.requestId;
  document.querySelector('#detailTableBody').innerHTML = '<tr><td colspan="6" class="detail-loading">Memuat detail dari database...</td></tr>';
  const params = new URLSearchParams({ page: detailState.page, limit: detailState.limit });
  try {
    const data = await request(`/insights/${encodeURIComponent(key)}?${params}`);
    if (requestId !== detailState.requestId || detailState.key !== key) return;
    renderMetricDetail(data);
  } catch (error) {
    if (requestId !== detailState.requestId) return;
    if (error.status === 401) return window.location.reload();
    document.querySelector('#detailTableBody').innerHTML = `<tr><td colspan="6" class="detail-loading error">${escapeHtml(error.message)}</td></tr>`;
  }
}

function reportMetric(summary, key) {
  const metric = summary?.[key];
  if (metric && typeof metric === 'object') return { value: Number(metric.value) || 0, label: String(metric.label ?? metric.value ?? 0) };
  return {
    value: Number(metric) || 0,
    label: String(summary?.[`${key}Label`] ?? metric ?? 0),
  };
}

function renderReportSummary(summary) {
  const bindings = {
    reportTransactionCount: 'transactionCount',
    reportVolume: 'totalVolume',
    reportInflow: 'inflow',
    reportOutflow: 'outflow',
    reportNetFlow: 'netFlow',
    reportActiveUsers: 'activeUsers',
  };
  Object.entries(bindings).forEach(([id, key]) => {
    const element = document.querySelector(`#${id}`);
    const metric = reportMetric(summary, key);
    element.textContent = metric.label;
    if (key === 'netFlow') element.classList.toggle('negative', metric.value < 0);
  });
}

function drawReportTrend(items) {
  const chart = document.querySelector('#reportTrendChart');
  const empty = document.querySelector('#reportTrendEmpty');
  const hasData = items.some(item => Number(item.inflow) || Number(item.outflow) || Number(item.count));
  chart.classList.toggle('hidden', !hasData);
  empty.classList.toggle('hidden', hasData);
  if (!hasData) {
    chart.innerHTML = '';
    empty.innerHTML = '<span>Belum ada transaksi untuk ditampilkan pada grafik.</span>';
    return;
  }

  const width = 820;
  const height = 245;
  const padding = { top: 18, right: 14, bottom: 38, left: 54 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maximum = Math.max(1, ...items.flatMap(item => [Number(item.inflow) || 0, Number(item.outflow) || 0]));
  const groupWidth = plotWidth / Math.max(1, items.length);
  const barWidth = Math.max(3, Math.min(14, groupWidth * .27));
  const y = value => padding.top + plotHeight - (Number(value) || 0) / maximum * plotHeight;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const lineY = padding.top + ratio * plotHeight;
    const value = maximum * (1 - ratio);
    const label = value >= 1_000_000 ? `${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}Jt` : Math.round(value).toLocaleString('id-ID');
    return `<line class="grid-line" x1="${padding.left}" y1="${lineY}" x2="${width - padding.right}" y2="${lineY}"/><text x="${padding.left - 9}" y="${lineY + 3}" text-anchor="end">${label}</text>`;
  }).join('');
  const labelStep = Math.max(1, Math.ceil(items.length / 8));
  const bars = items.map((item, index) => {
    const center = padding.left + groupWidth * (index + .5);
    const inflowY = y(item.inflow);
    const outflowY = y(item.outflow);
    const label = index % labelStep === 0 || index === items.length - 1
      ? `<text x="${center}" y="${height - 13}" text-anchor="middle">${escapeHtml(item.label)}</text>` : '';
    return `<g><rect class="report-inflow-bar" x="${center - barWidth - 1}" y="${inflowY}" width="${barWidth}" height="${padding.top + plotHeight - inflowY}"><title>Kas masuk ${escapeHtml(item.label)}: ${Number(item.inflow).toLocaleString('id-ID')}</title></rect><rect class="report-outflow-bar" x="${center + 1}" y="${outflowY}" width="${barWidth}" height="${padding.top + plotHeight - outflowY}"><title>Kas keluar ${escapeHtml(item.label)}: ${Number(item.outflow).toLocaleString('id-ID')}</title></rect>${label}</g>`;
  }).join('');
  chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
  chart.innerHTML = `<title id="reportTrendTitle">Grafik tren dana masuk dan dana keluar</title><desc id="reportTrendDescription">Grafik batang yang membandingkan volume dana masuk dan keluar pada setiap interval periode laporan.</desc>${grid}${bars}`;
}

function renderReportTypeBreakdown(types) {
  const sections = [
    ['Berdasarkan aktivitas', types?.byType || []],
    ['Berdasarkan arah kas', types?.byDirection || []],
  ];
  document.querySelector('#reportTypeBreakdown').innerHTML = sections.map(([title, items]) => `<section><h3>${title}</h3>${items.length ? items.map(item => `<div class="report-type-row"><div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.volumeLabel)}</strong></div><div class="report-type-bar"><i style="width:${Math.max(0, Math.min(100, Number(item.percentage) || 0))}%"></i></div><small>${Number(item.count || 0).toLocaleString('id-ID')} transaksi · ${Number(item.percentage || 0).toLocaleString('id-ID')}% dari volume</small></div>`).join('') : '<p class="admin-empty">Belum ada data.</p>'}</section>`).join('');
}

function renderReportCategories(items) {
  document.querySelector('#reportCategories').innerHTML = items.length ? items.map(item => `<div class="report-category-item"><div><strong>${Number(item.rank || 0).toLocaleString('id-ID')}. ${escapeHtml(item.name)}</strong><b>${escapeHtml(item.volumeLabel)}</b></div><small>${Number(item.count || 0).toLocaleString('id-ID')} transaksi · ${Number(item.percentage || 0).toLocaleString('id-ID')}% dari volume</small><div class="report-category-bar"><i style="width:${Math.max(0, Math.min(100, Number(item.percentage) || 0))}%"></i></div></div>`).join('') : '<p class="admin-empty">Belum ada kategori pada periode ini.</p>';
}

function userActivityLabel(activity, key) {
  const value = activity?.[key];
  if (value && typeof value === 'object') return String(value.label ?? value.value ?? 0);
  return String(activity?.[`${key}Label`] ?? value ?? 0);
}

function renderAdminReport(data) {
  reportState.data = data;
  reportState.loaded = true;
  renderReportSummary(data.summary);
  drawReportTrend(data.trend || []);
  renderReportTypeBreakdown(data.types);
  renderReportCategories(data.categories || []);
  document.querySelector('#reportCashFlowBody').innerHTML = data.cashFlow.length ? data.cashFlow.map(row => `<tr><td><strong>${escapeHtml(row.label)}</strong><small>${escapeHtml(row.countLabel)}</small></td><td>${escapeHtml(row.inflowLabel)}</td><td>${escapeHtml(row.outflowLabel)}</td><td><strong class="${Number(row.net) < 0 ? 'report-value-negative' : 'report-value-positive'}">${escapeHtml(row.netLabel)}</strong></td></tr>`).join('') : '<tr class="table-state-row"><td colspan="4" class="table-state">Belum ada arus kas pada periode ini.</td></tr>';
  document.querySelector('#reportUsersTotal').textContent = userActivityLabel(data.userActivity, 'totalUsers');
  document.querySelector('#reportUsersActive').textContent = userActivityLabel(data.userActivity, 'activeUsers');
  document.querySelector('#reportUsersNew').textContent = userActivityLabel(data.userActivity, 'newUsers');
  document.querySelector('#reportUsersOnboarding').textContent = userActivityLabel(data.userActivity, 'onboardingCompleted');
  document.querySelector('#reportExport').disabled = false;
  document.querySelector('#reportsPage').setAttribute('aria-busy', 'false');
}

function resetReportValues() {
  ['reportTransactionCount', 'reportVolume', 'reportInflow', 'reportOutflow', 'reportNetFlow', 'reportActiveUsers',
    'reportUsersTotal', 'reportUsersActive', 'reportUsersNew', 'reportUsersOnboarding']
    .forEach(id => { document.querySelector(`#${id}`).textContent = '—'; });
  document.querySelector('#reportNetFlow').classList.remove('negative');
}

function setReportLoading() {
  reportState.data = null;
  reportState.loaded = false;
  document.querySelector('#reportsPage').setAttribute('aria-busy', 'true');
  resetReportValues();
  document.querySelector('#reportExport').disabled = true;
  const chart = document.querySelector('#reportTrendChart');
  chart.classList.add('hidden');
  chart.innerHTML = '';
  const trendState = document.querySelector('#reportTrendEmpty');
  trendState.classList.remove('hidden');
  trendState.innerHTML = '<span class="detail-loading-spinner" aria-hidden="true"></span><span>Memuat tren arus dana...</span>';
  document.querySelector('#reportTypeBreakdown').innerHTML = '<div class="report-loading" role="status"><span class="detail-loading-spinner" aria-hidden="true"></span>Memuat komposisi transaksi...</div>';
  document.querySelector('#reportCategories').innerHTML = '<div class="report-loading" role="status"><span class="detail-loading-spinner" aria-hidden="true"></span>Memuat kategori...</div>';
  document.querySelector('#reportCashFlowBody').innerHTML = '<tr class="table-state-row"><td colspan="4" class="table-state"><span class="detail-loading-spinner" aria-hidden="true"></span>Menyusun laporan dari database...</td></tr>';
}

function setReportError(error) {
  reportState.data = null;
  reportState.loaded = false;
  document.querySelector('#reportsPage').setAttribute('aria-busy', 'false');
  resetReportValues();
  document.querySelector('#reportExport').disabled = true;
  const message = escapeHtml(error.message);
  const chart = document.querySelector('#reportTrendChart');
  chart.classList.add('hidden');
  chart.innerHTML = '';
  const trendState = document.querySelector('#reportTrendEmpty');
  trendState.classList.remove('hidden');
  trendState.innerHTML = `<span>${message}</span>`;
  document.querySelector('#reportTypeBreakdown').innerHTML = `<div class="report-loading error" role="alert">${message}</div>`;
  document.querySelector('#reportCategories').innerHTML = `<div class="report-loading error" role="alert">${message}</div>`;
  document.querySelector('#reportCashFlowBody').innerHTML = `<tr class="table-state-row"><td colspan="4" class="table-state error">${message}</td></tr>`;
}

async function loadAdminReport() {
  const requestId = ++reportState.requestId;
  setReportLoading();
  try {
    const data = await request(`/reports?period=${encodeURIComponent(reportState.period)}`);
    if (requestId !== reportState.requestId) return;
    renderAdminReport(data);
  } catch (error) {
    if (requestId !== reportState.requestId) return;
    if (error.status === 401) return window.location.reload();
    setReportError(error);
  }
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportAdminReport() {
  const data = reportState.data;
  if (!data) return toast('Laporan masih dimuat.');
  const rows = [
    ['Laporan Cashly', data.period.label],
    [],
    ['Metrik', 'Nilai'],
    ['Total transaksi', reportMetric(data.summary, 'transactionCount').label],
    ['Volume transaksi', reportMetric(data.summary, 'totalVolume').label],
    ['Kas masuk', reportMetric(data.summary, 'inflow').label],
    ['Kas keluar', reportMetric(data.summary, 'outflow').label],
    ['Arus bersih', reportMetric(data.summary, 'netFlow').label],
    [],
    ['Aktivitas', 'Kas masuk', 'Kas keluar', 'Arus bersih', 'Transaksi'],
    ...data.cashFlow.map(row => [row.label, row.inflowLabel, row.outflowLabel, row.netLabel, row.countLabel]),
  ];
  const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `cashly-laporan-${data.period.key}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast('Laporan berhasil diekspor.');
}

function setAdminRoute(route, { replace = false } = {}) {
  const hash = adminRouteHash(route);
  if (window.location.hash === hash) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', hash);
}

function openAdminRoute(route, { updateHistory = true, replace = false } = {}) {
  const view = route.view;
  const isDetail = view === 'detail';
  document.querySelector('#dashboard').classList.toggle('hidden', view !== 'overview');
  document.querySelector('#usersPage').classList.toggle('hidden', view !== 'users');
  document.querySelector('#transactionsPage').classList.toggle('hidden', view !== 'transactions');
  document.querySelector('#reportsPage').classList.toggle('hidden', view !== 'reports');
  document.querySelector('#metricDetailPage').classList.toggle('hidden', !isDetail);
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === (isDetail ? 'overview' : view)));
  document.querySelector('#sidebar').classList.remove('open');
  if (updateHistory) setAdminRoute(route, { replace });
  if (view === 'overview') loadOverview();
  if (view === 'users' && !userState.loaded) loadUsers();
  if (view === 'transactions' && !transactionState.loaded) loadAdminTransactions();
  if (view === 'reports' && !reportState.loaded) loadAdminReport();
  if (isDetail) {
    if (detailState.key !== route.key) detailState.page = 1;
    detailState.key = route.key;
    const metric = overviewState?.metrics?.find(item => item.key === route.key);
    if (metric) {
      document.querySelector('#detailTitle').textContent = `Detail ${metric.label}`;
      document.querySelector('#detailDescription').textContent = 'Memuat data terbaru dari database...';
    }
    loadMetricDetail(route.key);
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function openAdminView(view) {
  if (!['overview', 'users', 'transactions', 'reports'].includes(view)) {
    toast(`${document.querySelector(`[data-view="${view}"]`)?.textContent.trim() || 'Fitur'} segera tersedia`);
    return;
  }
  openAdminRoute({ view });
}

function syncAdminRoute() {
  const route = parseAdminRoute(window.location.hash);
  if (route.view === 'unavailable') {
    const label = document.querySelector(`[data-view="${route.target}"]`)?.textContent.trim();
    if (label) toast(`${label} segera tersedia`);
    openAdminRoute({ view: 'overview' }, { updateHistory: false });
    setAdminRoute({ view: 'overview' }, { replace: true });
    return;
  }
  openAdminRoute(route, { updateHistory: false });
  if (!window.location.hash) setAdminRoute(route, { replace: true });
}

document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  openAdminView(link.dataset.view);
}));
document.addEventListener('click', event => {
  const control = event.target.closest('[data-metric-key]');
  if (!control) return;
  if (control.tagName === 'A' && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
  event.preventDefault();
  openAdminRoute({ view: 'detail', key: control.dataset.metricKey });
});
let userSearchTimer;
document.querySelector('#userSearch').addEventListener('input', event => {
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(() => { userState.q = event.target.value.trim(); userState.page = 1; loadUsers(); }, 300);
});
document.querySelector('#userStatus').addEventListener('change', event => {
  userState.status = event.target.value;
  userState.page = 1;
  loadUsers();
});
document.querySelector('#usersPrev').addEventListener('click', () => { if (userState.page > 1) { userState.page -= 1; loadUsers(); } });
document.querySelector('#usersNext').addEventListener('click', () => { userState.page += 1; loadUsers(); });
document.querySelector('#refreshUsers').addEventListener('click', () => loadUsers());
let transactionSearchTimer;
document.querySelector('#transactionSearch').addEventListener('input', event => {
  clearTimeout(transactionSearchTimer);
  transactionSearchTimer = setTimeout(() => {
    transactionState.q = event.target.value.trim();
    transactionState.page = 1;
    loadAdminTransactions();
  }, 300);
});
document.querySelector('#transactionType').addEventListener('change', event => {
  transactionState.type = event.target.value;
  transactionState.page = 1;
  loadAdminTransactions();
});
document.querySelector('#transactionDirection').addEventListener('change', event => {
  transactionState.direction = event.target.value;
  transactionState.page = 1;
  loadAdminTransactions();
});
document.querySelector('#transactionPeriod').addEventListener('change', event => {
  transactionState.period = event.target.value;
  transactionState.page = 1;
  loadAdminTransactions();
});
document.querySelector('#transactionsPrev').addEventListener('click', () => {
  if (!transactionState.hasPreviousPage) return;
  transactionState.page -= 1;
  loadAdminTransactions();
});
document.querySelector('#transactionsNext').addEventListener('click', () => {
  if (!transactionState.hasNextPage) return;
  transactionState.page += 1;
  loadAdminTransactions();
});
document.querySelector('#transactionsRefresh').addEventListener('click', loadAdminTransactions);
document.querySelector('#reportPeriod').addEventListener('change', event => {
  reportState.period = event.target.value;
  loadAdminReport();
});
document.querySelector('#reportsRefresh').addEventListener('click', loadAdminReport);
document.querySelector('#reportExport').addEventListener('click', exportAdminReport);
document.querySelector('#detailBack').addEventListener('click', () => openAdminRoute({ view: 'overview' }));
document.querySelector('#refreshDetail').addEventListener('click', () => {
  if (detailState.key) loadMetricDetail(detailState.key);
});
document.querySelector('#detailPrev').addEventListener('click', () => {
  if (!detailState.hasPreviousPage || !detailState.key) return;
  detailState.page -= 1;
  loadMetricDetail(detailState.key);
});
document.querySelector('#detailNext').addEventListener('click', () => {
  if (!detailState.hasNextPage || !detailState.key) return;
  detailState.page += 1;
  loadMetricDetail(detailState.key);
});
window.addEventListener('hashchange', syncAdminRoute);
syncAdminRoute();
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector('#searchInput').focus(); } });
document.querySelector('#logoutBtn').addEventListener('click', async () => {
  await request('/auth/logout', { method: 'POST' }).catch(() => null);
  window.location.assign('/admin/');
});

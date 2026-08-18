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
  try {
    const session = await request('/session');
    showAuthenticated(session.user);
    return session.user;
  } catch (error) {
    if (error.status !== 401) document.querySelector('#loginError').textContent = error.message;
  }

  return new Promise(resolve => {
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
            email: document.querySelector('#adminEmail').value,
            password: document.querySelector('#adminPassword').value,
          }),
        });
        document.querySelector('#adminPassword').value = '';
        showAuthenticated(result.user);
        resolve(result.user);
      } catch (error) {
        errorEl.textContent = error.message;
      } finally {
        button.disabled = false;
        button.querySelector('span').textContent = 'Masuk ke dashboard';
      }
    });
  });
}

await requireAdmin();
const { metrics, growth, health, categories, activities, period } = await request('/insights');
document.querySelector('#dateLabel').textContent = period.label;

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

document.querySelector('#metricGrid').innerHTML = metrics.map(m => `<article class="metric-card"><div class="metric-icon ${m.tone}">${icon(m.icon)}</div><p>${escapeHtml(m.label)}</p><strong>${escapeHtml(m.value)}</strong><div><span>${m.trend.startsWith('-') ? '↘' : '↗'} ${escapeHtml(m.trend)}</span><small>${escapeHtml(m.note)}</small></div></article>`).join('');

function makePath(values, width, height, max) { return values.map((v, i) => `${i ? 'L' : 'M'} ${(i * width / (values.length - 1)).toFixed(1)} ${(height - v / max * height).toFixed(1)}`).join(' '); }
const chart = document.querySelector('#growthChart');
const w = 700, h = 205;
const largestGrowth = Math.max(1, ...growth.active, ...growth.newUsers);
const chartMax = Math.max(4, Math.ceil((largestGrowth * 1.15) / 4) * 4);
document.querySelectorAll('.y-axis span').forEach((label, index) => {
  const value = chartMax * (4 - index) / 4;
  label.textContent = value >= 1000 ? `${(value / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}k` : Math.round(value);
});
chart.setAttribute('viewBox', `0 0 ${w} ${h + 32}`);
chart.innerHTML = `<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8060" stop-opacity=".22"/><stop offset="1" stop-color="#2f8060" stop-opacity="0"/></linearGradient></defs>${[0,.25,.5,.75,1].map(v => `<line x1="0" y1="${h*v}" x2="${w}" y2="${h*v}"/>`).join('')}<path class="area" d="${makePath(growth.active,w,h,chartMax)} L ${w} ${h} L 0 ${h} Z"/><path class="active-line" d="${makePath(growth.active,w,h,chartMax)}"/><path class="new-line" d="${makePath(growth.newUsers,w,h,chartMax)}"/>${growth.active.map((v,i)=>`<circle class="point" cx="${i*w/6}" cy="${h-v/chartMax*h}" r="4"/>`).join('')}${growth.labels.map((l,i)=>`<text x="${i*w/6}" y="${h+27}" text-anchor="middle">${l}</text>`).join('')}`;

const stops = health.reduce((acc, item) => { const start = acc.total; acc.total += item.value; acc.parts.push(`${item.color} ${start}% ${acc.total}%`); return acc; }, { total: 0, parts: [] });
document.querySelector('#healthDonut').style.background = `conic-gradient(${stops.parts.join(',')})`;
document.querySelector('#healthDonut strong').textContent = metrics[1].value;
document.querySelector('#healthLegend').innerHTML = health.map(x => `<div><span><i style="background:${x.color}"></i>${escapeHtml(x.label)}</span><strong>${escapeHtml(x.value)}% <small>${escapeHtml(x.count)}</small></strong></div>`).join('');
document.querySelector('.insight-note p').innerHTML = `<strong>Insight</strong><br>${health[0].value}% pengguna aktif memiliki cash flow sehat pada periode ini.`;
document.querySelector('#categories').innerHTML = categories.length ? categories.map(x => `<div class="category"><span class="category-icon" style="color:${x.color};background:${x.color}18">${icon(x.icon)}</span><div class="category-main"><div><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.count)}</small></div><div class="bar"><i style="width:${x.percent}%;background:${x.color}"></i></div></div><b>${escapeHtml(x.amount)}</b></div>`).join('') : '<p class="admin-empty">Belum ada pengeluaran pada periode ini.</p>';
document.querySelector('#activities').innerHTML = activities.length ? activities.map(x => `<div class="activity"><span class="activity-icon ${x.tone}">${icon(x.icon)}</span><div><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.text)}</p><small>${escapeHtml(x.time)}</small></div></div>`).join('') : '<p class="admin-empty">Belum ada aktivitas terbaru.</p>';

const toast = (message) => { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); };
document.querySelector('#exportButton').addEventListener('click', () => {
  const csv = ['Metrik,Nilai,Perubahan', ...metrics.map(m => `${m.label},${m.value},${m.trend}`)].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'cashly-insight-2026-08-18.csv'; a.click(); URL.revokeObjectURL(a.href); toast('Laporan berhasil diekspor');
});
document.querySelector('#dateButton').addEventListener('click', () => toast(`Periode aktif: ${period.label}`));
document.querySelector('#menuBtn').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));

const userState = { page: 1, limit: 10, q: '', status: 'all', loaded: false };

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

function openAdminView(view) {
  if (!['overview', 'users'].includes(view)) {
    toast(`${document.querySelector(`[data-view="${view}"]`)?.textContent.trim() || 'Fitur'} segera tersedia`);
    return;
  }
  document.querySelector('#dashboard').classList.toggle('hidden', view !== 'overview');
  document.querySelector('#usersPage').classList.toggle('hidden', view !== 'users');
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === view));
  document.querySelector('#sidebar').classList.remove('open');
  window.location.hash = view === 'overview' ? 'overview' : 'users';
  if (view === 'users' && !userState.loaded) loadUsers();
}

document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  openAdminView(link.dataset.view);
}));
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
if (window.location.hash === '#users') openAdminView('users');
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector('#searchInput').focus(); } });
document.querySelector('#logoutBtn').addEventListener('click', async () => {
  await request('/auth/logout', { method: 'POST' }).catch(() => null);
  window.location.assign('/admin/');
});

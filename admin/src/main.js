import './style.css';
import { metrics, growth, health, categories, activities } from './data.js';

const icons = {
  grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  swap: '<path d="m7 7-4 4 4 4M3 11h14M17 17l4-4-4-4M21 13H7"/>', chart: '<path d="M3 3v18h18M7 16v-5M12 16V7M17 16v-2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9 1.65 1.65 0 0 0 4.27 7.2l-.06-.06 2.83-2.83.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V2h4v.49A1.65 1.65 0 0 0 15 4a1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9c.12.61.66 1.04 1.28 1.04H21v4h-.32c-.62 0-1.16.43-1.28 1Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>', chevron: '<path d="m9 18 6-6-6-6"/>', download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  pulse: '<path d="M3 12h4l2-7 4 14 2-7h6"/>', receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3ZM8 8h8M8 12h6"/>', wallet: '<path d="M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13M16 12h5"/>', spark: '<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3ZM5 16l.7 2.3L8 19l-2.3.7L5 22l-.7-2.3L2 19l2.3-.7L5 16Z"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  food: '<path d="M7 3v8M4 3v5c0 2 6 2 6 0V3M7 11v10M16 3c-3 4-3 8 1 9v9M17 3v9"/>', car: '<path d="m5 17-2-2 2-7h14l2 7-2 2H5ZM7 17v3M17 17v3M7 13h.01M17 13h.01"/>', bag: '<path d="M5 8h14l-1 13H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2"/>', bolt: '<path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>', userPlus: '<path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/>', alert: '<path d="M12 3 2 20h20L12 3ZM12 9v4M12 17h.01"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
};

function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.grid}</svg>`; }
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });

document.querySelector('#metricGrid').innerHTML = metrics.map(m => `<article class="metric-card"><div class="metric-icon ${m.tone}">${icon(m.icon)}</div><p>${m.label}</p><strong>${m.value}</strong><div><span>↗ ${m.trend}</span><small>${m.note}</small></div></article>`).join('');

function makePath(values, width, height) { const max = 12000; return values.map((v, i) => `${i ? 'L' : 'M'} ${(i * width / (values.length - 1)).toFixed(1)} ${(height - v / max * height).toFixed(1)}`).join(' '); }
const chart = document.querySelector('#growthChart');
const w = 700, h = 205;
chart.setAttribute('viewBox', `0 0 ${w} ${h + 32}`);
chart.innerHTML = `<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8060" stop-opacity=".22"/><stop offset="1" stop-color="#2f8060" stop-opacity="0"/></linearGradient></defs>${[0,.25,.5,.75,1].map(v => `<line x1="0" y1="${h*v}" x2="${w}" y2="${h*v}"/>`).join('')}<path class="area" d="${makePath(growth.active,w,h)} L ${w} ${h} L 0 ${h} Z"/><path class="active-line" d="${makePath(growth.active,w,h)}"/><path class="new-line" d="${makePath(growth.newUsers,w,h)}"/>${growth.active.map((v,i)=>`<circle class="point" cx="${i*w/6}" cy="${h-v/12000*h}" r="4"/>`).join('')}${growth.labels.map((l,i)=>`<text x="${i*w/6}" y="${h+27}" text-anchor="middle">${l}</text>`).join('')}`;

const stops = health.reduce((acc, item) => { const start = acc.total; acc.total += item.value; acc.parts.push(`${item.color} ${start}% ${acc.total}%`); return acc; }, { total: 0, parts: [] });
document.querySelector('#healthDonut').style.background = `conic-gradient(${stops.parts.join(',')})`;
document.querySelector('#healthLegend').innerHTML = health.map(x => `<div><span><i style="background:${x.color}"></i>${x.label}</span><strong>${x.value}% <small>${x.count}</small></strong></div>`).join('');
document.querySelector('#categories').innerHTML = categories.map(x => `<div class="category"><span class="category-icon" style="color:${x.color};background:${x.color}18">${icon(x.icon)}</span><div class="category-main"><div><strong>${x.name}</strong><small>${x.count}</small></div><div class="bar"><i style="width:${x.percent}%;background:${x.color}"></i></div></div><b>${x.amount}</b></div>`).join('');
document.querySelector('#activities').innerHTML = activities.map(x => `<div class="activity"><span class="activity-icon ${x.tone}">${icon(x.icon)}</span><div><strong>${x.title}</strong><p>${x.text}</p><small>${x.time}</small></div></div>`).join('');

const toast = (message) => { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); };
document.querySelector('#exportButton').addEventListener('click', () => {
  const csv = ['Metrik,Nilai,Perubahan', ...metrics.map(m => `${m.label},${m.value},${m.trend}`)].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'cashly-insight-2026-08-18.csv'; a.click(); URL.revokeObjectURL(a.href); toast('Laporan berhasil diekspor');
});
document.querySelector('#dateButton').addEventListener('click', () => toast('Periode aktif: 01–18 Agustus 2026'));
document.querySelector('#menuBtn').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', e => { e.preventDefault(); document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active')); link.classList.add('active'); document.querySelector('#sidebar').classList.remove('open'); if (link.dataset.view !== 'overview') toast(`${link.textContent.trim()} segera tersedia`); }));
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector('#searchInput').focus(); } });

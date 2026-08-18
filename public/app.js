const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const resetTokenFromUrl=new URLSearchParams(location.search).get('resetToken');
const state = { token: localStorage.getItem('cashly_token'), user: null, transactions: [], page: 'dashboard', period: 'month', balanceVisible: true, authMode: resetTokenFromUrl?'reset':'login', resetToken:resetTokenFromUrl };
const labels = { operasi:'Uang sehari-hari', investasi:'Investasi & aset', pendanaan:'Utang & modal' };
const icons = { operasi:'☕', investasi:'◆', pendanaan:'♢' };
const colors = { operasi:'#3f8968', investasi:'#8275b6', pendanaan:'#e69a4b' };
const purposes = [
  {value:'operasi_keseharian',tipe:'operasi',label:'Kebutuhan sehari-hari'},
  {value:'operasi_rumah',tipe:'operasi',label:'Rumah tangga & tagihan'},
  {value:'operasi_kerja',tipe:'operasi',label:'Pekerjaan & usaha'},
  {value:'operasi_kesehatan',tipe:'operasi',label:'Kesehatan & pendidikan'},
  {value:'operasi_gaya_hidup',tipe:'operasi',label:'Hiburan & gaya hidup'},
  {value:'investasi_instrumen',tipe:'investasi',label:'Investasi keuangan'},
  {value:'investasi_aset',tipe:'investasi',label:'Aset & properti'},
  {value:'investasi_usaha',tipe:'investasi',label:'Pengembangan usaha'},
  {value:'pendanaan_utang',tipe:'pendanaan',label:'Pinjaman & cicilan'},
  {value:'pendanaan_modal',tipe:'pendanaan',label:'Modal & bagi hasil'}
];
const categories = {
  operasi_keseharian:{
    masuk:['Cashback Belanja','Pengembalian Dana','Hadiah Tunai','Uang Saku','Pendapatan Lain-lain'],
    keluar:['Belanja Harian','Makan & Minum','Transportasi Umum','Bensin','Parkir & Tol','Belanja Pakaian','Perawatan Diri','Kebutuhan Anak','Donasi','Lain-lain']
  },
  operasi_rumah:{
    masuk:['Pendapatan Sewa','Penggantian Biaya Rumah','Iuran Rumah Tangga Masuk','Pendapatan Rumah Lainnya'],
    keluar:['Tagihan Listrik','Tagihan Air','Gas Rumah Tangga','Internet & Pulsa','Sewa/Kos','Iuran Lingkungan','Perawatan Rumah','Perabot Rumah','Keamanan & Kebersihan','Lain-lain']
  },
  operasi_kerja:{
    masuk:['Gaji','Pendapatan Freelance','Pendapatan Usaha','Bonus','Tunjangan','Komisi','Uang Lembur','Penjualan Produk','Pendapatan Jasa','Royalti'],
    keluar:['Bahan Baku','Biaya Operasional Usaha','Gaji Karyawan','Sewa Tempat Usaha','Peralatan Kerja','Perjalanan Dinas','Pemasaran & Iklan','Pajak Usaha','Software Kerja','Lain-lain']
  },
  operasi_kesehatan:{
    masuk:['Klaim Asuransi Kesehatan','Beasiswa','Penggantian Biaya Medis','Bantuan Pendidikan','Pendapatan Lainnya'],
    keluar:['Dokter & Rumah Sakit','Obat & Apotek','Asuransi Kesehatan','Olahraga & Kebugaran','Uang Sekolah/Kuliah','Buku & Alat Tulis','Kursus & Pelatihan','Les Privat','Sertifikasi','Lain-lain']
  },
  operasi_gaya_hidup:{
    masuk:['Hadiah Hiburan','Refund Tiket','Pendapatan Konten','Penjualan Barang Hobi','Pendapatan Lainnya'],
    keluar:['Hiburan','Liburan','Hobi','Kafe & Restoran','Langganan Digital','Game','Konser & Acara','Elektronik Konsumtif','Hadiah untuk Orang Lain','Lain-lain']
  },
  investasi_instrumen:{
    masuk:['Penjualan Saham','Penjualan Reksadana','Penjualan Emas','Pencairan Deposito','Penjualan Kripto','Dividen Investasi','Kupon Obligasi','Pengembalian Investasi'],
    keluar:['Pembelian Saham','Pembelian Reksadana','Pembelian Emas','Deposito','Pembelian Kripto','Pembelian Obligasi','Biaya Broker','Investasi Lain-lain']
  },
  investasi_aset:{
    masuk:['Penjualan Properti','Penjualan Kendaraan','Penjualan Elektronik','Penjualan Tanah','Pendapatan Penjualan Aset Lainnya'],
    keluar:['Pembelian Properti','Pembelian Kendaraan','Pembelian Tanah','Pembelian Elektronik','Pembelian Peralatan Kerja','Renovasi Aset','Biaya Legal Aset','Aset Lain-lain']
  },
  investasi_usaha:{
    masuk:['Penjualan Kepemilikan Usaha','Pengembalian Penyertaan Modal','Penjualan Aset Usaha','Hasil Investasi Usaha','Pendapatan Investasi Lainnya'],
    keluar:['Penyertaan Modal Usaha','Pembelian Aset Usaha','Pembukaan Cabang','Pengembangan Produk','Akuisisi Usaha','Riset & Pengembangan','Investasi Usaha Lainnya']
  },
  pendanaan_utang:{
    masuk:['Pinjaman Bank','Pinjaman Koperasi','Pinjaman Keluarga/Teman','Pencairan Kartu Kredit','Pinjaman Online','Refinancing Utang','Pinjaman Lainnya'],
    keluar:['Cicilan KPR','Cicilan Kendaraan','Cicilan Kartu Kredit','Pembayaran Pinjaman Bank','Pembayaran Pinjaman Pribadi','Pelunasan Utang','Bunga Pinjaman','Biaya Administrasi Pinjaman','Pembayaran Utang Lainnya']
  },
  pendanaan_modal:{
    masuk:['Modal Investor','Modal Keluarga','Penambahan Modal Pribadi','Pendanaan Usaha','Setoran Pemilik','Modal Lainnya'],
    keluar:['Bagi Hasil','Dividen Pemilik','Pengembalian Modal','Penarikan Modal Pemilik','Pembelian Kembali Kepemilikan','Distribusi Modal Lainnya']
  }
};
const rupiah = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const shortRupiah = n => n >= 1e9 ? `Rp ${(n/1e9).toFixed(1)} M` : n >= 1e6 ? `Rp ${(n/1e6).toFixed(1)} jt` : rupiah(n);
const dateLabel = d => new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${d}T12:00:00`));

async function api(path, options={}) {
  const headers = { 'Content-Type':'application/json', ...(options.headers||{}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path,{...options,headers});
  if (res.status === 401 && !path.includes('/auth/')) logout();
  const data = res.status === 204 ? null : await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.message || 'Permintaan gagal.');
  return data;
}
function toast(message, error=false) { const el=$('#toast'); el.textContent=message; el.className=`toast show ${error?'error':''}`; setTimeout(()=>el.className='toast',2800); }
function isoToday(){ return new Date().toLocaleDateString('en-CA'); }
function filteredByPeriod(rows, period) {
  if(period==='all') return rows;
  const now=new Date(); const today=isoToday();
  if(period==='today') return rows.filter(t=>t.tanggal===today);
  if(period==='month'){ const key=today.slice(0,7); return rows.filter(t=>t.tanggal.startsWith(key)); }
  const day=(now.getDay()+6)%7; const start=new Date(now); start.setDate(now.getDate()-day); const key=start.toLocaleDateString('en-CA');
  return rows.filter(t=>t.tanggal>=key&&t.tanggal<=today);
}
function transactionKind(t){
  if(['income','expense','investment','saving','debt_payment','transfer'].includes(t.jenis)) return t.jenis;
  if(t.tipe==='investasi') return 'investment';
  if(t.tipe==='pendanaan'&&t.arah==='keluar') return 'debt_payment';
  return t.arah==='masuk'?'income':'expense';
}
function totals(rows){
  return rows.reduce((a,t)=>{
    const kind=transactionKind(t),internal=kind==='transfer'||kind==='saving';
    if(kind==='income')a.income+=t.nominal;
    if(kind==='expense')a.expense+=t.nominal;
    if(kind==='investment'&&t.arah==='keluar')a.investment+=t.nominal;
    if(!internal){a[t.arah]+=t.nominal;a.net+=t.arah==='masuk'?t.nominal:-t.nominal}
    if(kind==='investment'&&t.assetId)a.assetBookValue+=(t.arah==='keluar'?1:-1)*t.nominal;
    return a;
  },{masuk:0,keluar:0,net:0,income:0,expense:0,investment:0,assetBookValue:0});
}

async function init(){
  applyTheme(localStorage.getItem('cashly_theme') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
  bindEvents();
  if(!state.token) return showAuth();
  try { state.user=await api('/api/me'); await enterApp(); } catch { showAuth(); }
}
function showAuth(){ $('#authView').classList.remove('hidden'); $('#appView').classList.add('hidden'); }
async function enterApp(){
  $('#authView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  $('#userName').textContent=state.user.name; $('#userEmail').textContent=state.user.email; $('#avatar').textContent=state.user.name[0].toUpperCase(); $('#greetingName').textContent=state.user.name.split(' ')[0];
  await loadTransactions(); if(!state.user.onboardingDone) openOnboarding();
}
async function loadTransactions(){ state.transactions=await api('/api/transactions'); renderAll(); }
function renderAll(){ renderDashboard(); renderTransactions(); renderReport(); }

function renderDashboard(){
  const rows=filteredByPeriod(state.transactions,state.period); const sum=totals(rows); const overall=totals(state.transactions);
  updateBalanceVisibility(overall.net); $('#incomeValue').textContent=rupiah(sum.income); $('#expenseValue').textContent=rupiah(sum.expense);
  $('#investmentValue').textContent=rupiah(sum.investment); $('#outflowValue').textContent=rupiah(sum.keluar);
  $('#assetValue').textContent=rupiah(overall.net+overall.assetBookValue); $('#netWorthValue').textContent=rupiah(overall.net+overall.assetBookValue);
  $('#incomeCount').textContent=`${rows.filter(t=>transactionKind(t)==='income').length} transaksi`; $('#expenseCount').textContent=`${rows.filter(t=>transactionKind(t)==='expense').length} transaksi`;
  $('#balanceDelta').textContent=`${sum.net>=0?'↑':'↓'} ${rupiah(Math.abs(sum.net))} pada periode ini`; $('#streakValue').textContent=`${calculateStreak()} hari`;
  renderList($('#recentList'),rows.slice(0,5),false); renderInsights(rows); drawTrend(rows); drawDonut(rows.filter(t=>transactionKind(t)==='expense'));
}
function updateBalanceVisibility(balance=totals(state.transactions).net){
  $('#balanceValue').textContent=state.balanceVisible?rupiah(balance):'Rp •••••••';
  $('#eyeBtn').textContent=state.balanceVisible?'◉':'○';
  $('#eyeBtn').setAttribute('aria-label',state.balanceVisible?'Sembunyikan saldo':'Tampilkan saldo');
}
function renderInsights(rows){
  const sum=totals(rows),expenses=rows.filter(t=>transactionKind(t)==='expense'),byCategory={};
  expenses.forEach(t=>byCategory[t.kategori]=(byCategory[t.kategori]||0)+t.nominal);
  const categoryRows=Object.entries(byCategory).sort((a,b)=>b[1]-a[1]);
  $('#expenseTypeTotal').textContent=rupiah(sum.expense);
  $('#expenseTypeList').innerHTML=categoryRows.length?categoryRows.slice(0,5).map(([name,value])=>`<div class="expense-type-row"><span>${escapeHtml(name)}</span><strong>${rupiah(value)}</strong><div class="expense-type-track"><i style="width:${Math.max(4,value/categoryRows[0][1]*100)}%"></i></div></div>`).join(''):'<div class="expense-type-empty">Belum ada pengeluaran pada periode ini.</div>';
  if(!rows.length){$('#insightList').innerHTML='<div class="expense-type-empty">Tambahkan transaksi untuk mendapatkan insight personal.</div>';return}
  const savingsRate=sum.income?Math.round((sum.income-sum.expense-sum.investment)/sum.income*100):null;
  const dominantType=['operasi','investasi','pendanaan'].map(type=>({type,value:expenses.filter(t=>t.tipe===type).reduce((a,t)=>a+t.nominal,0)})).sort((a,b)=>b.value-a.value)[0];
  const insights=[];
  if(savingsRate!==null) insights.push({icon:savingsRate>=0?'↗':'↘',title:savingsRate>=20?'Arus kasmu sehat':savingsRate>=0?'Kas masih bertumbuh':'Pengeluaran melampaui pemasukan',text:`Rasio arus kas bersihmu ${Math.abs(savingsRate)}% dari total pemasukan.`});
  if(categoryRows.length) insights.push({icon:'◎',title:`Terbesar: ${categoryRows[0][0]}`,text:`Menyerap ${Math.round(categoryRows[0][1]/sum.expense*100)}% atau ${rupiah(categoryRows[0][1])} dari expense.`});
  if(dominantType?.value) insights.push({icon:icons[dominantType.type],title:labels[dominantType.type],text:`Tipe ini menjadi sumber pengeluaran terbesar, total ${rupiah(dominantType.value)}.`});
  $('#insightList').innerHTML=insights.slice(0,3).map(x=>`<div class="insight-item"><span>${x.icon}</span><div><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.text)}</p></div></div>`).join('');
}
function calculateStreak(){ const days=[...new Set(state.transactions.map(t=>t.tanggal))].sort().reverse(); if(!days.length)return 0; let n=1; for(let i=1;i<days.length;i++){const a=new Date(days[i-1]),b=new Date(days[i]);if((a-b)/86400000===1)n++;else break} return n; }
function renderList(container, rows, grouped=false){
  if(!rows.length){container.innerHTML='<div class="empty">Belum ada transaksi pada periode ini.</div>';return}
  let last=''; container.innerHTML=rows.map(t=>{let header='';if(grouped&&t.tanggal!==last){last=t.tanggal;header=`<div class="date-header">${dateLabel(t.tanggal)}</div>`}return header+transactionHTML(t)}).join('');
}
function transactionHTML(t){ const detail=[t.tujuan,t.deskripsi].filter(Boolean).join(' · ')||labels[t.tipe];return `<div class="transaction-row" data-id="${t.id}"><div class="txn-icon ${t.tipe}">${icons[t.tipe]}</div><div class="txn-info"><strong>${escapeHtml(t.kategori)}</strong><small>${escapeHtml(detail)}${t.sample?' · Contoh':''}</small></div><div class="txn-meta">${dateLabel(t.tanggal)}<br>${labels[t.tipe]}</div><div><div class="txn-amount ${t.arah}">${t.arah==='masuk'?'+':'−'} ${rupiah(t.nominal)}</div><div class="txn-actions"><button data-edit="${t.id}" aria-label="Edit">✎</button><button data-delete="${t.id}" aria-label="Hapus">⌫</button></div></div></div>`; }
function escapeHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

function renderTransactions(){
  const q=$('#searchInput').value.toLowerCase(), type=$('#typeFilter').value, direction=$('#directionFilter').value;
  let rows=state.transactions.filter(t=>(!q||`${t.kategori} ${t.deskripsi}`.toLowerCase().includes(q))&&(!type||t.tipe===type)&&(!direction||t.arah===direction));
  renderList($('#allTransactions'),rows,true);
}
function renderReport(){
  const period=$('#reportPeriod').value; const rows=filteredByPeriod(state.transactions,period); const sum=totals(rows); $('#netCash').textContent=`${sum.net<0?'−':''}${rupiah(Math.abs(sum.net))}`;
  $('#reportNarrative').textContent=sum.net>=0?'Kasmu bertumbuh pada periode ini. Pertahankan arus positif dengan tetap mencatat secara rutin.':'Cash outflow lebih besar dari cash inflow pada periode ini. Expense dan investasi tetap dilaporkan terpisah.';
  const data=['operasi','investasi','pendanaan'].map(type=>({type,...totals(rows.filter(t=>t.tipe===type))}));
  $('#cashflowCards').innerHTML=data.map(x=>`<article class="flow-card"><div class="flow-top"><span class="eyebrow">${x.type.toUpperCase()}</span><span class="flow-icon">${icons[x.type]}</span></div><h3>${labels[x.type]}</h3><p>${x.type==='operasi'?'Kerja dan kebutuhan rutin':x.type==='investasi'?'Aset dan pertumbuhan masa depan':'Pinjaman, cicilan, dan modal'}</p><div class="flow-values"><div><small>Masuk</small><strong>${shortRupiah(x.masuk)}</strong></div><div><small>Keluar</small><strong>${shortRupiah(x.keluar)}</strong></div></div><span class="net-pill" style="color:${x.net>=0?'var(--green)':'var(--red)'}">Bersih ${x.net>=0?'+':'−'} ${shortRupiah(Math.abs(x.net))}</span></article>`).join('');
  $('#reportTable').innerHTML=data.map(x=>`<tr><td>${labels[x.type]}</td><td>${rupiah(x.masuk)}</td><td>${rupiah(x.keluar)}</td><td style="color:${x.net>=0?'var(--green)':'var(--red)'}">${x.net>=0?'+':'−'} ${rupiah(Math.abs(x.net))}</td></tr>`).join('');
  $('#reportFoot').innerHTML=`<tr><td>Total</td><td>${rupiah(sum.masuk)}</td><td>${rupiah(sum.keluar)}</td><td>${sum.net>=0?'+':'−'} ${rupiah(Math.abs(sum.net))}</td></tr>`;
}
function printReport(){
  const select=$('#reportPeriod'),periodLabel=select.options[select.selectedIndex].text;
  const printedAt=new Intl.DateTimeFormat('id-ID',{dateStyle:'long',timeStyle:'short'}).format(new Date());
  $('#printMeta').textContent=`${state.user.name} · Periode ${periodLabel} · Dicetak ${printedAt}`;
  renderReport();
  const originalTitle=document.title;
  document.title=`Laporan Arus Kas Cashly - ${state.user.name} - ${periodLabel}`;
  const restore=()=>{document.title=originalTitle;window.removeEventListener('afterprint',restore)};
  window.addEventListener('afterprint',restore);
  window.print();
  setTimeout(()=>{if(document.title!==originalTitle)restore()},1000);
}

function canvasSetup(canvas){
  if(!canvas) return null;
  const dpr=devicePixelRatio||1,rect=canvas.getBoundingClientRect();
  if(rect.width===0) return null;
  const h=Number(canvas.getAttribute('height'))||rect.height;
  canvas.width=rect.width*dpr;canvas.height=h*dpr;canvas.style.height=`${h}px`;
  const ctx=canvas.getContext('2d');
  if(!ctx) return null;
  ctx.scale(dpr,dpr);return{ctx,w:rect.width,h};
}
function drawTrend(rows){
  const c=$('#trendChart'),setup=canvasSetup(c);if(!setup)return;const {ctx,w,h}=setup,ordered=[...rows].sort((a,b)=>a.tanggal.localeCompare(b.tanggal));ctx.clearRect(0,0,w,h);if(!ordered.length)return;
  const byDay={};ordered.forEach(t=>{const kind=transactionKind(t),movement=kind==='transfer'||kind==='saving'?0:(t.arah==='masuk'?t.nominal:-t.nominal);byDay[t.tanggal]=(byDay[t.tanggal]||0)+movement});let running=0;const vals=Object.entries(byDay).map(([d,v])=>({d,v:running+=v}));const min=Math.min(0,...vals.map(x=>x.v)),max=Math.max(1,...vals.map(x=>x.v)),pad=20;
  ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--line');ctx.lineWidth=1;for(let i=0;i<4;i++){const y=pad+(h-2*pad)*i/3;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke()}
  const pts=vals.map((x,i)=>({x:pad+(w-2*pad)*(vals.length===1?.5:i/(vals.length-1)),y:h-pad-(h-2*pad)*(x.v-min)/(max-min)}));const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'rgba(55,137,96,.32)');grad.addColorStop(1,'rgba(55,137,96,0)');ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineTo(pts.at(-1).x,h-pad);ctx.lineTo(pts[0].x,h-pad);ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#3c8a66';ctx.lineWidth=3;ctx.lineJoin='round';ctx.stroke();
}
function drawDonut(rows){
  const c=$('#donutChart'),setup=canvasSetup(c);if(!setup)return;const {ctx,w,h}=setup,group=['operasi','investasi','pendanaan'].map(type=>({type,value:rows.filter(t=>t.tipe===type).reduce((a,t)=>a+t.nominal,0)})),total=group.reduce((a,x)=>a+x.value,0);ctx.clearRect(0,0,w,h);let angle=-Math.PI/2;group.forEach(x=>{const arc=total?x.value/total*Math.PI*2:Math.PI*2/3;ctx.beginPath();ctx.arc(w/2,h/2,Math.min(w,h)/2-12,angle,angle+arc);ctx.strokeStyle=colors[x.type];ctx.lineWidth=22;ctx.stroke();angle+=arc});ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--text');ctx.font='700 14px Manrope';ctx.textAlign='center';ctx.fillText(total?shortRupiah(total):'Rp 0',w/2,h/2+5);$('#donutLegend').innerHTML=group.map(x=>`<div><span><i style="background:${colors[x.type]}"></i>${labels[x.type]}</span><strong>${total?Math.round(x.value/total*100):0}%</strong></div>`).join('');
}

function openTransaction(txn=null){
  $('#transactionModal').classList.add('open'); $('#editingId').value=txn?.id||''; $('#modalTitle').textContent=txn?'Edit transaksi':'Tambah transaksi';
  const purposeGroups=[['operasi','Aktivitas sehari-hari & kerja'],['investasi','Investasi & aset'],['pendanaan','Utang & modal']];
  $('#purposeInput').innerHTML=purposeGroups.map(([type,title])=>`<optgroup label="${title}">${purposes.filter(p=>p.tipe===type).map(p=>`<option value="${p.value}">${p.label}</option>`).join('')}</optgroup>`).join('');
  const savedPurpose=purposes.find(p=>p.label===txn?.tujuan||p.value===txn?.tujuan);
  $('#purposeInput').value=savedPurpose?.value||purposes.find(p=>p.tipe===(txn?.tipe||'operasi')).value;
  $('#directionInput').value=txn?.arah||'keluar'; $('#dateInput').value=txn?.tanggal||isoToday(); $('#noteInput').value=txn?.deskripsi||''; $('#amountInput').value=txn?new Intl.NumberFormat('id-ID').format(txn.nominal):'';
  updateDirection(); updateCategories(txn?.kategori);
}
function closeTransaction(){ $('#transactionModal').classList.remove('open'); }
function updateDirection(){const dir=$('#directionInput').value;$$('.direction-toggle button').forEach(b=>b.classList.toggle('active',b.dataset.direction===dir));updateCategories()}
function selectedPurpose(){return purposes.find(p=>p.value===$('#purposeInput').value)||purposes[0]}
function updateCategories(selected){const purpose=selectedPurpose(),list=categories[purpose.value][$('#directionInput').value];$('#categoryInput').innerHTML=list.map(x=>`<option ${x===selected?'selected':''}>${x}</option>`).join('')}
async function saveTransaction(e){
  e.preventDefault();const id=$('#editingId').value,purpose=selectedPurpose(),payload={arah:$('#directionInput').value,tipe:purpose.tipe,tujuan:purpose.label,kategori:$('#categoryInput').value,tanggal:$('#dateInput').value,deskripsi:$('#noteInput').value,nominal:Number($('#amountInput').value.replace(/\D/g,''))};
  try{
    await api(id?`/api/transactions/${id}`:'/api/transactions',{method:id?'PUT':'POST',body:JSON.stringify(payload)});
  }catch(error){toast(error.message,true);return}
  closeTransaction();
  toast(id?'Transaksi berhasil diperbarui.':'Transaksi berhasil disimpan.');
  try{await loadTransactions()}catch(error){console.error('Gagal menyegarkan tampilan setelah transaksi tersimpan:',error)}
}
async function deleteTransaction(id){if(!confirm('Hapus transaksi ini? Tindakan ini tidak dapat dibatalkan.'))return;try{await api(`/api/transactions/${id}`,{method:'DELETE'});await loadTransactions();toast('Transaksi dihapus.')}catch(e){toast(e.message,true)}}

function navigate(page){state.page=page;$$('.page').forEach(x=>x.classList.toggle('active',x.id===`${page}Page`));$$('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('.sidebar').classList.remove('open');scrollTo(0,0);if(page==='dashboard')setTimeout(renderDashboard,20)}
function applyTheme(theme){document.body.classList.toggle('dark',theme==='dark');localStorage.setItem('cashly_theme',theme);$('#themeBtn').textContent=theme==='dark'?'☀':'☾';if($('#mobileTheme'))$('#mobileTheme').firstChild.textContent=theme==='dark'?'☀':'☾'}
function toggleTheme(){applyTheme(document.body.classList.contains('dark')?'light':'dark');renderDashboard()}
function logout(){localStorage.removeItem('cashly_token');state.token=null;state.user=null;showAuth()}

function setAuthMode(mode){
  state.authMode=mode;
  const register=mode==='register',forgot=mode==='forgot',reset=mode==='reset';
  $('#nameField').classList.toggle('hidden',!register);
  $('#emailInput').closest('label').classList.toggle('hidden',reset);
  $('#passwordField').classList.toggle('hidden',forgot);
  $('#confirmPasswordField').classList.toggle('hidden',!reset);
  $('#forgotPassword').classList.toggle('hidden',mode!=='login');
  $('#demoLogin').classList.toggle('hidden',forgot||reset);
  const content={
    login:['Selamat datang kembali','Masuk untuk melanjutkan perjalanan finansialmu.','Masuk ke Cashly','Belum punya akun?','Daftar gratis'],
    register:['Mulai perjalananmu','Buat akun dan kenali pola keuanganmu.','Buat akun gratis','Sudah punya akun?','Masuk'],
    forgot:['Lupa password','Masukkan email akunmu untuk membuat tautan reset.','Buat tautan reset','Ingat password?','Masuk'],
    reset:['Buat password baru','Gunakan minimal 8 karakter dan jangan pakai password lama.','Simpan password baru','Kembali ke halaman','Masuk'],
  }[mode];
  $('#authTitle').textContent=content[0];$('#authSubtitle').textContent=content[1];$('#authButtonText').textContent=content[2];
  $('#switchPrompt').textContent=content[3];$('#switchAuth').textContent=content[4];
  $('#passwordInput').autocomplete=mode==='login'?'current-password':'new-password';
}

const onboarding=[['🌿','Selamat datang di Cashly','Uangmu punya cerita. Kami membantumu melihatnya dengan cara yang sederhana.'],['☕','Uang kerja & sehari-hari','Gaji, makan, tagihan, dan kebutuhan rutin masuk ke aktivitas operasi.'],['◆','Investasi & aset','Pembelian atau penjualan aset membantu kamu melihat uang yang bekerja untuk masa depan.'],['♢','Utang & modal','Pinjaman, cicilan, dan modal dipisahkan agar sumber dan kewajiban uangmu selalu jelas.']];let onboardingIndex=0;
function openOnboarding(){onboardingIndex=0;$('#onboardingModal').classList.add('open');renderOnboarding()}
function renderOnboarding(){const x=onboarding[onboardingIndex];$('#onboardingVisual').textContent=x[0];$('#onboardingStep').textContent=`LANGKAH ${onboardingIndex+1} DARI 4`;$('#onboardingTitle').textContent=x[1];$('#onboardingText').textContent=x[2];$('#onboardingNext').textContent=onboardingIndex===3?'Mulai mencatat →':'Lanjut →';$('#onboardingDots').innerHTML=onboarding.map((_,i)=>`<i class="${i===onboardingIndex?'active':''}"></i>`).join('')}
async function finishOnboarding(){try{state.user=await api('/api/me/onboarding',{method:'PATCH',body:'{}'});}catch{}$('#onboardingModal').classList.remove('open')}

function bindEvents(){
  setAuthMode(state.authMode);
  $('#authForm').addEventListener('submit',async e=>{
    e.preventDefault();
    try{
      if(state.authMode==='forgot'){
        const data=await api('/api/auth/forgot-password',{method:'POST',body:JSON.stringify({email:$('#emailInput').value})});
        if(data.resetToken){state.resetToken=data.resetToken;history.replaceState({},'',`?resetToken=${data.resetToken}`);setAuthMode('reset');toast('Tautan dibuat. Silakan tentukan password baru.')}else{toast(data.message);setAuthMode('login')}
        return;
      }
      if(state.authMode==='reset'){
        if($('#passwordInput').value!==$('#confirmPasswordInput').value)throw new Error('Konfirmasi password tidak sama.');
        const data=await api('/api/auth/reset-password',{method:'POST',body:JSON.stringify({token:state.resetToken,password:$('#passwordInput').value})});
        history.replaceState({},'',location.pathname);$('#passwordInput').value='';$('#confirmPasswordInput').value='';setAuthMode('login');toast(data.message);return;
      }
      const payload={email:$('#emailInput').value,password:$('#passwordInput').value};if(state.authMode==='register')payload.name=$('#nameInput').value;
      const data=await api(`/api/auth/${state.authMode}`,{method:'POST',body:JSON.stringify(payload)});state.token=data.token;state.user=data.user;localStorage.setItem('cashly_token',data.token);await enterApp();
    }catch(e){toast(e.message,true)}
  });
  $('#switchAuth').onclick=()=>setAuthMode(state.authMode==='login'?'register':'login');
  $('#forgotPassword').onclick=()=>setAuthMode('forgot');
  $('#demoLogin').onclick=async()=>{try{let data;try{data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:'demo@cashly.id',password:'democashly'})})}catch{data=await api('/api/auth/register',{method:'POST',body:JSON.stringify({name:'Rani',email:'demo@cashly.id',password:'democashly'})})}state.token=data.token;state.user=data.user;localStorage.setItem('cashly_token',data.token);await enterApp()}catch(e){toast(e.message,true)}};
  $('#logoutBtn').onclick=logout;$('#themeBtn').onclick=toggleTheme;$('#mobileTheme').onclick=toggleTheme;$('#mobileMenu').onclick=()=>$('.sidebar').classList.toggle('open');
  $$('[data-page]').forEach(x=>x.onclick=()=>navigate(x.dataset.page));$$('[data-goto]').forEach(x=>x.onclick=()=>navigate(x.dataset.goto));$$('.add-trigger').forEach(x=>x.onclick=()=>openTransaction());$('#topAddBtn').onclick=()=>openTransaction();
  $$('[data-close-modal]').forEach(x=>x.onclick=closeTransaction);$$('.direction-toggle button').forEach(x=>x.onclick=()=>{
    const previous=$('#directionInput').value;
    $('#directionInput').value=x.dataset.direction;
    if(previous!==x.dataset.direction&&x.dataset.direction==='masuk') $('#purposeInput').value='operasi_kerja';
    if(previous!==x.dataset.direction&&x.dataset.direction==='keluar'&&$('#purposeInput').value==='operasi_kerja') $('#purposeInput').value='operasi_keseharian';
    updateDirection();
  });$('#purposeInput').onchange=()=>updateCategories();$('#transactionForm').onsubmit=saveTransaction;
  $('#amountInput').oninput=e=>{const n=e.target.value.replace(/\D/g,'').slice(0,12);e.target.value=n?new Intl.NumberFormat('id-ID').format(n):''};
  $('#periodSelect').onchange=e=>{state.period=e.target.value;renderDashboard()};$('#reportPeriod').onchange=renderReport;$('#printReportBtn').onclick=printReport;['searchInput','typeFilter','directionFilter'].forEach(id=>$('#'+id).addEventListener(id==='searchInput'?'input':'change',renderTransactions));
  document.addEventListener('click',e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit)openTransaction(state.transactions.find(t=>t.id===edit.dataset.edit));if(del)deleteTransaction(del.dataset.delete)});
  $('#eyeBtn').onclick=()=>{state.balanceVisible=!state.balanceVisible;updateBalanceVisibility()};window.addEventListener('resize',()=>{if(state.user&&state.page==='dashboard')renderDashboard()});
  $('#onboardingNext').onclick=()=>{if(onboardingIndex<3){onboardingIndex++;renderOnboarding()}else finishOnboarding()};$('#onboardingSkip').onclick=finishOnboarding;
}
init();

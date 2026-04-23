'use strict';

// ── State ────────────────────────────────────────────────
const API = '/api';
let token    = localStorage.getItem('wh_token')    || '';
let username = localStorage.getItem('wh_username') || '';
let role     = localStorage.getItem('wh_role')     || 'worker';
let products = [];
let transactions = [];
let activityAll  = [];
let activityFilter = 'all';
let productFilter = 'all';
let historyFilter = 'all';
let saleProduct   = null;
let saleSize      = null;
let incomeProdId  = null;
let incomeCategory = null;
let storeName = 'Мағоза';
let storeSub  = 'Сару либос ва пойафзол';
let charts = {};
let dashProfit = {};

const SHOE_SIZES     = ['35','36','37','38','39','40','41','42','43','44','45','46'];
const CLOTHING_SIZES = ['XS','S','M','L','XL','XXL','XXXL'];

// ── Форматҳои пул ────────────────────────────────────────
function fmt(n) {
  return Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtC(n) {
  return fmt(n) + ' смн';
}

// ── API Helper ───────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': token } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) { doLogout(); return null; }
    throw new Error(data.error || 'Server error');
  }
  return data;
}

// ── Toast ────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-out');
    el.addEventListener('animationend', () => el.remove());
  }, 3200);
}

// ── Auth ─────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  setLoading('login-btn', 'login-label', 'login-spinner', true);
  try {
    const res = await fetch(API + '/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username: u, password: p})
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Хатогӣ');
    saveSession(json.token, json.username, json.role || 'worker');
    initApp();
  } catch(err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    setLoading('login-btn', 'login-label', 'login-spinner', false);
  }
});

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const u  = document.getElementById('reg-username').value.trim();
  const p  = document.getElementById('reg-password').value;
  const p2 = document.getElementById('reg-password2').value;
  const errEl = document.getElementById('reg-error');
  errEl.classList.add('hidden');
  if (p !== p2) { errEl.textContent = 'Пароль ҳо якхел нестанд'; errEl.classList.remove('hidden'); return; }
  setLoading('reg-btn', 'reg-label', 'reg-spinner', true);
  try {
    const res = await fetch(API + '/register', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username: u, password: p})
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Хатогӣ');
    saveSession(json.token, json.username, json.role || 'worker');
    initApp();
  } catch(err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    setLoading('reg-btn', 'reg-label', 'reg-spinner', false);
  }
});

function setLoading(btnId, labelId, spinnerId, loading) {
  document.getElementById(btnId).disabled = loading;
  document.getElementById(labelId).classList.toggle('hidden', loading);
  document.getElementById(spinnerId).classList.toggle('hidden', !loading);
}

function saveSession(tok, uname, userRole) {
  token = tok; username = uname; role = userRole || 'worker';
  localStorage.setItem('wh_token', tok);
  localStorage.setItem('wh_username', uname);
  localStorage.setItem('wh_role', role);
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('POST', '/logout').catch(() => {});
  doLogout();
});

function doLogout() {
  token = ''; username = ''; role = 'worker';
  localStorage.removeItem('wh_token');
  localStorage.removeItem('wh_username');
  localStorage.removeItem('wh_role');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
}

function applyRoleUI() {
  const isAdmin = role === 'admin';
  // admin nav — only visible to admin
  const adminNav = document.querySelector('[data-section="admin"]');
  if (adminNav) adminNav.classList.toggle('hidden', !isAdmin);
  // delete product buttons — only for admin (re-rendered dynamically)
  document.querySelectorAll('.pc-delete-btn').forEach(b => b.classList.toggle('hidden', !isAdmin));
  // role badge in topbar
  let badge = document.getElementById('role-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'role-badge';
    badge.className = 'role-badge';
    document.getElementById('user-name').after(badge);
  }
  badge.textContent = isAdmin ? '👑 Admin' : '👷 Worker';
  badge.className   = 'role-badge ' + (isAdmin ? 'role-admin' : 'role-worker');
}

// ── Navigation ───────────────────────────────────────────
const sectionTitles = {
  dashboard: 'Дашборд', sale: '🛒 Фурӯш', income: '📥 Даромади мол',
  history: '📋 Таърих', products: '📦 Маҳсулотҳо',
  'add-product': '➕ Маҳсулоти нав', profile: '📊 Профил',
  debts: '💳 Карзҳо', expenses: '💸 Харочот', reports: '📈 Ҳисобот',
  settings: '⚙️ Танзимот', admin: '🛠️ Идора'
};

function go(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById(section);
  if (el) el.classList.add('active');
  document.querySelector(`[data-section="${section}"]`)?.classList.add('active');
  document.getElementById('page-title').textContent = sectionTitles[section] || section;
  document.getElementById('sidebar').classList.remove('open');
  if (section === 'history')  loadTransactions();
  if (section === 'reports')  loadReports();
  if (section === 'admin')    loadAdminData();
  if (section === 'products') renderProducts();
  if (section === 'income')   loadIncomeHistory();
  if (section === 'profile')  loadProfile();
  if (section === 'expenses') loadExpenses('all');
  if (section === 'debts')    loadDebts();
  if (section === 'settings') loadSettingsForm();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => { e.preventDefault(); go(item.dataset.section); });
});

document.getElementById('burger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.addEventListener('click', e => {
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target.id !== 'burger')
    sidebar.classList.remove('open');
});

// ── App Init ─────────────────────────────────────────────
function initApp() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-name').textContent = username;
  document.getElementById('user-avatar').textContent = (username[0] || '?').toUpperCase();
  applyRoleUI();
  loadAll();
}

async function loadAll() {
  await Promise.all([loadProductsData(), loadStoreName()]);
  loadDashboard();
}

async function loadProductsData() {
  try { products = await api('GET', '/products') || []; } catch(e) { products = []; }
}

// ── Store Name ───────────────────────────────────────────
async function loadStoreName() {
  try {
    const s = await api('GET', '/settings') || {};
    if (s.storeName) storeName = s.storeName;
    if (s.storeSub)  storeSub  = s.storeSub;
    applyStoreName();
  } catch(e) {}
}

function applyStoreName() {
  document.title = storeName;
  const brandName = document.querySelector('.brand-name');
  const brandVer  = document.querySelector('.brand-ver');
  if (brandName) brandName.textContent = storeName;
  if (brandVer)  brandVer.textContent  = storeSub;
  const logo   = document.getElementById('profile-store-logo');
  const nameEl = document.getElementById('profile-store-name');
  const subEl  = document.getElementById('profile-store-sub');
  if (logo)   logo.textContent   = (storeName[0] || 'М').toUpperCase();
  if (nameEl) nameEl.textContent = storeName;
  if (subEl)  subEl.textContent  = storeSub;
}

// ── Dashboard ────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [stats, summary, profit] = await Promise.all([
      api('GET', '/stats'),
      api('GET', '/transactions/summary'),
      api('GET', '/profit'),
    ]);
    if (!stats || !summary) return;
    document.getElementById('stat-count').textContent      = stats.productCount || 0;
    document.getElementById('stat-value').textContent      = fmtC(stats.totalValue || 0);
    document.getElementById('stat-today-out').textContent  = fmtC(summary.todayOut || 0);
    document.getElementById('stat-total-out').textContent  = fmtC(summary.totalOut || 0);

    const lowSection = document.getElementById('low-stock-section');
    if (stats.lowStock && stats.lowStock.length > 0) {
      lowSection.classList.remove('hidden');
      document.getElementById('low-stock-count').textContent = stats.lowStock.length;
      document.getElementById('low-stock-list').innerHTML = stats.lowStock.map(li =>
        `<div class="low-stock-item" onclick="go('sale')">
          <span class="ls-code">${li.productCode}</span>
          <span class="ls-name">${li.productName}</span>
          <span class="ls-size">/ ${li.size}</span>
          <span class="ls-qty">${li.quantity} дона</span>
        </div>`).join('');
    } else { lowSection.classList.add('hidden'); }

    if (profit) {
      dashProfit = profit;
      setProfitCard('today', profit.todayProfit, profit.todayRevenue, profit.todayCost);
      setProfitCard('month', profit.monthProfit, profit.monthRevenue, profit.monthCost);
      setProfitCard('total', profit.totalProfit, profit.totalRevenue, profit.totalCost);
    }

    const expData = await api('GET', '/expenses?filter=today').catch(() => null);
    if (expData) {
      document.getElementById('dash-exp-today').textContent     = fmtC(expData.todayTotal || 0);
      document.getElementById('dash-exp-month-lbl').textContent = 'Ин моҳ: ' + fmtC(expData.monthTotal || 0);
    }

    const txList = await api('GET', '/transactions') || [];
    renderTxTable('dash-tx-tbody', txList.slice(0, 10), 9);
  } catch(e) { console.error(e); }
}

function setProfitCard(key, profit, rev, cost) {
  const valEl = document.getElementById(`profit-${key}`);
  if (!valEl) return;
  valEl.textContent = (profit >= 0 ? '+' : '') + fmtC(profit);
  valEl.className = 'profit-val' + (profit < 0 ? ' negative' : '');
  const revEl  = document.getElementById(`profit-${key}-rev`);
  const costEl = document.getElementById(`profit-${key}-cost`);
  if (revEl)  revEl.textContent  = 'Фурӯш: ' + fmtC(rev);
  if (costEl) costEl.textContent = 'Харид: ' + fmtC(cost);
}

function renderTxTable(tbodyId, list, cols) {
  const tbody = document.getElementById(tbodyId);
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-cell">Амалиёт нест</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(t => {
    const total = (t.quantity * t.price).toFixed(2);
    const badge = t.type === 'in'
      ? `<span class="tx-badge tx-in">📥 Даромад</span>`
      : `<span class="tx-badge tx-out">🛒 Фурӯш</span>`;
    const date = fmtDate(t.createdAt);
    if (cols === 9) return `<tr>
      <td>${badge}</td><td class="code-cell">${t.productCode}</td><td>${t.productName}</td>
      <td><strong>${t.size}</strong></td><td>${t.quantity}</td>
      <td>${fmt(t.price)} смн</td><td>${fmt(total)} смн</td>
      <td>${t.createdBy}</td><td style="color:var(--text3);font-size:11px">${date}</td></tr>`;
    return `<tr>
      <td>${badge}</td><td class="code-cell">${t.productCode}</td><td>${t.productName}</td>
      <td><strong>${t.size}</strong></td><td>${t.quantity}</td>
      <td>${fmt(t.price)} смн</td><td>${fmt(total)} смн</td>
      <td style="color:var(--text3)">${t.note || '—'}</td>
      <td>${t.createdBy}</td><td style="color:var(--text3);font-size:11px">${date}</td></tr>`;
  }).join('');
}

// ── Дашборд — клик ба карточкаҳо ─────────────────────────
function showWarehouseDetail() {
  api('GET', '/stats').then(stats => {
    if (!stats) return;
    const cats = (stats.catStats || []).map(c =>
      `<tr><td>${catLabel(c.category)}</td><td>${c.count} намуд</td><td>${c.totalQty} дона</td><td><strong>${fmtC(c.value)}</strong></td></tr>`
    ).join('');
    openDetailModal('💰 Арзиши анбор (нархи харид)', `
      <table class="tbl" style="width:100%">
        <thead><tr><th>Категория</th><th>Намуд</th><th>Ҳаҷм</th><th>Арзиш</th></tr></thead>
        <tbody>${cats || '<tr><td colspan="4" class="empty-cell">Маълумот нест</td></tr>'}</tbody>
      </table>
      <p style="margin-top:.75rem;font-size:12px;color:var(--text3)">* Танҳо молҳое ҳисоб мешаванд ки нархи харид дорад</p>`);
  });
}

function showTodaySalesDetail() {
  api('GET', '/transactions').then(list => {
    const today = new Date().toLocaleDateString('ru-RU');
    const todayList = (list || []).filter(t => t.type === 'out' && fmtDate(t.createdAt).startsWith(today));
    const rows = todayList.map(t =>
      `<tr><td class="code-cell">${t.productCode}</td><td>${t.productName}</td>
       <td>${t.size}</td><td>${t.quantity}</td>
       <td>${fmt(t.price)} смн</td><td><strong>${fmt(t.quantity*t.price)} смн</strong></td>
       <td style="font-size:11px;color:var(--text3)">${fmtDate(t.createdAt).slice(-5)}</td></tr>`).join('');
    const total = todayList.reduce((s, t) => s + t.quantity * t.price, 0);
    openDetailModal('🛒 Фурӯши имрӯз', `
      <div style="margin-bottom:.75rem;font-size:1.1rem;font-weight:700;color:var(--green)">Ҷамъ: ${fmtC(total)}</div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Код</th><th>Маҳсулот</th><th>Р-р</th><th>Ҳ-м</th><th>Нарх</th><th>Ҷамъ</th><th>Вақт</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" class="empty-cell">Фурӯш нест</td></tr>'}</tbody>
      </table></div>`);
  });
}

function showProfitDetail(period) {
  const labels = { today: 'имрӯз', month: 'ин моҳ', total: 'умумӣ' };
  const p = dashProfit;
  const rev  = period === 'today' ? p.todayRevenue  : period === 'month' ? p.monthRevenue  : p.totalRevenue;
  const cost = period === 'today' ? p.todayCost     : period === 'month' ? p.monthCost     : p.totalCost;
  const prof = period === 'today' ? p.todayProfit   : period === 'month' ? p.monthProfit   : p.totalProfit;
  openDetailModal(`💹 Фоида — ${labels[period]}`, `
    <div style="display:grid;gap:.75rem">
      <div style="display:flex;justify-content:space-between;padding:.75rem;background:rgba(34,197,94,.08);border-radius:8px">
        <span>🛒 Фурӯш (бо нарх)</span><strong style="color:var(--green)">${fmtC(rev||0)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:.75rem;background:rgba(239,68,68,.08);border-radius:8px">
        <span>📦 Нархи харид</span><strong style="color:var(--red)">${fmtC(cost||0)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:.75rem;background:rgba(99,102,241,.12);border-radius:8px;font-size:1.1rem">
        <span>💹 Фоидаи холис</span><strong style="color:${(prof||0)>=0?'var(--green)':'var(--red)'}">${fmtC(prof||0)}</strong>
      </div>
      <p style="font-size:12px;color:var(--text3)">* Танҳо молҳои дорои нархи харид ҳисоб мешавад</p>
    </div>`);
}

function openDetailModal(title, html) {
  document.getElementById('detail-modal-title').textContent = title;
  document.getElementById('detail-modal-body').innerHTML = html;
  document.getElementById('detail-modal').classList.remove('hidden');
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.add('hidden');
}

document.getElementById('detail-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('detail-modal')) closeDetailModal();
});

// ── Sale ─────────────────────────────────────────────────
function saleSearch(q) {
  const list = document.getElementById('sale-results');
  q = q.trim().toLowerCase();
  if (!q) { list.innerHTML = ''; return; }
  const results = products.filter(p =>
    p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || (p.brand||'').toLowerCase().includes(q)
  ).slice(0, 15);
  if (results.length === 0) {
    list.innerHTML = '<div style="padding:1rem;color:var(--text3);font-size:13px;text-align:center">Ёфт нашуд</div>';
    return;
  }
  list.innerHTML = results.map(p => {
    const totalQty = p.sizes ? p.sizes.reduce((s, sz) => s + sz.quantity, 0) : 0;
    return `<div class="sale-result-item${saleProduct && saleProduct.id===p.id?' selected':''}"
                 onclick="selectSaleProduct(${p.id})">
      <div class="sri-code">${p.code}</div>
      <div class="sri-name">${p.name}</div>
      <div class="sri-meta">${catLabel(p.category)}${p.brand?' · '+p.brand:''}${p.color?' · '+p.color:''}</div>
      <div class="sri-price">${fmtC(p.price)} · ${totalQty} дона</div>
    </div>`;
  }).join('');
}

function selectSaleProduct(id) {
  saleProduct = products.find(p => p.id === id);
  if (!saleProduct) return;
  saleSize = null;
  document.querySelectorAll('.sale-result-item').forEach(el => el.classList.remove('selected'));
  [...document.querySelectorAll('.sale-result-item')]
    .find(el => el.querySelector('.sri-code')?.textContent === saleProduct.code)?.classList.add('selected');
  document.getElementById('sale-placeholder').classList.add('hidden');
  document.getElementById('sale-product-view').classList.remove('hidden');
  document.getElementById('sale-form').classList.add('hidden');
  document.getElementById('sp-code').textContent = saleProduct.code;
  document.getElementById('sp-cat').className = `cat-badge cat-${saleProduct.category}`;
  document.getElementById('sp-cat').textContent = catLabel(saleProduct.category);
  document.getElementById('sp-name').textContent = saleProduct.name;
  document.getElementById('sp-meta').textContent = [saleProduct.brand, saleProduct.color].filter(Boolean).join(' · ');

  // нархи фурӯши таъйиншуда
  const priceInfo = document.getElementById('sp-price-info');
  const setPriceEl = document.getElementById('sp-set-price');
  if (saleProduct.price > 0) {
    setPriceEl.textContent = fmtC(saleProduct.price);
    priceInfo.classList.remove('hidden');
  } else {
    priceInfo.classList.add('hidden');
  }

  renderSaleGrid(saleProduct.sizes || []);
  document.getElementById('sale-price').value = saleProduct.price.toFixed(2);
  updateSaleTotal();
}

function renderSaleGrid(sizes) {
  const grid = document.getElementById('sp-sizes');
  if (!sizes || sizes.length === 0) {
    grid.innerHTML = '<span style="color:var(--text3);font-size:13px">Размер нест</span>'; return;
  }
  grid.innerHTML = sizes.map(s => {
    const cls = s.quantity === 0 ? 'sz-zero' : s.quantity <= 5 ? 'sz-low' : 'sz-good';
    return `<button type="button" class="size-btn ${cls}" ${s.quantity===0?'disabled':''}
              onclick="selectSaleSize('${s.size}', ${s.quantity})">
      <span class="sb-size">${s.size}</span>
      <span class="sb-qty">${s.quantity}д</span>
    </button>`;
  }).join('');
}

function selectSaleSize(size, availQty) {
  if (availQty === 0) return;
  saleSize = size;
  document.querySelectorAll('#sp-sizes .size-btn').forEach(btn =>
    btn.classList.toggle('selected', btn.querySelector('.sb-size').textContent === size));
  document.getElementById('sale-form').classList.remove('hidden');
  document.getElementById('sp-selected-info').textContent =
    `${saleProduct.name} · Размер ${size} · Дар анбор: ${availQty} дона`;
  document.getElementById('sale-qty').max = availQty;
  document.getElementById('sale-qty').value = 1;
  updateSaleTotal();
}

function updateSaleTotal() {
  const qty   = parseFloat(document.getElementById('sale-qty').value) || 0;
  const price = parseFloat(document.getElementById('sale-price').value) || 0;
  document.getElementById('sale-total-display').textContent = fmtC(qty * price);
}
document.getElementById('sale-qty').addEventListener('input', updateSaleTotal);
document.getElementById('sale-price').addEventListener('input', updateSaleTotal);

document.getElementById('sale-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!saleProduct || !saleSize) { toast('Размерро интихоб кунед', 'error'); return; }
  const qty   = parseInt(document.getElementById('sale-qty').value);
  const price = parseFloat(document.getElementById('sale-price').value);
  const note  = document.getElementById('sale-note').value.trim();
  const btn   = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await api('POST', '/transactions', { product_id: saleProduct.id, size: saleSize, type: 'out', quantity: qty, price, note });
    toast(`✅ Фурӯхта шуд: ${saleProduct.name} р.${saleSize} — ${qty}д`, 'success');
    await loadProductsData();
    const updProd = products.find(p => p.id === saleProduct.id);
    if (updProd) { saleProduct = updProd; renderSaleGrid(updProd.sizes || []); }
    saleSize = null;
    document.getElementById('sale-form').classList.add('hidden');
    loadDashboard();
  } catch(err) { toast(err.message, 'error'); }
  finally { btn.disabled = false; }
});

// ── Income ───────────────────────────────────────────────
function incomeSearch(q) {
  const dropdown = document.getElementById('income-dropdown');
  q = q.trim().toLowerCase();
  if (!q) { dropdown.classList.add('hidden'); return; }
  const results = products.filter(p =>
    p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)).slice(0, 10);
  dropdown.innerHTML = results.length === 0
    ? '<div class="dropdown-item" style="color:var(--text3)">Ёфт нашуд</div>'
    : results.map(p =>
        `<div class="dropdown-item" onclick="selectIncomeProduct(${p.id},'${esc(p.code)}','${esc(p.name)}')">
          <span class="di-code">${p.code}</span><span class="di-name">${p.name}</span>
        </div>`).join('');
  dropdown.classList.remove('hidden');
}

function selectIncomeProduct(id, code, name) {
  incomeProdId = id;
  document.getElementById('income-product-id').value = id;
  document.getElementById('income-search').value = `${code} — ${name}`;
  document.getElementById('income-dropdown').classList.add('hidden');

  const prod = products.find(p => p.id === id);
  incomeCategory = prod ? prod.category : 'other';

  // selected product info box
  document.getElementById('income-prod-name').textContent = name;
  document.getElementById('income-prod-code').textContent = code;
  document.getElementById('income-prod-cat').textContent  = catLabel(incomeCategory);
  document.getElementById('income-selected-box').classList.remove('hidden');
  document.getElementById('income-search').closest('.field-group').classList.add('hidden');

  // нархи фурӯши ҷории маҳсулот
  if (prod && prod.price > 0) {
    document.getElementById('income-sale-price').value = prod.price.toFixed(2);
  }

  // шабакаи размерҳо
  renderIncomeSizeGrid(prod);
  document.getElementById('income-size-grid-section').classList.remove('hidden');
  document.getElementById('income-prices-section').classList.remove('hidden');
  updateIncomeTotal();
}

function resetIncomeForm() {
  incomeProdId = null;
  incomeCategory = null;
  document.getElementById('income-form').reset();
  document.getElementById('income-search').value = '';
  document.getElementById('income-total').textContent = '0.00 смн';
  document.getElementById('income-selected-box').classList.add('hidden');
  document.getElementById('income-search').closest('.field-group').classList.remove('hidden');
  document.getElementById('income-size-grid-section').classList.add('hidden');
  document.getElementById('income-prices-section').classList.add('hidden');
}

function renderIncomeSizeGrid(prod) {
  const grid = document.getElementById('income-size-grid');
  const cat = prod ? prod.category : 'other';
  const sizes = cat === 'shoes' ? SHOE_SIZES : cat === 'clothing' ? CLOTHING_SIZES : ['Ягона'];

  // нақшаи ҳаҷми мавҷуда
  const stockMap = {};
  if (prod && prod.sizes) prod.sizes.forEach(s => { stockMap[s.size] = s.quantity; });

  grid.innerHTML = sizes.map(s => {
    const stock = stockMap[s] || 0;
    return `<div class="ap-size-item income-size-item">
      <label class="ap-size-label">${s}<span class="income-stock-badge">${stock}д</span></label>
      <input type="number" class="ap-size-input" data-size="${s}" value="0" min="0" step="1"
             oninput="updateIncomeTotal()">
    </div>`;
  }).join('');
}

document.addEventListener('click', e => {
  if (!document.getElementById('income-search').contains(e.target) &&
      !document.getElementById('income-dropdown').contains(e.target))
    document.getElementById('income-dropdown').classList.add('hidden');
});

function updateIncomeTotal() {
  const cost   = parseFloat(document.getElementById('income-price').value) || 0;
  let totalQty = 0;
  document.querySelectorAll('#income-size-grid input[data-size]').forEach(inp => {
    totalQty += parseInt(inp.value) || 0;
  });
  document.getElementById('income-total').textContent = fmtC(totalQty * cost);
}
document.getElementById('income-price').addEventListener('input', updateIncomeTotal);

document.getElementById('income-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!incomeProdId) { toast('Маҳсулотро интихоб кунед', 'error'); return; }
  const costPrice = parseFloat(document.getElementById('income-price').value);
  const salePrice = parseFloat(document.getElementById('income-sale-price').value) || 0;
  const note      = document.getElementById('income-note').value.trim();
  if (!costPrice || costPrice <= 0) { toast('Нархи омадро ворид кунед', 'error'); return; }

  // ҷамъ кардани ҳамаи размерҳои дорои ҳаҷм
  const sizesToSubmit = [];
  document.querySelectorAll('#income-size-grid input[data-size]').forEach(inp => {
    const qty = parseInt(inp.value) || 0;
    if (qty > 0) sizesToSubmit.push({ size: inp.dataset.size, qty });
  });

  if (sizesToSubmit.length === 0) { toast('Ҳаҷми ҳадди аққал як размерро ворид кунед', 'error'); return; }

  const btn = document.getElementById('income-btn');
  btn.disabled = true;
  try {
    for (const s of sizesToSubmit) {
      await api('POST', '/transactions', {
        product_id: incomeProdId, size: s.size, type: 'in',
        quantity: s.qty, price: costPrice, sale_price: salePrice, note
      });
    }
    toast(`📥 ${sizesToSubmit.length} размер дохил карда шуд`, 'success');
    resetIncomeForm();
    await loadProductsData();
    loadIncomeHistory();
    loadDashboard();
  } catch(err) { toast(err.message, 'error'); }
  finally { btn.disabled = false; }
});

async function loadIncomeHistory() {
  try {
    const list = await api('GET', '/transactions?type=in') || [];
    const tbody = document.getElementById('income-tbody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">Даромад нест</td></tr>'; return; }
    tbody.innerHTML = list.slice(0,50).map(t => `<tr>
      <td class="code-cell">${t.productCode}</td><td>${t.productName}</td>
      <td><strong>${t.size}</strong></td><td>${t.quantity}</td>
      <td>${fmt(t.price)} смн</td><td>${fmt(t.quantity*t.price)} смн</td>
      <td style="color:var(--text3)">${t.note||'—'}</td>
      <td style="color:var(--text3);font-size:11px">${fmtDate(t.createdAt)}</td></tr>`).join('');
  } catch(e) {}
}

// ── History ──────────────────────────────────────────────
async function loadTransactions() {
  try {
    const q = historyFilter === 'all' ? '' : `?type=${historyFilter}`;
    transactions = await api('GET', '/transactions' + q) || [];
    renderTxTable('history-tbody', transactions, 10);
  } catch(e) {}
}

function filterHistory(type, btn) {
  historyFilter = type;
  document.querySelectorAll('#history .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadTransactions();
}

// ── Products ─────────────────────────────────────────────
function filterProducts(cat, btn) {
  productFilter = cat;
  document.querySelectorAll('#products .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts();
}

function renderProducts() {
  const q    = (document.getElementById('prod-search').value || '').toLowerCase();
  const grid = document.getElementById('products-grid');
  let list = products;
  if (productFilter !== 'all') list = list.filter(p => p.category === productFilter);
  if (q) list = list.filter(p =>
    p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || (p.brand||'').toLowerCase().includes(q));
  if (list.length === 0) {
    grid.innerHTML = '<p class="empty-cell" style="text-align:center;padding:3rem">Маҳсулот нест</p>'; return;
  }
  grid.innerHTML = list.map(p => {
    const totalQty = p.sizes ? p.sizes.reduce((s, sz) => s + sz.quantity, 0) : 0;
    const sizeTags = (p.sizes||[]).map(s => {
      const cls = s.quantity===0?'pst-zero':s.quantity<=5?'pst-low':'pst-good';
      return `<span class="pc-size-tag ${cls}">${s.size}:${s.quantity}</span>`;
    }).join('');
    const delBtn = role === 'admin'
      ? `<button class="pc-delete-btn" onclick="event.stopPropagation();deleteProduct(${p.id},'${esc(p.name)}')" title="Нест кардан">🗑</button>`
      : '';
    return `<div class="product-card pc-${p.category}" onclick="openEditModal(${p.id})">
      <div class="pc-header">
        <span class="pc-code">${p.code}</span>
        <div style="display:flex;gap:.3rem">
          <button class="pc-edit-btn" onclick="event.stopPropagation();openEditModal(${p.id})">✏️</button>
          ${delBtn}
        </div>
      </div>
      <div class="pc-name">${p.name}${p.color?`<span class="pc-color">· ${p.color}</span>`:''}</div>
      <div class="pc-brand">${p.brand||'&nbsp;'}</div>
      <div class="pc-prices">
        <div class="pc-price-row">
          <span class="pc-price-lbl">Фурӯш</span>
          <span class="pc-price pc-price-sell">${fmtC(p.price)}</span>
        </div>
        ${p.costPrice > 0 ? `<div class="pc-price-row">
          <span class="pc-price-lbl">Омад</span>
          <span class="pc-price pc-price-cost">${fmtC(p.costPrice)}</span>
        </div>` : ''}
      </div>
      <div class="pc-sizes">${sizeTags||'<span style="color:var(--text3);font-size:11px">Размер нест</span>'}</div>
      <div class="pc-footer"><span>${catLabel(p.category)}</span><span class="pc-total-qty">${totalQty} дона</span></div>
    </div>`;
  }).join('');
}

// ── Add Product ──────────────────────────────────────────
function onCategoryChange() {
  const cat     = document.getElementById('ap-category').value;
  const section = document.getElementById('ap-sizes-section');
  const grid    = document.getElementById('ap-sizes-grid');
  if (!cat) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  renderSizeInputGrid(grid, cat, []);
}

function renderSizeInputGrid(container, category, currentSizes) {
  const sizes = category === 'shoes' ? SHOE_SIZES : category === 'clothing' ? CLOTHING_SIZES : ['Ягона'];
  const qtyMap = {};
  (currentSizes||[]).forEach(s => { qtyMap[s.size] = s.quantity; });
  container.innerHTML = sizes.map(s =>
    `<div class="ap-size-item">
      <label class="ap-size-label">${s}</label>
      <input type="number" class="ap-size-input" data-size="${s}" value="${qtyMap[s]||0}" min="0" step="1">
    </div>`).join('');
}

function collectSizes(container) {
  const sizes = [];
  container.querySelectorAll('input[data-size]').forEach(inp => {
    if (inp.dataset.size) sizes.push({ size: inp.dataset.size, quantity: parseInt(inp.value)||0 });
  });
  return sizes;
}

function genCode() {
  const cat = document.getElementById('ap-category').value || 'other';
  const prefix = { shoes: 'PF', clothing: 'LB', other: 'DG' }[cat] || 'XX';
  document.getElementById('ap-code').value = prefix + '-' + Math.floor(Math.random() * 90000 + 10000);
}

document.getElementById('add-product-form').addEventListener('submit', async e => {
  e.preventDefault();
  const cat   = document.getElementById('ap-category').value;
  const code  = document.getElementById('ap-code').value.trim();
  const name  = document.getElementById('ap-name').value.trim();
  const brand = document.getElementById('ap-brand').value.trim();
  const color = document.getElementById('ap-color').value.trim();
  const price = parseFloat(document.getElementById('ap-price').value);
  const sizes = collectSizes(document.getElementById('ap-sizes-grid'));
  const btn   = document.getElementById('ap-submit');
  btn.disabled = true;
  try {
    const res = await api('POST', '/products', { code, name, category: cat, brand, color, price, sizes });
    toast(`✅ Маҳсулот илова шуд: ${name} (${res.code})`, 'success');
    document.getElementById('add-product-form').reset();
    document.getElementById('ap-sizes-section').classList.add('hidden');
    await loadProductsData();
  } catch(err) { toast(err.message, 'error'); }
  finally { btn.disabled = false; }
});

// ── Edit Product Modal ───────────────────────────────────
function openEditModal(id) {
  const p = products.find(pr => pr.id === id);
  if (!p) return;
  document.getElementById('ep-id').value       = p.id;
  document.getElementById('ep-category').value = p.category;
  document.getElementById('ep-code').value     = p.code;
  document.getElementById('ep-name').value     = p.name;
  document.getElementById('ep-brand').value    = p.brand || '';
  document.getElementById('ep-color').value    = p.color || '';
  document.getElementById('ep-price').value    = p.price;
  renderSizeInputGrid(document.getElementById('ep-sizes-grid'), p.category, p.sizes||[]);
  document.getElementById('product-modal').classList.remove('hidden');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('product-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('product-modal')) closeModal();
});
function closeModal() { document.getElementById('product-modal').classList.add('hidden'); }

document.getElementById('edit-product-form').addEventListener('submit', async e => {
  e.preventDefault();
  const id    = document.getElementById('ep-id').value;
  const cat   = document.getElementById('ep-category').value;
  const code  = document.getElementById('ep-code').value.trim();
  const name  = document.getElementById('ep-name').value.trim();
  const brand = document.getElementById('ep-brand').value.trim();
  const color = document.getElementById('ep-color').value.trim();
  const price = parseFloat(document.getElementById('ep-price').value);
  const sizes = collectSizes(document.getElementById('ep-sizes-grid'));
  try {
    await api('PUT', `/products/${id}`, { code, name, category: cat, brand, color, price, sizes });
    toast('✅ Маҳсулот навсозӣ шуд', 'success');
    closeModal();
    await loadProductsData();
    renderProducts();
  } catch(err) { toast(err.message, 'error'); }
});

document.getElementById('ep-delete-btn').addEventListener('click', async () => {
  const id   = document.getElementById('ep-id').value;
  const name = document.getElementById('ep-name').value;
  if (!confirm(`"${name}" маҳсулотро нест кунед?`)) return;
  try {
    await api('DELETE', `/products/${id}`);
    toast('🗑️ Маҳсулот нест шуд', 'info');
    closeModal(); await loadProductsData(); renderProducts();
  } catch(err) { toast(err.message, 'error'); }
});

document.getElementById('ep-category').addEventListener('change', () => {
  const cat = document.getElementById('ep-category').value;
  const id  = parseInt(document.getElementById('ep-id').value);
  const p   = products.find(pr => pr.id === id);
  renderSizeInputGrid(document.getElementById('ep-sizes-grid'), cat, p ? p.sizes : []);
});

// ── Profile ──────────────────────────────────────────────
async function loadProfile() {
  try {
    const [prof, debts] = await Promise.all([api('GET', '/profile'), api('GET', '/debts')]);
    if (prof) {
      document.getElementById('prof-month-in').textContent  = fmtC(prof.monthIn||0);
      document.getElementById('prof-month-out').textContent = fmtC(prof.monthOut||0);
      document.getElementById('prof-month-tx').textContent  = prof.monthTxCount||0;
      document.getElementById('prof-debt-rem').textContent  = fmtC(prof.totalRemaining||0);
    }
    const listEl = document.getElementById('profile-debts-list');
    const active = (debts||[]).filter(d => d.remaining > 0.001);
    if (active.length === 0) {
      listEl.innerHTML = '<p class="empty-cell">Карзи фаъол нест</p>';
    } else {
      listEl.innerHTML = active.map(d =>
        `<div class="debt-profile-item">
          <span class="dpi-name">${d.customerName}</span>
          ${d.phone ? `<span style="font-size:12px;color:var(--blue)">📞 ${d.phone}</span>` : ''}
          <span style="font-size:12px;color:var(--text3)">${d.note||''}</span>
          <span class="dpi-rem">${fmtC(d.remaining)}</span>
          <button class="btn btn-success" style="padding:.3rem .7rem;font-size:11px"
                  onclick="openPayModal(${d.id},'${esc(d.customerName)}',${d.remaining})">Пардохт</button>
        </div>`).join('');
    }
    applyStoreName();
  } catch(e) { console.error(e); }
}

// ── Expenses ──────────────────────────────────────────────
const EXP_CATS = {
  rent: '🏠 Иҷора', salary: '👤 Маош', transport: '🚚 Нақлиёт',
  utilities: '💡 Коммуналӣ', food: '🍽️ Хӯрок', other: '📌 Дигар'
};

async function loadExpenses(filter) {
  try {
    const data = await api('GET', `/expenses?filter=${filter}`);
    if (!data) return;

    document.getElementById('exp-today-total').textContent = fmtC(data.todayTotal || 0);
    document.getElementById('exp-month-total').textContent = fmtC(data.monthTotal || 0);
    document.getElementById('exp-count').textContent = data.items.length;

    const list = document.getElementById('expenses-list');
    if (!data.items.length) {
      list.innerHTML = '<p class="empty-cell">Харочот нест</p>';
      return;
    }
    list.innerHTML = data.items.map(e => `
      <div class="exp-item">
        <div class="exp-item-left">
          <span class="exp-cat">${EXP_CATS[e.category] || e.category}</span>
          <span class="exp-note">${e.note || ''}</span>
          <span class="exp-date">${e.created_at.slice(0,16).replace('T',' ')}</span>
        </div>
        <div class="exp-item-right">
          <span class="exp-amount">${fmtC(e.amount)}</span>
          <button class="btn-icon-del" onclick="deleteExpense(${e.id})" title="Нест кардан">🗑</button>
        </div>
      </div>`).join('');
  } catch(e) { console.error(e); }
}

function filterExpenses(filter, btn) {
  document.querySelectorAll('#expenses .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadExpenses(filter);
}

document.getElementById('expense-form').addEventListener('submit', async e => {
  e.preventDefault();
  const amount   = parseFloat(document.getElementById('exp-amount').value);
  const category = document.getElementById('exp-category').value;
  const note     = document.getElementById('exp-note').value.trim();
  if (!amount || amount <= 0) return;
  const btn = document.getElementById('exp-btn');
  btn.disabled = true;
  try {
    await api('POST', '/expenses', { amount, category, note });
    toast('💸 Харочот сабт шуд', 'success');
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-note').value   = '';
    document.getElementById('exp-category').value = 'other';
    loadExpenses('all');
    loadDashboard();
  } catch(err) {
    toast(err.message, 'error');
  } finally { btn.disabled = false; }
});

async function deleteExpense(id) {
  if (!confirm('Ин харочотро нест кунед?')) return;
  await api('DELETE', `/expenses/${id}`);
  loadExpenses('all');
  loadDashboard();
}

// ── Debts ─────────────────────────────────────────────────
async function loadDebts() {
  try {
    const list = await api('GET', '/debts') || [];
    document.getElementById('debts-count').textContent = list.filter(d => d.remaining > 0.001).length;
    const el = document.getElementById('debts-list');
    if (list.length === 0) { el.innerHTML = '<p class="empty-cell">Карз нест</p>'; return; }
    el.innerHTML = list.map(d => {
      const paid = d.remaining <= 0.001;
      const remTxt = paid ? 'Пардохта шуд ✅' : fmtC(d.remaining);
      return `<div class="debt-card${paid?' paid':''}">
        <div class="dc-name">${d.customerName}</div>
        ${d.phone ? `<div class="dc-phone">📞 <a href="tel:${d.phone}">${d.phone}</a></div>` : ''}
        <div class="dc-amount">Умумӣ: ${fmtC(d.amount)}</div>
        <div class="dc-remaining${paid?' zero':''}">${remTxt}</div>
        <div class="dc-actions">
          ${!paid?`<button class="btn btn-success" style="padding:.35rem .7rem;font-size:12px"
            onclick="openPayModal(${d.id},'${esc(d.customerName)}',${d.remaining})">💰 Пардохт</button>`:''}
          <button class="btn btn-danger" style="padding:.35rem .6rem;font-size:12px"
                  onclick="removeDebt(${d.id})">🗑️</button>
        </div>
        ${d.note?`<div class="dc-note">📝 ${d.note}</div>`:''}
        <div class="dc-date">${fmtDate(d.createdAt)} · ${d.createdBy}</div>
      </div>`;
    }).join('');
  } catch(e) { console.error(e); }
}

document.getElementById('debt-form').addEventListener('submit', async e => {
  e.preventDefault();
  const customer = document.getElementById('debt-customer').value.trim();
  const phone    = document.getElementById('debt-phone').value.trim();
  const amount   = parseFloat(document.getElementById('debt-amount').value);
  const note     = document.getElementById('debt-note').value.trim();
  const btn = document.getElementById('debt-btn');
  btn.disabled = true;
  try {
    await api('POST', '/debts', { customerName: customer, phone, amount, note });
    toast(`💳 Карзи ${customer} — ${fmtC(amount)} сабт шуд`, 'info');
    document.getElementById('debt-form').reset();
    loadDebts();
  } catch(err) { toast(err.message, 'error'); }
  finally { btn.disabled = false; }
});

async function removeDebt(id) {
  if (!confirm('Ин карзро пурра нест кунед?')) return;
  try {
    await api('DELETE', `/debts/${id}`);
    toast('Карз нест шуд', 'info');
    loadDebts();
  } catch(e) { toast(e.message, 'error'); }
}

function openPayModal(id, name, remaining) {
  document.getElementById('pay-debt-id').value = id;
  document.getElementById('pay-amount').value  = '';
  document.getElementById('pay-note').value    = '';
  document.getElementById('pay-debt-info').textContent = `${name} — Боқимонда: ${fmtC(remaining)}`;
  document.getElementById('pay-amount').max = remaining;
  document.getElementById('pay-modal').classList.remove('hidden');
}

document.getElementById('pay-modal-close').addEventListener('click', () =>
  document.getElementById('pay-modal').classList.add('hidden'));
document.getElementById('pay-cancel-btn').addEventListener('click', () =>
  document.getElementById('pay-modal').classList.add('hidden'));
document.getElementById('pay-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('pay-modal'))
    document.getElementById('pay-modal').classList.add('hidden');
});

document.getElementById('pay-form').addEventListener('submit', async e => {
  e.preventDefault();
  const id     = document.getElementById('pay-debt-id').value;
  const amount = parseFloat(document.getElementById('pay-amount').value);
  const note   = document.getElementById('pay-note').value.trim();
  try {
    const res = await api('POST', `/debts/${id}/pay`, { amount, note });
    toast(`✅ Пардохт қабул шуд. Боқимонда: ${fmtC(res?.remaining||0)}`, 'success');
    document.getElementById('pay-modal').classList.add('hidden');
    loadDebts(); loadProfile();
  } catch(err) { toast(err.message, 'error'); }
});

// ── Settings ──────────────────────────────────────────────
async function loadSettingsForm() {
  try {
    const s = await api('GET', '/settings') || {};
    document.getElementById('set-store-name').value = s.storeName || storeName;
    document.getElementById('set-store-sub').value  = s.storeSub  || storeSub;
  } catch(e) {}
}

document.getElementById('settings-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('set-store-name').value.trim();
  const sub  = document.getElementById('set-store-sub').value.trim();
  try {
    await api('PUT', '/settings', { storeName: name, storeSub: sub });
    if (name) storeName = name;
    if (sub)  storeSub  = sub;
    applyStoreName();
    toast('✅ Танзимот сабт шуд', 'success');
  } catch(err) { toast(err.message, 'error'); }
});

// ── Reports ───────────────────────────────────────────────
async function loadReports() {
  try {
    const [stats, summary] = await Promise.all([api('GET', '/stats'), api('GET', '/transactions/summary')]);
    if (!stats) return;

    if (summary) {
      document.getElementById('rep-total-in').textContent  = fmtC(summary.totalIn  || 0);
      document.getElementById('rep-total-out').textContent = fmtC(summary.totalOut || 0);
      document.getElementById('rep-today-in').textContent  = fmtC(summary.todayIn  || 0);
      document.getElementById('rep-today-out').textContent = fmtC(summary.todayOut || 0);
    }

    renderCatChart(stats.catStats   || []);
    renderTopChart(stats.topSold    || []);
    renderValueChart(stats.catStats || []);
    renderTxChart(summary);
  } catch(e) { console.error('loadReports:', e); }
}

const chartDef = {
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,.05)' } },
    y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,.05)' } }
  }
};
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function chartEmpty(id, msg) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  canvas.style.display = 'none';
  let empty = canvas.parentElement.querySelector('.chart-empty');
  if (!empty) { empty = document.createElement('div'); empty.className = 'chart-empty'; canvas.parentElement.appendChild(empty); }
  empty.textContent = msg;
}
function chartShow(id) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  canvas.style.display = '';
  const empty = canvas.parentElement.querySelector('.chart-empty');
  if (empty) empty.remove();
}

function renderCatChart(cats) {
  destroyChart('cat');
  if (!cats || !cats.length) { chartEmpty('catChart', 'Маълумот нест'); return; }
  chartShow('catChart');
  try {
    charts.cat = new Chart(document.getElementById('catChart').getContext('2d'), {
      type: 'doughnut',
      data: { labels: cats.map(c => catLabel(c.category)),
        datasets: [{ data: cats.map(c => c.totalQty), backgroundColor: ['#3b82f6','#a855f7','#64748b'], borderWidth: 0 }] },
      options: { plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } } }
    });
  } catch(e) {}
}
function renderTopChart(top) {
  destroyChart('top');
  if (!top || !top.length) { chartEmpty('topChart', 'Фурӯши сабтшуда нест'); return; }
  chartShow('topChart');
  try {
    charts.top = new Chart(document.getElementById('topChart').getContext('2d'), {
      type: 'bar',
      data: { labels: top.map(t => t.productName.slice(0,15)),
        datasets: [{ label: 'Фурӯш (смн)', data: top.map(t => t.totalSold.toFixed(2)), backgroundColor: '#6366f1', borderRadius: 6 }] },
      options: { ...chartDef, plugins: { legend: { display: false } } }
    });
  } catch(e) {}
}
function renderValueChart(cats) {
  destroyChart('value');
  if (!cats || !cats.length) { chartEmpty('valueChart', 'Маълумот нест'); return; }
  chartShow('valueChart');
  try {
    charts.value = new Chart(document.getElementById('valueChart').getContext('2d'), {
      type: 'pie',
      data: { labels: cats.map(c => catLabel(c.category)),
        datasets: [{ data: cats.map(c => c.value.toFixed(2)), backgroundColor: ['#22c55e','#f59e0b','#94a3b8'], borderWidth: 0 }] },
      options: { plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } } }
    });
  } catch(e) {}
}
function renderTxChart(s) {
  destroyChart('tx');
  if (!s) { chartEmpty('txChart', 'Маълумот нест'); return; }
  chartShow('txChart');
  try {
    charts.tx = new Chart(document.getElementById('txChart').getContext('2d'), {
      type: 'bar',
      data: { labels: ['Имрӯз Даромад','Имрӯз Фурӯш','Умумӣ Даромад','Умумӣ Фурӯш'],
        datasets: [{ data: [s.todayIn,s.todayOut,s.totalIn,s.totalOut], backgroundColor: ['#22c55e','#ef4444','#3b82f6','#f59e0b'], borderRadius: 6 }] },
      options: { ...chartDef, plugins: { legend: { display: false } } }
    });
  } catch(e) {}
}

// ── Admin ─────────────────────────────────────────────────
async function loadAdminData() {
  try {
    const [sysStats, users, activity] = await Promise.all([
      api('GET', '/admin/system-stats'),
      api('GET', '/users'),
      api('GET', '/admin/activity?limit=200'),
    ]);

    if (sysStats) {
      document.getElementById('system-stats').innerHTML =
        `<div>📦 Маҳсулотҳо: <strong>${sysStats.productCount}</strong></div>
         <div>👥 Корбарон: <strong>${sysStats.userCount}</strong></div>
         <div>📋 Амалиётҳо: <strong>${sysStats.txCount}</strong></div>
         <div>💾 Ҳаҷм: <strong>${sysStats.dbSize}</strong></div>`;
    }

    if (users) {
      document.getElementById('users-count-badge').textContent = users.length;
      document.getElementById('users-tbody').innerHTML = users.map((u, i) => {
        const isMe = u.username === username;
        const roleBadge = u.role === 'admin'
          ? `<span class="role-badge role-admin">👑 Admin</span>`
          : `<span class="role-badge role-worker">👷 Worker</span>`;
        const toggleBtn = isMe ? '' : (u.role === 'admin'
          ? `<button class="btn btn-outline" style="padding:.3rem .6rem;font-size:11px" onclick="setUserRole(${u.id},'worker','${esc(u.username)}')">→ Worker</button>`
          : `<button class="btn btn-primary"  style="padding:.3rem .6rem;font-size:11px" onclick="setUserRole(${u.id},'admin','${esc(u.username)}')">→ Admin</button>`);
        const delBtn = isMe ? '' :
          `<button class="btn btn-danger" style="padding:.3rem .6rem;font-size:11px" onclick="deleteUser(${u.id},'${esc(u.username)}')">🗑</button>`;
        return `<tr>
          <td style="color:var(--text3)">${i+1}</td>
          <td><strong>${u.username}</strong>${isMe?' <span style="font-size:11px;color:var(--text3)">(сиз)</span>':''}</td>
          <td>${roleBadge}</td>
          <td style="color:var(--text3);font-size:11px">${fmtDate(u.createdAt)}</td>
          <td style="display:flex;gap:.4rem">${toggleBtn}${delBtn}</td>
        </tr>`;
      }).join('');
    }

    activityAll = activity || [];
    renderActivityTable(activityAll);
  } catch(e) { console.error(e); }
}

function renderActivityTable(items) {
  const tbody = document.getElementById('activity-tbody');
  const filtered = activityFilter === 'all' ? items : items.filter(a => a.kind === activityFilter);
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Амалиёт нест</td></tr>';
    return;
  }
  const kindMap = {
    in:       '<span class="tx-badge tx-in">📥 Даромад</span>',
    out:      '<span class="tx-badge tx-out">🛒 Фурӯш</span>',
    expense:  '<span class="tx-badge" style="background:rgba(251,191,36,.15);color:#fbbf24">💸 Харочот</span>',
    debt_pay: '<span class="tx-badge" style="background:rgba(239,68,68,.15);color:#f87171">💳 Карз</span>',
  };
  tbody.innerHTML = filtered.slice(0, 200).map(a => `<tr>
    <td>${kindMap[a.kind] || a.kind}</td>
    <td><span class="user-chip">${a.user}</span></td>
    <td style="font-size:12px">${a.detail}</td>
    <td style="font-weight:600">${fmtC(a.amount)}</td>
    <td style="color:var(--text3);font-size:11px">${fmtDate(a.createdAt)}</td>
  </tr>`).join('');
}

function filterActivity(kind, btn) {
  activityFilter = kind;
  document.querySelectorAll('#admin .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderActivityTable(activityAll);
}

document.getElementById('backup-btn').addEventListener('click', async () => {
  document.getElementById('backup-btn').disabled = true;
  try {
    const res = await api('POST', '/admin/backup');
    toast('💾 ' + (res?.message || 'Нусхабардорӣ шуд'), 'success');
  } catch(e) { toast(e.message, 'error'); }
  finally { document.getElementById('backup-btn').disabled = false; }
});

document.getElementById('export-csv-btn').addEventListener('click', () => {
  window.open(`/api/admin/export-csv?token=${token}`, '_blank');
});

async function setUserRole(id, newRole, name) {
  if (!confirm(`"${name}" корбарро ба ${newRole === 'admin' ? 'Admin' : 'Worker'} иваз кунед?`)) return;
  try {
    await api('PUT', `/users/${id}/role`, { role: newRole });
    toast(`Нақши ${name} иваз шуд`, 'success');
    loadAdminData();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteUser(id, name) {
  if (!confirm(`"${name}" корбарро нест кунед?`)) return;
  try {
    await api('DELETE', `/users/${id}`);
    toast('Корбар нест шуд', 'info');
    loadAdminData();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteProduct(id, name) {
  if (!confirm(`"${name}" маҳсулотро бо ҳамаи амалиётҳояш нест кунед?`)) return;
  try {
    await api('DELETE', `/products/${id}`);
    toast('Маҳсулот нест шуд', 'info');
    await loadProductsData();
    renderProducts();
  } catch(e) { toast(e.message, 'error'); }
}

// ── Utils ─────────────────────────────────────────────────
function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str.slice(0,16);
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
}
function catLabel(cat) {
  return { shoes: '👟 Пойафзол', clothing: '👕 Либос', other: '📦 Дигар' }[cat] || cat;
}
function esc(str) {
  return String(str).replace(/'/g,"\\'").replace(/"/g,'&quot;');
}

// ── Bootstrap ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (token) initApp();
});

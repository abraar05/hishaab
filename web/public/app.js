const API = '';
const state = { products: [], customers: [], suppliers: [], currency: 'BDT' };

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function toast(msg, type = 'ok') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(() => el.classList.remove('show'), 2200);
}

async function api(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const body = { _method: method };
  if (opts.body) {
    try { Object.assign(body, JSON.parse(opts.body)); } catch (e) {}
  }
  const result = window.Hishaaab.call(path, JSON.stringify(body));
  const data = JSON.parse(result || '{}');
  if (data.error) throw new Error(data.error);
  return data;
}

function fmt(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '-';
  return d.slice(0, 10);
}

function statusBadge(s) {
  const cls = { paid: 'status-paid', partial: 'status-partial', unpaid: 'status-unpaid' }[s || 'unpaid'] || 'status-unpaid';
  return `<span class="status-badge ${cls}">${(s || 'unpaid').toUpperCase()}</span>`;
}

function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------- Nav ----------
$$('.nav-link').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    $$('.nav-link').forEach((x) => x.classList.remove('active'));
    a.classList.add('active');
    showSection(a.dataset.section);
    document.body.classList.remove('sidebar-open');
    const sb = document.querySelector('.sidebar');
    if (sb) sb.classList.remove('open');
  });
});

function showSection(id) {
  $$('.section').forEach((s) => s.classList.add('hidden'));
  const el = $(`#section-${id}`);
  if (el) el.classList.remove('hidden');
  $('#pageTitle').textContent = id.charAt(0).toUpperCase() + id.slice(1);
  const loaders = {
    dashboard: loadDashboard,
    products: loadProducts,
    sales: loadSales,
    purchases: loadPurchases,
    parties: loadParties,
    dues: loadDues,
    reports: loadReports,
    settings: loadSettings,
  };
  if (loaders[id]) loaders[id];
}

// ---------- Dashboard ----------
async function loadDashboard() {
  try {
    const d = await api('/api/reports/dashboard');
    $('#stat-products').textContent = d.totalProducts ?? '-';
    $('#stat-sales').textContent = fmt(d.sales.t);
    $('#stat-purchases').textContent = fmt(d.purchases.t);
    $('#stat-dues').textContent = fmt(d.netDue);
    $('#stat-stock').textContent = fmt(d.stock.v);
    $('#stat-lowstock').textContent = d.lowStock ?? '-';
    $('#stat-customers').textContent = d.totalCustomers ?? '-';
    $('#stat-suppliers').textContent = d.totalSuppliers ?? '-';

    const s = await api('/api/reports/sales-summary');
    wrap('#recent-sales-wrap', s.slice(0, 6).map((r) => `
      <tr><td>${esc(fmtDate(r.date))}</td><td>${r.n}</td><td>${fmt(r.total)}</td><td>${fmt(r.due)}</td></tr>
    `), '<tr><td>Date</td><td>Count</td><td>Total</td><td>Due</td></tr>');

    const p = await api('/api/reports/product-movement');
    wrap('#recent-purchases-wrap', p.slice(0, 6).map((r) => `
      <tr><td>${esc(r.name)}</td><td>${fmt(r.stock)}</td><td>${fmt(r.sold)}</td><td>${fmt(r.revenue)}</td><td>${fmt(r.bought)}</td></tr>
    `), '<tr><td>Product</td><td>Stock</td><td>Sold</td><td>Revenue</td><td>Bought</td></tr>');
  } catch (err) { toast(err.message); }
}

// ---------- Products ----------
async function loadProducts() {
  try {
    const q = $('#prodSearch').value.trim();
    const low = $('#prodLowStock').checked;
    let url = '/api/products';
    const params = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (low) params.push('lowStock=1');
    if (params.length) url += '?' + params.join('&');
    state.products = await api(url);
    renderProductsTable(state.products);
  } catch (err) { toast(err.message); }
}

function renderProductsTable(list) {
  const tbody = $('#productsTable tbody');
  tbody.innerHTML = '';
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty">No products found</td></tr>'; return; }
  list.forEach((p) => {
    const low = p.min_stock > 0 && p.stock <= p.min_stock;
    tbody.innerHTML += `
      <tr>
        <td><strong>${esc(p.name)}</strong>${esc(p.description) ? `<div style="font-size:0.78rem;color:#666">${esc(p.description)}</div>` : ''}</td>
        <td>${esc(p.sku || '-')}</td>
        <td>${esc(p.category || '-')}</td>
        <td>${fmt(p.purchase_price)}</td>
        <td>${fmt(p.sale_price)}</td>
        <td class="${low ? 'low' : ''}">${fmt(p.stock)} ${esc(p.unit || 'pcs')}</td>
        <td>${esc(p.unit || 'pcs')}</td>
        <td>${fmt(p.min_stock)}</td>
        <td>${low ? '<span class="status-badge" style="background:#fee2e2;color:#991b1b">LOW</span>' : 'OK'}</td>
        <td>
          <button class="btn btn-outline" style="padding:4px 8px;font-size:0.8rem" onclick="editProduct('${esc(p.id)}')">Edit</button>
          <button class="btn btn-outline" style="padding:4px 8px;font-size:0.8rem;color:#dc2626;border-color:#dc2626" onclick="deleteProduct('${esc(p.id)}','${esc(p.name)}')">Del</button>
        </td>
      </tr>`;
  });
}

function openProductModal(p = null) {
  const form = $('#productForm');
  form.reset();
  $('#productId').value = '';
  $('#productModalTitle').textContent = p ? 'Edit Product' : 'Add Product';
  if (p) {
    $('#productId').value = p.id;
    $('#pName').value = p.name;
    $('#pSku').value = p.sku || '';
    $('#pCategory').value = p.category || '';
    $('#pPurchasePrice').value = p.purchase_price;
    $('#pSalePrice').value = p.sale_price;
    $('#pStock').value = p.stock;
    $('#pUnit').value = p.unit || 'pcs';
    $('#pMinStock').value = p.min_stock;
    $('#pDescription').value = p.description || '';
  }
  $('#productModal').classList.remove('hidden');
}
$('#productBackdrop').onclick = closeProductModal;
$('#btnCloseProduct').onclick = closeProductModal;
$('#btnCancelProduct').onclick = closeProductModal;
function closeProductModal() { $('#productModal').classList.add('hidden'); }
$('#btnAddProduct').onclick = () => openProductModal();

$('#productForm').onsubmit = async (e) => {
  e.preventDefault();
  const id = $('#productId').value;
  const payload = {
    name: $('#pName').value, category: $('#pCategory').value, sku: $('#pSku').value,
    purchase_price: $('#pPurchasePrice').value, sale_price: $('#pSalePrice').value,
    stock: $('#pStock').value, unit: $('#pUnit').value, min_stock: $('#pMinStock').value,
    description: $('#pDescription').value,
  };
  try {
    if (id) await api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
    closeProductModal();
    loadProducts();
    loadDashboard();
    loadParties();
    toast(id ? 'Product updated' : 'Product added');
  } catch (err) { toast(err.message); }
};

window.editProduct = async (id) => {
  try { openProductModal(await api(`/api/products/${id}`)); } catch (err) { toast(err.message); }
};
window.deleteProduct = async (id, name) => {
  if (!confirm(`Delete product "${name}"?`)) return;
  try {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    loadProducts(); loadDashboard(); loadParties(); toast('Product deleted');
  } catch (err) { toast(err.message); }
};
$('#prodSearch').oninput = loadProducts;
$('#prodLowStock').onchange = loadProducts;
$('#btnClearProd').onclick = () => { $('#prodSearch').value = ''; $('#prodLowStock').checked = false; loadProducts(); };

// ---------- Parties ----------
async function loadParties() {
  try {
    state.customers = await api('/api/customers');
    state.suppliers = await api('/api/suppliers');
    renderPartiesTable();
    renderPartySelects();
    loadDues();
  } catch (err) { toast(err.message); }
}

function renderPartiesTable() {
  const cb = $('#customersTable tbody');
  const sb = $('#suppliersTable tbody');
  cb.innerHTML = '';
  sb.innerHTML = '';
  state.customers.forEach((c) => {
    cb.innerHTML += `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.phone || '-')}</td><td>${esc(c.address || '-')}</td><td>${fmt(c.due_balance)}</td><td><button class="btn btn-outline" style="padding:4px 8px" onclick="editCustomer('${esc(c.id)}')">Edit</button><button class="btn btn-outline" style="padding:4px 8px;color:#dc2626;border-color:#dc2626" onclick="deleteParty('customer','${esc(c.id)}','${esc(c.name)}')">Del</button></td></tr>`;
  });
  state.suppliers.forEach((s) => {
    sb.innerHTML += `<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.phone || '-')}</td><td>${esc(s.address || '-')}</td><td>${fmt(s.due_balance)}</td><td><button class="btn btn-outline" style="padding:4px 8px" onclick="editSupplier('${esc(s.id)}')">Edit</button><button class="btn btn-outline" style="padding:4px 8px;color:#dc2626;border-color:#dc2626" onclick="deleteParty('supplier','${esc(s.id)}','${esc(s.name)}')">Del</button></td></tr>`;
  });
}

function renderPartySelects() {
  const sel = (id, list, def) => {
    const el = $(id);
    el.innerHTML = list.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    if (def) el.value = def;
  };
  sel('#saleCustomer', state.customers);
  sel('#purchaseSupplier', state.suppliers);
  sel('#paymentParty', state.customers);
}

async function saveParty(type) {
  const form = $('#partyForm');
  const payload = { name: $('#partyName').value, phone: $('#partyPhone').value, address: $('#partyAddress').value, due_balance: $('#partyDue').value };
  const id = $('#partyId').value;
  try {
    if (id) await api(`/api/${type === 'customer' ? 'customers' : 'suppliers'}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api(`/api/${type === 'customer' ? 'customers' : 'suppliers'}`, { method: 'POST', body: JSON.stringify(payload) });
    closePartyModal();
    loadParties();
    toast(type + ' saved');
  } catch (err) { toast(err.message); }
}

function openPartyModal(type, p = null) {
  $('#partyType').value = type;
  $('#partyModalTitle').textContent = (p ? 'Edit ' : 'Add ') + (type === 'customer' ? 'Customer' : 'Supplier');
  $('#partyForm').reset();
  $('#partyId').value = '';
  $('#partyDue').value = 0;
  if (p) {
    $('#partyId').value = p.id;
    $('#partyName').value = p.name;
    $('#partyPhone').value = p.phone || '';
    $('#partyAddress').value = p.address || '';
    $('#partyDue').value = p.due_balance;
  }
  $('#partyModal').classList.remove('hidden');
}
$('#partyBackdrop').onclick = closePartyModal;
$('#btnCloseParty').onclick = closePartyModal;
$('#btnCancelParty').onclick = closePartyModal;
function closePartyModal() { $('#partyModal').classList.add('hidden'); }
$('#btnAddCustomer').onclick = () => openPartyModal('customer');
$('#btnAddSupplier').onclick = () => openPartyModal('supplier');
$('#partyForm').onsubmit = (e) => { e.preventDefault(); saveParty($('#partyType').value); };

window.editCustomer = async (id) => { try { openPartyModal('customer', await api(`/api/customers/${id}`)); } catch (err) { toast(err.message); } };
window.editSupplier = async (id) => { try { openPartyModal('supplier', await api(`/api/suppliers/${id}`)); } catch (err) { toast(err.message); } };
window.deleteParty = async (type, id, name) => {
  if (!confirm(`Delete ${type} "${name}"?`)) return;
  try {
    await api(`/api/${type === 'customer' ? 'customers' : 'suppliers'}/${id}`, { method: 'DELETE' });
    loadParties(); loadDashboard(); toast(`${type} deleted`);
  } catch (err) { toast(err.message); }
};

// ---------- Sales ----------
let saleItems = [];
function loadSales() {
  $('#saleForm').reset(); $('#saleId').value = '';
  saleItems = []; renderSaleItems(); calcSaleTotals();
  $('#saleDate').value = new Date().toISOString().slice(0, 10);
  loadSalesTable();
}

async function loadSalesTable() {
  try {
    let url = '/api/sales'; const params = [];
    const q = $('#saleSearch').value.trim(); if (q) params.push(`q=${encodeURIComponent(q)}`);
    const f = $('#saleFrom').value; if (f) params.push(`from=${f}`);
    const t = $('#saleTo').value; if (t) params.push(`to=${t}`);
    if (params.length) url += '?' + params.join('&');
    const rows = await api(url);
    const tbody = $('#salesTable tbody'); tbody.innerHTML = '';
    rows.forEach((s) => {
      tbody.innerHTML += `<tr><td><strong>${esc(s.invoice_no)}</strong></td><td>${esc(s.customer_name || '-')}</td><td>${fmtDate(s.date)}</td><td>${fmt(s.total)}</td><td>${fmt(s.paid)}</td><td>${fmt(s.due)}</td><td>${statusBadge(s.status)}</td><td><button class="btn btn-outline" style="padding:4px 8px" onclick="viewSale('${esc(s.id)}')">View</button><button class="btn btn-outline" style="padding:4px 8px;color:#dc2626;border-color:#dc2626" onclick="deleteSale('${esc(s.id)}','${esc(s.invoice_no)}')">Del</button></td></tr>`;
    });
  } catch (err) { toast(err.message); }
}

function renderSaleItems() {
  const tbody = $('#saleItemsTable tbody'); tbody.innerHTML = '';
  saleItems.forEach((it, i) => {
    tbody.innerHTML += `<tr><td>${esc(it.product_name || 'Product')}</td><td>${fmt(it.qty)}</td><td>${fmt(it.price)}</td><td>${fmt(it.total)}</td><td><button class="btn btn-outline" style="padding:2px 6px;font-size:0.78rem;color:#dc2626" onclick="removeSaleItem(${i})">&#215;</button></td></tr>`;
  });
  calcSaleTotals();
}
function calcSaleTotals() {
  const sub = saleItems.reduce((a, it) => a + num(it.total), 0);
  $('#saleSubtotal').value = fmt(sub);
  const disc = num($('#saleDiscount').value || 0);
  const tax = num($('#saleTax').value || 0);
  const total = sub - disc + tax;
  $('#saleTotal').value = fmt(total);
  $('#salePaid').oninput = null;
}
window.addSaleItem = function () {
  const prodSel = $('#saleItemProduct');
  const product = state.products.find((p) => p.id === prodSel.value) || {};
  const qty = num($('#saleItemQty').value);
  if (!qty) { toast('Enter quantity'); return; }
  const price = num(product.sale_price || 0);
  const total = qty * price;
  saleItems.push({ product_id: product.id || null, product_name: $('#saleItemProduct').options[prodSel.selectedIndex]?.text || product.name || 'Product', qty, price, total });
  renderSaleItems();
};
window.removeSaleItem = function (i) { saleItems.splice(i, 1); renderSaleItems(); };
$('#saleDiscount').oninput = calcSaleTotals;
$('#saleTax').oninput = calcSaleTotals;
$('#salePaid').oninput = () => { /* due handled on save */ };

function openSaleView(s) {
  // minimal inline view handled via table row view button
}

window.viewSale = async (id) => {
  try {
    const s = await api(`/api/sales/${id}`);
    alert(`Invoice ${s.invoice_no}\nCustomer: ${s.customer_name}\nDate: ${fmtDate(s.date)}\nTotal: ${fmt(s.total)}\nPaid: ${fmt(s.paid)}\nDue: ${fmt(s.due)}\nStatus: ${s.status}\n\nItems:\n${s.items.map((it)=>`- ${it.product_name} x${it.qty} @ ${fmt(it.price)} = ${fmt(it.total)}`).join('\n')}`);
  } catch (err) { toast(err.message); }
};
window.deleteSale = async (id, inv) => {
  if (!confirm(`Delete sale ${inv}?`)) return;
  try { await api(`/api/sales/${id}`, { method: 'DELETE' }); loadSalesTable(); loadDashboard(); loadProducts(); toast('Sale deleted'); } catch (err) { toast(err.message); }
};

$('#btnAddSale').onclick = loadSales;
$('#saleSearch').oninput = loadSalesTable;
$('#saleFrom').onchange = loadSalesTable;
$('#saleTo').onchange = loadSalesTable;
$('#btnClearSale').onclick = () => { $('#saleSearch').value = ''; $('#saleFrom').value = ''; $('#saleTo').value = ''; loadSalesTable(); };

// populate sale product select
function populateSaleProductSelect() {
  const el = $('#saleItemProduct');
  el.innerHTML = state.products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} (${fmt(p.sale_price)})</option>`).join('');
}
loadProductsOrig = loadProducts;
loadProducts = async () => {
  await loadProductsOrig();
  populateSaleProductSelect();
};

$('#saleForm').onsubmit = async (e) => {
  e.preventDefault();
  if (!saleItems.length) { toast('Add at least one item'); return; }
  const payload = {
    customer_id: $('#saleCustomer').value || null,
    customer_name: $('#saleCustomerName').value || $('#saleCustomer').options[$('#saleCustomer').selectedIndex]?.text || '',
    date: $('#saleDate').value,
    subtotal: $('#saleSubtotal').value,
    discount: $('#saleDiscount').value,
    tax: $('#saleTax').value,
    total: $('#saleTotal').value,
    paid: $('#salePaid').value,
    notes: $('#saleNotes').value,
    items: saleItems,
  };
  const id = $('#saleId').value;
  try {
    if (id) await api(`/api/sales/${id}`, { method: 'PUT', body: JSON.stringify({ paid: payload.paid, status: payload.total - payload.paid <= 0 ? 'paid' : 'partial' }) });
    else await api('/api/sales', { method: 'POST', body: JSON.stringify(payload) });
    $('#saleModal').classList.add('hidden');
    loadSalesTable(); loadDashboard(); loadProducts(); loadParties();
    toast('Sale saved');
  } catch (err) { toast(err.message); }
};
$('#saleBackdrop').onclick = () => $('#saleModal').classList.add('hidden');
$('#btnCloseSale').onclick = () => $('#saleModal').classList.add('hidden');
$('#btnCancelSale').onclick = () => $('#saleModal').classList.add('hidden');

// ---------- Purchases ----------
let purchaseItems = [];
function loadPurchases() {
  $('#purchaseForm').reset(); $('#purchaseId').value = '';
  purchaseItems = []; renderPurchaseItems(); calcPurchaseTotals();
  $('#purchaseDate').value = new Date().toISOString().slice(0, 10);
  loadPurchasesTable();
}

async function loadPurchasesTable() {
  try {
    let url = '/api/purchases'; const params = [];
    const q = $('#purchaseSearch').value.trim(); if (q) params.push(`q=${encodeURIComponent(q)}`);
    const f = $('#purchaseFrom').value; if (f) params.push(`from=${f}`);
    const t = $('#purchaseTo').value; if (t) params.push(`to=${t}`);
    if (params.length) url += '?' + params.join('&');
    const rows = await api(url);
    const tbody = $('#purchasesTable tbody'); tbody.innerHTML = '';
    rows.forEach((p) => {
      tbody.innerHTML += `<tr><td><strong>${esc(p.invoice_no)}</strong></td><td>${esc(p.supplier_name || '-')}</td><td>${fmtDate(p.date)}</td><td>${fmt(p.total)}</td><td>${fmt(p.paid)}</td><td>${fmt(p.due)}</td><td>${statusBadge(p.status)}</td><td><button class="btn btn-outline" style="padding:4px 8px" onclick="viewPurchase('${esc(p.id)}')">View</button><button class="btn btn-outline" style="padding:4px 8px;color:#dc2626;border-color:#dc2626" onclick="deletePurchase('${esc(p.id)}','${esc(p.invoice_no)}')">Del</button></td></tr>`;
    });
  } catch (err) { toast(err.message); }
}

function renderPurchaseItems() {
  const tbody = $('#purchaseItemsTable tbody'); tbody.innerHTML = '';
  purchaseItems.forEach((it, i) => {
    tbody.innerHTML += `<tr><td>${esc(it.product_name || 'Product')}</td><td>${fmt(it.qty)}</td><td>${fmt(it.price)}</td><td>${fmt(it.total)}</td><td><button class="btn btn-outline" style="padding:2px 6px;font-size:0.78rem;color:#dc2626" onclick="removePurchaseItem(${i})">&#215;</button></td></tr>`;
  });
  calcPurchaseTotals();
}
function calcPurchaseTotals() {
  const sub = purchaseItems.reduce((a, it) => a + num(it.total), 0);
  $('#purchaseSubtotal').value = fmt(sub);
  const disc = num($('#purchaseDiscount').value || 0);
  const tax = num($('#purchaseTax').value || 0);
  $('#purchaseTotal').value = fmt(sub - disc + tax);
}
window.addPurchaseItem = function () {
  const prodSel = $('#purchaseItemProduct');
  const product = state.products.find((p) => p.id === prodSel.value) || {};
  const qty = num($('#purchaseItemQty').value);
  if (!qty) { toast('Enter quantity'); return; }
  const price = num(product.purchase_price || 0);
  const total = qty * price;
  purchaseItems.push({ product_id: product.id || null, product_name: $('#purchaseItemProduct').options[prodSel.selectedIndex]?.text || product.name || 'Product', qty, price, total });
  renderPurchaseItems();
};
window.removePurchaseItem = function (i) { purchaseItems.splice(i, 1); renderPurchaseItems(); };
$('#purchaseDiscount').oninput = calcPurchaseTotals;
$('#purchaseTax').oninput = calcPurchaseTotals;

function populatePurchaseProductSelect() {
  const el = $('#purchaseItemProduct');
  el.innerHTML = state.products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} (${fmt(p.purchase_price)})</option>`).join('');
}
const loadPurchasesOrig = loadPurchases;
loadPurchases = async () => {
  await loadPurchasesOrig();
  populatePurchaseProductSelect();
};

$('#btnAddPurchase').onclick = loadPurchases;
$('#purchaseSearch').oninput = loadPurchasesTable;
$('#purchaseFrom').onchange = loadPurchasesTable;
$('#purchaseTo').onchange = loadPurchasesTable;
$('#btnClearPurchase').onclick = () => { $('#purchaseSearch').value = ''; $('#purchaseFrom').value = ''; $('#purchaseTo').value = ''; loadPurchasesTable(); };

window.viewPurchase = async (id) => {
  try {
    const p = await api(`/api/purchases/${id}`);
    alert(`Invoice ${p.invoice_no}\nSupplier: ${p.supplier_name}\nDate: ${fmtDate(p.date)}\nTotal: ${fmt(p.total)}\nPaid: ${fmt(p.paid)}\nDue: ${fmt(p.due)}\nStatus: ${p.status}`);
  } catch (err) { toast(err.message); }
};
window.deletePurchase = async (id, inv) => {
  if (!confirm(`Delete purchase ${inv}?`)) return;
  try { await api(`/api/purchases/${id}`, { method: 'DELETE' }); loadPurchasesTable(); loadDashboard(); loadProducts(); toast('Purchase deleted'); } catch (err) { toast(err.message); }
};

$('#purchaseForm').onsubmit = async (e) => {
  e.preventDefault();
  if (!purchaseItems.length) { toast('Add at least one item'); return; }
  const payload = {
    supplier_id: $('#purchaseSupplier').value || null,
    supplier_name: $('#purchaseSupplierName').value || $('#purchaseSupplier').options[$('#purchaseSupplier').selectedIndex]?.text || '',
    date: $('#purchaseDate').value,
    subtotal: $('#purchaseSubtotal').value,
    discount: $('#purchaseDiscount').value,
    tax: $('#purchaseTax').value,
    total: $('#purchaseTotal').value,
    paid: $('#purchasePaid').value,
    notes: $('#purchaseNotes').value,
    items: purchaseItems,
  };
  const id = $('#purchaseId').value;
  try {
    if (id) await api(`/api/purchases/${id}`, { method: 'PUT', body: JSON.stringify({ paid: payload.paid, status: payload.total - payload.paid <= 0 ? 'paid' : 'partial' }) });
    else await api('/api/purchases', { method: 'POST', body: JSON.stringify(payload) });
    $('#purchaseModal').classList.add('hidden');
    loadPurchasesTable(); loadDashboard(); loadProducts(); loadParties();
    toast('Purchase saved');
  } catch (err) { toast(err.message); }
};
$('#purchaseBackdrop').onclick = () => $('#purchaseModal').classList.add('hidden');
$('#btnClosePurchase').onclick = () => $('#purchaseModal').classList.add('hidden');
$('#btnCancelPurchase').onclick = () => $('#purchaseModal').classList.add('hidden');

// ---------- Dues ----------
async function loadDues() {
  try {
    const d = await api('/api/reports/dues');
    const cc = $('#duesCustomersTable tbody'); const sc = $('#duesSuppliersTable tbody');
    cc.innerHTML = ''; sc.innerHTML = '';
    d.customers.forEach((c) => { cc.innerHTML += `<tr><td>${esc(c.name)}</td><td>${esc(c.phone || '-')}</td><td>${fmt(c.due)}</td><td><button class="btn btn-primary" style="padding:4px 8px;font-size:0.8rem" onclick="recordPayment('customer','${esc(c.id)}','${esc(c.name)}')">Collect</button></td></tr>`; });
    d.suppliers.forEach((s) => { sc.innerHTML += `<tr><td>${esc(s.name)}</td><td>${esc(s.phone || '-')}</td><td>${fmt(s.due)}</td><td><button class="btn btn-primary" style="padding:4px 8px;font-size:0.8rem" onclick="recordPayment('supplier','${esc(s.id)}','${esc(s.name)}')">Pay</button></td></tr>`; });
    loadPaymentHistory();
  } catch (err) { toast(err.message); }
}

async function loadPaymentHistory() {
  const rows = await api('/api/payments');
  const tbody = $('#paymentsTable tbody'); tbody.innerHTML = '';
  rows.slice(0, 30).forEach((p) => {
    tbody.innerHTML += `<tr><td>${fmtDate(p.date)}</td><td>${p.type}</td><td>${esc(p.party_name)}</td><td>${fmt(p.amount)}</td><td>${esc(p.mode || '-')}</td><td>${esc(p.note || '-')}</td></tr>`;
  });
}

window.recordPayment = (type, id, name) => {
  $('#paymentForm').reset(); $('#paymentId').value = '';
  $('#paymentPartyType').value = type;
  $('#paymentParty').value = id;
  $('#paymentType').value = type === 'customer' ? 'received' : 'paid';
  $('#paymentModalTitle').textContent = type === 'customer' ? 'Collect Payment' : 'Pay Supplier';
  $('#paymentModal').classList.remove('hidden');
};
$('#btnAddPayment').onclick = () => {
  $('#paymentForm').reset(); $('#paymentId').value = '';
  $('#paymentPartyType').value = 'customer';
  $('#paymentType').value = 'received';
  $('#paymentModalTitle').textContent = 'Record Payment';
  $('#paymentModal').classList.remove('hidden');
};
$('#paymentPartyType').onchange = () => {
  const t = $('#paymentPartyType').value;
  const list = t === 'customer' ? state.customers : state.suppliers;
  const el = $('#paymentParty');
  el.innerHTML = list.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
};
$('#paymentBackdrop').onclick = () => $('#paymentModal').classList.add('hidden');
$('#btnClosePayment').onclick = () => $('#paymentModal').classList.add('hidden');
$('#btnCancelPayment').onclick = () => $('#paymentModal').classList.add('hidden');

$('#paymentForm').onsubmit = async (e) => {
  e.preventDefault();
  const payload = {
    type: $('#paymentType').value,
    party_type: $('#paymentPartyType').value,
    party_id: $('#paymentParty').value || null,
    party_name: $('#paymentParty').options[$('#paymentParty').selectedIndex]?.text || '',
    amount: $('#paymentAmount').value,
    date: $('#paymentDate').value || new Date().toISOString().slice(0, 10),
    mode: $('#paymentMode').value,
    note: $('#paymentNote').value,
  };
  try {
    await api('/api/payments', { method: 'POST', body: JSON.stringify(payload) });
    $('#paymentModal').classList.add('hidden');
    loadParties(); loadDashboard(); loadDues(); loadSalesTable(); loadPurchasesTable();
    toast('Payment recorded');
  } catch (err) { toast(err.message); }
};
$('#paymentDate').value = new Date().toISOString().slice(0, 10);

// ---------- Reports ----------
async function loadReports() {
  try {
    const p = await api('/api/reports/product-movement');
    const tb = $('#reportProductTable tbody'); tb.innerHTML = '';
    p.forEach((r) => { tb.innerHTML += `<tr><td>${esc(r.name)}</td><td>${fmt(r.stock)}</td><td>${fmt(r.sold)}</td><td>${fmt(r.revenue)}</td><td>${fmt(r.bought)}</td></tr>`; });

    const d = await api('/api/reports/dues');
    const db_ = $('#reportDuesTable tbody'); db_.innerHTML = '';
    d.customers.forEach((c) => { db_.innerHTML += `<tr><td>${esc(c.name)}</td><td>Customer</td><td>${fmt(c.due)}</td></tr>`; });
    d.suppliers.forEach((s) => { db_.innerHTML += `<tr><td>${esc(s.name)}</td><td>Supplier</td><td>${fmt(s.due)}</td></tr>`; });

    const s = await api('/api/reports/sales-summary');
    const sb_ = $('#reportSalesTable tbody'); sb_.innerHTML = '';
    s.forEach((r) => { sb_.innerHTML += `<tr><td>${fmtDate(r.date)}</td><td>${r.n}</td><td>${fmt(r.total)}</td><td>${fmt(r.due)}</td></tr>`; });
  } catch (err) { toast(err.message); }
}
$('#btnRefreshReports').onclick = loadReports;
$('#btnExportReports').onclick = () => { toast('Export not implemented in this build'); };

// ---------- Settings ----------
async function loadSettings() {
  try {
    const s = await api('/api/settings');
    state.currency = s.currency || 'BDT';
    $('#settingShopName').value = s.shop_name || 'Hishaaab';
    $('#settingCurrency').value = s.currency || 'BDT';
  } catch (err) { toast(err.message); }
}
$('#btnSaveSettings').onclick = async () => {
  try {
    await api('/api/settings', { method: 'POST', body: JSON.stringify({ key: 'shop_name', value: $('#settingShopName').value }) });
    await api('/api/settings', { method: 'POST', body: JSON.stringify({ key: 'currency', value: $('#settingCurrency').value }) });
    state.currency = $('#settingCurrency').value;
    toast('Settings saved');
  } catch (err) { toast(err.message); }
};

$('#btnExport').onclick = async () => {
  try {
    const data = window.Hishaaab
      ? await api('/api/_export')
      : {
          products: await api('/api/products'),
          customers: await api('/api/customers'),
          suppliers: await api('/api/suppliers'),
          sales: await api('/api/sales'),
          purchases: await api('/api/purchases'),
          payments: await api('/api/payments'),
        };
    const json = JSON.stringify(data, null, 2);
    if (window.Hishaaab && window.Hishaaab.saveFile) {
      window.Hishaaab.saveFile('hishaaab-export.json', json);
      toast('Exported hishaab-export.json to Downloads');
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'hishaaab-export.json'; a.click();
  } catch (err) { toast(err.message); }
};

$('#btnReset').onclick = async () => {
  if (!confirm('Reset to demo data? This clears all local data.')) return;
  try {
    if (window.Hishaaab) {
      await api('/api/_reset', { method: 'POST' });
      const active = document.querySelector('.nav-link.active')?.dataset.section || 'dashboard';
      showSection(active);
      toast('Demo data restored');
    } else {
      toast('Restart the server to reset demo data');
    }
  } catch (err) { toast(err.message); }
};

// ---------- DB backup/download ----------
$('#btnDownloadDb').onclick = async () => {
  try {
    if (window.Hishaaab && window.Hishaaab.saveFile) {
      const data = await api('/api/_export');
      window.Hishaaab.saveFile('hishaaab-backup.json', JSON.stringify(data, null, 2));
      toast('Backup saved to Downloads');
      return;
    }
    const res = await fetch(API + '/api/_db');
    if (!res.ok) { toast('DB endpoint not available'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'hishaaab.db'; a.click();
  } catch (err) { toast(err.message); }
};

function num(v) { return v === null || v === undefined ? 0 : parseFloat(v) || 0; }
function wrap(sel, rowsHtml, headerHtml) {
  const t = $(sel); if (!t) return;
  t.innerHTML = `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml.join('')}</tbody></table>`;
}

// boot
document.addEventListener('DOMContentLoaded', () => {
  showSection('dashboard');
  loadDashboard();
  loadProducts();
  loadParties();
});

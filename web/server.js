const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { db } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function resJson(res, status, data) { return res.status(status).json(data); }
function num(v) { return v === null || v === undefined ? 0 : parseFloat(v) || 0; }
function uid() { return require('uuid').v4(); }

function requireBody(fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
    if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });
    next();
  };
}

// ---------- Settings ----------
app.get('/api/settings', (req, res) => {
  const rows = db.all('settings');
  const obj = {};
  rows.forEach((r) => { obj[r.key] = r.value; });
  resJson(res, 200, obj);
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  const existing = db.get('settings', { key });
  if (existing) db.update('settings', existing.id, { value: String(value) });
  else db.insert('settings', { key, value: String(value) });
  resJson(res, 200, { ok: true });
});

// ---------- Products ----------
app.get('/api/products', (req, res) => {
  const { q, lowStock } = req.query;
  let rows = db.all('products');
  if (q) {
    const s = q.toLowerCase();
    rows = rows.filter((p) => (p.name||'').toLowerCase().includes(s) || (p.sku||'').toLowerCase().includes(s) || (p.category||'').toLowerCase().includes(s));
  }
  if (lowStock === '1') rows = rows.filter((p) => num(p.min_stock) > 0 && num(p.stock) <= num(p.min_stock));
  rows.sort((a, b) => (a.name||'').localeCompare(b.name||''));
  resJson(res, 200, rows);
});

app.get('/api/products/:id', (req, res) => {
  const row = db.get('products', { id: req.params.id });
  if (!row) return res.status(404).json({ error: 'Not found' });
  resJson(res, 200, row);
});

app.post('/api/products', requireBody(['name']), (req, res) => {
  const { name, category, sku, purchase_price, sale_price, stock, unit, min_stock, description } = req.body;
  const row = db.insert('products', {
    name, category: category || '', sku: sku || '', purchase_price: num(purchase_price),
    sale_price: num(sale_price), stock: num(stock), unit: unit || 'pcs', min_stock: num(min_stock),
    description: description || '', updated_at: new Date().toISOString(),
  });
  resJson(res, 201, row);
});

app.put('/api/products/:id', (req, res) => {
  if (!db.get('products', { id: req.params.id })) return res.status(404).json({ error: 'Not found' });
  const { name, category, sku, purchase_price, sale_price, stock, unit, min_stock, description } = req.body;
  const row = db.update('products', req.params.id, {
    name: name !== undefined ? name : undefined,
    category: category !== undefined ? category : undefined,
    sku: sku !== undefined ? sku : undefined,
    purchase_price: purchase_price !== undefined ? num(purchase_price) : undefined,
    sale_price: sale_price !== undefined ? num(sale_price) : undefined,
    stock: stock !== undefined ? num(stock) : undefined,
    unit: unit !== undefined ? unit : undefined,
    min_stock: min_stock !== undefined ? num(min_stock) : undefined,
    description: description !== undefined ? description : undefined,
  });
  resJson(res, 200, row);
});

app.delete('/api/products/:id', (req, res) => {
  if (!db.get('products', { id: req.params.id })) return res.status(404).json({ error: 'Not found' });
  db.del('products', req.params.id);
  resJson(res, 200, { ok: true });
});

// ---------- Customers ----------
app.get('/api/customers', (req, res) => {
  const { q } = req.query;
  let rows = db.all('customers');
  if (q) { const s = q.toLowerCase(); rows = rows.filter((c) => (c.name||'').toLowerCase().includes(s) || (c.phone||'').toLowerCase().includes(s)); }
  rows.sort((a, b) => (a.name||'').localeCompare(b.name||''));
  resJson(res, 200, rows);
});

app.get('/api/customers/:id', (req, res) => {
  const row = db.get('customers', { id: req.params.id });
  if (!row) return res.status(404).json({ error: 'Not found' });
  resJson(res, 200, row);
});

app.post('/api/customers', requireBody(['name']), (req, res) => {
  const { name, phone, address, due_balance } = req.body;
  const row = db.insert('customers', { name, phone: phone || '', address: address || '', due_balance: num(due_balance) });
  resJson(res, 201, row);
});

app.put('/api/customers/:id', (req, res) => {
  if (!db.get('customers', { id: req.params.id })) return res.status(404).json({ error: 'Not found' });
  const { name, phone, address, due_balance } = req.body;
  const row = db.update('customers', req.params.id, { name, phone: phone || '', address: address || '', due_balance: num(due_balance) });
  resJson(res, 200, row);
});

app.delete('/api/customers/:id', (req, res) => {
  if (!db.get('customers', { id: req.params.id })) return res.status(404).json({ error: 'Not found' });
  db.del('customers', req.params.id);
  resJson(res, 200, { ok: true });
});

// ---------- Suppliers ----------
app.get('/api/suppliers', (req, res) => {
  const { q } = req.query;
  let rows = db.all('suppliers');
  if (q) { const s = q.toLowerCase(); rows = rows.filter((s_) => (s_.name||'').toLowerCase().includes(s) || (s_.phone||'').toLowerCase().includes(s)); }
  rows.sort((a, b) => (a.name||'').localeCompare(b.name||''));
  resJson(res, 200, rows);
});

app.get('/api/suppliers/:id', (req, res) => {
  const row = db.get('suppliers', { id: req.params.id });
  if (!row) return res.status(404).json({ error: 'Not found' });
  resJson(res, 200, row);
});

app.post('/api/suppliers', requireBody(['name']), (req, res) => {
  const { name, phone, address, due_balance } = req.body;
  const row = db.insert('suppliers', { name, phone: phone || '', address: address || '', due_balance: num(due_balance) });
  resJson(res, 201, row);
});

app.put('/api/suppliers/:id', (req, res) => {
  if (!db.get('suppliers', { id: req.params.id })) return res.status(404).json({ error: 'Not found' });
  const { name, phone, address, due_balance } = req.body;
  const row = db.update('suppliers', req.params.id, { name, phone: phone || '', address: address || '', due_balance: num(due_balance) });
  resJson(res, 200, row);
});

app.delete('/api/suppliers/:id', (req, res) => {
  if (!db.get('suppliers', { id: req.params.id })) return res.status(404).json({ error: 'Not found' });
  db.del('suppliers', req.params.id);
  resJson(res, 200, { ok: true });
});

// ---------- Sales ----------
app.get('/api/sales', (req, res) => {
  const { q, from, to } = req.query;
  let rows = db.all('sales').map((s) => {
    const c = s.customer_id ? db.get('customers', { id: s.customer_id }) : null;
    return { ...s, customer_label: c ? c.name : (s.customer_name || '') };
  });
  if (q) { const s = q.toLowerCase(); rows = rows.filter((r) => (r.invoice_no||'').toLowerCase().includes(s) || (r.customer_name||'').toLowerCase().includes(s)); }
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);
  rows.sort((a, b) => (b.date||'').localeCompare(a.date||'') || (b.created_at||'').localeCompare(a.created_at||''));
  resJson(res, 200, rows);
});

app.get('/api/sales/:id', (req, res) => {
  const sale = db.get('sales', { id: req.params.id });
  if (!sale) return res.status(404).json({ error: 'Not found' });
  const items = db.all('sale_items', { sale_id: req.params.id });
  resJson(res, 200, { ...sale, items });
});

app.post('/api/sales', requireBody(['customer_name', 'items']), (req, res) => {
  const { customer_id, customer_name, date, subtotal, discount, tax, total, paid, notes } = req.body;
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const id = uid();
  const invoice_no = 'INV-' + Math.floor(100000 + Math.random() * 900000);
  const due = num(total) - num(paid);
  const status = due <= 0 ? 'paid' : (num(paid) > 0 ? 'partial' : 'unpaid');
  const ts = new Date().toISOString();
  const saleDate = date || ts.slice(0, 10);

  const saleRow = {
    id, invoice_no, customer_id: customer_id || null, customer_name, date: saleDate,
    subtotal: num(subtotal), discount: num(discount), tax: num(tax), total: num(total),
    paid: num(paid), due, status, notes: notes || '', created_at: ts,
  };
  db.insert('sales', saleRow);
  items.forEach((it) => {
    db.insert('sale_items', { id: uid(), sale_id: id, product_id: it.product_id || null, product_name: it.product_name || '', qty: num(it.qty), price: num(it.price), total: num(it.total) });
    if (it.product_id) {
      const p = db.get('products', { id: it.product_id });
      if (p) db.update('products', it.product_id, { stock: num(p.stock) - num(it.qty), updated_at: ts });
    }
  });
  if (num(paid) > 0 && customer_id) {
    const c = db.get('customers', { id: customer_id });
    if (c) db.update('customers', customer_id, { due_balance: num(c.due_balance) + due });
    db.insert('payments', { id: uid(), type: 'received', party_type: 'customer', party_id: customer_id, party_name: customer_name, amount: num(paid), date: saleDate, mode: 'cash', note: `Sale ${invoice_no}`, created_at: ts });
  }
  const saved = db.get('sales', { id });
  const savedItems = db.all('sale_items', { sale_id: id });
  resJson(res, 201, { ...saved, items: savedItems, invoice_no });
});

app.put('/api/sales/:id', (req, res) => {
  if (!db.get('sales', { id: req.params.id })) return res.status(404).json({ error: 'Not found' });
  const { paid, status } = req.body;
  const sale = db.get('sales', { id: req.params.id });
  const newPaid = paid !== undefined ? num(paid) : sale.paid;
  const newDue = num(sale.total) - newPaid;
  const newStatus = status || (newDue <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid'));
  db.update('sales', req.params.id, { paid: newPaid, due: newDue, status: newStatus });
  resJson(res, 200, db.get('sales', { id: req.params.id }));
});

app.delete('/api/sales/:id', (req, res) => {
  if (!db.get('sales', { id: req.params.id })) return res.status(404).json({ error: 'Not found' });
  db.del('sales', req.params.id);
  db.del('sale_items', req.params.id); // note: del matches single id col; sale_items has sale_id not id match -> handle below
  // remove sale items for this sale
  db.all('sale_items', { sale_id: req.params.id }).forEach((it) => db.del('sale_items', it.id));
  resJson(res, 200, { ok: true });
});

// ---------- Purchases ----------
app.get('/api/purchases', (req, res) => {
  const { q, from, to } = req.query;
  let rows = db.all('purchases').map((p) => {
    const s = p.supplier_id ? db.get('suppliers', { id: p.supplier_id }) : null;
    return { ...p, supplier_label: s ? s.name : (p.supplier_name || '') };
  });
  if (q) { const s = q.toLowerCase(); rows = rows.filter((r) => (r.invoice_no||'').toLowerCase().includes(s) || (r.supplier_name||'').toLowerCase().includes(s)); }
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);
  rows.sort((a, b) => (b.date||'').localeCompare(a.date||'') || (b.created_at||'').localeCompare(a.created_at||''));
  resJson(res, 200, rows);
});

app.get('/api/purchases/:id', (req, res) => {
  const purchase = db.get('purchases', { id: req.params.id });
  if (!purchase) return res.status(404).json({ error: 'Not found' });
  const items = db.all('purchase_items', { purchase_id: req.params.id });
  resJson(res, 200, { ...purchase, items });
});

app.post('/api/purchases', requireBody(['supplier_name', 'items']), (req, res) => {
  const { supplier_id, supplier_name, date, subtotal, discount, tax, total, paid, notes } = req.body;
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const id = uid();
  const invoice_no = 'PINV-' + Math.floor(100000 + Math.random() * 900000);
  const due = num(total) - num(paid);
  const status = due <= 0 ? 'paid' : (num(paid) > 0 ? 'partial' : 'unpaid');
  const ts = new Date().toISOString();
  const purchaseDate = date || ts.slice(0, 10);

  db.insert('purchases', {
    id, invoice_no, supplier_id: supplier_id || null, supplier_name, date: purchaseDate,
    subtotal: num(subtotal), discount: num(discount), tax: num(tax), total: num(total),
    paid: num(paid), due, status, notes: notes || '', created_at: ts,
  });
  items.forEach((it) => {
    db.insert('purchase_items', { id: uid(), purchase_id: id, product_id: it.product_id || null, product_name: it.product_name || '', qty: num(it.qty), price: num(it.price), total: num(it.total) });
    if (it.product_id) {
      const p = db.get('products', { id: it.product_id });
      if (p) db.update('products', it.product_id, { stock: num(p.stock) + num(it.qty), updated_at: ts });
    }
  });
  if (num(paid) > 0 && supplier_id) {
    const s = db.get('suppliers', { id: supplier_id });
    if (s) db.update('suppliers', supplier_id, { due_balance: num(s.due_balance) + due });
    db.insert('payments', { id: uid(), type: 'paid', party_type: 'supplier', party_id: supplier_id, party_name: supplier_name, amount: num(paid), date: purchaseDate, mode: 'cash', note: `Purchase ${invoice_no}`, created_at: ts });
  }
  const saved = db.get('purchases', { id });
  const savedItems = db.all('purchase_items', { purchase_id: id });
  resJson(res, 201, { ...saved, items: savedItems, invoice_no });
});

app.put('/api/purchases/:id', (req, res) => {
  if (!db.get('purchases', { id: req.params.id })) return res.status(404).json({ error: 'Not found' });
  const { paid, status } = req.body;
  const pur = db.get('purchases', { id: req.params.id });
  const newPaid = paid !== undefined ? num(paid) : pur.paid;
  const newDue = num(pur.total) - newPaid;
  const newStatus = status || (newDue <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid'));
  db.update('purchases', req.params.id, { paid: newPaid, due: newDue, status: newStatus });
  resJson(res, 200, db.get('purchases', { id: req.params.id }));
});

app.delete('/api/purchases/:id', (req, res) => {
  if (!db.get('purchases', { id: req.params.id })) return res.status(404).json({ error: 'Not found' });
  db.del('purchases', req.params.id);
  db.all('purchase_items', { purchase_id: req.params.id }).forEach((it) => db.del('purchase_items', it.id));
  resJson(res, 200, { ok: true });
});

// ---------- Payments ----------
app.get('/api/payments', (req, res) => {
  const { party_type, from, to } = req.query;
  let rows = db.all('payments');
  if (party_type) rows = rows.filter((p) => p.party_type === party_type);
  if (from) rows = rows.filter((p) => p.date >= from);
  if (to) rows = rows.filter((p) => p.date <= to);
  rows.sort((a, b) => (b.date||'').localeCompare(a.date||'') || (b.created_at||'').localeCompare(a.created_at||''));
  resJson(res, 200, rows);
});

app.post('/api/payments', requireBody(['type', 'party_type', 'party_name', 'amount']), (req, res) => {
  const { type, party_type, party_id, party_name, amount, date, mode, note } = req.body;
  const id = uid();
  const ts = new Date().toISOString();
  const payDate = date || ts.slice(0, 10);
  const row = db.insert('payments', { id, type, party_type, party_id: party_id || null, party_name, amount: num(amount), date: payDate, mode: mode || '', note: note || '', created_at: ts });
  resJson(res, 201, row);
});

// ---------- Reports ----------
app.get('/api/reports/dashboard', (req, res) => {
  const totalProducts = db.all('products').length;
  const sales = db.all('sales');
  const purchases = db.all('purchases');
  const sum = (rows, f) => rows.reduce((a, r) => a + num(f(r)), 0);
  const totalSales = { t: sum(sales, (r) => r.total), d: sum(sales, (r) => r.due), p: sum(sales, (r) => r.paid) };
  const totalPurchases = { t: sum(purchases, (r) => r.total), d: sum(purchases, (r) => r.due), p: sum(purchases, (r) => r.paid) };
  const products = db.all('products');
  const stockValue = products.reduce((a, p) => a + num(p.stock) * num(p.purchase_price), 0);
  const stockSaleValue = products.reduce((a, p) => a + num(p.stock) * num(p.sale_price), 0);
  const lowStock = products.filter((p) => num(p.min_stock) > 0 && num(p.stock) <= num(p.min_stock)).length;
  const customers = db.all('customers');
  const suppliers = db.all('suppliers');
  const customerDue = sum(customers, (c) => c.due_balance);
  const supplierDue = sum(suppliers, (s) => s.due_balance);
  resJson(res, 200, {
    totalProducts, sales: totalSales, purchases: totalPurchases,
    stock: { value: stockValue, saleValue: stockSaleValue }, lowStock,
    totalCustomers: customers.length, totalSuppliers: suppliers.length,
    customerDue, supplierDue, netDue: num(customerDue) - num(supplierDue),
  });
});

app.get('/api/reports/sales-summary', (req, res) => {
  const map = {};
  db.all('sales').forEach((r) => {
    const d = (r.date || '').slice(0, 10);
    if (!map[d]) map[d] = { n: 0, total: 0, due: 0 };
    map[d].n += 1; map[d].total += num(r.total); map[d].due += num(r.due);
  });
  const rows = Object.entries(map).map(([date, v]) => ({ date, ...v })).sort((a, b) => (b.date||'').localeCompare(a.date||''));
  resJson(res, 200, rows);
});

app.get('/api/reports/product-movement', (req, res) => {
  const sold = {}, bought = {}, rev = {};
  db.all('sale_items').forEach((it) => { sold[it.product_id] = (sold[it.product_id]||0) + num(it.qty); rev[it.product_id] = (rev[it.product_id]||0) + num(it.total); });
  db.all('purchase_items').forEach((it) => { bought[it.product_id] = (bought[it.product_id]||0) + num(it.qty); });
  const rows = db.all('products').map((p) => ({
    id: p.id, name: p.name, stock: p.stock, min_stock: p.min_stock, unit: p.unit,
    sold: sold[p.id] || 0, revenue: rev[p.id] || 0, bought: bought[p.id] || 0,
  })).sort((a, b) => (a.name||'').localeCompare(b.name||''));
  resJson(res, 200, rows);
});

app.get('/api/reports/dues', (req, res) => {
  const customers = db.all('customers').filter((c) => num(c.due_balance) > 0).map((c) => ({ id: c.id, name: c.name, phone: c.phone, due: c.due_balance })).sort((a, b) => num(b.due) - num(a.due));
  const suppliers = db.all('suppliers').filter((s) => num(s.due_balance) > 0).map((s) => ({ id: s.id, name: s.name, phone: s.phone, due: s.due_balance })).sort((a, b) => num(b.due) - num(a.due));
  resJson(res, 200, { customers, suppliers });
});

// ---------- DB backup download ----------
app.get('/api/_db', (req, res) => {
  const p = process.env.DB_PATH || path.join(__dirname, 'hishaaab.json');
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'db not found' });
  res.download(p, 'hishaaab.json');
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Hishaaab server running at http://localhost:${PORT}`);
});

process.on('SIGINT', () => { db.flush(); process.exit(0); });

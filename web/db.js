const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'hishaaab.json');

function num(v) { return v === null || v === undefined ? 0 : parseFloat(v) || 0; }

const DEFAULT_DATA = {
  products: [], customers: [], suppliers: [],
  sales: [], sale_items: [], purchases: [], purchase_items: [],
  payments: [], settings: [],
};

let data = null;
let dirty = false;

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      data = { ...DEFAULT_DATA, ...parsed };
      for (const k of Object.keys(DEFAULT_DATA)) if (!Array.isArray(data[k])) data[k] = DEFAULT_DATA[k];
    } else data = { ...DEFAULT_DATA };
  } catch (e) { data = { ...DEFAULT_DATA }; }
}

function save() {
  if (!dirty) return;
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch (e) { /* ignore */ }
  dirty = false;
}

load();

setInterval(save, 5000);
process.on('SIGINT', () => { save(); process.exit(0); });
process.on('SIGTERM', () => { save(); process.exit(0); });

function col(name) {
  if (!data[name]) data[name] = [];
  return data[name];
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function matches(row, where) {
  if (!where) return true;
  for (const k of Object.keys(where)) {
    const v = where[k];
    if (v === undefined || v === null) continue;
    const rv = row[k];
    if (typeof v === 'string' && v.startsWith('%') && v.endsWith('%')) {
      if (String(rv == null ? '' : rv).toLowerCase().indexOf(v.slice(1, -1).toLowerCase()) === -1) return false;
    } else if (String(rv) !== String(v)) return false;
  }
  return true;
}

const db = {
  all(table, where, orderBy, desc) {
    let rows = col(table).filter((r) => matches(r, where));
    if (orderBy) {
      rows.sort((a, b) => {
        const c = (a[orderBy] || '') < (b[orderBy] || '') ? -1 : (a[orderBy] || '') > (b[orderBy] || '') ? 1 : 0;
        return desc ? -c : c;
      });
    }
    return rows.map(clone);
  },
  get(table, where) {
    const rows = col(table).filter((r) => matches(r, where));
    return rows.length ? clone(rows[0]) : undefined;
  },
  insert(table, obj) {
    const row = { id: obj.id || uuidv4(), ...obj, created_at: obj.created_at || new Date().toISOString() };
    col(table).push(row);
    dirty = true;
    save();
    return clone(row);
  },
  update(table, id, changes) {
    const rows = col(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...changes, updated_at: new Date().toISOString() };
    dirty = true;
    save();
    return clone(rows[idx]);
  },
  del(table, id) {
    const rows = col(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    dirty = true;
    save();
    return true;
  },
  flush() { save(); },
  getData() { return clone(data); },
};

// seed if empty
if (data.products.length === 0) {
  const ins = (t, o) => db.insert(t, o);
  ins('products', { name: 'Basmati Rice 5kg', category: 'Grocery', sku: 'GR-001', purchase_price: 420, sale_price: 480, stock: 25, unit: 'kg', min_stock: 5, description: 'Fine basmati rice' });
  ins('products', { name: 'Wheat Flour 1kg', category: 'Grocery', sku: 'GR-002', purchase_price: 38, sale_price: 45, stock: 60, unit: 'kg', min_stock: 10, description: 'Premium wheat flour' });
  ins('products', { name: 'Sugar 1kg', category: 'Grocery', sku: 'GR-003', purchase_price: 42, sale_price: 52, stock: 40, unit: 'kg', min_stock: 8, description: 'Refined sugar' });
  ins('products', { name: 'Sunflower Oil 1L', category: 'Grocery', sku: 'GR-004', purchase_price: 130, sale_price: 155, stock: 30, unit: 'L', min_stock: 6, description: 'Cooking oil' });
  ins('products', { name: 'Ballpoint Pen', category: 'Stationery', sku: 'ST-001', purchase_price: 6, sale_price: 10, stock: 200, unit: 'pcs', min_stock: 20, description: 'Blue ink pen' });
  ins('products', { name: 'A4 Paper Ream', category: 'Stationery', sku: 'ST-002', purchase_price: 180, sale_price: 220, stock: 15, unit: 'pcs', min_stock: 3, description: '75gsm A4 paper' });
  ins('customers', { name: 'Rahim Store', phone: '01711000001', address: 'Dhaka', due_balance: 1250 });
  ins('customers', { name: 'Karim Traders', phone: '01711000002', address: 'Chattogram', due_balance: 0 });
  ins('customers', { name: 'Joya Enterprise', phone: '01711000003', address: 'Sylhet', due_balance: 450 });
  ins('suppliers', { name: 'BD Wholesale Co.', phone: '01811000001', address: 'Dhaka', due_balance: 3200 });
  ins('suppliers', { name: 'Agri Foods Ltd', phone: '01811000002', address: 'Gazipur', due_balance: 0 });
}

module.exports = { db };

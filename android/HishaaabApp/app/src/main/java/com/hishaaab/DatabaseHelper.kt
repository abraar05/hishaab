package com.hishaaab

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class DatabaseHelper(context: Context) : SQLiteOpenHelper(context, DB_NAME, null, VERSION) {

    companion object {
        private const val DB_NAME = "hishaaab.db"
        private const val VERSION = 1
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS products (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, sku TEXT,
              purchase_price REAL DEFAULT 0, sale_price REAL DEFAULT 0, stock REAL DEFAULT 0,
              unit TEXT DEFAULT 'pcs', min_stock REAL DEFAULT 0, description TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS customers (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, address TEXT,
              due_balance REAL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS suppliers (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, address TEXT,
              due_balance REAL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS sales (
              id TEXT PRIMARY KEY, invoice_no TEXT UNIQUE, customer_id TEXT,
              customer_name TEXT, date TEXT, subtotal REAL DEFAULT 0, discount REAL DEFAULT 0,
              tax REAL DEFAULT 0, total REAL DEFAULT 0, paid REAL DEFAULT 0, due REAL DEFAULT 0,
              status TEXT DEFAULT 'partial', notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(customer_id) REFERENCES customers(id))
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS sale_items (
              id TEXT PRIMARY KEY, sale_id TEXT NOT NULL, product_id TEXT,
              product_name TEXT, qty REAL DEFAULT 0, price REAL DEFAULT 0, total REAL DEFAULT 0,
              FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
              FOREIGN KEY(product_id) REFERENCES products(id))
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS purchases (
              id TEXT PRIMARY KEY, invoice_no TEXT UNIQUE, supplier_id TEXT,
              supplier_name TEXT, date TEXT, subtotal REAL DEFAULT 0, discount REAL DEFAULT 0,
              tax REAL DEFAULT 0, total REAL DEFAULT 0, paid REAL DEFAULT 0, due REAL DEFAULT 0,
              status TEXT DEFAULT 'partial', notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(supplier_id) REFERENCES suppliers(id))
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS purchase_items (
              id TEXT PRIMARY KEY, purchase_id TEXT NOT NULL, product_id TEXT,
              product_name TEXT, qty REAL DEFAULT 0, price REAL DEFAULT 0, total REAL DEFAULT 0,
              FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
              FOREIGN KEY(product_id) REFERENCES products(id))
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS payments (
              id TEXT PRIMARY KEY, type TEXT, party_type TEXT, party_id TEXT,
              party_name TEXT, amount REAL DEFAULT 0, date TEXT, mode TEXT, note TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP)
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY, value TEXT)
        """.trimIndent())
        seed(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS settings")
        db.execSQL("DROP TABLE IF EXISTS payments")
        db.execSQL("DROP TABLE IF EXISTS purchase_items")
        db.execSQL("DROP TABLE IF EXISTS purchases")
        db.execSQL("DROP TABLE IF EXISTS sale_items")
        db.execSQL("DROP TABLE IF EXISTS sales")
        db.execSQL("DROP TABLE IF EXISTS suppliers")
        db.execSQL("DROP TABLE IF EXISTS customers")
        db.execSQL("DROP TABLE IF EXISTS products")
        onCreate(db)
    }

    private fun seed(db: SQLiteDatabase) {
        val count = db.rawQuery("SELECT COUNT(*) FROM products", null)
        if (count.moveToFirst() && count.getInt(0) == 0) {
            val now = java.time.Instant.now().toString()
            val insP = db.compileStatement("INSERT INTO products (id,name,category,sku,purchase_price,sale_price,stock,unit,min_stock,description,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
            val insC = db.compileStatement("INSERT INTO customers (id,name,phone,address,due_balance,created_at) VALUES (?,?,?,?,?,?)")
            val insS = db.compileStatement("INSERT INTO suppliers (id,name,phone,address,due_balance,created_at) VALUES (?,?,?,?,?,?)")
            fun uid() = java.util.UUID.randomUUID().toString()
            db.beginTransaction()
            try {
                var id = uid(); insP.bindString(1,id); insP.bindString(2,"Basmati Rice 5kg"); insP.bindString(3,"Grocery"); insP.bindString(4,"GR-001"); insP.bindDouble(5,420.0); insP.bindDouble(6,480.0); insP.bindDouble(7,25.0); insP.bindString(8,"kg"); insP.bindDouble(9,5.0); insP.bindString(10,"Fine basmati rice"); insP.bindString(11,now); insP.bindString(12,now); insP.executeInsert()
                id = uid(); insP.bindString(1,id); insP.bindString(2,"Wheat Flour 1kg"); insP.bindString(3,"Grocery"); insP.bindString(4,"GR-002"); insP.bindDouble(5,38.0); insP.bindDouble(6,45.0); insP.bindDouble(7,60.0); insP.bindString(8,"kg"); insP.bindDouble(9,10.0); insP.bindString(10,"Premium wheat flour"); insP.bindString(11,now); insP.bindString(12,now); insP.executeInsert()
                id = uid(); insP.bindString(1,id); insP.bindString(2,"Sugar 1kg"); insP.bindString(3,"Grocery"); insP.bindString(4,"GR-003"); insP.bindDouble(5,42.0); insP.bindDouble(6,52.0); insP.bindDouble(7,40.0); insP.bindString(8,"kg"); insP.bindDouble(9,8.0); insP.bindString(10,"Refined sugar"); insP.bindString(11,now); insP.bindString(12,now); insP.executeInsert()
                id = uid(); insP.bindString(1,id); insP.bindString(2,"Sunflower Oil 1L"); insP.bindString(3,"Grocery"); insP.bindString(4,"GR-004"); insP.bindDouble(5,130.0); insP.bindDouble(6,155.0); insP.bindDouble(7,30.0); insP.bindString(8,"L"); insP.bindDouble(9,6.0); insP.bindString(10,"Cooking oil"); insP.bindString(11,now); insP.bindString(12,now); insP.executeInsert()
                id = uid(); insP.bindString(1,id); insP.bindString(2,"Ballpoint Pen"); insP.bindString(3,"Stationery"); insP.bindString(4,"ST-001"); insP.bindDouble(5,6.0); insP.bindDouble(6,10.0); insP.bindDouble(7,200.0); insP.bindString(8,"pcs"); insP.bindDouble(9,20.0); insP.bindString(10,"Blue ink pen"); insP.bindString(11,now); insP.bindString(12,now); insP.executeInsert()
                id = uid(); insP.bindString(1,id); insP.bindString(2,"A4 Paper Ream"); insP.bindString(3,"Stationery"); insP.bindString(4,"ST-002"); insP.bindDouble(5,180.0); insP.bindDouble(6,220.0); insP.bindDouble(7,15.0); insP.bindString(8,"pcs"); insP.bindDouble(9,3.0); insP.bindString(10,"75gsm A4 paper"); insP.bindString(11,now); insP.bindString(12,now); insP.executeInsert()
                id = uid(); insC.bindString(1,id); insC.bindString(2,"Rahim Store"); insC.bindString(3,"01711000001"); insC.bindString(4,"Dhaka"); insC.bindDouble(5,1250.0); insC.bindString(6,now); insC.executeInsert()
                id = uid(); insC.bindString(1,id); insC.bindString(2,"Karim Traders"); insC.bindString(3,"01711000002"); insC.bindString(4,"Chattogram"); insC.bindDouble(5,0.0); insC.bindString(6,now); insC.executeInsert()
                id = uid(); insC.bindString(1,id); insC.bindString(2,"Joya Enterprise"); insC.bindString(3,"01711000003"); insC.bindString(4,"Sylhet"); insC.bindDouble(5,450.0); insC.bindString(6,now); insC.executeInsert()
                id = uid(); insS.bindString(1,id); insS.bindString(2,"BD Wholesale Co."); insS.bindString(3,"01811000001"); insS.bindString(4,"Dhaka"); insS.bindDouble(5,3200.0); insS.bindString(6,now); insS.executeInsert()
                id = uid(); insS.bindString(1,id); insS.bindString(2,"Agri Foods Ltd"); insS.bindString(3,"01811000002"); insS.bindString(4,"Gazipur"); insS.bindDouble(5,0.0); insS.bindString(6,now); insS.executeInsert()
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        }
        count.close()
    }
}

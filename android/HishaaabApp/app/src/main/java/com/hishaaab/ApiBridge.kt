package com.hishaaab

import android.annotation.SuppressLint
import android.content.ContentValues
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.locks.ReentrantLock

class ApiBridge(private val dbHelper: DatabaseHelper) {

    private val lock = ReentrantLock()

    private fun parsePathQuery(ep: String): Pair<String, String> {
        return if (ep.contains("?")) {
            val parts = ep.split("?", limit = 2)
            Pair(parts[0], parts[1])
        } else Pair(ep, "")
    }

    @JavascriptInterface
    fun call(endpoint: String, bodyJson: String): String {
        lock.lock()
        return try {
            val (path, query) = parsePathQuery(endpoint)
            val db = dbHelper.readableDatabase
            val j = if (bodyJson.isBlank()) JSONObject() else JSONObject(bodyJson)
            // merge URL query params into body (for GET filters)
            if (query.isNotEmpty()) {
                query.split("&").forEach { pair ->
                    val kv = pair.split("=", limit = 2)
                    if (kv.size == 2 && !j.has(kv[0])) j.put(kv[0], kv[1])
                }
            }
            val method = j.optString("_method", "GET").uppercase()
            val result = when {
                path == "/api/settings" -> settingsRoute(db, method, j)
                path == "/api/products" -> productsRoute(db, method, j, null)
                path.startsWith("/api/products/") -> productsRoute(db, method, j, path.substringAfterLast("/"))
                path == "/api/customers" -> partyRoute(db, "customers", method, j, null)
                path.startsWith("/api/customers/") -> partyRoute(db, "customers", method, j, path.substringAfterLast("/"))
                path == "/api/suppliers" -> partyRoute(db, "suppliers", method, j, null)
                path.startsWith("/api/suppliers/") -> partyRoute(db, "suppliers", method, j, path.substringAfterLast("/"))
                path == "/api/sales" -> salesRoute(db, method, j, null)
                path.startsWith("/api/sales/") -> salesRoute(db, method, j, path.substringAfterLast("/"))
                path == "/api/purchases" -> purchasesRoute(db, method, j, null)
                path.startsWith("/api/purchases/") -> purchasesRoute(db, method, j, path.substringAfterLast("/"))
                path == "/api/payments" -> paymentsRoute(db, method, j)
                path == "/api/reports/dashboard" -> dashboard(db)
                path == "/api/reports/sales-summary" -> salesSummary(db)
                path == "/api/reports/product-movement" -> productMovement(db)
                path == "/api/reports/dues" -> dues(db)
                path == "/api/_export" -> exportAll(db)
                path == "/api/_reset" -> { dbHelper.resetAll(); ok() }
                else -> error("Unknown endpoint: $path")
            }
            db.close()
            result
        } catch (e: Exception) {
            error(e.message ?: "Unknown error")
        } finally {
            lock.unlock()
        }
    }

    // ---------- tiny helpers ----------
    private fun str(j: JSONObject, k: String, d: String = ""): String = j.optString(k, d)
    private fun dbl(j: JSONObject, k: String, d: Double = 0.0): Double = j.optDouble(k, d)
    private fun oid(j: JSONObject, k: String): String? = if (j.isNull(k)) null else j.optString(k, null)
    private fun error(msg: String) = JSONObject().put("error", msg).toString()
    private fun ok() = JSONObject().put("ok", true).toString()

    private fun exportAll(db: android.database.sqlite.SQLiteDatabase): String {
        val out = JSONObject()
        for (t in listOf("products", "customers", "suppliers", "sales", "sale_items",
                "purchases", "purchase_items", "payments", "settings")) {
            out.put(t, db.rawQuery("SELECT * FROM $t", null).use { toArray(it) })
        }
        return out.toString()
    }
    private fun nowIso() = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())
    private fun today() = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

    private fun toArray(c: android.database.Cursor): JSONArray {
        val arr = JSONArray(); val cols = c.columnNames
        while (c.moveToNext()) {
            val o = JSONObject()
            for (i in cols.indices) {
                when {
                    c.isNull(i) -> o.put(cols[i], JSONObject.NULL)
                    c.getType(i) == android.database.Cursor.FIELD_TYPE_INTEGER -> o.put(cols[i], c.getLong(i))
                    c.getType(i) == android.database.Cursor.FIELD_TYPE_FLOAT -> o.put(cols[i], c.getDouble(i))
                    else -> o.put(cols[i], c.getString(i))
                }
            }
            arr.put(o)
        }
        return arr
    }

    private fun likeCols(j: JSONObject, vararg cols: String): Pair<String, Array<String>>? {
        val q = str(j, "q")
        return if (q.isEmpty()) null else Pair(cols.joinToString(" AND ") { "$it LIKE ?" }, cols.map { "%$q%" }.toTypedArray())
    }

    // ---------- settings ----------
    private fun settingsRoute(db: android.database.sqlite.SQLiteDatabase, method: String, j: JSONObject): String {
        return when (method) {
            "GET" -> {
                val out = JSONObject()
                db.query("settings", arrayOf("key", "value"), null, null, null, null, null).use { c ->
                    while (c.moveToNext()) out.put(c.getString(0), c.getString(1))
                }
                out.toString()
            }
            "POST" -> {
                val key = str(j, "key")
                if (key.isEmpty()) return error("key required")
                val cv = ContentValues().apply { put("value", str(j, "value")) }
                val exists = db.query("settings", arrayOf("key"), "key=?", arrayOf(key), null, null, null).use { it.moveToFirst() }
                if (exists) db.update("settings", cv, "key=?", arrayOf(key)) else db.insert("settings", null, cv).apply {}
                ok()
            }
            else -> error("Method $method not allowed")
        }
    }

    // ---------- products ----------
    private fun productsRoute(db: android.database.sqlite.SQLiteDatabase, method: String, j: JSONObject, id: String?): String {
        return when (method) {
            "GET" -> if (id == null) listProducts(db, j) else getProduct(db, id)
            "POST" -> createProduct(db, j)
            "PUT" -> if (id == null) error("id required") else updateProduct(db, id, j)
            "DELETE" -> if (id == null) error("id required") else deleteRow(db, "products", id)
            else -> error("Method $method not allowed")
        }
    }
    private fun listProducts(db: android.database.sqlite.SQLiteDatabase, j: JSONObject): String {
        val like = likeCols(j, "name", "sku", "category")
        var sql = "SELECT * FROM products"; val args = mutableListOf<String>()
        if (like != null) { sql += " WHERE ${like.first}"; args.addAll(like.second.toList()) }
        val low = str(j, "lowStock")
        if (low == "1" || low.equals("true", ignoreCase = true)) sql += (if (like != null) " AND " else " WHERE ") + "min_stock > 0 AND stock <= min_stock"
        sql += " ORDER BY name COLLATE NOCASE"
        return db.rawQuery(sql, args.toTypedArray()).use { toArray(it).toString() }
    }
    private fun getProduct(db: android.database.sqlite.SQLiteDatabase, id: String): String {
        return db.query("products", null, "id=?", arrayOf(id), null, null, null).use { c ->
            if (!c.moveToFirst()) error("Not found") else toArray(c).optJSONObject(0)!!.toString()
        }
    }
    private fun createProduct(db: android.database.sqlite.SQLiteDatabase, j: JSONObject): String {
        val name = str(j, "name")
        if (name.isEmpty()) return error("name required")
        val id = UUID.randomUUID().toString(); val now = nowIso()
        db.insert("products", null, productValues(j).apply {
            put("id", id); put("created_at", now); put("updated_at", now)
        })
        return JSONObject(mapOf("id" to id, "ok" to true)).toString()
    }
    private fun updateProduct(db: android.database.sqlite.SQLiteDatabase, id: String, j: JSONObject): String {
        val n = db.update("products", productValues(j).apply { put("updated_at", nowIso()) }, "id=?", arrayOf(id))
        return JSONObject(mapOf("ok" to (n > 0))).toString()
    }
    private fun productValues(j: JSONObject): ContentValues {
        val cv = ContentValues()
        for (k in listOf("name","category","sku","purchase_price","sale_price","stock","unit","min_stock","description")) {
            if (j.has(k) && !j.isNull(k)) {
                when (k) { "purchase_price","sale_price","stock","min_stock" -> cv.put(k, dbl(j,k)); else -> cv.put(k, str(j,k)) }
            }
        }
        return cv
    }

    // ---------- parties ----------
    private fun partyRoute(db: android.database.sqlite.SQLiteDatabase, table: String, method: String, j: JSONObject, id: String?): String {
        return when (method) {
            "GET" -> if (id == null) listParties(db, table, j) else getParty(db, table, id)
            "POST" -> createParty(db, table, j)
            "PUT" -> if (id == null) error("id required") else updateParty(db, table, id, j)
            "DELETE" -> if (id == null) error("id required") else deleteRow(db, table, id)
            else -> error("Method $method not allowed")
        }
    }
    private fun listParties(db: android.database.sqlite.SQLiteDatabase, table: String, j: JSONObject): String {
        val like = likeCols(j, "name", "phone")
        var sql = "SELECT * FROM $table"; val args = mutableListOf<String>()
        if (like != null) { sql += " WHERE ${like.first}"; args.addAll(like.second.toList()) }
        sql += " ORDER BY name COLLATE NOCASE"
        return db.rawQuery(sql, args.toTypedArray()).use { toArray(it).toString() }
    }
    private fun getParty(db: android.database.sqlite.SQLiteDatabase, table: String, id: String): String {
        return db.query(table, null, "id=?", arrayOf(id), null, null, null).use { c ->
            if (!c.moveToFirst()) error("Not found") else toArray(c).optJSONObject(0)!!.toString()
        }
    }
    private fun createParty(db: android.database.sqlite.SQLiteDatabase, table: String, j: JSONObject): String {
        val name = str(j, "name")
        if (name.isEmpty()) return error("name required")
        val id = UUID.randomUUID().toString(); val now = nowIso()
        val cv = ContentValues().apply {
            put("id", id); put("name", name); put("phone", str(j, "phone", ""))
            put("address", str(j, "address", "")); put("due_balance", dbl(j, "due_balance"))
            put("created_at", now)
        }
        db.insert(table, null, cv)
        return JSONObject(mapOf("id" to id, "ok" to true)).toString()
    }
    private fun updateParty(db: android.database.sqlite.SQLiteDatabase, table: String, id: String, j: JSONObject): String {
        val cv = ContentValues().apply {
            if (j.has("name")) put("name", str(j,"name"))
            if (j.has("phone")) put("phone", str(j,"phone",""))
            if (j.has("address")) put("address", str(j,"address",""))
            if (j.has("due_balance")) put("due_balance", dbl(j,"due_balance"))
        }
        val n = db.update(table, cv, "id=?", arrayOf(id))
        return JSONObject(mapOf("ok" to (n > 0))).toString()
    }

    // ---------- sales ----------
    private fun salesRoute(db: android.database.sqlite.SQLiteDatabase, method: String, j: JSONObject, id: String?): String {
        return when (method) {
            "GET" -> if (id == null) listSales(db, j) else getSale(db, id)
            "POST" -> createSale(db, j)
            "PUT" -> if (id == null) error("id required") else updateSalePaid(db, id, j)
            "DELETE" -> if (id == null) error("id required") else deleteSale(db, id)
            else -> error("Method $method not allowed")
        }
    }
    private fun listSales(db: android.database.sqlite.SQLiteDatabase, j: JSONObject): String {
        val q = str(j, "q"); val from = str(j, "from"); val to = str(j, "to")
        val conds = mutableListOf<String>(); val args = mutableListOf<String>()
        if (q.isNotEmpty()) { conds.add("(invoice_no LIKE ? OR customer_name LIKE ?)"); args.add("%$q%"); args.add("%$q%") }
        if (from.isNotEmpty()) { conds.add("date >= ?"); args.add(from) }
        if (to.isNotEmpty()) { conds.add("date <= ?"); args.add(to) }
        var sql = "SELECT s.*, c.name AS customer_label FROM sales s LEFT JOIN customers c ON c.id = s.customer_id"
        if (conds.isNotEmpty()) sql += " WHERE " + conds.joinToString(" AND ")
        sql += " ORDER BY date DESC, created_at DESC"
        return db.rawQuery(sql, args.toTypedArray()).use { toArray(it).toString() }
    }
    private fun getSale(db: android.database.sqlite.SQLiteDatabase, id: String): String {
        return db.query("sales", null, "id=?", arrayOf(id), null, null, null).use { sc ->
            if (!sc.moveToFirst()) return@use error("Not found")
            val sale = toArray(sc).optJSONObject(0)!!
            db.query("sale_items", null, "sale_id=?", arrayOf(id), null, null, null).use { ic ->
                sale.put("items", toArray(ic))
            }
            sale.toString()
        }
    }
    private fun createSale(db: android.database.sqlite.SQLiteDatabase, j: JSONObject): String {
        val customerName = str(j, "customer_name")
        if (customerName.isEmpty()) return error("customer_name required")
        val items = j.optJSONArray("items")
        if (items == null || items.length() == 0) return error("Add at least one item")
        val id = UUID.randomUUID().toString()
        val invoice = "INV-${100000 + (Math.random() * 900000).toInt()}"
        val date = str(j, "date", today())
        val sub = dbl(j,"subtotal"); val disc = dbl(j,"discount"); val tax = dbl(j,"tax")
        val total = dbl(j,"total"); val paid = dbl(j,"paid"); val due = total - paid
        val status = if (due <= 0) "paid" else if (paid > 0) "partial" else "unpaid"
        val notes = str(j, "notes"); val cid = oid(j, "customer_id"); val now = nowIso()
        db.beginTransaction()
        try {
            db.insert("sales", null, ContentValues().apply {
                put("id", id); put("invoice_no", invoice); put("customer_id", cid); put("customer_name", customerName)
                put("date", date); put("subtotal", sub); put("discount", disc); put("tax", tax)
                put("total", total); put("paid", paid); put("due", due); put("status", status)
                put("notes", notes); put("created_at", now)
            })
            for (i in 0 until items.length()) {
                val it = items.getJSONObject(i)
                val pid = oid(it, "product_id"); val qty = dbl(it, "qty"); val price = dbl(it, "price"); val itotal = dbl(it, "total")
                db.insert("sale_items", null, ContentValues().apply {
                    put("id", UUID.randomUUID().toString()); put("sale_id", id); put("product_id", pid)
                    put("product_name", str(it, "product_name")); put("qty", qty); put("price", price); put("total", itotal)
                })
                if (pid != null) {
                    db.query("products", arrayOf("stock"), "id=?", arrayOf(pid), null, null, null).use { pc ->
                        if (pc.moveToFirst()) db.update("products", ContentValues().apply {
                            put("stock", pc.getDouble(0) - qty); put("updated_at", now)
                        }, "id=?", arrayOf(pid))
                    }
                }
            }
            if (paid > 0 && cid != null) {
                db.query("customers", arrayOf("due_balance"), "id=?", arrayOf(cid), null, null, null).use { cc ->
                    if (cc.moveToFirst()) db.update("customers", ContentValues().apply {
                        put("due_balance", cc.getDouble(0) + due)
                    }, "id=?", arrayOf(cid))
                }
                db.insert("payments", null, ContentValues().apply {
                    put("id", UUID.randomUUID().toString()); put("type", "received"); put("party_type", "customer")
                    put("party_id", cid); put("party_name", customerName); put("amount", paid)
                    put("date", date); put("mode", "cash"); put("note", "Sale $invoice"); put("created_at", now)
                })
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
        return getSale(db, id)
    }
    private fun updateSalePaid(db: android.database.sqlite.SQLiteDatabase, id: String, j: JSONObject): String {
        val paid = dbl(j, "paid")
        return db.query("sales", arrayOf("total"), "id=?", arrayOf(id), null, null, null).use { sc ->
            if (!sc.moveToFirst()) return@use error("Not found")
            val total = sc.getDouble(0)
            val due = total - paid; val status = if (due <= 0) "paid" else if (paid > 0) "partial" else "unpaid"
            db.update("sales", ContentValues().apply { put("paid", paid); put("due", due); put("status", status) }, "id=?", arrayOf(id))
            getSale(db, id)
        }
    }
    private fun deleteSale(db: android.database.sqlite.SQLiteDatabase, id: String): String {
        val del = db.delete("sales", "id=?", arrayOf(id)) > 0
        db.delete("sale_items", "sale_id=?", arrayOf(id))
        return JSONObject(mapOf("ok" to del)).toString()
    }

    // ---------- purchases ----------
    private fun purchasesRoute(db: android.database.sqlite.SQLiteDatabase, method: String, j: JSONObject, id: String?): String {
        return when (method) {
            "GET" -> if (id == null) listPurchases(db, j) else getPurchase(db, id)
            "POST" -> createPurchase(db, j)
            "PUT" -> if (id == null) error("id required") else updatePurchasePaid(db, id, j)
            "DELETE" -> if (id == null) error("id required") else deletePurchase(db, id)
            else -> error("Method $method not allowed")
        }
    }
    private fun listPurchases(db: android.database.sqlite.SQLiteDatabase, j: JSONObject): String {
        val q = str(j, "q"); val from = str(j, "from"); val to = str(j, "to")
        val conds = mutableListOf<String>(); val args = mutableListOf<String>()
        if (q.isNotEmpty()) { conds.add("(invoice_no LIKE ? OR supplier_name LIKE ?)"); args.add("%$q%"); args.add("%$q%") }
        if (from.isNotEmpty()) { conds.add("date >= ?"); args.add(from) }
        if (to.isNotEmpty()) { conds.add("date <= ?"); args.add(to) }
        var sql = "SELECT p.*, s.name AS supplier_label FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id"
        if (conds.isNotEmpty()) sql += " WHERE " + conds.joinToString(" AND ")
        sql += " ORDER BY date DESC, created_at DESC"
        return db.rawQuery(sql, args.toTypedArray()).use { toArray(it).toString() }
    }
    private fun getPurchase(db: android.database.sqlite.SQLiteDatabase, id: String): String {
        return db.query("purchases", null, "id=?", arrayOf(id), null, null, null).use { sc ->
            if (!sc.moveToFirst()) return@use error("Not found")
            val pur = toArray(sc).optJSONObject(0)!!
            db.query("purchase_items", null, "purchase_id=?", arrayOf(id), null, null, null).use { ic ->
                pur.put("items", toArray(ic))
            }
            pur.toString()
        }
    }
    private fun createPurchase(db: android.database.sqlite.SQLiteDatabase, j: JSONObject): String {
        val supplierName = str(j, "supplier_name")
        if (supplierName.isEmpty()) return error("supplier_name required")
        val items = j.optJSONArray("items")
        if (items == null || items.length() == 0) return error("Add at least one item")
        val id = UUID.randomUUID().toString()
        val invoice = "PINV-${100000 + (Math.random() * 900000).toInt()}"
        val date = str(j, "date", today())
        val sub = dbl(j,"subtotal"); val disc = dbl(j,"discount"); val tax = dbl(j,"tax")
        val total = dbl(j,"total"); val paid = dbl(j,"paid"); val due = total - paid
        val status = if (due <= 0) "paid" else if (paid > 0) "partial" else "unpaid"
        val notes = str(j, "notes"); val sid = oid(j, "supplier_id"); val now = nowIso()
        db.beginTransaction()
        try {
            db.insert("purchases", null, ContentValues().apply {
                put("id", id); put("invoice_no", invoice); put("supplier_id", sid); put("supplier_name", supplierName)
                put("date", date); put("subtotal", sub); put("discount", disc); put("tax", tax)
                put("total", total); put("paid", paid); put("due", due); put("status", status)
                put("notes", notes); put("created_at", now)
            })
            for (i in 0 until items.length()) {
                val it = items.getJSONObject(i)
                val pid = oid(it, "product_id"); val qty = dbl(it, "qty"); val price = dbl(it, "price"); val itotal = dbl(it, "total")
                db.insert("purchase_items", null, ContentValues().apply {
                    put("id", UUID.randomUUID().toString()); put("purchase_id", id); put("product_id", pid)
                    put("product_name", str(it, "product_name")); put("qty", qty); put("price", price); put("total", itotal)
                })
                if (pid != null) {
                    db.query("products", arrayOf("stock"), "id=?", arrayOf(pid), null, null, null).use { pc ->
                        if (pc.moveToFirst()) db.update("products", ContentValues().apply {
                            put("stock", pc.getDouble(0) + qty); put("updated_at", now)
                        }, "id=?", arrayOf(pid))
                    }
                }
            }
            if (paid > 0 && sid != null) {
                db.query("suppliers", arrayOf("due_balance"), "id=?", arrayOf(sid), null, null, null).use { sc ->
                    if (sc.moveToFirst()) db.update("suppliers", ContentValues().apply {
                        put("due_balance", sc.getDouble(0) + due)
                    }, "id=?", arrayOf(sid))
                }
                db.insert("payments", null, ContentValues().apply {
                    put("id", UUID.randomUUID().toString()); put("type", "paid"); put("party_type", "supplier")
                    put("party_id", sid); put("party_name", supplierName); put("amount", paid)
                    put("date", date); put("mode", "cash"); put("note", "Purchase $invoice"); put("created_at", now)
                })
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
        return getPurchase(db, id)
    }
    private fun updatePurchasePaid(db: android.database.sqlite.SQLiteDatabase, id: String, j: JSONObject): String {
        val paid = dbl(j, "paid")
        return db.query("purchases", arrayOf("total"), "id=?", arrayOf(id), null, null, null).use { sc ->
            if (!sc.moveToFirst()) return@use error("Not found")
            val total = sc.getDouble(0)
            val due = total - paid; val status = if (due <= 0) "paid" else if (paid > 0) "partial" else "unpaid"
            db.update("purchases", ContentValues().apply { put("paid", paid); put("due", due); put("status", status) }, "id=?", arrayOf(id))
            getPurchase(db, id)
        }
    }
    private fun deletePurchase(db: android.database.sqlite.SQLiteDatabase, id: String): String {
        val del = db.delete("purchases", "id=?", arrayOf(id)) > 0
        db.delete("purchase_items", "purchase_id=?", arrayOf(id))
        return JSONObject(mapOf("ok" to del)).toString()
    }

    private fun deleteRow(db: android.database.sqlite.SQLiteDatabase, table: String, id: String): String {
        val del = db.delete(table, "id=?", arrayOf(id)) > 0
        return JSONObject(mapOf("ok" to del)).toString()
    }

    // ---------- payments ----------
    private fun paymentsRoute(db: android.database.sqlite.SQLiteDatabase, method: String, j: JSONObject): String {
        return when (method) {
            "GET" -> listPayments(db, j)
            "POST" -> createPayment(db, j)
            else -> error("Method $method not allowed")
        }
    }
    private fun listPayments(db: android.database.sqlite.SQLiteDatabase, j: JSONObject): String {
        val partyType = str(j, "party_type"); val from = str(j, "from"); val to = str(j, "to")
        val conds = mutableListOf<String>(); val args = mutableListOf<String>()
        if (partyType.isNotEmpty()) { conds.add("party_type=?"); args.add(partyType) }
        if (from.isNotEmpty()) { conds.add("date >= ?"); args.add(from) }
        if (to.isNotEmpty()) { conds.add("date <= ?"); args.add(to) }
        var sql = "SELECT * FROM payments"
        if (conds.isNotEmpty()) sql += " WHERE " + conds.joinToString(" AND ")
        sql += " ORDER BY date DESC, created_at DESC"
        return db.rawQuery(sql, args.toTypedArray()).use { toArray(it).toString() }
    }
    private fun createPayment(db: android.database.sqlite.SQLiteDatabase, j: JSONObject): String {
        val type = str(j, "type"); val pt = str(j, "party_type"); val pname = str(j, "party_name")
        if (type.isEmpty() || pt.isEmpty() || pname.isEmpty()) return error("type, party_type, party_name required")
        val id = UUID.randomUUID().toString(); val now = nowIso()
        db.insert("payments", null, ContentValues().apply {
            put("id", id); put("type", type); put("party_type", pt); put("party_id", oid(j, "party_id"))
            put("party_name", pname); put("amount", dbl(j, "amount")); put("date", str(j, "date", today()))
            put("mode", str(j, "mode", "")); put("note", str(j, "note", "")); put("created_at", now)
        })
        return JSONObject(mapOf("id" to id, "ok" to true)).toString()
    }

    // ---------- reports ----------
    private fun dashboard(db: android.database.sqlite.SQLiteDatabase): String {
        val out = JSONObject()
        fun cnt(sql: String): Int = db.rawQuery(sql, null).use { c -> c.moveToFirst(); c.getInt(0) }
        fun sum(t: String, col: String): Double = db.rawQuery("SELECT COALESCE(SUM($col),0) FROM $t", null).use { c -> c.moveToFirst(); c.getDouble(0) }
        out.put("totalProducts", cnt("SELECT COUNT(*) FROM products"))
        out.put("sales", JSONObject(mapOf("t" to sum("sales","total"), "d" to sum("sales","due"), "p" to sum("sales","paid"))))
        out.put("purchases", JSONObject(mapOf("t" to sum("purchases","total"), "d" to sum("purchases","due"), "p" to sum("purchases","paid"))))
        db.rawQuery("SELECT COALESCE(SUM(stock * purchase_price),0), COALESCE(SUM(stock * sale_price),0) FROM products", null).use { c ->
            c.moveToFirst(); out.put("stock", JSONObject(mapOf("v" to c.getDouble(0), "sv" to c.getDouble(1))))
        }
        out.put("lowStock", cnt("SELECT COUNT(*) FROM products WHERE min_stock > 0 AND stock <= min_stock"))
        out.put("totalCustomers", cnt("SELECT COUNT(*) FROM customers"))
        out.put("totalSuppliers", cnt("SELECT COUNT(*) FROM suppliers"))
        out.put("customerDue", sum("customers","due_balance"))
        out.put("supplierDue", sum("suppliers","due_balance"))
        out.put("netDue", sum("customers","due_balance") - sum("suppliers","due_balance"))
        return out.toString()
    }
    private fun salesSummary(db: android.database.sqlite.SQLiteDatabase): String {
        val arr = JSONArray()
        db.rawQuery("SELECT date, COUNT(*) n, COALESCE(SUM(total),0) total, COALESCE(SUM(due),0) due FROM sales GROUP BY date ORDER BY date DESC", null).use { c ->
            while (c.moveToNext()) arr.put(JSONObject(mapOf("date" to c.getString(0), "n" to c.getInt(1), "total" to c.getDouble(2), "due" to c.getDouble(3))))
        }
        return arr.toString()
    }
    private fun productMovement(db: android.database.sqlite.SQLiteDatabase): String {
        val arr = JSONArray()
        db.rawQuery("""
            SELECT p.id,p.name,p.stock,p.min_stock,p.unit,
                   COALESCE(s.sold,0) sold, COALESCE(s.rev,0) revenue, COALESCE(pu.bought,0) bought
            FROM products p
            LEFT JOIN (SELECT product_id,SUM(qty) sold,SUM(total) rev FROM sale_items GROUP BY product_id) s ON s.product_id=p.id
            LEFT JOIN (SELECT product_id,SUM(qty) bought FROM purchase_items GROUP BY product_id) pu ON pu.product_id=p.id
            ORDER BY p.name COLLATE NOCASE""", null).use { c ->
            while (c.moveToNext()) arr.put(JSONObject(mapOf(
                "id" to c.getString(0),"name" to c.getString(1),"stock" to c.getDouble(2),"min_stock" to c.getDouble(3),
                "unit" to c.getString(4),"sold" to c.getDouble(5),"revenue" to c.getDouble(6),"bought" to c.getDouble(7))))
        }
        return arr.toString()
    }
    private fun dues(db: android.database.sqlite.SQLiteDatabase): String {
        val out = JSONObject()
        fun partyDues(t: String): JSONArray {
            val arr = JSONArray()
            db.rawQuery("SELECT id,name,phone,due_balance FROM $t WHERE due_balance > 0 ORDER BY due_balance DESC", null).use { c ->
                while (c.moveToNext()) arr.put(JSONObject(mapOf("id" to c.getString(0),"name" to c.getString(1),"phone" to c.getString(2),"due" to c.getDouble(3))))
            }
            return arr
        }
        out.put("customers", partyDues("customers"))
        out.put("suppliers", partyDues("suppliers"))
        return out.toString()
    }
}

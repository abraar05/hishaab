package com.hishaaab

import android.content.ContentValues
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    private val apiBridge by lazy { ApiBridge(DatabaseHelper(this@MainActivity)) }

    @JavascriptInterface
    fun call(endpoint: String, bodyJson: String): String {
        return apiBridge.call(endpoint, bodyJson)
    }

    @JavascriptInterface
    fun saveFile(name: String, content: String): String {
        val safeName = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, "application/json")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: return "ERROR: could not create file"
                contentResolver.openOutputStream(uri)?.use { it.write(content.toByteArray(Charsets.UTF_8)) }
                uri.toString()
            } else {
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!dir.exists()) dir.mkdirs()
                val f = File(dir, safeName)
                f.writeText(content)
                f.absolutePath
            }
        } catch (e: Exception) {
            try {
                val f = File(getExternalFilesDir(null), safeName)
                f.writeText(content)
                f.absolutePath
            } catch (e2: Exception) {
                "ERROR: ${e2.message}"
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        val ws: WebSettings = webView.settings
        ws.javaScriptEnabled = true
        ws.domStorageEnabled = true
        ws.databaseEnabled = true
        ws.allowFileAccess = true
        ws.allowContentAccess = true
        ws.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
        ws.allowFileAccessFromFileURLs = true
        ws.allowUniversalAccessFromFileURLs = true

        webView.addJavascriptInterface(this, "Hishaaab")
        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView?, code: Int, desc: String?, url: String?) {
                super.onReceivedError(view, code, desc, url)
            }
        }
        webView.loadUrl("file:///android_asset/www/index.html")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}

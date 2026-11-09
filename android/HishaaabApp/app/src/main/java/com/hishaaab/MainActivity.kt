package com.hishaaab

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    private val apiBridge by lazy { ApiBridge(DatabaseHelper(this@MainActivity)) }

    @JavascriptInterface
    fun call(endpoint: String, bodyJson: String): String {
        return apiBridge.call(endpoint, bodyJson)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        val ws: WebSettings = webView.settings
        ws.javaScriptEnabled = true
        ws.domStorageEnabled = true
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

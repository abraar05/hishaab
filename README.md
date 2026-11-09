# Hishaaab — Offline Business Manager

Hishaaab is an offline-first business accounting & billing manager (a clean-room
replica of the "Hishabee Business" workflow). It tracks products, sales, purchases,
customers/suppliers, dues and reports — everything stored locally, no account needed.

This repository contains the **complete full-stack app**:

| Path | Description |
|------|-------------|
| `web/` | Node.js + Express web app with a JSON-file persistence layer (`db.js`) and a vanilla JS single-page UI. |
| `android/HishaaabApp/` | Native Android app (Kotlin). Bundles the same UI in a `WebView` and exposes a local **SQLite** backend through a JavaScript bridge (`ApiBridge`), so it runs fully offline. |
| `dist/` | Prebuilt, installable APKs. |

## Download / Install (Android)

Ready-to-install APKs are in [`dist/`](dist/) and attached to the
[Releases](../../releases) page.

- `dist/Hishaaab-1.0.0-release.apk` — release build (recommended)
- `dist/Hishaaab-1.0.0-debug.apk` — debug build

Package: `com.hishaaab.app` · version `1.0.0` · minSdk `24` · targetSdk `34`

Install on a device: enable "Install unknown apps" for your file manager/browser,
then open the `.apk`. All data is stored on-device in SQLite; nothing leaves the phone.

## Features

- Dashboard with sales/purchase/stock/dues KPIs
- Products with stock levels and low-stock alerts
- Sales book (invoices) with automatic stock decrement and customer due tracking
- Purchase book with automatic stock increment and supplier due tracking
- Customers & suppliers with due balances
- Payments (received / paid)
- Reports: dashboard, sales summary, product movement, dues
- JSON export / demo-data reset

## Run the web app

```bash
cd web
npm install
npm start        # http://localhost:3000
```

Data is persisted to `web/hishaaab.json`.

## Build the Android app

Requirements: JDK 17, Android SDK (platform 34, build-tools 34+).

```bash
cd android/HishaaabApp
./gradlew assembleRelease    # -> app/build/outputs/apk/release/app-release.apk
```

> **ARM64 hosts:** the official `aapt2` shipped in the Android SDK is x86-64 only.
> On an aarch64 Linux/Android (PRoot) machine, set
> `android.aapt2FromMavenOverride=/path/to/aarch64/build-tools/aapt2` in
> `gradle.properties` (see the commented line) so resource linking works.

## Project layout

```
web/                     Node/Express app + static UI
  server.js              REST API (mirrors the Android bridge endpoints)
  db.js                  JSON-file store
  public/                index.html / style.css / app.js (shared with Android)
android/HishaaabApp/
  app/src/main/assets/www/       same UI, loaded in the WebView
  app/src/main/java/com/hishaaab/
    MainActivity.kt               WebView host + JS bridge registration
    ApiBridge.kt                  Endpoint router over SQLite
    DatabaseHelper.kt             Schema + demo seed data
dist/                    Prebuilt APKs
```

## License

Provided as-is for personal/commercial use.

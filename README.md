<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Plus+Jakarta+Sans&weight=800&size=28&pause=1000&color=00D4FF&center=true&vCenter=true&width=600&lines=Welcome+To+ArulzXD+API;Fast+%F0%9F%9A%80+Reliable+%E2%9A%A1;Official+Developer+REST+Gateway;Powered+by+Node.js+%26+Express" alt="Typing SVG" />

<p>
  <img src="https://img.shields.io/badge/API-ONLINE-success?style=for-the-badge&logo=express">
  <img src="https://img.shields.io/badge/Version-v2.0-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/Database-MongoDB-green?style=for-the-badge&logo=mongodb">
  <img src="https://img.shields.io/badge/CDN-GitHub-black?style=for-the-badge&logo=github">
  <img src="https://img.shields.io/badge/Platform-Vercel-black?style=for-the-badge&logo=vercel">
</p>

<p>
  <b>Layanan Gateway REST API resmi untuk integrasi bot WhatsApp, website, aplikasi seluler, dan otomasi script.</b>
</p>

</div>

---

## 📋 Daftar Isi

- [✨ Tentang Project](#-tentang-project)
- [🎯 Fitur Utama & Kategori API](#-fitur-utama--kategori-api)
- [🔑 Akses & Tingkatan Role API Key](#-akses--tingkatan-role-api-key)
- [🖥️ Arsitektur & Struktur Folder Project](#️-arsitektur--struktur-folder-project)
- [🛠️ Panduan Pembuatan Endpoint Baru (Developer Guide)](#️-panduan-pembuatan-endpoint-baru-developer-guide)
  - [1. Response JSON Standard](#1-response-json-standard)
  - [2. Response Buffer / Media Output](#2-response-buffer--media-output)
  - [3. Response Custom Canvas / Image Manipulator](#3-response-custom-canvas--image-manipulator)
- [📁 Layanan Uploader & GitHub CDN Proxy](#-layanan-uploader--github-cdn-proxy)
- [🌐 Halaman & Navigation Routes](#-halaman--navigation-routes)
- [⚙️ Pengaturan Environment Variables](#%EF%B8%8F-pengaturan-environment-variables)
- [🚀 Panduan Deployment (Vercel & VPS/Local)](#-panduan-deployment-vercel--vpslocal)
- [📄 Lisensi & Kredit](#-lisensi--kredit)

---

## ✨ Tentang Project

**ArulzXD REST API Gateway** dikembangkan menggunakan Node.js dan Express.js sebagai platform penyedia endpoint serba guna. Website ini dilengkapi dengan dashboard berbasis Neobrutalism yang interaktif, dokumentasi langsung (Interactive Swagger-like UI), pemantau limit harian otomatis, sistem uploader media berbasis GitHub CDN Proxy, serta autentikasi multi-tier (Free, Premium, VIP).

- **Website / Dokumentasi Utama**: [https://api.arulzzxd.my.id/docs](https://api.arulzzxd.my.id/docs)
- **Base API Path**: `https://api.arulzzxd.my.id/api/`

---

## 🎯 Fitur Utama & Kategori API

Platform ini secara otomatis memuat (auto-load) seluruh file handler yang tersimpan di direktori `api/` menjadi rute API yang terstruktur:

- 🤖 **AI Tools**: Chatbot AI, Image Generation, Text Processing.
- 📥 **Downloader**: Downloader media sosial (TikTok, Instagram, YouTube, Videy, dll).
- 🔍 **Search & Stalker**: Pencarian data web, scraper terstruktur, dan analisis profil sosial.
- 🎨 **Canvas & Image Maker**: Pembuat banner kustom, meme generator, bingkai dialog Pixel Operator (`canvas-pixel.js`), dan kartu profil.
- 🛠️ **Tools & Utilities**: Web scraper (SSWeb), pemutar media, generator QRIS dinamis SNAP BI.
- 💬 **Pastecode & Uploader**: Penyimpanan kode snippet sementara dan pengunggah berkas publik.

---

## 🔑 Akses & Tingkatan Role API Key

Penggunaan endpoint API dikontrol berdasarkan role pengguna yang terdaftar di MongoDB:

| Tier Role | Batas Request (Limit) | Fitur Utama | Format API Key |
| :--- | :--- | :--- | :--- |
| **Free User** | 100 request / hari | Akses ke endpoint ber-tipe `free` | `arulzxdfree-xxxxx` |
| **Premium User** | 1,000 request / hari | Akses endpoint `free` & `premium` | `<username>prem-xxxxxx` |
| **VIP User** | Unlimited (Tanpa Batas) | Akses seluruh endpoint (`free`, `premium`, `vip`) + Custom API Key | Custom (4 - 30 Karakter) |

> 🕒 **Penting**: Reset limit harian terjadi otomatis setiap pukul 00:00 WIB (Asia/Jakarta) atau melalui sistem Cron Job terintegrasi.

---

## 🖥️ Arsitektur & Struktur Folder Project

```text
├── api/                       # Direktori Rute Endpoint API (Auto Load Router)
│   ├── ai/                    # Module Endpoint Artificial Intelligence
│   ├── downloader/            # Module Endpoint Scraper & Downloader
│   ├── search/                # Module Endpoint Pencarian & Stalker
│   ├── tools/                 # Module Tools, Utility & Web Capture
│   └── canvas/                # Module Visual Generator & Canvas Manipulator
├── public/                    # Frontend Views & Static HTML Pages
│   ├── home.html              # Landing Page / Beranda Utama
│   ├── login.html             # Halaman Login, Register & OAuth Gateway
│   ├── store.html             # Store Produk & Sistem Transaksi QRIS
│   ├── uploader.html          # Halaman Cloud File Uploader
│   ├── status.html            # Pemantau Status CPU & RAM Realtime
│   ├── profile.html           # Dashboard Profil User & Pengaturan Custom Key
│   └── pastecode.html         # Snippet Code Share Tool
├── script.js                  # Frontend Controller & Live Test Suite Documentation
├── styles.css                 # Custom Neobrutalism CSS Framework & Theme Preset Rules
├── index.js                   # Master Express App, Database Engine & Middlewares
└── README.md                  # Berkas Dokumentasi Repository
```

---

## 🛠️ Panduan Pembuatan Endpoint Baru (Developer Guide)

Untuk menambahkan endpoint baru ke sistem **ArulzXD API**, buat berkas JavaScript baru di bawah folder `api/<kategori>/<nama_file>.js`. File tersebut secara otomatis dideteksi dan ditampilkan di dokumentasi UI (`/docs` & `/api/apilist`).

### 1. Response JSON Standard

```javascript
// File: api/tools/example-json.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const text = req.query.text;
        if (!text) {
            return res.status(400).json({
                status: false,
                creator: "Arulz-XD",
                message: "Parameter 'text' wajib diisi!"
            });
        }

        return res.json({
            status: true,
            creator: "Arulz-XD",
            result: {
                input: text,
                timestamp: new Date().toISOString()
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: false,
            creator: "Arulz-XD",
            message: err.message
        });
    }
});

// Metadata Endpoint untuk Dashboard Docs
router.title = "Example JSON Processing";
router.desc = "Endpoint contoh untuk memproses data berformat JSON.";
router.status = "ready"; // Pilihan: 'ready' | 'update' | 'perbaikan'
router.type = "free";    // Pilihan: 'free' | 'premium' | 'vip'

module.exports = router;
```

### 2. Response Buffer / Media Output

```javascript
// File: api/tools/ssweb-hp.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ status: false, message: "Parameter 'url' wajib diisi!" });
    }

    try {
        const { data } = await axios.get(targetUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(data);

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': buffer.length
        });
        return res.end(buffer);
    } catch (e) {
        return res.status(500).json({ status: false, message: e.message });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
```

### 3. Response Custom Canvas / Image Manipulator

```javascript
// File: api/canvas/canvas-pixel.js
const express = require('express');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const name = req.query.name?.trim();
        const text = req.query.text?.trim();

        if (!name || !text) {
            return res.status(400).json({ status: false, message: "Parameter 'name' dan 'text' wajib!" });
        }

        const canvas = createCanvas(800, 400);
        const ctx = canvas.getContext('2d');

        // Lakukan pengolahan elemen grafik pada Canvas
        ctx.fillStyle = '#08131d';
        ctx.fillRect(0, 0, 800, 400);
        ctx.fillStyle = '#45d8d8';
        ctx.font = '28px "PixelOperator"';
        ctx.fillText(`${name}: ${text}`, 50, 100);

        const buffer = await canvas.encode('png');
        res.setHeader('Content-Type', 'image/png');
        return res.end(buffer);
    } catch (err) {
        return res.status(500).json({ status: false, message: err.message });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
```

---

## 📁 Layanan Uploader & GitHub CDN Proxy

Project ini dilengkapi dengan skema pengunggahan berkas publik tanpa bergantung pada media penyimpanan server lokal Vercel yang terisolasi.

- **Endpoint Upload**: `POST /uploadfile`
- **Tipe File Didukung**: Foto (PNG, JPG, WEBP), Video (MP4, WEBM), Berkas umum (ZIP, PDF, JSON).
- **Proses CDN Proxy**:
  1. File diunggah oleh pengguna via form multi-part `file`.
  2. Server membaca buffer berkas dan mengirimkannya via GitHub REST API ke repository CDN `arulzzzxd/cdn`.
  3. Berkas secara otomatis dapat diakses publik melalui rute proxy URL:
     `https://cdn.arulzzxd.my.id/files/<filename>`

---

## 🌐 Halaman & Navigation Routes

| Route Halaman | Method | Deskripsi Fungsi |
| :--- | :--- | :--- |
| `/` | `GET` | Landing Page utama projek dengan statistik server realtime. |
| `/docs` | `GET` | Dashboard dokumentasi interaktif API & Live Request Tester. |
| `/store` | `GET` | Toko produk digital, pemesanan otomatis, dan klaim voucher. |
| `/uploader` | `GET` | Interface drag-and-drop pengunggah berkas ke CDN. |
| `/status` | `GET` | Pemantau statistik beban CPU, penggunaan memori RAM, dan Uptime. |
| `/login` | `GET` | Form autentikasi lokal, Lupa Password, dan OAuth (Google / GitHub). |
| `/profile` | `GET` | Manajemen akun user, Custom API Key (VIP), dan histori aktivitas log. |

---

## ⚙️ Pengaturan Environment Variables

Sebelum menjalankan server, buat berkas `.env` atau atur variabel lingkungan berikut pada penyedia hosting Anda:

```env
# Server Configuration
PORT=3000
SESSION_SECRET=arulzxd_secret_session_key_99
JWT_SECRET=arulzxd-super-secret-jwt-key-999

# Database Connection
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/?appName=Cluster0

# OAuth Google & GitHub Credentials
GITHUB_CALLBACK_URL=https://api.arulzzxd.my.id/auth/github/callback
GOOGLE_CALLBACK_URL=https://api.arulzzxd.my.id/auth/google/callback

# Web Push Notification (Admin Dashboard)
VAPID_PUBLIC_KEY=BMobo2oz7OzClSggyEDzEdxq8xqeHlTixyjlaZTHGG1Wq3xAZpdw-FaqW6GA8puXmCh5h0OH3kYrl3daFgtBCes
VAPID_PRIVATE_KEY=Um_cVYMniHWsZNXNIAz0ffPuP8qVMC5ydJ303f4phU4
```

---

## 🚀 Panduan Deployment (Vercel & VPS/Local)

### Deploy via Vercel (Recommended)

1. **Fork** repository ini ke akun GitHub milik Anda.
2. Buka dashboard [Vercel](https://vercel.com) dan buat **New Project**.
3. Pilih repository fork Anda.
4. Masukkan seluruh **Environment Variables** di atas pada menu *Environment Variables* Vercel.
5. Klik **Deploy** dan tunggu proses instalasi dependensi selesai.

### Deploy via Local / VPS (Node.js Environment)

```bash
# 1. Clone repository
git clone https://github.com/arulzzzxd/api.git
cd api

# 2. Install dependensi
npm install

# 3. Jalankan server dalam mode development / production
npm start
```

---

## 📄 Lisensi & Kredit

Dioperasikan dan dikembangkan secara penuh oleh **ArulzXD**.
- **Owner & Developer**: Idzharul Haqqi Wening Pambudi Laras (ArulzXD)
- **Website**: [https://api.arulzzxd.my.id](https://api.arulzzxd.my.id)
- **Copyright**: © 2026 ARULZ-XD API REST CORE. All Rights Reserved.

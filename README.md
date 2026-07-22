# 🚀 ArulzXD API

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Poppins&weight=700&size=28&pause=1000&color=00D4FF&center=true&vCenter=true&width=600&lines=Welcome+To+ArulzXD+API;Fast+%F0%9F%9A%80+Reliable+%E2%9A%A1;Free+REST+API+Services;Developer+Friendly+API" alt="Typing SVG" />

<p>
  <img src="https://img.shields.io/badge/API-ONLINE-success?style=for-the-badge">
  <img src="https://img.shields.io/badge/Version-v1-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/Status-Active-green?style=for-the-badge">
</p>

</div>

---

## ✨ Tentang API

ArulzXD API adalah layanan REST API yang menyediakan berbagai endpoint untuk kebutuhan developer seperti:

- 🤖 AI Tools
- 📥 Downloader
- 🔍 Search Engine
- 🖼️ Image Generator
- 🎵 Media Tools
- 📊 Utilities
- ⚡ Fast Response

---

## 🎯 Features

```yaml
✓ Gratis Digunakan
✓ Response JSON
✓ Mudah Diintegrasikan
✓ Endpoint Lengkap
✓ Server Stabil
✓ Dokumentasi Jelas  try {
    const videoId = url.split("=")[1];
    if (!videoId) return res.status(400).json({ error: "Invalid 'url' parameter" });
    const anunyah = `https://cdn.videy.co/${videoId}.mp4`;
    const data = {
      fileurl: anunyah
    };
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
```
# for results in file form
```javascript
const express = require('express'); // must be used
const router = express.Router(); // must be used

router.get('/', async (req, res) => {
  const text = req.query.text; // for https://example.com/api?text=
  if (!text) return res.status(400).json({ error: "Missing 'text' parameter" });
  try {
// Your code
 const buffer = // buffer result from your code
    res.writeHead(200, {
                'Content-Type': 'mimetype-file'
                'Content-Length': buffer.length,
            });
res.end(buffer);
 } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router; // must be used
````
## Example:
```javascript
// in api/tools/ssweb-hp.js
const axios = require('axios');
const fetch = require('node-fetch');
const express = require('express');
const router = express.Router();

async function ssweb(url, { width = 1280, height = 720, full_page = false, device_scale = 1 } = {}) {
    try {
        if (!url.startsWith('https://')) throw new Error('Invalid url');
        if (isNaN(width) || isNaN(height) || isNaN(device_scale)) throw new Error('Width, height, and scale must be a number');
        if (typeof full_page !== 'boolean') throw new Error('Full page must be a boolean');
        
        const { data } = await axios.post('https://gcp.imagy.app/screenshot/createscreenshot', {
            url: url,
            browserWidth: parseInt(width),
            browserHeight: parseInt(height),
            fullPage: full_page,
            deviceScaleFactor: parseInt(device_scale),
            format: 'png'
        }, {
            headers: {
                'content-type': 'application/json',
                referer: 'https://imagy.app/full-page-screenshot-taker/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
            }
        });
        
        return data.fileUrl;
    } catch (error) {
        throw new Error(error.message);
    }
}

router.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing 'url' parameter" });
  try {
    const resultpic = await ssweb(url, { width: 720, height: 1280 })
    const buffernya = await fetch(resultpic).then((response) => response.buffer());
res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': buffernya.length,
            });
res.end(buffernya);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
```
-----

## 📄 How to add link bio to linkbio.json
```json
{
      "name": "Name bio",
      "url": "link bio"
}
```

## Example
```json
{
      "name": "Facebook",
      "url": "https://web.facebook.com/shikakuiyayn"
}
```
-----

## 🚀 How to *Deploy* to Vercel

1. Fork this repo
2. Log in to [vercel.com](https://vercel.com) with your GitHub account
3. Add a project and select your forked repo to deploy
4. Just wait for it to be ready
5. Once it's ready, you're free to customize or rename it, but don't forget to credit it

-----

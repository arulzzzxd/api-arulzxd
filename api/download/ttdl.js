/**
 * NAMA SCRAPE  :: SSSTIK SCRAPER
 * [•] PEMBUAT      :: DEFAN (dipastebin.web.id)
 * [•] BASIS        :: ssstik.io
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

// Fungsi untuk membuat token acak tt
function generateTT() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// Fungsi untuk ekstraksi data HTML menggunakan RegEx
function extractData(html) {
  const data = {};

  const noWmMatch = html.match(
    /href="(https:\/\/tikcdn\.io\/ssstik\/\d+[^"]+)"\s+class="[^"]*without_watermark[^"]*vignette_active[^"]*"/
  );
  if (noWmMatch) data.video_tanpa_watermark = noWmMatch[1];

  const mp3Match = html.match(
    /href="(https:\/\/tikcdn\.io\/ssstik\/m\/[^"]+)"\s+class="[^"]*music[^"]*"/
  );
  if (mp3Match) data.audio_mp3 = mp3Match[1];

  const captionMatch = html.match(/<p class="maintext">([^<]+)<\/p>/);
  if (captionMatch) data.caption = captionMatch[1];

  const authorMatch = html.match(/<h2>([^<]+)<\/h2>/);
  if (authorMatch) data.author = authorMatch[1];

  return data;
}

// Fungsi Scraper Utama SSSTIK
async function scrapeSsstik(url) {
  try {
    const tt = generateTT();
    
    // Menyusun form data urlencoded
    const params = new URLSearchParams();
    params.append('id', url);
    params.append('locale', 'en');
    params.append('tt', tt);

    const response = await axios.post("https://ssstik.io/abc?url=dl", params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "HX-Request": "true",
        "HX-Trigger": "_gcaptcha_pt",
        "HX-Target": "target",
        "HX-Current-URL": "https://ssstik.io/en",
        "User-Agent": "Mozilla/5.0 (Linux; Android 11; Termux) AppleWebKit/537.36",
        "Referer": "https://ssstik.io/en",
      },
    });

    return response.data;
  } catch (error) {
    throw error;
  }
}

// Endpoint GET Utama
router.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing 'url' parameter" });

  try {
    const html = await scrapeSsstik(url);
    const hasil = extractData(html);

    if (!hasil.video_tanpa_watermark) {
      return res.status(400).json({ error: "Gagal mendapatkan link. Cek URL atau coba lagi." });
    }

    return res.json({
      status: true,
      data: hasil
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
const express = require("express");
const axios = require("axios");

const router = express.Router();

// ==========================================
// CORE FUNCTION
// ==========================================

async function generateImage(prompt) {
  try {
    const targetUrl = `https://v2.api-varhad.my.id/ai/text2image?prompt=${encodeURIComponent(prompt)}`;
    
    // Mengambil gambar dalam bentuk arraybuffer
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    return {
      buffer: Buffer.from(response.data),
      contentType: response.headers['content-type'] || 'image/png'
    };
  } catch (error) {
    throw new Error(error.response ? `API Error: ${error.response.status}` : error.message);
  }
}

// ==========================================
// EXPRESS ROUTER ENDPOINT
// ==========================================

router.get("/", async (req, res) => {
  try {
    const text = req.query.text || req.query.prompt;

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Masukkan parameter 'text' atau 'prompt'. Contoh: ?text=cat"
      });
    }

    const { buffer, contentType } = await generateImage(text);

    // Mengirimkan buffer gambar secara langsung
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': buffer.length
    });

    return res.end(buffer);

  } catch (error) {
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      error: error.message
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;

const express = require("express");
const axios = require("axios");

const router = express.Router();

// ==========================================
// CORE FUNCTION
// ==========================================

async function generateImageBuffer(prompt) {
  try {
    const targetUrl = `https://v2.api-varhad.my.id/ai/text2image?prompt=${encodeURIComponent(prompt)}`;
    
    // 1. Ambil JSON dari API Varhad untuk mendapatkan URL gambarnya
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.data || !response.data.status || !response.data.result || !response.data.result.image) {
      throw new Error("Format respons dari API target tidak valid.");
    }

    const imageUrl = response.data.result.image;

    // 2. Download gambar tersebut menjadi buffer
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    return {
      buffer: Buffer.from(imageResponse.data),
      contentType: imageResponse.headers['content-type'] || 'image/png'
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
    const prompt = req.query.prompt;

    if (!prompt) {
      return res.status(400).json({
        status: false,
        message: "Masukkan parameter 'prompt'. Contoh: ?prompt=cat"
      });
    }

    const { buffer, contentType } = await generateImageBuffer(prompt);

    // Kirim langsung sebagai file gambar
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

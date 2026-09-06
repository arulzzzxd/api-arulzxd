/**
 * NAMA SCRAPE  :: REMOVAL.AI BACKGROUND REMOVER (JSON METADATA)
 * [•] BASIS    :: removal.ai
 */

const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");
const { fromBuffer } = require("file-type");

const router = express.Router();
const upload = multer();

const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'Accept-Language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6'
};

async function getWebToken() {
  const response = await axios.get('https://removal.ai/wp-admin/admin-ajax.php', {
    headers: commonHeaders,
    params: {
      action: 'ajax_get_webtoken',
      security: '4acc8a2f93'
    },
    timeout: 10000
  });

  if (!response.data?.data?.webtoken) {
    throw new Error("Gagal mengambil Web-Token dari Removal.ai");
  }

  return response.data.data.webtoken;
}

async function removeBgRemovalAi(fileBuffer, mimetype, originalName) {
  const mimeInfo = await fromBuffer(fileBuffer);
  const contentType = mimeInfo ? mimeInfo.mime : (mimetype || "image/jpeg");
  const filename = originalName || "input.jpg";

  const webToken = await getWebToken();

  const form = new FormData();
  form.append('image_file', fileBuffer, {
    filename: filename,
    contentType: contentType,
    knownLength: fileBuffer.length
  });

  const response = await axios.post('https://api.removal.ai/3.0/remove', form, {
    headers: {
      ...commonHeaders,
      ...form.getHeaders(),
      'Web-Token': webToken,
      'Origin': 'https://removal.ai',
      'Referer': 'https://removal.ai/'
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  if (!response.data || response.data.status !== 200) {
    throw new Error("Gagal memproses gambar pada server Removal.ai");
  }

  return response.data;
}

// --- ENDPOINT ROUTE (METHOD POST) ---
router.post("/", upload.single("fileupload"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Berkas 'fileupload' wajib diunggah!"
      });
    }

    const result = await removeBgRemovalAi(file.buffer, file.mimetype, file.originalname);

    return res.json({
      status: true,
      creator: 'ArulzXD',
      result: {
        url: result.url,
        lowResolution: result.low_resolution,
        highResolution: result.high_resolution,
        originalUrl: result.original,
        dimensions: {
          originalWidth: result.original_width,
          originalHeight: result.original_height,
          previewWidth: result.preview_width,
          previewHeight: result.preview_height
        }
      }
    });

  } catch (err) {
    console.error("====== SCRAPER ERROR LOG ======");
    console.error(err.response?.data || err.message);
    console.error("===============================");

    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message,
      detail: err.response?.data || null
    });
  }
});

// --- CONFIG PARAMETERS UNTUK DASHBOARD UI ---
router.paramsConfig = {
  fileupload: {
    type: "file",
    desc: "Berkas gambar yang akan dihapus latar belakangnya"
  }
};

router.desc = "Menghapus background gambar via Removal.ai dan mengembalikan JSON URL metadata hasil pemrosesan.";
router.status = "ready";
router.type = "free";

module.exports = router;

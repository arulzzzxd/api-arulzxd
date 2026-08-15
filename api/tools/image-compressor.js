/**
 * NAMA SCRAPE  :: ILOVEIMG IMAGE COMPRESSOR
 * [•] BASIS        :: iloveimg.com
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const { fromBuffer } = require('file-type');

const router = express.Router();
const upload = multer();

const TOOL = "compressimage";
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";

const SERVERS = [
  "api1g", "api2g", "api3g", "api8g", "api9g", "api10g", "api11g",
  "api12g", "api13g", "api14g", "api15g", "api16g", "api17g",
  "api18g", "api19g", "api20g", "api21g", "api22g", "api24g", "api25g",
  "api1", "api2", "api3", "api4", "api5", "api6", "api7", "api8",
  "api9", "api10", "api11", "api12", "api13", "api14", "api15",
  "api16", "api17", "api18", "api19", "api20", "api21", "api22",
  "api23", "api24", "api25", "api26", "api27", "api28", "api29",
  "api30", "api31", "api32", "api33", "api34", "api35", "api36",
  "api37", "api38", "api39", "api40"
];

function randomTask(length = 120) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  while (result.length < length) {
    const bytes = crypto.randomBytes(length);
    for (const byte of bytes) {
      if (result.length >= length) break;
      result += chars[byte % chars.length];
    }
  }
  return result;
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".tif" || ext === ".tiff") return "image/tiff";
  return "image/jpeg";
}

async function getToken() {
  const res = await axios.get("https://www.iloveimg.com/compress-image", {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    timeout: 120000,
    validateStatus: () => true
  });

  if (res.status !== 200) {
    throw new Error(`Gagal membuka halaman token: HTTP ${res.status}`);
  }

  const $ = cheerio.load(res.data);
  const script = $("script")
    .filter((_, el) => String($(el).html() || "").includes("ilovepdfConfig ="))
    .html();

  if (!script) throw new Error("Config script tidak ditemukan");

  const jsonText = script.split("ilovepdfConfig = ")[1]?.split(";")[0];
  if (!jsonText) throw new Error("Config JSON tidak ditemukan");

  const json = JSON.parse(jsonText);
  const csrf = $("meta[name='csrf-token']").attr("content");

  if (!json.token || !csrf) throw new Error("Token atau CSRF tidak ditemukan");

  return { token: json.token, csrf };
}

async function uploadImageBuffer(server, headers, imageBuffer, filename, mimetype, task) {
  const mimeInfo = await fromBuffer(imageBuffer);
  const contentType = mimeInfo ? mimeInfo.mime : (mimetype || getContentType(filename));

  const form = new FormData();
  form.append("name", filename);
  form.append("chunk", "0");
  form.append("chunks", "1");
  form.append("task", task);
  form.append("preview", "1");
  form.append("file", imageBuffer, {
    filename: filename,
    contentType: contentType,
    knownLength: imageBuffer.length
  });

  const res = await axios.post(`https://${server}.iloveimg.com/v1/upload`, form, {
    headers: {
      ...headers,
      ...form.getHeaders()
    },
    timeout: 180000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: () => true
  });

  if (res.status !== 200 || !res.data?.server_filename) {
    throw new Error(`Upload gagal di ${server}: HTTP ${res.status}`);
  }

  return {
    filename: res.data.filename || filename,
    server_filename: res.data.server_filename
  };
}

async function processCompress(server, headers, task, file) {
  const payload = {
    task,
    tool: TOOL,
    files: [
      {
        server_filename: file.server_filename,
        filename: file.filename
      }
    ]
  };

  const res = await axios.post(`https://${server}.iloveimg.com/v1/process`, payload, {
    headers: {
      ...headers,
      "content-type": "application/json"
    },
    timeout: 180000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: () => true
  });

  if (res.status !== 200) {
    throw new Error(`Process gagal di ${server}: HTTP ${res.status}`);
  }

  return res.data;
}

async function downloadResultBuffer(server, headers, task) {
  const res = await axios.get(`https://${server}.iloveimg.com/v1/download/${task}`, {
    headers,
    responseType: "arraybuffer",
    timeout: 180000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: () => true
  });

  if (res.status !== 200 || !res.data) {
    throw new Error(`Download gagal di ${server}: HTTP ${res.status}`);
  }

  return Buffer.from(res.data);
}

// --- ENDPOINT ROUTE (METHOD POST) ---

router.post('/', upload.single('fileupload'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        status: false,
        creator: "Arulzxd",
        message: "Berkas 'fileupload' wajib diunggah!"
      });
    }

    const filename = file.originalname || `${crypto.randomBytes(6).toString('hex')}.jpg`;
    const { token, csrf } = await getToken();
    const errors = [];
    let compressedBuffer = null;

    for (const server of shuffle(SERVERS)) {
      const task = randomTask();
      const headers = {
        authorization: `Bearer ${token}`,
        origin: "https://www.iloveimg.com",
        referer: "https://www.iloveimg.com/compress-image",
        cookie: `_csrf=${csrf}`,
        "user-agent": UA,
        accept: "application/json, text/plain, */*"
      };

      try {
        const uploaded = await uploadImageBuffer(server, headers, file.buffer, filename, file.mimetype, task);
        await processCompress(server, headers, task, uploaded);
        compressedBuffer = await downloadResultBuffer(server, headers, task);
        break;
      } catch (err) {
        errors.push(err.message);
      }
    }

    if (!compressedBuffer) {
      throw new Error(errors.slice(0, 3).join(" | "));
    }

    // Kirimkan respons langsung berupa file gambar terkompresi
    const mimeInfo = await fromBuffer(compressedBuffer);
    res.setHeader('Content-Type', mimeInfo ? mimeInfo.mime : getContentType(filename));
    return res.send(Buffer.from(compressedBuffer));

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: "Arulzxd",
      message: "Internal Server Error saat memproses kompresi gambar",
      error: err.message
    });
  }
});

// --- CONFIG PARAMETERS UNTUK DASHBOARD UI ---
router.paramsConfig = {
  fileupload: {
    type: "file",
    desc: "Berkas gambar yang akan dikompresi"
  }
};

router.status = "ready";
router.type = "free";
module.exports = router;

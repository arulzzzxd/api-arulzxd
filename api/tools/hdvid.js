const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('node:crypto');
const multer = require('multer');
const fs = require('node:fs');
const path = require('node:path');

const router = express.Router();
const upload = multer();

const API = "https://api.unwatermark.ai";
const WEB = "https://unblurimage.ai";
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";
const PRODUCT_CODE = "067003";
const RESOLUTIONS = ["720p", "1080p", "2k", "4k"];
const IS_PREVIEW = "false";

// --- SCRAPER FUNCTIONS ---

function randomProductSerial() {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < 6; i++) {
        out += chars[crypto.randomInt(chars.length)];
    }
    return out;
}

function extToMime(file) {
    const ext = path.extname(file.originalname || file).toLowerCase();
    if (ext === ".mp4") return "video/mp4";
    if (ext === ".mov") return "video/quicktime";
    if (ext === ".webm") return "video/webm";
    if (ext === ".mkv") return "video/x-matroska";
    return "application/octet-stream";
}

function baseHeaders(extra = {}) {
    return {
        accept: "*/*",
        origin: WEB,
        referer: `${WEB}/`,
        "user-agent": UA,
        "product-code": PRODUCT_CODE,
        "product-serial": randomProductSerial(),
        "x-request-id": crypto.randomUUID(),
        "sec-ch-ua-platform": "\"Android\"",
        "sec-ch-ua": "\"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
        "sec-ch-ua-mobile": "?1",
        ...extra
    };
}

async function postForm(endpoint, fields) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
        form.append(key, value);
    }

    const res = await axios.post(`${API}${endpoint}`, form, {
        headers: baseHeaders(form.getHeaders()),
        validateStatus: () => true
    });

    return { status: res.status, data: res.data };
}

async function getJson(endpoint) {
    const res = await axios.get(`${API}${endpoint}`, {
        headers: baseHeaders({
            "content-type": "application/json; charset=UTF-8"
        }),
        validateStatus: () => true
    });
    return { status: res.status, data: res.data };
}

async function createUploadUrl(fileName) {
    const result = await postForm("/api/web/common/upload/video", {
        video_file_name: fileName
    });

    if (result.status >= 400 || result.data?.code !== 100000) {
        throw new Error(`Gagal ambil upload url: ${JSON.stringify(result.data)}`);
    }
    return result.data.result;
}

async function uploadVideoToSignedUrl(uploadUrl, fileBuffer, mimeType) {
    const res = await axios.put(uploadUrl, fileBuffer, {
        headers: {
            "content-type": mimeType,
            "content-length": fileBuffer.length
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true
    });
    return { status: res.status, data: res.data };
}

function cleanPublicUrl(url) {
    return String(url || "").split("?")[0];
}

async function createJob(originalVideoUrl, resolution) {
    const result = await postForm("/api/web/unblurimage/v1/video-enhancer/create-job", {
        original_video_url: originalVideoUrl,
        resolution: resolution,
        is_preview: IS_PREVIEW
    });

    if (result.status >= 400 || !result.data?.result?.job_id) {
        throw new Error(`Gagal create job: ${JSON.stringify(result.data)}`);
    }
    return result.data.result;
}

async function getJob(jobId) {
    return await getJson(`/api/web/unblurimage/v1/video-enhancer/get-job/${jobId}`);
}

async function waitJob(jobId, maxTry = 80, delayMs = 5000) {
    let last = null;
    for (let i = 1; i <= maxTry; i++) {
        const result = await getJob(jobId);
        last = result.data;
        const status = result.data?.result?.status;
        const outputUrl = result.data?.result?.output_url;

        if (Array.isArray(outputUrl) && outputUrl.length > 0) {
            return result.data;
        }
        if (status === 1) {
            return result.data;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    throw new Error(`Job belum selesai: ${JSON.stringify(last)}`);
}

// --- ENDPOINT ROUTE (METHOD POST) ---

router.post('/', upload.single('fileupload'), async (req, res) => {
    try {
        const file = req.file;
        const resolution = req.body.resolution?.toString().trim() || '1080p';

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Berkas 'fileupload' wajib diunggah!"
            });
        }

        if (!RESOLUTIONS.includes(resolution)) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: `Resolusi tidak valid! Gunakan salah satu opsi: ${RESOLUTIONS.join(', ')}`
            });
        }

        // Validasi tipe file
        const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Format file tidak didukung! Gunakan: MP4, MOV, WEBM, atau MKV"
            });
        }

        // Alur Eksekusi Scraper
        const fileName = file.originalname || `${crypto.randomUUID()}.mp4`;
        const mimeType = extToMime(file);

        // Step 1: Dapatkan upload URL
        const upload = await createUploadUrl(fileName);
        const signedUrl = upload.url;
        const publicUrl = cleanPublicUrl(upload.url);

        // Step 2: Upload video
        const uploadResult = await uploadVideoToSignedUrl(signedUrl, file.buffer, mimeType);
        if (uploadResult.status >= 400) {
            throw new Error(`Upload file gagal HTTP ${uploadResult.status}`);
        }

        // Step 3: Create job
        const job = await createJob(publicUrl, resolution);

        // Step 4: Tunggu proses selesai
        const done = await waitJob(job.job_id);

        // Step 5: Kirim hasil
        const resultUrl = done.result?.output_url?.[0] || "";
        return res.status(200).json({
            status: true,
            creator: "Arulzxd",
            input_file: fileName,
            resolution: resolution,
            result_url: resultUrl,
            job_id: job.job_id
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: "Internal Server Error saat memproses video",
            error: err.message
        });
    }
});

// --- CONFIG PARAMETERS UNTUK DASHBOARD UI ---
router.paramsConfig = {
    fileupload: {
        type: "file",
        desc: "Berkas video yang akan di-enhance"
    },
    resolution: {
        type: "select",
        options: RESOLUTIONS,
        default: "1080p"
    }
};

router.status = "ready";
router.type = "free";
module.exports = router;
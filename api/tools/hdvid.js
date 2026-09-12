/**
 * ✦ Nama Scrape : Wink.ai Video Enhancer Ultra HD
 * ✦ Author      : ArulzXD
 * ✦ Deskripsi   : Meningkatkan kualitas video menjadi Ultra HD menggunakan API Wink AI (Meitu AI).
 */

const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const multer = require("multer");
const { CookieJar } = require("tough-cookie");

const router = express.Router();
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

const BASE_URL = "https://wink.ai";
const STRATEGY_URL = "https://strategy.app.meitudata.com";

const CLIENT_ID = "1189857605";
const VERSION = "5.1.2";
const COUNTRY_CODE = "ID";
const CLIENT_LANGUAGE = "en_US";
const CLIENT_TIMEZONE = "Asia/Jakarta";

const TASK_TYPE = "11";
const CONTENT_TYPE = "2";
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";

function extToMime(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mkv") return "video/x-matroska";
  return "application/octet-stream";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeTrace() {
  return `${crypto.randomBytes(16).toString("hex")}-${crypto.randomBytes(8).toString("hex")}-1`;
}

function traceHeaders() {
  const trace = makeTrace();
  return {
    "sentry-trace": trace,
    baggage: [
      "sentry-environment=release",
      "sentry-release=5.1.2%20(b60d25c477f43c6dfac4107810f26d442320f4f1)",
      "sentry-public_key=e1bf914f3448d9bc8a10c7e499d17d54",
      `sentry-trace_id=${trace.split("-")[0]}`,
      "sentry-sampled=true",
      "sentry-sample_rate=0.75"
    ].join(",")
  };
}

// Gunakan Dynamic Import untuk memuat wrapper dari axios-cookiejar-support (ESM)
async function createApiInstance() {
  const { wrapper } = await import("axios-cookiejar-support");
  const gnum = crypto.randomUUID();
  const jar = new CookieJar();

  jar.setCookieSync(`_sm=${gnum}; Path=/; Domain=wink.ai`, BASE_URL);
  jar.setCookieSync(
    `meitustat=${encodeURIComponent(JSON.stringify({ wgid: gnum }))}; Path=/; Domain=wink.ai`,
    BASE_URL
  );

  const api = wrapper(axios.create({
    baseURL: BASE_URL,
    jar,
    withCredentials: true,
    validateStatus: () => true,
    headers: {
      accept: "*/*",
      origin: BASE_URL,
      referer: `${BASE_URL}/video-enhancer/upload`,
      "user-agent": UA,
      "sec-ch-ua": "\"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": "\"Android\"",
      ab_info: JSON.stringify({
        ab_codes: [],
        version: "1.4.4"
      })
    }
  }));

  return { api, gnum };
}

function baseParams(gnum, extra = {}) {
  return new URLSearchParams({
    client_id: CLIENT_ID,
    version: VERSION,
    country_code: COUNTRY_CODE,
    gnum: gnum,
    client_language: CLIENT_LANGUAGE,
    client_channel_id: "",
    client_timezone: CLIENT_TIMEZONE,
    ...extra
  });
}

async function getMaatSign(api, gnum) {
  const params = baseParams(gnum, {
    suffix: ".mp4",
    type: "temp",
    count: "1"
  });

  const res = await api.get(`/api/file/get_maat_sign.json?${params.toString()}`, {
    headers: traceHeaders()
  });

  if (res.status >= 400 || res.data?.code !== 0) {
    throw new Error(`get_maat_sign gagal: ${JSON.stringify(res.data)}`);
  }

  return res.data.data;
}

async function getUploadPolicy(sign) {
  const params = new URLSearchParams({
    app: sign.app,
    count: String(sign.count),
    sig: sign.sig,
    sigTime: sign.sig_time,
    sigVersion: sign.sig_version,
    suffix: sign.suffix,
    type: sign.type
  });

  const res = await axios.get(`${STRATEGY_URL}/upload/policy?${params.toString()}`, {
    headers: {
      accept: "*/*",
      origin: BASE_URL,
      referer: `${BASE_URL}/`,
      "user-agent": UA,
      "sec-ch-ua": "\"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": "\"Android\""
    },
    validateStatus: () => true
  });

  if (res.status >= 400 || !Array.isArray(res.data) || !res.data[0]?.qiniu) {
    throw new Error(`upload policy gagal: ${JSON.stringify(res.data)}`);
  }

  return res.data[0].qiniu;
}

async function uploadToQiniu(policy, filePath) {
  const form = new FormData();

  form.append("file", fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: extToMime(filePath)
  });

  form.append("token", policy.token);
  form.append("key", policy.key);
  form.append("fname", path.basename(filePath));

  const res = await axios.post(policy.url, form, {
    headers: form.getHeaders({
      origin: BASE_URL,
      referer: `${BASE_URL}/`,
      "user-agent": UA,
      accept: "*/*"
    }),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true
  });

  if (res.status >= 400) {
    throw new Error(`upload qiniu gagal HTTP ${res.status}: ${typeof res.data === "string" ? res.data : JSON.stringify(res.data)}`);
  }

  if (!res.data?.url && !res.data?.data) {
    throw new Error(`upload qiniu response tidak valid: ${JSON.stringify(res.data)}`);
  }

  return {
    file_key: policy.key,
    source_url: res.data.url || res.data.data || policy.data
  };
}

async function getVideoInfo(api, gnum, fileKey) {
  const body = baseParams(gnum, { file_key: fileKey });

  const res = await api.post("/api/file/video_cover_and_display_info_ext.json", body.toString(), {
    headers: {
      ...traceHeaders(),
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
    }
  });

  if (res.status >= 400 || res.data?.code !== 0) {
    throw new Error(`video info gagal: ${JSON.stringify(res.data)}`);
  }

  return res.data.data;
}

async function startTranscode(api, gnum, fileKey) {
  const body = baseParams(gnum, { file_key: fileKey });

  const res = await api.post("/api/file/video_trans_start.json", body.toString(), {
    headers: {
      ...traceHeaders(),
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
    }
  });

  if (res.status >= 400 || res.data?.code !== 0 || !res.data?.data?.id) {
    throw new Error(`transcode start gagal: ${JSON.stringify(res.data)}`);
  }

  return res.data.data.id;
}

async function queryTranscode(api, gnum, id) {
  const params = baseParams(gnum, { id });

  const res = await api.get(`/api/file/video_trans_query.json?${params.toString()}`, {
    headers: traceHeaders()
  });

  if (res.status >= 400 || res.data?.code !== 0) {
    throw new Error(`transcode query gagal: ${JSON.stringify(res.data)}`);
  }

  return res.data.data;
}

async function waitTranscode(api, gnum, id, fallbackSourceUrl, maxTry = 80, delayMs = 3000) {
  let last = null;

  for (let i = 1; i <= maxTry; i++) {
    const data = await queryTranscode(api, gnum, id);
    last = data;

    const video = data?.video || data?.url || data?.source_url || "";
    const videoTranscoded =
      data?.video_transcoded ||
      data?.transcoded_video ||
      data?.transcoded_url ||
      data?.video_url ||
      "";

    if (videoTranscoded) {
      return {
        source_url: video || fallbackSourceUrl,
        video_transcoded: videoTranscoded,
        raw: data
      };
    }

    await sleep(delayMs);
  }

  return {
    source_url: fallbackSourceUrl,
    video_transcoded: fallbackSourceUrl,
    raw: last
  };
}

async function delivery(api, gnum, sourceUrl, videoTranscoded, fileName) {
  const taskName = `Enhancer-Ultra HD-${path.parse(fileName).name}`;

  const body = baseParams(gnum, {
    type: TASK_TYPE,
    content_type: CONTENT_TYPE,
    source_url: sourceUrl,
    type_params: JSON.stringify({
      is_mirror: 0,
      orientation_tag: 1,
      j_420_trans: "1",
      return_ext: "2"
    }),
    right_detail: JSON.stringify({
      source: "1",
      touch_type: "4",
      function_id: "630",
      material_id: "63011",
      url: "https://wink.ai/video-enhancer/upload"
    }),
    ext_params: JSON.stringify({
      task_name: taskName,
      records: TASK_TYPE,
      video_transcoded: videoTranscoded
    }),
    with_prepare: "1"
  });

  const res = await api.post("/api/meitu_ai/delivery.json", body.toString(), {
    headers: {
      ...traceHeaders(),
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
    }
  });

  if (res.status >= 400 || res.data?.code !== 0) {
    throw new Error(`delivery gagal: ${JSON.stringify(res.data)}`);
  }

  const data = res.data.data || {};

  return {
    msg_id: data.msg_id || "",
    prepare_msg_id: data.prepare_msg_id || "",
    raw: data
  };
}

async function queryBatch(api, gnum, msgId) {
  const params = baseParams(gnum, { msg_ids: msgId });

  const res = await api.get(`/api/meitu_ai/query_batch.json?${params.toString()}`, {
    headers: {
      ...traceHeaders(),
      referer: `${BASE_URL}/video-enhancer/upload`
    }
  });

  if (res.status >= 400 || res.data?.code !== 0) {
    throw new Error(`query batch gagal: ${JSON.stringify(res.data)}`);
  }

  return res.data.data;
}

function extractResultUrl(data) {
  const item = data?.item_list?.[0];
  const media = item?.result?.media_info_list?.[0];

  return (
    media?.media_data ||
    item?.result?.result_url ||
    item?.result?.url ||
    item?.client_ext_params?.video_transcoded ||
    ""
  );
}

function extractNextMsgId(data, currentMsgId) {
  const item = data?.item_list?.[0];
  const resultValue = item?.result?.result || "";
  const realMsgId = item?.result?.msg_id || item?.msg_id || "";

  if (
    resultValue &&
    resultValue !== currentMsgId &&
    !resultValue.startsWith("http") &&
    !resultValue.startsWith("https")
  ) {
    return resultValue;
  }

  if (
    realMsgId &&
    realMsgId !== currentMsgId &&
    !realMsgId.startsWith("wpr_")
  ) {
    return realMsgId;
  }

  return "";
}

async function waitResult(api, gnum, firstMsgId, maxTry = 120, delayMs = 5000) {
  let msgId = firstMsgId;
  let last = null;

  for (let i = 1; i <= maxTry; i++) {
    const data = await queryBatch(api, gnum, msgId);
    last = data;

    const nextMsgId = extractNextMsgId(data, msgId);

    if (nextMsgId) {
      msgId = nextMsgId;
      await sleep(1000);
      continue;
    }

    const url = extractResultUrl(data);
    const errorCode = data?.item_list?.[0]?.result?.error_code;
    const errorMsg = data?.item_list?.[0]?.result?.error_msg;

    if (url && url.startsWith("http") && errorCode === 0) {
      return url;
    }

    if (errorCode && errorCode !== 29901 && errorCode !== 0) {
      throw new Error(`task gagal: ${errorCode} ${errorMsg || ""}`);
    }

    await sleep(delayMs);
  }

  throw new Error(`result belum selesai: ${JSON.stringify(last)}`);
}

router.post("/", upload.single("fileupload"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      status: false,
      creator: "ArulzXD",
      message: "Berkas video 'fileupload' wajib diunggah!"
    });
  }

  const filePath = file.path;
  const originalName = file.originalname || "video.mp4";

  try {
    const { api, gnum } = await createApiInstance();

    const sign = await getMaatSign(api, gnum);
    const policy = await getUploadPolicy(sign);
    const uploaded = await uploadToQiniu(policy, filePath);

    await getVideoInfo(api, gnum, uploaded.file_key);

    const transcodeId = await startTranscode(api, gnum, uploaded.file_key);
    const transcode = await waitTranscode(api, gnum, transcodeId, uploaded.source_url);

    const task = await delivery(api, gnum, transcode.source_url, transcode.video_transcoded, originalName);
    const firstMsgId = task.msg_id || task.prepare_msg_id;

    if (!firstMsgId) {
      throw new Error(`delivery tidak mengembalikan msg_id: ${JSON.stringify(task.raw)}`);
    }

    const resultUrl = await waitResult(api, gnum, firstMsgId);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    return res.json({
      status: true,
      creator: "ArulzXD",
      result: {
        original_name: originalName,
        result_url: resultUrl
      }
    });

  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    console.error("Wink AI Video Enhancer Error:", err.message);
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message || "Terjadi kesalahan saat memproses video HD Wink AI."
    });
  }
});

router.desc = "Meningkatkan kualitas video menjadi Ultra HD menggunakan Wink AI (Meitu AI).";
router.paramsConfig = {
  fileupload: {
    type: "file",
    desc: "Berkas video yang akan ditingkatkan ke Ultra HD (max 100MB)"
  }
};
router.status = "ready";
router.type = "free";

module.exports = router;
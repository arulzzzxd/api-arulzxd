/**
 * NAMA SCRAPE  :: DOWNR MULTI DOWNLOADER
 * [•] BASIS        :: downr.org
 * [•] CONVERTED    :: Express Router API
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

const BASE = "https://downr.org";
const ANALYTICS = `${BASE}/.netlify/functions/analytics`;
const DOWNLOAD = `${BASE}/.netlify/functions/download`;
const NYT = `${BASE}/.netlify/functions/nyt`;

const UA = "Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36";

function parseCookie(setCookie = []) {
  return setCookie.map(v => v.split(";")[0]).join("; ");
}

function parseData(data) {
  if (typeof data !== "string") return data;
  const text = data.trim();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isOk(status, data) {
  const isObject = data && typeof data === "object";

  if (status < 200 || status >= 300) return false;
  if (data === null || data === undefined) return false;
  if (data === "") return false;
  if (data === "error" || data === "failed" || data === "user_retry_required") return false;
  if (isObject && data.error === true) return false;
  if (isObject && data.status === false) return false;
  if (isObject && data.success === false) return false;

  return true;
}

function getError(data, status) {
  if (typeof data === "string") return data || `HTTP ${status}`;
  if (data && typeof data === "object") return data.message || data.error || data.status || data.reason || `HTTP ${status}`;
  return `HTTP ${status}`;
}

async function getCookie() {
  const res = await axios.get(ANALYTICS, {
    timeout: 30000,
    validateStatus: () => true,
    responseType: "text",
    transformResponse: [v => v],
    headers: {
      accept: "*/*",
      referer: `${BASE}/`,
      "user-agent": UA
    }
  });
  return parseCookie(res.headers["set-cookie"] || []);
}

async function postEndpoint(endpoint, url, cookie = "") {
  const res = await axios.post(endpoint, { url }, {
    timeout: 120000,
    validateStatus: () => true,
    responseType: "text",
    transformResponse: [v => v],
    headers: {
      accept: "*/*",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/json",
      cookie,
      origin: BASE,
      referer: `${BASE}/`,
      "sec-ch-ua": '"Chromium";v="137", "Not/A)Brand";v="24"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": UA
    }
  });

  return {
    endpoint,
    status: res.status,
    data: parseData(res.data)
  };
}

async function tryDownload(url) {
  let cookie = await getCookie();
  let result = await postEndpoint(DOWNLOAD, url, cookie);

  if (isOk(result.status, result.data)) return result;

  cookie = await getCookie();
  result = await postEndpoint(DOWNLOAD, url, cookie);

  if (isOk(result.status, result.data)) return result;

  result = await postEndpoint(NYT, url, cookie);
  return result;
}

// Endpoint GET Utama
router.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ status: false, error: "Missing 'url' parameter" });
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ status: false, error: "Invalid URL format." });

  try {
    const result = await tryDownload(url);
    const ok = isOk(result.status, result.data);

    if (!ok) {
      return res.status(400).json({
        status: false,
        error: getError(result.data, result.status)
      });
    }

    // Mengembalikan hasil ekstraksi data yang sukses
    return res.json({
      status: true,
      code: result.status,
      endpoint: result.endpoint,
      data: result.data
    });

  } catch (e) {
    return res.status(500).json({ status: false, error: e.message });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;

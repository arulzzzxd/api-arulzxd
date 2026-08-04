const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

const BASE_URL = "https://bypass.tools";
const APP_VERSION = "1.1.2";
const UA = "okhttp/4.9.2";

const client = axios.create({
    baseURL: BASE_URL
});

/**
 * Generate deviceId acak: 32 byte hex (64 karakter), sama formatnya
 */
function generateDeviceId() {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * 1. Init session: kirim deviceId, dapetin sessionToken (JWT) + info rate limit.
 */
async function initSession(deviceId) {
    const { data } = await client.post(
        "/api/mobile/init",
        {
            deviceId,
            platform: "android",
            appVersion: APP_VERSION
        },
        {
            headers: {
                "content-type": "application/json",
                "accept-encoding": "gzip",
                "user-agent": UA
            }
        }
    );

    if (data?.status !== "success" || !data?.sessionToken) {
        throw new Error("Gagal init session: " + JSON.stringify(data));
    }

    return data;
}

/**
 * 2. Bypass link: butuh Bearer sessionToken + header x-device-id.
 */
async function bypassLink(url, sessionToken, deviceId, forceRefresh = true) {
    const { data } = await client.post(
        "/api/mobile/bypass",
        {
            url,
            forceRefresh
        },
        {
            headers: {
                authorization: `Bearer ${sessionToken}`,
                "x-device-id": deviceId,
                "content-type": "application/json",
                "accept-encoding": "gzip",
                "user-agent": UA
            }
        }
    );

    if (data?.status !== "success" || !data?.result) {
        throw new Error("Gagal bypass: " + JSON.stringify(data));
    }

    return data;
}

/**
 * Flow lengkap: init -> bypass.
 */
async function bypassTools(url, options = {}) {
    try {
        const deviceId = options.deviceId || generateDeviceId();

        const session = await initSession(deviceId);

        const bypass = await bypassLink(
            url,
            session.sessionToken,
            deviceId,
            true // Force Refresh bawaan
        );

        return {
            status: true,
            deviceId,
            sessionToken: session.sessionToken,
            rateLimit: bypass.rate_limit || session.rateLimit,
            result: bypass.result,
            cached: bypass.cached,
            stale: bypass.stale,
            processTime: bypass.processTime,
            requestId: bypass.requestId
        };

    } catch (error) {
        const msg = error.response
            ? `${error.response.status} ${JSON.stringify(error.response.data)}`
            : error.message;

        return {
            status: false,
            error: msg
        };
    }
}

router.get("/", async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Parameter url diperlukan.",
                example: "/api/tools/bypasstools?url=https://linkvertise.com/xxxx"
            });
        }

        const result = await bypassTools(url);

        res.json({
            creator: "ArulzXD",
            ...result
        });

    } catch (e) {
        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: e.message
        });
    }
});

router.status = "error";
router.type = "free";
module.exports = router;
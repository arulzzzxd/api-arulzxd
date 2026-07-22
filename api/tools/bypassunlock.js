const express = require("express");

const router = express.Router();

function generateRandomIP() {
    const ranges = [
        [1,1],[2,2],[5,5],[23,23],[27,27],[31,31],[36,36],[37,37],
        [39,39],[42,42],[46,46],[49,49],[50,50],[60,60],[114,114],
        [117,117],[118,118],[119,119],[120,120],[121,121],[122,122],
        [123,123],[124,124],[125,125],[126,126],[180,180],[182,182],[183,183]
    ];

    const range = ranges[Math.floor(Math.random() * ranges.length)];

    return [
        range[0],
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256)
    ].join(".");
}

async function fetchApiKey() {
    const ip = generateRandomIP();

    const res = await fetch("https://bypassunlock.com", {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "X-Forwarded-For": ip,
            "X-Real-IP": ip
        }
    });

    if (!res.ok) {
        throw new Error("Gagal mengambil API Key.");
    }

    const html = await res.text();

    const match = html.match(/apikey=([^&"'\s>]+)/);

    if (!match) {
        throw new Error("API Key tidak ditemukan.");
    }

    return match[1];
}

async function bypass(url) {
    const apiKey = await fetchApiKey();
    const ip = generateRandomIP();

    const api = `https://trw.lat/api/bypass?apikey=${apiKey}&url=${encodeURIComponent(url)}`;

    const res = await fetch(api, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "X-Forwarded-For": ip,
            "X-Real-IP": ip,
            "Client-IP": ip,
            "True-Client-IP": ip,
            "X-Originating-IP": ip,
            "X-Cluster-Client-IP": ip,
            "Forwarded": `for=${ip}`
        }
    });

    if (!res.ok) {
        throw new Error(await res.text());
    }

    return await res.json();
}

router.get("/", async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Parameter url diperlukan.",
                example: "/api/tools/bypassunlock?url=https://linkvertise.com/xxxx"
            });
        }

        const result = await bypass(url);

        res.json({
            status: true,
            creator: "ArulzXD",
            result
        });

    } catch (e) {
        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: e.message
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
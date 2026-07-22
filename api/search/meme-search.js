const express = require("express");
const https = require("https");

const router = express.Router();

function apiRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "apiv2.vlipsy.com",
            port: 443,
            path,
            method: "GET",
            headers: {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0"
            }
        };

        const req = https.request(options, (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error("JSON parse error: " + e.message));
                }
            });
        });

        req.on("error", reject);
        req.end();
    });
}

async function memeSearch(query, limit = 10) {
    const encodedQuery = encodeURIComponent(
        query.toLowerCase().replace(/[^a-z0-9\s]/g, "")
    );

    const apiPath = `/v1/vlips/search?q=${encodedQuery}&limit=${Math.min(limit, 100)}&pos=0&key=vl_hFxn07bG43d0n9t`;

    const result = await apiRequest(apiPath);

    return {
        query,
        total: result.data ? result.data.length : 0,
        result: result.data || []
    };
}

router.get("/", async (req, res) => {
    try {
        const query = req.query.query;
        const limit = Number(req.query.limit) || 10;

        if (!query) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Parameter query diperlukan.",
                example: "/api/search/meme?query=cat&limit=10"
            });
        }

        const result = await memeSearch(query, limit);

        res.json({
            status: true,
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

router.paramsConfig = {
    query: {
        type: "text"
    },
    limit: {
        type: "number",
        default: 10,
        min: 1,
        max: 100
    }
};

router.status = "ready";
router.type = "free";

module.exports = router;
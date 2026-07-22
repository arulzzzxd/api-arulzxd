const express = require("express");

const router = express.Router();

const API =
    "https://raw.githubusercontent.com/arulzzzxd/database/main/quotes/pantun.json";

async function getData() {
    const res = await fetch(API, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json,text/plain,*/*"
        }
    });

    const text = await res.text();

    if (!res.ok) {
        return {
            ok: false,
            code: res.status,
            data: null,
            error: text
        };
    }

    try {
        return {
            ok: true,
            code: res.status,
            data: JSON.parse(text),
            error: null
        };
    } catch {
        return {
            ok: false,
            code: res.status,
            data: null,
            error: "Invalid JSON"
        };
    }
}

function normalize(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.result)) return data.result;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.quotes)) return data.quotes;
    return [];
}

function random(list) {
    return list[Math.floor(Math.random() * list.length)];
}

router.get("/", async (req, res) => {
    try {
        const response = await getData();

        if (!response.ok) {
            return res.status(response.code).json({
                status: false,
                creator: "ArulzXD",
                message: response.error
            });
        }

        const list = normalize(response.data);

        if (!list.length) {
            return res.status(404).json({
                status: false,
                creator: "ArulzXD",
                message: "Data tidak ditemukan."
            });
        }

        res.json({
            status: true,
            creator: "ArulzXD",
            result: random(list)
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.message
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
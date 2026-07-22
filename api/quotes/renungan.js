const express = require("express");

const router = express.Router();

const API =
    "https://raw.githubusercontent.com/arulzzzxd/database/main/quotes/renungan.json";

function random(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

router.get("/", async (req, res) => {
    try {
        const response = await fetch(API, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                status: false,
                creator: "ArulzXD",
                message: "Gagal mengambil data."
            });
        }

        const data = await response.json();

        let list = [];

        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data.data)) list = data.data;
        else if (Array.isArray(data.result)) list = data.result;
        else if (Array.isArray(data.renungan)) list = data.renungan;

        if (!list.length) {
            return res.status(404).json({
                status: false,
                creator: "ArulzXD",
                message: "Data kosong."
            });
        }

        const item = random(list);

        const image =
            typeof item === "string"
                ? item
                : item.image || item.img || item.url;

        if (!image) {
            return res.status(404).json({
                status: false,
                creator: "ArulzXD",
                message: "URL gambar tidak ditemukan."
            });
        }

        const img = await fetch(image, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        res.setHeader(
            "Content-Type",
            img.headers.get("content-type") || "image/jpeg"
        );

        const buffer = Buffer.from(await img.arrayBuffer());

        res.send(buffer);

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
const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function removeBgimage(imageUrl) {
    const image = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    const form = new FormData();
    form.append("file", Buffer.from(image.data), {
        filename: "image.png",
        contentType: "image/png"
    });
    form.append("type", "4");
    form.append("mattValue", "0");

    const { data: upload } = await axios.post(
        "https://bgeraser.com/api/bgeraser/legacy/upload",
        form,
        {
            headers: {
                ...form.getHeaders(),
                origin: "https://bgeraser.com",
                referer: "https://bgeraser.com/",
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        }
    );

    if (!upload || !upload.taskId) {
        throw new Error("Upload gagal.");
    }

    const taskId = upload.taskId;

    for (let i = 0; i < 20; i++) {
        await sleep(2000);

        const { data: status } = await axios.post(
            "https://bgeraser.com/api/bgeraser/legacy/status",
            {
                type: 4,
                codes: [taskId]
            },
            {
                headers: {
                    origin: "https://bgeraser.com",
                    referer: "https://bgeraser.com/",
                    "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            }
        );

        if (
            status &&
            status.status === "success" &&
            status.downloadUrls &&
            status.downloadUrls[taskId]
        ) {
            return status.downloadUrls[taskId];
        }
    }

    throw new Error("Timeout menunggu hasil.");
}

router.get("/", async (req, res) => {
    try {
        const apikey = req.query.apikey;
        const url = req.query.url;

        if (!apikey) {
            return res.status(403).json({
                status: false,
                message: "Parameter 'apikey' diperlukan."
            });
        }

        if (apikey !== "arulzxd-keys") {
            return res.status(403).json({
                status: false,
                message: "Apikey tidak valid."
            });
        }

        if (!url) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'url' diperlukan."
            });
        }

        const imageUrl = await removeBgimage(url);

        const image = await axios.get(imageUrl, {
            responseType: "stream",
            headers: {
                "User-Agent": "Mozilla/5.0",
                Referer: "https://bgeraser.com/",
                Origin: "https://bgeraser.com"
            }
        });

        res.setHeader(
            "Content-Type",
            image.headers["content-type"] || "image/png"
        );

        return image.data.pipe(res);

    } catch (err) {
        console.error(err.response?.data || err.message);

        return res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.message,
            detail: err.response?.data || null
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
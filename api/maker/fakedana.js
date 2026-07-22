const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get("/", async (req, res) => {
    try {        
        const nominal = req.query.nominal;

        // Validasi nominal
        if (!nominal) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'nominal' diperlukan.",
                example: "10000"
            });
        }

        // Request ke API sumber
        const { data } = await axios.get(
            "https://api.cuki.biz.id/api/maker/fakedana",
            {
                params: {
                    apikey: "cuki-x",
                    nominal
                },
                responseType: "arraybuffer"
            }
        );

        // Jika hasil berupa gambar
        const contentType = data instanceof Buffer
            ? "image/png"
            : "application/json";

        res.setHeader("Content-Type", contentType);
        return res.send(data);

    } catch (err) {
        return res.status(500).json({
            status: false,
            creator: "ArulzXD",
            error: err.message,
            details: err.response?.data || null
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
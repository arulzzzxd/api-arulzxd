const express = require("express");
const axios = require("axios");

const router = express.Router();

const HEADERS = {
"User-Agent": "okhttp/4.10.0",
"Accept-Encoding": "gzip",
"platform": "Android",
"version": "1.4.0",
"language": "in",
"content-type": "application/json; charset=utf-8"
};

async function novaAi(text) {
const payload = {
question_text: text,
conversation: {
conversation_items: []
}
};

const { data } = await axios.post(
    "https://us-central1-nova-ai---android.cloudfunctions.net/app/ai-response/v2",
    payload,
    {
        headers: HEADERS
    }
);

return data;

}

router.get("/", async (req, res) => {
try {
const text = req.query.text?.trim();

    if (!text) {
        return res.status(400).json({
            status: false,
            creator: "ArulzXD",
            message: "Parameter text wajib diisi",
            example: "/api/ai/nova?text=Halo"
        });
    }

    const result = await novaAi(text);

    res.json({
        status: true,
        creator: "ArulzXD",
        result
    });

} catch (err) {
    res.status(500).json({
        status: false,
        creator: "ArulzXD",
        message: err.response?.data || err.message
    });
}

});

router.status = "ready";
router.type = "free";
module.exports = router;
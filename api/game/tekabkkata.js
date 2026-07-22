const express = require("express");
const axios = require("axios");

const router = express.Router();

const JSON_URL =
"https://raw.githubusercontent.com/arulzzzxd/database/main/Game/tebakkata.json";

router.get("/", async (req, res) => {
try {
const { data } = await axios.get(JSON_URL, {
headers: {
"User-Agent": "Mozilla/5.0"
}
});

    const random =
        data[Math.floor(Math.random() * data.length)];

    res.json({
        status: true,
        creator: "ArulzXD",
        result: random
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
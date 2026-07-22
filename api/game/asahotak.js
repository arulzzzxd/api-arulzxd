const express = require("express");
const axios = require("axios");

const router = express.Router();

const JSON_URL =
"https://raw.githubusercontent.com/arulzzzxd/database/main/Game/asahotak.json";

router.get("/", async (req, res) => {
try {
const { data } = await axios.get(JSON_URL);

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
message: err.message
});
}
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
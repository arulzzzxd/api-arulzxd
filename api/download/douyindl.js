const express = require("express");
const axios = require("axios");

const router = express.Router();

function generateRandomIP() {
const ranges = [
[1, 1], [2, 2], [5, 5], [23, 23],
[27, 27], [31, 31], [36, 36], [37, 37],
[39, 39], [42, 42], [46, 46], [49, 49],
[50, 50], [60, 60], [114, 114], [117, 117],
[118, 118], [119, 119], [120, 120],
[121, 121], [122, 122], [123, 123],
[124, 124], [125, 125], [126, 126],
[180, 180], [182, 182], [183, 183]
];

const range =
ranges[
Math.floor(
Math.random() * ranges.length
)
];

return [
range[0],
Math.floor(Math.random() * 256),
Math.floor(Math.random() * 256),
Math.floor(Math.random() * 256)
].join(".");
}

router.get("/", async (req, res) => {
try {
const url = req.query.url;

if (!url) {
  return res.status(400).json({
    status: false,
    message: "Parameter url diperlukan",
    example:
      "/api/download/douyin?url=https://v.douyin.com/xxxxx"
  });
}

const spoofedIp =
  generateRandomIP();

const { data } =
  await axios.post(
    "https://snapvideotools.com/api/snap",
    {
      text: url
    },
    {
      headers: {
        "Content-Type":
          "application/json",
        Accept:
          "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With":
          "XMLHttpRequest",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer:
          "https://snapvideotools.com/",
        Origin:
          "https://snapvideotools.com",
        "X-Forwarded-For":
          spoofedIp,
        "X-Real-IP":
          spoofedIp,
        "Client-IP":
          spoofedIp,
        "True-Client-IP":
          spoofedIp,
        "X-Originating-IP":
          spoofedIp,
        "X-Cluster-Client-IP":
          spoofedIp,
        Forwarded:
          `for=${spoofedIp}`
      }
    }
  );

res.json({
  status: true,
  creator: "ArulzXD",
  result: data
});

} catch (error) {
res.status(500).json({
status: false,
error: error.message,
details:
error.response?.data ||
null
});
}
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
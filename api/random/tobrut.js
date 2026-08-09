/**
 * NAMA SCRAPE  :: RANDOM VIDEO STREAM
 * [•] BASIS        :: Local Video Database
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

const videos = [
  "https://files.catbox.moe/053cbw.mp4",
  "https://files.catbox.moe/fke4ht.mp4",
  "https://files.catbox.moe/mi8ouf.mp4",
  "https://files.catbox.moe/wtc2c9.mp4",
  "https://files.catbox.moe/j40xwe.mp4",
  "https://files.catbox.moe/l7shcw.mp4",
  "https://files.catbox.moe/18izfd.mp4",
  "https://files.catbox.moe/malsfc.mp4",
  "https://files.catbox.moe/xgfmr2.mp4",
  "https://files.catbox.moe/n317h3.mp4",
  "https://files.catbox.moe/lrffgg.mp4",
  "https://files.catbox.moe/z6pt9y.mp4",
  "https://files.catbox.moe/urdave.mp4",
  "https://files.catbox.moe/gcyk70.mp4",
  "https://files.catbox.moe/zm0p4a.mp4",
  "https://files.catbox.moe/k9pg17.mp4",
  "https://files.catbox.moe/l4i0gn.mp4",
  "https://files.catbox.moe/ap31lj.mp4",
  "https://files.catbox.moe/3a7beg.mp4",
  "https://files.catbox.moe/osgu8o.mp4",
  "https://files.catbox.moe/ysedtl.mp4",
  "https://files.catbox.moe/i8sewv.mp4",
  "https://files.catbox.moe/3i9kq4.mp4",
  "https://files.catbox.moe/nq4v6b.mp4",
  "https://files.catbox.moe/39yyc7.mp4"
];

// Fungsi untuk mengambil buffer video acak
async function getRandomVideo() {
  try {
    const randomUrl = videos[Math.floor(Math.random() * videos.length)];
    const response = await axios.get(randomUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    throw error;
  }
}

// Endpoint utama Router
router.get('/', async (req, res) => {
  try {
    const videoBuffer = await getRandomVideo();
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': videoBuffer.length,
    });
    res.end(videoBuffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;

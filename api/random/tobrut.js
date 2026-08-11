/**
 * NAMA SCRAPE  :: RANDOM VIDEO STREAM
 * [•] BASIS        :: Local Video Database
 * [•] RANDOM MODE  :: Shuffle Pool (No Repeat)
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

// ========================================
// SHUFFLE POOL
// ========================================

let videoPool = [];

/**
 * Fisher-Yates Shuffle
 */
function shuffle(array) {
  const arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

/**
 * Ambil video berikutnya.
 *
 * Semua video akan digunakan satu kali
 * sebelum pool diacak ulang.
 */
function getNextVideoUrl() {
  if (videoPool.length === 0) {
    videoPool = shuffle(videos);
  }

  return videoPool.pop();
}

// ========================================
// GET RANDOM VIDEO
// ========================================

async function getRandomVideo() {
  const randomUrl = getNextVideoUrl();

  const response = await axios.get(randomUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  return {
    buffer: Buffer.from(response.data),
    url: randomUrl
  };
}

// ========================================
// ENDPOINT
// ========================================

router.get('/', async (req, res) => {
  try {
    const { buffer, url } = await getRandomVideo();

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'X-Random-Video': url
    });

    res.end(buffer);

  } catch (error) {
    console.error('Random Video Error:', error.message);

    return res.status(500).json({
      status: false,
      message: 'Gagal mengambil video',
      error: error.message
    });
  }
});

router.status = "ready";
router.type = "free";

module.exports = router;
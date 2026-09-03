/**
 * NAMA SCRAPE  :: RANDOM IMAGE STREAM
 * [•] BASIS        :: Local Image Database
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

const images = [
  "https://files.catbox.moe/5f5c2y.jpg",
  "https://files.catbox.moe/3d6azr.jpg",
  "https://files.catbox.moe/ghlm38.jpg",
  "https://files.catbox.moe/hssyzl.jpg",
  "https://files.catbox.moe/6mzhw3.jpg",
  "https://files.catbox.moe/m8v283.jpg",
  "https://files.catbox.moe/rlbsd1.jpg",
  "https://files.catbox.moe/gcbni6.jpg",
  "https://files.catbox.moe/owgdyh.jpg",
  "https://files.catbox.moe/b94t7t.jpg",
  "https://files.catbox.moe/wpl1ci.jpg",
  "https://files.catbox.moe/94nz53.jpg",
  "https://files.catbox.moe/zixmtt.jpg",
  "https://files.catbox.moe/cdkpd3.jpg",
  "https://files.catbox.moe/fuqavx.jpg",
  "https://files.catbox.moe/9mcs90.jpg",
  "https://files.catbox.moe/k5pzmc.jpg",
  "https://files.catbox.moe/n20snt.jpg",
  "https://files.catbox.moe/1sukcw.jpg",
  "https://files.catbox.moe/k5ttmf.jpg",
  "https://files.catbox.moe/hr07ks.jpg",
  "https://files.catbox.moe/zm4m8u.jpg",
  "https://files.catbox.moe/ulxjdz.jpg",
  "https://files.catbox.moe/k95tqi.jpg",
  "https://files.catbox.moe/7i48rq.jpg",
  "https://files.catbox.moe/9w8lyu.jpg",
  "https://files.catbox.moe/n37n8e.jpg",
  "https://files.catbox.moe/ty84vk.jpg",
  "https://files.catbox.moe/8c102z.jpg",
  "https://files.catbox.moe/17vvtx.jpg",
  "https://files.catbox.moe/jjhm1e.jpg",
  "https://files.catbox.moe/hqu6hq.jpg",
  "https://files.catbox.moe/mqw0v4.jpg",
  "https://files.catbox.moe/9q02of.jpg",
  "https://files.catbox.moe/fbzc10.jpg",
  "https://files.catbox.moe/bb2qhu.jpg",
  "https://files.catbox.moe/px5ve6.jpg",
  "https://files.catbox.moe/qvv92z.jpg",
  "https://files.catbox.moe/ngs1ew.jpg",
  "https://files.catbox.moe/i7hmk8.jpg",
  "https://files.catbox.moe/svr0bx.jpg",
  "https://files.catbox.moe/6zm2yz.jpg",
  "https://files.catbox.moe/6n1q3d.jpg",
  "https://files.catbox.moe/uqtz9s.jpg",
  "https://files.catbox.moe/etza4h.jpg",
  "https://files.catbox.moe/t5cjvd.jpg",
  "https://files.catbox.moe/b1vhub.jpg",
  "https://files.catbox.moe/fjldkp.jpg",
  "https://files.catbox.moe/35296i.jpg",
  "https://files.catbox.moe/lgwzln.jpg",
  "https://files.catbox.moe/o0e4de.jpg",
  "https://files.catbox.moe/xmrcdo.jpg"
];

// Fungsi untuk mengambil buffer gambar acak
async function getRandomImage() {
  try {
    const randomUrl = images[Math.floor(Math.random() * images.length)];
    const response = await axios.get(randomUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    throw error;
  }
}

// Endpoint utama Router
router.get('/', async (req, res) => {
  try {
    const imageBuffer = await getRandomImage();
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': imageBuffer.length,
    });
    res.end(imageBuffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.desc = "Mengambil gambar anime hot 🤤 acak.";
router.status = "ready";
router.type = "free";
module.exports = router;

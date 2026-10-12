const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function hasLeadingZeroNibbles(bytes, difficulty) {
  const fullBytes = (difficulty / 2) | 0;
  const hasHalfByte = (difficulty & 1) === 1;

  for (let i = 0; i < fullBytes; i++) {
    if (bytes[i] !== 0) return false;
  }
  if (hasHalfByte && (bytes[fullBytes] & 0xf0) !== 0) return false;
  return true;
}

function solvePow(challenge, nonce, difficulty, challengeType = 'classic') {
  const prefix = challengeType === 'alt' ? `pow:${nonce}:` : `pow:${challenge}:`;
  const suffix = challengeType === 'alt' ? `:${challenge}` : `:${nonce}:${challenge.length}`;

  for (let n = 0; n < 10000000; n++) {
    const str = `${prefix}${n}${suffix}`;
    const hash = crypto.createHash('sha256').update(str).digest();
    if (hasLeadingZeroNibbles(hash, difficulty)) {
      return String(n);
    }
  }
  return null;
}

async function scrapeJ2Download(youtubeUrl) {
  const baseHeaders = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://j2download.com/',
    'Origin': 'https://j2download.com',
  };

  try {
    const homeRes = await fetch('https://j2download.com', { headers: baseHeaders });
    const cookieHeader = homeRes.headers.get('set-cookie') || '';
    const cookie = cookieHeader.split(';')[0];
    const html = await homeRes.text();

    const match = html.match(/window\.__BOOTSTRAP__\s*=\s*(\{.*?\});/);
    if (!match) {
      throw new Error('Gagal mengekstrak __BOOTSTRAP__ dari halaman j2download.com');
    }

    const bootstrap = JSON.parse(match[1]);

    const solution = solvePow(
      bootstrap.powChallenge,
      bootstrap.nonce,
      bootstrap.powDifficulty || 3,
      bootstrap.challengeType || 'classic'
    );

    if (!solution) {
      throw new Error('Gagal menemukan solusi Proof-of-Work');
    }

    const authRes = await fetch('https://j2download.com/api/auth/issue', {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Referer': 'https://j2download.com/',
        'Origin': 'https://j2download.com',
        'Cookie': cookie,
        'X-Page-Nonce': bootstrap.nonce,
        'X-Pow-Solution': solution,
        'Accept': 'application/json, text/plain, */*',
      },
    });

    const authData = await authRes.json();
    const token = authData?.accessToken;
    if (!token) {
      throw new Error(authData?.message || 'Gagal menerbitkan Access Token');
    }

    const autoRes = await fetch('https://j2download.com/api/autolink', {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Referer': 'https://j2download.com/',
        'Origin': 'https://j2download.com',
        'Cookie': cookie,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
      },
      body: JSON.stringify({
        data: {
          url: youtubeUrl,
          unlock: true,
        },
      }),
    });

    const result = await autoRes.json();

    if (result.error) {
      return {
        status: false,
        message: result.message || 'Server j2download mengembalikan status error.',
      };
    }

    return {
      status: true,
      videoId: result.videoId,
      title: result.title,
      author: result.author,
      duration: result.duration || result.lengthSeconds,
      thumbnail: result.thumbnail,
      viewCount: result.viewCount,
      medias: result.medias,
    };
  } catch (err) {
    return {
      status: false,
      message: err.message || 'Terjadi kesalahan saat scraping j2download.com',
    };
  }
}

router.get('/', async (req, res) => {
  try {
    const url = req.query.url?.trim();

    if (!url) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter url/link YouTube (contoh: ?url=https://youtube.com/watch?v=...)'
      });
    }

    const result = await scrapeJ2Download(url);

    if (!result.status) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: result.message || 'Gagal mengekstrak media dari URL yang diberikan.'
      });
    }

    return res.json({
      status: true,
      creator: 'ArulzXD',
      result: result
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message || 'Terjadi kesalahan pada server saat memproses unduhan.'
    });
  }
});

router.desc = "Pengunduh media All-in-One untuk mendownload video/foto dari YouTube, TikTok, Instagram, Facebook, Threads, Pinterest, dan platform sosial media lainnya.";
router.paramsConfig = {
  url: "contoh: https://vt.tiktok.com/Arx.../"
};
router.status = "ready";
router.type = "free";

module.exports = router;

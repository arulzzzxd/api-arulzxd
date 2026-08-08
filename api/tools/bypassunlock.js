/**
 * NAMA SCRAPE  :: NANO BANANA TEXT TO IMAGE (AUTO TOKEN)
 * [•] PEMBUAT      :: Rinn
 * [•] BASIS        :: nanobanana.im
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

const headers = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'id,en;q=0.9',
  'origin': 'https://nanobanana.im'
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi untuk mendapatkan token dummy / clearance session Cloudflare secara otomatis
async function getAutoTurnstileToken(session, cookieHeader) {
  try {
    const res = await session.get('https://nanobanana.im/cdn-cgi/challenge-platform/h/g/turnstile/if/ov2/av0/rcv0/0/dummy_sitekey/light/normal', {
      headers: {
        'Cookie': cookieHeader,
        'Referer': 'https://nanobanana.im/'
      }
    });
    return res.data?.token || "";
  } catch {
    return ""; // Kembali ke string kosong jika endpoint internal tidak merespons
  }
}

async function getMagicLink(email) {
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    try {
      const res = await axios.get(`https://api.tempmail.ing/api/emails/${encodeURIComponent(email)}`, { headers });
      if (res.data && res.data.success && res.data.emails.length > 0) {
        const text = res.data.emails[0].text || res.data.emails[0].html || '';
        const match = text.match(/https:\/\/nanobanana\.im\/api\/auth\/magic-link\/verify\?token=[^\s"']+/);
        if (match) return match[0];
      }
    } catch (e) {}
    await delay(3000);
    attempts++;
  }
  throw new Error('Timeout waiting for magic link email.');
}

async function nanobanana(prompt) {
  const mailRes = await axios.post('https://api.tempmail.ing/api/generate', {}, { headers });
  if (!mailRes.data || !mailRes.data.success) throw new Error('Failed to generate tempmail.');
  const email = mailRes.data.email.address;

  const session = axios.create({ headers });

  const initRes = await session.get('https://nanobanana.im/');
  let cookies = initRes.headers['set-cookie'] || [];
  let cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

  const magicRes = await session.post('https://nanobanana.im/api/auth/sign-in/magic-link', {
    email: email,
    callbackURL: '/'
  }, {
    headers: { 'Cookie': cookieHeader }
  });

  if (!magicRes.data.status) throw new Error('Failed to send magic link.');

  const link = await getMagicLink(email);
  const verifyRes = await session.get(link, {
    headers: { 'Cookie': cookieHeader },
    maxRedirects: 0,
    validateStatus: status => status >= 200 && status < 400
  });

  if (verifyRes.headers['set-cookie']) {
    cookies = [...cookies, ...verifyRes.headers['set-cookie']];
    cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
  }

  const homeRes = await session.get('https://nanobanana.im/', {
    headers: { 'Cookie': cookieHeader }
  });
  if (homeRes.headers['set-cookie']) {
    cookies = [...cookies, ...homeRes.headers['set-cookie']];
    cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
  }

  // Generate turnstileToken secara otomatis
  const turnstileToken = await getAutoTurnstileToken(session, cookieHeader);

  const taskRes = await session.post('https://nanobanana.im/api/img/nano-banana5', {
    prompt: prompt,
    dimension: 'auto',
    aspect_ratio: 'auto',
    image_urls: [],
    num_images: '1',
    batchSize: 1,
    turnstileToken: turnstileToken,
    skipVerification: true, // Mengaktifkan flag bypass jika token otomatis kosong
    image_path: 'hero',
    size: '2K',
    resolution: '2K',
    output_format: 'png'
  }, {
    headers: { 'Cookie': cookieHeader }
  });

  if (!taskRes.data || !taskRes.data.taskId) {
    throw new Error('Gagal membuat task gambar. Terkena proteksi Cloudflare.');
  }
  const taskId = taskRes.data.taskId;

  let taskAttempts = 0;
  const maxTaskAttempts = 30;

  while (taskAttempts < maxTaskAttempts) {
    const checkRes = await session.post('https://nanobanana.im/api/img/nano-banana5/taskResult', { taskId }, {
      headers: { 'Cookie': cookieHeader }
    });

    if (checkRes.data && checkRes.data.status === 1) {
      return checkRes.data.imgAfterSrc;
    }
    await delay(5000);
    taskAttempts++;
  }
  throw new Error('Timeout waiting for image generation result.');
}

// Endpoint GET Utama (Pengguna tidak perlu memasukkan token lagi)
router.get('/', async (req, res) => {
  const prompt = req.query.prompt;

  if (!prompt) {
    return res.status(400).json({
      status: false,
      error: "Missing 'prompt' parameter"
    });
  }

  try {
    const imageUrl = await nanobanana(prompt);

    return res.json({
      status: true,
      prompt: prompt,
      result: imageUrl
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      error: err.message
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;

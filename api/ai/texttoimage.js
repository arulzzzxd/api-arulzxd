const express = require("express");
const axios = require("axios");

const router = express.Router();

// ==========================================
// CORE FUNCTIONS
// ==========================================

const headers = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'id,en;q=0.9',
  'origin': 'https://nanobanana.im'
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function updateCookies(oldCookieHeader, newSetCookies) {
  if (!newSetCookies) return oldCookieHeader
  const cookieMap = new Map()
  
  if (oldCookieHeader) {
    oldCookieHeader.split(';').forEach(c => {
      const parts = c.trim().split('=')
      if (parts[0]) cookieMap.set(parts[0], parts.slice(1).join('='))
    })
  }
  
  newSetCookies.forEach(c => {
    const parts = c.split(';')[0].trim().split('=')
    if (parts[0]) cookieMap.set(parts[0], parts.slice(1).join('='))
  })
  
  return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ')
}

async function getMagicLink(email) {
  let attempts = 0
  while (attempts < 20) {
    try {
      const res = await axios.get(`https://api.tempmail.ing/api/emails/${encodeURIComponent(email)}`, { headers })
      if (res.data && res.data.success && res.data.emails.length > 0) {
        const text = res.data.emails[0].text || res.data.emails[0].html || ''
        const match = text.match(/https:\/\/nanobanana\.im\/api\/auth\/magic-link\/verify\?token=[^\s"']+/)
        if (match) return match[0]
      }
    } catch (e) {}
    attempts++
    await delay(3000)
  }
  throw new Error('Magic link tidak ditemukan / timeout.')
}

async function nanobanana(prompt) {
  // Default string kosong untuk turnstileToken jika website tidak mewajibkannya
  const turnstileToken = ""; 

  const mailRes = await axios.post('https://api.tempmail.ing/api/generate', {}, { headers })
  if (!mailRes.data || !mailRes.data.success) throw new Error('Failed to generate tempmail.')
  const email = mailRes.data.email.address

  const session = axios.create({ headers })
  let cookieHeader = ''

  const initRes = await session.get('https://nanobanana.im/')
  cookieHeader = updateCookies(cookieHeader, initRes.headers['set-cookie'])

  const magicRes = await session.post('https://nanobanana.im/api/auth/sign-in/magic-link', {
    email: email,
    callbackURL: '/'
  }, {
    headers: { 'Cookie': cookieHeader }
  })

  if (!magicRes.data || !magicRes.data.status) throw new Error('Failed to send magic link.')

  const link = await getMagicLink(email)
  const verifyRes = await session.get(link, {
    headers: { 'Cookie': cookieHeader },
    maxRedirects: 0,
    validateStatus: status => status >= 200 && status < 400
  })

  cookieHeader = updateCookies(cookieHeader, verifyRes.headers['set-cookie'])

  const homeRes = await session.get('https://nanobanana.im/', {
    headers: { 'Cookie': cookieHeader }
  })
  cookieHeader = updateCookies(cookieHeader, homeRes.headers['set-cookie'])

  const taskRes = await session.post('https://nanobanana.im/api/img/nano-banana5', {
    prompt: prompt,
    dimension: 'auto',
    aspect_ratio: 'auto',
    image_urls: [], 
    num_images: '1',
    batchSize: 1,
    turnstileToken: turnstileToken,
    skipVerification: false,
    image_path: 'hero',
    size: '2K',
    resolution: '2K',
    output_format: 'png'
  }, {
    headers: { 'Cookie': cookieHeader }
  })

  if (!taskRes.data || !taskRes.data.taskId) {
    throw new Error('Gagal membuat task gambar. Cek turnstileToken atau session.')
  }
  const taskId = taskRes.data.taskId

  while (true) {
    const checkRes = await session.post('https://nanobanana.im/api/img/nano-banana5/taskResult', { taskId }, {
      headers: { 'Cookie': cookieHeader }
    })

    if (checkRes.data && checkRes.data.status === 1) {
      return checkRes.data.imgAfterSrc
    }
    await delay(5000)
  }
}

// ==========================================
// EXPRESS ROUTER ENDPOINT
// ==========================================

router.get("/", async (req, res) => {
  try {
    const text = req.query.text;

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Masukkan parameter 'text'. Contoh: ?text=anime girl wearing a futuristic cyberpunk outfit"
      });
    }

    // Memanggil fungsi tanpa menyisipkan token dari parameter
    const imageUrl = await nanobanana(text);

    // Mengembalikan hasil URL gambar dalam format JSON
    return res.json({
      status: true,
      creator: "ArulzXD",
      result: imageUrl
    });

  } catch (error) {
    // Menangani error sistem agar langsung mengembalikan status 500
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      error: error.message
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;

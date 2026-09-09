/**
 * ✦ Nama Scrape : TikTok Chat Generator (iPhone Quote Generator)
 * ✦ Author      : ArulzXD
 * ✦ Deskripsi   : Membuat screenshot obrolan TikTok dengan avatar dan teks kustom (resolusi 4K)
 */

const express = require('express');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const axios = require('axios');
const multer = require('multer');

const router = express.Router();
const upload = multer();

// Konfigurasi assets
const TEMPLATE_URL = 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/qyzwa.png';

const FONT_ASSETS = [
  { name: 'PlusJakartaSans-Regular', url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Regular.ttf', family: 'Plus Jakarta Sans' },
  { name: 'PlusJakartaSans-Medium', url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Medium.ttf', family: 'Plus Jakarta Sans' },
  { name: 'PlusJakartaSans-Bold', url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Bold.ttf', family: 'Plus Jakarta Sans' },
  { name: 'FontAwesome-Solid', url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/fa-solid-900.ttf', family: 'Font Awesome 6 Free' },
  { name: 'NotoColorEmoji', url: 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf', family: 'Noto Color Emoji' },
];

const MENU_ICONS = [
  { unicode: '\uf3e5', text: 'Balas', color: '#000000' },
  { unicode: '\uf064', text: 'Teruskan', color: '#000000' },
  { unicode: '\uf0c5', text: 'Salin', color: '#000000' },
  { unicode: '\uf1ab', text: 'Terjemahkan', color: '#000000' },
  { unicode: '\uf2ed', text: 'Hapus untuk saya', color: '#000000' },
  { unicode: '\uf024', text: 'Laporkan', color: '#ea4335' },
];

const config = {
  topPPX: 183, topPPY: 83, topPPRadius: 42,
  topNameX: 250, topNameY: 82, topNameSize: 34,
  chatPPX: 75, chatPPRadius: 38,
  textX: 175, textY: 962,
  bubbleWidth: 520, textSize: 30,
  bubbleBgColor: '#ffffff', textColor: '#161823',
};

let fontsLoaded = false;
let templateBuffer = null;
let defaultAvatarBuffer = null;

// Fungsi download buffer
async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
    maxRedirects: 5,
  });
  return Buffer.from(res.data);
}

// Fungsi load gambar dari buffer
async function loadImageFromBuffer(buffer) {
  if (!buffer) return null;
  try {
    return await loadImage(buffer);
  } catch (err) {
    console.error('Gagal load image dari buffer:', err.message);
    return null;
  }
}

async function ensureAssets() {
  // Download template
  if (!templateBuffer) {
    try {
      templateBuffer = await downloadBuffer(TEMPLATE_URL);
    } catch (err) {
      console.error('Gagal download template:', err.message);
      throw new Error('Gagal mengunduh template gambar');
    }
  }

  // Download default avatar
  if (!defaultAvatarBuffer) {
    try {
      const defaultAvatarUrl = 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/6b71d84a580f385bd7ee36402df5341ead4770a0/Image/artworks-gWLRE6HyPH3DgVMG-ZFFxtg-t500x500.jpg';
      defaultAvatarBuffer = await downloadBuffer(defaultAvatarUrl);
    } catch (err) {
      console.error('Gagal download default avatar:', err.message);
    }
  }

  // Load fonts
  if (!fontsLoaded) {
    for (const font of FONT_ASSETS) {
      try {
        const fontBuffer = await downloadBuffer(font.url);
        GlobalFonts.register(fontBuffer, font.family);
      } catch (err) {
        console.error(`Gagal memuat font ${font.name}:`, err.message);
      }
    }
    fontsLoaded = true;
  }
}

// Wrap teks dengan support native font fallback
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/(\s+)/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    if (word.trim() === '' && currentLine === '') continue;

    const testLine = currentLine + word;
    if (ctx.measureText(testLine).width > maxWidth) {
      if (currentLine !== '') {
        lines.push(currentLine.trimEnd());
        currentLine = word.trimStart();
      } else {
        lines.push(testLine);
        currentLine = '';
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trimEnd());
  }
  return lines;
}

function drawRoundedRect(ctx, x, y, w, h, r, fill, stroke = null, shadow = false) {
  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.05)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
}

function drawCircleImage(ctx, img, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

async function renderChat(username, chatText, avatarBuffer, scaleFactor = 4) {
  await ensureAssets();

  const USERNAME = username || 'Ditzzx';
  const CHAT_TEXT = chatText || 'Just friend kok cemburu 😂😂';

  const templateImage = await loadImageFromBuffer(templateBuffer);
  
  // Gunakan avatar dari upload atau default
  let avatarImage;
  if (avatarBuffer) {
    try {
      avatarImage = await loadImageFromBuffer(avatarBuffer);
    } catch (err) {
      console.error('Gagal load avatar user, menggunakan default:', err.message);
      avatarImage = await loadImageFromBuffer(defaultAvatarBuffer);
    }
  } else {
    avatarImage = await loadImageFromBuffer(defaultAvatarBuffer);
  }

  // Gunakan skala 4 untuk 4K (atau sesuai parameter)
  const canvas = createCanvas(1080 * scaleFactor, 2280 * scaleFactor);
  const ctx = canvas.getContext('2d');

  ctx.scale(scaleFactor, scaleFactor);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.clearRect(0, 0, 1080, 2280);
  ctx.drawImage(templateImage, 0, 0, 1080, 2280);

  // Gambar avatar di header
  drawCircleImage(ctx, avatarImage, config.topPPX, config.topPPY, config.topPPRadius);

  // Nama pengguna
  ctx.font = `bold ${config.topNameSize}px 'Plus Jakarta Sans', 'Noto Color Emoji'`;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(USERNAME, config.topNameX, config.topNameY);

  // Wrap dan gambar teks chat
  ctx.font = `500 ${config.textSize}px 'Plus Jakarta Sans', 'Noto Color Emoji'`;
  
  const lines = wrapText(ctx, CHAT_TEXT, config.bubbleWidth - 52);
  const lineH = config.textSize * 1.45;

  let maxW = 0;
  for (const l of lines) {
    const w = ctx.measureText(l).width;
    if (w > maxW) maxW = w;
  }

  const padX = 30, padY = 24;
  const bubbleW = Math.max(maxW + padX * 2, 180);
  const bubbleH = lines.length * lineH + padY * 2;
  const bubbleX = config.textX - padX;
  const bubbleY = config.textY - padY;

  // Avatar chat
  drawCircleImage(ctx, avatarImage, config.chatPPX, bubbleY + bubbleH / 2, config.chatPPRadius);
  
  // Bubble chat
  drawRoundedRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 35, config.bubbleBgColor);

  // Teks chat
  ctx.fillStyle = config.textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  lines.forEach((line, i) => {
    const lineY = config.textY + i * lineH + config.textSize / 2;
    ctx.fillText(line, config.textX, lineY);
  });

  // Menu bawah
  const menuX = 90, menuY = bubbleY + bubbleH + 28;
  drawRoundedRect(ctx, menuX, menuY, 565, 580, 40, '#ffffff', 'rgba(0,0,0,0.02)', true);

  const itemH = 90, iconX = menuX + 60, labelX = menuX + 130;
  MENU_ICONS.forEach((item, i) => {
    const cy = menuY + 25 + i * itemH + itemH / 2;
    ctx.fillStyle = item.color;
    ctx.font = `900 34px 'Font Awesome 6 Free'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.unicode, iconX, cy);
    ctx.font = `500 34px 'Plus Jakarta Sans'`;
    ctx.textAlign = 'left';
    ctx.fillText(item.text, labelX, cy);
  });

  ctx.restore();

  return await canvas.encode('png');
}

// --- ENDPOINT ROUTE (METHOD POST ONLY) ---

router.post('/', upload.single('avatar'), async (req, res) => {
  try {
    const username = req.body.username?.trim() || req.body.user?.trim();
    const chatText = req.body.text?.trim() || req.body.q?.trim();
    
    // Ambil skala (default 4 untuk 4K)
    let scale = parseInt(req.body.scale) || 4;
    scale = Math.min(Math.max(scale, 1), 6); // batasi 1-6

    // Ambil file avatar jika ada
    const avatarBuffer = req.file ? req.file.buffer : null;

    if (!chatText) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Parameter 'text' wajib diisi!"
      });
    }

    // Proses render chat
    const imageBuffer = await renderChat(username, chatText, avatarBuffer, scale);

    // Kirimkan respons langsung berupa file gambar
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="tiktok-chat-${Date.now()}.png"`);
    return res.send(Buffer.from(imageBuffer));

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: "Internal Server Error saat memproses TikTok Chat",
      error: err.message
    });
  }
});

// --- CONFIG PARAMETERS UNTUK DASHBOARD UI ---
router.paramsConfig = {
  avatar: {
    type: "file",
    desc: "Foto avatar (opsional, upload file gambar)"
  },
  text: "contoh: Kesendirian adalah teman terbaik ku",
  username: "contoh : arulzxd",
  scale: {
    type: "select",
    desc: "Faktor skala resolusi (1-6), default 4 (4K)",
    option: Array.from({ length: 8 }, (_, i) => String(i + 1)),
    default: 4
  }
};

router.status = "ready";
router.type = "free";
module.exports = router;
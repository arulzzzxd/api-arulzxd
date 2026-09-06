/**
 * ✦ Nama Scrape : IQC Call Canvas (iPhone Call / Chat Quote Generator)
 * ✦ Author      : kyzz & ArulzXD
 * ✦ Deskripsi   : Membuat kartu visual iPhone call/profile generator menggunakan Canvas dan asset font SF Pro.
 */

const express = require('express');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');

const router = express.Router();

// Gunakan folder OS Temp (/tmp) untuk lingkungan Serverless/Vercel
const TEMP_DIR = path.join(os.tmpdir(), 'iqc-assets');
const FONTS_DIR = path.join(TEMP_DIR, 'fonts');
const BG_DIR = path.join(TEMP_DIR, 'backgrounds');
const IMG_DIR = path.join(TEMP_DIR, 'images');

const REMOTE_ASSETS = [
  {
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Font/SFPRODISPLAYREGULAR.OTF',
    dest: path.join(FONTS_DIR, 'SFPRODISPLAYREGULAR.OTF'),
  },
  {
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Font/SFPRODISPLAYSEMIBOLD.ttf',
    dest: path.join(FONTS_DIR, 'SFPRODISPLAYSEMIBOLD.ttf'),
  },
  {
    url: 'https://arulz-xd.my.id/files/azNi7F.jpg',
    dest: path.join(BG_DIR, 'bg.jpg'),
  },
  {
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Image/artworks-gWLRE6HyPH3DgVMG-ZFFxtg-t500x500.jpg',
    dest: path.join(IMG_DIR, 'photo.jpg'),
  },
];

const WA_COLORS = [
  '#E53935', '#D81B60', '#8E24AA', '#5E35B1',
  '#1E88E5', '#039BE5', '#00897B', '#43A047',
  '#F4511E', '#FB8C00',
];

const COLOR_FILE = path.join(TEMP_DIR, '.color_index');

function getNextColor() {
  let idx = 0;
  try {
    if (fs.existsSync(COLOR_FILE)) {
      idx = parseInt(fs.readFileSync(COLOR_FILE, 'utf8')) || 0;
    }
    const color = WA_COLORS[idx % WA_COLORS.length];
    fs.mkdirSync(path.dirname(COLOR_FILE), { recursive: true });
    fs.writeFileSync(COLOR_FILE, String((idx + 1) % WA_COLORS.length));
    return color;
  } catch (e) {
    return WA_COLORS[Math.floor(Math.random() * WA_COLORS.length)];
  }
}

const config = {
  canvas: { width: 1920, height: 3413 },
  safeZones: {
    namaAtas: {
      a: 980, b: 1080, c: 250, d: 630,
      label: 'nama atas', color: 'rgba(255, 80, 80, 0.9)',
      fontSize: 55, maxChars: 25,
      font: 'SFProSemiBold', align: 'left',
    },
    foto: {
      a: 1125, b: 1713, c: 240, d: 830,
      label: 'foto', color: 'rgba(80, 200, 120, 0.9)',
      radius: 28,
    },
    waktu: {
      a: 1750, b: 1860, c: 233, d: 424,
      label: 'waktu', color: 'rgba(80, 160, 255, 0.9)',
      fontSize: 45, maxChars: 10,
      font: 'SFProRegular', textColor: '#555555', align: 'center',
    },
    namaBawah: {
      a: 2701, b: 2880, c: 700, d: 1160,
      centerY: 2787,
      label: 'nama bawah', color: 'rgba(255, 200, 0, 0.9)',
      fontSize: 67, maxChars: 25,
      font: 'SFProSemiBold', textColor: '#100e0e', align: 'left',
    },
  },
  debug: false,
};

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });

  fs.writeFileSync(dest, Buffer.from(res.data));
}

async function downloadAll() {
  for (const asset of REMOTE_ASSETS) {
    await download(asset.url, asset.dest);
  }
}

function findFontFile(dir, basenames) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  for (const base of basenames) {
    const match = files.find(f => f.toLowerCase() === base.toLowerCase());
    if (match) return path.join(dir, match);
  }
  return null;
}

function registerFont(family, ...basenames) {
  const file = findFontFile(FONTS_DIR, basenames);
  if (!file) {
    throw new Error(`Font tidak ditemukan: "${family}" di ${FONTS_DIR}`);
  }
  GlobalFonts.registerFromPath(file, family);
  const ok = GlobalFonts.families.some(f => f.family === family);
  if (!ok) throw new Error(`Gagal register font: ${family}`);
}

let fontsLoaded = false;

function loadFonts() {
  if (fontsLoaded) return;
  registerFont('SFProSemiBold', 'SFPRODISPLAYSEMIBOLD.TTF', 'SFPRODISPLAYSEMIBOLD.OTF');
  registerFont('SFProRegular', 'SFPRODISPLAYREGULAR.OTF', 'SFPRODISPLAYREGULAR.TTF');
  fontsLoaded = true;
}

function roundedClipPath(ctx, x, y, w, h, r) {
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
}

function drawRoundedBox(ctx, x, y, w, h, radius, color, label) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;

  roundedClipPath(ctx, x, y, w, h, radius);
  ctx.stroke();

  ctx.fillStyle = color.replace('0.9', '0.08');
  ctx.fill();

  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;

  ctx.beginPath();
  ctx.moveTo(cx - 24, cy);
  ctx.lineTo(cx + 24, cy);
  ctx.moveTo(cx, cy - 24);
  ctx.lineTo(cx, cy + 24);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 28px SFProSemiBold';
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`[${label}]  ${w} x ${h}  (${x}, ${y})`, x + 14, y + 14);

  ctx.restore();
}

function drawText(ctx, text, zone, textColor) {
  const { a, b, c, d, fontSize, maxChars, font, align, fontWeight, centerY } = zone;

  const str = String(text).slice(0, maxChars);
  const boxW = d - c;
  const boxH = b - a;
  const cy = centerY !== undefined ? centerY : a + boxH / 2;
  const weight = fontWeight || (font === 'SFProSemiBold' ? 'bold' : 'normal');

  let size = fontSize;
  ctx.textBaseline = 'middle';

  while (size > 12) {
    ctx.font = `${weight} ${size}px ${font}`;
    if (ctx.measureText(str).width <= boxW) break;
    size -= 1;
  }

  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = textColor;
  ctx.shadowColor = 'transparent';

  if (align === 'center') {
    ctx.textAlign = 'center';
    ctx.fillText(str, c + boxW / 2, cy);
  } else {
    ctx.textAlign = 'left';
    ctx.fillText(str, c, cy);
  }
}

async function fetchImageBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });
  return Buffer.from(res.data);
}

async function drawFoto(ctx, imageInput, zone) {
  const { a, b, c, d, radius } = zone;

  const x = c;
  const y = a;
  const w = d - c;
  const h = b - a;
  const r = radius || 28;

  let img;
  if (typeof imageInput === 'string' && (imageInput.startsWith('http://') || imageInput.startsWith('https://'))) {
    const buf = await fetchImageBuffer(imageInput);
    img = await loadImage(buf);
  } else if (fs.existsSync(imageInput)) {
    img = await loadImage(imageInput);
  } else {
    const defaultPhoto = path.join(IMG_DIR, 'photo.jpg');
    img = await loadImage(defaultPhoto);
  }

  const imgRatio = img.width / img.height;
  const boxRatio = w / h;

  ctx.save();

  roundedClipPath(ctx, x, y, w, h, r);
  ctx.clip();

  ctx.filter = 'blur(28px)';
  ctx.drawImage(img, x - 40, y - 40, w + 80, h + 80);
  ctx.filter = 'none';

  let fw, fh;
  if (imgRatio > boxRatio) {
    fw = w;
    fh = fw / imgRatio;
  } else {
    fh = h;
    fw = fh * imgRatio;
  }

  ctx.drawImage(img, x + (w - fw) / 2, y + (h - fh) / 2, fw, fh);
  ctx.restore();
}

async function generate(nama, waktu, avatarUrl) {
  await downloadAll();
  loadFonts();

  const namaColor = getNextColor();
  const { width, height } = config.canvas;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const bgPath = path.join(BG_DIR, 'bg.jpg');
  if (fs.existsSync(bgPath) && fs.statSync(bgPath).size > 0) {
    const bgImg = await loadImage(bgPath);
    ctx.drawImage(bgImg, 0, 0, width, height);
  } else {
    ctx.fillStyle = '#f0ece4';
    ctx.fillRect(0, 0, width, height);
  }

  const photoInput = avatarUrl || path.join(IMG_DIR, 'photo.jpg');
  await drawFoto(ctx, photoInput, config.safeZones.foto);

  drawText(ctx, nama, config.safeZones.namaAtas, namaColor);
  drawText(ctx, waktu, config.safeZones.waktu, config.safeZones.waktu.textColor);
  drawText(ctx, nama, config.safeZones.namaBawah, config.safeZones.namaBawah.textColor);

  if (config.debug) {
    for (const zone of Object.values(config.safeZones)) {
      if (!zone.c) continue;
      drawRoundedBox(ctx, zone.c, zone.a, zone.d - zone.c, zone.b - zone.a, 28, zone.color, zone.label);
    }
  }

  return canvas.encode('png');
}

router.get('/', async (req, res) => {
  try {
    const nama = req.query.nama?.trim() || req.query.name?.trim() || 'mie ayam.';
    const waktu = req.query.waktu?.trim() || req.query.time?.trim() || '13.56';
    const avatar = req.query.avatar?.trim() || req.query.foto?.trim() || null;

    const buffer = await generate(nama, waktu, avatar);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message || 'Terjadi kesalahan saat memproses IQC Canvas.'
    });
  }
});

router.desc = "Membuat gambar tampilan profil IQC Canvas (iPhone Profile Display) dengan kustomisasi nama, waktu, dan avatar.";
router.paramsConfig = {
  nama: "text (opsional, contoh: mie ayam.)",
  waktu: "text (opsional, contoh: 13.56)",
  avatar: "url (opsional, contoh: https://.../foto.jpg)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
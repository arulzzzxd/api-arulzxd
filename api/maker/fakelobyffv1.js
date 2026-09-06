const express = require('express');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

const router = express.Router();

const LOBBY_COUNT = 30;
let fontLoaded = false;

const config = {
  canvas: { width: 1920, height: 3416 },
  username: {
    a: 2650,
    b: 2790,
    c: 727,
    d: 1319,
    centerX: 1009,
    fontSize: 85,
    maxChars: 20,
  },
  debug: false,
};

// Auto download & load font dari GitHub
async function loadFontRemote() {
  if (fontLoaded) return;
  try {
    const fontUrl = 'https://raw.githubusercontent.com/arulzzzxd/database/main/font/TeutonNormal.otf';
    const response = await axios.get(fontUrl, { responseType: 'arraybuffer' });
    const fontBuffer = Buffer.from(response.data);
    GlobalFonts.register(fontBuffer, 'TeutonNormal');
    fontLoaded = true;
  } catch (err) {
    console.error('Gagal memuat font remote:', err.message);
    throw new Error('Gagal memuat font remote.');
  }
}

function drawGradientUsername(ctx, username, cfg) {
  const { a, b, c, d, fontSize, maxChars } = cfg;
  const name = String(username || 'Player').slice(0, maxChars);
  const boxW = d - c;
  const boxH = b - a;
  const cx = cfg.centerX ?? (c + boxW / 2);

  let size = fontSize;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  while (size > 12) {
    ctx.font = `${size}px TeutonNormal`;
    if (ctx.measureText(name).width <= boxW) break;
    size -= 1;
  }

  ctx.font = `${size}px TeutonNormal`;
  const centerY = a + boxH / 2;
  const textW = ctx.measureText(name).width;
  const gradX1 = cx - textW / 2;
  const gradX2 = cx + textW / 2;

  const grad = ctx.createLinearGradient(gradX1, centerY, gradX2, centerY);
  grad.addColorStop(0.00, '#FFFDE7');
  grad.addColorStop(0.35, '#FFE57F');
  grad.addColorStop(0.70, '#FFB300');
  grad.addColorStop(1.00, '#FF8F00');

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = grad;
  ctx.fillText(name, cx, centerY);
  ctx.restore();
}

function drawDebugSafeZone(ctx, cfg) {
  const { a, b, c, d } = cfg;
  const x = c;
  const y = a;
  const w = d - c;
  const h = b - a;
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.85)';
  ctx.strokeRect(x, y, w, h);
  ctx.font = 'bold 22px TeutonNormal';
  ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`safe zone ${w}x${h}`, x + 5, y + 5);
  ctx.strokeStyle = 'rgba(255, 220, 0, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy);
  ctx.lineTo(cx + 14, cy);
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx, cy + 14);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 220, 0, 0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

router.get('/', async (req, res) => {
  try {
    const username = req.query.username?.trim() || req.query.text?.trim() || 'Player';
    const lobbyInput = req.query.lobby ? parseInt(req.query.lobby, 10) : null;

    const lobbyNum = lobbyInput && !isNaN(lobbyInput)
      ? Math.max(1, Math.min(lobbyInput, LOBBY_COUNT))
      : Math.floor(Math.random() * LOBBY_COUNT) + 1;

    await loadFontRemote();

    const lobbyUrl = `https://raw.githubusercontent.com/arulzzzxd/database/main/fake-ff/${lobbyNum}.jpg`;
    
    // Download gambar lobby dari GitHub
    const imageResponse = await axios.get(lobbyUrl, { responseType: 'arraybuffer' });
    const lobbyImg = await loadImage(Buffer.from(imageResponse.data));

    const { width, height } = config.canvas;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(lobbyImg, 0, 0, width, height);

    drawGradientUsername(ctx, username, config.username);

    if (config.debug) drawDebugSafeZone(ctx, config.username);

    const buffer = await canvas.encode('jpeg', 90);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message || 'Terjadi kesalahan saat membuat gambar Fake FF.'
    });
  }
});

router.desc = "Membuat gambar sertifikat/lobby Fake Free Fire secara kustom.";
router.paramsConfig = {
  username: "text (contoh: ArulzXD)",
  lobby: {
    type: "select",
    options: Array.from({ length: 30 }, (_, i) => String(i + 1)),
    default: "1"
  }
};
router.status = "ready";
router.type = "free";

module.exports = router;
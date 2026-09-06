const express = require('express');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');
const multer = require('multer');

const router = express.Router();
const upload = multer();

let fontLoaded = false;

const config = {
  canvas: { width: 960, height: 1706 },
  rank_name: 'imo',
  border_num: 0,
  avatar: { x: 389, y: 446, size: 204, borderRadius: 12 },
  outline: { color: '#b8956f', thickness: 4 },
  rank: { x: 387, y: 760, size: 210 },
  flag: { x: 364, y: 428, size: 55 },
  username: { a: 681, b: 727, c: 400, centerX: 496, d: 609, fontSize: 36, maxChars: 15, color: '#ffffff' },
  debug: false,
};

const BORDER_OFFSET = {
  1: 26, 2: 36, 3: 26, 4: 26, 5: 26,
  6: 26, 7: 26, 8: 26, 9: 26,
  10: 26, 11: 22, 12: 28, 13: 26,
  14: 21, 15: 26, 16: 26,
};

const RANK_CONFIG = {
  epic:   { size: 210, x: 388, y: 760 },
  glory:  { size: 210, x: 387, y: 760 },
  gm:     { size: 260, x: 358, y: 760 },
  honor:  { size: 210, x: 384, y: 760 },
  imo:    { size: 260, x: 358, y: 760 },
  legend: { size: 260, x: 360, y: 760 },
  mawi:   { size: 210, x: 387, y: 760 },
  romawi: { size: 210, x: 387, y: 760 },
};

async function loadFromUrl(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return loadImage(Buffer.from(res.data));
}

// Memuat font remote menggunakan GlobalFonts.register dari @napi-rs/canvas
async function loadFontRemote() {
  if (fontLoaded) return;
  try {
    const fontUrl = 'https://raw.githubusercontent.com/arulzzzxd/database/main/font/noto-sans.regular.ttf';
    const res = await axios.get(fontUrl, { responseType: 'arraybuffer' });
    const fontBuffer = Buffer.from(res.data);
    
    // Registrasi font untuk @napi-rs/canvas
    GlobalFonts.register(fontBuffer, 'NotoSans');
    fontLoaded = true;
  } catch (err) {
    console.error('Gagal memuat font NotoSans remote:', err.message);
    throw new Error('Gagal memuat font remote.');
  }
}

function calcHeight(img, size) {
  return size * (img.height / img.width);
}

function drawAvatar(ctx, img, cfg, outlineCfg = null) {
  const { x, y, size, borderRadius } = cfg;
  const height = calcHeight(img, size);
  const r = borderRadius || 0;
  ctx.save();
  if (outlineCfg) {
    const { color, thickness } = outlineCfg;
    ctx.beginPath();
    ctx.roundRect(x - thickness, y - thickness, size + thickness * 2, height + thickness * 2, r + thickness);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness * 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.roundRect(x, y, size, height, r);
  ctx.clip();
  ctx.drawImage(img, x, y, size, height);
  ctx.restore();
}

function drawBorder(ctx, img, avatarCfg, borderCfg) {
  const { x, y, size } = avatarCfg;
  const { offset } = borderCfg;
  const bSize = size + offset * 2;
  ctx.drawImage(img, x - offset, y - offset, bSize, bSize);
}

function drawFlagCircle(ctx, img, cfg) {
  const { x, y, size } = cfg;
  const radius = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

function drawUsername(ctx, username, cfg) {
  const { a, b, c, d, centerX, fontSize, maxChars, color } = cfg;
  const y = a;
  const w = d - c;
  const h = b - a;
  const name = username.slice(0, maxChars);
  let size = fontSize;
  ctx.textAlign = 'center';
  while (size > 8) {
    ctx.font = `${size}px NotoSans`;
    if (ctx.measureText(name).width <= w) break;
    size -= 1;
  }
  ctx.fillStyle = color;
  ctx.font = `${size}px NotoSans`;
  ctx.fillText(name, centerX, y + h / 2 + size / 3);
}

async function handleGenerator(req, res) {
  try {
    const body = req.method === 'POST' ? req.body : req.query;
    const username = body.username?.trim() || body.text?.trim() || 'Player';
    const avatarUrl = body.avatar?.trim() || body.url?.trim() || null;
    let rank = (body.rank || config.rank_name).trim().toLowerCase();
    const border = parseInt(body.border, 10) || config.border_num;

    const rankFileKey = rank === 'romawi' ? 'mawi' : rank;
    
    await loadFontRemote();

    const useBorder = border && border > 0 && border <= 16;
    const BASE_DB = 'https://raw.githubusercontent.com/arulzzzxd/database/main/fake-ml';

    let avatarPromise;
    if (req.file && req.file.buffer) {
      avatarPromise = loadImage(req.file.buffer);
    } else if (avatarUrl) {
      avatarPromise = loadFromUrl(avatarUrl);
    } else {
      avatarPromise = loadFromUrl(`${BASE_DB}/avatar.jpg`);
    }

    const baseImages = [
      loadFromUrl(`${BASE_DB}/Lobby.jpg`),
      avatarPromise,
      loadFromUrl(`${BASE_DB}/Bendera.svg`),
      loadFromUrl(`${BASE_DB}/rank/${rankFileKey}.webp`),
    ];

    if (useBorder) {
      baseImages.push(loadFromUrl(`${BASE_DB}/border/${border}.webp`));
    }

    const [lobbyImg, avatarImgLoaded, flagImg, rankImg, borderImg] = await Promise.all(baseImages);

    const { width, height } = config.canvas;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(lobbyImg, 0, 0, width, height);
    drawAvatar(ctx, avatarImgLoaded, config.avatar, useBorder ? null : config.outline);

    if (useBorder && borderImg) {
      drawBorder(ctx, borderImg, config.avatar, { offset: BORDER_OFFSET[border] ?? 26 });
    }

    const rankCfg = RANK_CONFIG[rank] ?? { size: config.rank.size, x: config.rank.x, y: config.rank.y };
    ctx.drawImage(rankImg, rankCfg.x, rankCfg.y, rankCfg.size, calcHeight(rankImg, rankCfg.size));

    drawFlagCircle(ctx, flagImg, config.flag);
    drawUsername(ctx, username, config.username);

    // Encoding buffer gambar khusus untuk @napi-rs/canvas
    const buffer = await canvas.encode('png');

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message || 'Terjadi kesalahan saat membuat gambar Fake ML.'
    });
  }
}

router.post('/', upload.single('avatar'), handleGenerator);
router.get('/', handleGenerator);

router.desc = "Membuat gambar profil/lobby Fake Mobile Legends kustom dengan fitur upload avatar.";
router.paramsConfig = {
  avatar: {
    type: "file",
    desc: "Berkas gambar foto profil/avatar yang akan diunggah"
  },
  username: "text (contoh: ArulzXD)",
  rank: {
    type: "select",
    options: ["epic", "gm", "glory", "imo", "romawi", "honor", "legend"],
    default: "imo"
  },
  border: {
    type: "select",
    options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"],
    default: "1"
  }
};
router.status = "ready";
router.type = "free";

module.exports = router;
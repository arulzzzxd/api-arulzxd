/**
 * NAMA SCRAPE  :: BRAT VERMEIL GENERATOR (NO CACHE)
 * [•] BASIS        :: @napi-rs/canvas
 * [•] CONVERTED    :: Express Router API
 */

const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const express = require('express');
const router = express.Router();

const BRAT_IMAGE_URL = "https://arulz-uploader.vercel.app/files/WyIrfN.jpg";
const BRAT_FONT_URL = "https://raw.githubusercontent.com/arulzzzxd/database/main/font/Poppins.ttf";

const CANVAS = {
  width: 1254,
  height: 1254
};

const SAFE_ZONE = {
  a: 655,
  b: 1118,
  c: 282,
  d: 993
};

const TEXT_STYLE = {
  fontFamily: "Poppins",
  maxFontSize: 90,
  minFontSize: 22,
  lineHeight: 1.18,
  color: "#111111",
  align: "center"
};

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gagal download asset: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getSafeRect(zone) {
  return {
    x: zone.c,
    y: zone.a,
    w: zone.d - zone.c,
    h: zone.b - zone.a,
    centerX: (zone.c + zone.d) / 2,
    centerY: (zone.a + zone.b) / 2
  };
}

function setFont(ctx, size) {
  ctx.font = `${size}px ${TEXT_STYLE.fontFamily}`;
}

function splitLongWord(ctx, word, maxWidth) {
  const chars = [...word];
  const parts = [];
  let current = "";

  for (const char of chars) {
    const test = current + char;
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      parts.push(current);
      current = char;
    }
  }

  if (current) parts.push(current);
  return parts;
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  const words = paragraph.split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;

    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
    } else {
      const parts = splitLongWord(ctx, word, maxWidth);
      lines.push(...parts.slice(0, -1));
      current = parts.at(-1) || "";
    }
  }

  if (current) lines.push(current);
  return lines;
}

function wrapText(ctx, text, maxWidth) {
  return text
    .split("\n")
    .flatMap((paragraph) => {
      const clean = paragraph.trim();
      if (!clean) return [""];
      return wrapParagraph(ctx, clean, maxWidth);
    });
}

function fitText(ctx, text, rect) {
  for (let size = TEXT_STYLE.maxFontSize; size >= TEXT_STYLE.minFontSize; size--) {
    setFont(ctx, size);

    const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
    const lines = wrapText(ctx, text, rect.w);
    const totalHeight = lines.length * lineHeight;

    if (totalHeight <= rect.h) {
      return { size, lines, lineHeight, totalHeight };
    }
  }

  const size = TEXT_STYLE.minFontSize;
  setFont(ctx, size);

  const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
  const lines = wrapText(ctx, text, rect.w);
  const maxLines = Math.max(1, Math.floor(rect.h / lineHeight));
  const clipped = lines.slice(0, maxLines);

  if (lines.length > maxLines && clipped.length) {
    let last = clipped[clipped.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}...`).width > rect.w) {
      last = last.slice(0, -1);
    }
    clipped[clipped.length - 1] = `${last}...`;
  }

  return {
    size,
    lines: clipped,
    lineHeight,
    totalHeight: clipped.length * lineHeight
  };
}

function drawCenteredText(ctx, text, zone) {
  const rect = getSafeRect(zone);
  const fitted = fitText(ctx, text, rect);
  const startY = rect.y + (rect.h - fitted.totalHeight) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  setFont(ctx, fitted.size);
  ctx.fillStyle = TEXT_STYLE.color;
  ctx.textAlign = TEXT_STYLE.align;
  ctx.textBaseline = "top";

  fitted.lines.forEach((line, index) => {
    const y = startY + index * fitted.lineHeight;
    ctx.fillText(line, rect.centerX, y);
  });

  ctx.restore();
}

// Endpoint GET Utama
router.get('/', async (req, res) => {
  const text = req.query.text;
  if (!text) return res.status(400).json({ status: false, error: "Missing 'text' parameter" });

  try {
    const inputText = normalizeText(text);

    // Ambil asset font dan gambar secara realtime per request
    const [imageBuffer, fontBuffer] = await Promise.all([
      downloadBuffer(BRAT_IMAGE_URL),
      downloadBuffer(BRAT_FONT_URL)
    ]);

    // Daftarkan font ke sistem global napi-rs canvas secara realtime
    GlobalFonts.register(fontBuffer, TEXT_STYLE.fontFamily);

    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(CANVAS.width, CANVAS.height);
    const ctx = canvas.getContext("2d");

    // Gambar template base dan timpa teksnya
    ctx.drawImage(image, 0, 0, CANVAS.width, CANVAS.height);
    drawCenteredText(ctx, inputText, SAFE_ZONE);

    // Generate output gambar berupa PNG buffer
    const imageBufferOutput = await canvas.encode("png");

    // Kirim response data stream gambar langsung ke client
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBufferOutput.length);
    return res.end(imageBufferOutput);

  } catch (e) {
    return res.status(500).json({ status: false, error: e.message });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;

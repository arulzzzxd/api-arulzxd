const express = require("express");
const axios = require("axios");
const {
    createCanvas,
    loadImage,
    GlobalFonts
} = require("@napi-rs/canvas");

const router = express.Router();

const BULAN_ID = [
  "Januari", "Februari", "Maret", "April",
  "Mei", "Juni", "Juli", "Agustus",
  "September", "Oktober", "November", "Desember"
];

const FONT_SANS_URL = "https://raw.githubusercontent.com/arulzzzxd/database/main/font/rupa_sans_regular.ttf";
const FONT_SANS_BOLD_URL = "https://raw.githubusercontent.com/arulzzzxd/database/main/font/rupa_sans_semi_bold.ttf";
const FONT_SERIF_URL = "https://raw.githubusercontent.com/arulzzzxd/database/main/font/rupa_serif_semi_bold.ttf";

const BG_URL = "https://cdn.arulzzxd.my.id/files/es5kqick.jpg";
const REPORT_URL = "https://cdn.arulzzxd.my.id/files/jN353NzeLA.svg";
const EYE_URL = "https://cdn.arulzzxd.my.id/files/I8A0YvN7.svg";
const NEXT_URL = "https://cdn.arulzzxd.my.id/files/OZYY2z3jA4.svg";

const CONFIG = {
  pos: {
    saldo: { x: 62, y: 325 },
    koin: { x: 115, y: 400 },
    pill: { x: 50, y: 510 }
  },
  fontSize: {
    rp: 34,
    saldo: 95,
    koin: 34,
    pill: 34
  },
  icon: {
    eye: { w: 60, h: 60 },
    report: { w: 30, h: 30 },
    next: { w: 30, h: 30 }
  },
  pill: {
    height: 48,
    paddingLeft: 14,
    paddingRight: 14,
    gapIconText: 10,
    gapTextArrow: 16
  },
  gap: {
    rpToAngka: 8,
    angkaToEye: 20,
    eyeOffsetY: 12
  },
  color: {
    report: "rgb(196, 227, 245)",
    eye: "rgb(204, 226, 240)"
  }
};

let fontLoaded = false;
let bgCache = null;
let reportCache = null;
let eyeCache = null;
let nextCache = null;

async function getBuffer(url) {
    const { data } = await axios.get(url, {
        responseType: "arraybuffer",
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    return Buffer.from(data);
}

async function loadAssets() {
    if (!fontLoaded) {
        try {
            const fontRegBuf = await getBuffer(FONT_SANS_URL);
            GlobalFonts.register(fontRegBuf, "RupaSans");
        } catch (err) {
            console.warn("Gagal memuat font RupaSans:", err.message);
        }

        try {
            const fontSbBuf = await getBuffer(FONT_SANS_BOLD_URL);
            GlobalFonts.register(fontSbBuf, "RupaSansBold");
        } catch (err) {
            console.warn("Gagal memuat font RupaSansBold:", err.message);
        }

        try {
            const fontSerifBuf = await getBuffer(FONT_SERIF_URL);
            GlobalFonts.register(fontSerifBuf, "RupaSerif");
        } catch (err) {
            console.warn("Gagal memuat font RupaSerif:", err.message);
        }

        fontLoaded = true;
    }

    if (!bgCache) bgCache = await getBuffer(BG_URL);
    if (!reportCache) reportCache = await getBuffer(REPORT_URL);
    if (!eyeCache) eyeCache = await getBuffer(EYE_URL);
    if (!nextCache) nextCache = await getBuffer(NEXT_URL);
}

function tintIcon(ctx, img, x, y, w, h, color) {
  const off = createCanvas(w, h);
  const octx = off.getContext("2d");

  octx.drawImage(img, 0, 0, w, h);
  octx.globalCompositeOperation = "source-in";
  octx.fillStyle = color;
  octx.fillRect(0, 0, w, h);

  ctx.drawImage(off, x, y, w, h);
}

function formatRupiahNumber(value) {
  return String(value || "0").replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

router.get("/", async (req, res) => {
  try {
    const text = req.query.text?.trim();

    let saldo = req.query.saldo?.trim();
    let koin = req.query.koin?.trim();
    let terpakai = req.query.terpakai?.trim();
    let bulan = req.query.bulan?.trim();

    if (text && text.includes("|")) {
      const parts = text.split("|").map((v) => (v ? v.trim() : ""));
      saldo = saldo || parts[0];
      koin = koin || parts[1];
      terpakai = terpakai || parts[2];
      bulan = bulan || parts[3];
    } else if (text && !saldo) {
      saldo = text;
    }

    if (!saldo) {
      return res.status(400).json({
        status: false,
        message: "Parameter saldo/text wajib diisi (contoh: ?saldo=100000 atau ?text=100000|500|20000|Mei)"
      });
    }

    await loadAssets();

    const bgImg = await loadImage(bgCache);
    const iconReport = await loadImage(reportCache);
    const iconEye = await loadImage(eyeCache);
    const iconNext = await loadImage(nextCache);

    const canvas = createCanvas(bgImg.width, bgImg.height);
    const ctx = canvas.getContext("2d");

    const { pos, fontSize, icon, pill, gap, color } = CONFIG;

    ctx.drawImage(bgImg, 0, 0);

    // Default nilai opsional jika tidak diisi
    const numSaldo = parseInt(saldo.replace(/[^\d]/g, "")) || 100000;
    koin = koin || String(Math.floor(Math.random() * 900) + 100);
    terpakai = terpakai || String(Math.floor(Math.random() * Math.min(numSaldo, 500000)));
    bulan = bulan || BULAN_ID[new Date().getMonth()];

    // Render Saldo
    const saldoStr = formatRupiahNumber(saldo);
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${fontSize.rp}px RupaSansBold, sans-serif`;
    ctx.fillText("Rp", pos.saldo.x, pos.saldo.y - 38);

    const rpW = ctx.measureText("Rp").width;

    ctx.font = `800 ${fontSize.saldo}px RupaSerif, sans-serif`;
    const angkaX = pos.saldo.x + rpW + gap.rpToAngka;
    ctx.fillText(saldoStr, angkaX, pos.saldo.y);

    const angkaW = ctx.measureText(saldoStr).width;
    const eyeX = angkaX + angkaW + gap.angkaToEye;
    const eyeMidY = pos.saldo.y - fontSize.saldo / 2 + gap.eyeOffsetY;

    tintIcon(
      ctx,
      iconEye,
      eyeX,
      eyeMidY - icon.eye.h / 2,
      icon.eye.w,
      icon.eye.h,
      color.eye
    );

    // Render Koin
    const koinStr = String(koin);
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${fontSize.koin}px RupaSansBold, sans-serif`;
    ctx.fillText(koinStr, pos.koin.x, pos.koin.y);

    const koinAngkaW = ctx.measureText(koinStr).width;

    ctx.font = `400 ${fontSize.koin}px RupaSans, sans-serif`;
    ctx.fillText(" Coins", pos.koin.x + koinAngkaW, pos.koin.y);

    // Render Pill Informasi Terpakai
    const rpTerpakaiText = `Rp${formatRupiahNumber(terpakai)}`;

    ctx.font = `600 ${fontSize.pill}px RupaSansBold, sans-serif`;
    const rpTerpakaiW = ctx.measureText(rpTerpakaiText).width;

    ctx.font = `400 ${fontSize.pill}px RupaSans, sans-serif`;
    const sisaText = ` udah terpakai di ${bulan}`;
    const sisaW = ctx.measureText(sisaText).width;

    const textW = rpTerpakaiW + sisaW;

    const pillW =
      pill.paddingLeft +
      icon.report.w +
      pill.gapIconText +
      textW +
      pill.gapTextArrow +
      icon.next.w +
      pill.paddingRight;

    const pillCenterY = pos.pill.y + pill.height / 2;
    const textBaseY = pillCenterY + fontSize.pill / 3;

    const textStartX =
      pos.pill.x +
      pill.paddingLeft +
      icon.report.w +
      pill.gapIconText;

    tintIcon(
      ctx,
      iconReport,
      pos.pill.x + pill.paddingLeft,
      pillCenterY - icon.report.h / 2,
      icon.report.w,
      icon.report.h,
      color.report
    );

    tintIcon(
      ctx,
      iconNext,
      pos.pill.x + pillW - pill.paddingRight - icon.next.w,
      pillCenterY - icon.next.h / 2,
      icon.next.w,
      icon.next.h,
      "#fff"
    );

    ctx.fillStyle = "#fff";
    ctx.font = `600 ${fontSize.pill}px RupaSansBold, sans-serif`;
    ctx.fillText(rpTerpakaiText, textStartX, textBaseY);

    ctx.font = `400 ${fontSize.pill}px RupaSans, sans-serif`;
    ctx.fillText(sisaText, textStartX + rpTerpakaiW, textBaseY);

    const buffer = await canvas.encode("png");
    res.setHeader("Content-Type", "image/png");
    res.end(buffer);

  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message
    });
  }
});

router.desc = "Maker untuk membuat tampilan Fake Saldo GoPay.";
router.paramsConfig = {
  saldo: "contoh: 100000",
  koin: "contoh: 500",
  terpakai: "contoh: 20000",
  bulan: {
    type: "select",
    options: BULAN_ID,
    default: BULAN_ID[new Date().getMonth()]
  }
};
router.status = "ready";
router.type = "free";

module.exports = router;

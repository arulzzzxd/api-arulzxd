const express = require("express");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const router = express.Router();

const BULAN_ID = [
  "Januari", "Februari", "Maret", "April",
  "Mei", "Juni", "Juli", "Agustus",
  "September", "Oktober", "November", "Desember"
];

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

async function downloadBuffer(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  if (!res.ok) {
    throw new Error(`Download gagal: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

let loadedResources = null;

async function getResources() {
  if (loadedResources) return loadedResources;

  // Load dan Registrasi Font ke GlobalFonts
  try {
    const fontRegBuf = await downloadBuffer("https://raw.githubusercontent.com/arulzzzxd/database/main/font/rupa_sans_regular.ttf");
    GlobalFonts.register(fontRegBuf, "RupaSans");
  } catch (err) {
    console.warn("Gagal memuat font RupaSans:", err.message);
  }

  try {
    const fontSbBuf = await downloadBuffer("https://raw.githubusercontent.com/arulzzzxd/database/main/font/rupa_sans_semi_bold.ttf");
    GlobalFonts.register(fontSbBuf, "RupaSansBold");
  } catch (err) {
    console.warn("Gagal memuat font RupaSansBold:", err.message);
  }

  try {
    const fontSerifBuf = await downloadBuffer("https://raw.githubusercontent.com/arulzzzxd/database/main/font/rupa_serif_semi_bold.ttf");
    GlobalFonts.register(fontSerifBuf, "RupaSerif");
  } catch (err) {
    console.warn("Gagal memuat font RupaSerif:", err.message);
  }

  // Load Asset Gambar dan Icon
  const bgBuf = await downloadBuffer("https://cdn.arulzzxd.my.id/files/es5kqick.jpg");
  const reportBuf = await downloadBuffer("https://cdn.arulzzxd.my.id/files/jN353NzeLA.svg");
  const eyeBuf = await downloadBuffer("https://cdn.arulzzxd.my.id/files/I8A0YvN7.svg");
  const nextBuf = await downloadBuffer("https://cdn.arulzzxd.my.id/files/OZYY2z3jA4.svg");

  const bgImg = await loadImage(bgBuf);
  const iconReport = await loadImage(reportBuf);
  const iconEye = await loadImage(eyeBuf);
  const iconNext = await loadImage(nextBuf);

  loadedResources = { bgImg, iconReport, iconEye, iconNext };
  return loadedResources;
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

async function generateGopayImage(saldoInput, koinInput, terpakaiInput, bulanInput) {
  const { bgImg, iconReport, iconEye, iconNext } = await getResources();

  const canvas = createCanvas(bgImg.width, bgImg.height);
  const ctx = canvas.getContext("2d");

  const { pos, fontSize, icon, pill, gap, color } = CONFIG;

  ctx.drawImage(bgImg, 0, 0);

  // Render Saldo
  const saldoStr = formatRupiahNumber(saldoInput);
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
  const koinStr = String(koinInput || "0");
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${fontSize.koin}px RupaSansBold, sans-serif`;
  ctx.fillText(koinStr, pos.koin.x, pos.koin.y);

  const koinAngkaW = ctx.measureText(koinStr).width;

  ctx.font = `400 ${fontSize.koin}px RupaSans, sans-serif`;
  ctx.fillText(" Coins", pos.koin.x + koinAngkaW, pos.koin.y);

  // Render Pill Informasi Terpakai
  const rpTerpakaiText = `Rp${formatRupiahNumber(terpakaiInput)}`;
  const bulanStr = bulanInput || BULAN_ID[new Date().getMonth()];

  ctx.font = `600 ${fontSize.pill}px RupaSansBold, sans-serif`;
  const rpTerpakaiW = ctx.measureText(rpTerpakaiText).width;

  ctx.font = `400 ${fontSize.pill}px RupaSans, sans-serif`;
  const sisaText = ` udah terpakai di ${bulanStr}`;
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

  return await canvas.encode("png");
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
        creator: "ArulzXD",
        message: "Parameter saldo tidak boleh kosong. Gunakan ?saldo=100000 atau ?text=100000|500|20000|Mei"
      });
    }

    // Default value opsional jika tidak diisi
    const numSaldo = parseInt(saldo.replace(/[^\d]/g, "")) || 100000;
    koin = koin || String(Math.floor(Math.random() * 900) + 100);
    terpakai = terpakai || String(Math.floor(Math.random() * Math.min(numSaldo, 500000)));
    bulan = bulan || BULAN_ID[new Date().getMonth()];

    const buffer = await generateGopayImage(saldo, koin, terpakai, bulan);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message || "Terjadi kesalahan saat membuat gambar Fake GoPay."
    });
  }
});

router.desc = "Membuat gambar tampilan Fake GoPay secara kustom.";
router.paramsConfig = {
  saldo: "text",
  koin: "text",
  terpakai: "text",
  bulan: {
    type: "select",
    options: BULAN_ID,
    default: BULAN_ID[new Date().getMonth()]
  }
};

router.status = "ready";
router.type = "free";

module.exports = router;

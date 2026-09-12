/**
 * ✦ Nama Scrape : HD Video Enhancer (Auto Aspect Ratio)
 * ✦ Author      : ArulzXD
 * ✦ Deskripsi   : Meningkatkan kualitas video ke HD (1080p) dengan mempertahankan aspek rasio asli video (16:9, 9:16, 1:1, dll).
 */

const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const path = require("path");
const os = require("os");
const fs = require("fs");

// Set path executable ffmpeg secara statis
ffmpeg.setFfmpegPath(ffmpegStatic);

const router = express.Router();

// Middleware Multer untuk penanganan berkas sementara
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 } // Batas maksimal video 100MB
});

async function processHdVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        // Menyesuaikan sisi terpanjang ke 1080px & skala otomatis menjaga rasio asli (16:9, 9:16, 1:1, dll)
        "-vf scale='if(gt(iw,ih),1080,-2)':'if(gt(iw,ih),-2,1080)':force_original_aspect_ratio=decrease,trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v libx264",         // Codec Video H.264
        "-preset fast",         // Kecepatan enkoding
        "-crf 18",              // Kualitas HD lebih tajam
        "-c:a aac",             // Codec Audio AAC
        "-b:a 192k",            // Bitrate audio HD
        "-pix_fmt yuv420p",     // Format piksel universal
        "-movflags +faststart"  // Faststart untuk playback web
      ])
      .toFormat("mp4")
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

router.post("/", upload.single("fileupload"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      status: false,
      creator: "ArulzXD",
      message: "Berkas video 'fileupload' wajib diunggah!"
    });
  }

  const inputPath = file.path;
  const outputPath = path.join(os.tmpdir(), `hd_${Date.now()}.mp4`);

  try {
    await processHdVideo(inputPath, outputPath);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `inline; filename="hd_${Date.now()}.mp4"`);

    return res.sendFile(outputPath, (err) => {
      // Hapus berkas temporary setelah selesai dikirim atau gagal
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

      if (err && !res.headersSent) {
        console.error("Error sending HD video file:", err);
      }
    });

  } catch (err) {
    // Bersihkan berkas masukan jika terjadi eror
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    console.error("FFmpeg Processing Error:", err);
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message || "Terjadi kesalahan saat memproses video ke HD."
    });
  }
});

router.desc = "Meningkatkan kualitas video ke HD dengan otomatis mempertahankan aspek rasio asli (16:9, 9:16, 1:1, dll).";
router.paramsConfig = {
  fileupload: {
    type: "file",
    desc: "Berkas video yang akan ditingkatkan kualitasnya (max 100MB)"
  }
};
router.status = "ready";
router.type = "free";

module.exports = router;
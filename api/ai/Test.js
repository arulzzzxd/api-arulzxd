/**
 * ✦ Nama Scrape : HD Video Upscaler / Enhancer (FFmpeg)
 * ✦ Author      : ArulzXD
 * ✦ Deskripsi   : Mengubah resolusi video menjadi Full HD (1080p) dan mengoptimalkan kualitas audio-video menggunakan fluent-ffmpeg.
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
        "-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // Rescale ke 1080p tanpa merusak rasio
        "-c:v libx264",         // Codec Video H.264
        "-preset fast",         // Kecepatan enkoding
        "-crf 20",              // Constant Rate Factor (kualitas tinggi, makin kecil makin bagus)
        "-b:v 4500k",           // Bitrate video target HD
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

router.desc = "Meningkatkan kualitas video menjadi Full HD (1080p) menggunakan FFmpeg.";
router.paramsConfig = {
  fileupload: {
    type: "file",
    desc: "Berkas video yang akan ditingkatkan menjadi HD (max 100MB)"
  }
};
router.status = "ready";
router.type = "free";

module.exports = router;
/**
 * ✦ Nama Scrape : HD Video Enhancer (Auto Aspect Ratio)
 * ✦ Author      : ArulzXD
 * ✦ Deskripsi   : Meningkatkan kualitas video ke HD dengan otomatis mempertahankan aspek rasio asli (16:9, 9:16, 1:1, dll).
 */

const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const path = require("path");
const os = require("os");
const fs = require("fs");

// Set path executable ffmpeg & ffprobe
ffmpeg.setFfmpegPath(ffmpegStatic);

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 } // Ditingkatkan aman ke 50MB
});

function getMetadata(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata);
    });
  });
}

async function processHdVideo(inputPath, outputPath) {
  // Ambil metadata dimensi video asli
  const metadata = await getMetadata(inputPath);
  const videoStream = metadata.streams.find(s => s.codec_type === 'video');

  const width = videoStream ? videoStream.width : 0;
  const height = videoStream ? videoStream.height : 0;

  // Tentukan skala HD berdasarkan orientasi (Landscape vs Portrait/Square)
  let scaleFilter = "scale=1920:-2"; // Default Landscape 16:9
  if (height > width) {
    scaleFilter = "scale=-2:1920"; // Portrait 9:16
  } else if (width === height) {
    scaleFilter = "scale=1080:1080"; // Square 1:1
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf ${scaleFilter}`,    // Menjaga rasio asli & memastikan dimensi genap
        "-c:v libx264",          // Codec Video H.264
        "-preset ultrafast",     // Kecepatan maksimal agar tidak timeout di serverless
        "-crf 23",               // Kualitas HD seimbang
        "-c:a aac",              // Codec Audio AAC
        "-b:a 128k",             // Bitrate audio
        "-pix_fmt yuv420p",      // Format piksel universal
        "-movflags +faststart"   // Playback web cepat
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
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

      if (err && !res.headersSent) {
        console.error("Error sending HD video file:", err);
      }
    });

  } catch (err) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    console.error("FFmpeg Processing Error:", err.message);
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message || "Terjadi kesalahan saat memproses video ke HD."
    });
  }
});

router.desc = "Meningkatkan kualitas video ke HD dengan mempertahankan aspek rasio asli (16:9, 9:16, 1:1, dll).";
router.paramsConfig = {
  fileupload: {
    type: "file",
    desc: "Berkas video yang akan ditingkatkan kualitasnya"
  }
};
router.status = "ready";
router.type = "free";

module.exports = router;
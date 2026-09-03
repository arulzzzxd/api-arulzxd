const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { Readable } = require("stream");

ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();

async function getHlsStreams(masterUrl) {
  const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
  const res = await fetch(masterUrl);
  const text = await res.text();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let videoStreamUrl = null;
  let audioStreamUrl = null;
  let lastBandwidth = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
      const bw = parseInt(lines[i].match(/BANDWIDTH=(\d+)/)?.[1] || "0");
      if (bw > lastBandwidth) {
        lastBandwidth = bw;
        const u = lines[i + 1];
        videoStreamUrl = u?.startsWith("http") ? u : baseUrl + u;
      }
    }
    if (lines[i].startsWith("#EXT-X-MEDIA") && lines[i].includes("TYPE=AUDIO")) {
      const m = lines[i].match(/URI="([^"]+)"/);
      if (m) audioStreamUrl = m[1].startsWith("http") ? m[1] : baseUrl + m[1];
    }
  }

  return {
    videoUrl: videoStreamUrl || masterUrl,
    audioUrl: audioStreamUrl
  };
}

router.get("/", async (req, res) => {
  try {
    const url = req.query.url?.trim() || req.query.text?.trim();

    if (!url) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Masukkan parameter url m3u8 (contoh: ?url=https://...m3u8)"
      });
    }

    const { videoUrl, audioUrl } = await getHlsStreams(url);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "inline; filename=video.mp4");

    let command = ffmpeg().input(videoUrl);

    if (audioUrl) {
      command = command.input(audioUrl);
    }

    command
      .outputOptions([
        "-c copy",
        "-bsf:a aac_adtstoasc",
        "-movflags frag_keyframe+empty_moov"
      ])
      .format("mp4")
      .on("error", (err) => {
        if (!res.headersSent) {
          console.error("FFmpeg error:", err.message);
          res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.message
          });
        }
      })
      .pipe(res, { end: true });

  } catch (err) {
    console.error(err);

    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        creator: "ArulzXD",
        message: err.message
      });
    }
  }
});

router.paramsConfig = {
  url: "text"
};

router.status = "ready";
router.type = "free";

module.exports = router;
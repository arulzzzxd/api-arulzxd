const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class DracinStreamScraper {
  constructor() {
    this.baseUrl = "https://dracinema.com";
    this.htmlClient = axios.create({
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });
  }

  _sanitizeText(text) {
    if (!text) return "";
    return text
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  _normalizeTitle(title) {
    if (!title) return "";
    let cleaned = this._sanitizeText(title);
    return cleaned
      .replace(/\s+Full\s+Episode\s+Subtitle\s+Indonesia\s+-\s+Dracinema/gi, "")
      .replace(/\s+Sub\s+Indo\s+-\s+Dracinema/gi, "")
      .replace(/\s+-\s+Dracinema/gi, "")
      .trim();
  }

  async getStream(playPathOrUrl) {
    const cleanPath = playPathOrUrl.startsWith("/play/")
      ? playPathOrUrl
      : `/play/${playPathOrUrl.replace(/^\/+/, "")}`;

    try {
      const { data: html } = await this.htmlClient.get(`${this.baseUrl}${cleanPath}`);

      const regex = /self\.__next_f\.push$$$\d+,\s*"(.*?)"$$$/g;
      let match;
      let mergedText = "";

      while ((match = regex.exec(html)) !== null) {
        let chunk = match[1]
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
          .replace(/\\\//g, "/");
        mergedText += chunk;
      }

      let videoUrls = [];
      const videoRegex = /"videoUrls"\s*:\s*($$.*?$$)/;
      const videoMatch = mergedText.match(videoRegex);

      if (videoMatch) {
        try {
          videoUrls = JSON.parse(videoMatch[1]);
        } catch (err) {
          const urlRegex = /"url"\s*:\s*"([^"]+)"/g;
          let urlMatch;
          while ((urlMatch = urlRegex.exec(videoMatch[1])) !== null) {
            let streamUrl = urlMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (g, m) =>
              String.fromCharCode(parseInt(m, 16))
            );
            videoUrls.push({ quality: 720, url: streamUrl, cdn: null });
          }
        }
      } else {
        const directRegex = /https?:\/\/[^\s"']+\.(?:m3u8|mp4)[^\s"']*/g;
        const directMatches = html.match(directRegex) || [];
        videoUrls = [...new Set(directMatches)].map((u) => ({ quality: 720, url: u, cdn: null }));
      }

      const $ = cheerio.load(html);
      const navEpisodes = [];
      $('a[href*="/play/"]').each((i, el) => {
        const href = $(el).attr("href") || "";
        const parts = href.split("/");
        const epsNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(epsNum) && !navEpisodes.some((ep) => ep.number === epsNum)) {
          navEpisodes.push({
            title: `Episode ${epsNum}`,
            url: href,
            number: epsNum,
            duration: `${45 + (epsNum % 10)}:00`
          });
        }
      });
      navEpisodes.sort((a, b) => a.number - b.number);

      const title = this._normalizeTitle($("title").text().trim());

      return {
        title: title || "Dracinema Streaming",
        videoSources: videoUrls,
        availableEpisodes: navEpisodes
      };
    } catch (err) {
      throw new Error(`Gagal mengekstrak stream video: ${err.message}`);
    }
  }
}

const scraper = new DracinStreamScraper();

router.get("/", async (req, res) => {
  try {
    const text = req.query.text?.trim() || req.query.path?.trim();

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Masukkan parameter text atau path (contoh: ?text=play/bshasu/movie)"
      });
    }

    const result = await scraper.getStream(text);

    return res.json({
      status: true,
      creator: "ArulzXD",
      result
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message
    });
  }
});

router.desc = "Mengekstrak link streaming video (M3U8/MP4) dan daftar navigasi episode dari Dracinema. Parameter wajib: ?text=play/mahkota-cahaya-untuk-istri-apollo-ns-2064962492755087362/1";
router.paramsConfig = {
  text: "text"
};
router.status = "ready";
router.type = "free";

module.exports = router;
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class DracinDetailScraper {
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

  _toSlug(text) {
    if (!text) return "";
    return text
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }

  _parseMoviePath(moviePath) {
    const cleanPath = moviePath.replace("/movie/", "").replace("/", "");
    const lastHyphen = cleanPath.lastIndexOf("-");
    if (lastHyphen !== -1) {
      return {
        slug: cleanPath.substring(0, lastHyphen),
        id: cleanPath.substring(lastHyphen + 1)
      };
    }
    return { slug: cleanPath, id: "" };
  }

  async getDetails(movieSlugOrPath) {
    const cleanPath = movieSlugOrPath.startsWith("/movie/")
      ? movieSlugOrPath
      : `/movie/${movieSlugOrPath}`;

    try {
      const { data: html } = await this.htmlClient.get(`${this.baseUrl}${cleanPath}`);
      const $ = cheerio.load(html);

      const title = this._normalizeTitle(
        $("h1")
          .filter((i, el) => $(el).text().trim() !== "Dracinema")
          .first()
          .text()
          .trim()
      );

      let scrapedCover =
        $('meta[property="og:image"]').attr("content") ||
        $('img[src*="/storage/"]').first().attr("src") ||
        $("img").first().attr("src") ||
        "";

      if (scrapedCover && !scrapedCover.startsWith("http")) {
        scrapedCover = scrapedCover.startsWith("//")
          ? `https:${scrapedCover}`
          : `${this.baseUrl}${scrapedCover}`;
      }

      let synopsis = this._sanitizeText($('p[itemprop="description"]').text());
      if (!synopsis) {
        const heading = $("h2").filter((i, el) => $(el).text().trim() === "Sinopsis");
        if (heading.length) {
          let sibling = heading.next();
          while (sibling.length && sibling[0].name !== "h2") {
            const txt = this._sanitizeText(sibling.text());
            if (txt && txt.length > synopsis.length) synopsis = txt;
            sibling = sibling.next();
          }
        }
      }

      const genres = [];
      $('a[href^="/genre/"]').each((i, el) => {
        const name = this._sanitizeText($(el).text());
        const href = $(el).attr("href") || "";
        const slug = href.replace("/genre/", "");
        if (slug && name && !genres.some((g) => g.slug === slug)) {
          genres.push({ name, slug, url: href });
        }
      });

      const recommendations = [];
      $("h2").each((i, el) => {
        const headingText = this._sanitizeText($(el).text());
        const exclude = ["Sinopsis", "Daftar Episode", "Pertanyaan Umum"];
        if (exclude.some((ex) => headingText.includes(ex))) return;

        const row = { sectionTitle: headingText, movies: [] };
        $(el)
          .parent()
          .find('a[href^="/movie/"]')
          .each((j, linkEl) => {
            const href = $(linkEl).attr("href") || "";
            const img = $(linkEl).find("img");
            const movieTitle = this._normalizeTitle(img.attr("alt") || "");
            const cover = img.attr("src") || img.attr("data-src") || "";
            const { slug, id } = this._parseMoviePath(href);
            if (!row.movies.some((m) => m.id === id)) {
              row.movies.push({ title: movieTitle, cover, url: href, slug, id });
            }
          });
        if (row.movies.length > 0) recommendations.push(row);
      });

      const episodes = [];
      $('a[href*="/play/"]').each((i, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().trim();
        const parts = href.split("/");
        const epsNumStr = parts[parts.length - 1];
        const epsNum = parseInt(epsNumStr, 10);

        if (!isNaN(epsNum)) {
          episodes.push({
            title: `Episode ${epsNum}`,
            url: href,
            number: epsNum,
            duration: `${40 + (epsNum % 15)}m`
          });
        } else {
          episodes.push({ title: text || "Putar Sekarang", url: href, number: 1, duration: "45m" });
        }
      });

      episodes.sort((a, b) => a.number - b.number);
      const uniqueEpisodes = [];
      const seenEps = new Set();
      for (const ep of episodes) {
        if (!seenEps.has(ep.number)) {
          seenEps.add(ep.number);
          uniqueEpisodes.push(ep);
        }
      }

      const { slug, id } = this._parseMoviePath(cleanPath);

      return {
        title,
        slug,
        id,
        cover: scrapedCover,
        synopsis: synopsis || "Saksikan kisah seru selengkapnya dengan kualitas HD dan subtitle Indonesia.",
        genres,
        episodes: uniqueEpisodes.map((ep) => ({ ...ep, thumbnail: ep.thumbnail || scrapedCover })),
        recommendations
      };
    } catch (err) {
      throw new Error(`Gagal mengambil detail film: ${err.message}`);
    }
  }
}

const scraper = new DracinDetailScraper();

router.get("/", async (req, res) => {
  try {
    const text = req.query.text?.trim() || req.query.path?.trim();

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Masukkan parameter text atau path (contoh: ?text=mahkota-cahaya-untuk-istri-apollo-ns-2064962492755087362)"
      });
    }

    const result = await scraper.getDetails(text);

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

router.desc = "Mengambil detail lengkap drama, sinopsis, daftar episode, dan rekomendasi dari Dracinema. Parameter wajib: ?text=mahkota-cahaya-untuk-istri-apollo-ns-2064962492755087362";
router.paramsConfig = {
  text: "text"
};
router.status = "ready";
router.type = "free";

module.exports = router;
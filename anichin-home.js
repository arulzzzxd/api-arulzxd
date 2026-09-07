const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const router = express.Router();

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
];

class AnichinScraper {
  constructor(options = {}) {
    this.baseUrl = 'https://anichin.cafe';
    this.proxy = options.proxy || null;
    this.timeout = options.timeout || 20000;
    this.uaList = userAgents;
    this._uaIndex = 0;
    this._lastUrl = '';
  }

  _randomDelay() {
    const min = 300;
    const max = 1200;
    return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
  }

  _getHeaders() {
    const ua = this.uaList[this._uaIndex % this.uaList.length];
    this._uaIndex++;
    return {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': this.baseUrl + '/',
      'Connection': 'keep-alive'
    };
  }

  async _fetch(url, retries = 5) {
    const headers = this._getHeaders();
    const config = {
      url,
      method: 'GET',
      headers,
      timeout: this.timeout,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      maxRedirects: 5,
      decompress: true
    };
    if (this.proxy) config.proxy = this.proxy;
    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios(config);
        return response.data;
      } catch (err) {
        lastError = err;
        if (err.response && err.response.status === 403) {
          await this._randomDelay();
          continue;
        }
        if (i < retries - 1) await this._randomDelay();
      }
    }
    throw lastError || new Error('Fetch failed after retries');
  }

  _clean(obj) {
    if (obj === null || obj === undefined) return undefined;
    if (Array.isArray(obj)) {
      const cleaned = obj.map(item => this._clean(item)).filter(item => item !== undefined);
      return cleaned.length ? cleaned : undefined;
    }
    if (typeof obj === 'object') {
      const result = {};
      for (const key of Object.keys(obj)) {
        const val = this._clean(obj[key]);
        if (val !== undefined) result[key] = val;
      }
      return Object.keys(result).length ? result : undefined;
    }
    return obj;
  }

  _parseList($, containerSelector = '.listupd .bs', isSchedule = false) {
    const items = [];
    $(containerSelector).each((i, el) => {
      const $el = $(el);
      const seriesLink = $el.find('a[href*="/seri/"]').first();
      const episodeLink = $el.find('a[href*="-episode-"]').first();

      let link = null;
      let title = null;
      let image = null;
      let status = null;
      let episode = null;
      let time = null;
      let episodeCount = null;

      const ttRaw = $el.find('.tt').text().trim();
      const titleParts = ttRaw.split(/\s{2,}/).filter(s => s.length > 0);
      const cleanTitle = titleParts.length > 0 ? titleParts[0] : null;

      if (seriesLink.length) {
        link = seriesLink.attr('href');
        title = cleanTitle || seriesLink.attr('title') || seriesLink.text().trim();
        const text = $el.text();
        if (text.includes('Ongoing')) status = 'Ongoing';
        else if (text.includes('Completed')) status = 'Completed';
        else if (text.includes('Movie')) status = 'Movie';
        else if (text.includes('Upcoming')) status = 'Upcoming';
        image = $el.find('img[src*="wp-content"]').attr('src') ||
                $el.find('img[data-src*="wp-content"]').attr('data-src') || null;
      } else if (episodeLink.length) {
        link = episodeLink.attr('href');
        title = cleanTitle || episodeLink.attr('title') || episodeLink.text().trim();
        const epMatch = link.match(/episode-(\d+)/);
        if (epMatch) episode = parseInt(epMatch[1]);
        image = $el.find('img[src*="wp-content"]').attr('src') ||
                $el.find('img[data-src*="wp-content"]').attr('data-src') || null;
      } else {
        return;
      }

      if (!link || !title) return;

      items.push({
        title: title.replace(/\s+/g, ' ').trim(),
        link: link.startsWith('http') ? link : this.baseUrl + link,
        image,
        status,
        episode,
        time,
        episodeCount
      });
    });
    return items;
  }

  _extractPagination($) {
    const pagination = { current: 1, next: null, total: null, hasNext: false };
    const links = [];
    $('.pagination a, .page-numbers a, .nav-links a, a[href*="/page/"], a[href*="?page="]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) links.push({ text, href });
    });

    const nextLink = links.find(l => l.text.toLowerCase().includes('next') || l.text === '»');
    if (nextLink) {
      pagination.next = nextLink.href.startsWith('http') ? nextLink.href : this.baseUrl + nextLink.href;
      pagination.hasNext = true;
    }

    const numbers = links.filter(l => /^\d+$/.test(l.text.trim()));
    if (numbers.length) {
      const maxPage = Math.max(...numbers.map(l => parseInt(l.text.trim())));
      pagination.total = maxPage;
    }

    const url = this._lastUrl || '';
    let pageMatch = url.match(/[?&]page=(\d+)/) || url.match(/\/page\/(\d+)/);
    if (pageMatch) pagination.current = parseInt(pageMatch[1]);
    return pagination;
  }

  async home(page = 1) {
    const url = page === 1 ? this.baseUrl + '/' : this.baseUrl + `/page/${page}/`;
    this._lastUrl = url;
    const html = await this._fetch(url);
    const $ = cheerio.load(html);
    const items = this._parseList($, '.listupd .bs', false);
    const pagination = this._extractPagination($);
    const result = { creator: 'rynaqrtz', page: 'home', url, pagination, items };
    return this._clean(result);
  }
}

const scraper = new AnichinScraper();

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1, 10);
    const data = await scraper.home(page);
    return res.json({
      status: true,
      creator: 'ArulzXD',
      result: data
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message
    });
  }
});

router.desc = "Mengambil daftar rilisan terbaru donghua di halaman utama Anichin.";
router.paramsConfig = {
  page: "contoh: 1"
};
router.status = "ready";
router.type = "free";

module.exports = router;
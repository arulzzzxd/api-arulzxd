const express = require("express");
const https = require("https");
const http = require("http");
const cheerio = require("cheerio");

const router = express.Router();

const BASE = "https://melolo.com";

function generateRandomIP() {
const ranges = [
[1,1],[2,2],[5,5],[23,23],[27,27],[31,31],
[36,36],[37,37],[39,39],[42,42],[46,46],
[49,49],[50,50],[60,60],[114,114],[117,117],
[118,118],[119,119],[120,120],[121,121],
[122,122],[123,123],[124,124],[125,125],
[126,126],[180,180],[182,182],[183,183]
];

const range =
ranges[
Math.floor(
Math.random() * ranges.length
)
];

return [
range[0],
Math.floor(Math.random() * 256),
Math.floor(Math.random() * 256),
Math.floor(Math.random() * 256)
].join(".");
}

function fetchUrl(url) {
return new Promise((resolve, reject) => {
const client =
url.startsWith("https")
? https
: http;

const spoofedIp =
  generateRandomIP();

const req = client.get(
  url,
  {
    headers: {
      "User-Agent":
        "Mozilla/5.0",
      "Accept":
        "text/html,application/xhtml+xml",
      "Accept-Language":
        "en-US,en;q=0.9",
      "Referer":
        BASE,
      "X-Forwarded-For":
        spoofedIp,
      "X-Real-IP":
        spoofedIp
    }
  },
  (res) => {
    if (
      res.statusCode >= 300 &&
      res.statusCode < 400 &&
      res.headers.location
    ) {
      let redirect =
        res.headers.location;

      if (
        !redirect.startsWith(
          "http"
        )
      ) {
        redirect =
          new URL(url).origin +
          redirect;
      }

      return fetchUrl(
        redirect
      )
        .then(resolve)
        .catch(reject);
    }

    let data = "";

    res.on(
      "data",
      chunk =>
        (data += chunk)
    );

    res.on(
      "end",
      () => resolve(data)
    );

    res.on(
      "error",
      reject
    );
  }
);

req.on("error", reject);

});
}

function parseSearch(html) {
const $ = cheerio.load(html);

const results = [];

$("a").each((_, el) => {
const href =
$(el).attr("href");

const title =
  $(el)
    .text()
    .trim();

if (
  href &&
  title &&
  href.includes(
    "/dramas/"
  )
) {
  results.push({
    title,
    url: href.startsWith(
      "http"
    )
      ? href
      : BASE + href
  });
}

});

return results;
}

router.get("/", async (req, res) => {
  try {
    const query = req.query.query;
    const type = req.query.type;
    const limit = Number(
      req.query.limit || 1
    );

    if (!query) {
      return res.status(400).json({
        status: false,
        message: "Parameter query wajib diisi"
      });
    }

    if (!type) {
      return res.status(400).json({
        status: false,
        message: "Parameter type wajib diisi",
        available: [
          "short_dramas",
          "novels",
          "articles"
        ]
      });
    }
    
    const html =
  await fetchUrl(
    `${BASE}/search?q=${encodeURIComponent(
      query
    )}`
  );

const results =
  parseSearch(html);

res.json({
  status: true,
  creator: "ArulzXD",
  query,
  type,
  limit: Number(limit),
  total_results:
    results.length,
  results: results.slice(
    0,
    Number(limit)
  )
});

  } catch (e) {
    res.status(500).json({
      status: false,
      error: e.message
    });
  }
});
router.status = "ready"; 
router.type = "free";
module.exports = router;
const express = require("express");

const router = express.Router();

const API = "https://raw.githubusercontent.com/arulzzzxd/database/main/quotes/anime-quotes.json";

async function getQuotes() {
  const res = await fetch(API, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json,text/plain,*/*"
    }
  });

  const text = await res.text();

  if (!res.ok) {
    return {
      ok: false,
      code: res.status,
      data: null,
      error: text
    };
  }

  try {
    return {
      ok: true,
      code: res.status,
      data: JSON.parse(text),
      error: null
    };
  } catch {
    return {
      ok: false,
      code: res.status,
      data: null,
      error: "Invalid JSON"
    };
  }
}

function normalizeQuotes(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.quotes)) return data.quotes;
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

router.get("/", async (req, res) => {
  try {
    const result = await getQuotes();

    if (!result.ok) {
      return res.status(result.code).json({
        status: false,
        code: result.code,
        creator: "ArulzXD",
        quote: null,
        character: null,
        anime: null
      });
    }

    const quotes = normalizeQuotes(result.data);
    const selected = pickRandom(quotes);

    if (!selected) {
      return res.status(404).json({
        status: false,
        code: 404,
        creator: "ArulzXD",
        quote: null,
        character: null,
        anime: null
      });
    }

    res.json({
      status: true,
      code: result.code,
      creator: "ArulzXD",
      quote: selected.quote || selected.text || selected.kata || null,
      character: selected.character || selected.char || selected.name || selected.tokoh || null,
      anime: selected.anime || selected.title || selected.source || null
    });

  } catch (err) {
    res.status(500).json({
      status: false,
      code: 500,
      creator: "ArulzXD",
      message: err.message
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
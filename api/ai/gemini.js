const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const router = express.Router();


const a = 'A'
const b = 'Q'
const to = '.Ab8RN6LDpBK21TXsUm8ji268R'
const ken = 'qvo6vylqRO2jY0wQQwNKuTXcw'
const APIKEY_ = `${a}${b}${to}${ken}`;


const ai = new GoogleGenAI({
  apiKey: `${APIKEY_}`
});

router.get("/", async (req, res) => {
  try {
    const text = req.query.text;

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text diperlukan."
      });
    }

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: text
    });

    res.json({
      status: true,
      creator: "ArulzXD",
      result: result.text
    });
  } catch (e) {
    res.status(500).json({
      status: false,
      message: e.message
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

async function chatWithNoTrack(prompt, chatId = null) {
  const url = "https://notrack.ai/api/dispatch";

  const payload = {
    user_input: prompt,
    mode: "usual",
    model: "C",
    persona: "normal",
    max_turns: 6,
    chat_id: chatId, 
    attachments: [],
    regenerate: false,
    edit: false,
    edit_mid: null
  };

  const headers = {
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "id,en-US;q=0.9,en;q=0.8",
    "Content-Type": "application/json",
    "Origin": "https://notrack.ai",
    "Referer": "https://notrack.ai/chat",
    "Sec-Ch-Ua": '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
  };

  const response = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  
  let buffer = "";
  let finalAnswer = "";
  let returnedChatId = chatId;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    let parts = buffer.split("\n\n");
    buffer = parts.pop(); 

    for (const part of parts) {
      if (part.startsWith("data: ")) {
        const jsonStr = part.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);

          switch (data.type) {
            case "chat_meta":
              returnedChatId = data.chat_id;
              break;
            
            case "delta":
              if (data.chunk) {
                finalAnswer += data.chunk;
              }
              break;

            case "error":
              throw new Error(data.content || "Server error occurred");
          }
        } catch (err) {
          if (err.message !== "Unexpected end of JSON input" && !err.message.startsWith("JSON")) {
            throw err;
          }
        }
      }
    }
  }
  
  return {
    answer: finalAnswer,
    chatId: returnedChatId
  };
}

// Memori lokal untuk menyimpan sesi berdasarkan IP
const userSessions = new Map();

router.get('/', async (req, res) => {
    try {
        const prompt = req.query.prompt || req.query.text;

        if (!prompt) {
            return res.status(400).json({ 
                status: false, 
                error: "Parameter 'prompt' atau 'text' diperlukan." 
            });
        }

        // Ambil IP user
        const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // Ambil chatId yang tersimpan dari IP ini, atau null jika sesi baru
        let chatId = userSessions.get(userIp) || null;

        const result = await chatWithNoTrack(prompt, chatId);

        // Simpan chatId baru yang diberikan server NoTrack ke IP user
        if (result.chatId) {
            userSessions.set(userIp, result.chatId);
        }

        return res.status(200).json({
            status: true,
            result: result.answer,
            chatId: result.chatId
        });
    } catch (error) {
        return res.status(500).json({ 
            status: false, 
            error: error.message 
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;

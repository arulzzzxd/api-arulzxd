const express = require("express");
const axios = require("axios");

const router = express.Router();

async function duckAI(prompt) {
  try {
    const res = await axios.post(
      "https://duck.ai/duckchat/v1/chat",
      {
        model: "gpt-5-mini",
        metadata: {
          toolChoice: {
            NewsSearch: false,
            VideosSearch: false,
            LocalSearch: false,
            WeatherForecast: false
          }
        },
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        canUseTools: true,
        reasoningEffort: "minimal",
        canUseApproxLocation: null,
        canDelegateImageGeneration: null,
        durableStream: {
          messageId: "15a859a1-718f-4c83-b7a2-b3880aabacad",
          conversationId: "b20b38cc-97e3-49dc-a3ba-a2cf21fbb9e7",
          publicKey: {
            alg: "RSA-OAEP-256",
            e: "AQAB",
            ext: true,
            key_ops: ["encrypt"],
            kty: "RSA",
            n: "pjxk580D6CN5b3u5TR_XEQqrv7V4459F4lyt6mV_w5pdJjr8e0ILRmeR6k-yiC-RjaKUXLO5rPvGXzd5CixEs6tgqAmMJntA8tlA5H_E9-YuvHyPSTs4BUBIEqMAK1srpz1PAy8Xi9O4bN4i2FreokKKOJMMpvFt_rGzBnbpjlyE6fdHTmJCUFrjSyxlD-D4tklTMDs-0HjUNynfr6k6-PJvPguLIYq7L_NjCA7kcFUHXzQnWQjmpXGTm0NqPXeYUnL3y2jsirBePfYW_SNaB6TePEGoMSQL8rsqP67Snz0sBo7WKGdbYjH2jXv7bBU4rZZXcRK1Rk-w076IiH3Q_w",
            use: "enc"
          }
        }
      },
      {
        headers: {
          authority: "duck.ai",
          accept: "text/event-stream",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "id-ID",
          "content-type": "application/json",
          origin: "https://duck.ai",
          priority: "u=1, i",
          referer: "https://duck.ai/",
          "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
          "x-ddg-journey-id": "4bb58898491103fa40492b9fa58126ad",
          "x-fe-signals": "eyJzdGFydCI6MTc4MTU4ODg1OTA2NSwiZXZlbnRzIjpbeyJuYW1lIjoic3RhcnROZXdDaGF0X2ZyZWUiLCJkZWx0YSI6Mzk3fSx7Im5hbWUiOiJhY3Rpb24iLCJkZWx0YSI6MjE0NywidHJ1c3RlZCI6dHJ1ZX1dLCJlbmQiOjE4NTk2fQ==",
          "x-fe-version": "serp_20260615_183429_ET-ec17a44c4ba5177d076644699c451976233a9143",
          "x-vqd-hash-1": "eyJzZXJ2ZXJfaGFzaGVzIjpbIjF5cDZvWEg1U1puWmtlZThValorWVpXVGt3WS9pWUd1TXlmV0pRM2d2Z0k9IiwiWnUvVGFJR3lLY2s4T0xDQVZZakI5eGl1ajlQcGd2V2V1WEUzUE1ubVJwbz0iLCJKL09xODg2N0tDUFZKcjE5TGJoemhaai9mLzhUeFRYdzhWeWhZazNRc2pFPSJdLCJjbGllbnRfaGFzaGVzIjpbIkFiTkpDQmJ2Njk4d3Z2SnNkTkNZNDBXOFlIeUhmWm9EVEVHS3Rhd2xRRE09IiwiQUdBemh1TXhSbkNEY2phYkJTbnR3a2syRE1Zb3BoYS9WWVhET1RjV2JnTT0iLCIvWm5xamVYQnQzczkvWkRrU05ubnJ5YmZWbHZCZnVFTkRhMlNaL0U5YmU4PSJdLCJzaWduYWxzIjp7fSwibWV0YSI6eyJ2IjoiNCIsImNoYWxsZW5nZV9pZCI6IjMwMGFhYzA3Y2RmM2JjNzY1YzNhZmZkNzAyZTVmNjUyMGJiMzQ1YjdiMjUxMTAyYjYxYjdkMWE0NjFlNjNmNTB2ejk1biIsInRpbWVzdGFtcCI6IjE3ODE1ODg4NjA0MjYiLCJkZWJ1ZyI6IkJKIiwib3JpZ2luIjoiaHR0cHM6Ly9kdWNrLmFpIiwic3RhY2siOiJFcnJvclxuYXQgbCAoaHR0cHM6Ly9kdWNrLmFpL2Rpc3QvZHVja2FpLWRpc3QvZW50cnkuZHVja2FpLjdiMzNkZDA4MzYzMjExNTA1NGE0LmpzOjI6MTQxNzIwNClcbmF0IGFzeW5jIGh0dHBzOi8vZHVjay5haS9kaXN0L2R1Y2thaS1kaXN0L2VudHJ5LmR1Y2thaS43YjMzZGQwODM2MzIxMTUwNTRhNC5qczoyOjEyNjU1MzMiLCJkdXJhdGlvbiI6IjE0MSJ9fQ=="
        },
        responseType: "stream"
      }
    );

    return new Promise((resolve, reject) => {
      let fullText = "";

      res.data.on("data", chunk => {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.message) {
                fullText += parsed.message;
              }
            } catch (err) {
              // Mengabaikan baris chunk yang tidak valid JSON saat parsing stream
            }
          }
        }
      });

      res.data.on("end", () => {
        resolve(fullText.trim());
      });

      res.data.on("error", err => {
        reject(err);
      });
    });

  } catch (e) {
    throw e;
  }
}

router.get("/", async (req, res) => {
  try {
    const prompt = req.query.prompt?.trim();

    if (!prompt) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Parameter prompt wajib diisi",
        example: "/api/ai/duckai?prompt=jelaskan teori relativitas"
      });
    }

    const result = await duckAI(prompt);

    res.json({
      status: true,
      creator: "ArulzXD",
      result: result
    });

  } catch (err) {
    res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message
    });
  }
});

router.status = "error";
router.type = "free";
module.exports = router;

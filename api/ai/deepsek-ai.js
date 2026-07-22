const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

const BASE = "https://notegpt.io";

const UA =
"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";

function uuid() {
return crypto.randomUUID();
}

function randomNumber(length = 10) {
let result = "";

for (let i = 0; i < length; i++) {
    result += Math.floor(
        Math.random() * 10
    );
}

return result;

}

function makeSboxGuid() {
const now =
Math.floor(
Date.now() / 1000
);

const raw =
    `${now}|762|${randomNumber(9)}`;

return Buffer
    .from(raw)
    .toString("base64");

}

function makeCookieHeader() {
const now =
Math.floor(
Date.now() / 1000
);

const anonymousUserId =
    uuid();

return [
    `_ga_PFX3BRW5RQ=GS2.1.s${now}$o1$g0$t${now}$j60$l0$h${randomNumber(9)}`,
    `_ga=GA1.2.${randomNumber(9)}.${now}`,
    `_gid=GA1.2.${randomNumber(9)}.${now}`,
    `_gat_gtag_UA_252982427_14=1`,
    `sbox-guid=${encodeURIComponent(makeSboxGuid())}`,
    `anonymous_user_id=${anonymousUserId}`
].join("; ");

}

function parseSSE(rawBody) {
let answer = "";
let reasoning = "";

for (const line of rawBody.split(/\r?\n/)) {
    const clean =
        line.trim();

    if (
        !clean.startsWith(
            "data:"
        )
    ) continue;

    const raw =
        clean
            .replace(
                /^data:\s*/,
                ""
            )
            .trim();

    if (
        !raw ||
        raw === "[DONE]"
    ) continue;

    try {
        const json =
            JSON.parse(raw);

        if (json.reasoning)
            reasoning +=
                json.reasoning;

        if (json.text)
            answer +=
                json.text;

    } catch {}
}

return {
    answer,
    reasoning
};

}

async function deepseek(prompt) {

const conversationId =
    uuid();

const payload = {
    message: prompt,
    language: "auto",
    model: "deepseek-v4-flash",
    tone: "default",
    length: "moderate",
    conversation_id:
        conversationId,
    image_urls: [],
    history_messages: [],
    chat_mode:
        "deep_think"
};

const res =
    await axios.post(
        `${BASE}/api/v2/chat/stream`,
        payload,
        {
            responseType:
                "stream",
            timeout: 60000,
            headers: {
                "User-Agent":
                    UA,
                "Content-Type":
                    "application/json",
                Origin:
                    BASE,
                Referer:
                    `${BASE}/chat-deepseek`,
                Cookie:
                    makeCookieHeader()
            }
        }
    );

let rawBody = "";

res.data.setEncoding(
    "utf8"
);

return await new Promise(
    (resolve, reject) => {

        res.data.on(
            "data",
            chunk => {
                rawBody +=
                    chunk;
            }
        );

        res.data.on(
            "end",
            () => {
                const parsed =
                    parseSSE(
                        rawBody
                    );

                resolve({
                    success:
                        true,
                    conversation_id:
                        conversationId,
                    model:
                        "deepseek-v4-flash",
                    answer:
                        parsed.answer,
                    reasoning:
                        parsed.reasoning
                });
            }
        );

        res.data.on(
            "error",
            reject
        );

    }
);

}

router.get("/", async (req, res) => {
try {

    const prompt =
        req.query.prompt?.trim();

    if (!prompt) {
        return res.status(400).json({
            status: false,
            creator:
                "ArulzXD",
            message:
                "Parameter prompt wajib diisi",
            example:
                "/api/ai/deepseek?prompt=jelaskan teori relativitas"
        });
    }

    const result =
        await deepseek(
            prompt
        );

    res.json({
        status: true,
        creator:
            "ArulzXD",
        result
    });

} catch (err) {

    res.status(500).json({
        status: false,
        creator:
            "ArulzXD",
        message:
            err.message
    });

}

});

router.status = "ready";
router.type = "free";

module.exports = router;
const axios = require('axios');
const express = require('express');
const router = express.Router();

// ======================================================
// HELPER UTILITAS
// ======================================================
const gStr = n => Array.from({length: n}, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 62))).join('');
const gHex = n => Array.from({length: n}, () => Math.floor(Math.random() * 16).toString(16)).join('');

// ======================================================
// CORE AI FUNCTION
// ======================================================
async function feloAi(text) {
    const searchUuid = gStr(21);
    const deviceId = gHex(32);
    
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://felo.ai',
        'Referer': 'https://felo.ai/'
    };

    // Step 1: Request stream key
    const { data: threadRes } = await axios.post('https://felo.ai/api/search/threads', {
        query: text,
        search_uuid: searchUuid,
        lang: "",
        agent_lang: "id",
        search_options: { langcode: "id-ID" },
        search_video: true,
        query_from: "default",
        category: "social",
        model: "",
        auto_routing: true,
        mode: "concise",
        device_id: deviceId,
        source_message_rid: "",
        documents: [],
        thread_type: 1,
        document_action: "",
        slides_source: { type: "ask_question", files: {} },
        slide_template_uid: "",
        selected_resource_ids: [],
        process_id: searchUuid,
        stream_protocol: "message_center_v1",
        enable_task_state: true
    }, { headers });

    const streamKey = threadRes.stream_key;
    if (!streamKey) throw new Error("Gagal mendapatkan stream_key");

    // Step 2: Fetch and parse stream
    const { data: streamText } = await axios.get(`https://felo.ai/api/message/v1/stream/${streamKey}?offset=0`, {
        headers: { ...headers, 'Accept': 'text/event-stream' }
    });

    let finalAnswer = "";
    const lines = streamText.split('\n');
    
    for (const line of lines) {
        if (line.startsWith('data:')) {
            try {
                const rawData = JSON.parse(line.substring(5).trim());
                if (rawData.content) {
                    const contentData = JSON.parse(rawData.content);
                    if (contentData.data && contentData.data.type === 'answer') {
                        finalAnswer += contentData.data.data.text;
                    }
                }
            } catch (e) {
                // Abaikan error parsing per baris
            }
        }
    }

    return finalAnswer.trim() || "Gagal parsing jawaban dari stream";
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    const text = req.query.text;

    if (!text) {
        return res.status(400).json({
            status: false,
            error: "Missing 'text' parameter"
        });
    }

    try {
        const result = await feloAi(text);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            kesayangan: 'mamah',
            query: text,
            result
        });

    } catch (error) {
        const detail = error.response?.data || error.message;
        return res.status(500).json({
            status: false,
            error: typeof detail === 'object' ? JSON.stringify(detail) : detail
        });
    }
});

module.exports = router;
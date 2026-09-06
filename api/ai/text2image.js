const express = require('express');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const os = require('os');

const router = express.Router();

// --- KONFIGURASI INTERNAL GEMINI (DARI KODE ASLI) ---

const agent = new https.Agent({ keepAlive: true });

const randomUUID = () => '8b970a7e2606d4b6'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});

function syncCookies(jar, setCookies = []) {
    const list = Array.isArray(setCookies) ? setCookies : [setCookies];
    for (const item of list) {
        const pair = item.split(';')[0].split('=');
        if (pair.length >= 2) jar[pair[0].trim()] = pair.slice(1).join('=').trim();
    }
}

const buildCookieString = jar => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/https?:\/\/[a-z0-9.-]*googleusercontent\.com\/[^\s\n"<>]+/gi, '')
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
        .trim();
}

function request(url, { method = 'GET', headers = {}, body = null, stream = false } = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method,
            headers: body ? { ...headers, 'content-length': Buffer.byteLength(body) } : headers,
            agent,
            maxHeaderSize: 1048576
        }, res => {
            if (stream) return resolve({ res, headers: res.headers });
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({ text: Buffer.concat(chunks).toString(), headers: res.headers }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function download(url, cookieStr = null, hops = 0) {
    return new Promise((resolve, reject) => {
        if (hops > 5) return reject(new Error('Too many redirects'));
        const safeUrl = url.startsWith('http:') ? url.replace('http:', 'https:') : url;
        const u = new URL(safeUrl);
        const headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        if (cookieStr) headers['cookie'] = cookieStr;
        https.get({ hostname: u.hostname, path: u.pathname + u.search, headers, maxHeaderSize: 1048576, agent }, res => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                res.resume();
                return download(res.headers.location, cookieStr, hops + 1).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Download failed: ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

function parseFrames(buffer) {
    const frames = [];
    let remaining = buffer;
    if (remaining.startsWith(")]}'")) remaining = remaining.substring(4).trimStart();
    while (true) {
        const nl = remaining.indexOf('\n');
        if (nl === -1) break;
        const size = parseInt(remaining.substring(0, nl).trim(), 10);
        if (isNaN(size)) { remaining = remaining.substring(nl + 1); continue; }
        if (remaining.length < nl + size) break;
        const framePayload = remaining.substring(nl, nl + size);
        remaining = remaining.substring(nl + size);
        try {
            const frameData = JSON.parse(framePayload);
            for (const item of (Array.isArray(frameData) ? frameData : [frameData])) {
                if (!item?.[2]) continue;
                try { frames.push(JSON.parse(item[2])); } catch (_) {}
            }
        } catch (_) {}
    }
    return { frames, remaining };
}

// Global variable untuk menyimpan auth session agar tidak login terus menerus
let globalAuth = null;

async function getSession() {
    if (globalAuth) return globalAuth;

    const cookies = {};
    const cookiePath = path.join(process.cwd(), 'cookies.json');
    
    if (!fs.existsSync(cookiePath)) {
        throw new Error('cookies.json not found. Please export cookies from Gemini.');
    }

    try {
        const cookieData = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
        // J2teams export format biasanya memiliki property 'cookies' yang berisi array
        const cookieArray = Array.isArray(cookieData) ? cookieData : cookieData.cookies;
        if (cookieArray) cookieArray.forEach(c => cookies[c.name] = c.value);
    } catch (err) {
        throw new Error('Failed to parse cookies.json: ' + err.message);
    }

    const pageRes = await request('https://gemini.google.com/app', {
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ...(Object.keys(cookies).length > 0 ? { cookie: buildCookieString(cookies) } : {})
        }
    });
    syncCookies(cookies, pageRes.headers['set-cookie']);

    const buildLabel = pageRes.text.match(/"cfb2h":\s*"(.*?)"/)?.[1] ?? 'boq_assistant-bard-web-server_20260709.09_p0';
    const atToken = pageRes.text.match(/"SNlM0e":"([^"]+)"/)?.[1] ?? null;
    const fSid = pageRes.text.match(/"FdrFJe":"(-?\d+)"/)?.[1] ?? null;

    if (!atToken) throw new Error('Failed to get AT Token. Cookies might be invalid or expired.');

    const batchRes = await request('https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&hl=en-US&_reqid=1&rt=c', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', cookie: buildCookieString(cookies) },
        body: 'f.req=[[["maGuAc","[0]",null,"generic"]]]&'
    });
    syncCookies(cookies, batchRes.headers['set-cookie']);

    globalAuth = {
        cookies,
        buildLabel,
        sessionId: Array.from({ length: 19 }, () => Math.floor(Math.random() * 10)).join(''),
        atToken,
        fSid,
        reqId: Math.floor(Math.random() * 90000) + 10000
    };
    return globalAuth;
}

function buildStreamRequest(prompt, auth) {
    const traceId = randomUUID().toUpperCase();
    const qp = new URLSearchParams({ hl: 'en-US', _reqid: String(auth.reqId), rt: 'c', pageId: 'none' });
    if (auth.buildLabel) qp.set('bl', auth.buildLabel);
    qp.set('f.sid', auth.fSid || auth.sessionId);

    // Metadata kosong untuk chat baru
    const metadata = ['', '', '', null, null, null, null, null, null, ''];

    const p = new Array(97).fill(null);
    p[0] = [prompt, 0, null, null, null, null, 0]; // No image input for text-to-image
    p[1] = ['en-US'];
    p[2] = metadata;
    p[6] = [1]; p[7] = 1; p[10] = 1; p[11] = 0;
    p[17] = [[0]]; p[18] = 0; p[27] = 1; p[30] = [4];
    p[41] = [1]; p[49] = 14; p[53] = 0; p[59] = traceId;
    p[61] = []; p[68] = 2; p[79] = 6; p[80] = 1; p[91] = 0; p[96] = 0;

    const body = new URLSearchParams({ 'f.req': JSON.stringify([null, JSON.stringify(p)]) });
    if (auth.atToken) body.set('at', auth.atToken);

    return {
        url: `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${qp}`,
        headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'x-goog-ext-525001261-jspb': `[1,null,null,null,null,null,null,0,[4,5,6,8,4,5,6,8],null,null,2,null,null,6,1,"${traceId}"]`,
            'x-goog-ext-525005358-jspb': `["${traceId}",1]`,
            'x-goog-ext-73010989-jspb': '[0]',
            'x-goog-ext-73010990-jspb': '[0,0,0]',
            'x-same-domain': '1',
            'origin': 'https://gemini.google.com',
            'referer': 'https://gemini.google.com/',
            cookie: buildCookieString(auth.cookies)
        },
        body: body.toString()
    };
}

function extractImageUrl(frames, fullRawText) {
    for (const pj of frames) {
        try {
            for (const g of (pj?.[26] || [])) for (const g2 of (g || [])) for (const g3 of (g2 || [])) {
                for (const img of (g3?.[9] || [])) {
                    const url = img?.[0]?.[0]?.[3]?.[3];
                    if (url?.includes('googleusercontent.com/gg-dl/')) return url;
                }
            }
        } catch (_) {}
        try {
            for (const cand of (pj?.[4] || [])) for (const img of (cand?.[12]?.[0] || [])) {
                const url = img?.[0]?.[0]?.[3]?.[3];
                if (url?.includes('googleusercontent.com/gg-dl/')) return url;
            }
        } catch (_) {}
    }
    return fullRawText.match(/https?:\/\/[a-z0-9.-]*googleusercontent\.com\/(?:rd-)?gg-dl\/[^\s\n"<>'\\]+/i)?.[0] ?? null;
}

// --- EXPRESS ROUTE HANDLER ---

router.get('/', async (req, res) => {
    // Mengambil prompt dari query parameter 'text' atau 'prompt'
    const prompt = req.query.text?.trim() || req.query.prompt?.trim();

    if (!prompt) {
        return res.status(400).json({
            status: false,
            creator: "arulzxd",
            message: "Parameter 'text' atau 'prompt' diperlukan."
        });
    }

    let tempImagePath = null;

    try {
        // 1. Dapatkan atau perbarui session
        const auth = await getSession();
        // Increment reqId untuk request baru
        auth.reqId += 100000;

        // 2. Bangun request stream
        const streamReq = buildStreamRequest(prompt, auth);

        // 3. Lakukan request ke Gemini
        const { res: geminiRes, headers: geminiHeaders } = await request(streamReq.url, { 
            method: 'POST', 
            headers: streamReq.headers, 
            body: streamReq.body, 
            stream: true 
        });
        
        // Update cookies jika ada yang baru
        syncCookies(auth.cookies, geminiHeaders['set-cookie']);

        // 4. Proses stream respon
        await new Promise((resolve, reject) => {
            let fullRawText = '', buf = '';
            const allFrames = [];
            let responseFinished = false;

            geminiRes.on('data', chunk => {
                if (responseFinished) return;
                try {
                    const s = chunk.toString('utf8');
                    fullRawText += s; buf += s;
                    const { frames, remaining } = parseFrames(buf);
                    buf = remaining; allFrames.push(...frames);
                } catch (err) { 
                    responseFinished = true;
                    reject(new Error("Error parsing stream: " + err.message)); 
                }
            });

            geminiRes.on('end', async () => {
                if (responseFinished) return;
                responseFinished = true;
                try {
                    // 5. Ekstrak URL Gambar
                    const imageUrl = extractImageUrl(allFrames, fullRawText);

                    if (!imageUrl) {
                        // Jika tidak ada gambar, mungkin Gemini menolak atau prompt tidak menghasilkan gambar
                        // Mencoba mengambil teks balasan sebagai alasan
                        let replyText = '';
                        for (const pj of allFrames) {
                            for (const cand of (pj?.[4] || [])) {
                                const raw = cand?.[1]?.[0] || '';
                                if (raw) replyText += raw;
                            }
                        }
                        throw new Error(cleanText(replyText) || "Gemini did not generate an image for this prompt.");
                    }

                    // 6. Download Gambar asli dari Google
                    const imgBuf = await download(imageUrl, buildCookieString(auth.cookies));
                    
                    // 7. Simpan sementara di sistem temp
                    const ext = imageUrl.split('=').pop() || 'png'; // Biasanya png
                    tempImagePath = path.join(os.tmpdir(), `gemini-gen-${Date.now()}.${ext}`);
                    fs.writeFileSync(tempImagePath, imgBuf);
                    resolve();
                } catch (err) { reject(err); }
            });

            geminiRes.on('error', err => {
                responseFinished = true;
                reject(new Error("Gemini stream error: " + err.message));
            });
            
            // Timeout jika stream terlalu lama (misal 60 detik)
            setTimeout(() => {
                if (!responseFinished) {
                    responseFinished = true;
                    geminiRes.destroy();
                    reject(new Error("Request timeout."));
                }
            }, 60000);
        });

        // 8. Kirim file gambar ke client
        res.setHeader('Content-Type', 'image/png'); // Gemini generation biasanya PNG
        res.sendFile(tempImagePath, (err) => {
            // 9. Hapus file temp setelah dikirim atau jika terjadi error saat pengiriman
            if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
            if (err && !res.headersSent) {
                console.error("Gagal mengirim file:", err);
            }
        });

    } catch (err) {
        console.error("API Error:", err.message);
        
        // Bersihkan temp jika ada error sebelum sendFile
        if (tempImagePath && fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);

        // Reset session jika error kemungkinan karena cookie mati ( Unauthorized / Failed to get AT Token)
        if (err.message.includes('AT Token') || err.message.includes('cookies')) {
            globalAuth = null; 
        }

        return res.status(500).json({
            status: false,
            creator: "arulzxd",
            message: err.message
        });
    }
});

// Konfigurasi meta untuk dokumentasi API (sesuai format Anda sebelumnya)
router.paramsConfig = {
    text: "Teks prompt untuk menghasilkan gambar",
};
router.status = "ready";
router.type = "free"; // Biasanya generate image itu berat, jadi diberi tipe limit

module.exports = router;
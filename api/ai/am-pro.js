/*
  Create: t.me/AwasPhpJir
  RestApis: api.ikyyxd.my.id
  Note: Auto Generate Account & Rotation Account 
  
  Join: https://whatsapp.com/channel/0029Vb8hiKd0gcfQDpEDdf2n
*/

/**
 * NAMA SCRAPE  :: AMPREM OOB SENDER & VERIFIER
 * [•] BASIS        :: am.maulanabot.my.id
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const CONFIG = {
    baseUrl: 'https://am.maulanabot.my.id',
    secretKey: 'kontol_jangan_so_tau_ngentod_2636273', 
    userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
    dbFile: 'accounts.json'
};

let GLOBAL_COOKIES = {};

const api = axios.create({
    baseURL: CONFIG.baseUrl,
    headers: {
        'User-Agent': CONFIG.userAgent,
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
    },
    maxRedirects: 0,
    validateStatus: function (status) {
        return status >= 200 && status < 400;
    }
});

api.interceptors.response.use(function (response) {
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
        setCookieHeader.forEach(cookieStr => {
            const parts = cookieStr.split(';')[0].split('=');
            if (parts.length === 2) {
                const name = parts[0].trim();
                const value = parts[1].trim();
                GLOBAL_COOKIES[name] = value;
            }
        });
    }
    
    if (response.status >= 300 && response.status < 400 && response.headers.location) {
        const redirectUrl = response.headers.location.startsWith('http') 
            ? response.headers.location 
            : CONFIG.baseUrl + response.headers.location;
        return api.get(redirectUrl, { headers: getCookieHeaders() });
    }
    
    return response;
});

function getCookieString() {
    return Object.entries(GLOBAL_COOKIES)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
}

function getCookieHeaders() {
    const cookies = getCookieString();
    return cookies ? { 'Cookie': cookies } : {};
}

function getRandomString(length) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function generateSignature(payloadStr, timestamp) {
    const dataToHash = `${timestamp}:${payloadStr}:${CONFIG.secretKey}`;
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

function generateFingerprint() {
    try {
        const screen = { width: 360, height: 800, availWidth: 360, availHeight: 740, colorDepth: 24 };
        const nav = { 
            userAgent: CONFIG.userAgent, language: 'id-ID', hardwareConcurrency: 8, 
            deviceMemory: 4, maxTouchPoints: 5 
        };
        const canvasSim = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; 
        
        const parts = [
            nav.userAgent, nav.language, screen.colorDepth,
            `${screen.width}x${screen.height}`, `${screen.availWidth}x${screen.availHeight}`,
            new Date().getTimezoneOffset(), nav.hardwareConcurrency,
            nav.deviceMemory, nav.maxTouchPoints, canvasSim
        ];

        const rawString = parts.join("~~~");
        let hash = 0;
        for (let i = 0; i < rawString.length; i++) {
            const char = rawString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char | 0;
        }
        return `fp_${Math.abs(hash).toString(16)}`;
    } catch (e) {
        return 'fp_fallback_default';
    }
}

async function getProtectedHeaders(payloadObj) {
    const timestamp = Date.now().toString();
    const payloadStr = JSON.stringify(payloadObj);
    
    return {
        'Content-Type': 'application/json',
        'User-Agent': CONFIG.userAgent,
        'Origin': CONFIG.baseUrl,
        'Referer': `${CONFIG.baseUrl}/dashboard`,
        'X-App-Timestamp': timestamp,
        'X-App-Signature': generateSignature(payloadStr, timestamp),
        'X-Device-Fingerprint': generateFingerprint(),
        ...getCookieHeaders()
    };
}

function loadAccounts() {
    try {
        if (fs.existsSync(CONFIG.dbFile)) return JSON.parse(fs.readFileSync(CONFIG.dbFile, 'utf8'));
    } catch (e) {}
    return [];
}

function saveAccount(username, password) {
    const accounts = loadAccounts();
    const index = accounts.findIndex(a => a.username === username);
    const newData = { username, password, createdAt: new Date().toISOString() };
    
    if (index !== -1) accounts[index] = newData;
    else accounts.push(newData);
    
    fs.writeFileSync(CONFIG.dbFile, JSON.stringify(accounts, null, 2));
}

function findValidAccount() {
    const accounts = loadAccounts();
    return accounts.length > 0 ? accounts[accounts.length - 1] : null;
}

async function createNewOperatorSession() {
    const randNum = getRandomString(6);
    const username = `op${randNum}@gmail.com`; 
    const password = `OpPass_${getRandomString(4)}!`; 

    GLOBAL_COOKIES = {};

    await api.get('/');
    await new Promise(r => setTimeout(r, 1500));
    
    await api.post('/api/auth/register', { username, email: username, password });
    await new Promise(r => setTimeout(r, 1500));

    const loginRes = await api.post('/api/auth/login', { email: username, password });
    await new Promise(r => setTimeout(r, 1000));
    
    if (!GLOBAL_COOKIES['auth_token'] && loginRes.data?.status !== true) {
        throw new Error('Gagal mendapatkan sesi valid untuk operator baru.');
    }
    
    saveAccount(username, password);
    return { username, password };
}

async function ensureOperatorLoggedIn() {
    let account = findValidAccount();
    
    if (account) {
        try {
            GLOBAL_COOKIES = {};
            await api.get('/');
            await new Promise(r => setTimeout(r, 1000));
            
            await api.post('/api/auth/login', { email: account.username, password: account.password });
            await new Promise(r => setTimeout(r, 500));
            
            if (GLOBAL_COOKIES['auth_token']) {
                return account;
            }
            throw new Error('Sesi expired atau invalid.');
        } catch (err) {}
    }

    return await createNewOperatorSession();
}

async function sendOobLinkWithRetry(targetEmail, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const payload = { email: targetEmail, website_url: '' };
            
            const res = await api.post('/api/send', payload, {
                headers: await getProtectedHeaders(payload),
                timeout: 30000
            });
            
            if (!res.data?.success && !res.data?.status) {
                const msg = res.data?.message || res.data?.msg || '';
                if (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('batas') || res.status === 429) {
                    await createNewOperatorSession();
                    continue;
                }
                throw new Error(msg || 'Gagal mengirim link ke target.');
            }
            
            return res.data;
            
        } catch (err) {
            if (err.response?.status === 401 || err.message.includes('limit')) {
                await createNewOperatorSession();
                continue;
            }
            throw err;
        }
    }
    throw new Error('Gagal mengirim link setelah beberapa kali rotasi akun.');
}

async function verifyOobLink(targetEmail, link) {
    const payload = { email: targetEmail, link, website_url: '' };
    
    const res = await api.post('/api/verify', payload, {
        headers: await getProtectedHeaders(payload),
        timeout: 30000
    });
    
    return res.data;
}

// Endpoint GET /send?email=target@mail.com
router.get('/send', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ status: false, error: 'Parameter "email" diperlukan.' });
        }

        await ensureOperatorLoggedIn();
        const result = await sendOobLinkWithRetry(email);

        return res.json({
            status: true,
            message: 'Link OOB berhasil dikirim ke target.',
            data: result
        });
    } catch (err) {
        return res.status(500).json({ status: false, error: err.message });
    }
});

// Endpoint GET /verify?email=target@mail.com&link=OOB_LINK
router.get('/verify', async (req, res) => {
    try {
        const { email, link } = req.query;
        if (!email || !link) {
            return res.status(400).json({ status: false, error: 'Parameter "email" dan "link" diperlukan.' });
        }

        await ensureOperatorLoggedIn();
        const result = await verifyOobLink(email, link);

        return res.json({
            status: true,
            data: result
        });
    } catch (err) {
        return res.status(500).json({ status: false, error: err.message });
    }
});

router.desc = "Mengirim dan memverifikasi link OOB Alight Motion Pro. Parameter send: ?email=target@mail.com | Parameter verify: ?email=target@mail.com&link=OOB_LINK";
router.status = "ready";
router.type = "free";
module.exports = router;
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const router = express.Router();

// ==========================================
// CORE FUNCTIONS
// ==========================================

const baseHeaders = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
  'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
};

const UMID   = 'T2gA0mRGd-Nvxy5nhKezRG4el_l-L6JAzrBjEmPO3PH6tCB11ptPmUbqqPkK3CpEWH0=';
const CNA    = 'ylxMIe27ME0CAX2kC7MMZtMd';
const BL_UID = 'ChmR5q03mmLm5vht59Xh6C8wz0Xg';
const SCA    = 'daf1f517';

function parseCookies(arr) {
  return Object.fromEntries(
    (arr || []).map(c => {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      return i < 0 ? [] : [pair.slice(0, i).trim(), pair.slice(i + 1).trim()];
    }).filter(e => e.length)
  );
}

function cookieStr(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function getSession() {
  const res = await axios.get('https://chat.qwen.ai', {
    headers: {
      ...baseHeaders,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Site': 'same-site',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Referer': 'https://qwen.ai/',
      'Cookie': `cna=${CNA}`,
    },
    maxRedirects: 5,
  });

  const fresh = parseCookies(res.headers['set-cookie']);
  return {
    cna:       CNA,
    acw_tc:    fresh['acw_tc']  || '',
    'x-ap':    fresh['x-ap']    || 'ap-southeast-5',
    sca:       SCA,
    _bl_uid:   BL_UID,
    'qwen-theme': 'dark',
  };
}

async function createChat(jar, model) {
  const reqId = crypto.randomUUID();

  const res = await axios.post(
    'https://chat.qwen.ai/api/v2/chats/new',
    {
      title: 'New Chat',
      models: [model],
      chat_mode: 'guest',
      chat_type: 't2t',
      timestamp: Date.now(),
      project_id: '',
    },
    {
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Version': '0.2.66',
        'source': 'h5',
        'bx-v': '2.5.36',
        'bx-umidtoken': UMID,
        'Timezone': new Date().toString(),
        'X-Request-Id': reqId,
        'Origin': 'https://chat.qwen.ai',
        'Referer': 'https://chat.qwen.ai/c/new-chat',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Cookie': cookieStr(jar),
      },
    }
  );
  const extra = parseCookies(res.headers['set-cookie']);
  Object.assign(jar, extra);

  return res.data.data.id;
}

async function qwenai(prompt, model = 'qwen3.7-plus') {
  const jar    = await getSession();
  const chatId = await createChat(jar, model);

  const msgId = crypto.randomUUID();
  const reqId = crypto.randomUUID();

  const stream = await axios.post(`https://chat.qwen.ai/api/v2/chat/completions?chat_id=${chatId}`,
    {
      stream: true,
      version: '2.1',
      incremental_output: true,
      chat_id: chatId,
      chat_mode: 'guest',
      model,
      parent_id: null,
      messages: [
        {
          fid: msgId,
          parentId: null,
          childrenIds: [],
          role: 'user',
          content: prompt,
          user_action: 'chat',
          files: [],
          timestamp: Math.floor(Date.now() / 1000),
          models: [model],
          chat_type: 't2t',
          feature_config: {
            thinking_enabled: false,
            output_schema: 'phase',
          },
          extra: { meta: { subChatType: 't2t' } },
          sub_chat_type: 't2t',
        }
      ],
      timestamp: Date.now(),
    },
    {
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '0.2.66',
        'source': 'h5',
        'bx-v': '2.5.36',
        'bx-umidtoken': UMID,
        'Timezone': new Date().toString(),
        'X-Request-Id': reqId,
        'X-Accel-Buffering': 'no',
        'Origin': 'https://chat.qwen.ai',
        'Referer': 'https://chat.qwen.ai/c/guest',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Cookie': cookieStr(jar),
      },
      responseType: 'stream',
    }
  );

  return new Promise((resolve, reject) => {
    let text = '';
    let buf  = '';

    stream.data.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const j     = JSON.parse(line.slice(6));
            const delta = j.choices?.[0]?.delta;
            if (delta?.phase === 'answer' && delta?.content) {
              text += delta.content;
            }
          } catch {}
        }
      }
    });

    stream.data.on('end', () => resolve(text.trim()));
    stream.data.on('error', reject);
  });
}

// ==========================================
// EXPRESS ROUTER ENDPOINT
// ==========================================

router.get('/', async (req, res) => {
  try {
    const text = req.query.text;

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Masukkan parameter 'text'. Contoh: ?text=hai, kamu pakai model apa?"
      });
    }

    const response = await qwenai(text);

    return res.json({
      status: true,
      creator: "ArulzXD",
      result: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      error: error.message
    });
  }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;

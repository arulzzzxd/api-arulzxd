/**
 * ✦ Nama Scrape : AirMore AI Text-To-Speech (TTS)
 * ✦ Author      : ZennzXD & ArulzXD
 * ✦ Deskripsi   : Mengubah teks menjadi audio menggunakan AirMore AI dengan berbagai pilihan suara multilingual.
 */

const express = require('express');
const axios = require('axios');
const { createCanvas } = require('@napi-rs/canvas');

const router = express.Router();

const headers = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'Content-Type': 'application/json',
  'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
  'X-Lang-Code': 'en',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'Origin': 'https://airmore.ai',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'Referer': 'https://airmore.ai/text-to-speech',
  'Accept-Language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6'
};

const VOICE_LIST = [
  'MasaruMultilingual', 'BrandonMultilingual', 'RemyMultilingual', 'EchoTurboMultilingual', 'OnyxTurboMultilingual', 
  'Ken', 'Prabhat', 'Liam', 'ChristopherMultilingual', 'DavisMultilingual', 'VivienneMultilingual', 
  'ShimmerTurboMultilingual', 'NancyMultilingual', 'IsidoraMultilingual', 'AdaMultilingual', 'EvelynMultilingual', 
  'SeraphinaMultilingual', 'XiaoyuMultilingual', 'Neerja', 'Aashi', 'shandong-Yunxiang', 'WanLung', 
  'henan-Yundeng', 'Yunyang', 'sichuan-Yunxi', 'YunJhe', 'Yunye', 'Yunze', 'Yunhao', 'Xiaomeng', 
  'shaanxi-Xiaoni', 'HiuGaai', 'Xiaoyi', 'Xiaozhen', 'Xiaoxiao', 'XiaoxiaoMultilingual', 'HsiaoChen', 
  'Xiaoqiu', 'XiaoxiaoDialects', 'Yunfeng', 'Yunjian', 'YunyiMultilingual', 'Xiaorui', 'XiaoxiaoDialects_nan-CN', 
  'Xiaorou', 'Xiaohan', 'Keita', 'Aoi', 'Naoki', 'Daichi', 'OllieMultilingual', 'YunfanMultilingual', 
  'LucienMultilingual', 'Nanami', 'Shiori', 'Mayu', 'LolaMultilingual', 'ThalitaMultilingual', 'Jerome', 
  'Antoine', 'Maurice', 'AndrewMultilingual', 'FlorianMultilingual', 'Gerard', 'Fabrice', 'Claude', 'Yves', 
  'Alain', 'Ariane', 'Eloise', 'Coralie', 'Sylvie', 'EmmaMultilingual', 'Jonas', 'Conrad', 'Jan', 'Ralf', 
  'Gisela', 'Ingrid', 'Elke', 'Amala', 'Maja', 'Katja', 'AvaMultilingual', 'ArabellaMultilingual', 'Klarissa', 
  'Donato', 'Julio', 'Duarte', 'Antonio', 'Nicolau', 'Valerio', 'MacerioMultilingual', 'DerekMultilingual', 
  'Francisca', 'Leila', 'Fernanda', 'Yara', 'Manuela', 'Elza', 'Leticia', 'BrianMultilingual', 'Gonzalo', 
  'Alvaro', 'Jorge', 'Tomas', 'Gerardo', 'Rodrigo', 'Carlos', 'Emilio', 'Federico', 'Salome', 'Elvira', 
  'Marina', 'Beatriz', 'Tania', 'Vera', 'Teresa', 'Valentina', 'Nuria', 'Carlota', 'Andrea', 'Irene', 
  'Abril', 'Dalia', 'GookMin', 'Hyunsu', 'BongJin', 'MarcelloMultilingual', 'FableTurboMultilingual', 
  'AlessioMultilingual', 'SoonBok', 'SunHi', 'YuJin', 'SeoHyeon', 'CoraMultilingual', 'XiaochenMultilingual', 
  'IsabellaMultilingual', 'Pradeep', 'Bashkar', 'DustinMultilingual', 'SteffanMultilingual', 'LewisMultilingual', 
  'Nabanita', 'Tanishaa', 'XimenaMultilingual', 'PhoebeMultilingual', 'Diego', 'Giuseppe', 'Gianni', 'Lisandro', 
  'Cataldo', 'Calimero', 'Benigno', 'Rinaldo', 'Imelda', 'Pierina', 'Irma', 'Isabella', 'Palmira', 'Fiamma', 
  'Elsa', 'NamMinh', 'AdamMultilingual', 'HoaiMy', 'Niwat', 'RyanMultilingual', 'TristanMultilingual', 
  'Premwadee', 'Achara', 'JennyMultilingual', 'Aarav', 'Kunal', 'Madhur', 'AlloyTurboMultilingual', 
  'SerenaMultilingual', 'AmandaMultilingual', 'Swara', 'Kavya', 'NovaTurboMultilingual'
];

function randomIP() {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function canvasFingerprint() {
  const canvas = createCanvas(200, 50);
  const ctx = canvas.getContext('2d');
  const n = () => Math.floor(Math.random() * 3) - 1;

  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  
  ctx.fillStyle = `rgb(255, ${102 + n()}, ${n() + 1})`;
  ctx.fillRect(125 + n(), 1 + n(), 62, 20);
  
  ctx.fillStyle = '#069';
  ctx.fillText('Device fingerprint test', 2 + n(), 15 + n());
  
  ctx.fillStyle = `rgba(102, 204, 0, ${0.7 + (Math.random() * 0.05)})`;
  ctx.fillText('Device fingerprint test', 4 + n(), 17 + n());
  
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10 + n(), 30 + n());
  ctx.lineTo(50 + n(), 30 + n());
  ctx.lineTo(30 + n(), 40 + n());
  ctx.closePath();
  ctx.stroke();
  
  const gradient = ctx.createLinearGradient(0, 0, 200, 0);
  gradient.addColorStop(0, 'red');
  gradient.addColorStop(0.5, 'green');
  gradient.addColorStop(1, 'blue');
  ctx.fillStyle = gradient;
  ctx.fillRect(60 + n(), 30 + n(), 100, 20);
  
  return canvas.toDataURL();
}

function deviceinfo() {
  const cores = [4, 6, 8, 12, 16][Math.floor(Math.random() * 5)];
  const memory = [4, 6, 8, 12, 16][Math.floor(Math.random() * 5)];
  
  const vendors = ["Google Inc. (ARM)", "Qualcomm", "ARM", "Imagination Technologies"];
  const renderers = ["ANGLE (ARM, Mali-G76 MC4, OpenGL ES 3.2)", "Adreno (TM) 618", "Adreno (TM) 640", "Adreno (TM) 730", "Mali-G77 MC9", "PowerVR Rogue GE8320"];
  
  const webglParams = [
    Math.floor(Math.random() * 4096) + 4096,
    Math.floor(Math.random() * 4096) + 4096,
    Math.floor(Math.random() * 4096) + 4096,
    Math.floor(Math.random() * 4096) + 4096,
    16, 256, 16, 1024, 15, 224, 1024, 16, 32
  ];

  const webgl = JSON.stringify({
    vendor: vendors[Math.floor(Math.random() * vendors.length)],
    renderer: renderers[Math.floor(Math.random() * renderers.length)],
    parameters: webglParams
  });

  const rndGa1 = Math.floor(Math.random() * 900000000) + 100000000;
  const timestamp = Math.floor(Date.now() / 1000);
  const kukis = `_ga=GA1.1.${rndGa1}.${timestamp}; _ga_9H91Z7CX47=GS2.1.s${timestamp}$o4$g1$t${timestamp}$j26$l0$h0`;

  return {
    info: {
      canvas: canvasFingerprint(),
      webgl: webgl,
      hardware: `cores:${cores}|memory:${memory}`,
      platform: `platform:Linux armv81`
    },
    cookie: kukis
  };
}

async function airmore(text, voice) {
  const device = deviceinfo();
  const ip = randomIP();
  
  const reqHeaders = {
    ...headers,
    'Cookie': device.cookie,
    'X-Forwarded-For': ip,
    'X-Real-IP': ip,
    'Client-IP': ip
  };
  
  await axios.post('https://airmore.ai/wp-json/airmore/v1/text-to-speech/check-limit', { device_info: device.info }, { headers: reqHeaders });
  
  const payload = {
    text: text,
    language: "en",
    voice: voice,
    mode: 2,
    volume: 100,
    speech_rate: 0,
    format: "mp3",
    device_info: device.info
  };
  
  const create = await axios.post('https://airmore.ai/wp-json/airmore/v1/text-to-speech/create', payload, { headers: reqHeaders });
  const taskId = create.data.task_id;
  
  const pollheaders = { ...reqHeaders, 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' };
  
  let result;
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 2000));
    const ts = Date.now();
    const resStatus = await axios.get(`https://airmore.ai/wp-json/airmore/v1/text-to-speech/status/${taskId}?_=${ts}`, { headers: pollheaders });
    
    result = resStatus.data;
    if (result.is_completed && result.progress === 100) break;
    if (result.is_failed) throw new Error('Pembuatan audio gagal dari penyedia.');
    attempts++;
  }

  if (!result || !result.is_completed) {
    throw new Error('Proses pembuatan audio timeout.');
  }
  
  return {
    task_id: taskId,
    audio_url: result.audio_url || result.file_url
  };
}

router.get('/', async (req, res) => {
  try {
    const text = req.query.text?.trim() || req.query.q?.trim();
    const voice = req.query.voice?.trim() || 'ChristopherMultilingual';
    const format = (req.query.format || 'audio').toLowerCase().trim();

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter text/q (contoh: ?text=Hello world)'
      });
    }

    if (!VOICE_LIST.includes(voice)) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: `Voice "${voice}" tidak valid. Silakan pilih voice yang ada di daftar.`
      });
    }

    const data = await airmore(text, voice);

    if (format === 'json') {
      return res.json({
        status: true,
        creator: 'ArulzXD',
        result: {
          text: text,
          voice: voice,
          task_id: data.task_id,
          audio_url: data.audio_url
        }
      });
    }

    const audioStream = await axios.get(data.audio_url, { responseType: 'stream' });
    res.setHeader('Content-Type', 'audio/mpeg');
    return audioStream.data.pipe(res);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message || 'Terjadi kesalahan saat memproses TTS AirMore AI.'
    });
  }
});

router.desc = "Mengubah teks menjadi suara (Text-to-Speech) dengan berbagai karakter suara multilingual.";
router.paramsConfig = {
  text: "text",
  voice: {
    type: "select",
    options: VOICE_LIST,
    default: "ChristopherMultilingual"
  },
  format: {
    type: "select",
    options: ["audio", "json"],
    default: "audio"
  }
};
router.status = "ready";
router.type = "free";

module.exports = router;
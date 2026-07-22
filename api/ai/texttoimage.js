const express = require("express");
const fetch = require("node-fetch");

const router = express.Router();

// ==========================================
// CORE FUNCTIONS (TIDAK ADA YANG DIUBAH)
// ==========================================

async function anime(Prompt) {
    const postResponse = await fetch('https://aicharalab.com/api/character/character-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
            'Referer': 'https://aicharalab.com/ghibli-ai-generator'
        },
        body: JSON.stringify({
            prompts: Prompt,
            negative: "",
            image_style: "anime",
            style_transfer: 0,
            aspect_ratio: "1:1",
            number: 1
        })
    });

    const postResult = await postResponse.json();
    const taskId = postResult.data.task_id;

    while (true) {
        const getResponse = await fetch(`https://aicharalab.com/api/dash/task-status?task_id=${taskId}&project_name=character`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://aicharalab.com/ghibli-ai-generator'
            }
        });

        const getResult = await getResponse.json();
        
        if (getResult.status === 100000) {
            return getResult.data.result[0];
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000)); 
    }
}

async function ghibli(Prompt) {
    const postResponse = await fetch('https://aicharalab.com/api/character/character-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
            'Referer': 'https://aicharalab.com/ghibli-ai-generator'
        },
        body: JSON.stringify({
            prompts: Prompt,
            negative: "",
            image_style: "ghibli",
            style_transfer: 0,
            aspect_ratio: "1:1",
            number: 1
        })
    });

    const postResult = await postResponse.json();
    const taskId = postResult.data.task_id;

    while (true) {
        const getResponse = await fetch(`https://aicharalab.com/api/dash/task-status?task_id=${taskId}&project_name=character`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://aicharalab.com/ghibli-ai-generator'
            }
        });

        const getResult = await getResponse.json();
        
        if (getResult.status === 100000) {
            return getResult.data.result[0];
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000)); 
    }
}

async function pixel(Prompt) {
    const postResponse = await fetch('https://aicharalab.com/api/character/character-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
            'Referer': 'https://aicharalab.com/ghibli-ai-generator'
        },
        body: JSON.stringify({
            prompts: Prompt,
            negative: "",
            image_style: "pixel art",
            style_transfer: 0,
            aspect_ratio: "1:1",
            number: 1
        })
    });

    const postResult = await postResponse.json();
    const taskId = postResult.data.task_id;

    while (true) {
        const getResponse = await fetch(`https://aicharalab.com/api/dash/task-status?task_id=${taskId}&project_name=character`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://aicharalab.com/ghibli-ai-generator'
            }
        });

        const getResult = await getResponse.json();
        
        if (getResult.status === 100000) {
            return getResult.data.result[0];
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000)); 
    }
}

// ==========================================
// EXPRESS ROUTER ENDPOINT
// ==========================================

router.get("/", async (req, res) => {
  try {
    const text = req.query.text;
    const type = req.query.type || 'anime';

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Masukkan parameter 'text'. Contoh: ?text=cat"
      });
    }

    let imageUrl;

    switch (type.toLowerCase()) {
      case 'anime':
        imageUrl = await anime(text);
        break;
      case 'ghibli':
        imageUrl = await ghibli(text);
        break;
      case 'pixel':
        imageUrl = await pixel(text);
        break;
      default:
        return res.status(400).json({
          status: false,
          message: `Tipe '${type}' tidak valid. Gunakan: anime, ghibli, atau pixel.`
        });
    }

    // Mengembalikan hasil URL gambar dalam format JSON
    return res.json({
      status: true,
      creator: "ArulzXD",
      result: imageUrl
    });

  } catch (error) {
    // Menangani error sistem agar langsung mengembalikan status 500
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
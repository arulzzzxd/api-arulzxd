const axios = require('axios');
const express = require('express');
const router = express.Router();

const UA = "Mozilla/5.0 (Linux; Android 13; 23021RAA2Y Build/TKQ1.221114.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.137 Mobile Safari/537.36";

// ======================================================
// HELPER NORMALIZE URL
// ======================================================
function normalizeUrl(url) {
    try {
        const u = new URL(url);
        if (u.hostname === "youtu.be") {
            return "https://www.youtube.com/watch?v=" + u.pathname.slice(1);
        }
        if (u.pathname.includes('/shorts/')) {
            return "https://www.youtube.com/watch?v=" + u.pathname.split('/shorts/')[1]?.split('/')[0];
        }
        return "https://www.youtube.com/watch?v=" + u.searchParams.get("v");
    } catch (e) {
        return url;
    }
}

// ======================================================
// MAIN YTMP4 360P FUNCTION
// ======================================================
async function ytmp4(url) {
    const cleanUrl = normalizeUrl(url);

    // 1. Check DMCA
    const { data: dmca } = await axios.get(`https://dmca.ytmp3.gg/api/check?url=${encodeURIComponent(url)}`, {
        headers: { "Accept": "application/json", "User-Agent": UA }
    });

    if (dmca.blocked) {
        throw new Error("Video terkena DMCA, tidak bisa didownload.");
    }

    // 2. Get Oembed Info
    const { data: info } = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`, {
        headers: { "Accept": "application/json", "User-Agent": UA }
    });

    // 3. Start Download Request (MP4 360p Only)
    const { data: dl } = await axios.post('https://ytdl.y2mp3.co/api/v2/download', 
        {
            url: cleanUrl,
            output: {
                type: "video",
                format: "mp4",
                quality: "360p"
            }
        },
        {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": UA
            }
        }
    );

    if (!dl.statusUrl) {
        throw new Error("Gagal menginisiasi unduhan di server.");
    }

    // 4. Polling Status
    const id = dl.statusUrl.split("/").pop();
    let downloadUrl = "";

    for (let i = 0; i < 30; i++) {
        const { data: result } = await axios.get(`https://ytdl.y2mp3.co/api/status/${id}`, {
            headers: { "Accept": "application/json", "User-Agent": UA }
        });

        if (result.status === "completed") {
            downloadUrl = result.downloadUrl;
            break;
        }
        if (result.status === "failed") {
            throw new Error("Gagal memproses video di server.");
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (!downloadUrl) {
        throw new Error("Proses rendering video habis waktu (Timeout).");
    }

    return {
        judul: info.title || "-",
        channel: info.author_name || "-",
        thumbnail: info.thumbnail_url || `https://i.ytimg.com/vi/${cleanUrl.split('v=')[1]}/hqdefault.jpg`,
        quality: "MP4 360P",
        download: downloadUrl
    };
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            error: "Missing 'url' parameter"
        });
    }

    try {
        const result = await ytmp4(url);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            error: error.response?.data || error.message || String(error)
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
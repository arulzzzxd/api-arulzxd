const axios = require('axios');
const express = require('express');
const router = express.Router();

async function tiktokDl(url) {
  try {
    const formatNumber = (n) => Number(parseInt(n || 0))
      .toLocaleString()
      .replace(/,/g, '.');

    const formatDate = (n, locale = 'en') => {
      const d = new Date(n * 1000);
      return d.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
    };

    const res = await axios.post(
      'https://www.tikwm.com/api/',
      new URLSearchParams({ url }),
      {
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
        },
        params: {
          count: 12,
          cursor: 0,
          web: 1,
          hd: 1,
        },
      }
    );

    const data = res.data?.data;
    if (!data) {
      return {
        success: false,
        message: 'Data tidak ditemukan dari API TikWM.'
      };
    }

    let media = [];

    if (data.duration === 0 && Array.isArray(data.images)) {
      data.images.map((v) => media.push({ type: 'photo', url: v }));
    } else {
      media = [
        {
          type: 'watermark',
          url: 'https://www.tikwm.com' + (data.wmplay || '/undefined'),
        },
        {
          type: 'nowatermark',
          url: 'https://www.tikwm.com' + (data.play || '/undefined'),
        },
        {
          type: 'nowatermark_hd',
          url: 'https://www.tikwm.com' + (data.hdplay || '/undefined'),
        },
      ];
    }

    return {
      success: true,
      title: data.title,
      taken_at: formatDate(data.create_time),
      region: data.region,
      id: data.id,
      duration: `${data.duration} Seconds`,
      cover: 'https://www.tikwm.com' + data.cover,
      media,
      music_info: {
        id: data.music_info.id,
        title: data.music_info.title,
        author: data.music_info.author,
        album: data.music_info.album || null,
        url:
          'https://www.tikwm.com' +
          (data.music || data.music_info.play || '/undefined'),
      },
      stats: {
        views: formatNumber(data.play_count),
        likes: formatNumber(data.digg_count),
        comment: formatNumber(data.comment_count),
        share: formatNumber(data.share_count),
        download: formatNumber(data.download_count),
      },
      author: {
        id: data.author.id,
        fullname: data.author.unique_id,
        nickname: data.author.nickname,
        avatar: 'https://www.tikwm.com' + data.author.avatar,
      },
    };

  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
    return {
      success: false,
      message: "Terjadi kesalahan dalam mengambil data.",
      error: error.response ? error.response.data : error.message
    };
  }
}

router.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing 'url' parameter" });
  
  try {
    const anu = await tiktokDl(url);
    return res.json(anu);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
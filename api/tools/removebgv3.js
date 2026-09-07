/*
  Create: t.me/AwasPhpJir
  RestApis: api.ikyyxd.my.id
  Note: Remove Background Image
*/

const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');

const router = express.Router();
const upload = multer();

async function processRemoveBg(imageBuffer, filename = 'image.png', mimetype = 'image/png') {
    const rmForm = new FormData();
    rmForm.append('file', imageBuffer, { filename, contentType: mimetype });

    const rmRes = await axios.post(`https://xmz-rmvbg.vercel.app/api/remove`, rmForm, {
        headers: { ...rmForm.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 60000,
        maxContentLength: 50 * 1024 * 1024
    });

    if (!rmRes.data?.success || !rmRes.data?.result) {
        throw new Error('API Remove BG gagal atau tidak mengembalikan hasil.');
    }

    const noBgBuffer = Buffer.from(rmRes.data.result, 'base64');

    const upForm = new FormData();
    upForm.append('file', noBgBuffer, { filename: 'no-bg-result.png', contentType: 'image/png' });

    const upRes = await axios.post(`https://cdnn.ikyyxd.my.id/api/upload.php`, upForm, {
        headers: { ...upForm.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 30000
    });

    const data = upRes.data;
    let directUrl = null;

    if (data?.status && data?.result?.url) {
        directUrl = data.result.url;
    } else if (data?.url) {
        directUrl = data.url;
    } else if (typeof data === 'string' && data.startsWith('http')) {
        directUrl = data;
    } else {
        throw new Error(`Gagal parsing URL. Raw Response: ${JSON.stringify(data)}`);
    }

    return {
        originalSizeKb: parseFloat((imageBuffer.length / 1024).toFixed(1)),
        noBgSizeKb: parseFloat((noBgBuffer.length / 1024).toFixed(1)),
        directUrl: directUrl
    };
}

router.post('/', upload.single('fileupload'), async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: 'ArulzXD',
                message: "Berkas 'fileupload' wajib diunggah!"
            });
        }

        const result = await processRemoveBg(
            file.buffer,
            file.originalname || 'image.png',
            file.mimetype || 'image/png'
        );

        return res.json({
            status: true,
            creator: 'ArulzXD',
            result: result
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: 'ArulzXD',
            message: err.message || 'Terjadi kesalahan saat memproses Hapus Latar Belakang.'
        });
    }
});

router.desc = "Menghapus latar belakang gambar murni via unggah berkas gambar.";
router.paramsConfig = {
    fileupload: {
        type: "file",
        desc: "Berkas gambar yang akan dihapus latar belakangnya"
    }
};
router.status = "ready";
router.type = "free";

module.exports = router;
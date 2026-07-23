const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

// Masukkan Kredensial Supabase Anda di sini atau via process.env
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://evcfckqcgeucugmkqbef.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_1PUlVZ3zSMyVA0r-tWUOSw_1byEaXMq';
const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'uploads';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

router.post('/', async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({
                status: false,
                creator: "Arulz-XD",
                message: "Tidak ada berkas yang diunggah! Gunakan parameter 'file'."
            });
        }

        const uploadedFile = req.files.file;
        const fileExt = path.extname(uploadedFile.name);
        
        // Buat nama berkas unik
        const randomName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${fileExt}`;

        // Unggah buffer file ke Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(randomName, uploadedFile.data, {
                contentType: uploadedFile.mimetype,
                upsert: false
            });

        if (error) {
            throw error;
        }

        // Dapatkan URL Publik File dari Supabase
        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(randomName);

        return res.json({
            status: true,
            creator: "Arulz-XD",
            result: {
                fileName: uploadedFile.name,
                size: uploadedFile.size,
                mimeType: uploadedFile.mimetype,
                url: publicUrlData.publicUrl
            },
            url: publicUrlData.publicUrl
        });

    } catch (err) {
        console.error("Gagal Upload ke Supabase:", err.message);
        return res.status(500).json({
            status: false,
            creator: "Arulz-XD",
            message: "Gagal mengunggah berkas ke Supabase storage: " + err.message
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;

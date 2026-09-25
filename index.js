const express = require('express');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { MongoStore } = require('connect-mongo');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const mime = require('mime-types');
const multer = require("multer");
const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const compression = require('compression');
const os = require('os');

const app = express();
app.use(compression());
app.set('etag', false);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname)));
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString('utf8');
    }
}));
app.use(cookieParser());
app.set('trust proxy', 1);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arulz-xd-owner:Haqqi0213@cluster0.fgxhxqm.mongodb.net/?appName=Cluster0'; 

mongoose.connect(MONGODB_URI)
    .then(() => console.log('📦 Berhasil terhubung ke MongoDB!'))
    .catch(err => console.error('❌ Gagal koneksi ke MongoDB:', err));

const JWT_SECRET = process.env.JWT_SECRET || 'arulzxd-super-secret-jwt-key-999';

// ====================================================
// HELPER GENERATOR API KEY SESUAI ATURAN
// ====================================================
function generateFreeApiKey() {
    return 'arulzxdfree-' + crypto.randomBytes(3).toString('hex').slice(0, 5);
}

function generatePremiumApiKey(username) {
    const cleanUsername = (username || 'user').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    return `${cleanUsername}prem-` + crypto.randomBytes(3).toString('hex').slice(0, 6);
}

// ====================================================
// MONGOOSE SCHEMA & USER MODEL
// ====================================================
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, default: null },
    provider: { type: String, default: 'local' },
    providerId: { type: String, default: null },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    apikey: { type: String, required: true, unique: true },
    role: { type: String, default: 'Free User' }, // 'Free User', 'Premium User', 'VIP User'
    roleExpiresAt: { type: Date, default: null }, // MASA BERLAKU ROLE
    limit: { type: Number, default: 0 },
    lastLimitReset: { type: Date, default: Date.now },
    avatar: { type: String, default: 'https://arulz-xd.my.id/files/X1F0Cn.png' }, 
    createdAt: { type: Date, default: Date.now }
});

// Middleware Otomatis Update API Key saat Role Berubah jika tidak ditentukan khusus
userSchema.pre('save', function() {
    if (this.isModified('role')) {
        const roleLower = (this.role || '').toLowerCase();

        if (roleLower.includes('vip')) {
            if (!this.apikey) {
                this.apikey = `${this.username.toLowerCase()}-custom-vip`;
            }
        } else if (roleLower.includes('premium')) {
            if (!this.apikey || !this.apikey.includes('prem-')) {
                this.apikey = generatePremiumApiKey(this.username);
            }
        } else {
            if (!this.apikey || !this.apikey.startsWith('arulzxdfree-')) {
                this.apikey = generateFreeApiKey();
            }
        }
    }
});


const User = mongoose.models.User || mongoose.model('User', userSchema);

app.use(session({
    secret: 'arulzxd_secret_session_key_99', 
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        dbName: 'sessions',
        ttl: 24 * 60 * 60
    }),
    cookie: { maxAge: 24 * 60 * 60 * 1000 } 
}));

const checkAuthSession = (req, res, next) => {
    const token = req.cookies.auth_session;
    if (!token) {
        req.user = null;
        return next();
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            ...decoded,
            apikey: decoded.apikey
        }; 
        next();
    } catch (err) {
        res.clearCookie('auth_session');
        req.user = null;
        next();
    }
};

app.use(checkAuthSession);

// CRON JOB: Cek & Reset Role ke 'Free User' jika masa aktif paket telah kadaluwarsa
cron.schedule('0 * * * *', async () => {
    try {
        const expiredUsers = await User.find({
            role: { $ne: 'Free User' },
            roleExpiresAt: { $lte: new Date() }
        });

        for (const user of expiredUsers) {
            user.role = 'Free User';
            user.roleExpiresAt = null;
            user.apikey = generateFreeApiKey(); // Reset API Key ke Format Free
            await user.save();
            console.log(`📉 [EXPIRED] Role pengguna ${user.username} dikembalikan ke Free User.`);
        }
    } catch (err) {
        console.error('❌ [CRON] Gagal memproses ekspirasi role:', err.message);
    }
}, {
    scheduled: true,
    timezone: "Asia/Jakarta"
});

const uploadavatar = multer({ 
    limits: { fileSize: 4 * 1024 * 1024 }, // Limit 4MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('File harus berupa gambar!'));
        }
    }
});

// Endpoint Upload Avatar
app.post('/api/user/update-avatar', checkAuthSession, (req, res) => {
    uploadavatar.single('avatar')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ status: false, message: err.message || 'Gagal mengunggah gambar.' });
        }

        try {
            if (!req.user) {
                return res.status(401).json({ status: false, message: 'Anda belum login!' });
            }

            if (!req.file) {
                return res.status(400).json({ status: false, message: 'Silakan pilih gambar terlebih dahulu!' });
            }

            const mimeType = req.file.mimetype || mime.lookup(req.file.originalname) || 'image/png';
            if (!mimeType.startsWith('image/')) {
                return res.status(400).json({ status: false, message: 'File harus berupa gambar (JPG, PNG, GIF, WebP)!' });
            }

            const base64 = req.file.buffer.toString("base64");
            const avatarDataUrl = `data:${mimeType};base64,${base64}`;

            const userIdToUpdate = req.user.id || req.user._id;
            const updatedUser = await User.findByIdAndUpdate(
                userIdToUpdate,
                { $set: { avatar: avatarDataUrl } },
                { new: true, runValidators: true }
            );

            if (!updatedUser) {
                return res.status(404).json({ status: false, message: 'User tidak ditemukan.' });
            }

            const userPayload = {
                id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                name: updatedUser.username,
                avatar: updatedUser.avatar,
                role: updatedUser.role,
                apikey: updatedUser.apikey
            };

            const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });
            res.cookie('auth_session', token, {
                maxAge: 7 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: true,
                sameSite: 'lax'
            });

            return res.json({
                status: true,
                message: 'Avatar berhasil diperbarui!',
                avatar: updatedUser.avatar
            });

        } catch (error) {
            console.error("Gagal update avatar:", error);
            return res.status(500).json({ status: false, message: 'Terjadi kesalahan pada server saat memperbarui avatar.' });
        }
    });
});

// ====================================================
// ENDPOINT CUSTOM APIKEY KHUSUS VIP USER
// ====================================================
app.post('/api/user/custom-apikey', checkAuthSession, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ status: false, message: 'Anda harus login terlebih dahulu!' });
        }

        const userId = req.user.id || req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ status: false, message: 'User tidak ditemukan!' });
        }

        const roleLower = (user.role || '').toLowerCase();
        if (!roleLower.includes('vip')) {
            return res.status(403).json({ status: false, message: 'Fitur Custom API Key hanya diperuntukkan untuk VIP User!' });
        }

        const { customKey } = req.body;
        if (!customKey || !customKey.trim()) {
            return res.status(400).json({ status: false, message: 'API Key kustom tidak boleh kosong!' });
        }

        const cleanKey = customKey.trim();

        if (cleanKey.length < 4 || cleanKey.length > 30) {
            return res.status(400).json({ status: false, message: 'API Key kustom harus memiliki panjang 4 - 30 karakter!' });
        }

        // Cek apakah API Key sudah dipakai oleh pengguna lain
        const existingKey = await User.findOne({ apikey: cleanKey, _id: { $ne: userId } });
        if (existingKey) {
            return res.status(400).json({ status: false, message: 'API Key tersebut sudah digunakan oleh user lain! Silakan pilih nama lain.' });
        }

        user.apikey = cleanKey;
        await user.save();

        // Update Token JWT
        const userPayload = {
            id: user._id,
            username: user.username,
            email: user.email,
            name: user.username,
            avatar: user.avatar,
            role: user.role,
            apikey: user.apikey
        };

        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('auth_session', token, {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: true,
            sameSite: 'lax'
        });

        return res.json({
            status: true,
            message: 'API Key berhasil diperbarui!',
            apikey: user.apikey
        });

    } catch (error) {
        console.error("Gagal custom apikey:", error);
        return res.status(500).json({ status: false, message: 'Terjadi kesalahan server saat memperbarui API Key.' });
    }
});

// ----------------------------------------------------
// MONGOOSE SCHEMA & MODEL PENILAIAN / REVIEW
// ----------------------------------------------------
const reviewSchema = new mongoose.Schema({
    productId: { type: String, required: true, index: true },
    userId: { type: String, default: null, index: true },
    username: { type: String, required: true },
    userAvatar: { type: String, default: 'https://arulz-xd.my.id/files/X1F0Cn.png' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    media: [{
        type: { type: String, enum: ['image', 'video'] },
        url: String
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

reviewSchema.index({ productId: 1, userId: 1 }, { unique: true, sparse: true });
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

const uploadReviewMedia = multer({
    limits: { fileSize: 10 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('File harus berupa gambar atau video!'));
        }
    }
});

app.post('/api/reviews', checkAuthSession, (req, res) => {
    uploadReviewMedia.array('mediaFiles', 5)(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ status: false, message: err.message || 'Gagal mengunggah berkas.' });
        }

        try {
            const { productId, rating, comment } = req.body;

            if (!productId) {
                return res.status(400).json({ status: false, message: 'Product ID wajib diisi!' });
            }

            if (!rating || Number(rating) < 1 || Number(rating) > 5) {
                return res.status(400).json({ status: false, message: 'Rating bintang wajib diisi (1-5)!' });
            }

            if (!comment || !comment.trim()) {
                return res.status(400).json({ status: false, message: 'Anda diwajibkan menuliskan ulasan/penilaian!' });
            }

            let username = 'Anonim';
            let userAvatar = 'https://arulz-xd.my.id/files/X1F0Cn.png';
            let userId = getUserIdentifier(req);

            if (req.user) {
                username = req.user.username || req.user.name;
                userAvatar = req.user.avatar || userAvatar;
                userId = (req.user.id || req.user._id || req.user.email || req.user.username).toString();
            }

            const product = await Product.findOne({
                $or: [{ Id: productId }, { _id: mongoose.Types.ObjectId.isValid(productId) ? productId : null }]
            });

            if (product && product.purchasedBy) {
                const userClean = userId.toLowerCase().trim();
                const isBuyer = product.purchasedBy.some(p => p.toLowerCase().trim() === userClean);

                if (!isBuyer && process.env.NODE_ENV === 'production') {
                    return res.status(403).json({
                        status: false,
                        message: 'Anda belum pernah membeli produk ini, tidak dapat memberikan penilaian!'
                    });
                }
            }

            const mediaList = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const mimeType = file.mimetype || mime.lookup(file.originalname) || '';
                    const isVideo = mimeType.startsWith('video/');
                    const base64 = file.buffer.toString('base64');
                    const dataUrl = `data:${mimeType};base64,${base64}`;

                    mediaList.push({
                        type: isVideo ? 'video' : 'image',
                        url: dataUrl
                    });
                }
            }

            let existingReview = await Review.findOne({ productId, userId });

            if (existingReview) {
                existingReview.rating = Number(rating);
                existingReview.comment = comment.trim();
                if (mediaList.length > 0) {
                    existingReview.media = mediaList; 
                }
                existingReview.updatedAt = new Date();
                await existingReview.save();

                return res.json({
                    status: true,
                    message: 'Penilaian produk Anda berhasil diperbarui!',
                    data: existingReview
                });
            } else {
                const newReview = new Review({
                    productId,
                    userId,
                    username,
                    userAvatar,
                    rating: Number(rating),
                    comment: comment.trim(),
                    media: mediaList
                });

                await newReview.save();

                return res.json({
                    status: true,
                    message: 'Penilaian produk berhasil dikirim!',
                    data: newReview
                });
            }

        } catch (error) {
            console.error("Error submit review:", error);
            return res.status(500).json({ status: false, message: 'Terjadi kesalahan server saat menyimpan ulasan.' });
        }
    });
});

app.get('/api/reviews/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({ productId }).sort({ createdAt: -1 });

        let averageRating = 0;
        if (reviews.length > 0) {
            const totalRating = reviews.reduce((sum, item) => sum + item.rating, 0);
            averageRating = Number((totalRating / reviews.length).toFixed(1));
        }

        return res.json({
            status: true,
            totalReviews: reviews.length,
            averageRating: averageRating,
            reviews: reviews
        });
    } catch (error) {
        console.error("Error fetch reviews:", error);
        return res.status(500).json({ status: false, message: 'Gagal mengambil ulasan produk.' });
    }
});

// ====================================================
// ENDPOINT DELETE REVIEWS (HAPUS ULASAN/RATING)
// ====================================================
app.delete('/api/reviews/:reviewId', checkAuthSession, async (req, res) => {
    try {
        const { reviewId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ 
                status: false, 
                message: 'ID ulasan tidak valid!' 
            });
        }

        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({ 
                status: false, 
                message: 'Ulasan tidak ditemukan!' 
            });
        }

        // Dapatkan identitas pengguna yang sedang melakukan request
        let currentUserId = getUserIdentifier(req);
        if (req.user) {
            currentUserId = (req.user.id || req.user._id || req.user.email || req.user.username).toString();
        }

        const currentUsername = req.user ? req.user.username : null;

        // Validasi: Pastikan pengguna hanya bisa menghapus ulasannya sendiri (atau admin jika ada)
        const isOwner = (review.userId && review.userId.toString() === currentUserId.toString()) ||
                        (currentUsername && review.username.toLowerCase() === currentUsername.toLowerCase());

        if (!isOwner) {
            return res.status(403).json({ 
                status: false, 
                message: 'Anda tidak memiliki hak akses untuk menghapus ulasan ini!' 
            });
        }

        await Review.findByIdAndDelete(reviewId);

        return res.json({
            status: true,
            message: 'Ulasan berhasil dihapus!'
        });

    } catch (error) {
        console.error("Error delete review:", error);
        return res.status(500).json({ 
            status: false, 
            message: 'Terjadi kesalahan server saat menghapus ulasan.' 
        });
    }
});

const PAYWUZ_API_KEY = process.env.PAYWUZ_API_KEY || "pk_live_f1429e9285d76999cc3f8bb6c3df552f";
const PAYWUZ_BASE_URL = "https://api.paywuz.id/v1";
const PAYWUZ_HEADERS = {
    "Authorization": `Bearer ${PAYWUZ_API_KEY}`,
    "Content-Type": "application/json"
};

async function axiosPaywuzWithRetry(config, maxRetries = 3, delayMs = 1500) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await axios(config);
        } catch (error) {
            const isRateLimited = error.response && error.response.status === 429;
            const isLastAttempt = i === maxRetries - 1;

            if (isRateLimited && !isLastAttempt) {
                console.warn(`⚠️ Menerima 429 dari PayWuz. Retry ke-${i + 1} dalam ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                delayMs *= 1.5; 
            } else {
                throw error;
            }
        }
    }
}

const cacheSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now, expires: 60 } 
});

const CacheModel = mongoose.models.Cache || mongoose.model('Cache', cacheSchema);

const voucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    discount: { type: Number, required: true },
    type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    expiredAt: { type: Date, required: true },
    usageLimit: { type: Number, default: 20 },
    usedCount: { type: Number, default: 0 },
    usedBy: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});

const Voucher = mongoose.models.Voucher || mongoose.model('Voucher', voucherSchema);

const productSchema = new mongoose.Schema({
    Id: { type: String, required: true, unique: true, trim: true },
    nama: { type: String, required: true, trim: true },
    harga: { type: Number, required: true },
    harga_diskon: { type: Number, default: null },
    kategori: { type: String, required: true },
    badge: { type: String, default: "" },
    terjual: { type: Number, default: 0 },
    stok: { type: Number, default: 0 },
    gambar: { 
        type: [String], 
        default: ["https://arulz-xd.my.id/files/X1F0Cn.png"] 
    },    
    deskripsi: { type: String, default: "" },
    link: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

function getUserIdentifier(req) {
    if (req.user) {
        return (req.user.email || req.user.username || req.user._id || "").toString().toLowerCase().trim();
    }
    const bodyIdentifier = req.body?.username || req.body?.email || req.body?.userIdentifier;
    if (bodyIdentifier) {
        return bodyIdentifier.toString().toLowerCase().trim();
    }
    return req.ip; 
}

app.post('/api/vouchers/claim', async (req, res) => {
    try {
        const code = req.body.code;
        if (!code) {
            return res.status(400).json({ status: false, message: 'Kode voucher wajib diisi!' });
        }

        const cleanCode = code.trim().toUpperCase();
        const userIdentifier = getUserIdentifier(req);

        const voucher = await Voucher.findOne({ code: cleanCode });

        if (!voucher) {
            return res.status(404).json({ status: false, message: 'Kode voucher tidak ditemukan!' });
        }

        if (voucher.usageLimit <= 0) {
            return res.status(400).json({ 
                status: false, 
                reason: 'limit_reached',
                message: 'Kuota penggunaan voucher ini sudah habis!' 
            });
        }

        if (voucher.usedBy && voucher.usedBy.includes(userIdentifier)) {
            return res.status(400).json({
                status: false,
                reason: 'already_used',
                message: 'Anda sudah pernah menggunakan voucher ini sebelumnya!'
            });
        }

        if (new Date() > new Date(voucher.expiredAt)) {
            return res.status(400).json({ 
                status: false, 
                reason: 'expired',
                message: 'Voucher telah kedaluwarsa!' 
            });
        }

        voucher.usedCount += 1;
        voucher.usageLimit = Math.max(0, voucher.usageLimit - 1); 

        if (!voucher.usedBy) voucher.usedBy = [];
        voucher.usedBy.push(userIdentifier);

        await voucher.save();

        return res.json({
            status: true,
            message: 'Voucher berhasil diklaim!',
            voucher: {
                code: voucher.code,
                discount: voucher.discount,
                type: voucher.type
            },
            data: {
                code: voucher.code,
                discount: voucher.discount,
                type: voucher.type
            }
        });
    } catch (err) {
        console.error("Error Claim Voucher:", err);
        return res.status(500).json({ status: false, message: 'Terjadi kesalahan pada server.' });
    }
});

app.get('/api/vouchers/:code', async (req, res) => {
    try {
        const code = req.query.code || req.params.code;
        if (!code) {
            return res.status(400).json({ status: false, message: 'Kode voucher wajib diisi!' });
        }

        const userIdentifier = getUserIdentifier(req);
        const voucher = await Voucher.findOne({ code: code.trim().toUpperCase() });
        if (!voucher) {
            return res.status(404).json({ status: false, message: 'Kode voucher tidak ditemukan!' });
        }

        if (voucher.usageLimit <= 0) {
            return res.status(400).json({ 
                status: false, 
                reason: 'limit_reached',
                message: 'Kuota penggunaan voucher ini sudah habis!' 
            });
        }

        if (voucher.usedBy && voucher.usedBy.includes(userIdentifier)) {
            return res.status(400).json({
                status: false,
                reason: 'already_used',
                message: 'Anda sudah pernah menggunakan voucher ini sebelumnya!'
            });
        }

        if (new Date() > new Date(voucher.expiredAt)) {
            return res.status(400).json({ 
                status: false, 
                reason: 'expired',
                message: 'Voucher telah kedaluwarsa!' 
            });
        }

        return res.json({
            status: true,
            message: 'Voucher berhasil ditemukan!',
            data: {
                code: voucher.code,
                discount: voucher.discount,
                type: voucher.type
            }
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: 'Terjadi kesalahan pada server.' });
    }
});

async function recordProductBuyer(productName, userIdentifier) {
    if (!productName || !userIdentifier) return;
    try {
        await Product.findOneAndUpdate(
            { nama: { $regex: new RegExp(`^${productName.trim()}$`, 'i') } },
            { $addToSet: { purchasedBy: userIdentifier.toString().toLowerCase().trim() } }
        );
    } catch (err) {
        console.error("❌ Gagal mencatat pembeli produk:", err.message);
    }
}

async function updateProductStockAndSold(productName, qtyChange = 1, isRollback = false) {
    try {
        if (!productName) return null;

        const product = await Product.findOne({ 
            nama: { $regex: new RegExp(`^${productName.trim()}$`, 'i') } 
        });

        if (product) {
            if (isRollback) {
                product.stok = (product.stok || 0) + qtyChange;
                product.terjual = Math.max(0, (product.terjual || 0) - qtyChange);
                console.log(`🔄 [STOK RESTORED] Produk "${product.nama}": Stok (${product.stok}), Terjual (${product.terjual})`);
            } else {
                product.stok = Math.max(0, (product.stok || 0) - qtyChange);
                product.terjual = (product.terjual || 0) + qtyChange;
                console.log(`📦 [STOK UPDATED] Produk "${product.nama}": Stok (${product.stok}), Terjual (${product.terjual})`);
            }

            await product.save();
            return product;
        }
    } catch (err) {
        console.error("❌ Gagal meng-update stok produk:", err.message);
    }
    return null;
}

async function setCache(key, data) {
    try {
        await CacheModel.findOneAndUpdate(
            { key },
            { data, createdAt: new Date() },
            { upsert: true, new: true }
        );
    } catch (e) {
        console.error("Gagal simpan cache MongoDB:", e.message);
    }
}

async function getCache(key) {
    try {
        const cached = await CacheModel.findOne({ key });
        return cached ? cached.data : null;
    } catch (e) {
        return null;
    }
}

async function deleteCache(key) {
    try {
        await CacheModel.deleteOne({ key });
    } catch (e) {}
}

function scheduleTransactionDeletion(orderId) {
    setTimeout(async () => {
        try {
            await Transaction.deleteOne({ orderId });
            await deleteCache(`trx_${orderId}`);
            console.log(`🗑️ Transaksi ${orderId} berhasil dihapus dari database.`);
        } catch (err) {
            console.error(`❌ Gagal menghapus transaksi ${orderId}:`, err.message);
        }
    }, 60 * 1000);
}

mongoose.connection.once('open', async () => {
    try {
        await mongoose.connection.db.collection('transactions').dropIndex('transactionId_1');
        console.log('🧹 Berhasil menghapus index lama transactionId_1');
    } catch (e) {}
});

const transactionSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    paymentNumber: { type: String, default: null }, 
    paymentMethod: { type: String, default: "QRIS" },
    status: { type: String, default: "pending" }, 
    itemDetails: {
        nama: String,
        harga: Number,
        harga_diskon: Number,
        kategori: String,
        gambar: String,
        link: String
    },
    productLink: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    expiredAt: { type: Date, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

function verifyPaywuzSignature(rawBody, receivedSignature, apikey) {
    if (!receivedSignature) return false;

    const computedSignature = "sha256=" + crypto
        .createHmac("sha256", apikey)
        .update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody))
        .digest("hex");

    try {
        return crypto.timingSafeEqual(
            Buffer.from(receivedSignature),
            Buffer.from(computedSignature)
        );
    } catch (err) {
        return false;
    }
}

app.post('/transactions', async (req, res) => {
    try {
        const { orderId, amount, itemDetails, qty } = req.body;
        const buyQty = Number(qty) || 1;

        if (!orderId || !amount) {
            return res.status(400).json({ 
                status: false,
                error: "INVALID_PAYLOAD", 
                message: "orderId dan amount wajib diisi!" 
            });
        }

        const existingTrx = await Transaction.findOne({ orderId });
        if (existingTrx) {
            return res.json({ status: true, data: existingTrx });
        }

        const inputAmount = Number(amount);

        const paywuzRes = await axiosPaywuzWithRetry({
            method: 'post',
            url: `${PAYWUZ_BASE_URL}/transactions`,
            data: {
                orderId,
                amount: inputAmount,
                paymentMethod: "QRIS",
                feeByMerchant: false
            },
            headers: PAYWUZ_HEADERS
        });

        const transactionData = paywuzRes.data?.data || paywuzRes.data;
        const qrisNumber = transactionData.paymentNumber || transactionData.qrString || transactionData.qrUrl;

        const safeNum = (val) => {
            const num = Number(val);
            return (!isNaN(num) && num > 0) ? num : null;
        };

        const feeFlatIdr = Number(transactionData.feeFlatIdr) || 290;
        const feePercentBps = Number(transactionData.feePercentBps) || 70;
        const calculatedFee = feeFlatIdr + Math.ceil((inputAmount * feePercentBps) / 10000);

        let finalAmount = safeNum(transactionData.grossAmount) || 
                          safeNum(transactionData.totalAmount) || 
                          safeNum(transactionData.total);

        if (!finalAmount) {
            const feeVal = safeNum(transactionData.fee) || safeNum(transactionData.feeAdmin) || calculatedFee;
            finalAmount = inputAmount + feeVal;
        }

        let pLink = itemDetails?.link || null;
        if (!pLink && itemDetails?.nama) {
            const dbProduct = await Product.findOne({ 
                nama: { $regex: new RegExp(`^${itemDetails.nama.trim()}$`, 'i') }
            }).lean();
            if (dbProduct) pLink = dbProduct.link;
        }

        const expiredAt = new Date(Date.now() + 15 * 60 * 1000);

        const newTransaction = new Transaction({
            orderId,
            amount: finalAmount,
            paymentNumber: qrisNumber,
            paymentMethod: "QRIS",
            status: (transactionData.status || "pending").toLowerCase(),
            itemDetails: {
                ...itemDetails,
                qty: buyQty
            },
            productLink: pLink,
            expiredAt: expiredAt
        });

        await newTransaction.save();

        return res.json({
            status: true,
            data: newTransaction
        });

    } catch (error) {
        console.error("Error Create TRX:", error.response?.data || error.message);
        return res.status(500).json({
            status: false,
            error: "CREATE_TRANSACTION_FAILED",
            message: error.response?.data?.message || error.message || "Gagal membuat transaksi QRIS"
        });
    }
});

app.get('/transactions/:orderId', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        const { orderId } = req.params;

        const cachedData = await getCache(`trx_${orderId}`);
        if (cachedData) {
            return res.json({ data: cachedData });
        }

        let localTrx = await Transaction.findOne({ orderId });

        if (!localTrx) {
            return res.status(404).json({ 
                error: "TRANSACTION_NOT_FOUND", 
                message: "Transaksi tidak ditemukan" 
            });
        }

        if (localTrx.status.toLowerCase() === "pending" && new Date() > new Date(localTrx.expiredAt)) {
            localTrx.status = "cancelled";
            localTrx.updatedAt = new Date();
            await localTrx.save();
            scheduleTransactionDeletion(orderId);

            const resultData = {
                orderId: localTrx.orderId,
                status: "cancelled",
                amount: localTrx.amount,
                paymentNumber: localTrx.paymentNumber,
                expiredAt: localTrx.expiredAt,
                productLink: null
            };

            await setCache(`trx_${orderId}`, resultData);
            return res.json({ data: resultData });
        }

        const currentStatus = localTrx.status.toLowerCase();
        const isSuccess = ["settlement", "success", "paid", "settled"].includes(currentStatus);

        if (isSuccess && !localTrx.productLink && localTrx.itemDetails?.nama) {
            const pathProduk = path.join(__dirname, 'database', 'produk.json');
            if (fs.existsSync(pathProduk)) {
                try {
                    const products = JSON.parse(fs.readFileSync(pathProduk, 'utf8'));
                    const targetNama = localTrx.itemDetails.nama.trim().toLowerCase();
                    const matchedProduct = products.find(p => p.nama && p.nama.trim().toLowerCase() === targetNama);
                    if (matchedProduct && matchedProduct.link) {
                        localTrx.productLink = matchedProduct.link;
                        await localTrx.save();
                    }
                } catch (parseErr) {}
            }
        }

        const responseData = {
            orderId: localTrx.orderId,
            status: currentStatus,
            amount: localTrx.amount,
            paymentNumber: localTrx.paymentNumber,
            expiredAt: localTrx.expiredAt,
            productLink: isSuccess ? localTrx.productLink : null
        };

        await setCache(`trx_${orderId}`, responseData);

        res.json({
            data: responseData
        });

    } catch (error) {
        console.error("Error Status TRX:", error.message);
        const localTrx = await Transaction.findOne({ orderId: req.params.orderId });
        if (localTrx) {
            return res.json({ data: localTrx });
        }
        res.status(500).json({ 
            error: "TRANSACTION_FETCH_FAILED", 
            message: "Gagal mengambil status transaksi" 
        });
    }
});

app.post('/transactions/:orderId/cancel', async (req, res) => {
    try {
        const { orderId } = req.params;
        const localTrx = await Transaction.findOne({ orderId });

        if (!localTrx) {
            return res.status(404).json({ status: false, message: "Transaksi tidak ditemukan" });
        }

        const prevStatus = localTrx.status.toLowerCase();

        try {
            await axiosPaywuzWithRetry({
                method: 'post',
                url: `${PAYWUZ_BASE_URL}/transactions/${orderId}/cancel`,
                headers: PAYWUZ_HEADERS
            });
        } catch (err) {
            console.warn(`Paywuz cancel notice for ${orderId}:`, err.message);
        }

        if (["paid", "settlement", "success"].includes(prevStatus)) {
            if (localTrx.itemDetails && localTrx.itemDetails.nama) {
                const qtyPurchased = localTrx.itemDetails.qty || 1;
                await updateProductStockAndSold(localTrx.itemDetails.nama, qtyPurchased, true);
            }
        }

        localTrx.status = "cancelled";
        localTrx.updatedAt = new Date();
        await localTrx.save();

        await deleteCache(`trx_${orderId}`);
        scheduleTransactionDeletion(orderId);

        return res.json({
            status: true,
            data: { orderId, status: "cancelled" }
        });

    } catch (error) {
        console.error("Error Cancel TRX:", error.message);
        res.status(500).json({
            error: "CANCEL_TRANSACTION_FAILED",
            message: error.message || "Gagal membatalkan transaksi"
        });
    }
});

app.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-paywuz-signature'];
        const payloadToVerify = req.rawBody || req.body;

        const isValid = verifyPaywuzSignature(payloadToVerify, signature, PAYWUZ_API_KEY);

        if (!isValid && process.env.NODE_ENV === 'production') {
            return res.status(401).json({ 
                error: "INVALID_SIGNATURE", 
                message: "Signature webhook tidak valid!" 
            });
        }

        const payload = req.body;
        const eventName = payload?.event || payload?.type; 
        const payloadData = payload?.data || payload;
        const orderId = payloadData?.orderId;
        const status = payloadData?.status ? payloadData.status.toLowerCase() : null;

        if (!orderId) {
            return res.status(400).json({ error: "MISSING_ORDER_ID", message: "orderId tidak ada!" });
        }

        if (orderId && status) {
            let localTrx = await Transaction.findOne({ orderId });

            if (localTrx) {
                const prevStatus = localTrx.status.toLowerCase();
                localTrx.status = status;
                localTrx.updatedAt = new Date();

                const isPaidEvent = eventName === "transaction.paid" || ["paid", "settlement", "success"].includes(status);
                const isCancelEvent = ["cancelled", "failed", "expire"].includes(status);

                if (isPaidEvent && !["paid", "settlement", "success"].includes(prevStatus)) {
                    console.log(`⚡ [TRANSACTION.PAID] Order ID ${orderId} Lunas!`);

                    // 1. LOGIKA UNTUK PEMBELIAN PRODUK STORE
                    if (localTrx.itemDetails && localTrx.itemDetails.nama) {
                        const qtyPurchased = localTrx.itemDetails.qty || 1;

                        // Jika transaksi BUKAN upgrade role API Key, update stok toko biasa
                        if (!localTrx.itemDetails.nama.includes("Upgrade Role")) {
                            await updateProductStockAndSold(localTrx.itemDetails.nama, qtyPurchased, false);

                            const buyerIdentifier = getUserIdentifier(req) || localTrx.paymentNumber;
                            await recordProductBuyer(localTrx.itemDetails.nama, buyerIdentifier);
                        }
                    }

                    // 2. LOGIKA OTOMATISASI UPGRADE ROLE & API KEY USER
                    if (localTrx.itemDetails && localTrx.itemDetails.nama && localTrx.itemDetails.nama.includes("Upgrade Role")) {
                        try {
                            // Identifikasi user dari email/username/IP
                            const buyerIdentifier = getUserIdentifier(req);
                            const daysToAdd = Number(localTrx.itemDetails.qty) || 3;
                            const isVip = localTrx.itemDetails.nama.toLowerCase().includes("vip");
                            const targetRole = isVip ? "VIP User" : "Premium User";

                            let targetUser = null;

                            // Cari user berdasarkan email, username, atau ID
                            if (buyerIdentifier) {
                                targetUser = await User.findOne({
                                    $or: [
                                        { email: buyerIdentifier.toLowerCase() },
                                        { username: buyerIdentifier.toLowerCase() }
                                    ]
                                });
                            }

                            // Fallback: Jika tidak ditemukan via req, cari via session/IP jika ada
                            if (!targetUser && req.user) {
                                targetUser = await User.findById(req.user.id || req.user._id);
                            }

                            if (targetUser) {
                                // Hitung tanggal ekspirasi baru (akumulasi jika masa aktif masih berjalan)
                                let currentExpiry = (targetUser.roleExpiresAt && new Date(targetUser.roleExpiresAt) > new Date())
                                    ? new Date(targetUser.roleExpiresAt)
                                    : new Date();

                                currentExpiry.setDate(currentExpiry.getDate() + daysToAdd);

                                targetUser.role = targetRole;
                                targetUser.roleExpiresAt = currentExpiry;

                                // Generate Apikey otomatis jika belum berkesesuaian
                                if (targetRole === "Premium User") {
                                    targetUser.apikey = generatePremiumApiKey(targetUser.username);
                                } else if (targetRole === "VIP User") {
                                    if (!targetUser.apikey || targetUser.apikey.startsWith('arulzxdfree-')) {
                                        targetUser.apikey = `${targetUser.username.toLowerCase()}-custom-vip`;
                                    }
                                }

                                await targetUser.save();
                                console.log(`🎉 [UPGRADE SUCCESS] User ${targetUser.username} berhasil di-upgrade ke ${targetRole} hingga ${currentExpiry.toISOString()}`);
                            } else {
                                console.warn(`⚠️ [UPGRADE WARNING] Tidak dapat menemukan akun user untuk transaksi ${orderId}`);
                            }
                        } catch (upgradeErr) {
                            console.error("❌ Gagal memproses upgrade role user di webhook:", upgradeErr.message);
                        }
                    }

                    // Auto-fill link produk jika belum terisi
                    if (!localTrx.productLink && localTrx.itemDetails?.nama) {
                        const dbProduct = await Product.findOne({ 
                            nama: { $regex: new RegExp(`^${localTrx.itemDetails.nama.trim()}$`, 'i') } 
                        }).lean();
                        if (dbProduct) localTrx.productLink = dbProduct.link;
                    }
                } 
                else if (isCancelEvent && ["paid", "settlement", "success"].includes(prevStatus)) {
                    // Rollback stok jika transaksi toko biasa dibatalkan setelah lunas
                    if (localTrx.itemDetails && localTrx.itemDetails.nama && !localTrx.itemDetails.nama.includes("Upgrade Role")) {
                        const qtyPurchased = localTrx.itemDetails.qty || 1;
                        await updateProductStockAndSold(localTrx.itemDetails.nama, qtyPurchased, true);
                    }
                }

                await localTrx.save();
                await deleteCache(`trx_${orderId}`);

                if (["settlement", "success", "paid", "settled", "failed", "cancelled"].includes(status)) {
                    scheduleTransactionDeletion(orderId);
                }
            }
        }

        return res.status(200).json({ data: { message: "Webhook diproses dengan sukses", orderId } });

    } catch (err) {
        console.error("Webhook Error:", err);
        return res.status(500).json({ error: "WEBHOOK_PROCESSING_ERROR", message: "Error internal webhook" });
    }
});

app.post('/api/store/manual-order', async (req, res) => {
    try {
        const productName = req.body.productName;
        const qty = req.body.qty;
        const buyQty = Number(qty) || 1;

        if (!productName) {
            return res.status(400).json({ status: false, message: "Nama produk wajib diisi!" });
        }

        const updatedProduct = await updateProductStockAndSold(productName, buyQty);

        if (!updatedProduct) {
            return res.status(404).json({ status: false, message: "Produk tidak ditemukan di database." });
        }

        return res.json({
            status: true,
            message: "Stok dan jumlah terjual berhasil diperbarui secara otomatis!",
            data: updatedProduct
        });
    } catch (err) {
        console.error("Manual Order Error:", err);
        return res.status(500).json({ status: false, message: "Terjadi kesalahan server." });
    }
});

app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(new LocalStrategy({ usernameField: 'username', passwordField: 'password' }, 
    async (usernameOrEmail, password, done) => {
        try {
            const user = await User.findOne({
                $or: [
                    { username: usernameOrEmail }, 
                    { email: usernameOrEmail.toLowerCase() }
                ]
            });

            if (!user) return done(null, false, { message: 'Username atau Email tidak ditemukan.' });

            if (!user.password || user.provider !== 'local') {
                return done(null, false, { 
                    message: `Akun ini terdaftar via ${user.provider.toUpperCase()}. Silakan masuk dengan tombol ${user.provider.toUpperCase()}.` 
                });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return done(null, false, { message: 'Kata sandi salah.' });

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

function sendSweetAlert(res, icon, title, text, redirectUrl) {
    return res.send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Notification</title>
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
                body {
                    background-color: #0b0f19;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }
                .swal2-popup {
                    background: #111827 !important;
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3) !important;
                }
                .swal2-title {
                    color: #ffffff !important;
                    font-weight: 700 !important;
                }
                .swal2-html-container {
                    color: #9ca3af !important;
                }
                .swal2-confirm {
                    background: linear-gradient(to right, #0891b2, #06b6d4) !important;
                    color: #0f172a !important;
                    font-weight: 700 !important;
                    border-radius: 12px !important;
                    padding: 10px 24px !important;
                }
            </style>
        </head>
        <body>
            <script>
                Swal.fire({
                    icon: '${icon}',
                    title: '${title}',
                    text: '${text}',
                    confirmButtonText: 'OKE',
                    scrollbarPadding: false
                }).then(() => {
                    window.location = '${redirectUrl}';
                });
            </script>
        </body>
        </html>
    `);
}

// --- LOGIN ROUTE (MUREN MONGODB) ---
app.post('/auth/login', (req, res, next) => {
    passport.authenticate('local', async (err, user, info) => { 
        if (err) return next(err);

        if (!user) {
            const pesanGagal = info && info.message ? info.message : 'Username atau password salah.';
            return sendSweetAlert(res, 'error', 'Gagal Masuk', pesanGagal, '/login');
        }

        req.logIn(user, async (err) => { 
            if (err) return next(err);

            try {
                // Pastikan apikey sesuai dengan format role milik dokumen Mongo
                let needSave = false;
                const roleLower = (user.role || '').toLowerCase();

                if (roleLower.includes('vip')) {
                    if (!user.apikey) {
                        user.apikey = `${user.username.toLowerCase()}-custom-vip`;
                        needSave = true;
                    }
                } else if (roleLower.includes('premium')) {
                    if (!user.apikey || !user.apikey.includes('prem-')) {
                        user.apikey = generatePremiumApiKey(user.username);
                        needSave = true;
                    }
                } else {
                    if (!user.apikey || !user.apikey.startsWith('arulzxdfree-')) {
                        user.apikey = generateFreeApiKey();
                        needSave = true;
                    }
                }

                if (needSave) {
                    await user.save();
                }

                const userPayload = {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    name: user.username,
                    avatar: user.avatar || 'https://arulz-xd.my.id/files/X1F0Cn.png',
                    role: user.role,     
                    apikey: user.apikey   
                };

                const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

                res.cookie('auth_session', token, {
                    maxAge: 7 * 24 * 60 * 60 * 1000, 
                    httpOnly: true,
                    secure: true, 
                    sameSite: 'lax'
                });

                return res.redirect('/docs');

            } catch (error) {
                console.error("Gagal sinkronisasi data saat login:", error);
                return next(error);
            }
        });
    })(req, res, next);
});

// --- REGISTER ROUTE (MUREN MONGODB) ---
app.post('/auth/register', async (req, res) => {
    try {
        const username = req.body.username;
        const email = req.body.email;
        const password = req.body.password;

        if (!username || !email || !password) {
            return sendSweetAlert(res, 'error', 'Pendaftaran Gagal', 'Semua data wajib diisi!', '/login');
        }

        const cleanUsername = username.trim();
        const cleanEmail = email.toLowerCase().trim();

        const existingUser = await User.findOne({ 
            $or: [{ username: cleanUsername }, { email: cleanEmail }] 
        });

        if (existingUser) {
            return sendSweetAlert(res, 'warning', 'Sudah Terdaftar', 'Username atau Email sudah terdaftar!', '/login');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userRole = 'Free User';
        const userApiKey = generateFreeApiKey();

        const defaultAvatar = 'https://arulz-xd.my.id/files/X1F0Cn.png';

        const newUser = new User({
            username: cleanUsername,
            email: cleanEmail,
            password: hashedPassword,
            provider: 'local',
            role: userRole,
            apikey: userApiKey,
            avatar: defaultAvatar
        });
        await newUser.save();

        const userPayload = {
            id: newUser._id,
            username: newUser.username,
            name: newUser.username,
            avatar: defaultAvatar,
            role: newUser.role,
            apikey: newUser.apikey
        };

        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('auth_session', token, {
            maxAge: 7 * 24 * 60 * 60 * 1000, 
            httpOnly: true,
            secure: true, 
            sameSite: 'lax'
        });

        req.logIn(newUser, (err) => {
            if (err) return res.redirect('/login');
            return sendSweetAlert(res, 'success', 'Berhasil!', 'Pendaftaran berhasil! Selamat datang.', '/docs');
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Terjadi error internal saat pendaftaran.');
    }
});

app.post('/auth/forgot-password', async (req, res) => {
    try {
        const email = req.body.email;
        if (!email) {
            return sendSweetAlert(res, 'error', 'Wajib Diisi', 'Email wajib diisi!', '/login');
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return sendSweetAlert(res, 'error', 'Tidak Ditemukan', 'Email tersebut tidak terdaftar di sistem kami.', '/login');
        }

        if (user.provider !== 'local') {
            return sendSweetAlert(res, 'error', 'Metode Login OAuth', `Akun ini mendaftar via ${user.provider.toUpperCase()}, tidak memerlukan reset password.`, '/login');
        }

        const resetToken = crypto.randomBytes(20).toString('hex');

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; 
        await user.save();

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, 
            auth: {
                user: 'supportarulzxd@gmail.com',
                pass: 'matsgyapivykobdv'
            },
            tls: { rejectUnauthorized: false }
        });

        const host = req.get('host');
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const resetUrl = `${protocol}://${host}/reset-password/${resetToken}`;

        const mailOptions = {
            from: '"Support ArulzXD" <supportarulzxd@gmail.com>',
            to: user.email,
            subject: 'Permintaan Reset Kata Sandi',
            html: `
<div style="background-color: #0b0f19; padding: 40px 20px; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; min-height: 100%;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 550px; background-color: #111827; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);">
        <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; tracking-tight: -0.025em;">
                    Arulz<span style="color: #22d3ee;">XD</span> API
                </h1>
            </td>
        </tr>
        <tr>
            <td style="padding: 0 32px 24px 32px;">
                <div style="height: 1px; background: linear-gradient(to right, transparent, rgba(6, 182, 212, 0.2), transparent);"></div>
            </td>
        </tr>
        <tr>
            <td style="padding: 0 32px 32px 32px; color: #9ca3af; font-size: 14px; line-height: 24px;">
                <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 16px; font-weight: 600;">Halo ${user.username},</p>
                <p style="margin: 0 0 16px 0;">Kami menerima permintaan untuk mengatur ulang kata sandi akun ArulzXD API Anda.</p>
                <p style="margin: 0 0 24px 0;">Silakan klik tombol di bawah ini untuk membuat kata sandi baru:</p>
                
                <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    <tr>
                        <td align="center" bgcolor="#06b6d4" style="border-radius: 12px;">
                            <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 700; color: #0f172a; text-decoration: none; text-transform: uppercase; letter-spacing: 0.05em;">Reset Kata Sandi</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td style="padding: 0 32px 32px 32px; color: #6b7280; font-size: 12px; line-height: 20px;">
                <p style="margin: 0 0 12px 0; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                    <strong style="color: #ef4444;">Penting:</strong> Link ini hanya berlaku selama <span style="color: #9ca3af; font-weight: 600;">1 jam</span> demi keamanan akun Anda.
                </p>
                <p style="margin: 0;">Jika Anda tidak merasa meminta reset password ini, Anda dapat mengabaikan email ini dengan aman.</p>
            </td>
        </tr>
    </table>
</div>
`
        };

        await transporter.sendMail(mailOptions);
        return sendSweetAlert(res, 'success', 'Sukses!', 'Link reset password telah dikirim ke email Anda.', '/login');

    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal memproses lupa password.');
    }
});

app.get('/reset-password/:token', async (req, res) => {
    try {
        const user = await User.findOne({ 
            resetPasswordToken: req.params.token, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) {
            return sendSweetAlert(res, 'error', 'Link Kadaluwarsa', 'Link reset password tidak valid atau sudah kedaluwarsa. Silakan minta link baru.', '/login');
        }

        res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Buat Password Baru - ArulzXD REST API</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
            body { background-color: #0b0f19; }
            .solid-card { background: #111827; border: 1px solid rgba(255, 255, 255, 0.08); }
        </style>
    </head>
    <body class="flex flex-col items-center justify-center min-h-screen p-4 antialiased text-gray-200">
        <div class="solid-card p-8 rounded-2xl shadow-lg w-full max-w-md relative overflow-hidden">
            <div class="text-center mb-6 relative z-10">
                <h1 class="text-xl font-extrabold tracking-tight text-white mb-1">
                    Atur Ulang <span class="text-cyan-400">Kata Sandi</span>
                </h1>
                <p class="text-xs text-gray-400">Silakan masukkan kata sandi baru Anda yang aman.</p>
            </div>

            <form action="/reset-password/${req.params.token}" method="POST" class="space-y-4 relative z-10">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Password Baru</label>
                    <input id="new-password" type="password" name="password" required placeholder="••••••••" 
                        class="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-medium transition">
                </div>

                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Konfirmasi Password Baru</label>
                    <input id="confirm-password" type="password" name="confirmPassword" required placeholder="••••••••" 
                        class="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-medium transition">
                </div>

                <button type="submit" class="w-full mt-2 bg-gradient-to-r from-cyan-600 to-cyan-500 text-slate-950 font-bold py-3 rounded-xl text-sm tracking-wide uppercase">Simpan Password Baru</button>
            </form>
        </div>
    </body>
    </html>
`);

    } catch (err) {
        res.status(500).send("Error server.");
    }
});

app.post('/reset-password/:token', async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return sendSweetAlert(res, 'warning', 'Tidak Cocok', 'Password dan konfirmasi password tidak cocok!', '/login');
        }

        const user = await User.findOne({ 
            resetPasswordToken: req.params.token, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) {
            return sendSweetAlert(res, 'error', 'Gagal', 'Link reset password tidak valid atau sudah kedaluwarsa.', '/login');
        }

        user.password = await bcrypt.hash(password, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        return sendSweetAlert(res, 'success', 'Berhasil!', 'Password berhasil diubah! Silakan login dengan password baru Anda.', '/login');
    } catch (err) {
        res.status(500).send("Gagal menyimpan password baru.");
    }
});

app.get('/login', (req, res) => {
    if (req.user) {
        return res.redirect('/docs'); 
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

const GITHUB_CLIENT_ID = 'Ov23linJtLUZuyJVXpXZ';
const GITHUB_CLIENT_SECRET = '99834867b22a9f173a64b492e55d4e8f5ef9e9eb';
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || "https://arulz-xd.my.id/auth/github/callback";

const d = "613783942158";
const e = "-63q31341ivgrlulq8";
const f = "ha0m4uqmnoa6kq0";
const cl = ".apps.";
const id = "googleusercontent.com";

const GOOGLE_CLIENT_ID = `${d}${e}${f}${cl}${id}`;
const GOOGLE_CLIENT_SECRET = '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';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "https://arulz-xd.my.id/auth/google/callback";

/* ==================== ENDPOINT AUTH GITHUB ==================== */
app.get('/auth/github', (req, res) => {
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_CALLBACK_URL}&scope=user:email`;
    res.redirect(url);
});

app.get('/auth/github/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('Authentication failed: No code provided');

    try {
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code: code
        }, { headers: { accept: 'application/json' } });

        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) return res.send('Authentication failed: Invalid access token');

        const userResponse = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `token ${accessToken}` }
        });

        const userData = userResponse.data;
        let userEmail = userData.email;

        if (!userEmail) {
            try {
                const emailsResponse = await axios.get('https://api.github.com/user/emails', {
                    headers: { Authorization: `token ${accessToken}` }
                });
                const primaryEmailObj = emailsResponse.data.find(e => e.primary && e.verified) || emailsResponse.data[0];
                if (primaryEmailObj) {
                    userEmail = primaryEmailObj.email;
                }
            } catch (emailErr) {
                console.error('Gagal mengambil private email:', emailErr.message);
            }
        }

        const finalEmail = (userEmail || `${userData.login}@github.com`).toLowerCase().trim();
        const currentUsername = (userData.login || finalEmail.split('@')[0]).toLowerCase().trim();

        let dbUser = await User.findOne({ email: finalEmail });

        if (!dbUser) {
            dbUser = new User({
                username: currentUsername,
                email: finalEmail,
                provider: 'github',
                providerId: String(userData.id),
                apikey: generateFreeApiKey(),
                role: 'Free User',
                avatar: userData.avatar_url || 'https://arulz-xd.my.id/files/X1F0Cn.png'
            });

            await dbUser.save();
        } else {
            if (userData.avatar_url && dbUser.avatar !== userData.avatar_url) {
                dbUser.avatar = userData.avatar_url;
                await dbUser.save();
            }
        }

        const userPayload = {
            id: dbUser._id,
            username: dbUser.username,
            email: dbUser.email,
            name: userData.name || dbUser.username,
            avatar: dbUser.avatar,
            role: dbUser.role,
            apikey: dbUser.apikey
        };

        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('auth_session', token, {
            maxAge: 7 * 24 * 60 * 60 * 1000, 
            httpOnly: true,
            secure: true, 
            sameSite: 'lax'
        });

        res.redirect('/docs?showProfile=true');
    } catch (error) {
        console.error(error);
        res.send('Login Error: ' + error.message);
    }
});

/* ==================== ENDPOINT AUTH GOOGLE ==================== */
app.get('/auth/google', (req, res) => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_CALLBACK_URL}&response_type=code&scope=profile email`;
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('Authentication failed: No code provided');

    try {
        // Konversi payload ke format application/x-www-form-urlencoded
        const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: GOOGLE_CALLBACK_URL
        });

        const tokenResponse = await axios.post(
            'https://oauth2.googleapis.com/token',
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userData = userResponse.data;
        const email = userData.email.toLowerCase().trim();
        const currentUsername = (userData.login || email.split('@')[0]).toLowerCase().trim();

        let dbUser = await User.findOne({ email: email });

        if (!dbUser) {
            dbUser = new User({
                username: currentUsername,
                email: email,
                provider: 'google',
                providerId: String(userData.id),
                apikey: generateFreeApiKey(),
                role: 'Free User',
                avatar: userData.picture || 'https://arulz-xd.my.id/files/X1F0Cn.png'
            });

            await dbUser.save();
        } else {
            if (userData.picture && dbUser.avatar !== userData.picture) {
                dbUser.avatar = userData.picture;
                await dbUser.save();
            }
        }

        const userPayload = {
            id: dbUser._id,
            username: dbUser.username,
            email: dbUser.email,
            name: userData.name || dbUser.username,
            avatar: dbUser.avatar,
            role: dbUser.role,
            apikey: dbUser.apikey
        };

        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('auth_session', token, {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: true,
            sameSite: 'lax'
        });

        res.redirect('/docs?showProfile=true');
    } catch (error) {
        console.error('Google Auth Callback Error:', error.response?.data || error.message);
        res.send('Login Error: ' + (error.response?.data?.error_description || error.message));
    }
});

app.get('/api/user-status', async (req, res) => {
    if (req.user) {
        try {
            const freshUser = await User.findById(req.user.id || req.user._id);
            const activeUser = freshUser || req.user;

            res.json({
                loggedIn: true,
                user: {
                    name: activeUser.username,
                    username: activeUser.username,
                    email: activeUser.email,
                    avatar: activeUser.avatar,
                    apikey: activeUser.apikey,
                    role: activeUser.role
                }
            });
        } catch (err) {
            res.json({
                loggedIn: true,
                user: {
                    name: req.user.name || req.user.username,
                    username: req.user.username,
                    email: req.user.email,
                    avatar: req.user.avatar,
                    apikey: req.user.apikey,
                    role: req.user.role
                }
            });
        }
    } else {
        res.json({ loggedIn: false });
    }
});

app.get('/auth/logout', (req, res, next) => {
    res.clearCookie('auth_session');
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/docs');
    });
});

const playlist = require('./database/playlist');

const localFileUploader = fileUpload({
    createParentPath: true,
    limits: { fileSize: 100 * 1024 * 1024 }, 
});

const repoList = ['uploadergh', 'uploaderghv2', 'uploaderghv3'];
const a = 'g';
const b = 'h';
const c = 'p';
const to = '_WaSUBUjo7g3YcCcyo'; 
const ken = 'OgBEWRKS16qYr1C8Gyg'; 
const githubToken = `${a}${b}${c}${to}${ken}`;
const owner = 'arulzzzxd'; 
const branch = 'main';

const getRandomRepo = () => repoList[Math.floor(Math.random() * repoList.length)];

function getApiKeyType(user) {
    if (!user || !user.role) return 'free';
    const role = user.role.toLowerCase();
    if (role.includes('vip')) return 'vip';
    if (role.includes('premium')) return 'premium';
    return 'free';
}

function getUserMaxLimit(keyType) {
    if (keyType === 'vip') return Infinity;
    if (keyType === 'premium') return 1000;
    return 100;
}

async function getOrResetUserLimit(user) {
    if (!user) return { limitUsed: 0, maxLimit: 100, keyType: 'free' };

    const keyType = getApiKeyType(user);
    const maxLimit = getUserMaxLimit(keyType);

    if (keyType === 'vip') {
        return { limitUsed: 0, maxLimit: "Unlimited", keyType };
    }

    const now = new Date();
    const lastReset = user.lastLimitReset ? new Date(user.lastLimitReset) : new Date(0);

    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const lastResetStr = lastReset.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    if (todayStr !== lastResetStr) {
        user.limit = 0;
        user.lastLimitReset = now;

        await User.findByIdAndUpdate(user._id, { 
            $set: { 
                limit: 0, 
                lastLimitReset: now 
            } 
        });
    }

    return { limitUsed: user.limit || 0, maxLimit, keyType };
}

app.get('/api/user-limit', checkAuthSession, async (req, res) => {
    let userKey = req.query.apikey || req.headers['x-api-key'];

    if (!userKey && req.user) {
        userKey = req.user.apikey;
    }

    if (!userKey) {
        return res.json({ loggedIn: false, limitUsed: 0, maxLimit: 100, type: 'free' });
    }

    try {
        const user = await User.findOne({ apikey: userKey });
        if (!user) {
            return res.json({ loggedIn: false, limitUsed: 0, maxLimit: 100, type: 'free' });
        }

        const { limitUsed, maxLimit, keyType } = await getOrResetUserLimit(user);

        return res.json({
            loggedIn: !!req.user,
            limitUsed: limitUsed,
            maxLimit: maxLimit === Infinity ? "Unlimited" : maxLimit,
            type: keyType
        });
    } catch (err) {
        console.error("Error fetching user limit:", err);
        return res.status(500).json({ status: false, message: "Server Error" });
    }
});

const getLimitMessage = (keyType, limitCount) => {
    if (keyType === 'premium') {
        return `Limit API Key Premium Anda telah habis (Maks ${limitCount} req/hari). Silakan upgrade ke paket VIP untuk menikmati akses Unlimited tanpa batasan limit!`;
    }

    return `Limit API Key Free Anda telah habis (Maks ${limitCount} req/hari). Silakan upgrade ke paket Premium (1.000 req/hari) atau VIP (Unlimited) untuk melanjutkan!`;
};

const apiKeyUserCache = new Map();
const validateApiKey = async (req, res, next) => {
    if (req.path === '/apilist') return next();

    let userKey = req.query.apikey || req.body?.apikey || req.files?.apikey || req.file?.apikey || req.headers['x-api-key'];

    if (!userKey && req.user && req.user.apikey) {
        userKey = req.user.apikey;
    }

    if (!userKey) {
        return res.status(403).json({
            status: false,
            creator: "Arulz-XD",
            message: "API Key mana? masukkan parameter ?apikey=MasukkanApiKey"
        });
    }

    let callerUser = req.user || null;

    if (!callerUser) {
        const cachedUser = apiKeyUserCache.get(userKey);
        if (cachedUser && (Date.now() - cachedUser.timestamp < 300000)) { 
            callerUser = cachedUser.data;
        } else {
            try {
                callerUser = await User.findOne({ apikey: userKey }).lean();
                if (callerUser) {
                    apiKeyUserCache.set(userKey, { data: callerUser, timestamp: Date.now() });
                }
            } catch (dbErr) {
                return res.status(500).json({ status: false, message: "Internal server error." });
            }
        }
    }

    if (!callerUser) {
        return res.status(403).json({
            status: false,
            creator: "Arulz-XD",
            message: "API Key salah atau tidak terdaftar!"
        });
    }

    req.user = callerUser;
    req.activeApiKey = userKey;

    let finalRole = (callerUser.role || 'Free User').toLowerCase();

    const pathParts = req.path.split('/');
    const routeKey = `${pathParts[1]}/${pathParts[2]}`;
    const routeModule = routeModuleCache.get(routeKey);

    if (routeModule) {
        if (routeModule.status === "error" || routeModule.status === "perbaikan") {
            return res.status(503).json({
                status: false,
                creator: "Arulz-XD",
                message: "Fitur ini sedang dalam perbaikan / maintenance!"
            });
        }

        if (routeModule.type === "premium" && !finalRole.includes("premium") && !finalRole.includes("vip")) {
            return res.status(403).json({
                status: false,
                creator: "Arulz-XD",
                message: "Endpoint ini khusus pengguna Premium!"
            });
        }

        if (routeModule.type === "vip" && !finalRole.includes("vip")) {
            return res.status(403).json({
                status: false,
                creator: "Arulz-XD",
                message: "Endpoint eksklusif ini khusus pengguna VIP!"
            });
        }
    }

    next();
};

const trackAndEnforceLimit = async (req, res, next) => {
    if (req.path === '/apilist') return next();

    const userKey = req.activeApiKey || req.query.apikey || req.body?.apikey || req.headers['x-api-key'];
    if (!userKey) return next();

    try {
        const user = await User.findOne({ apikey: userKey });
        if (!user) return next();

        const { limitUsed, maxLimit, keyType } = await getOrResetUserLimit(user);

        if (keyType === 'vip') return next();

        if (limitUsed >= maxLimit) {
            return res.status(429).json({
                status: false,
                creator: "ArulzXD",
                message: getLimitMessage(keyType, maxLimit)
            });
        }

        await User.findByIdAndUpdate(user._id, { $inc: { limit: 1 } });

        next();
    } catch (err) {
        console.error("Error tracking limit:", err);
        next();
    }
};

const apiKeyLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, 
    keyGenerator: (req) => {
        return req.activeApiKey || req.query.apikey || req.body?.apikey || req.headers['x-api-key'] || req.ip; 
    },
    validate: {
        keyGeneratorIpFallback: false
    },
    skip: (req, res) => {
        return getApiKeyType(req.user) === 'vip';
    },
    max: (req, res) => {
        const keyType = getApiKeyType(req.user);
        if (keyType === 'premium') return 1000;
        return 100; 
    },
    handler: (req, res) => {
        const keyType = getApiKeyType(req.user);
        const limitCount = keyType === 'premium' ? 1000 : 100;

        res.status(429).json({
            status: false,
            creator: "ArulzXD",
            message: getLimitMessage(keyType, limitCount)
        });
    },
    standardHeaders: true, 
    legacyHeaders: false,
});

app.post('/api/feedback', async (req, res) => {
    const email = req.body.email;     
    const type = req.body.type;       
    const message = req.body.message;   

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ status: false, message: "Format email tidak valid!" });
    }

    if (!type) {
        return res.status(400).json({ status: false, message: "Tipe laporan wajib dipilih!" });
    }

    if (!message) {
        return res.status(400).json({ status: false, message: "Isi pesan tidak boleh kosong!" });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, 
            auth: {
                user: 'supportarulzxd@gmail.com',
                pass: 'matsgyapivykobdv' 
            },
            tls: {
                rejectUnauthorized: false 
            }
        });

        let kategoriTeks = 'Laporan Bug';
        let categoryColor = '#ef4444';

        switch (type) {
            case 'suggestion':
                kategoriTeks = 'Saran / Fitur Baru';
                categoryColor = '#f59e0b';
                break;
            case 'question':
                kategoriTeks = 'Pertanyaan Umum';
                categoryColor = '#06b6d4';
                break;
            case 'other':
                kategoriTeks = 'Lainnya';
                categoryColor = '#8b5cf6';
                break;
            default:
                kategoriTeks = 'Laporan Bug / Error';
                categoryColor = '#ef4444';
        }

        const adminMailOptions = {
            from: `"${email}" <supportarulzxd@gmail.com>`, 
            to: 'supportarulzxd@gmail.com', 
            replyTo: email, 
            subject: `[${type.toUpperCase()}] Feedback Baru dari Dashboard API`,
            html: `
            <div style="background-color: #030712; padding: 40px 15px; font-family: 'Poppins', -apple-system, sans-serif; color: #f3f4f6;">
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #0b0f17; border-radius: 20px; border: 1px solid rgba(6, 182, 212, 0.3); box-shadow: 0 0 35px rgba(6, 182, 212, 0.15); overflow: hidden;">
                    <tr>
                        <td style="padding: 30px 30px 20px 30px; text-align: center; background: linear-gradient(180deg, rgba(6, 182, 212, 0.12) 0%, transparent 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff;">
                                ARULZ<span style="color: #22d3ee;">XD</span> <span style="font-size: 14px; font-family: monospace; color: #64748b;">v2.0</span>
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px;">
                            <div style="text-align: center; margin-bottom: 25px;">
                                <div style="display: inline-block; padding: 6px 16px; background-color: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 50px;">
                                    <span style="color: #22d3ee; font-size: 11px; font-family: monospace; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">
                                        ⚡ NEW FEEDBACK TRANSMISSION
                                    </span>
                                </div>
                            </div>
                            <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 20px 0;">
                                Halo Admin <strong style="color: #ffffff;">ArulzXD</strong>, sistem menerima laporan baru dari pengguna:
                            </p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #020617; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; margin-bottom: 20px;">
                                <tr>
                                    <td style="padding: 14px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: #64748b; font-family: monospace;">EMAIL PENGIRIM</td>
                                    <td style="padding: 14px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 13px; color: #22d3ee; font-family: monospace; text-align: right; font-weight: 600;">${email}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 14px 18px; font-size: 12px; color: #64748b; font-family: monospace;">KATEGORI</td>
                                    <td style="padding: 14px 18px; font-size: 12px; text-align: right; font-weight: 700;">
                                        <span style="color: ${categoryColor}; background-color: rgba(255, 255, 255, 0.05); padding: 4px 10px; border-radius: 6px; border: 1px solid ${categoryColor}40;">${kategoriTeks}</span>
                                    </td>
                                </tr>
                            </table>
                            <div style="background-color: #020617; border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 12px; padding: 20px;">
                                <div style="font-size: 10px; font-family: monospace; color: #06b6d4; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; font-weight: 700;">// LOG_MESSAGE_PAYLOAD</div>
                                <p style="margin: 0; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 13px; color: #e2e8f0; white-space: pre-wrap; line-height: 1.7;">${message}</p>
                            </div>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="mailto:${email}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%); color: #020617; font-weight: 800; font-size: 12px; text-decoration: none; border-radius: 10px; text-transform: uppercase; letter-spacing: 1px;">Balas Email Pengguna</a>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 30px; background-color: #020617; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
                            <p style="font-size: 11px; color: #64748b; margin: 0;">© 2026 Api ArulzXD. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </div>
            `
        };

        const userMailOptions = {
            from: '"Support ArulzXD" <supportarulzxd@gmail.com>', 
            to: email, 
            subject: `[Received] Terima Kasih atas Feedback Anda - API-ARULZXD`,
            html: `
            <div style="background-color: #030712; padding: 40px 15px; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f3f4f6;">
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #0b0f17; border-radius: 20px; border: 1px solid rgba(6, 182, 212, 0.3); box-shadow: 0 0 35px rgba(6, 182, 212, 0.15); overflow: hidden;">
                    <tr>
                        <td style="padding: 30px 30px 20px 30px; text-align: center; background: linear-gradient(180deg, rgba(6, 182, 212, 0.12) 0%, transparent 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.025em; color: #ffffff;">
                                ARULZ<span style="color: #22d3ee; text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);">XD</span> <span style="font-size: 14px; font-family: monospace; color: #64748b; font-weight: 400;">API</span>
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px;">
                            <div style="text-align: center; margin-bottom: 25px;">
                                <div style="display: inline-block; padding: 6px 16px; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 50px;">
                                    <span style="color: #34d399; font-size: 11px; font-family: monospace; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">
                                        ✔ TRANSMISSION CONFIRMED
                                    </span>
                                </div>
                            </div>
                            <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 700; color: #ffffff; text-align: center;">
                                Halo, Agen Developer! 👋
                            </h2>
                            <p style="font-size: 14px; color: #94a3b8; line-height: 1.7; text-align: center; margin: 0 0 25px 0;">
                                Terima kasih telah menghubungi kami. Laporan/masukan Anda telah <strong style="color: #22d3ee;">berhasil diterima</strong> oleh server dan telah diteruskan ke tim pengembang kami untuk segera ditinjau.
                            </p>
                            <div style="background-color: #020617; border: 1px solid rgba(6, 182, 212, 0.15); border-radius: 14px; padding: 20px; margin-bottom: 25px;">
                                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 10px; margin-bottom: 12px; font-size: 12px;">
                                    <span style="color: #64748b; font-family: monospace;">TIPE TRANSMISI:</span>
                                    <span style="color: ${categoryColor}; font-weight: 700; font-family: monospace;">${kategoriTeks.toUpperCase()}</span>
                                </div>
                                <div style="font-size: 10px; font-family: monospace; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">// SALINAN_PESAN_ANDA</div>
                                <p style="margin: 0; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 13px; color: #cbd5e1; white-space: pre-wrap; line-height: 1.6;">${message}</p>
                            </div>
                            <div style="background-color: rgba(6, 182, 212, 0.05); border-left: 3px solid #06b6d4; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 30px;">
                                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                                    📌 <strong style="color: #ffffff;">Catatan:</strong> Tim kami biasanya memproses dan membalas masukan dalam kurun waktu <span style="color: #22d3ee;">1x24 jam</span>. Pengguna paket Premium/VIP akan diprioritaskan.
                                </p>
                            </div>
                            <div style="text-align: center;">
                                <a href="https://arulz-xd.my.id/doc" style="display: inline-block; padding: 12px 24px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(6, 182, 212, 0.3); color: #22d3ee; font-weight: 700; font-size: 12px; text-decoration: none; border-radius: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 5px 10px 5px;">
                                    Lihat Dokumentasi
                                </a>
                                <a href="https://arulz-xd.my.id" style="display: inline-block; padding: 12px 24px; background: linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%); color: #020617; font-weight: 800; font-size: 12px; text-decoration: none; border-radius: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 5px 10px 5px; box-shadow: 0 4px 15px rgba(6, 182, 212, 0.2);">
                                    Kembali ke Dashboard
                                </a>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 30px; background-color: #020617; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
                            <p style="font-size: 11px; color: #475569; margin: 0 0 8px 0; font-family: monospace;">
                                EMAIL AUTOMATED RESPONSE | DO NOT REPLY DIRECTLY TO THIS EMAIL
                            </p>
                            <p style="font-size: 11px; color: #64748b; margin: 0;">
                                © 2026 <a href="https://arulz-xd.my.id" style="color: #22d3ee; text-decoration: none;">Api ArulzXD</a>. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </div>
            `
        };

        await Promise.all([
            transporter.sendMail(adminMailOptions),
            transporter.sendMail(userMailOptions)
        ]);

        res.json({ 
            status: true, 
            message: "Feedback berhasil dikirim ke admin & email konfirmasi balasan telah dikirim ke pengguna!" 
        });

    } catch (error) {
        console.error("Gagal mengirim email feedback:", error);
        res.status(500).json({ 
            status: false, 
            message: "Terjadi kesalahan pada sistem pengiriman email." 
        });
    }
});

app.get('/database/download', async (req, res) => {
    const imageUrl = req.query.url || "https://arulz-uploader.vercel.app/files/CVmlrD.jpg";

    try {
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'stream' 
        });

        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="QRIS_Arulz_XD.jpg"');
        res.setHeader('Access-Control-Allow-Origin', '*'); 

        response.data.pipe(res);
    } catch (error) {
        console.error('Gagal memproses unduhan QRIS:', error.message);
        res.status(500).json({ error: "Gagal memproses unduhan otomatis di tingkat backend." });
    }
});

app.get('/uploader', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'uploader.html'));
});

app.get('/feedback', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'feedback.html'));
});

app.get('/pastecode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pastecode.html'));
});

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/support', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'support.html'));
});

function getRequestProtocol(req) {
  const forwarded = req.headers['x-forwarded-proto'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.secure ? 'https' : 'http';
}

function generateId(length = 6) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

app.get('/files/*', async (req, res) => {
  const requestedPath = req.params[0]; 
  if (!requestedPath) return res.status(400).send('Missing file path');

  const gitPath = requestedPath.startsWith('uploads/') ? requestedPath : `uploads/${requestedPath}`;
  const shuffledRepos = [...repoList].sort(() => Math.random() - 0.5);

  for (const targetRepo of shuffledRepos) {
    try {
      const resp = await axios.get(`https://api.github.com/repos/${owner}/${targetRepo}/contents/${gitPath}?ref=${branch}`, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3.raw'
        },
        responseType: 'arraybuffer',
        validateStatus: status => status < 500
      });

      if (resp.status === 200) {
        const contentType = mime.lookup(requestedPath) || 'application/octet-stream';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(Buffer.from(resp.data));
      }
    } catch (error) {
      console.error(`Gagal cek di repo ${targetRepo}:`, error.message);
    }
  }

  return res.status(404).send('File tidak ditemukan di seluruh GitHub Repository');
});

app.post('/uploadfile', localFileUploader, async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('Tidak ada file yang diunggah.');
  }

  let uploadedFile = req.files.file;
  const originalName = uploadedFile.name || 'file';
  const origExt = path.extname(originalName);

  let extension = origExt ? origExt.replace(/^\./, '') : (mime.extension(uploadedFile.mimetype) || 'bin');
  let id = generateId(6);
  let fileName = origExt ? `${id}${origExt}` : `${id}.${extension}`;
  let gitPath = `uploads/${fileName}`;
  let base64Content = Buffer.from(uploadedFile.data).toString('base64');

  const selectedRepo = getRandomRepo(); 

  try {
    await axios.put(`https://api.github.com/repos/${owner}/${selectedRepo}/contents/${gitPath}`, {
      message: `Upload file ${fileName} to ${selectedRepo}`,
      content: base64Content,
      branch: branch,
    }, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
      },
    });

    const protocol = getRequestProtocol(req);
    const baseWebUrl = process.env.BASE_URL || `${protocol}://${req.get('host')}`;
    const rawUrl = `${baseWebUrl}/files/${fileName}`;

    res.send(`
      <!DOCTYPE html>
      <html lang="id" class="dark">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Unggahan Berhasil</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <script>
              tailwind.config = {
                  darkMode: 'class',
                  theme: { 
                      extend: {
                          fontFamily: {
                              sans: ['Plus Jakarta Sans', 'sans-serif'],
                          }
                      } 
                  }
              }
          </script>
          <style>
              body { 
                  background-color: #0b0f19; 
                  color: #f3f4f6;
              }
              .solid-card {
                  background: #111827;
                  border: 1px solid rgba(255, 255, 255, 0.07);
              }
              .url-box {
                  background: rgba(0, 0, 0, 0.25);
                  border: 1px solid rgba(255, 255, 255, 0.05);
              }
              .checkmark-circle {
                  background: rgba(16, 185, 129, 0.06);
                  border: 1px solid rgba(16, 185, 129, 0.2);
              }
          </style>
      </head>
      <body class="flex flex-col items-center justify-center min-h-screen p-4 antialiased">
          <div class="solid-card p-7 rounded-2xl shadow-xl w-full max-w-md text-center">
              <div class="mb-5 flex justify-center">
                  <div class="checkmark-circle w-16 h-16 rounded-full flex items-center justify-center text-emerald-400">
                      <svg class="w-8 h-8 flex items-center justify-center" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" style="display: block;">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
                      </svg>
                  </div>
              </div>
              <h1 class="text-xl font-extrabold mb-1.5 tracking-tight text-white">Unggahan Berhasil!</h1>
              <p class="mb-5 text-xs text-gray-400">Berkas Anda telah aktif di cloud server:</p>
              <div class="url-box p-3.5 rounded-xl break-all mb-6">
                  <a id="rawUrl" href="${rawUrl}" target="_blank" class="text-cyan-400 hover:text-cyan-300 font-mono text-xs font-semibold transition-colors">${rawUrl}</a>
              </div>
              <div class="flex space-x-3">
                  <button onclick="copyToClipboard()" class="flex-1 bg-zinc-800/80 hover:bg-zinc-700 text-gray-200 text-xs font-bold py-3 px-4 rounded-xl transition duration-200 border border-white/5">
                      Salin URL
                  </button>
                  <a href="/uploader" class="flex-1 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition duration-200 block text-center">
                      Kembali
                  </a>
              </div>
          </div>
          <div id="toast" class="fixed bottom-5 bg-emerald-600/90 backdrop-blur-md text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-lg opacity-0 invisible transition-all duration-300 tracking-wide">
              URL Berhasil disalin ke papan klip!
          </div>
          <script>
              function copyToClipboard() {
                  const urlText = document.getElementById('rawUrl').href;
                  navigator.clipboard.writeText(urlText).then(() => {
                      const toast = document.getElementById('toast');
                      toast.classList.remove('opacity-0', 'invisible');
                      toast.classList.add('opacity-100', 'visible');
                      setTimeout(() => {
                          toast.classList.remove('opacity-100', 'visible');
                          toast.classList.add('opacity-0', 'invisible');
                      }, 2500);
                  });
              }
          </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error uploading file.');
  }
});

const routeModuleCache = new Map();
const router = express.Router();
const apiPath = path.join(__dirname, 'api');

router.use(validateApiKey);

const endpointDirs = fs.readdirSync(apiPath).filter(f => fs.statSync(path.join(apiPath, f)).isDirectory());

for (const category of endpointDirs) {
  const categoryPath = path.join(apiPath, category);
  const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const routeName = path.basename(file, '.js');
    const routeFilePath = path.join(categoryPath, file);

    const route = require(routeFilePath);
    const routeKey = `${category}/${routeName}`;
    routeModuleCache.set(routeKey, route);

    router.use(`/${category}/${routeName}`, route);
  }
}

function formatEndpointTitle(filename) {
  const cleanName = filename.replace(/\.js$/, "").replace(/[-_]/g, " ");
  return cleanName
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getEndpointsFromRouter(category, file) {
  const endpoints = [];
  const routePath = path.join(apiPath, category, file);

  let route;
  try {
    route = require(routePath);
  } catch (e) {
    console.error(`Gagal memuat berkas rute: ${routePath}`, e);
    return endpoints;
  }

  const subRouter = route.stack ? route : route.router || route;
  if (!subRouter || !subRouter.stack) return endpoints;

  // Gunakan route.title / route.name jika ada, atau buat Title Case dari nama file
  const endpointTitle = route.title || (route.name && route.name !== 'router' ? route.name : formatEndpointTitle(file));
  const routeDesc = route.desc || subRouter.desc || `/${category}/${file.replace(/\.js$/, "")}`;

  subRouter.stack.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());

      let params = { apikey: "" }; 

      if (route.paramsConfig) {
        params = { apikey: "", ...route.paramsConfig };
      } 
      else if (layer.route.stack && layer.route.stack.length) {
        layer.route.stack.forEach(mw => {
          if (!mw.handle) return;
          const fnString = mw.handle.toString();

          [...fnString.matchAll(/req\.query\.([a-zA-Z0-9_]+)/g)].forEach(match => {
            params[match[1]] = "";
          });

          [...fnString.matchAll(/req\.body\.([a-zA-Z0-9_]+)/g)].forEach(match => {
            params[match[1]] = "";
          });
        });
      }

      if (methods.some(m => ["POST", "PUT", "PATCH"].includes(m)) && Object.keys(params).length <= 1) {
        params.fileToUpload = "file";
      }

      endpoints.push({
        name: endpointTitle, // Misal: "Aio Downloader" / "Capcut"
        path: `/api/${category}/${file.replace(/\.js$/, "")}`, // Misal: "/api/download/capcut"
        desc: routeDesc,
        status: route.status || "ready",
        type: route.type || "free",
        params,
        methods
      });
    }
  });
  return endpoints;
}

router.get('/apilist', (req, res) => {
  const categories = [];

  for (const category of endpointDirs) {
    const files = fs.readdirSync(path.join(apiPath, category)).filter(f => f.endsWith('.js'));
    const endpoints = [];
    for (const file of files) {
      endpoints.push(...getEndpointsFromRouter(category, file));
    }
    if (endpoints.length) {
      categories.push({
        name: `${category.toUpperCase()}`,
        items: endpoints
      });
    }
  }

  categories.push({
    name: "OTHER",
    items: [
      {
        name: "/apilist",
        path: "/api/apilist",
        desc: "/apilist",
        status: "ready",
        type: "free",
        params: { apikey: "" },
        methods: ["GET"]
      }
    ]
  });

  res.json({ categories });
});

app.get('/api/server-status', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);

    const cpus = os.cpus();
    const loadAvg = os.loadavg(); 

    res.json({
        platform: os.platform(),
        architecture: os.arch(),
        uptime: os.uptime(), 
        totalMemory: (totalMem / (1024 * 1024 * 1024)).toFixed(2) + " GB",
        usedMemory: (usedMem / (1024 * 1024 * 1024)).toFixed(2) + " GB",
        freeMemory: (freeMem / (1024 * 1024 * 1024)).toFixed(2) + " GB",
        memoryUsagePercent: memUsagePercent,
        cpuModel: cpus[0].model,
        cpuSpeed: cpus[0].speed + " MHz",
        cpuCores: cpus.length,
        loadAverage: loadAvg
    });
});

const apiLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    apikey: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    log: [{
        method: { type: String, required: true },
        endpoint: { type: String, required: true },
        status_code: { type: Number, required: true },
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now, expires: '7d' } 
});

const ApiLog = mongoose.models.ApiLog || mongoose.model('ApiLog', apiLogSchema);

const logApiActivity = async (req, res, next) => {
    res.on('finish', async () => {
        const userKey = req.activeApiKey 
                     || req.query?.apikey 
                     || req.body?.apikey 
                     || req.headers['x-api-key'] 
                     || (req.user ? (req.user.apikey) : null);

        const fullEndpoint = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;

        if (
            userKey && 
            fullEndpoint.startsWith('/api/') && 
            fullEndpoint !== '/api/user-activity' && 
            fullEndpoint !== '/api/user-limit' && 
            fullEndpoint !== '/api/apilist'
        ) {
            try {
                let targetUser = req.user;

                if (!targetUser) {
                    targetUser = await User.findOne({ apikey: userKey.trim() }).lean();
                }

                if (!targetUser) return;

                const userId = targetUser._id || targetUser.id;
                const username = targetUser.username || 'User';
                const email = targetUser.email || '';

                const newLogItem = {
                    method: req.method,
                    endpoint: fullEndpoint,
                    status_code: res.statusCode,
                    createdAt: new Date()
                };

                await ApiLog.findOneAndUpdate(
                    { userId: userId },
                    { 
                        $set: { 
                            apikey: userKey.trim(),
                            username: username,
                            email: email
                        },
                        $push: { 
                            log: { 
                                $each: [newLogItem], 
                                $position: 0,
                            } 
                        }
                    },
                    { upsert: true, new: true }
                );

                console.log(`✅ [LOG MONGO] Local/Session User: ${username} | Path: ${fullEndpoint}`);
            } catch (err) {
                console.error("❌ Gagal simpan log ke MongoDB:", err.message);
            }
        }
    });
    next();
};

app.get('/api/user-activity', async (req, res) => {
    try {
        let userId = null;

        if (req.user) {
            userId = req.user._id || req.user.id;
        } else {
            const userKey = req.query?.apikey || req.headers['x-api-key'];
            if (userKey) {
                const foundUser = await User.findOne({ apikey: userKey.trim() }).lean();
                if (foundUser) userId = foundUser._id;
            }
        }

        if (!userId) {
            return res.json({ status: true, data: [] });
        }

        const userLogDoc = await ApiLog.findOne({ userId: userId }).lean();

        if (!userLogDoc || !userLogDoc.log || userLogDoc.log.length === 0) {
            return res.json({ status: true, data: [] });
        }

        const filteredLogs = userLogDoc.log
             .filter(item => item.endpoint !== '/api/apilist')
             .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const formattedLogs = filteredLogs.map(item => {
            const date = new Date(item.createdAt || Date.now());
            const timeStr = date.toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false,
                timeZone: 'Asia/Jakarta'
            });
            const statusStr = item.status_code >= 200 && item.status_code < 300 ? 'OK' : 'ERR';

            return `[${timeStr}] [${statusStr}] [${item.method}] : ${item.endpoint}`;
        });

        return res.json({ status: true, data: formattedLogs });
    } catch (err) {
        console.error("Error fetching logs from MongoDB:", err.message);
        return res.status(500).json({ status: false, data: [] });
    }
});

app.use('/api', validateApiKey, trackAndEnforceLimit, apiKeyLimiter, logApiActivity, router);

app.get('/script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'styles.css'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html')); 
});

app.get('/upgrade-apikey', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'upgrade-apikey.html')); 
});

app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'status.html'));
});

app.get('/database/produk', async (req, res) => {
    try {
        const produk = await Product.find({}).sort({ createdAt: -1 });
        res.json(produk);
    } catch (err) {
        console.error("Gagal mengambil data produk dari MongoDB:", err);
        res.status(500).json({ error: "Gagal memuat data produk" });
    }
});

app.get('/store', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'store.html'));
});

app.get('/store/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const product = await Product.findOne({ Id: productId });

        const storePath = path.join(__dirname, 'public', 'store.html');
        let htmlContent = fs.readFileSync(storePath, 'utf8');

        if (product) {
            const hargaFormatted = product.harga_diskon 
                ? `Rp ${product.harga_diskon.toLocaleString('id-ID')}` 
                : `Rp ${product.harga.toLocaleString('id-ID')}`;

            const deskripsiClean = product.deskripsi ? product.deskripsi.slice(0, 150) : '';

            const metaTags = `
    <!-- Open Graph / Meta Tags Dinamis -->
    <meta property="og:title" content="${product.nama} - ArulzXD Store" />
    <meta property="og:description" content="${deskripsiClean}... | Harga: ${hargaFormatted}" />
    <meta property="og:image" content="${product.gambar}" />
    <meta property="og:url" content="https://arulz-xd.my.id/store/${product.Id}" />
    <meta property="og:type" content="product" />
    <meta name="twitter:card" content="summary_large_image" />
            `;

            htmlContent = htmlContent.replace('<head>', `<head>${metaTags}`);
        }

        res.send(htmlContent);
    } catch (error) {
        console.error('Error serving product page:', error);
        res.sendFile(path.join(__dirname, 'public', 'store.html'));
    }
});

app.get('/changelog', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'changelog.html'));
});

app.get('/database/changelog', (req, res) => {
    const pathChangelog = path.join(__dirname, 'database', 'changelog.json'); 

    fs.readFile(pathChangelog, 'utf8', (err, data) => {
        if (err) {
            console.error("Gagal membaca database changelog:", err);
            return res.status(500).json({ error: "Gagal memuat data changelog" });
        }
        try {
            const changelogData = JSON.parse(data);
            res.json(changelogData);
        } catch (parseError) {
            res.status(500).json({ error: "Format database changelog rusak" });
        }
    });
});

app.get('/docs', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="id" class="notranslate" translate="no">
<head>
    <meta charset="UTF-8" />
    <meta name="google" content="notranslate" />
    <!-- Mencegah zoom di HP / Touch Screen -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>Arulzxd API - Documentation</title>
    <link rel="icon" href="https://arulz-xd.my.id/files/Q2C70y.png" type="image/png">
    
    <!-- Tailwind CSS, SweetAlert2, Google Fonts, & FontAwesome -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="styles.css" />
    
    <style>
        :root {
            --bg-cream: #FAF7EF;
            --card-bg: #FFFDF8;
            
            /* Variabel Warna Tema & Outline Dinamis */
            --theme-border: #a16207;
            --theme-accent: #fde047;
            --theme-text: #121212;
            --theme-light: #fef9c3;
            --rgb-angle: 0deg;
        }

        * {
            box-sizing: border-box;
        }

        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            min-height: 100vh;
            touch-action: pan-x pan-y;
            background-color: var(--bg-cream) !important;
            color: #121212 !important;
            background-image: radial-gradient(rgba(0, 0, 0, 0.12) 1.2px, transparent 1.2px) !important;
            background-size: 16px 16px !important;
            font-family: 'Plus Jakarta Sans', sans-serif !important;
            overflow-x: hidden;
        }

        .code-font {
            font-family: 'JetBrains Mono', monospace !important;
        }

        /* Penerapan Outline / Border Dinamis Sesuai Warna Tema */
        .brutal-border,
        .light-card,
        .dropdown-nav-card,
        .btn-brutalism-light,
        .stat-box,
        .light-popup-bg,
        .light-card-box,
        header,
        #bioDropdown,
        #themeMenuDropdown,
        .cyber-loader-box,
        .cyber-bar,
        .status-pill-badge {
            border-color: var(--theme-border) !important;
            transition: border-color 0.15s ease;
        }

        /* Class Aksen Tema */
        .theme-bg-accent {
            background-color: var(--theme-accent) !important;
            color: var(--theme-text) !important;
            border-color: var(--theme-border) !important;
            transition: all 0.15s ease;
        }

        .theme-text-accent {
            color: var(--theme-border) !important;
            transition: color 0.15s ease;
        }

        .theme-light-bg {
            background-color: var(--theme-light) !important;
            border-color: var(--theme-border) !important;
            transition: all 0.15s ease;
        }

        /* MODE RGB DYNAMIC ROTATING BORDER */
        .rgb-mode-active .light-card,
        .rgb-mode-active .dropdown-nav-card,
        .rgb-mode-active .btn-brutalism-light,
        .rgb-mode-active #themeMenuDropdown,
        .rgb-mode-active .cyber-loader-box,
        .rgb-mode-active .cyber-bar,
        .rgb-mode-active .stat-box,
        .rgb-mode-active .light-popup-bg,
        .rgb-mode-active .light-card-box,
        .rgb-mode-active #searchInput,
        .rgb-mode-active .status-pill-badge {
            border-color: transparent !important;
            background-image: linear-gradient(var(--card-bg), var(--card-bg)), 
                              conic-gradient(from var(--rgb-angle), #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000) !important;
            background-origin: border-box !important;
            background-clip: padding-box, border-box !important;
        }

        .rgb-mode-active .theme-bg-accent {
            border-color: transparent !important;
            background-image: linear-gradient(var(--theme-accent), var(--theme-accent)), 
                              conic-gradient(from var(--rgb-angle), #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000) !important;
            background-origin: border-box !important;
            background-clip: padding-box, border-box !important;
            color: var(--theme-text) !important;
        }

        .rgb-mode-active header,
        .rgb-mode-active #bioDropdown {
            border-color: transparent !important;
            background-image: linear-gradient(var(--bg-cream), var(--bg-cream)), 
                              conic-gradient(from var(--rgb-angle), #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000) !important;
            background-origin: border-box !important;
            background-clip: padding-box, border-box !important;
        }

        /* Cyber Loader Overlay */
        #cyber-loader-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            background-color: var(--bg-cream);
            background-image: radial-gradient(rgba(0, 0, 0, 0.12) 1.5px, transparent 1.5px) !important;
            background-size: 16px 16px !important;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.4s ease, visibility 0.4s ease;
        }
        #cyber-loader-overlay.fade-out {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }
        .cyber-loader-box {
            background: var(--card-bg);
            border: 2.5px solid var(--theme-border);
            box-shadow: 6px 6px 0px rgba(18, 18, 18, 0.15);
            border-radius: 24px;
            padding: 32px 28px;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            width: 320px;
        }
        .cyber-avatar-wrap {
            position: relative;
            width: 76px;
            height: 76px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .cyber-ring {
            position: absolute;
            inset: -6px;
            border: 3.5px solid #e4e4e7;
            border-top-color: var(--theme-border);
            border-right-color: #3b82f6;
            border-radius: 50%;
            animation: spinCyber 1s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
        }
        @keyframes spinCyber {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .cyber-text-glitch {
            color: #121212;
            font-weight: 900;
            font-size: 13px;
            letter-spacing: 2px;
        }
        .cyber-bar {
            width: 100%;
            height: 10px;
            background: #e4e4e7;
            border: 2px solid var(--theme-border);
            border-radius: 9999px;
            overflow: hidden;
        }
        .cyber-bar-fill {
            height: 100%;
            background: var(--theme-border);
            width: 0%;
            transition: width 0.15s ease;
            border-radius: 9999px;
        }

        /* Banner Video Container */
        .banner-video-container {
            width: 100% !important;
            border: 2.5px solid var(--theme-border) !important;
            border-radius: 22px !important;
            overflow: hidden !important;
            position: relative !important;
            background-color: #000000 !important;
            box-shadow: 0 4px 0px rgba(18, 18, 18, 0.08) !important;
            -webkit-mask-image: -webkit-radial-gradient(white, black) !important;
            isolation: isolate !important;
        }
        .banner-video-el {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            display: block !important;
            border-radius: 20px !important;
        }

        /* Kotak Statistik */
        .stat-box {
            background-color: var(--card-bg) !important;
            border: 2px solid var(--theme-border) !important;
            border-radius: 18px !important;
            padding: 12px 14px !important;
            min-height: 98px !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-shadow: 0 4px 0px rgba(18, 18, 18, 0.08) !important;
        }
        .stat-label {
            font-size: 10px !important;
            font-weight: 900 !important;
            letter-spacing: 0.05em !important;
            color: #121212 !important;
            text-transform: uppercase !important;
            margin: 0 !important;
            line-height: 1.2 !important;
        }
        .stat-value {
            font-size: 22px !important;
            font-weight: 900 !important;
            font-family: 'JetBrains Mono', monospace !important;
            color: #121212 !important;
            line-height: 1.1 !important;
            margin: 0 !important;
        }
        .stat-sub {
            font-size: 9px !important;
            font-weight: 700 !important;
            color: #52525b !important;
        }

        /* Override Style List Endpoint */
        #apiList { background-color: transparent !important; }
        #apiList .api-item {
            background-color: var(--card-bg) !important;
            border: 2.5px solid var(--theme-border) !important;
            border-radius: 16px !important;
            margin-bottom: 14px !important;
            box-shadow: 4px 4px 0px rgba(18,18,18,0.06) !important;
            overflow: hidden !important;
        }
        #apiList .api-item > button {
            background-color: var(--card-bg) !important;
            border-bottom: none !important;
            color: #121212 !important;
        }
        #apiList .api-item > button p { color: #121212 !important; font-weight: 900 !important; }
        #apiList .api-item > button .bg-cyan-500 { background-color: #121212 !important; color: #fff !important; border-radius: 6px !important; }
        #apiList .api-item > button code, #apiList .api-item > button .text-cyan-200, #apiList .api-item > button .text-cyan-700 { color: #121212 !important; font-weight: 700 !important; }

        #apiList .api-item > div[id^="ep-"] {
            background-color: #FAF7EF !important; 
            border-top: 2.5px dashed var(--theme-border) !important;
        }
        #apiList .api-item > div[id^="ep-"] .bg-slate-900\/60,
        #apiList .api-item > div[id^="ep-"] .bg-slate-900\/40,
        #apiList .api-item > div[id^="ep-"] > div.mb-4 > div.bg-slate-900\/40 {
            background-color: #FFFDF8 !important;
            border: 2px solid var(--theme-border) !important;
            box-shadow: none !important;
            color: #121212 !important;
        }
        #apiList .api-item > div[id^="ep-"] h4,
        #apiList .api-item > div[id^="ep-"] p,
        #apiList .api-item > div[id^="ep-"] span,
        #apiList .api-item > div[id^="ep-"] code {
            color: #121212 !important;
        }

        #apiList form label { color: #121212 !important; font-weight: 900 !important; }
        #apiList form input,
        #apiList form select,
        #apiList form button[id^="custom-select-"] {
            background-color: #FFFDF8 !important;
            border: 2px solid var(--theme-border) !important;
            color: #121212 !important;
            font-weight: 800 !important;
            border-radius: 8px !important;
        }
        #apiList form input::placeholder { color: #71717a !important; font-weight: 700 !important; }

        .dropdown-nav-card {
            background-color: #FFFDF8 !important;
            border: 2px solid var(--theme-border) !important;
            border-radius: 14px !important;
            padding: 10px 14px !important;
            font-weight: 800 !important;
            font-size: 11px !important;
            color: #121212 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            text-transform: uppercase !important;
            transition: all 0.15s ease !important;
            box-shadow: 0 2px 0px rgba(18, 18, 18, 0.05) !important;
        }
        .dropdown-nav-card:active {
            transform: translateY(1px) !important;
            background-color: #FAF7EF !important;
        }

        #searchInput {
            background-color: var(--card-bg) !important;
            border: 2px solid var(--theme-border) !important;
            color: #121212 !important;
            border-radius: 16px !important;
            font-weight: 700 !important;
            box-shadow: 0 3px 0px rgba(18, 18, 18, 0.05) !important;
        }
        #searchInput::placeholder { color: #71717a !important; }

        #categoryFilters button, .filter-btn {
            background-color: #FAF7EF !important;
            border: 2px solid var(--theme-border) !important;
            color: #121212 !important;
            border-radius: 9999px !important;
            font-weight: 800 !important;
            font-size: 11px !important;
            padding: 6px 16px !important;
            cursor: pointer;
        }
        #categoryFilters button.active, .filter-btn.active {
            background-color: var(--theme-border) !important;
            color: #ffffff !important;
        }

        .lang-btn {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            font-weight: 800;
            padding: 4px 10px;
            border: 1.5px solid var(--theme-border);
            background-color: #FAF7EF;
            color: #121212;
            border-radius: 8px;
        }
        .lang-btn.active {
            background-color: var(--theme-border);
            color: #ffffff;
        }

        .light-popup-bg {
            background-color: var(--card-bg) !important;
            border: 2.5px solid var(--theme-border) !important;
            box-shadow: 8px 8px 0px rgba(18, 18, 18, 0.2) !important;
            color: #121212 !important;
        }
        .light-card-box {
            background-color: #FAF7EF !important;
            border: 2px solid var(--theme-border) !important;
            border-radius: 16px !important;
        }
        .light-pill-capsule {
            background-color: var(--card-bg) !important;
            border: 2px solid var(--theme-border) !important;
            border-radius: 9999px !important;
            color: #121212 !important;
            font-weight: 800 !important;
        }
        .light-solid-header {
            background-color: var(--theme-border) !important;
            color: #ffffff !important;
            font-weight: 900 !important;
            border-radius: 10px !important;
        }

        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    </style>
</head>
<body class="min-h-screen pb-12">

<!-- Loader Overlay -->
<div id="cyber-loader-overlay">
    <div class="cyber-loader-box">
        <div class="cyber-avatar-wrap mb-4">
            <div class="cyber-ring"></div>
            <img src="https://arulz-xd.my.id/files/Q2C70y.png" alt="Logo" class="w-14 h-14 rounded-full object-cover brutal-border border-2 shadow-sm">
        </div>
        <div class="text-center">
            <div id="loader-title-text" class="cyber-text-glitch uppercase mb-0.5">
                INITIALIZING GATEWAY...
            </div>
            <div class="text-[9px] font-mono text-zinc-600 font-bold uppercase tracking-widest">
                ARULZ-XD API REST CORE
            </div>
        </div>
        <div class="w-full mt-5">
            <div class="flex items-center justify-between text-[10px] font-mono mb-1.5 text-zinc-800 font-bold">
                <span>SYSTEM LOADING</span>
                <span id="loader-percentage" class="font-black">0%</span>
            </div>
            <div class="cyber-bar">
                <div id="loader-progress-fill" class="cyber-bar-fill"></div>
            </div>
        </div>
    </div>
</div>

<div id="themeBg" class="fixed inset-0 -z-10"></div>

<!-- Welcome Popup -->
<div id="welcomePopup" class="fixed inset-0 z-[99999] hidden">
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm"></div>
  <div class="fixed inset-0 flex items-center justify-center p-4">
    <div class="p-6 w-full max-w-md relative font-['Plus_Jakarta_Sans'] text-zinc-900 bg-[#FFFDF8] border-2 brutal-border rounded-2xl shadow-xl">
      <button id="closePopupBtn" class="absolute top-4 right-4 text-zinc-500 hover:text-zinc-900 bg-zinc-200 rounded-full p-1.5 focus:outline-none border border-zinc-900">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      
      <div class="text-center mb-4">
        <h1 class="text-xl font-extrabold text-zinc-900 leading-tight">
          WELCOME TO <span class="theme-text-accent">ARULZ-XD API</span>
        </h1>
      </div>
      
      <div class="mb-4 rounded-xl overflow-hidden border-2 brutal-border bg-black relative">
        <img src="https://arulz-xd.my.id/files/K4Sf61.png" alt="Welcome Banner" class="w-full h-auto object-cover max-h-44" />
      </div>
      
      <div class="text-center text-zinc-700 text-xs mb-5 leading-relaxed font-semibold">
        <p>Halo! Selamat datang di Arulz-XD REST API Core. Gunakan API Key di bawah ini untuk memulai pengujian endpoint secara langsung.</p>
      </div>
      
      <div class="mb-5 flex justify-center">
        <div class="bg-zinc-100 border-2 brutal-border rounded-full py-2 px-5 text-center">
          <span class="font-bold text-xs text-zinc-900 font-mono">
            APIKEY : <span id="welcomeApiKey" class="font-mono theme-text-accent select-all font-extrabold">${(req.user && req.user.apikey) ? req.user.apikey : 'Silakan Login'}</span>
          </span>
        </div>
      </div>
      
      <a href="/support" class="w-full theme-bg-accent text-zinc-900 font-extrabold py-3 px-6 rounded-xl border-2 brutal-border text-xs block text-center uppercase tracking-wider active:scale-95 shadow-xs">
        Donate Sekarang
      </a>
    </div>
  </div>
</div>
          
<!-- Profile Popup -->
<div id="profilePopup" class="fixed inset-0 z-[99999] hidden">
  <div class="fixed inset-0 bg-black/70 backdrop-blur-sm" onclick="closeProfilePopup()"></div>
  <div class="fixed inset-0 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
    <div class="w-full max-w-[410px] light-popup-bg rounded-3xl p-5 relative font-sans my-auto">
        <div class="flex items-center justify-between mb-5 gap-2">
            <div class="relative w-20 h-20 flex-shrink-0">
                <input type="file" id="avatarInput" accept="image/*" class="hidden" onchange="uploadAvatarFile(this)">
                <div class="relative cursor-pointer w-full h-full" onclick="document.getElementById('avatarInput').click()">
                    <div class="w-full h-full rounded-full p-0.5 border-2 brutal-border shadow-sm overflow-hidden bg-white">
                        <img id="userAvatar" src="https://arulz-xd.my.id/files/X1F0Cn.png" class="w-full h-full rounded-full object-cover">
                    </div>
                </div>
            </div>

            <div class="flex-1 flex flex-col gap-2 min-w-0 px-2">
                <div class="light-pill-capsule py-1.5 px-3 text-center truncate">
                    <span id="userName" class="text-xs font-black text-zinc-900">loading...</span>
                </div>
                <div class="light-pill-capsule py-1.5 px-3 text-center truncate">
                    <span id="userEmail" class="text-[10px] font-bold text-zinc-700">loading_email@gmail.com</span>
                </div>
            </div>

            <div id="planBoxContainer" class="relative w-20 h-24 flex flex-col items-center justify-center flex-shrink-0">
                <svg class="w-full h-full" viewBox="0 0 100 130" fill="none">
                    <text x="50" y="20" fill="#121212" font-size="10" font-weight="900" text-anchor="middle">USER</text>
                    <path d="M 50 35 L 80 45 L 80 85 L 50 110 L 20 85 L 20 45 Z" fill="#FAF7EF" stroke="#121212" stroke-width="3"/>
                    <text id="userPlanText" x="50" y="78" fill="#121212" font-size="18" font-weight="900" text-anchor="middle">FREE</text>
                </svg>
            </div>
        </div>

        <div class="light-card-box p-3 mb-4 relative">
            <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-black text-white border-2 brutal-border bg-zinc-900 px-2.5 py-0.5 rounded-md uppercase">Api Key Kamu :</span>
            </div>
            
            <div class="light-pill-capsule text-zinc-900 text-xs font-black py-1.5 px-3 truncate mb-3 text-center font-mono">
                <span id="userApiKey">loading-key</span>
            </div>

            <div id="vipCustomKeyBox" class="hidden mb-3">
                <div class="flex gap-1.5">
                    <input type="text" id="customApiKeyInput" placeholder="Ketik Custom API Key..." class="w-full bg-[#FFFDF8] border-2 brutal-border rounded-xl px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-500 focus:outline-none font-bold">
                    <button onclick="saveCustomApiKey()" class="theme-bg-accent text-zinc-900 border-2 brutal-border text-[10px] px-3 rounded-xl uppercase font-extrabold shadow-xs active:scale-95">SIMPAN</button>
                </div>
            </div>
            
            <button onclick="copyText(document.getElementById('userApiKey').innerText, 'API Key')" class="w-full bg-zinc-900 hover:bg-zinc-800 text-white border-2 brutal-border text-xs py-2 rounded-xl uppercase tracking-widest font-extrabold active:scale-95 transition-all">
                SALIN API KEY
            </button>
        </div>

        <div class="light-card-box p-3 mb-4 text-center relative">
            <div class="w-full light-solid-header text-[11px] py-1 uppercase tracking-widest mb-3">
                LIMIT USER
            </div>
            <div class="py-0.5">
                <span class="inline-block light-pill-capsule text-zinc-900 px-6 py-1 text-xs font-black tracking-widest font-mono">
                    <span id="popupLimitUsed">0</span> / <span id="popupLimitMax">100</span>
                </span>
            </div>
        </div>

        <div class="light-card-box p-3 mb-4">
            <div class="w-full light-solid-header text-[11px] py-1 uppercase tracking-widest mb-3 text-center">
                AKTIFITAS REQUEST API TERAKHIR
            </div>
            <div id="activityLogsContainer" class="space-y-2 max-h-40 overflow-y-auto pr-1">
                <div class="light-pill-capsule text-zinc-800 font-mono text-[10px] py-1.5 px-3 text-center truncate">
                    belum ada request
                </div>
            </div>
        </div>

        <div class="space-y-2">
            <a href="/upgrade-apikey" class="w-full theme-bg-accent text-zinc-900 border-2 brutal-border font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 uppercase tracking-widest active:scale-95 transition-all shadow-xs">
                UPGRADE VIP
            </a>
            <div class="flex gap-2">
                <button onclick="closeProfilePopup()" class="flex-1 light-pill-capsule hover:bg-zinc-200 text-zinc-900 font-black text-xs py-2 uppercase tracking-widest transition-all">
                    TUTUP
                </button>
                <a href="/auth/logout" class="flex-1 border-2 brutal-border bg-red-500 hover:bg-red-600 text-white font-black text-xs py-2 rounded-full flex items-center justify-center uppercase tracking-widest transition-all shadow-xs">
                    LOG OUT
                </a>
            </div>
        </div>
    </div>
  </div>
</div>

<div id="toast" class="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none items-end"></div>

<!-- Header Top Bar -->
<header class="fixed top-0 left-0 right-0 w-full bg-[#FAF7EF] border-b-2 brutal-border z-30 shadow-xs">
    <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl border-2 brutal-border bg-black flex items-center justify-center shadow-sm">
                <img src="https://arulz-xd.my.id/files/Q2C70y.png" alt="Logo" class="w-8 h-8 rounded-lg object-cover">
            </div>
            <div>
                <span class="text-base font-black text-zinc-900 tracking-tight block leading-none">Arulzxd API</span>
                <span class="text-[10px] font-mono font-bold text-zinc-600 uppercase">GATEWAY REST V2</span>
            </div>
        </div>

        <div class="flex items-center gap-2 relative">
            <button id="themePickerBtn" title="Ubah Style Warna" class="w-10 h-10 rounded-xl border-2 theme-bg-accent flex items-center justify-center active:scale-95 shadow-sm transition-all">
                <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61.43.53 1.03.89 1.7.89h1.83c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.97-4.03-9-9-9zm-6.5 9c-.83 0-1.5-.67-1.5-1.5S4.67 9 5.5 9s1.5.67 1.5 1.5S6.33 12 5.5 12zm3-4C7.67 8 7 7.33 7 6.5S7.67 5 8.5 5s1.5.67 1.5 1.5S9.33 8 8.5 8zm7 0c-.83 0-1.5-.67-1.5-1.5S14.67 5 15.5 5s1.5.67 1.5 1.5S16.33 8 15.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
            </button>

            <button id="bioMenuBtn" class="w-10 h-10 rounded-xl border-2 brutal-border bg-[#FAF7EF] flex items-center justify-center text-zinc-900 active:scale-95 shadow-sm">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            </button>

            <div id="themeMenuDropdown" class="hidden absolute top-12 right-0 w-44 bg-[#FFFDF8] border-2 brutal-border rounded-xl p-2 shadow-2xl z-50 flex flex-col gap-1.5">
                <div class="text-[9px] font-black code-font uppercase text-zinc-500 px-2 py-0.5 border-b border-zinc-200">PILIH TEMA STYLE</div>
                
                <button onclick="setAppTheme('yellow')" class="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg border-2 border-amber-600 bg-yellow-300 text-[11px] font-black text-zinc-900 active:scale-95">
                    <span>YELLOW</span>
                    <span class="w-3.5 h-3.5 rounded-full bg-yellow-400 border border-amber-700"></span>
                </button>
                <button onclick="setAppTheme('red')" class="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg border-2 border-red-700 bg-red-500 text-[11px] font-black text-white active:scale-95">
                    <span>RED</span>
                    <span class="w-3.5 h-3.5 rounded-full bg-red-600 border border-red-800"></span>
                </button>
                <button onclick="setAppTheme('blue')" class="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg border-2 border-blue-700 bg-blue-500 text-[11px] font-black text-white active:scale-95">
                    <span>BLUE</span>
                    <span class="w-3.5 h-3.5 rounded-full bg-blue-600 border border-blue-800"></span>
                </button>
                <button onclick="setAppTheme('cyan')" class="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg border-2 border-cyan-700 bg-cyan-400 text-[11px] font-black text-zinc-900 active:scale-95">
                    <span>CYAN</span>
                    <span class="w-3.5 h-3.5 rounded-full bg-cyan-500 border border-cyan-800"></span>
                </button>
                <button onclick="setAppTheme('purple')" class="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg border-2 border-purple-700 bg-purple-500 text-[11px] font-black text-white active:scale-95">
                    <span>PURPLE</span>
                    <span class="w-3.5 h-3.5 rounded-full bg-purple-600 border border-purple-800"></span>
                </button>
                <button onclick="setAppTheme('green')" class="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg border-2 border-emerald-700 bg-emerald-400 text-[11px] font-black text-zinc-900 active:scale-95">
                    <span>GREEN</span>
                    <span class="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-800"></span>
                </button>
                <button onclick="setAppTheme('black')" class="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg border-2 border-zinc-900 bg-zinc-900 text-[11px] font-black text-white active:scale-95">
                    <span>BLACK</span>
                    <span class="w-3.5 h-3.5 rounded-full bg-black border border-white"></span>
                </button>
                <button onclick="setAppTheme('rgb')" class="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg border-2 border-pink-600 bg-gradient-to-r from-red-400 via-emerald-400 to-blue-400 text-[11px] font-black text-zinc-900 active:scale-95 shadow-sm">
                    <span>RGB DYNAMIC</span>
                    <span class="w-3.5 h-3.5 rounded-full bg-white border border-black animate-pulse"></span>
                </button>
            </div>
        </div>
    </div>
</header>

<!-- Overlay Latar Belakang -->
<div id="menuOverlay" class="fixed inset-0 bg-black/60 hidden z-40"></div>

<!-- Sidebar Dropdown Nav (Ala Home) -->
<div id="bioDropdown" class="fixed top-0 right-0 h-full w-80 bg-[#FAF7EF] border-l-2 border-zinc-900 transform translate-x-full transition-transform duration-300 ease-in-out z-50 shadow-2xl flex flex-col p-4 text-zinc-900 overflow-y-auto scrollbar-hide">
    <div class="flex items-center justify-between pb-3 mb-3 border-b-2 border-zinc-900">
        <span class="px-2.5 py-1 bg-amber-400 border-2 border-zinc-900 rounded-lg text-[10px] font-black uppercase tracking-wider text-black flex items-center gap-1">
            <svg class="w-3.5 h-3.5 fill-black" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            ARULZXD API
        </span>

        <button id="closeMenuBtn" class="w-8 h-8 rounded-lg border-2 border-zinc-900 bg-[#FAF7EF] flex items-center justify-center text-zinc-900 active:scale-95 shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
    </div>

    <div class="mb-3 rounded-2xl border-2 border-zinc-900 overflow-hidden bg-black h-36 relative shadow-sm">
        <video autoplay loop muted playsinline class="w-full h-full object-cover">
            <source src="https://files.catbox.moe/dvlk00.mp4" type="video/mp4">
            <img src="https://files.catbox.moe/dvlk00.mp4" alt="Sidebar Banner" class="w-full h-full object-cover">
        </video>
    </div>

    <div class="mb-3">
        ${req.user ? `
        <div class="p-2.5 rounded-2xl border-2 border-zinc-900 bg-white/60 flex items-center justify-between shadow-sm">
            <div class="flex items-center gap-2.5 overflow-hidden">
                <img id="sidebarUserAvatar" src="${req.user.avatar || 'https://arulz-xd.my.id/files/X1F0Cn.png'}" class="w-9 h-9 rounded-xl border-2 border-zinc-900 object-cover flex-shrink-0 bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">
                <div class="flex flex-col truncate">
                    <span class="text-xs font-extrabold text-zinc-900 truncate">${req.user.username}</span>
                    <span class="text-[9px] font-bold text-blue-600 uppercase tracking-tight">AKUN TERHUBUNG</span>
                </div>
            </div>
            <button onclick="openProfilePopup()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] rounded-xl border-2 border-zinc-900 uppercase tracking-wider active:scale-95 transition-all flex-shrink-0 shadow-sm">
                PROFILE
            </button>
        </div>
        ` : `
        <a href="/login" class="w-full dropdown-nav-card bg-zinc-900 text-white justify-center text-center py-2.5 flex items-center gap-2">
            <svg class="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
            LOGIN / REGISTER
        </a>
        `}
    </div>

    <nav class="space-y-2 flex-1">
        <a href="/" class="dropdown-nav-card">
            <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-zinc-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/></svg>
                <span>BACK TO DASHBOARD</span>
            </div>
        </a>
        <a href="/docs" class="dropdown-nav-card theme-light-bg">
            <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-zinc-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                <span>DOCS / ENDPOINTS</span>
            </div>
        </a>
        <a href="/store" class="dropdown-nav-card">
            <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-zinc-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>
                <span>STORE / BUY PLAN</span>
            </div>
        </a>
        <a href="/uploader" class="dropdown-nav-card">
            <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-zinc-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
                <span>UPLOADER FILE</span>
            </div>
        </a>
        <a href="/pastecode" class="dropdown-nav-card">
            <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-zinc-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>
                <span>PASTECODE SNIPPET</span>
            </div>
        </a>
        <a href="/feedback" class="dropdown-nav-card">
            <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-zinc-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.255-3.883c.195-.29.515-.475.865-.501 1.153-.086 2.294-.213 3.423-.379 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>
                <span>REQUEST FITUR</span>
            </div>
        </a>
        <a href="/status" class="dropdown-nav-card">
            <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-zinc-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 14.25h13.5m-13.5 3h13.5m-13.5 3h13.5M6 3h12a2.25 2.25 0 012.25 2.25v3.75A2.25 2.25 0 0118 11.25H6A2.25 2.25 0 013.75 9V5.25A2.25 2.25 0 016 3z"/></svg>
                <span>SERVER STATUS</span>
            </div>
        </a>
        <a href="/support" class="dropdown-nav-card">
            <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-zinc-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
                <span>SUPPORT / DONASI</span>
            </div>
        </a>
        <a href="/privacy" class="dropdown-nav-card">
            <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-zinc-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
                <span>PRIVACY POLICY</span>
            </div>
        </a>
    </nav>
</div>

<!-- Main Container -->
<main class="max-w-4xl mx-auto px-4 pt-20 pb-5 relative z-10 space-y-5">
    <div class="banner-video-container h-52 sm:h-72 md:h-80">
        <video autoplay loop muted playsinline class="banner-video-el">
            <source src="https://files.catbox.moe/dvlk00.mp4" type="video/mp4">
        </video>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="stat-box">
            <span class="stat-label">REAL-TIME CLOCK</span>
            <div id="liveClock" class="stat-value">00:00:00</div>
            <div id="liveDate" class="stat-sub uppercase truncate">Loading...</div>
        </div>
        <div class="stat-box">
            <div class="flex items-center justify-between w-full">
                <span class="stat-label">LIMIT USED</span>
                <span id="userLimitBadge" class="text-[9px] font-black text-zinc-900 bg-zinc-200 px-1.5 py-0.5 rounded border brutal-border uppercase">FREE</span>
            </div>
            <div class="flex items-baseline gap-1 mt-1">
                <span id="userLimitUsed" class="stat-value">0</span>
                <span class="text-zinc-600 text-sm font-black">/</span>
                <span id="userLimitMax" class="text-xs font-black text-zinc-600">100</span>
            </div>
            <div class="stat-sub">DAILY ACCESS</div>
        </div>
        <div class="stat-box">
            <span id="stat-endpoints-title" class="stat-label">TOTAL ENDPOINT</span>
            <span id="totalEndpoints" class="stat-value">0</span>
            <div class="stat-sub">ACTIVE ENDPOINTS</div>
        </div>
        <div class="stat-box">
            <span id="stat-categories-title" class="stat-label">TOTAL KATEGORI</span>
            <span id="totalCategories" class="stat-value">0</span>
            <div class="stat-sub">MODULE CATEGORIES</div>
        </div>
    </div>

    <div class="pt-1">
        <div class="relative">
            <input 
                type="text" 
                id="searchInput" 
                placeholder="Cari Endpoint Atau Kategori...."
                class="w-full py-4 pl-11 pr-4 text-xs font-bold rounded-2xl border-2 brutal-border bg-[#FFFDF8] text-zinc-900 placeholder-zinc-500 focus:outline-none shadow-xs"
            >
            <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
        </div>
        <div id="categoryFilters" class="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide"></div>
    </div>

    <!-- Elemen Tersembunyi untuk Mencegah TypeError pada script.js -->
    <div class="hidden">
        <audio id="audioElement"></audio>
        <span id="musicCoverImg"></span><span id="musicTitle"></span><span id="musicArtist"></span>
        <span id="currentTime"></span><div id="progressContainer"><div id="progressBar"></div></div>
        <span id="totalDuration"></span><button id="prevBtn"></button><button id="playBtn"></button>
        <button id="nextBtn"></button><button id="playlistToggleBtn"></button><div id="playlistPanel"></div>
        <span id="mainTitle"></span><span id="mainDescription"></span>
    </div>

    <div id="noResults" class="text-center py-8 hidden">
        <h3 id="no-results-title" class="text-xs font-black text-zinc-900 mb-1">Endpoint Tidak Ditemukan</h3>
        <p id="no-results-desc" class="text-[10px] font-semibold text-zinc-600">Coba gunakan kata kunci pencarian yang lain.</p>
    </div>

    <!-- Container Utama Tempat List Endpoint Rendred -->
    <div id="apiList" class="space-y-4 pt-1"></div>

    <footer id="siteFooter" class="mt-10 pt-4 border-t-2 border-zinc-300 text-center text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
        &copy; 2026 ARULZ-XD API REST CORE
    </footer>
</main>

<div id="imageLightbox" class="fixed inset-0 bg-black/90 z-[100] hidden flex items-center justify-center p-4">
    <div class="relative max-w-4xl max-h-[90vh]">
        <img id="lightboxImage" src="" alt="Preview" class="max-w-full max-h-[85vh] rounded-lg object-contain" />
        <button id="closeLightbox" class="absolute -top-10 right-0 text-white font-mono text-xs bg-black px-3 py-1 rounded border border-white">✕ Close</button>
    </div>
</div>

<!-- Script Pembantu & Injeksi Variabel Penting -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/moment.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/locale/id.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment-timezone/0.5.45/moment-timezone-with-data.min.js"></script>

<!-- DEKLARASI VARIABEL PENTING UNTUK SCRIPT.JS -->
<script class="notranslate" translate="no">
    window.musicPlaylist = ${JSON.stringify(playlist || [])};
    const displayApiKey = "${req.user ? (req.user.apikey) : 'Silakan Login'}";
</script>

<!-- Script Utama untuk Memuat Endpoint /apilist -->
<script src="script.js"></script>

<script>
    // Memblokir Pinch Zoom
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) e.preventDefault();
    });
    document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

    // Presets Tema Warna & Border
    const THEME_PRESETS = {
        yellow: { border: '#a16207', accent: '#fde047', text: '#121212', light: '#fef9c3' },
        red:    { border: '#b91c1c', accent: '#ef4444', text: '#ffffff', light: '#fee2e2' },
        blue:   { border: '#1d4ed8', accent: '#3b82f6', text: '#ffffff', light: '#dbeafe' },
        cyan:   { border: '#0e7490', accent: '#06b6d4', text: '#ffffff', light: '#cff4fc' },
        purple: { border: '#7e22ce', accent: '#a855f7', text: '#ffffff', light: '#f3e8ff' },
        green:  { border: '#047857', accent: '#10b981', text: '#ffffff', light: '#d1fae5' },
        black:  { border: '#000000', accent: '#18181b', text: '#ffffff', light: '#e4e4e7' }
    };

    let rgbInterval = null;

    function setAppTheme(themeName) {
        const root = document.documentElement;
        const dropdown = document.getElementById('themeMenuDropdown');

        if (rgbInterval) {
            clearInterval(rgbInterval);
            rgbInterval = null;
        }

        localStorage.setItem('selectedThemeStyle', themeName);

        if (themeName === 'rgb') {
            document.body.classList.add('rgb-mode-active');
            let angle = 0;
            rgbInterval = setInterval(() => {
                angle = (angle + 3) % 360;
                root.style.setProperty('--rgb-angle', angle + 'deg');
            }, 20);
        } else {
            document.body.classList.remove('rgb-mode-active');
            const t = THEME_PRESETS[themeName] || THEME_PRESETS.yellow;
            root.style.setProperty('--theme-border', t.border);
            root.style.setProperty('--theme-accent', t.accent);
            root.style.setProperty('--theme-text', t.text);
            root.style.setProperty('--theme-light', t.light);
        }

        if (dropdown) dropdown.classList.add('hidden');
    }

    function copyText(text, label) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                alert((label || 'Teks') + ' berhasil disalin!');
            });
        }
    }

    function openProfilePopup() {
        document.getElementById('profilePopup').classList.remove('hidden');
        fetchUserProfile();
    }

    function closeProfilePopup() {
        document.getElementById('profilePopup').classList.add('hidden');
    }

    function showWelcomePopup() {
        const popup = document.getElementById('welcomePopup');
        const closeBtn = document.getElementById('closePopupBtn');
        if (popup) {
            popup.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
        }
        if (closeBtn) {
            closeBtn.onclick = () => {
                popup.classList.add('hidden');
                document.body.classList.remove('overflow-hidden');
            };
        }
    }

    function setRoleTheme(roleName) {
        const planText = document.getElementById('userPlanText');
        const vipCustomBox = document.getElementById('vipCustomKeyBox');
        if (!planText) return;

        const role = (roleName || '').toLowerCase();

        if (role.includes('vip')) {
            planText.textContent = 'VIP';
            planText.setAttribute('fill', '#2563eb');
            if (vipCustomBox) vipCustomBox.classList.remove('hidden');
        } else if (role.includes('premium')) {
            planText.textContent = 'PREM';
            planText.setAttribute('fill', '#d97706');
            if (vipCustomBox) vipCustomBox.classList.add('hidden');
        } else {
            planText.textContent = 'FREE';
            planText.setAttribute('fill', '#121212');
            if (vipCustomBox) vipCustomBox.classList.add('hidden');
        }
    }

    async function saveCustomApiKey() {
        const input = document.getElementById('customApiKeyInput');
        if (!input || !input.value.trim()) {
            alert('Ketik API Key kustom yang diinginkan terlebih dahulu!');
            return;
        }

        try {
            const response = await fetch('/api/user/custom-apikey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customKey: input.value.trim() })
            });

            const resData = await response.json();
            if (resData.status) {
                alert(resData.message);
                document.getElementById('userApiKey').innerText = resData.apikey;
                input.value = '';
            } else {
                alert(resData.message || 'Gagal mengubah API Key.');
            }
        } catch (err) {
            alert('Terjadi kesalahan koneksi saat menyimpan API Key.');
        }
    }

    async function uploadAvatarFile(input) {
        if (!input.files || !input.files[0]) return;

        const file = input.files[0];
        const formData = new FormData();
        formData.append('avatar', file);

        const userAvatarImg = document.getElementById('userAvatar');
        const sidebarAvatarImg = document.getElementById('sidebarUserAvatar');
        const oldSrc = userAvatarImg ? userAvatarImg.src : '';

        if (userAvatarImg) userAvatarImg.style.opacity = '0.4';
        if (sidebarAvatarImg) sidebarAvatarImg.style.opacity = '0.4';

        const showCyberAlert = (icon, title, text) => {
            Swal.fire({
                icon: icon,
                title: title,
                text: text,
                background: '#010a17',
                color: '#f8fafc',
                confirmButtonText: 'OKE'
            });
        };

        try {
            const response = await fetch('/api/user/update-avatar', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.status) {
                const newAvatarUrl = result.avatar;

                document.querySelectorAll('#userAvatar, #sidebarUserAvatar').forEach(img => {
                    img.src = newAvatarUrl;
                });

                showCyberAlert('success', 'AVATAR UPDATED', 'Avatar profil berhasil diperbarui!');
            } else {
                showCyberAlert('error', 'UPDATE FAILED', result.message || 'Gagal mengunggah avatar.');
                if (userAvatarImg) userAvatarImg.src = oldSrc;
                if (sidebarAvatarImg) sidebarAvatarImg.src = oldSrc;
            }
        } catch (error) {
            console.error("Error uploading avatar:", error);
            showCyberAlert('error', 'CONNECTION ERROR', 'Terjadi kesalahan koneksi saat mengunggah gambar.');
            if (userAvatarImg) userAvatarImg.src = oldSrc;
            if (sidebarAvatarImg) sidebarAvatarImg.src = oldSrc;
        } finally {
            if (userAvatarImg) userAvatarImg.style.opacity = '1';
            if (sidebarAvatarImg) sidebarAvatarImg.style.opacity = '1';
            input.value = '';
        }
    }

    function fetchUserProfile() {
        fetch('/api/user-status')
            .then(res => res.json())
            .then(data => {
                if (data.loggedIn && data.user) {
                    const latestAvatar = data.user.avatar || 'https://arulz-xd.my.id/files/X1F0Cn.png';

                    document.querySelectorAll('#userAvatar, #sidebarUserAvatar').forEach(img => {
                        if (img) img.src = latestAvatar;
                    });

                    document.getElementById('userName').innerText = data.user.username || 'User';
                    document.getElementById('userEmail').innerText = data.user.email || 'no-email@mail.com';
                    
                    const userKey = data.user.apikey || '';
                    document.getElementById('userApiKey').innerText = userKey || 'No Key Found';
                    document.getElementById('welcomeApiKey').innerText = userKey || 'Silakan Login';
                                            
                    setRoleTheme(data.user.role || 'Free User');

                    fetchUserActivityLogs(userKey);
                    if (typeof fetchAndUpdateUserLimit === 'function') {
                        fetchAndUpdateUserLimit();
                    }
                }
            })
            .catch((err) => {
                console.error("Gagal sinkronisasi profile:", err);
            });
    }

    function fetchUserActivityLogs() {
        const container = document.getElementById('activityLogsContainer');
        if (!container) return;

        fetch('/api/user-activity')
          .then(res => res.json())
          .then(resData => {
              if (resData.status && resData.data && resData.data.length > 0) {
                  container.innerHTML = resData.data.map(logText => 
                    '<div class="light-pill-capsule text-zinc-800 font-mono text-[10px] py-1.5 px-3 text-center truncate">' +
                        logText +
                    '</div>'
                ).join('');
            } else {
                container.innerHTML = 
                    '<div class="light-pill-capsule text-zinc-500 font-mono text-[10px] py-2 px-3 text-center">' +
                        'Belum ada aktivitas request' +
                    '</div>';
            }
        })
        .catch(err => {
            container.innerHTML = 
                '<div class="light-pill-capsule text-red-600 font-mono text-[10px] py-2 px-3 text-center">' +
                    'Gagal memuat aktivitas' +
                '</div>';
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const bioMenuBtn = document.getElementById('bioMenuBtn');
        const bioDropdown = document.getElementById('bioDropdown');
        const closeMenuBtn = document.getElementById('closeMenuBtn');
        const menuOverlay = document.getElementById('menuOverlay');
        const sidebarBannerVideo = document.getElementById('sidebarBannerVideo');

        const themeBtn = document.getElementById('themePickerBtn');
        const themeDropdown = document.getElementById('themeMenuDropdown');

        if (themeBtn && themeDropdown) {
            themeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                themeDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!themeDropdown.contains(e.target) && e.target !== themeBtn) {
                    themeDropdown.classList.add('hidden');
                }
            });
        }

        const savedTheme = localStorage.getItem('selectedThemeStyle') || 'yellow';
        setAppTheme(savedTheme);

        function playBannerVideo() {
            if (sidebarBannerVideo) {
                sidebarBannerVideo.play().catch(err => console.log("Autoplay handled:", err));
            }
        }

        function closeSidebarMenu() {
            if (bioDropdown && menuOverlay) {
                bioDropdown.style.transform = 'translateX(100%)';
                menuOverlay.classList.add('hidden');
            }
        }

        if (bioMenuBtn && bioDropdown && menuOverlay) {
            bioMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                bioDropdown.style.transform = 'translateX(0)';
                menuOverlay.classList.remove('hidden');
                playBannerVideo();
            });
            if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeSidebarMenu);
            menuOverlay.addEventListener('click', closeSidebarMenu);
            bioDropdown.addEventListener('click', (e) => { e.stopPropagation(); });
        }

        playBannerVideo();
        fetchUserProfile();

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('showProfile') === 'true') {
            openProfilePopup();
        }
    });

    let currentProgress = 0;
    let hasFinishedLoading = false;
    const progressFill = document.getElementById('loader-progress-fill');
    const percentageText = document.getElementById('loader-percentage');
    const loaderOverlay = document.getElementById('cyber-loader-overlay');

    function updateProgress(targetVal) {
        currentProgress = Math.min(Math.max(currentProgress, targetVal), 100);
        if (progressFill) progressFill.style.width = currentProgress + '%';
        if (percentageText) percentageText.innerText = Math.floor(currentProgress) + '%';
    }

    function finishLoader() {
        if (hasFinishedLoading) return;
        hasFinishedLoading = true;
        clearInterval(progressInterval);
        updateProgress(100);

        setTimeout(() => {
            if (loaderOverlay) {
                loaderOverlay.classList.add('fade-out');
                setTimeout(() => {
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.get('showProfile') !== 'true') {
                        showWelcomePopup();
                    }
                }, 200);
            }
        }, 400);
    }

    const progressInterval = setInterval(() => {
        if (currentProgress < 85) {
            const increment = Math.random() * 12 + 5;
            updateProgress(currentProgress + increment);
        }
    }, 120);

    window.addEventListener('load', finishLoader);
    setTimeout(finishLoader, 1500);
</script>

</body>
</html>
    `);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
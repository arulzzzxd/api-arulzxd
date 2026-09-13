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
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>API-ARULZXD - REST</title>
    <link rel="icon" href="https://arulz-xd.my.id/files/Q2C70y.png" type="image/png">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles.css" />
    
    <style>
    :root {
        --accent: #6366f1;
        --accent-hover: #4f46e5;
        --bg-main: #0f172a;
        --card-bg: #1e293b;
        --border-color: #334155;
        --text-main: #f8fafc;
        --text-muted: #94a3b8;
    }

    html.light {
        --accent: #4f46e5;
        --accent-hover: #4338ca;
        --bg-main: #f8fafc;
        --card-bg: #ffffff;
        --border-color: #e2e8f0;
        --text-main: #0f172a;
        --text-muted: #64748b;
    }

    html { scroll-behavior: smooth; }
    
    body {
        transition: background-color 0.2s ease, color 0.2s ease;
        font-family: 'Inter', sans-serif;
        background-color: var(--bg-main);
        color: var(--text-main);
    }

    .code-font { font-family: 'JetBrains Mono', monospace; }

    /* Ultra Modern Clean SaaS Card */
    .glass-panel {
        background: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    
    .glass-panel:hover {
        border-color: #475569;
    }
    .light-mode .glass-panel:hover {
        border-color: #cbd5e1;
    }

    .light-mode { color: #0f172a !important; }
    .light-mode #mainTitle { color: #0f172a !important; }
    .light-mode #mainDescription { color: #475569 !important; }
    .light-mode #stat-endpoints-title,
    .light-mode #stat-categories-title { color: #64748b !important; }
    .light-mode #siteFooter { color: #94a3b8 !important; border-color: #e2e8f0; }
    .light-mode #no-results-title { color: #0f172a !important; }

    .light-mode .music-player-card {
        background: #ffffff !important;
        border-color: #e2e8f0 !important;
    }
    .light-mode .music-text-title { color: #0f172a !important; }
    .light-mode .music-text-artist { color: #64748b !important; }
    .light-mode .music-progress-bar-bg { background-color: #e2e8f0 !important; }
    
    .light-mode .music-btn-nav {
        background-color: #f1f5f9 !important;
        border-color: #cbd5e1 !important;
        color: #334155 !important;
    }

    /* Form Styles */
    .light-mode .api-item p.text-white,
    .light-mode .api-item p { color: #0f172a !important; }
    .light-mode .api-item .bg-slate-950\/40,
    .light-mode .api-item .bg-slate-900\/40,
    .light-mode .api-item .bg-slate-900\/60 {
        background-color: #f8fafc !important;
        border-color: #e2e8f0 !important;
    }
    .light-mode .api-item input[type="text"] {
        background-color: #ffffff !important;
        color: #0f172a !important;
        border-color: #cbd5e1 !important;
    }
    .light-mode .api-item input[type="text"]::placeholder { color: #94a3b8 !important; }
    .light-mode .api-item code { color: #4f46e5 !important; }
    
    .lang-btn {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 6px;
        background-color: transparent;
        color: var(--text-muted);
        transition: all 0.15s ease;
    }
    .lang-btn.active {
        background-color: var(--accent);
        color: #ffffff;
    }

    .filter-btn {
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 14px;
        border: 1px solid var(--border-color);
        background: var(--card-bg);
        color: var(--text-muted);
        transition: all 0.15s ease;
        border-radius: 9999px;
        white-space: nowrap;
        cursor: pointer;
    }
    .filter-btn:hover {
        background: rgba(99, 102, 241, 0.08);
        color: #6366f1;
        border-color: rgba(99, 102, 241, 0.3);
    }
    .filter-btn.active {
        background-color: #6366f1 !important;
        color: #ffffff !important;
        border-color: #6366f1 !important;
        font-weight: 600;
    }
    
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

    /* Fast & Lightweight Loader Overlay */
    #cyber-loader-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background-color: #0f172a;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    #cyber-loader-overlay.fade-out {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
    }

    .clean-spinner {
        width: 36px;
        height: 36px;
        border: 3px solid #334155;
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
    }

    @keyframes spin { 100% { transform: rotate(360deg); } }

    .animated-dots::after {
        content: '';
        display: inline-block;
        width: 1em;
        text-align: left;
        animation: dotsAnimation 1.5s steps(4, end) infinite;
    }
    @keyframes dotsAnimation {
        0% { content: ''; }
        25% { content: '.'; }
        50% { content: '..'; }
        75% { content: '...'; }
    }

    .saas-progress-bar {
        background: #6366f1;
        transition: width 0.2s ease-out;
    }

    .modal-box {
        background-color: #1e293b;
        border: 1px solid #334155;
        border-radius: 20px;
    }

    .btn-indigo {
        background: #6366f1;
        color: #ffffff;
        font-weight: 600;
        transition: background-color 0.15s ease;
    }
    .btn-indigo:hover { background: #4f46e5; }

    </style>
</head>
<body class="min-h-screen antialiased text-slate-100 relative">

<!-- Lightweight SaaS Loader -->
<div id="cyber-loader-overlay">
    <div class="mb-4">
        <div class="clean-spinner"></div>
    </div>

    <div class="text-center px-4">
        <div id="loader-title-text" class="text-xs font-semibold tracking-wide text-slate-200 code-font mb-1">
            Memuat Halaman<span class="animated-dots"></span>
        </div>
        <div class="text-[10px] text-slate-400 font-mono">
            API SYSTEM READY
        </div>
    </div>

    <div class="w-48 sm:w-56 mt-4">
        <div class="flex items-center justify-between text-[10px] font-medium code-font mb-1">
            <span class="text-slate-400">Loading</span>
            <span id="loader-percentage" class="text-indigo-400 font-bold">0%</span>
        </div>
        <div class="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div id="loader-progress-fill" class="h-full rounded-full saas-progress-bar w-0"></div>
        </div>
    </div>
</div>

<div id="themeBg" class="fixed inset-0 -z-10"></div>

<!-- Welcome Popup -->
<div id="welcomePopup" class="fixed inset-0 z-[99999] hidden">
  <div class="fixed inset-0 bg-slate-950/70"></div>
  <div class="fixed inset-0 flex items-center justify-center p-4">
    <div class="modal-box w-full max-w-sm sm:max-w-md relative p-6 text-slate-100 light-mode:bg-white light-mode:text-slate-900 shadow-xl">
      
      <button id="closePopupBtn" class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors bg-slate-800 light-mode:bg-slate-100 rounded-full p-1.5 focus:outline-none">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      
      <div class="text-center mb-4">
        <h1 class="text-lg font-bold text-white light-mode:text-slate-900 tracking-tight">
          Welcome to <span class="text-indigo-400">Arulz-XD API</span>
        </h1>
      </div>
      
      <div class="mb-4 rounded-xl overflow-hidden border border-slate-700 light-mode:border-slate-200 bg-slate-900">
        <img src="https://arulz-xd.my.id/files/K4Sf61.png" alt="Welcome Banner" class="w-full h-auto object-cover max-h-40" />
      </div>
      
      <div class="text-center text-slate-300 light-mode:text-slate-600 text-xs mb-5 leading-relaxed">
        <p>Halo! 👋 Selamat datang di Arulz-XD API. API ini siap membantu kebutuhan backend aplikasi kamu dengan performa cepat.</p>
      </div>
      
      <div class="mb-5 flex justify-center">
        <div class="bg-slate-900 border border-slate-700 rounded-lg py-2 px-4 text-center">
          <span class="font-medium text-xs text-slate-300 light-mode:text-slate-700 font-mono">
            apikey : <span id="welcomeApiKey" class="text-indigo-400 font-bold select-all">${(req.user && req.user.apikey) ? req.user.apikey : 'Silakan Login'}</span>
          </span>
        </div>
      </div>
      
      <a href="/support" class="w-full btn-indigo py-2.5 px-4 rounded-xl text-xs block text-center tracking-wide font-semibold">
        Donate Sekarang
      </a>
    </div>
  </div>
</div>
    
<!-- User Profile Pop-up Modal -->
<div id="profilePopup" class="fixed inset-0 z-[99999] hidden">
  <div class="fixed inset-0 bg-slate-950/80" onclick="closeProfilePopup()"></div>
  <div class="fixed inset-0 flex items-center justify-center p-4">
    
    <div class="w-full max-w-[380px] modal-box p-5 relative font-sans text-slate-200 my-auto shadow-2xl">
        
        <div class="flex items-center gap-3.5 mb-4">
            <div class="relative w-14 h-14 flex-shrink-0">
                <input type="file" id="avatarInput" accept="image/*" class="hidden" onchange="uploadAvatarFile(this)">
                <div class="relative cursor-pointer w-full h-full" onclick="document.getElementById('avatarInput').click()">
                    <img id="userAvatar" src="https://arulz-xd.my.id/files/X1F0Cn.png" class="w-full h-full rounded-full object-cover border border-slate-600">
                    <div class="absolute bottom-0 right-0 bg-slate-800 text-slate-300 p-1 rounded-full border border-slate-600">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/>
                        </svg>
                    </div>
                </div>
            </div>

            <div class="flex-1 min-w-0">
                <div id="userName" class="text-sm font-semibold text-white truncate">loading...</div>
                <div id="userEmail" class="text-xs text-slate-400 truncate">loading_email@gmail.com</div>
                <div class="mt-1">
                    <span id="userPlanText" class="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">FREE</span>
                </div>
            </div>
        </div>

        <!-- Section 1: Api Key Kamu -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3">
            <div class="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">API KEY</div>
            <div id="userApiKey" class="text-indigo-400 text-xs font-mono font-bold truncate mb-2">loading-key</div>

            <div id="vipCustomKeyBox" class="hidden mb-2">
                <div class="flex gap-1.5">
                    <input type="text" id="customApiKeyInput" placeholder="Ketik Custom API Key..." class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200">
                    <button onclick="saveCustomApiKey()" class="btn-indigo text-[10px] px-2.5 rounded-lg uppercase">Simpan</button>
                </div>
            </div>
            
            <button onclick="copyText(document.getElementById('userApiKey').innerText, 'API Key')" class="w-full btn-indigo text-xs py-1.5 rounded-lg uppercase tracking-wide font-medium">
                SALIN API KEY
            </button>
        </div>

        <!-- Section 2: Limit User -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3 text-center">
            <div class="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">LIMIT USER</div>
            <div class="text-sm font-bold text-white font-mono">
                <span id="popupLimitUsed" class="text-indigo-400">0</span> / <span id="popupLimitMax" class="text-slate-400">100</span>
            </div>
        </div>

        <!-- Section 3: Request API Terakhir -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-4">
            <div class="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">AKTIVITAS TERAKHIR</div>
            <div id="activityLogsContainer" class="space-y-1 max-h-32 overflow-y-auto text-[10px]">
                <div class="text-slate-500 text-center py-1 font-mono">belum ada request</div>
            </div>
        </div>

        <!-- Buttons Footer -->
        <div class="flex gap-2">
            <a href="/upgrade-apikey" class="flex-1 btn-indigo text-xs py-2 rounded-xl text-center uppercase tracking-wide font-medium">
                UPGRADE
            </a>
            <button onclick="closeProfilePopup()" class="flex-1 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs py-2 rounded-xl uppercase font-medium">
                TUTUP
            </button>
            <a href="/auth/logout" class="border border-red-900/40 bg-red-950/20 text-red-400 hover:bg-red-900/40 text-xs px-3 py-2 rounded-xl flex items-center justify-center font-medium">
                LOG OUT
            </a>
        </div>

    </div>
  </div>
</div>

<div id="toast" class="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none items-end"></div>

    <!-- Header Actions -->
    <div class="fixed top-5 right-5 z-40 flex items-center gap-2">
        <button id="bioMenuBtn" class="flex items-center justify-center w-9 h-9 rounded-xl glass-panel text-slate-300 hover:text-white transition-all focus:outline-none">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        </button>
    </div>

    <!-- Sidebar Dropdown -->
    <div id="bioDropdown" class="fixed top-0 right-0 h-full w-60 bg-[#0f172a] border-l border-slate-800 transform translate-x-full transition-transform duration-200 ease-in-out z-50 flex flex-col p-4 light-mode:bg-white light-mode:border-slate-200">
        <div class="flex items-center justify-between mb-5">
            <div class="flex gap-1 border border-slate-800 rounded-lg p-0.5 bg-slate-900">
                <button id="lang-id" class="lang-btn active" onclick="setLanguage('id')">ID</button>
                <button id="lang-en" class="lang-btn" onclick="setLanguage('en')">EN</button>
            </div>
            
            <div class="flex items-center gap-1.5">
                <button id="themeToggle" class="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 light-mode:bg-slate-100 light-mode:border-slate-300 light-mode:text-slate-900">
                    <svg id="theme-toggle-dark-icon" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                    </svg>
                    <svg id="theme-toggle-light-icon" class="w-4 h-4 hidden" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fill-rule="evenodd" clip-rule="evenodd"></path>
                    </svg>
                </button>

                <button id="closeMenuBtn" class="text-slate-400 hover:text-white p-1.5 border border-slate-800 rounded-lg bg-slate-900">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        </div>

        ${req.user ? `
        <div class="mb-4">
            <button onclick="openProfilePopup()" class="w-full flex items-center gap-2.5 bg-slate-900 p-2 rounded-xl border border-slate-800 hover:border-slate-700 transition-all text-left">
                <img id="sidebarUserAvatar" src="${req.user.avatar}" class="w-7 h-7 rounded-full border border-slate-700 object-cover">
                <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-[9px] text-indigo-400 font-mono">PROFILE</span>
                    <span class="truncate text-white font-medium text-xs">${req.user.username}</span>
                </div>
            </button>
        </div>
        ` : `
        <div class="mb-4">
            <a href="/login" class="w-full btn-indigo py-2 rounded-xl text-xs block text-center uppercase tracking-wide font-semibold">
                Masuk Akun
            </a>
        </div>
        `}

        <nav class="flex flex-col gap-1 text-xs font-medium text-slate-300 flex-1 overflow-y-auto scrollbar-hide">
            <div class="text-[10px] font-semibold text-slate-500 px-2 pt-1 pb-1 uppercase font-mono tracking-wider">Pages</div>

            <a href="/" class="menu-link flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                <span>Dashboard</span>
            </a>

            <a href="/docs" class="menu-link flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <span>Docs</span>
            </a>

            <a href="/store" class="menu-link flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                <span>Store</span>
            </a>

            <a href="/changelog" class="menu-link flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span>Changelog</span>
            </a>

            <a href="/uploader" class="menu-link flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                <span>Uploader</span>
            </a>

            <a href="/pastecode" class="menu-link flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                <span>Pastecode</span>
            </a>

            <a href="/feedback" class="menu-link flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                <span>Feedback</span>
            </a>

            <a href="/status" class="menu-link flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                <span>Stats / Status</span>
            </a>

            <div class="text-[10px] font-semibold text-slate-500 px-2 pt-2 pb-1 uppercase font-mono tracking-wider">Legal</div>

            <a href="/privacy" class="menu-link flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                <span>Privacy Policy</span>
            </a>

            <a href="/support" class="menu-link flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                <span>Support</span>
            </a>
        </nav>
    </div>

    <div id="menuOverlay" class="fixed inset-0 bg-slate-950/50 hidden z-30 transition-opacity"></div>

    <div class="max-w-4xl mx-auto px-4 py-8 relative z-10">
        <header id="api" class="mb-8 text-center">
            <div class="inline-flex items-center gap-2 bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide mb-4 font-mono">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ALL SYSTEMS OPERATIONAL
            </div>
            
            <div id="mainTitle" class="flex justify-center mb-2 min-h-[40px] items-center text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                <img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=26&pause=1000&color=6366F1&center=true&vCenter=true&width=500&lines=Welcome+To+ArulzXD+API;Fast+%F0%9F%9A%80+Reliable+%E2%9A%A1;Free+REST+API+Services" alt="Typing SVG" class="mx-auto" />
            </div>
            <p id="mainDescription" class="text-xs md:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Jelajahi, uji, dan integrasikan berbagai endpoint API dengan performa tinggi.
            </p>

            <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="glass-panel p-3 text-center">
                    <div id="liveClock" class="text-base font-bold text-indigo-400 font-mono">00:00:00</div>
                    <div id="liveDate" class="text-[9px] font-medium text-slate-400 mt-0.5 uppercase font-mono">Loading...</div>
                </div>
                
                <div class="glass-panel p-3 text-center">
                    <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400 font-mono">Limit Terpakai</span>
                    <div class="flex items-baseline justify-center gap-1 mt-0.5 font-mono">
                        <span id="userLimitUsed" class="text-base font-bold text-white">0</span>
                        <span class="text-slate-500 text-xs">/</span>
                        <span id="userLimitMax" class="text-xs text-slate-400">100</span>
                    </div>
                </div>
                
                <div class="glass-panel p-3 text-center">
                    <span id="stat-endpoints-title" class="text-[10px] font-medium uppercase tracking-wider text-slate-400 font-mono">Endpoints</span>
                    <div id="totalEndpoints" class="text-base font-bold text-white mt-0.5 font-mono">0</div>
                </div>
                
                <div class="glass-panel p-3 text-center">
                    <span id="stat-categories-title" class="text-[10px] font-medium uppercase tracking-wider text-slate-400 font-mono">Kategori</span>
                    <div id="totalCategories" class="text-base font-bold text-white mt-0.5 font-mono">0</div>
                </div>
            </div>

            <div class="glass-panel mt-3 p-3 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div class="flex items-center gap-2 text-xs text-slate-300 font-mono">
                    <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                    <span>https://arulz-xd.my.id</span>
                </div>
                <a href="/feedback" class="w-full sm:w-auto px-3.5 py-1.5 btn-indigo text-[11px] rounded-lg text-center font-medium">
                    Request Feature
                </a>
            </div>

            <div class="flex justify-center gap-3 mt-3">
                <a href="https://whatsapp.com/channel/0029VbAwdIyJJhzRMpjUcS3P" target="_blank" class="flex-1 glass-panel py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors text-center font-sans">
                   Channel WhatsApp
                </a>
                <a href="https://chat.whatsapp.com/LBeGqVsmDBb6j29ysuusd9" target="_blank" class="flex-1 glass-panel py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors text-center font-sans">
                   Group WhatsApp
                </a>
            </div>

            <!-- Music Player -->
            <div class="music-player-card glass-panel mt-4 rounded-xl p-3 relative overflow-hidden">
                <audio id="audioElement"></audio>
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <img id="musicCoverImg" src="" alt="Cover" class="w-10 h-10 rounded-lg bg-slate-900 object-cover flex-shrink-0 border border-slate-700">
                        <div class="flex-1 min-w-0 text-left">
                            <h3 id="musicTitle" class="music-text-title text-white font-medium text-xs truncate m-0">Loading...</h3>
                            <p id="musicArtist" class="music-text-artist text-slate-400 text-[10px] truncate mt-0.5">-</p>
                            <div class="flex items-center gap-2 mt-1">
                                <span id="currentTime" class="text-[9px] text-slate-400 font-mono">0:00</span>
                                <div id="progressContainer" class="music-progress-bar-bg flex-1 h-1 bg-slate-800 rounded-full relative cursor-pointer">
                                    <div id="progressBar" class="h-full bg-indigo-500 rounded-full w-0"></div>
                                </div>
                                <span id="totalDuration" class="text-[9px] text-slate-400 font-mono">0:00</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button id="prevBtn" class="music-btn-nav w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white">
                            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                        </button>
                        <button id="playBtn" class="music-btn-nav w-8 h-8 flex items-center justify-center rounded-lg btn-indigo text-white">
                            <svg id="playIcon" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <button id="nextBtn" class="music-btn-nav w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white">
                            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 6h2v12h-2zm-10.5 12l8.5-6-8.5-6z"/></svg>
                        </button>
                        <button id="playlistToggleBtn" class="music-btn-nav w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
                        </button>
                    </div>
                </div>
                <div id="playlistPanel" class="music-playlist-border hidden mt-3 pt-3 border-t border-slate-800 max-h-36 overflow-y-auto space-y-1"></div>
            </div>
            
        </header>

        <div class="mb-6">
            <div class="relative">
                <input 
                    type="text" 
                    id="searchInput" 
                    placeholder="Cari endpoint API..."
                    class="w-full px-4 py-2.5 pl-10 text-xs rounded-xl focus:outline-none focus:border-indigo-500 transition-all font-sans glass-panel text-white placeholder-slate-500 light-mode:text-slate-900"
                >
                <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
            </div>
            <div id="categoryFilters" class="flex flex-wrap gap-1.5 mt-3 justify-start md:justify-center overflow-x-auto pb-1 scrollbar-hide"></div>
        </div>

        <div id="noResults" class="text-center py-8 hidden">
            <h3 id="no-results-title" class="text-xs font-semibold mb-1 text-slate-300 uppercase font-mono">Endpoint tidak ditemukan</h3>
            <p id="no-results-desc" class="text-[11px] text-slate-500">Coba gunakan kata kunci lain</p>
        </div>

        <div id="apiList" class="space-y-3"></div>

        <footer id="siteFooter" class="mt-12 pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500 font-mono uppercase">
            © Arulz-XD REST API
        </footer>
    </div>

    <div id="imageLightbox" class="fixed inset-0 bg-slate-950/90 z-[100] hidden flex items-center justify-center p-4 cursor-zoom-out">
        <div class="relative max-w-3xl max-h-[90vh] flex items-center justify-center">
            <img id="lightboxImage" src="" alt="Preview" class="max-w-full max-h-[85vh] rounded-lg border border-slate-700 object-contain" />
            <button id="closeLightbox" class="absolute -top-8 right-0 text-slate-400 hover:text-white focus:outline-none text-xs font-mono">
                ✕ Close
            </button>
        </div>
    </div>
    
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/moment.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/locale/id.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment-timezone/0.5.45/moment-timezone-with-data.min.js"></script>

<script class="notranslate" translate="no">
    window.musicPlaylist = ${JSON.stringify(playlist)};
    const displayApiKey = "${req.user ? (req.user.apikey) : 'Silakan Login'}";
</script>
<script src="script.js"></script>

<script>
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
                if (vipCustomBox) vipCustomBox.classList.remove('hidden');
            } else if (role.includes('premium')) {
                planText.textContent = 'PREM';
                if (vipCustomBox) vipCustomBox.classList.add('hidden');
            } else {
                planText.textContent = 'FREE';
                if (vipCustomBox) vipCustomBox.classList.add('hidden');
            }
        }

        async function saveCustomApiKey() {
            const input = document.getElementById('customApiKeyInput');
            if (!input || !input.value.trim()) {
                alert('Ketik API Key kustom terlebih dahulu!');
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
                alert('Terjadi kesalahan koneksi.');
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
                    alert('Avatar berhasil diperbarui!');
                } else {
                    alert(result.message || 'Gagal mengunggah avatar.');
                    if (userAvatarImg) userAvatarImg.src = oldSrc;
                    if (sidebarAvatarImg) sidebarAvatarImg.src = oldSrc;
                }
            } catch (error) {
                alert('Terjadi kesalahan koneksi.');
                if (userAvatarImg) userAvatarImg.src = oldSrc;
                if (sidebarAvatarImg) sidebarAvatarImg.src = oldSrc;
            } finally {
                if (userAvatarImg) userAvatarImg.style.opacity = '1';
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
                        '<div class="bg-slate-950 px-2 py-1 rounded text-slate-300 font-mono border border-slate-800">' + logText + '</div>'
                    ).join('');
                } else {
                    container.innerHTML = '<div class="text-slate-500 text-center py-1 font-mono">Belum ada aktivitas request</div>';
                }
            })
            .catch(err => {
                container.innerHTML = '<div class="text-red-400 text-center py-1 font-mono">Gagal memuat aktivitas</div>';
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
            fetchUserProfile();
        });

        function getPageDisplayName() {
            const path = window.location.pathname;
            let fileName = path.split('/').pop().replace('.html', '').toLowerCase();

            if (!fileName || fileName === '' || fileName === 'index') return 'Home';

            const pageMap = {
                'home': 'Home',
                'docs': 'Dokumentasi',
                'doc': 'Dokumentasi',
                'status': 'Status Server',
                'store': 'Store API',
                'changelog': 'Changelog',
                'uploader': 'Uploader File',
                'pastecode': 'Pastecode',
                'feedback': 'Feedback',
                'privacy': 'Kebijakan Privasi',
                'support': 'Dukungan Support',
                'login': 'Halaman Login'
            };

            if (pageMap[fileName]) return pageMap[fileName];
            return fileName.charAt(0).toUpperCase() + fileName.slice(1);
        }

        const pageName = getPageDisplayName();
        const loaderTitleEl = document.getElementById('loader-title-text');
        if (loaderTitleEl) {
            loaderTitleEl.innerHTML = 'Memuat ' + pageName + '<span class="animated-dots"></span>';
        }

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
                        showWelcomePopup();
                    }, 150);
                }
            }, 200);
        }

        const progressInterval = setInterval(() => {
            if (currentProgress < 90) {
                const increment = Math.random() * 25 + 15;
                updateProgress(currentProgress + increment);
            }
        }, 60);

        window.addEventListener('load', finishLoader);
        setTimeout(finishLoader, 800);
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
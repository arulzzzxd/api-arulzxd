const express = require('express');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const mongoose = require('mongoose');
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
const { fileTypeFromBuffer } = require("file-type");
const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const compression = require('compression');
const os = require('os');

const app = express();
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

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, default: null },
    provider: { type: String, default: 'local' },
    providerId: { type: String, default: null },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    apikey: { type: String, required: true, unique: true },
    role: { type: String, default: 'Free User' },
    avatar: { type: String, default: 'https://arulz-xd.my.id/files/X1F0Cn.png' }, 
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

const checkAuthSession = (req, res, next) => {
    const token = req.cookies.auth_session;
    if (!token) {
        req.user = null;
        return next();
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; 
        next();
    } catch (err) {
        res.clearCookie('auth_session');
        req.user = null;
        next();
    }
};

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

// Endpoint Upload / Ganti Avatar
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

            // Validasi Mime-Type melalui Multer Buffer & mime-types
            const mimeType = req.file.mimetype || mime.lookup(req.file.originalname) || 'image/png';
            if (!mimeType.startsWith('image/')) {
                return res.status(400).json({ status: false, message: 'File harus berupa gambar (JPG, PNG, GIF, WebP)!' });
            }

            // Ubah buffer ke Base64 Data URI
            const base64 = req.file.buffer.toString("base64");
            const avatarDataUrl = `data:${mimeType};base64,${base64}`;

            // Simpan ke database Mongoose User
            const updatedUser = await User.findByIdAndUpdate(
                req.user.id || req.user._id,
                { avatar: avatarDataUrl },
                { new: true }
            );

            if (!updatedUser) {
                return res.status(404).json({ status: false, message: 'User tidak ditemukan.' });
            }

            // Perbarui cookie session jika menggunakan JWT
            const userPayload = {
                id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                name: updatedUser.username,
                avatar: updatedUser.avatar,
                role: updatedUser.role,
                apiKey: updatedUser.apikey
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
                delayMs *= 1.5; // Backoff bertambah
            } else {
                throw error;
            }
        }
    }
}

const cacheSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now, expires: 60 } // Hapus otomatis setelah 60 detik
});

const CacheModel = mongoose.models.Cache || mongoose.model('Cache', cacheSchema);

const voucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    discount: { type: Number, required: true },
    type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    expiredAt: { type: Date, required: true },
    usageLimit: { type: Number, default: 20 },
    usedCount: { type: Number, default: 0 },
    usedBy: [{ type: String }], // Array penyimpan identifier (username/email/userId) agar 1 user hanya bisa 1x klaim
    createdAt: { type: Date, default: Date.now }
});

const Voucher = mongoose.models.Voucher || mongoose.model('Voucher', voucherSchema);

// Helper function untuk mengambil identifier user unik
function getUserIdentifier(req) {
    if (req.user) {
        return (req.user.email || req.user.username || req.user._id || "").toString().toLowerCase().trim();
    }
    const bodyIdentifier = req.body?.username || req.body?.email || req.body?.userIdentifier;
    if (bodyIdentifier) {
        return bodyIdentifier.toString().toLowerCase().trim();
    }
    return req.ip; // Fallback ke IP address jika guest/tanpa login
}

app.post('/api/vouchers/claim', async (req, res) => {
    try {
        const code = req.body.code;
        if (!code) {
            return res.status(400).json({ status: false, message: 'Kode voucher wajib diisi!' });
        }

        const cleanCode = code.trim().toUpperCase();
        const userIdentifier = getUserIdentifier(req);

        // Mengambil HANYA dari koleksi Voucher Mongoose
        const voucher = await Voucher.findOne({ code: cleanCode });
        
        if (!voucher) {
            return res.status(404).json({ status: false, message: 'Kode voucher tidak ditemukan!' });
        }

        // 1. Cek Kuota Penggunaan (Jika usageLimit <= 0 maka kuota habis & tidak bisa digunakan lagi)
        if (voucher.usageLimit <= 0) {
            return res.status(400).json({ 
                status: false, 
                reason: 'limit_reached',
                message: 'Kuota penggunaan voucher ini sudah habis!' 
            });
        }

        // 2. Cek apakah User sudah pernah menggunakan voucher ini
        if (voucher.usedBy && voucher.usedBy.includes(userIdentifier)) {
            return res.status(400).json({
                status: false,
                reason: 'already_used',
                message: 'Anda sudah pernah menggunakan voucher ini sebelumnya!'
            });
        }

        // 3. Cek Kedaluwarsa
        if (new Date() > new Date(voucher.expiredAt)) {
            return res.status(400).json({ 
                status: false, 
                reason: 'expired',
                message: 'Voucher telah kedaluwarsa!' 
            });
        }

        // Update kuota & batasi limit
        voucher.usedCount += 1;
        voucher.usageLimit = Math.max(0, voucher.usageLimit - 1); // Pengurangan batas limit hingga mencapai minimal 0

        if (!voucher.usedBy) voucher.usedBy = [];
        voucher.usedBy.push(userIdentifier);

        await voucher.save();

        // Response konsisten dengan properti 'voucher' & 'data'
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

// Endpoint GET untuk mendukung pencarian langsung berdasarkan URL parameter
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

        // Cek Kuota Penggunaan
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
    paymentNumber: { type: String, default: null }, // QRIS String / URL
    paymentMethod: { type: String, default: "QRIS" },
    status: { type: String, default: "pending" }, // pending, settlement, paid, success, failed, cancelled
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

function verifyPaywuzSignature(rawBody, receivedSignature, apiKey) {
    if (!receivedSignature) return false;

    const computedSignature = "sha256=" + crypto
        .createHmac("sha256", apiKey)
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

// ==========================================
// 1. POST /transactions (CREATE TRANSACTION)
// ==========================================
app.post('/transactions', async (req, res) => {
    try {
        const { orderId, amount, itemDetails } = req.body;

        if (!orderId || !amount) {
            return res.status(400).json({ 
                status: false,
                error: "INVALID_PAYLOAD", 
                message: "orderId dan amount wajib diisi!" 
            });
        }

        // --- IDEMPOTENSI: Jika orderId sudah ada, kembalikan data eksis ---
        const existingTrx = await Transaction.findOne({ orderId });
        if (existingTrx) {
            return res.json({
                status: true,
                data: existingTrx
            });
        }

        const inputAmount = Number(amount);

        // Request ke PayWuz API menggunakan helper retry dengan backoff
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
            const pathProduk = path.join(__dirname, 'database', 'produk.json');
            if (fs.existsSync(pathProduk)) {
                const products = JSON.parse(fs.readFileSync(pathProduk, 'utf8'));
                const matchedProduct = products.find(p => p.nama === itemDetails.nama);
                if (matchedProduct) pLink = matchedProduct.link || null;
            }
        }

        const expiredAt = new Date(Date.now() + 15 * 60 * 1000);

        const newTransaction = new Transaction({
            orderId,
            amount: finalAmount,
            paymentNumber: qrisNumber,
            paymentMethod: "QRIS",
            status: (transactionData.status || "pending").toLowerCase(),
            itemDetails: itemDetails || null,
            productLink: pLink,
            expiredAt: expiredAt
        });

        await newTransaction.save();

        // FIX: Tambahkan properti 'status: true' agar terbaca sukses oleh Frontend
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

// ==========================================
// 2. GET /transactions/:orderId (CHECK STATUS WITH CACHE)
// ==========================================
app.get('/transactions/:orderId', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        const { orderId } = req.params;

        // 1. Ambil dari MongoDB Cache terlebih dahulu (Cache-First Pattern)
        const cachedData = await getCache(`trx_${orderId}`);
        if (cachedData) {
            return res.json({ data: cachedData });
        }

        // 2. Jika tidak ada di Cache, baca dari MongoDB Database
        let localTrx = await Transaction.findOne({ orderId });

        if (!localTrx) {
            return res.status(404).json({ 
                error: "TRANSACTION_NOT_FOUND", 
                message: "Transaksi tidak ditemukan" 
            });
        }

        // Cek kedaluwarsa waktu transaksi
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

        // Pencocokan Link Produk
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

        // Simpan hasil ke Cache MongoDB
        await setCache(`trx_${orderId}`, responseData);

        // Standard Success Response Envelope
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

// ==========================================
// 3. POST /transactions/:orderId/cancel (CANCEL TRANSACTION)
// ==========================================
app.post('/transactions/:orderId/cancel', async (req, res) => {
    try {
        const { orderId } = req.params;

        const cancelRes = await axiosPaywuzWithRetry({
            method: 'post',
            url: `${PAYWUZ_BASE_URL}/transactions/${orderId}/cancel`,
            headers: PAYWUZ_HEADERS
        });

        await Transaction.findOneAndUpdate(
            { orderId },
            { status: "cancelled", updatedAt: new Date() }
        );

        await deleteCache(`trx_${orderId}`);
        scheduleTransactionDeletion(orderId);

        res.json({
            data: cancelRes.data?.data || cancelRes.data || { orderId, status: "cancelled" }
        });

    } catch (error) {
        console.error("Error Cancel TRX:", error.response?.data || error.message);
        res.status(500).json({
            error: "CANCEL_TRANSACTION_FAILED",
            message: error.response?.data?.message || error.message || "Gagal membatalkan transaksi"
        });
    }
});

// ==========================================
// 4. POST /webhook (RECEIVE PAYWUZ EVENT)
// ==========================================
app.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-paywuz-signature'];

        // Gunakan req.rawBody jika ada, atau fallback ke req.body jika kosong
        const payloadToVerify = req.rawBody || req.body;

        // Verifikasi Signature
        const isValid = verifyPaywuzSignature(payloadToVerify, signature, PAYWUZ_API_KEY);

        if (!isValid) {
            console.warn("⚠️ Signature Webhook tidak valid atau tidak cocok!");
            if (process.env.NODE_ENV === 'production') {
                return res.status(401).json({ 
                    error: "INVALID_SIGNATURE", 
                    message: "Signature webhook tidak valid!" 
                });
            }
        }

        const payload = req.body;
        const eventName = payload?.event || payload?.type; 
        const payloadData = payload?.data || payload;
        const orderId = payloadData?.orderId;
        const status = payloadData?.status ? payloadData.status.toLowerCase() : null;

        if (!orderId) {
            return res.status(400).json({ 
                error: "MISSING_ORDER_ID", 
                message: "orderId tidak ditemukan pada payload webhook!" 
            });
        }

        // 2. Update Database & Proses Kredit Saldo / Event
        if (orderId && status) {
            let localTrx = await Transaction.findOne({ orderId });

            if (localTrx) {
                const prevStatus = localTrx.status.toLowerCase();
                localTrx.status = status;
                localTrx.updatedAt = new Date();

                // Dengarkan khusus event transaction.paid (atau status paid/settlement)
                const isPaidEvent = eventName === "transaction.paid" || ["paid", "settlement", "success"].includes(status);

                if (isPaidEvent && prevStatus !== "paid" && prevStatus !== "settlement") {
                    console.log(`⚡ [TRANSACTION.PAID] Order ID ${orderId} lunas. Memproses kredit saldo merchant...`);

                    if (!localTrx.productLink && localTrx.itemDetails?.nama) {
                        const pathProduk = path.join(__dirname, 'database', 'produk.json');
                        if (fs.existsSync(pathProduk)) {
                            try {
                                const products = JSON.parse(fs.readFileSync(pathProduk, 'utf8'));
                                const targetNama = localTrx.itemDetails.nama.trim().toLowerCase();
                                const matchedProduct = products.find(p => p.nama && p.nama.trim().toLowerCase() === targetNama);

                                if (matchedProduct && matchedProduct.link) {
                                    localTrx.productLink = matchedProduct.link;
                                }
                            } catch (parseErr) {}
                        }
                    }
                }

                await localTrx.save();

                // Invalidate Cache
                await deleteCache(`trx_${orderId}`);

                // Jadwalkan Hapus
                if (["settlement", "success", "paid", "settled", "failed", "cancelled"].includes(status)) {
                    scheduleTransactionDeletion(orderId);
                }
            }
        }

        // Standard Success Response Envelope
        return res.status(200).json({ 
            data: {
                message: "Webhook diproses dengan sukses",
                orderId
            }
        });

    } catch (err) {
        console.error("Webhook Error:", err);
        return res.status(500).json({ 
            error: "WEBHOOK_PROCESSING_ERROR", 
            message: "Terjadi kesalahan internal saat memproses webhook" 
        });
    }
});

app.use(compression()); 
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

// --- ROUTE-ROUTE ---
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
                const emailOrLogin = (user.email || user.username || "").toLowerCase().trim();
                const currentUsername = (user.username || "").toLowerCase().trim();

                let updatedRole = user.role || 'Free User';
                let updatedApiKey = user.apikey;

                const premiumListLower = PREMIUM_USERS.map(u => u.toLowerCase().trim());
                const vipKeysLower = Object.keys(VIP_USERS).map(k => k.toLowerCase().trim());

                if (vipKeysLower.includes(emailOrLogin) || vipKeysLower.includes(currentUsername)) {
                    updatedRole = 'VIP User';
                    const exactKey = Object.keys(VIP_USERS).find(k => k.toLowerCase().trim() === emailOrLogin || k.toLowerCase().trim() === currentUsername);
                    updatedApiKey = VIP_USERS[exactKey];
                } 
                else if (premiumListLower.includes(emailOrLogin) || premiumListLower.includes(currentUsername)) {
                    if (updatedRole !== 'Premium User' || !updatedApiKey.startsWith('arulz-')) {
                        updatedRole = 'Premium User';
                        const randomHex = crypto.randomBytes(2).toString('hex'); 
                        updatedApiKey = `arulz-${currentUsername}-${randomHex}`;
                    }
                }

                if (user.role !== updatedRole || user.apikey !== updatedApiKey) {
                    await User.findByIdAndUpdate(user._id, {
                        role: updatedRole,
                        apikey: updatedApiKey
                    });
                    user.role = updatedRole;
                    user.apikey = updatedApiKey;
                }

                const userPayload = {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    name: user.username,
                    avatar: user.avatar || 'https://arulz-xd.my.id/files/X1F0Cn.png',
                    role: updatedRole,     
                    apiKey: updatedApiKey   
                };

                const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

                res.cookie('auth_session', token, {
                    maxAge: 7 * 24 * 60 * 60 * 1000, 
                    httpOnly: true,
                    secure: true, 
                    sameSite: 'lax'
                });

                return res.redirect('/');

            } catch (error) {
                console.error("Gagal sinkronisasi data premium saat login:", error);
                return next(error);
            }
        });
    })(req, res, next);
});

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

        let userRole = 'Free User';
        let userApiKey = generateRandomApiKey(); 

        const premiumListLower = PREMIUM_USERS.map(u => u.toLowerCase().trim());
        const vipKeysLower = Object.keys(VIP_USERS).map(k => k.toLowerCase().trim());

        if (vipKeysLower.includes(cleanEmail) || vipKeysLower.includes(cleanUsername.toLowerCase())) {
            userRole = 'VIP User';
            const exactKey = Object.keys(VIP_USERS).find(k => k.toLowerCase().trim() === cleanEmail || k.toLowerCase().trim() === cleanUsername.toLowerCase());
            userApiKey = VIP_USERS[exactKey];
        } 
        else if (premiumListLower.includes(cleanEmail) || premiumListLower.includes(cleanUsername.toLowerCase())) {
            userRole = 'Premium User';
            const randomHex = crypto.randomBytes(2).toString('hex'); 
            userApiKey = `arulz-${cleanUsername.toLowerCase()}-${randomHex}`;
        }

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
            apiKey: newUser.apikey
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
            return sendSweetAlert(res, 'success', 'Berhasil!', 'Pendaftaran berhasil! Selamat datang.', '/docs?showProfile=true');
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
        return res.redirect('/docs?showProfile=true'); 
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


const JWT_SECRET = process.env.JWT_SECRET || 'arulzxd-super-secret-jwt-key-999';

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

app.use(checkAuthSession);

function generateRandomApiKey() {
    return 'arulzfree-' + crypto.randomBytes(4).toString('hex');
}

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
            let userRole = 'Free User';
            let userApiKey = generateRandomApiKey(); 

            const premiumListLower = PREMIUM_USERS.map(u => u.toLowerCase().trim());
            const vipKeysLower = Object.keys(VIP_USERS).map(k => k.toLowerCase().trim());

            if (vipKeysLower.includes(finalEmail) || vipKeysLower.includes(currentUsername)) {
                userRole = 'VIP User';
                const exactKey = Object.keys(VIP_USERS).find(k => k.toLowerCase().trim() === finalEmail || k.toLowerCase().trim() === currentUsername);
                userApiKey = VIP_USERS[exactKey];
            } 
            else if (premiumListLower.includes(finalEmail) || premiumListLower.includes(currentUsername)) {
                userRole = 'Premium User';
                const randomHex = crypto.randomBytes(2).toString('hex'); 
                userApiKey = `arulz-${userData.login.toLowerCase()}-${randomHex}`;
            }

            dbUser = new User({
                username: currentUsername,
                email: finalEmail,
                provider: 'github',
                providerId: String(userData.id),
                apikey: userApiKey,
                role: userRole,
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
            apiKey: dbUser.apikey
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
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: GOOGLE_CALLBACK_URL
        });

        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userData = userResponse.data;
        const email = userData.email.toLowerCase().trim();
        const currentUsername = (userData.login || email.split('@')[0]).toLowerCase().trim();

        let dbUser = await User.findOne({ email: email });

        if (!dbUser) {
            let userRole = 'Free User';
            let userApiKey = generateRandomApiKey(); 

            const premiumListLower = PREMIUM_USERS.map(u => u.toLowerCase().trim());
            const vipKeysLower = Object.keys(VIP_USERS).map(k => k.toLowerCase().trim());

            if (vipKeysLower.includes(email) || vipKeysLower.includes(currentUsername)) {
                userRole = 'VIP User';
                const exactKey = Object.keys(VIP_USERS).find(k => k.toLowerCase().trim() === email || k.toLowerCase().trim() === currentUsername);
                userApiKey = VIP_USERS[exactKey];
            } 
            else if (premiumListLower.includes(email) || premiumListLower.includes(currentUsername)) {
                userRole = 'Premium User';
                const randomHex = crypto.randomBytes(2).toString('hex'); 
                userApiKey = `arulz-${currentUsername}-${randomHex}`;
            }

            dbUser = new User({
                username: currentUsername,
                email: email,
                provider: 'google',
                providerId: String(userData.id),
                apikey: userApiKey,
                role: userRole,
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
            apiKey: dbUser.apikey
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

app.get('/api/user-status', (req, res) => {
    if (req.user) {
        res.json({
            loggedIn: true,
            user: {
                name: req.user.name,
                username: req.user.username,
                email: req.user.email,
                avatar: req.user.avatar,
                apiKey: req.user.apiKey,
                role: req.user.role
            }
        });
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
const PREMIUM_USERS = require('./database/PREMIUM_USERS');
const VIP_USERS = require('./database/VIP_USERS');

const localFileUploader = fileUpload({
    createParentPath: true,
    limits: { fileSize: 100 * 1024 * 1024 }, 
});

const title = "API-ARULZXD - REST";
const favicon = "https://arulz-xd.my.id/files/UBkDZZ.png";
const logo = "https://arulz-xd.my.id/files/33s7XJ.png";
const headertitle = `<img src="https://readme-typing-svg.demolab.com?font=Poppins&weight=700&size=28&pause=1000&color=00D4FF&center=true&vCenter=true&width=600&lines=Welcome+To+ArulzXD+API;Fast+%F0%9F%9A%80+Reliable+%E2%9A%A1;Free+REST+API+Services;Developer+Friendly+API" alt="Typing SVG" class="mx-auto" />`;
const headerdescription = "Browse, inspect & fire requests against live endpoints._";
const footer = "© Arulz-XD";

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

function isVipAuthorized(identifierObj, providedKey) {
    if (!identifierObj) return false;

    const userEmail = (identifierObj.email || "").toLowerCase().trim();
    const username = (identifierObj.username || "").toLowerCase().trim();

    const exactVipKey = Object.keys(VIP_USERS).find(k => {
        const cleanK = k.toLowerCase().trim();
        return (cleanK && (cleanK === userEmail || cleanK === username));
    });

    if (!exactVipKey) return false;
    return VIP_USERS[exactVipKey] === providedKey;
}

const USER_LIMIT_TRACKER = {};
function getUserMaxLimit(keyType) {
    if (keyType === 'vip') return Infinity;
    if (keyType === 'premium') return 1000;
    return 100;
}

function getApiKeyType(userKey, user = null) {
    if (!userKey) return 'free';

    const isVipKeyString = Object.values(VIP_USERS).includes(userKey);
    if (isVipKeyString) {
        if (user && isVipAuthorized(user, userKey)) {
            return 'vip';
        }
        return 'free'; 
    }

    if (userKey.startsWith('arulz-') && userKey.split('-').length >= 3) {
        return 'premium';
    }
    return 'free';
}

app.get('/api/user-limit', (req, res) => {
    let userKey = req.query.apikey || req.headers['x-api-key'];

    if (!userKey && req.user && req.user.apiKey) {
        userKey = req.user.apiKey;
    }

    if (!userKey) {
        return res.json({ loggedIn: false, limitUsed: 0, maxLimit: 100, type: 'free' });
    }

    const keyType = getApiKeyType(userKey, req.user);
    const maxLimit = getUserMaxLimit(keyType);

    if (USER_LIMIT_TRACKER[userKey] === undefined) {
        USER_LIMIT_TRACKER[userKey] = 0;
    }

    res.json({
        loggedIn: !!req.user,
        limitUsed: USER_LIMIT_TRACKER[userKey],
        maxLimit: maxLimit === Infinity ? "Unlimited" : maxLimit,
        type: keyType
    });
});

const getLimitMessage = (keyType, limitCount) => {
    if (keyType === 'premium') {
        return `Limit API Key Premium Anda telah habis (Maks ${limitCount} req/hari). Silakan upgrade ke paket VIP untuk menikmati akses Unlimited tanpa batasan limit!`;
    }

    return `Limit API Key Free Anda telah habis (Maks ${limitCount} req/hari). Silakan upgrade ke paket Premium (1.000 req/hari) atau VIP (Unlimited) untuk melanjutkan!`;
};

const validateApiKey = async (req, res, next) => {
    if (req.path === '/apilist') {
        return next();
    }

    let userKey = req.query.apikey || req.body?.apikey || req.files?.apikey || req.file?.apikey || req.headers['x-api-key'];

    if (!userKey && req.user && req.user.apiKey) {
        userKey = req.user.apiKey;
    }

    if (!userKey) {
        return res.status(403).json({
            status: false,
            creator: "Arulz-XD",
            message: "API Key mana? masukkan parameter ?apikey=MasukkanApiKey"
        });
    }

    const isVipKeyString = Object.values(VIP_USERS).includes(userKey);
    let callerUser = req.user || null;

    if (!callerUser) {
        const callerIdentifier = req.query.username || req.body?.username || req.headers['x-username'] || 
                                 req.query.email || req.body?.email || req.headers['x-email'];

        if (callerIdentifier) {
            const cleanIdentifier = callerIdentifier.toLowerCase().trim();
            callerUser = await User.findOne({
                $or: [{ username: cleanIdentifier }, { email: cleanIdentifier }]
            });
        }
    }

    if (isVipKeyString) {
        if (!callerUser || !isVipAuthorized(callerUser, userKey)) {
            return res.status(403).json({
                status: false,
                creator: "Arulz-XD",
                message: "Akses Ditolak! API Key VIP ini terproteksi dan TIDAK BISA digunakan oleh pengguna publik."
            });
        }
    }

    if (!callerUser) {
        try {
            callerUser = await User.findOne({ apikey: userKey });
        } catch (dbErr) {
            console.error("Gagal verifikasi API Key di Database:", dbErr.message);
            return res.status(500).json({ status: false, message: "Internal server error." });
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

    try {
        const pathParts = req.path.split('/');
        const currentCategory = pathParts[1]; 
        const currentRouteName = pathParts[2];   

        if (currentCategory && currentRouteName) {
            const routeFilePath = path.join(apiPath, currentCategory, `${currentRouteName}.js`);
            if (fs.existsSync(routeFilePath)) {
                const routeModule = require(routeFilePath);

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
        }

        next();
    } catch (e) {
        console.error("Gagal memvalidasi status/type router:", e.message);
        return res.status(500).json({ status: false, message: "Internal server error." });
    }
};

const trackAndEnforceLimit = (req, res, next) => {
    if (req.path === '/apilist') return next();

    const userKey = req.activeApiKey || req.query.apikey || req.body?.apikey || req.headers['x-api-key'];
    if (!userKey) return next();

    const keyType = getApiKeyType(userKey, req.user);
    const maxLimit = getUserMaxLimit(keyType);

    if (USER_LIMIT_TRACKER[userKey] === undefined) {
        USER_LIMIT_TRACKER[userKey] = 0;
    }

    if (keyType !== 'vip' && USER_LIMIT_TRACKER[userKey] >= maxLimit) {
        return res.status(429).json({
            status: false,
            creator: "ArulzXD",
            message: getLimitMessage(keyType, maxLimit)
        });
    }

    if (keyType !== 'vip') {
        USER_LIMIT_TRACKER[userKey] += 1;
    }

    next();
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
        const userKey = req.activeApiKey || req.query.apikey || req.body?.apikey || req.headers['x-api-key'];
        return getApiKeyType(userKey, req.user) === 'vip';
    },
    max: (req, res) => {
        const userKey = req.activeApiKey || req.query.apikey || req.body?.apikey || req.headers['x-api-key'];
        if (getApiKeyType(userKey, req.user) === 'premium') return 1000;
        return 100; 
    },
    handler: (req, res) => {
        const userKey = req.activeApiKey || req.query.apikey || req.body?.apikey || req.headers['x-api-key'];
        const keyType = getApiKeyType(userKey, req.user);
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

const router = express.Router();
const apiPath = path.join(__dirname, 'api');

router.use(validateApiKey);

const endpointDirs = fs.readdirSync(apiPath).filter(f => fs.statSync(path.join(apiPath, f)).isDirectory());

for (const category of endpointDirs) {
  const categoryPath = path.join(apiPath, category);
  const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const routeName = path.basename(file, '.js');
    const route = require(path.join(categoryPath, file));
    router.use(`/${category}/${routeName}`, route);
  }
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

  subRouter.stack.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      
      // Default: Selalu sediakan apikey sebagai parameter pertama
      let params = { apikey: "" }; 

      // 1. Jika router menyediakan konfigurasi khusus paramsConfig
      if (route.paramsConfig) {
        params = { apikey: "", ...route.paramsConfig };
      } 
      // 2. Jika tidak ada paramsConfig, gunakan regex matcher
      else if (layer.route.stack && layer.route.stack.length) {
        layer.route.stack.forEach(mw => {
          if (!mw.handle) return;
          const fnString = mw.handle.toString();

          // Ekstraksi req.query
          [...fnString.matchAll(/req\.query\.([a-zA-Z0-9_]+)/g)].forEach(match => {
            params[match[1]] = "";
          });

          // Ekstraksi req.body
          [...fnString.matchAll(/req\.body\.([a-zA-Z0-9_]+)/g)].forEach(match => {
            params[match[1]] = "";
          });
        });
      }

      // Auto-fallback jika method POST/PUT/PATCH tidak mendeteksi parameter lain
      if (methods.some(m => ["POST", "PUT", "PATCH"].includes(m)) && Object.keys(params).length <= 1) {
        params.fileToUpload = "file";
      }

      endpoints.push({
        name: `/${category}/${file.replace(/\.js$/, "")}`,
        path: `/api/${category}/${file.replace(/\.js$/, "")}`,
        desc: `/${category}/${file.replace(/\.js$/, "")}`,
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

app.use('/api', validateApiKey, trackAndEnforceLimit, apiKeyLimiter, router);

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

app.get('/database/produk', (req, res) => {
    const pathProduk = path.join(__dirname, 'database', 'produk.json'); 

    fs.readFile(pathProduk, 'utf8', (err, data) => {
        if (err) {
            console.error("Gagal membaca database produk:", err);
            return res.status(500).json({ error: "Gagal memuat data produk" });
        }
        try {
            const produk = JSON.parse(data);
            res.json(produk);
        } catch (parseError) {
            res.status(500).json({ error: "Format database produk rusak" });
        }
    });
});

app.get('/store', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'store.html'));
});

// Endpoint untuk menyajikan halaman HTML Changelog
app.get('/changelog', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'changelog.html'));
});

// Endpoint untuk mengambil JSON data Changelog
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
    <title>${title}</title>
    <link id="faviconLink" rel="icon" type="image/x-icon" href="${favicon}">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles.css" />
    
    <style>
    :root {
        --neon-cyan: #00f3ff;
        --neon-glow: rgba(0, 243, 255, 0.4);
        --bg-dark: #030712;
        --bg-card: rgba(15, 23, 42, 0.75);
        --border-color: rgba(0, 243, 255, 0.2);
    }

    html.light {
        --neon-cyan: #008b9b;
        --neon-glow: rgba(0, 139, 155, 0.25);
        --bg-dark: #f0fdfa;
        --bg-card: rgba(255, 255, 255, 0.85);
        --border-color: rgba(0, 139, 155, 0.3);
    }

    html {
        scroll-behavior: smooth;
    }
    .bg-dots-light {
        background-color: #ffffff;
        background-image: radial-gradient(#e2e8f0 1.5px, transparent 1.5px);
        background-size: 24px 24px;
    }

    .bg-dots-dark {
        background-color: #0f172a;
        background-image: radial-gradient(rgba(255, 255, 255, 0.15) 1.5px, transparent 1.5px);
        background-size: 24px 24px;
    }
    #themeBg {
        transition: background-color 0.3s ease, background-image 0.3s ease;
    }
    body {
        transition: background 0.25s ease, color 0.25s ease;
    }
    
    .glass-panel {
        background: #0b1329;
        border: 1px solid rgba(6, 182, 212, 0.08);
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
    }
    
    .light-mode .glass-panel {
        background: #ffffff;
        border: 1px solid rgba(15, 23, 42, 0.08);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
    }

    .light-mode {
        color: #0f172a !important;
    }
    .light-mode #mainTitle { color: #0f172a !important; }
    .light-mode #mainDescription { color: #334155 !important; }
    .light-mode #stat-battery-title,
    .light-mode #stat-endpoints-title,
    .light-mode #stat-categories-title { color: #475569 !important; }
    .light-mode #siteFooter { color: #64748b !important; border-color: rgba(0,0,0,0.06); }
    .light-mode #no-results-title { color: #0f172a !important; }

    .light-mode .music-player-card {
        background: #ffffff !important;
        border-color: rgba(0, 0, 0, 0.08) !important;
    }
    .light-mode .music-text-title { color: #0f172a !important; }
    .light-mode .music-text-artist { color: #475569 !important; }
    .light-mode .music-progress-bar-bg { background-color: rgba(0,0,0,0.06) !important; }
    
    .light-mode .music-btn-nav {
        background-color: #ffffff !important;
        border-color: rgba(0,0,0,0.08) !important;
        color: #1e293b !important;
    }
    .light-mode .music-btn-nav:hover {
        background-color: #f1f5f9 !important;
        color: #0f172a !important;
    }
    
    .lang-btn {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: bold;
        padding: 4px 12px;
        border: 1px solid #1e293b;
        background-color: #0f172a;
        color: #94a3b8;
        transition: all 0.2s ease;
    }
    .lang-btn.active {
        background-color: #06b6d4;
        color: #020617;
        border-color: #06b6d4;
    }

    .filter-btn {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        padding: 8px 14px;
        border: 1px solid rgba(6, 182, 212, 0.15);
        background: rgba(6, 182, 212, 0.03);
        color: #94a3b8;
        transition: all 0.2s ease;
        border-radius: 10px;
        white-space: nowrap;
        cursor: pointer;
    }
    .filter-btn:hover {
        background: rgba(6, 182, 212, 0.08);
        color: #e2e8f0;
    }
    .filter-btn.active {
        background-color: #06b6d4 !important;
        color: #020617 !important;
        border-color: #06b6d4 !important;
        font-weight: bold;
    }
    .light-mode .filter-btn {
        border-color: rgba(15, 23, 42, 0.08);
        background: rgba(15, 23, 42, 0.03);
        color: #475569;
    }
    .light-mode .filter-btn:hover {
        background: rgba(15, 23, 42, 0.06);
    }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    
    .border-3d-free {
        background: linear-gradient(135deg, #059669 0%, #34d399 50%, #065f46 100%);
        box-shadow: inset 0 2px 4px rgba(255,255,255,0.4), 0 4px 12px rgba(0,0,0,0.5);
    }
    .border-3d-premium {
        background: linear-gradient(135deg, #b45309 0%, #fbbf24 30%, #ffffff 50%, #f59e0b 70%, #78350f 100%);
        box-shadow: inset 0 3px 5px rgba(255,255,255,0.6), 0 0 20px rgba(251,191,36,0.5), 0 6px 14px rgba(0,0,0,0.6);
    }
    .border-3d-vip {
        background: linear-gradient(135deg, #6b21a8 0%, #c084fc 30%, #ffffff 50%, #a855f7 70%, #4c1d95 100%);
        box-shadow: inset 0 3px 6px rgba(255,255,255,0.7), 0 0 25px rgba(168,85,247,0.6), 0 8px 18px rgba(0,0,0,0.6);
    }

    #cyber-loader-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background-color: var(--bg-dark);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.6s ease;
    }

    #cyber-loader-overlay.fade-out {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
    }

    .scanner-beam {
        position: absolute;
        top: 0;
        left: -100%;
        width: 300%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(0, 243, 255, 0.05), transparent);
        animation: scanAnimation 4s infinite linear;
    }
    @keyframes scanAnimation {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100%); }
    }

    .hud-ring {
        position: relative;
        width: 130px;
        height: 130px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .ring-outer {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 2px dashed var(--neon-cyan);
        opacity: 0.6;
        animation: spinClockwise 10s linear infinite;
        box-shadow: 0 0 15px var(--neon-glow);
    }

    .ring-middle {
        position: absolute;
        inset: 10px;
        border-radius: 50%;
        border: 2px solid transparent;
        border-top-color: var(--neon-cyan);
        border-bottom-color: var(--neon-cyan);
        animation: spinCounterClockwise 4s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
    }

    .ring-inner {
        position: absolute;
        inset: 20px;
        border-radius: 50%;
        border: 1px dotted var(--neon-cyan);
        opacity: 0.8;
        animation: spinClockwise 6s linear infinite;
    }

    .hud-avatar {
        width: 65px;
        height: 65px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--neon-cyan);
        box-shadow: 0 0 20px var(--neon-cyan);
        z-index: 10;
    }

    @keyframes spinClockwise { 100% { transform: rotate(360deg); } }
    @keyframes spinCounterClockwise { 100% { transform: rotate(-360deg); } }

    .animated-dots::after {
        content: '';
        display: inline-block;
        width: 1.5em;
        text-align: left;
        animation: dotsAnimation 1.5s steps(4, end) infinite;
    }
    @keyframes dotsAnimation {
        0% { content: ''; }
        25% { content: '.'; }
        50% { content: '..'; }
        75% { content: '...'; }
    }

    .neon-progress-bar {
        background: linear-gradient(90deg, #06b6d4, var(--neon-cyan));
        box-shadow: 0 0 12px var(--neon-cyan);
        transition: width 0.15s ease-out;
    }
</style>
</head>
<body class="min-h-screen antialiased bg-[#020617] text-slate-100 relative">

<div id="cyber-loader-overlay">
    <div class="scanner-beam"></div>

    <div class="hud-ring mb-6">
        <div class="ring-outer"></div>
        <div class="ring-middle"></div>
        <div class="ring-inner"></div>
        <img src="https://files.catbox.moe/1rr9zi.png" alt="Logo" class="hud-avatar">
    </div>

    <div class="text-center px-4">
        <div id="loader-title-text" class="text-sm font-extrabold tracking-widest uppercase text-cyan-400 code-font mb-1">
            Memuat Halaman<span class="animated-dots"></span>
        </div>
        <div class="text-[10px] text-slate-400 font-mono tracking-wider opacity-80 uppercase">
            SYSTEM INITIALIZING // CORE GATEWAY
        </div>
    </div>

    <div class="w-64 sm:w-80 mt-6">
        <div class="flex items-center justify-between text-xs font-bold code-font mb-2">
            <span class="text-slate-400 text-[10px]">SYSTEM STATUS</span>
            <span id="loader-percentage" class="text-cyan-400 text-sm">0%</span>
        </div>
        <div class="w-full h-2 bg-slate-900/90 rounded-full border border-cyan-500/30 overflow-hidden p-0.5">
            <div id="loader-progress-fill" class="h-full rounded-full neon-progress-bar w-0"></div>
        </div>
    </div>

    <div class="absolute bottom-6 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
        BACKEND DEV - ARULZ-XD API v2.0
    </div>
</div>

<div id="themeBg" class="fixed inset-0 -z-10"></div>

    <!-- Welcome Popup -->
    <div id="welcomePopup" class="fixed inset-0 z-[99999] hidden">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <div class="bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md relative p-6 font-['Space_Grotesk'] text-slate-100 transition-all duration-300">
          
          <button id="closePopupBtn" class="absolute top-4 right-4 text-slate-400 hover:text-red-400 transition-colors bg-white/5 hover:bg-white/10 rounded-full p-1.5 focus:outline-none border border-white/5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          
          <div class="text-center mb-4">
            <h1 class="text-xl sm:text-2xl font-extrabold text-white leading-tight tracking-wide">
              Welcome to<br><span class="text-cyan-400">Arulz-XD API</span>
            </h1>
          </div>
          
          <div class="mb-4 rounded-xl overflow-hidden border border-white/10 bg-black/40">
            <img src="https://arulz-xd.my.id/files/K4Sf61.png" alt="Welcome Banner" class="w-full h-auto object-cover max-h-48" />
          </div>
          
          <div class="text-center text-slate-300 text-xs sm:text-sm mb-5 px-1 leading-relaxed">
            <p>Halo! 👋 Selamat datang di Arulz-XD API. Terima kasih sudah berkunjung. API ini dibuat untuk membantu developer dengan berbagai fitur yang terus diperbarui. Silakan gunakan API Key di bawah ini.</p>
          </div>
          
          <div class="mb-5 flex justify-center">
            <div class="bg-black/30 rounded-full py-2 px-5 border-2 border-dashed border-cyan-500/30">
              <span class="font-bold text-xs sm:text-sm text-slate-200 tracking-wide">
                apikey : <span class="font-mono text-cyan-400 select-all">${req.user ? req.user.apiKey : 'Silakan Login'}</span>
              </span>
            </div>
          </div>
          
          <a href="/support" class="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all text-sm block text-center tracking-wider uppercase">
            Donate Sekarang
          </a>
        </div>
      </div>
    </div>
    
    <!-- User Profile Pop-up Modal -->
<div id="profilePopup" class="fixed inset-0 z-[99999] hidden">
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" onclick="closeProfilePopup()"></div>
  <div class="fixed inset-0 flex items-center justify-center p-4">
    <div class="w-full max-w-sm bg-slate-900/95 border border-white/10 rounded-2xl p-6 shadow-2xl relative font-['Space_Grotesk'] overflow-hidden">
        
        <div class="absolute -top-10 -left-10 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div class="flex flex-col items-center text-center mt-2 relative z-10">
            <!-- Input File Tersembunyi -->
            <input type="file" id="avatarInput" accept="image/*" class="hidden" onchange="uploadAvatarFile(this)">

            <div class="relative w-32 h-32 flex items-center justify-center mb-3">
                <div id="avatarBadge" class="absolute -top-5 z-20 transform scale-90"></div>
                
                <!-- Container Avatar dengan Tombol Kamera di Samping Bawah -->
                <div id="avatar3DBorder" onclick="document.getElementById('avatarInput').click()" class="w-24 h-24 rounded-full p-[4px] z-10 flex items-center justify-center transition-all duration-300 cursor-pointer group relative" title="Klik untuk ganti avatar">
                    <div class="w-full h-full rounded-full bg-slate-950 p-[2px] flex items-center justify-center shadow-inner overflow-hidden relative">
                        <img id="userAvatar" src="https://via.placeholder.com/150" alt="Avatar" class="w-full h-full rounded-full object-cover group-hover:scale-110 transition-transform duration-300">
                        
                        <!-- Overlay Hover -->
                        <div class="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <span class="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">Ubah</span>
                        </div>
                    </div>

                    <!-- SVG Logo Kamera Samping Bawah -->
                    <div class="absolute bottom-0 right-0 z-30 bg-cyan-500 hover:bg-cyan-400 text-slate-950 p-2 rounded-full border-2 border-slate-900 shadow-lg transition-transform duration-200 group-hover:scale-110 flex items-center justify-center">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                        </svg>
                    </div>
                </div>
            </div>

            <h2 id="userName" class="text-xl font-extrabold text-white tracking-wide mb-0.5">Loading...</h2>
            <p id="userEmail" class="text-slate-400 font-mono text-xs mb-5">loading-email@mail.com</p>
            
            <div class="w-full space-y-4 text-left mb-5">
                <div class="bg-slate-950/40 border border-white/5 rounded-xl p-3.5 flex flex-col gap-1">
                    <span class="text-[10px] text-cyan-400 font-mono tracking-wider uppercase font-bold opacity-80">Account Type / Role</span>
                    <div id="userRoleContainer" class="flex items-center gap-2 font-bold text-slate-200 text-sm">
                        <span id="userRole" class="flex items-center gap-1.5">Loading...</span>
                    </div>
                </div>

                <div class="bg-slate-950/40 border border-white/5 rounded-xl p-3.5 flex flex-col gap-2">
                    <div class="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium tracking-wide animate-pulse bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-400 block"></span>
                        Jangan bagikan API Key ini kepada siapapun!
                    </div>
                    
                    <div class="flex items-center justify-between mt-1">
                        <span class="text-[10px] text-cyan-400 font-mono tracking-wider uppercase font-bold opacity-80">Your Personal API Key</span>
                        <button onclick="copyText(document.getElementById('userApiKey').innerText, 'API Key')" class="text-slate-400 hover:text-cyan-400 transition-colors p-2 -mr-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5" title="Copy Key">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                        </button>
                    </div>
                    <div class="bg-slate-900/90 border border-white/5 p-2.5 rounded-lg font-mono text-xs text-amber-300 break-all select-all shadow-inner w-full max-h-16 overflow-y-auto scrollbar-hide">
                        <span id="userApiKey">loading-key-xxxx</span>
                    </div>
                </div>
            </div>

            <div class="w-full flex flex-col gap-3">
                <a href="/upgrade-apikey" class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 text-xs font-black py-3 px-4 rounded-xl transition duration-200 tracking-wider uppercase shadow-lg shadow-amber-500/10">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                    Upgrade
                </a>
                
                <div class="flex gap-3 w-full">
                    <button onclick="closeProfilePopup()" class="flex-1 bg-zinc-800 hover:bg-zinc-700 text-gray-200 text-xs font-bold py-3 px-4 rounded-xl transition duration-200 border border-white/5 tracking-wider uppercase">
                        Tutup
                    </button>
                    <a href="/auth/logout" class="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold py-3 px-4 rounded-xl transition duration-200 tracking-wider uppercase">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                        </svg>
                        Log Out
                    </a>
                </div>
            </div>

        </div>
    </div>
  </div>
</div>

<div id="toast" class="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none items-end"></div>

    <!-- Header Actions -->
    <div class="fixed top-6 right-6 z-40 flex items-center gap-3">
        <button id="bioMenuBtn" class="flex items-center justify-center w-10 h-10 rounded-xl glass-panel text-slate-300 hover:text-white shadow-lg transition-all active:scale-95 focus:outline-none light-mode:text-slate-700 light-mode:hover:text-slate-900 border border-white/5">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        </button>
    </div>

    <!-- Sidebar Dropdown -->
    <div id="bioDropdown" class="fixed top-0 right-0 h-full w-72 bg-[#060c18] border-l border-white/5 transform translate-x-full transition-transform duration-300 ease-in-out z-50 shadow-2xl flex flex-col p-6 font-['Space_Grotesk'] light-mode:bg-white light-mode:border-slate-200">
        <div class="flex items-center justify-between mb-5">
            <div class="flex gap-0 border border-white/10 rounded-lg p-0.5 bg-black/40">
                <button id="lang-id" class="lang-btn rounded-md active" onclick="setLanguage('id')">ID</button>
                <button id="lang-en" class="lang-btn rounded-md" onclick="setLanguage('en')">EN</button>
            </div>
            
            <div class="flex items-center gap-1.5">
                <button id="themeToggle" class="flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-95 focus:outline-none border border-white/10 bg-slate-900/50 text-white light-mode:bg-slate-100 light-mode:border-slate-300 light-mode:text-slate-900">
                    <svg id="theme-toggle-dark-icon" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                    </svg>
                    <svg id="theme-toggle-light-icon" class="w-4 h-4 hidden" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fill-rule="evenodd" clip-rule="evenodd"></path>
                    </svg>
                </button>

                <button id="closeMenuBtn" class="text-white hover:text-red-400 transition-colors p-1.5 border border-white/10 rounded bg-slate-900/40 light-mode:text-slate-700 light-mode:bg-slate-100 light-mode:border-slate-300 light-mode:hover:text-red-500">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        </div>

        ${req.user ? `
        <div class="mb-4 flex flex-col antialiased font-['Space_Grotesk']">
            <button onclick="openProfilePopup()" class="group relative flex items-center gap-3 bg-slate-950/80 text-white font-bold p-3 rounded-xl transition-all duration-300 text-xs tracking-wider uppercase overflow-hidden active:scale-95 border border-cyan-500/20 hover:border-cyan-500/40 shadow-lg w-full">
                <div class="relative flex-shrink-0 z-10">
                    <img src="${req.user.avatar}" class="w-8 h-8 rounded-full border border-white/20 object-cover shadow-sm">
                    <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-950 rounded-full"></span>
                </div>
                
                <div class="flex flex-col text-left min-w-0 z-10">
                    <span class="text-[8px] text-cyan-400 font-mono tracking-widest opacity-90">AUTHORIZED USER</span>
                    <span class="truncate text-white font-black tracking-wide normal-case text-xs shadow-sm">${req.user.username}</span>
                </div>

                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 ml-auto text-cyan-400 opacity-90 z-10 transition-transform group-hover:translate-x-1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
            </button>
        </div>
        ` : `
        <div class="mb-3 flex flex-col gap-2">
            <a href="/login" class="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-wider transition-all duration-200">
                <span>Masuk ke Akun</span>
            </a>
        </div>
        `}

        <nav class="flex flex-col gap-1.5 text-xs font-semibold tracking-wider uppercase text-slate-300 flex-1 py-1 overflow-y-auto scrollbar-hide">
    <div class="text-[10px] font-bold text-slate-500 px-2 pt-2 pb-1 tracking-widest">PAGES</div>

    <!-- Dashboard -->
    <a href="/" class="menu-link group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-cyan-950/30 transition-all duration-300">
        <div class="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all shrink-0">
            <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5 transform group-hover:scale-110 transition-transform duration-300" style="filter: drop-shadow(0 0 3px rgba(34, 211, 238, 0.8));">
                <path d="M3 11l9-9 9 9v11H3V11z" stroke="#22d3ee" stroke-width="1.5" stroke-linejoin="round" />
                <path d="M19 8v-3h-2v1.5M10 16h4v6h-4v-6z" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" />
                <path d="M7 13v6M9 13v6M7 16h2" stroke="#22d3ee" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M14 13v6l1.5-1.5 1.5 1.5v-6" stroke="#22d3ee" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M12 5v3M10 8h4" stroke="#22d3ee" stroke-width="0.5" stroke-linecap="round" />
                <circle cx="12" cy="5.5" r="0.5" fill="#22d3ee" />
                <circle cx="9" cy="9" r="0.4" fill="#22d3ee" />
                <circle cx="15" cy="9" r="0.4" fill="#22d3ee" />
            </svg>
        </div>
        <span class="font-medium text-cyan-100 group-hover:text-cyan-400 transition-colors duration-300">Dashboard</span>
    </a>

    <!-- Docs -->
    <a href="/docs" class="menu-link group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-cyan-950/30 transition-all duration-300">
        <div class="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all shrink-0">
            <svg viewBox="0 0 24 24" fill="none" class="w-5 h-5 transform group-hover:scale-110 transition-transform duration-300" style="filter: drop-shadow(0 0 3px rgba(34, 211, 238, 0.8));">
                <path d="M2 5c0-1.1.9-2 2-2h6.5l1.5 1.5L13.5 3H20c1.1 0 2 .9 2 2v13c0 1.1-.9 2-2 2h-6.5L12 18.5 10.5 20H4c-1.1 0-2-.9-2-2V5z" stroke="#22d3ee" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 6.5C3 5.7 3.7 5 4.5 5H11v13H4.5C3.7 18 3 17.3 3 16.5V6.5zM21 6.5c0-.8-.7-1.5-1.5-1.5H13v13h6.5c.8 0 1.5-.7 1.5-1.5V6.5z" stroke="#22d3ee" stroke-width="1.2" stroke-linejoin="round"/>
                <path d="M12 4v14.5" stroke="#22d3ee" stroke-width="1.2" stroke-linecap="round"/>
                <rect x="5.5" y="8" width="4.5" height="6.5" rx="0.8" stroke="#22d3ee" stroke-width="0.9" fill="none"/>
                <line x1="6.5" y1="10" x2="9" y2="10" stroke="#22d3ee" stroke-width="0.7" stroke-linecap="round"/>
                <line x1="6.5" y1="11.5" x2="9" y2="11.5" stroke="#22d3ee" stroke-width="0.7" stroke-linecap="round"/>
                <text x="16.8" y="11" fill="#22d3ee" font-size="2.6" font-weight="900" font-family="sans-serif" text-anchor="middle">DOCS</text>
            </svg>
        </div>
        <span class="font-medium text-cyan-100 group-hover:text-cyan-400 transition-colors duration-300">Docs</span>
    </a>

    <!-- Store -->
    <a href="/store" class="menu-link group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-cyan-950/30 transition-all duration-300">
        <div class="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all shrink-0">
            <svg class="w-4 h-4 text-cyan-400 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M4.756 5.272h15.744l-1.38 6.21a2.25 2.25 0 01-2.195 1.762H7.27a2.25 2.25 0 01-2.196-1.762L3.636 3.835M7.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                <polygon points="12,5.5 13.09,7.71 15.54,8.07 13.77,9.8 14.19,12.24 12,11.09 9.81,12.24 10.23,9.8 8.46,8.07 10.91,7.71" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        </div>
        <span class="font-medium text-cyan-100 group-hover:text-cyan-400 transition-colors duration-300">Store</span>
    </a>

    <!-- Changelog -->
    <a href="/changelog" class="menu-link group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-cyan-950/30 transition-all duration-300">
        <div class="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all shrink-0">
            <svg class="w-4 h-4 text-cyan-400 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        </div>
        <span class="font-medium text-cyan-100 group-hover:text-cyan-400 transition-colors duration-300">Changelog</span>
    </a>

    <!-- Uploader -->
    <a href="/uploader" class="menu-link group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-cyan-950/30 transition-all duration-300">
        <div class="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all shrink-0">
            <svg class="w-4 h-4 text-cyan-400 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
        </div>
        <span class="font-medium text-cyan-100 group-hover:text-cyan-400 transition-colors duration-300">Uploader</span>
    </a>

    <!-- Pastecode -->
    <a href="/pastecode" class="menu-link group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-cyan-950/30 transition-all duration-300">
        <div class="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all shrink-0">
            <svg class="w-4 h-4 text-cyan-400 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
            </svg>
        </div>
        <span class="font-medium text-cyan-100 group-hover:text-cyan-400 transition-colors duration-300">Pastecode</span>
    </a>

    <!-- Feedback -->
    <a href="/feedback" class="menu-link group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-cyan-950/30 transition-all duration-300">
        <div class="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all shrink-0">
            <svg class="w-4 h-4 text-cyan-400 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 8.5h1.5A2.5 2.5 0 0 1 21 11v5a2.5 2.5 0 0 1-2.5 2.5H17v2.5l-3-2.5h-1" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.5 3.5h10A2.5 2.5 0 0 1 18 6v7a2.5 2.5 0 0 1-2.5 2.5H8.5L5 18.5V15.5H5.5A2.5 2.5 0 0 1 3 13V6a2.5 2.5 0 0 1 2.5-2.5Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 9.5h1.5l1-2 1.5 4 1.5-3h1" />
            </svg>
        </div>
        <span class="font-medium text-cyan-100 group-hover:text-cyan-400 transition-colors duration-300">Feedback</span>
    </a>

    <!-- Stats / Status -->
    <a href="/status" class="menu-link group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-cyan-950/30 transition-all duration-300">
        <div class="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all shrink-0">
            <svg class="w-4 h-4 text-cyan-400 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="6" rx="2" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="3" y="10.5" width="18" height="6" rx="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5v2M3 20.5h6.5m5 0H21"/>
                <circle cx="12" cy="20.5" r="1.5"/>
            </svg>
        </div>
        <span class="font-medium text-cyan-100 group-hover:text-cyan-400 transition-colors duration-300">Stats / Status</span>
    </a>

    <div class="text-[10px] font-bold text-slate-500 px-2 pt-3 pb-1 tracking-widest">LEGAL</div>

    <!-- Privacy Policy -->
    <a href="/privacy" class="menu-link group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-cyan-950/30 transition-all duration-300">
        <div class="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all shrink-0">
            <svg class="w-4 h-4 text-cyan-400 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 2.25c-3.6 0-6.818 1.433-9.176 3.766A.75.75 0 0 0 2.6 6.58C3.12 11.95 6.35 18.08 12 21.75c5.65-3.67 8.88-9.8 9.4-15.17a.75.75 0 0 0-.224-.564A12.986 12.986 0 0 0 12 2.25Z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10 8h2.8a2.2 2.2 0 0 1 0 4.4H10V8Zm0 0v8" />
            </svg>
        </div>
        <span class="font-medium text-cyan-100 group-hover:text-cyan-400 transition-colors duration-300">Privacy Policy</span>
    </a>

    <!-- Support -->
    <a href="/support" class="menu-link group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-cyan-950/30 transition-all duration-300">
        <div class="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all shrink-0">
            <svg class="w-4 h-4 text-cyan-400 transform group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M11 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M22 6v6m-3-3h6m-13 1h2m-2 4h4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 14.5a3 3 0 0 1-4.8 2.4l-1.2 1.2a1 1 0 0 1-1.4-1.4l1.2-1.2A3 3 0 1 1 16 14.5Zm0 0V21a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-4.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <span class="font-medium text-cyan-100 group-hover:text-cyan-400 transition-colors duration-300">Support</span>
      </a>
     </nav>
    </div>

    <div id="menuOverlay" class="fixed inset-0 bg-black/60 backdrop-blur-xs hidden z-30 transition-opacity duration-300"></div>

    <div class="max-w-5xl mx-auto px-4 py-8 relative z-10">
        <header id="api" class="mb-10 text-center">
            <div class="flex items-center justify-center gap-3 mb-3">
                <span class="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 light-mode:bg-cyan-100 light-mode:text-cyan-700">
                    <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span> ONLINE
                </span>
            </div>
            
            <div id="mainTitle" class="flex justify-center mb-3 min-h-[50px] items-center text-4xl md:text-5xl font-extrabold tracking-tight text-white">${headertitle}</div>
            <p id="mainDescription" class="text-sm md:text-base font-normal tracking-wide text-slate-400 max-w-xl mx-auto leading-relaxed">${headerdescription}</p>
            
            <div class="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                <div class="glass-panel flex flex-col items-center justify-center p-4 rounded-xl shadow-lg border border-white/5">
                    <div class="text-center font-['Space_Grotesk']">
                        <div id="liveClock" class="text-xl md:text-2xl font-extrabold tracking-wider text-cyan-400 light-mode:text-cyan-600 font-mono">
                            00:00:00
                        </div>
                        <div id="liveDate" class="text-[9px] font-bold opacity-60 tracking-wide mt-1 uppercase">
                            Loading...
                        </div>
                    </div>
                </div>
                
                <div class="glass-panel flex flex-col items-center justify-center p-4 rounded-xl shadow-lg border border-white/5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">Limit Terpakai</span>
                    <div class="flex items-baseline gap-0.5 mt-0.5">
                        <span id="userLimitUsed" class="text-2xl font-black text-cyan-400">0</span>
                        <span class="text-slate-500 font-bold text-xs">/</span>
                        <span id="userLimitMax" class="text-xs font-bold text-slate-400">100</span>
                    </div>
                    <span id="userLimitBadge" class="text-[8px] font-bold px-1.5 py-0.5 mt-1 rounded bg-slate-900 text-slate-400 uppercase tracking-widest border border-white/5">FREE</span>
                </div>
                
                <div class="glass-panel flex flex-col items-center justify-center p-4 rounded-xl shadow-lg border border-white/5">
                    <span id="stat-endpoints-title" class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Endpoint</span>
                    <span id="totalEndpoints" class="text-2xl font-black text-cyan-400 mt-0.5 light-mode:text-cyan-600">0</span>
                </div>
                
                <div class="glass-panel flex flex-col items-center justify-center p-4 rounded-xl shadow-lg border border-white/5">
                    <span id="stat-categories-title" class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Kategori</span>
                    <span id="totalCategories" class="text-2xl font-black text-cyan-400 mt-0.5 light-mode:text-cyan-600">0</span>
                </div>
            </div>

            <div class="glass-panel max-w-4xl mx-auto mt-4 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-cyan-500/10">
                <div class="flex items-center gap-2 text-xs md:text-sm text-cyan-400 light-mode:text-cyan-700 font-mono">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span class="underline break-all font-semibold">https://arulz-xd.my.id</span>
                </div>
                <a href="/feedback" 
                   class="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-bold text-[11px] uppercase rounded-lg shadow-md transition-all active:scale-95 light-mode:text-white text-center flex items-center justify-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Request Feature
                </a>
            </div>

            <div class="flex justify-center gap-4 mt-4 max-w-4xl mx-auto">
                <a href="https://whatsapp.com/channel/0029VbAwdIyJJhzRMpjUcS3P" 
                   target="_blank" 
                   class="flex-1 glass-panel py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition-all text-center flex items-center justify-center gap-2 border border-white/5 text-slate-300">
                   <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 10.742l.08-.08a2.25 2.25 0 013.182 0l.397.397m-1.397-1.398a2.25 2.25 0 00-3.182 0l-3.472 3.472a2.25 2.25 0 000 3.181l.08.08a2.25 2.25 0 003.181 0l3.472-3.472a2.25 2.25 0 000-3.181c-.074-.074-.154-.14-.237-.196zm7.708-.943a2.25 2.25 0 00-3.182 0l-.397.397m1.397-1.397a2.25 2.25 0 013.182 0l3.472 3.473a2.25 2.25 0 010 3.182l-.08.08a2.25 2.25 0 01-3.181 0l-3.472-3.472a2.25 2.25 0 010-3.181c.074-.074.154-.14.237-.196z" />
                   </svg>
                   Channel
                </a>
                <a href="https://chat.whatsapp.com/LBeGqVsmDBb6j29ysuusd9" 
                   target="_blank" 
                   class="flex-1 glass-panel py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition-all text-center flex items-center justify-center gap-2 border border-white/5 text-slate-300">
                   <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.998 5.998 0 00-12 0m12 0a5.998 5.998 0 00-12 0m12 0a5.998 5.998 0 00-12 0M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0 0l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.998 5.998 0 00-12 0m12 0a5.998 5.998 0 00-12 0" />
                   </svg>
                   Group
                </a>
            </div>

            <div class="music-player-card glass-panel mt-6 max-w-2xl mx-auto rounded-2xl p-4 shadow-xl relative overflow-hidden border border-white/5">
                <audio id="audioElement"></audio>
                <div class="flex items-center justify-between gap-4">
                    <div class="flex items-center gap-4 flex-1 min-w-0">
                        <div class="relative w-14 h-14 rounded-xl overflow-hidden bg-black/50 flex-shrink-0 border border-white/10 shadow-md">
                            <img id="musicCoverImg" src="" alt="Cover" class="w-full h-full object-cover">
                        </div>
                        <div class="flex-1 min-w-0 text-left">
                            <h3 id="musicTitle" class="music-text-title text-white font-bold text-[13px] tracking-wide truncate m-0 uppercase">Loading...</h3>
                            <p id="musicArtist" class="music-text-artist text-slate-400 text-[11px] font-medium truncate mt-0.5">-</p>
                            <div class="flex items-center gap-2 mt-2">
                                <span id="currentTime" class="text-[9px] text-slate-400 font-mono w-7 text-left">0:00</span>
                                <div id="progressContainer" class="music-progress-bar-bg flex-1 h-1 bg-white/10 rounded-full relative cursor-pointer">
                                    <div id="progressBar" class="h-full bg-cyan-400 rounded-full w-0 transition-all duration-300"></div>
                                </div>
                                <span id="totalDuration" class="text-[9px] text-slate-400 font-mono w-7 text-right">0:00</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <button id="prevBtn" class="music-btn-nav w-8 h-8 flex items-center justify-center glass-panel rounded-lg text-slate-300 hover:text-white transition-all active:scale-95 border border-white/5">
                            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                        </button>
                        <button id="playBtn" class="music-btn-nav w-10 h-10 flex items-center justify-center glass-panel rounded-lg text-slate-300 hover:text-white transition-all active:scale-95 border border-white/5">
                            <svg id="playIcon" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <button id="nextBtn" class="music-btn-nav w-8 h-8 flex items-center justify-center glass-panel rounded-lg text-slate-300 hover:text-white transition-all active:scale-95 border border-white/5">
                            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 6h2v12h-2zm-10.5 12l8.5-6-8.5-6z"/></svg>
                        </button>
                        <button id="playlistToggleBtn" class="music-btn-nav w-8 h-8 flex items-center justify-center glass-panel rounded-lg text-slate-300 hover:text-white transition-all active:scale-95 border border-white/5">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
                        </button>
                    </div>
                </div>
                <div id="playlistPanel" class="music-playlist-border hidden mt-4 pt-4 border-t border-white/10 max-h-40 overflow-y-auto space-y-1 light-mode:border-slate-200"></div>
            </div>
            
        </header>

        <div class="mb-8">
            <div class="relative max-w-4xl mx-auto">
                <input 
                    type="text" 
                    id="searchInput" 
                    placeholder="Cari endpoint berdasarkan nama, path, atau kategori..."
                    class="search-input w-full px-4 py-3.5 pl-11 text-xs rounded-xl focus:outline-none focus:border-cyan-500 transition-all font-mono glass-panel border border-white/5 text-white placeholder-slate-400 light-mode:text-slate-900 light-mode:placeholder-slate-500 light-mode:focus:border-cyan-600"
                >
                <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
            </div>
            <div id="categoryFilters" class="flex flex-wrap gap-2 mt-4 justify-start md:justify-center overflow-x-auto pb-2 scrollbar-hide max-w-4xl mx-auto"></div>
        </div>

        <div id="noResults" class="text-center py-12 hidden">
            <div class="flex justify-center mb-3">
                <svg class="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h3 id="no-results-title" class="text-sm font-bold mb-1 text-white">Endpoint tidak ditemukan</h3>
            <p id="no-results-desc" class="text-xs text-slate-400 light-mode:text-slate-500">Coba gunakan kata kunci lain</p>
        </div>

        <div id="apiList" class="space-y-4 max-w-4xl mx-auto"></div>

        <footer id="siteFooter" class="mt-16 pt-6 border-t border-white/5 text-center text-[11px] text-slate-500">
            ${footer}
        </footer>
    </div>

    <div id="imageLightbox" class="fixed inset-0 bg-black/95 z-[100] hidden flex items-center justify-center p-4 opacity-0 transition-opacity duration-300 backdrop-blur-xs cursor-zoom-out">
        <div class="relative max-w-4xl max-h-[90vh] flex items-center justify-center">
            <img id="lightboxImage" src="" alt="Preview" class="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain scale-95 transition-transform duration-300" />
            <button id="closeLightbox" class="absolute -top-12 right-0 text-white hover:text-cyan-400 transition-colors focus:outline-none flex items-center gap-1 bg-black/50 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono">
                ✕ Close
            </button>
        </div>
    </div>
    
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/moment.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/locale/id.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment-timezone/0.5.45/moment-timezone-with-data.min.js"></script>

<script class="notranslate" translate="no">
    window.musicPlaylist = ${JSON.stringify(playlist)};
    const displayApiKey = "${req.user ? req.user.apiKey : 'Silakan Login'}";
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
            const roleContainer = document.getElementById('userRoleContainer');
            const avatar3DBorder = document.getElementById('avatar3DBorder');
            const avatarBadge = document.getElementById('avatarBadge');
            const usernameTag = document.getElementById('userEmail');
            const normalizedRole = (roleName || '').toLowerCase();

            const iconFree = \`<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>\`;
            const iconPremium = \`<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>\`;
            const iconVip = \`<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>\`;

            const buildCrownSVG = (gradId) => \`
                <svg class="w-20 h-20 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="goldCrown" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#fef08a" />
                            <stop offset="40%" stop-color="#fbbf24" />
                            <stop offset="70%" stop-color="#b45309" />
                            <stop offset="100%" stop-color="#451a03" />
                        </linearGradient>
                        <linearGradient id="purpleCrown" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#f3e8ff" />
                            <stop offset="35%" stop-color="#c084fc" />
                            <stop offset="70%" stop-color="#7e22ce" />
                            <stop offset="100%" stop-color="#2e1065" />
                        </linearGradient>
                    </defs>
                    <path d="M50 15 L52 21 L58 21 L53 25 L55 31 L50 27 L45 31 L47 25 L42 21 L48 21 Z" fill="url(#\${gradId})" />
                    <circle cx="16" cy="39" r="2.5" fill="url(#\${gradId})" />
                    <circle cx="34" cy="30" r="2.5" fill="url(#\${gradId})" />
                    <circle cx="66" cy="30" r="2.5" fill="url(#\${gradId})" />
                    <circle cx="84" cy="39" r="2.5" fill="url(#\${gradId})" />
                    <path d="M16 41 L27 63 L38 46 L50 29 L62 46 L73 63 L84 41 L92 56 C80 73, 20 73, 8 56 Z" fill="url(#\${gradId})" />
                    <path d="M22 46 L27 57 L34 46 L43 38 L50 54 L57 38 L66 46 L73 57 L78 46" stroke="#111827" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" />
                    <path d="M22 66 C35 72, 65 72, 78 66" stroke="url(#\${gradId})" stroke-width="2.5" fill="none" stroke-linecap="round" />
                    <path d="M25 71 C37 76, 63 76, 75 71" stroke="url(#\${gradId})" stroke-width="1.5" fill="none" stroke-linecap="round" />
                </svg>\`;

            if (normalizedRole.includes('vip')) {
                roleContainer.className = "flex items-center gap-1.5 font-bold mb-3 text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]";
                roleContainer.innerHTML = \`\${iconVip} <span class="tracking-wide">VIP User</span>\`;
                usernameTag.className = "text-purple-400 font-mono text-sm mb-4 opacity-90";
                avatar3DBorder.className = "w-28 h-28 rounded-full p-[6px] transition-all duration-500 z-10 flex items-center justify-center border-3d-vip";
                avatarBadge.className = "absolute -top-7 z-20 scale-125 drop-shadow-[0_4px_10px_rgba(168,85,247,0.5)]";
                avatarBadge.innerHTML = buildCrownSVG('purpleCrown');
            } else if (normalizedRole.includes('premium')) {
                roleContainer.className = "flex items-center gap-1.5 font-bold mb-3 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]";
                roleContainer.innerHTML = \`\${iconPremium} <span class="tracking-wide">Premium User</span>\`;
                usernameTag.className = "text-amber-400 font-mono text-sm mb-4 opacity-90";
                avatar3DBorder.className = "w-28 h-28 rounded-full p-[6px] transition-all duration-500 z-10 flex items-center justify-center border-3d-premium";
                avatarBadge.className = "absolute -top-7 z-20 scale-125 drop-shadow-[0_4px_10px_rgba(251,191,36,0.4)]";
                avatarBadge.innerHTML = buildCrownSVG('goldCrown');
            } else {
                roleContainer.className = "flex items-center gap-1.5 font-semibold mb-3 text-emerald-400";
                roleContainer.innerHTML = \`\${iconFree} <span class="tracking-wide">Free User</span>\`;
                usernameTag.className = "text-emerald-400 font-mono text-sm mb-4";
                avatar3DBorder.className = "w-28 h-28 rounded-full p-[4px] transition-all duration-500 z-10 flex items-center justify-center border-3d-free";
                avatarBadge.innerHTML = ""; 
            }
        }

        function fetchUserProfile() {
            fetch('/api/user-status')
                .then(res => res.json())
                .then(data => {
                    if (data.loggedIn) {
                        document.getElementById('userAvatar').src = data.user.avatar || 'https://via.placeholder.com/150';
                        document.getElementById('userName').innerText = data.user.name || 'User';
                        document.getElementById('userEmail').innerText = data.user.email || 'no-email@mail.com';
                        document.getElementById('userApiKey').innerText = data.user.apiKey || 'No Key';
                        setRoleTheme(data.user.role || 'free');
                    }
                })
                .catch(() => {
                    setRoleTheme("free"); 
                });
        }

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
            loaderTitleEl.innerHTML = \`Memuat \${pageName}<span class="animated-dots"></span>\`;
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

        setTimeout(finishLoader, 4000);
        async function uploadAvatarFile(input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const formData = new FormData();
    formData.append('avatar', file);

    const userAvatarImg = document.getElementById('userAvatar');
    const oldSrc = userAvatarImg.src;
    userAvatarImg.style.opacity = '0.5';

    try {
        const response = await fetch('/api/user/update-avatar', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.status) {
            userAvatarImg.src = result.avatar;
            alert('Avatar berhasil diperbarui!');
            window.location.reload(); 
        } else {
            alert(result.message || 'Gagal mengunggah avatar.');
            userAvatarImg.src = oldSrc;
        }
    } catch (error) {
        console.error("Error uploading avatar:", error);
        alert('Terjadi kesalahan koneksi saat mengunggah gambar.');
        userAvatarImg.src = oldSrc;
    } finally {
        userAvatarImg.style.opacity = '1';
        input.value = ''; 
    }
}
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

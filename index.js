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
const crypto = require('crypto');
const compression = require('compression');
const os = require('os');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

// ====================================================
// 1. KONFIGURASI & ENVIRONMENT VARIABLES
// ====================================================
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const STATIC_QRIS = process.env.STATIC_QRIS;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());

// VAPID WebPush Configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

try {
    webpush.setVapidDetails(`mailto:${ADMIN_EMAILS[0] || 'haqqi.official13@gmail.com'}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
    console.error("❌ Gagal setVapidDetails:", err.message);
}

// OAuth Credentials
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || "https://api.arulzzxd.my.id/auth/github/callback";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "https://api.arulzzxd.my.id/auth/google/callback";

// ====================================================
// 2. MONGOOSE DATABASE CONNECTION & SCHEMAS
// ====================================================
mongoose.connect(MONGODB_URI)
    .then(() => console.log('📦 Berhasil terhubung ke MongoDB!'))
    .catch(err => console.error('❌ Gagal koneksi ke MongoDB:', err));

// Mongoose Schemas
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
    roleExpiresAt: { type: Date, default: null },
    limit: { type: Number, default: 0 },
    lastLimitReset: { type: Date, default: Date.now },
    avatar: { type: String, default: 'https://cdn.arulzzxd.my.id/files/X1F0Cn.png' }, 
    createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', function() {
    if (this.isModified('role')) {
        const roleLower = (this.role || '').toLowerCase();
        if (roleLower.includes('vip')) {
            if (!this.apikey || this.apikey.startsWith('arulzxdfree-') || this.apikey.includes('prem-')) {
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

const reviewSchema = new mongoose.Schema({
    productId: { type: String, required: true, index: true },
    userId: { type: String, default: null, index: true },
    username: { type: String, required: true },
    userAvatar: { type: String, default: 'https://cdn.arulzzxd.my.id/files/X1F0Cn.png' },
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
        default: ["https://cdn.arulzzxd.my.id/files/X1F0Cn.png"] 
    },    
    deskripsi: { type: String, default: "" },
    link: { type: String, required: true },
    purchasedBy: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const transactionSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String, required: true },
    email: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentNumber: { type: String, default: null }, 
    paymentMethod: { type: String, default: "QRIS" },
    status: { type: String, default: "pending" },
    proofImage: { type: String, default: null },
    itemDetails: {
        nama: String,
        harga: Number,
        kategori: String,
        qty: Number
    },
    createdAt: { type: Date, default: Date.now },
    expiredAt: { type: Date, required: true },
    updatedAt: { type: Date, default: Date.now }
});
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

const pushSubscriptionSchema = new mongoose.Schema({
    endpoint: { type: String, required: true, unique: true },
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
    },
    email: { type: String, default: 'haqqi.official13@gmail.com' },
    updatedAt: { type: Date, default: Date.now }
});
const PushSub = mongoose.models.PushSub || mongoose.model('PushSub', pushSubscriptionSchema);

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

// ====================================================
// 3. MIDDLEWARE & SESSION SETUP
// ====================================================
app.use(compression());
app.set('etag', false);
app.set('trust proxy', 1);

app.use(express.static(path.join(__dirname)));
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

app.use(session({
    secret: SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        dbName: 'sessions',
        ttl: 24 * 60 * 60
    }),
    cookie: { maxAge: 24 * 60 * 60 * 1000 } 
}));

// Middleware pencegah penandatanganan salah (false positive) crawler Meta/WhatsApp
app.use((req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.includes('facebookexternalhit') || userAgent.includes('WhatsApp')) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <title>ArulzXD API - Core REST Gateway</title>
                <meta property="og:title" content="ArulzXD API - Core REST Gateway" />
                <meta property="og:description" content="Layanan REST API resmi untuk dokumentasi dan integrasi pengembang aplikasi." />
                <meta property="og:image" content="https://cdn.arulzzxd.my.id/files/iJKbzK38.png" />
                <meta property="og:url" content="https://api.arulzzxd.my.id/" />
                <meta property="og:type" content="website" />
            </head>
            <body>
                <h1>ArulzXD REST API Service</h1>
                <p>Official developer REST API documentation and integration gateway.</p>
            </body>
            </html>
        `);
    }
    next();
});

app.use(passport.initialize());
app.use(passport.session());

// Middleware Cek Auth Session
const checkAuthSession = async (req, res, next) => {
    const token = req.cookies.auth_session;
    if (!token) {
        req.user = null;
        return next();
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const freshUser = await User.findById(decoded.id || decoded._id).lean();
        if (freshUser) {
            req.user = { ...freshUser, id: freshUser._id };
        } else {
            req.user = null;
        }
        next();
    } catch (err) {
        res.clearCookie('auth_session');
        req.user = null;
        next();
    }
};

app.use(checkAuthSession);

// ====================================================
// 4. HELPER FUNCTIONS
// ====================================================
function generateFreeApiKey() {
    return 'arulzxdfree-' + crypto.randomBytes(3).toString('hex').slice(0, 5);
}

function generatePremiumApiKey(username) {
    const cleanUsername = (username || 'user').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    return `${cleanUsername}prem-` + crypto.randomBytes(3).toString('hex').slice(0, 6);
}

function generateId(length = 8) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

function calcCRC16(str) {
    let crc = 0xFFFF;
    for (let c = 0; c < str.length; c++) {
        crc ^= str.charCodeAt(c) << 8;
        for (let i = 0; i < 8; i++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function convertStaticToDynamicQRIS(staticQris, amount) {
    let qris = (staticQris || '').trim();
    if (qris.startsWith('data:image') || qris.startsWith('http://') || qris.startsWith('https://')) {
        return qris;
    }

    const crcIndex = qris.indexOf('6304');
    if (crcIndex !== -1) {
        qris = qris.substring(0, crcIndex);
    }
    qris = qris.replace('000201010211', '000201010212');
    qris = qris.replace(/54\d{2}\d+5802ID/, '5802ID');

    const amtStr = String(Math.round(amount));
    const tag54 = '54' + String(amtStr.length).padStart(2, '0') + amtStr;

    if (qris.includes('5802ID')) {
        const parts = qris.split('5802ID');
        qris = parts[0] + tag54 + '5802ID' + parts[1];
    } else {
        qris += tag54;
    }

    qris += '6304';
    return qris + calcCRC16(qris);
}

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

async function setCache(key, data) {
    try {
        await CacheModel.findOneAndUpdate({ key }, { data, createdAt: new Date() }, { upsert: true, new: true });
    } catch (e) {
        console.error("Gagal simpan cache MongoDB:", e.message);
    }
}

async function getCache(key) {
    try {
        const cached = await CacheModel.findOne({ key });
        return cached ? cached.data : null;
    } catch (e) { return null; }
}

async function deleteCache(key) {
    try { await CacheModel.deleteOne({ key }); } catch (e) {}
}

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
        const product = await Product.findOne({ nama: { $regex: new RegExp(`^${productName.trim()}$`, 'i') } });
        if (product) {
            if (isRollback) {
                product.stok = (product.stok || 0) + qtyChange;
                product.terjual = Math.max(0, (product.terjual || 0) - qtyChange);
            } else {
                product.stok = Math.max(0, (product.stok || 0) - qtyChange);
                product.terjual = (product.terjual || 0) + qtyChange;
            }
            await product.save();
            return product;
        }
    } catch (err) {
        console.error("❌ Gagal meng-update stok produk:", err.message);
    }
    return null;
}

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
                body { background-color: #FAF7EF; font-family: 'Plus Jakarta Sans', sans-serif; }
                .swal2-popup { background: #FFFDF8 !important; border: 2px solid #121212 !important; border-radius: 16px !important; }
                .swal2-title { color: #121212 !important; font-weight: 700 !important; }
                .swal2-confirm { background: #fde047 !important; color: #121212 !important; font-weight: 700 !important; border: 2px solid #121212 !important; border-radius: 12px !important; padding: 10px 24px !important; }
            </style>
        </head>
        <body>
            <script>
                Swal.fire({
                    icon: '${icon}', title: '${title}', text: '${text}', confirmButtonText: 'OKE', scrollbarPadding: false
                }).then(() => { window.location = '${redirectUrl}'; });
            </script>
        </body>
        </html>
    `);
}

// ====================================================
// 5. PASSPORT STRATEGY & OAUTH AUTHENTICATION
// ====================================================
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
                $or: [{ username: usernameOrEmail }, { email: usernameOrEmail.toLowerCase() }]
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

// --- LOGIN LOCAL ---
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

                if (needSave) await user.save();

                const userPayload = {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    name: user.username,
                    avatar: user.avatar || 'https://cdn.arulzzxd.my.id/files/X1F0Cn.png',
                    role: user.role,     
                    apikey: user.apikey   
                };

                const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });
                res.cookie('auth_session', token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'lax' });

                return res.redirect('/docs');
            } catch (error) {
                console.error("Gagal sinkronisasi data saat login:", error);
                return next(error);
            }
        });
    })(req, res, next);
});

// --- REGISTER LOCAL ---
app.post('/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return sendSweetAlert(res, 'error', 'Pendaftaran Gagal', 'Semua data wajib diisi!', '/login');
        }

        const cleanUsername = username.trim();
        const cleanEmail = email.toLowerCase().trim();

        const existingUser = await User.findOne({ $or: [{ username: cleanUsername }, { email: cleanEmail }] });
        if (existingUser) {
            return sendSweetAlert(res, 'warning', 'Sudah Terdaftar', 'Username atau Email sudah terdaftar!', '/login');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const defaultAvatar = 'https://cdn.arulzzxd.my.id/files/X1F0Cn.png';

        const newUser = new User({
            username: cleanUsername,
            email: cleanEmail,
            password: hashedPassword,
            provider: 'local',
            role: 'Free User',
            apikey: generateFreeApiKey(),
            avatar: defaultAvatar
        });
        await newUser.save();

        const token = jwt.sign({
            id: newUser._id, username: newUser.username, name: newUser.username, avatar: defaultAvatar, role: newUser.role, apikey: newUser.apikey
        }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('auth_session', token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'lax' });

        req.logIn(newUser, (err) => {
            if (err) return res.redirect('/login');
            return sendSweetAlert(res, 'success', 'Berhasil!', 'Pendaftaran berhasil! Selamat datang.', '/docs');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Terjadi error internal saat pendaftaran.');
    }
});

// --- OAUTH GITHUB ---
app.get('/auth/github', (req, res) => {
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_CALLBACK_URL}&scope=user:email`;
    res.redirect(url);
});

app.get('/auth/github/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('Authentication failed: No code provided');

    try {
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code
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
                if (primaryEmailObj) userEmail = primaryEmailObj.email;
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
                avatar: userData.avatar_url || 'https://cdn.arulzzxd.my.id/files/X1F0Cn.png'
            });
            await dbUser.save();
        } else if (userData.avatar_url && dbUser.avatar !== userData.avatar_url) {
            dbUser.avatar = userData.avatar_url;
            await dbUser.save();
        }

        const token = jwt.sign({
            id: dbUser._id, username: dbUser.username, email: dbUser.email, name: userData.name || dbUser.username, avatar: dbUser.avatar, role: dbUser.role, apikey: dbUser.apikey
        }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('auth_session', token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'lax' });
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.send('Login Error: ' + error.message);
    }
});

// --- OAUTH GOOGLE ---
app.get('/auth/google', (req, res) => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_CALLBACK_URL}&response_type=code&scope=profile email`;
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('Authentication failed: No code provided');

    try {
        const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: GOOGLE_CALLBACK_URL
        });

        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userData = userResponse.data;
        const email = userData.email.toLowerCase().trim();
        const currentUsername = (userData.login || email.split('@')[0]).toLowerCase().trim();

        let dbUser = await User.findOne({ email });

        if (!dbUser) {
            dbUser = new User({
                username: currentUsername,
                email: email,
                provider: 'google',
                providerId: String(userData.id),
                apikey: generateFreeApiKey(),
                role: 'Free User',
                avatar: userData.picture || 'https://cdn.arulzzxd.my.id/files/X1F0Cn.png'
            });
            await dbUser.save();
        } else if (userData.picture && dbUser.avatar !== userData.picture) {
            dbUser.avatar = userData.picture;
            await dbUser.save();
        }

        const token = jwt.sign({
            id: dbUser._id, username: dbUser.username, email: dbUser.email, name: userData.name || dbUser.username, avatar: dbUser.avatar, role: dbUser.role, apikey: dbUser.apikey
        }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('auth_session', token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'lax' });
        res.redirect('/profile');
    } catch (error) {
        console.error('Google Auth Callback Error:', error.response?.data || error.message);
        res.send('Login Error: ' + (error.response?.data?.error_description || error.message));
    }
});

// --- LUPA & RESET PASSWORD ---
app.post('/auth/forgot-password', async (req, res) => {
    try {
        const email = req.body.email;
        if (!email) return sendSweetAlert(res, 'error', 'Wajib Diisi', 'Email wajib diisi!', '/login');

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return sendSweetAlert(res, 'error', 'Tidak Ditemukan', 'Email tersebut tidak terdaftar di sistem kami.', '/login');

        if (user.provider !== 'local') {
            return sendSweetAlert(res, 'error', 'Metode Login OAuth', `Akun ini mendaftar via ${user.provider.toUpperCase()}, tidak memerlukan reset password.`, '/login');
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; 
        await user.save();

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', port: 465, secure: true, 
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            tls: { rejectUnauthorized: false }
        });

        const host = req.get('host');
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const resetUrl = `${protocol}://${host}/reset-password/${resetToken}`;

        await transporter.sendMail({
            from: `"Support ArulzXD" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: 'Permintaan Reset Kata Sandi',
            html: `<div style="background-color: #FAF7EF; padding: 40px 20px; font-family: sans-serif;">
                <h2>Halo ${user.username},</h2>
                <p>Klik tombol di bawah ini untuk mereset kata sandi Anda:</p>
                <a href="${resetUrl}" style="background:#fde047; padding:10px 20px; color:#121212; font-weight:bold; text-decoration:none; display:inline-block; border-radius:8px;">Reset Kata Sandi</a>
            </div>`
        });

        return sendSweetAlert(res, 'success', 'Sukses!', 'Link reset password telah dikirim ke email Anda.', '/login');
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal memproses lupa password.');
    }
});

app.get('/reset-password/:token', async (req, res) => {
    try {
        const user = await User.findOne({ 
            resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) {
            return sendSweetAlert(res, 'error', 'Link Kadaluwarsa', 'Link reset password tidak valid atau sudah kedaluwarsa.', '/login');
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <title>Buat Password Baru</title>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-[#FAF7EF] flex items-center justify-center min-h-screen p-4">
                <div class="bg-[#FFFDF8] border-2 border-black p-8 rounded-2xl max-w-md w-full">
                    <h1 class="text-xl font-bold mb-4">Atur Ulang Kata Sandi</h1>
                    <form action="/reset-password/${req.params.token}" method="POST" class="space-y-4">
                        <input type="password" name="password" required placeholder="Password Baru" class="w-full border-2 border-black p-3 rounded-xl">
                        <button type="submit" class="w-full bg-yellow-400 border-2 border-black font-bold py-3 rounded-xl">Simpan Password Baru</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error server.");
    }
});

// --- USER STATUS & LOGOUT ---
app.get('/api/user-status', async (req, res) => {
    if (req.user) {
        try {
            const freshUser = await User.findById(req.user.id || req.user._id);
            const activeUser = freshUser || req.user;
            res.json({
                loggedIn: true,
                user: {
                    name: activeUser.username, username: activeUser.username, email: activeUser.email, avatar: activeUser.avatar, apikey: activeUser.apikey, role: activeUser.role
                }
            });
        } catch (err) {
            res.json({
                loggedIn: true,
                user: {
                    name: req.user.name || req.user.username, username: req.user.username, email: req.user.email, avatar: req.user.avatar, apikey: req.user.apikey, role: req.user.role
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

// ====================================================
// 6. USER PROFILE & API KEY CUSTOM ENDPOINTS
// ====================================================
const uploadavatar = multer({ 
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('File harus berupa gambar!'));
    }
});

app.post('/api/user/update-avatar', checkAuthSession, (req, res) => {
    uploadavatar.single('avatar')(req, res, async (err) => {
        if (err) return res.status(400).json({ status: false, message: err.message || 'Gagal mengunggah gambar.' });

        try {
            if (!req.user) return res.status(401).json({ status: false, message: 'Anda belum login!' });
            if (!req.file) return res.status(400).json({ status: false, message: 'Silakan pilih gambar terlebih dahulu!' });

            const mimeType = req.file.mimetype || mime.lookup(req.file.originalname) || 'image/png';
            const base64 = req.file.buffer.toString("base64");
            const avatarDataUrl = `data:${mimeType};base64,${base64}`;

            const updatedUser = await User.findByIdAndUpdate(
                req.user.id || req.user._id,
                { $set: { avatar: avatarDataUrl } },
                { new: true, runValidators: true }
            );

            const token = jwt.sign({
                id: updatedUser._id, username: updatedUser.username, email: updatedUser.email, name: updatedUser.username, avatar: updatedUser.avatar, role: updatedUser.role, apikey: updatedUser.apikey
            }, JWT_SECRET, { expiresIn: '7d' });

            res.cookie('auth_session', token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'lax' });
            return res.json({ status: true, message: 'Avatar berhasil diperbarui!', avatar: updatedUser.avatar });
        } catch (error) {
            console.error("Gagal update avatar:", error);
            return res.status(500).json({ status: false, message: 'Terjadi kesalahan pada server saat memperbarui avatar.' });
        }
    });
});

app.post('/api/user/custom-apikey', checkAuthSession, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ status: false, message: 'Anda harus login terlebih dahulu!' });

        const user = await User.findById(req.user.id || req.user._id);
        if (!user) return res.status(404).json({ status: false, message: 'User tidak ditemukan!' });

        if (!(user.role || '').toLowerCase().includes('vip')) {
            return res.status(403).json({ status: false, message: 'Fitur Custom API Key hanya diperuntukkan untuk VIP User!' });
        }

        const { customKey } = req.body;
        if (!customKey || !customKey.trim()) return res.status(400).json({ status: false, message: 'API Key kustom tidak boleh kosong!' });

        const cleanKey = customKey.trim();
        if (cleanKey.length < 4 || cleanKey.length > 30) {
            return res.status(400).json({ status: false, message: 'API Key kustom harus memiliki panjang 4 - 30 karakter!' });
        }

        const existingKey = await User.findOne({ apikey: cleanKey, _id: { $ne: user._id } });
        if (existingKey) {
            return res.status(400).json({ status: false, message: 'API Key tersebut sudah digunakan oleh user lain!' });
        }

        user.apikey = cleanKey;
        await user.save();

        const token = jwt.sign({
            id: user._id, username: user.username, email: user.email, name: user.username, avatar: user.avatar, role: user.role, apikey: user.apikey
        }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('auth_session', token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'lax' });
        return res.json({ status: true, message: 'API Key berhasil diperbarui!', apikey: user.apikey });
    } catch (error) {
        console.error("Gagal custom apikey:", error);
        return res.status(500).json({ status: false, message: 'Terjadi kesalahan server saat memperbarui API Key.' });
    }
});

// ====================================================
// 7. ADMIN MIDDLEWARE & ADMIN ENDPOINTS
// ====================================================
let adminSseClients = [];

function notifyAdminSse(data) {
    adminSseClients.forEach(client => {
        try { client.res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (e) {}
    });
}

setInterval(() => {
    adminSseClients.forEach(client => {
        try { client.res.write(': ping\n\n'); } catch (e) {}
    });
}, 15000);

const checkAdminAccess = (req, res, next) => {
    if (!req.user) {
        if (req.path === '/admin') return res.redirect('/login');
        return res.status(401).json({ status: false, message: "Anda harus login terlebih dahulu!" });
    }

    const userEmail = (req.user.email || '').toLowerCase().trim();
    if (!ADMIN_EMAILS.includes(userEmail)) {
        if (req.path === '/admin') {
            return res.status(403).send(`
                <!DOCTYPE html><html><head><script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script></head>
                <body style="background:#FAF7EF;">
                    <script>
                        Swal.fire({ icon: 'error', title: 'AKSES DITOLAK', text: 'Email Anda bukan Admin!', confirmButtonText: 'Kembali ke Docs' })
                        .then(() => { window.location.href = '/docs'; });
                    </script>
                </body></html>
            `);
        }
        return res.status(403).json({ status: false, message: "Akses ditolak! Email Anda bukan Admin." });
    }
    next();
};

async function sendBackgroundPushNotification(payload) {
    const pushPayload = JSON.stringify(payload);
    const subscriptions = await PushSub.find({});

    subscriptions.forEach(async (sub) => {
        try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, pushPayload);
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                await PushSub.deleteOne({ endpoint: sub.endpoint });
            }
        }
    });
}

app.get('/api/admin/vapid-public-key', checkAdminAccess, (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/admin/subscribe-push', checkAdminAccess, async (req, res) => {
    try {
        const subscription = req.body;
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ status: false, message: 'Data subscription tidak valid!' });
        }

        await PushSub.findOneAndUpdate(
            { endpoint: subscription.endpoint },
            { endpoint: subscription.endpoint, keys: subscription.keys, email: req.user ? req.user.email : ADMIN_EMAILS[0], updatedAt: new Date() },
            { upsert: true, new: true }
        );

        return res.status(201).json({ status: true, message: 'Push subscription berhasil tersimpan di MongoDB.' });
    } catch (err) {
        return res.status(500).json({ status: false, message: 'Gagal menyimpan subscription.' });
    }
});

app.post('/api/admin/test-push', checkAdminAccess, async (req, res) => {
    try {
        await sendBackgroundPushNotification({
            title: '🔔 TES NOTIFIKASI WEB PUSH',
            body: 'Notifikasi latar belakang berhasil dikonfigurasi!',
            icon: 'https://cdn.arulzzxd.my.id/files/iJKbzK38.png',
            orderId: 'TRX-TEST-' + Math.floor(1000 + Math.random() * 9000)
        });
        return res.json({ status: true, message: 'Push notification tes berhasil dikirim!' });
    } catch (err) {
        return res.status(500).json({ status: false, message: err.message });
    }
});

app.get('/api/admin/transactions', checkAdminAccess, async (req, res) => {
    try {
        const transactions = await Transaction.find({}).sort({ createdAt: -1 }).limit(100);
        return res.json({ status: true, data: transactions });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Gagal memuat transaksi admin." });
    }
});

app.post('/api/admin/transactions/:orderId/approve', checkAdminAccess, async (req, res) => {
    try {
        const { orderId } = req.params;
        const trx = await Transaction.findOne({ orderId });
        if (!trx) return res.status(404).json({ status: false, message: "Transaksi tidak ditemukan" });

        trx.status = "success";
        trx.updatedAt = new Date();
        await trx.save();

        const targetUser = await User.findById(trx.userId) || await User.findOne({ username: trx.username });
        if (targetUser) {
            const daysToAdd = Number(trx.itemDetails?.qty) || 3;
            const isVip = (trx.itemDetails?.nama || '').toLowerCase().includes("vip");
            const targetRole = isVip ? "VIP User" : "Premium User";

            let currentExpiry = (targetUser.roleExpiresAt && new Date(targetUser.roleExpiresAt) > new Date())
                ? new Date(targetUser.roleExpiresAt)
                : new Date();

            currentExpiry.setDate(currentExpiry.getDate() + daysToAdd);
            targetUser.role = targetRole;
            targetUser.roleExpiresAt = currentExpiry;

            if (targetRole === "Premium User") {
                targetUser.apikey = generatePremiumApiKey(targetUser.username);
            } else if (targetRole === "VIP User" && (!targetUser.apikey || targetUser.apikey.startsWith('arulzxdfree-'))) {
                targetUser.apikey = `${targetUser.username.toLowerCase()}-custom-vip`;
            }

            await targetUser.save();
        }

        return res.json({ status: true, message: "Transaksi berhasil dikonfirmasi LUNAS! Role pengguna telah diperbarui." });
    } catch (err) {
        console.error("Approve Error:", err);
        return res.status(500).json({ status: false, message: "Gagal memproses konfirmasi." });
    }
});

app.post('/api/admin/transactions/:orderId/reject', checkAdminAccess, async (req, res) => {
    try {
        const { orderId } = req.params;
        const trx = await Transaction.findOne({ orderId });
        if (trx) {
            trx.status = "rejected";
            trx.updatedAt = new Date();
            await trx.save();
        }
        return res.json({ status: true, message: "Transaksi ditolak." });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Gagal menolak transaksi." });
    }
});

app.get('/api/admin/events', checkAdminAccess, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    const clientId = Date.now();
    adminSseClients.push({ id: clientId, res });

    res.write(`data: ${JSON.stringify({ type: "CONNECTED" })}\n\n`);
    req.on('close', () => {
        adminSseClients = adminSseClients.filter(c => c.id !== clientId);
    });
});

// ====================================================
// 8. STORE, REVIEWS & VOUCHERS ENDPOINTS
// ====================================================
const uploadReviewMedia = multer({
    limits: { fileSize: 10 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
        else cb(new Error('File harus berupa gambar atau video!'));
    }
});

app.post('/api/reviews', checkAuthSession, (req, res) => {
    uploadReviewMedia.array('mediaFiles', 5)(req, res, async (err) => {
        if (err) return res.status(400).json({ status: false, message: err.message || 'Gagal mengunggah berkas.' });

        try {
            const { productId, rating, comment } = req.body;
            if (!productId) return res.status(400).json({ status: false, message: 'Product ID wajib diisi!' });
            if (!rating || Number(rating) < 1 || Number(rating) > 5) return res.status(400).json({ status: false, message: 'Rating bintang wajib diisi (1-5)!' });
            if (!comment || !comment.trim()) return res.status(400).json({ status: false, message: 'Anda diwajibkan menuliskan ulasan/penilaian!' });

            let username = 'Anonim';
            let userAvatar = 'https://cdn.arulzzxd.my.id/files/X1F0Cn.png';
            let userId = getUserIdentifier(req);

            if (req.user) {
                username = req.user.username || req.user.name;
                userAvatar = req.user.avatar || userAvatar;
                userId = (req.user.id || req.user._id || req.user.email || req.user.username).toString();
            }

            const mediaList = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const mimeType = file.mimetype || mime.lookup(file.originalname) || '';
                    const isVideo = mimeType.startsWith('video/');
                    const base64 = file.buffer.toString('base64');
                    mediaList.push({ type: isVideo ? 'video' : 'image', url: `data:${mimeType};base64,${base64}` });
                }
            }

            let existingReview = await Review.findOne({ productId, userId });
            if (existingReview) {
                existingReview.rating = Number(rating);
                existingReview.comment = comment.trim();
                if (mediaList.length > 0) existingReview.media = mediaList; 
                existingReview.updatedAt = new Date();
                await existingReview.save();
                return res.json({ status: true, message: 'Penilaian produk Anda berhasil diperbarui!', data: existingReview });
            } else {
                const newReview = new Review({ productId, userId, username, userAvatar, rating: Number(rating), comment: comment.trim(), media: mediaList });
                await newReview.save();
                return res.json({ status: true, message: 'Penilaian produk berhasil dikirim!', data: newReview });
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

        return res.json({ status: true, totalReviews: reviews.length, averageRating, reviews });
    } catch (error) {
        return res.status(500).json({ status: false, message: 'Gagal mengambil ulasan produk.' });
    }
});

app.delete('/api/reviews/:reviewId', checkAuthSession, async (req, res) => {
    try {
        const { reviewId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(reviewId)) return res.status(400).json({ status: false, message: 'ID ulasan tidak valid!' });

        const review = await Review.findById(reviewId);
        if (!review) return res.status(404).json({ status: false, message: 'Ulasan tidak ditemukan!' });

        let currentUserId = getUserIdentifier(req);
        if (req.user) currentUserId = (req.user.id || req.user._id || req.user.email || req.user.username).toString();

        const currentUsername = req.user ? req.user.username : null;
        const isOwner = (review.userId && review.userId.toString() === currentUserId.toString()) ||
                        (currentUsername && review.username.toLowerCase() === currentUsername.toLowerCase());

        if (!isOwner) return res.status(403).json({ status: false, message: 'Anda tidak memiliki hak akses untuk menghapus ulasan ini!' });

        await Review.findByIdAndDelete(reviewId);
        return res.json({ status: true, message: 'Ulasan berhasil dihapus!' });
    } catch (error) {
        return res.status(500).json({ status: false, message: 'Terjadi kesalahan server saat menghapus ulasan.' });
    }
});

app.post('/api/vouchers/claim', async (req, res) => {
    try {
        const code = req.body.code;
        if (!code) return res.status(400).json({ status: false, message: 'Kode voucher wajib diisi!' });

        const cleanCode = code.trim().toUpperCase();
        const userIdentifier = getUserIdentifier(req);
        const voucher = await Voucher.findOne({ code: cleanCode });

        if (!voucher) return res.status(404).json({ status: false, message: 'Kode voucher tidak ditemukan!' });
        if (voucher.usageLimit <= 0) return res.status(400).json({ status: false, reason: 'limit_reached', message: 'Kuota voucher telah habis!' });
        if (voucher.usedBy && voucher.usedBy.includes(userIdentifier)) return res.status(400).json({ status: false, reason: 'already_used', message: 'Anda sudah pernah klaim voucher ini!' });
        if (new Date() > new Date(voucher.expiredAt)) return res.status(400).json({ status: false, reason: 'expired', message: 'Voucher telah kedaluwarsa!' });

        voucher.usedCount += 1;
        voucher.usageLimit = Math.max(0, voucher.usageLimit - 1);
        if (!voucher.usedBy) voucher.usedBy = [];
        voucher.usedBy.push(userIdentifier);
        await voucher.save();

        return res.json({
            status: true, message: 'Voucher berhasil diklaim!',
            voucher: { code: voucher.code, discount: voucher.discount, type: voucher.type },
            data: { code: voucher.code, discount: voucher.discount, type: voucher.type }
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: 'Terjadi kesalahan pada server.' });
    }
});

app.get('/api/vouchers/:code', async (req, res) => {
    try {
        const code = req.query.code || req.params.code;
        if (!code) return res.status(400).json({ status: false, message: 'Kode voucher wajib diisi!' });

        const userIdentifier = getUserIdentifier(req);
        const voucher = await Voucher.findOne({ code: code.trim().toUpperCase() });
        if (!voucher) return res.status(404).json({ status: false, message: 'Kode voucher tidak ditemukan!' });
        if (voucher.usageLimit <= 0) return res.status(400).json({ status: false, reason: 'limit_reached', message: 'Kuota voucher telah habis!' });
        if (voucher.usedBy && voucher.usedBy.includes(userIdentifier)) return res.status(400).json({ status: false, reason: 'already_used', message: 'Anda sudah pernah menggunakan voucher ini!' });
        if (new Date() > new Date(voucher.expiredAt)) return res.status(400).json({ status: false, reason: 'expired', message: 'Voucher telah kedaluwarsa!' });

        return res.json({ status: true, message: 'Voucher ditemukan!', data: { code: voucher.code, discount: voucher.discount, type: voucher.type } });
    } catch (err) {
        return res.status(500).json({ status: false, message: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/store/manual-order', async (req, res) => {
    try {
        const { productName, qty } = req.body;
        const buyQty = Number(qty) || 1;
        if (!productName) return res.status(400).json({ status: false, message: "Nama produk wajib diisi!" });

        const updatedProduct = await updateProductStockAndSold(productName, buyQty);
        if (!updatedProduct) return res.status(404).json({ status: false, message: "Produk tidak ditemukan." });

        return res.json({ status: true, message: "Stok & jumlah terjual diperbarui!", data: updatedProduct });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Terjadi kesalahan server." });
    }
});

app.get('/database/produk', async (req, res) => {
    try {
        const produk = await Product.find({}).sort({ createdAt: -1 });
        res.json(produk);
    } catch (err) {
        res.status(500).json({ error: "Gagal memuat data produk" });
    }
});

// ====================================================
// 9. TRANSACTIONS & PAYMENT GATEWAY (QRIS / WEBHOOK)
// ====================================================
app.post('/transactions', async (req, res) => {
    try {
        let { orderId, amount, itemDetails, qty } = req.body;
        const buyQty = Number(qty) || 1;
        const inputAmount = Number(amount);

        if (!inputAmount || isNaN(inputAmount)) return res.status(400).json({ status: false, message: "Nominal pembayaran tidak valid!" });

        const userId = req.user ? (req.user.id || req.user._id) : null;
        const username = req.user ? req.user.username : "Guest_Customer";
        const email = req.user ? req.user.email : "guest@arulzzxd.my.id";

        if (!orderId) orderId = `TRX-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

        const existingTrx = await Transaction.findOne({ orderId });
        if (existingTrx) orderId = `TRX-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

        const dynamicQris = convertStaticToDynamicQRIS(STATIC_QRIS, inputAmount);
        const expiredAt = new Date(Date.now() + 15 * 60 * 1000);

        const newTransaction = new Transaction({
            orderId, userId, username, email, amount: inputAmount,
            paymentNumber: dynamicQris, paymentMethod: "QRIS Dinamis Mandiri",
            status: "pending", itemDetails: { ...itemDetails, qty: buyQty }, expiredAt
        });

        await newTransaction.save();
        return res.json({ status: true, message: "QRIS Dinamis berhasil dibuat", data: newTransaction });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ status: false, message: "ID Transaksi bentrok. Silakan coba lagi." });
        }
        return res.status(500).json({ status: false, message: "Terjadi kesalahan server saat membuat QRIS." });
    }
});

app.post('/api/transactions/upload-proof', async (req, res) => {
    try {
        const { orderId, proofImage } = req.body;
        if (!orderId || !proofImage) return res.status(400).json({ status: false, message: "OrderId dan foto bukti pembayaran wajib diisi!" });

        const trx = await Transaction.findOne({ orderId });
        if (!trx) return res.status(404).json({ status: false, message: "Transaksi tidak ditemukan!" });

        trx.proofImage = proofImage;
        trx.status = "waiting_confirmation";
        trx.updatedAt = new Date();
        await trx.save();

        const buyer = await User.findOne({ $or: [{ email: trx.email }, { username: trx.username }] });
        const buyerAvatar = buyer?.avatar || 'https://cdn.arulzzxd.my.id/files/X1F0Cn.png';

        notifyAdminSse({
            type: "NEW_PAYMENT_PROOF", orderId: trx.orderId, username: trx.username, amount: trx.amount,
            item: trx.itemDetails?.nama || "Upgrade API Key", qty: trx.itemDetails?.qty || trx.qty || 1
        });

        sendBackgroundPushNotification({
            title: '⚡ BUKTI TRANSAKSI BARU!',
            body: `Order: ${trx.orderId}\nUser: ${trx.username}\nTotal: Rp ${trx.amount.toLocaleString('id-ID')}`,
            icon: buyerAvatar, image: proofImage, orderId: trx.orderId
        });

        return res.json({ status: true, message: "Bukti pembayaran berhasil diunggah! Menunggu konfirmasi admin." });
    } catch (error) {
        return res.status(500).json({ status: false, message: "Terjadi kesalahan server." });
    }
});

app.get('/transactions/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const trx = await Transaction.findOne({ orderId });
        if (!trx) return res.status(404).json({ status: false, message: "Transaksi tidak ditemukan" });

        if (trx.status === "pending" && new Date() > new Date(trx.expiredAt)) {
            trx.status = "cancelled";
            await trx.save();
        }
        return res.json({ data: trx });
    } catch (error) {
        return res.status(500).json({ status: false, message: "Gagal memuat transaksi" });
    }
});

app.post('/transactions/:orderId/cancel', async (req, res) => {
    try {
        const { orderId } = req.params;
        const trx = await Transaction.findOne({ orderId });
        if (trx) {
            trx.status = "cancelled";
            await trx.save();
        }
        return res.json({ status: true, message: "Transaksi dibatalkan" });
    } catch (e) {
        return res.status(500).json({ status: false, message: "Gagal membatalkan" });
    }
});

app.post('/webhook', async (req, res) => {
    try {
        const payload = req.body;
        const payloadData = payload?.data || payload;
        const orderId = payloadData?.orderId || payload?.order_id || payload?.trx_id;
        const status = payloadData?.status ? payloadData.status.toLowerCase() : (payload?.status || "").toLowerCase();

        if (!orderId) return res.status(400).json({ status: false, message: "Missing orderId" });

        let localTrx = await Transaction.findOne({ orderId });
        if (localTrx) {
            const prevStatus = localTrx.status.toLowerCase();
            const isPaidEvent = ["paid", "settlement", "success", "paid_successful"].includes(status);
            const isCancelEvent = ["cancelled", "failed", "expire", "rejected"].includes(status);

            if (isPaidEvent && !["paid", "settlement", "success"].includes(prevStatus)) {
                localTrx.status = "success";
                localTrx.updatedAt = new Date();

                if (localTrx.itemDetails && localTrx.itemDetails.nama && !localTrx.itemDetails.nama.includes("Upgrade Role")) {
                    await updateProductStockAndSold(localTrx.itemDetails.nama, localTrx.itemDetails.qty || 1, false);
                    await recordProductBuyer(localTrx.itemDetails.nama, localTrx.email || localTrx.username);
                }

                if (localTrx.itemDetails && localTrx.itemDetails.nama && localTrx.itemDetails.nama.includes("Upgrade Role")) {
                    const daysToAdd = Number(localTrx.itemDetails.qty) || 3;
                    const isVip = localTrx.itemDetails.nama.toLowerCase().includes("vip");
                    const targetRole = isVip ? "VIP User" : "Premium User";

                    let targetUser = await User.findOne({ $or: [{ email: localTrx.email }, { username: localTrx.username }] });
                    if (targetUser) {
                        let currentExpiry = (targetUser.roleExpiresAt && new Date(targetUser.roleExpiresAt) > new Date())
                            ? new Date(targetUser.roleExpiresAt) : new Date();

                        currentExpiry.setDate(currentExpiry.getDate() + daysToAdd);
                        targetUser.role = targetRole;
                        targetUser.roleExpiresAt = currentExpiry;

                        if (targetRole === "Premium User") targetUser.apikey = generatePremiumApiKey(targetUser.username);
                        else if (targetRole === "VIP User" && (!targetUser.apikey || targetUser.apikey.startsWith('arulzxdfree-'))) {
                            targetUser.apikey = `${targetUser.username.toLowerCase()}-custom-vip`;
                        }
                        await targetUser.save();
                    }
                }
            } else if (isCancelEvent) {
                localTrx.status = status;
                localTrx.updatedAt = new Date();
            }

            await localTrx.save();
            await deleteCache(`trx_${orderId}`);
        }

        return res.status(200).json({ status: true, message: "Webhook berhasil diproses", orderId });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Error internal webhook" });
    }
});

// ====================================================
// 10. FILE UPLOADER & GITHUB CDN PROXY
// ====================================================
const localFileUploader = fileUpload({
    createParentPath: true,
    limits: { fileSize: 100 * 1024 * 1024 }, 
});

const repoList = ['uploadergh', 'uploaderghv2', 'uploaderghv3'];
const githubToken = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER || 'arulzzzxd'; 
const branch = 'main';

const getRandomRepo = () => repoList[Math.floor(Math.random() * repoList.length)];

app.get('/files/*', async (req, res) => {
  const requestedPath = req.params[0]; 
  if (!requestedPath) return res.status(400).send('Missing file path');

  const gitPath = requestedPath.startsWith('uploads/') ? requestedPath : `uploads/${requestedPath}`;
  const shuffledRepos = [...repoList].sort(() => Math.random() - 0.5);

  for (const targetRepo of shuffledRepos) {
    try {
      const resp = await axios.get(`https://api.github.com/repos/${owner}/${targetRepo}/contents/${gitPath}?ref=${branch}`, {
        headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github.v3.raw' },
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

  return res.status(404).send('File tidak ditemukan');
});

app.post('/uploadfile', localFileUploader, async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ status: false, message: 'Tidak ada file yang diunggah.' });
  }

  let uploadedFile = req.files.file;
  const originalName = uploadedFile.name || 'file';
  const origExt = path.extname(originalName);

  let extension = origExt ? origExt.replace(/^\./, '') : (mime.extension(uploadedFile.mimetype) || 'bin');
  let id = generateId(8);
  let fileName = origExt ? `${id}${origExt}` : `${id}.${extension}`;
  let gitPath = `uploads/${fileName}`;
  let base64Content = Buffer.from(uploadedFile.data).toString('base64');

  const selectedRepo = getRandomRepo(); 

  try {
    await axios.put(`https://api.github.com/repos/${owner}/${selectedRepo}/contents/${gitPath}`, {
      message: `Upload file ${fileName}`, content: base64Content, branch
    }, {
      headers: { Authorization: `Bearer ${githubToken}`, 'Content-Type': 'application/json' }
    });

    return res.json({
      status: true, message: 'Unggahan Berhasil!',
      url: `https://cdn.arulzzxd.my.id/files/${fileName}`,
      fileName, size: uploadedFile.size
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: 'Gagal mengunggah file ke server.' });
  }
});

app.get('/database/download', async (req, res) => {
    const imageUrl = req.query.url || "https://arulz-uploader.vercel.app/files/CVmlrD.jpg";
    try {
        const response = await axios({ method: 'get', url: imageUrl, responseType: 'stream' });
        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="QRIS_Arulz_XD.jpg"');
        res.setHeader('Access-Control-Allow-Origin', '*'); 
        response.data.pipe(res);
    } catch (error) {
        res.status(500).json({ error: "Gagal memproses unduhan otomatis." });
    }
});

// ====================================================
// 11. DYNAMIC API ROUTER & RATE LIMITER MIDDLEWARE
// ====================================================
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
    if (keyType === 'vip') return { limitUsed: 0, maxLimit: "Unlimited", keyType };

    const now = new Date();
    const lastReset = user.lastLimitReset ? new Date(user.lastLimitReset) : new Date(0);
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const lastResetStr = lastReset.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    if (todayStr !== lastResetStr) {
        user.limit = 0;
        user.lastLimitReset = now;
        await User.findByIdAndUpdate(user._id, { $set: { limit: 0, lastLimitReset: now } });
    }

    return { limitUsed: user.limit || 0, maxLimit, keyType };
}

const getLimitMessage = (keyType, limitCount) => {
    if (keyType === 'premium') {
        return `Limit API Key Premium Anda telah habis (Maks ${limitCount} req/hari). Silakan upgrade ke VIP!`;
    }
    return `Limit API Key Free Anda telah habis (Maks ${limitCount} req/hari). Silakan upgrade ke Premium/VIP!`;
};

const apiKeyUserCache = new Map();
const routeModuleCache = new Map();

const validateApiKey = async (req, res, next) => {
    const fullEndpoint = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;

    if (req.path === '/apilist') {
        return next();
    }

    let userKey = req.query.apikey || req.body?.apikey || req.files?.apikey || req.file?.apikey || req.headers['x-api-key'];
    if (!userKey && req.user && req.user.apikey) userKey = req.user.apikey;

    if (!userKey) {
        return res.status(403).json({ status: false, creator: "Arulz-XD", message: "API Key mana? masukkan parameter ?apikey=MasukkanApiKey" });
    }

    let callerUser = req.user || null;
    if (!callerUser) {
        const cachedUser = apiKeyUserCache.get(userKey);
        if (cachedUser && (Date.now() - cachedUser.timestamp < 300000)) { 
            callerUser = cachedUser.data;
        } else {
            try {
                callerUser = await User.findOne({ apikey: userKey }).lean();
                if (callerUser) apiKeyUserCache.set(userKey, { data: callerUser, timestamp: Date.now() });
            } catch (dbErr) {
                return res.status(500).json({ status: false, message: "Internal server error." });
            }
        }
    }

    if (!callerUser) {
        return res.status(403).json({ status: false, creator: "Arulz-XD", message: "API Key salah atau tidak terdaftar!" });
    }

    req.user = callerUser;
    req.activeApiKey = userKey;

    let finalRole = (callerUser.role || 'Free User').toLowerCase();
    const pathParts = req.path.split('/');
    const routeKey = `${pathParts[1]}/${pathParts[2]}`;
    const routeModule = routeModuleCache.get(routeKey);

    if (routeModule) {
        if (routeModule.status === "error" || routeModule.status === "perbaikan") {
            return res.status(503).json({ status: false, creator: "Arulz-XD", message: "Fitur ini sedang dalam perbaikan / maintenance!" });
        }
        if (routeModule.type === "premium" && !finalRole.includes("premium") && !finalRole.includes("vip")) {
            return res.status(403).json({ status: false, creator: "Arulz-XD", message: "Endpoint ini khusus pengguna Premium!" });
        }
        if (routeModule.type === "vip" && !finalRole.includes("vip")) {
            return res.status(403).json({ status: false, creator: "Arulz-XD", message: "Endpoint eksklusif ini khusus pengguna VIP!" });
        }
    }
    next();
};

const trackAndEnforceLimit = async (req, res, next) => {
    const fullEndpoint = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;

    if (req.path === '/apilist') {
        return next();
    }

    const userKey = req.activeApiKey || req.query.apikey || req.body?.apikey || req.headers['x-api-key'];
    if (!userKey) return next();

    try {
        const user = await User.findOne({ apikey: userKey });
        if (!user) return next();

        const { limitUsed, maxLimit, keyType } = await getOrResetUserLimit(user);
        if (keyType === 'vip') return next();

        if (limitUsed >= maxLimit) {
            return res.status(429).json({ status: false, creator: "ArulzXD", message: getLimitMessage(keyType, maxLimit) });
        }

        await User.findByIdAndUpdate(user._id, { $inc: { limit: 1 } });
        next();
    } catch (err) {
        next();
    }
};

const apiKeyLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, 
    keyGenerator: (req) => req.activeApiKey || req.query.apikey || req.body?.apikey || req.headers['x-api-key'] || req.ip,
    validate: { keyGeneratorIpFallback: false },
    skip: (req) => getApiKeyType(req.user) === 'vip',
    max: (req) => getApiKeyType(req.user) === 'premium' ? 1000 : 100,
    handler: (req, res) => {
        const keyType = getApiKeyType(req.user);
        res.status(429).json({ status: false, creator: "ArulzXD", message: getLimitMessage(keyType, keyType === 'premium' ? 1000 : 100) });
    },
    standardHeaders: true, legacyHeaders: false
});

const logApiActivity = async (req, res, next) => {
    res.on('finish', async () => {
        const userKey = req.activeApiKey || req.query?.apikey || req.body?.apikey || req.headers['x-api-key'] || (req.user ? req.user.apikey : null);
        const fullEndpoint = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;

        if (
            userKey && 
            fullEndpoint.startsWith('/api/') && 
            !['/api/user-activity', '/api/user-limit', '/api/apilist'].includes(fullEndpoint)
        ) {
            try {
                let targetUser = req.user || await User.findOne({ apikey: userKey.trim() }).lean();
                if (!targetUser) return;

                await ApiLog.findOneAndUpdate(
                    { userId: targetUser._id || targetUser.id },
                    { 
                        $set: { 
                            apikey: userKey.trim(), 
                            username: targetUser.username || 'User', 
                            email: targetUser.email || '' 
                        },
                        $push: { 
                            log: { 
                                $each: [{ method: req.method, endpoint: fullEndpoint, status_code: res.statusCode, createdAt: new Date() }],
                                $position: 0 
                            } 
                        }
                    },
                    { upsert: true, new: true }
                );
            } catch (err) {
                console.error("❌ Gagal simpan log ke MongoDB:", err.message);
            }
        }
    });
    next();
};

// AUTO LOAD API ENDPOINTS
const router = express.Router();
const apiPath = path.join(__dirname, 'api');
router.use(validateApiKey);

if (fs.existsSync(apiPath)) {
    const endpointDirs = fs.readdirSync(apiPath).filter(f => fs.statSync(path.join(apiPath, f)).isDirectory());

    for (const category of endpointDirs) {
        const categoryPath = path.join(apiPath, category);
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const routeName = path.basename(file, '.js');
            const routeFilePath = path.join(categoryPath, file);
            const route = require(routeFilePath);

            routeModuleCache.set(`${category}/${routeName}`, route);
            router.use(`/${category}/${routeName}`, route);
        }
    }

    function formatEndpointTitle(filename) {
        return filename.replace(/\.js$/, "").replace(/[-_]/g, " ")
            .split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }

    function getEndpointsFromRouter(category, file) {
        const endpoints = [];
        const routePath = path.join(apiPath, category, file);
        let route;
        try { route = require(routePath); } catch (e) { return endpoints; }

        const subRouter = route.stack ? route : route.router || route;
        if (!subRouter || !subRouter.stack) return endpoints;

        const endpointTitle = route.title || (route.name && route.name !== 'router' ? route.name : formatEndpointTitle(file));
        const routeDesc = route.desc || subRouter.desc || `/${category}/${file.replace(/\.js$/, "")}`;

        subRouter.stack.forEach(layer => {
            if (layer.route) {
                const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
                let params = { apikey: "" }; 

                if (route.paramsConfig) params = { apikey: "", ...route.paramsConfig };
                else if (layer.route.stack && layer.route.stack.length) {
                    layer.route.stack.forEach(mw => {
                        if (!mw.handle) return;
                        const fnString = mw.handle.toString();
                        [...fnString.matchAll(/req\.query\.([a-zA-Z0-9_]+)/g)].forEach(m => { params[m[1]] = ""; });
                        [...fnString.matchAll(/req\.body\.([a-zA-Z0-9_]+)/g)].forEach(m => { params[m[1]] = ""; });
                    });
                }

                if (methods.some(m => ["POST", "PUT", "PATCH"].includes(m)) && Object.keys(params).length <= 1) {
                    params.fileToUpload = "file";
                }

                endpoints.push({
                    name: endpointTitle, path: `/api/${category}/${file.replace(/\.js$/, "")}`,
                    desc: routeDesc, status: route.status || "ready", type: route.type || "free", params, methods
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
            for (const file of files) endpoints.push(...getEndpointsFromRouter(category, file));
            if (endpoints.length) categories.push({ name: `${category.toUpperCase()}`, items: endpoints });
        }
        categories.push({ name: "OTHER", items: [{ name: "/apilist", path: "/api/apilist", desc: "/apilist", status: "ready", type: "free", params: { apikey: "" }, methods: ["GET"] }] });
        res.json({ categories });
    });
}

// Mount Master API Endpoint Router
app.use('/api', validateApiKey, trackAndEnforceLimit, apiKeyLimiter, logApiActivity, router);

// API User Limit & Activity Logs
app.get('/api/user-limit', checkAuthSession, async (req, res) => {
    let userKey = req.query.apikey || req.headers['x-api-key'] || (req.user ? req.user.apikey : null);
    if (!userKey) return res.json({ loggedIn: false, limitUsed: 0, maxLimit: 100, type: 'free' });

    try {
        const user = await User.findOne({ apikey: userKey });
        if (!user) return res.json({ loggedIn: false, limitUsed: 0, maxLimit: 100, type: 'free' });

        const { limitUsed, maxLimit, keyType } = await getOrResetUserLimit(user);
        return res.json({ loggedIn: !!req.user, limitUsed, maxLimit: maxLimit === Infinity ? "Unlimited" : maxLimit, type: keyType });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server Error" });
    }
});

app.get('/api/user-activity', async (req, res) => {
    try {
        let userId = req.user ? (req.user._id || req.user.id) : null;
        if (!userId) {
            const userKey = req.query?.apikey || req.headers['x-api-key'];
            if (userKey) {
                const foundUser = await User.findOne({ apikey: userKey.trim() }).lean();
                if (foundUser) userId = foundUser._id;
            }
        }

        if (!userId) return res.json({ status: true, data: [] });

        const userLogDoc = await ApiLog.findOne({ userId }).lean();
        if (!userLogDoc || !userLogDoc.log || userLogDoc.log.length === 0) return res.json({ status: true, data: [] });

        const formattedLogs = userLogDoc.log
             .filter(item => item.endpoint !== '/api/apilist' && item.endpoint !== '/api/verify-turnstile')
             .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
             .map(item => {
                 const timeStr = new Date(item.createdAt || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
                 const statusStr = item.status_code >= 200 && item.status_code < 300 ? 'OK' : 'ERR';
                 return `[${timeStr}] [${statusStr}] [${item.method}] : ${item.endpoint}`;
             });

        return res.json({ status: true, data: formattedLogs });
    } catch (err) {
        return res.status(500).json({ status: false, data: [] });
    }
});

// ====================================================
// 12. GENERAL SYSTEM & SERVICE WORKER API
// ====================================================
app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(`
        self.addEventListener('install', (event) => { self.skipWaiting(); });
        self.addEventListener('activate', (event) => { event.waitUntil(clients.claim()); });
        self.addEventListener('push', function(event) {
            let data = {};
            if (event.data) { try { data = event.data.json(); } catch (e) { data = { title: 'Notifikasi', body: event.data.text() }; } }
            const title = data.title || '⚡ BUKTI TRANSAKSI BARU!';
            const options = {
                body: data.body || 'Ada transaksi baru masuk.', icon: data.icon || 'https://cdn.arulzzxd.my.id/files/iJKbzK38.png',
                badge: data.badge || 'https://cdn.arulzzxd.my.id/files/iJKbzK38.png', image: data.image || null,
                vibrate: [500, 150, 500, 150, 500], tag: 'trx-' + (data.orderId || Date.now()),
                requireInteraction: true, data: { orderId: data.orderId },
                actions: [{ action: 'approve', title: '⚡ KONFIRMASI LUNAS' }]
            };
            event.waitUntil(self.registration.showNotification(title, options));
        });
        self.addEventListener('notificationclick', function(event) {
            event.notification.close();
            const data = event.notification.data || {};
            if (event.action === 'approve' && data.orderId) {
                event.waitUntil(
                    fetch('/api/admin/transactions/' + data.orderId + '/approve', { method: 'POST' })
                        .then(res => res.json())
                        .then(() => self.registration.showNotification('✅ TRANSAKSI LUNAS!', { body: 'Order ' + data.orderId + ' LUNAS!' }))
                );
            } else {
                event.waitUntil(clients.matchAll({ type: 'window' }).then(clientList => {
                    for (let client of clientList) { if (client.url.includes('/admin') && 'focus' in client) return client.focus(); }
                    if (clients.openWindow) return clients.openWindow('/admin');
                }));
            }
        });
    `);
});

app.post('/api/feedback', async (req, res) => {
    const { email, type, message } = req.body;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ status: false, message: "Format email tidak valid!" });
    if (!type || !message) return res.status(400).json({ status: false, message: "Tipe & isi pesan wajib diisi!" });

    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', port: 465, secure: true, 
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, tls: { rejectUnauthorized: false }
        });

        await Promise.all([
            transporter.sendMail({
                from: `"${email}" <${process.env.SMTP_USER}>`, to: process.env.SMTP_USER, replyTo: email,
                subject: `[${type.toUpperCase()}] Feedback Baru`,
                html: `<p>Feedback dari ${email}:</p><p>${message}</p>`
            }),
            transporter.sendMail({
                from: `"Support ArulzXD" <${process.env.SMTP_USER}>`, to: email,
                subject: `Terima Kasih atas Feedback Anda`,
                html: `<p>Halo, feedback Anda telah kami terima.</p>`
            })
        ]);

        return res.json({ status: true, message: "Feedback berhasil dikirim!" });
    } catch (error) {
        return res.status(500).json({ status: false, message: "Gagal mengirim email feedback." });
    }
});

app.get('/api/server-status', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    res.json({
        platform: os.platform(), architecture: os.arch(), uptime: os.uptime(),
        totalMemory: (totalMem / (1024 ** 3)).toFixed(2) + " GB",
        usedMemory: (usedMem / (1024 ** 3)).toFixed(2) + " GB",
        freeMemory: (freeMem / (1024 ** 3)).toFixed(2) + " GB",
        memoryUsagePercent: ((usedMem / totalMem) * 100).toFixed(2),
        cpuModel: os.cpus()[0].model, cpuSpeed: os.cpus()[0].speed + " MHz",
        cpuCores: os.cpus().length, loadAverage: os.loadavg()
    });
});

// ====================================================
// 13. CRON JOBS & SERVER LISTEN
// ====================================================
cron.schedule('0 * * * *', async () => {
    try {
        const expiredUsers = await User.find({ role: { $ne: 'Free User' }, roleExpiresAt: {$lte: new Date() } });
        for (const user of expiredUsers) {
            user.role = 'Free User';
            user.roleExpiresAt = null;
            user.apikey = generateFreeApiKey();
            await user.save();
            console.log(`📉 [EXPIRED] Role ${user.username} dikembalikan ke Free User.`);
        }
    } catch (err) {
        console.error('❌ [CRON] Error:', err.message);
    }
}, { scheduled: true, timezone: "Asia/Jakarta" });

mongoose.connection.once('open', async () => {
    try {
        await mongoose.connection.db.collection('transactions').dropIndex('transactionId_1');
        console.log('🧹 Berhasil menghapus index lama transactionId_1');
    } catch (e) {}
});

// ====================================================
// 14. PAGE ROUTES (HTML VIEWS & ASSETS)
// ====================================================
app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'home.html')));
app.get('/login', (req, res) => req.user ? res.redirect('/docs') : res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/uploader', (req, res) => res.sendFile(path.join(__dirname, 'public', 'uploader.html')));
app.get('/feedback', (req, res) => res.sendFile(path.join(__dirname, 'public', 'feedback.html')));
app.get('/pastecode', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pastecode.html')));
app.get('/profile', (req, res) => req.user ? res.sendFile(path.join(__dirname, 'public', 'profile.html')) : res.redirect('/login'));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy.html')));
app.get('/support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'support.html')));
app.get('/status', (req, res) => res.sendFile(path.join(__dirname, 'public', 'status.html')));
app.get('/upgrade-apikey', (req, res) => res.sendFile(path.join(__dirname, 'public', 'upgrade-apikey.html')));
app.get('/store', (req, res) => res.sendFile(path.join(__dirname, 'public', 'store.html')));

app.get('/store/:productId', async (req, res) => {
    try {
        const product = await Product.findOne({ Id: req.params.productId });
        let htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'store.html'), 'utf8');

        if (product) {
            const hargaFormatted = product.harga_diskon ? `Rp ${product.harga_diskon.toLocaleString('id-ID')}` : `Rp ${product.harga.toLocaleString('id-ID')}`;
            const metaTags = `
                <meta property="og:title" content="${product.nama} - ArulzXD Store" />
                <meta property="og:description" content="${product.deskripsi ? product.deskripsi.slice(0, 150) : ''}... | Harga: ${hargaFormatted}" />
                <meta property="og:image" content="${product.gambar}" />
                <meta property="og:url" content="https://api.arulzzxd.my.id/store/${product.Id}" />
            `;
            htmlContent = htmlContent.replace('<head>', `<head>${metaTags}`);
        }
        res.send(htmlContent);
    } catch (error) {
        res.sendFile(path.join(__dirname, 'public', 'store.html'));
    }
});

app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));
app.get('/styles.css', (req, res) => res.sendFile(path.join(__dirname, 'styles.css')));

app.get('/docs', async (req, res) => {
    let activeUser = req.user;

    // Ambil data user paling baru dari MongoDB
    if (req.user) {
        try {
            const freshUser = await User.findById(req.user.id || req.user._id).lean();
            if (freshUser) activeUser = freshUser;
        } catch (e) {}
    }

    const currentApiKey = activeUser ? activeUser.apikey : 'Silakan Login';

    res.send(`<!DOCTYPE html>
<html lang="id" class="notranslate" translate="no">
<head>
    <meta charset="UTF-8" />
    <meta name="google" content="notranslate" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"/>
    <title>Arulz-XD API - Documentation</title>
    <meta property="og:title" content="ArulzXD API - Documentation" />
    <meta property="og:description" content="Layanan REST API resmi untuk dokumentasi dan integrasi pengembang aplikasi." />
    <meta property="og:image" content="https://cdn.arulzzxd.my.id/files/iJKbzK38.png" />
    <meta property="og:url" content="https://api.arulzzxd.my.id/" />
    <meta property="og:type" content="website" />
    <link rel="icon" href="https://cdn.arulzzxd.my.id/files/iJKbzK38.png" type="image/png">
    
    <!-- Tailwind CSS, Google Fonts, & FontAwesome -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="styles.css" />
    
    <style>
    :root {
        --bg-cream: #FAF7EF;
        --card-bg: #FFFDF8;
        --border-dark: #121212;
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
        width: 100%;
        min-height: 100vh;
        margin: 0;
        padding: 0;
        touch-action: pan-x pan-y;
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        background-color: var(--bg-cream) !important;
        color: var(--border-dark) !important;
        background-image: radial-gradient(rgba(0, 0, 0, 0.12) 1.2px, transparent 1.2px) !important;
        background-size: 16px 16px !important;
        overflow-x: hidden;
    }

    .code-font {
        font-family: 'JetBrains Mono', monospace !important;
    }

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

    .theme-border-accent {
        border-color: var(--theme-border) !important;
        transition: border-color 0.15s ease;
    }

    .theme-light-bg {
        background-color: var(--theme-light) !important;
        border-color: var(--theme-border) !important;
        transition: all 0.15s ease;
    }

    .theme-input:focus {
        outline: none !important;
        border-color: var(--theme-border) !important;
        box-shadow: 0 0 0 3px var(--theme-accent) !important;
    }

    /* MODE RGB DYNAMIC ROTATING BORDER */
.rgb-mode-active .light-card,
.rgb-mode-active .stat-box,
.rgb-mode-active .banner-video-container,
.rgb-mode-active .category-group > div.glass-panel,
.rgb-mode-active #searchInput,
.rgb-mode-active .dropdown-nav-card,
.rgb-mode-active #themeMenuDropdown,
.rgb-mode-active .cyber-loader-box,
.rgb-mode-active .cyber-bar,
.rgb-mode-active .light-popup-bg,
.rgb-mode-active .light-card-box {
    border-color: transparent !important;
    background-image: linear-gradient(var(--card-bg), var(--card-bg)), 
                      conic-gradient(from var(--rgb-angle), #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000) !important;
    background-origin: border-box !important;
    background-clip: padding-box, border-box !important;
}

    .rgb-mode-active .theme-bg-accent,
    .rgb-mode-active #categoryFilters button.active,
    .rgb-mode-active .filter-btn.active {
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
        color: var(--border-dark);
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

    .banner-video-container {
        width: 100% !important;
        border: 2.5px solid var(--theme-border) !important;
        border-radius: 20px !important;
        overflow: hidden !important;
        position: relative !important;
        background-color: #000000 !important;
        box-shadow: 4px 4px 0px rgba(18, 18, 18, 0.08) !important;
    }
    .banner-video-el {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        display: block !important;
    }

    .stat-box {
        background-color: var(--card-bg) !important;
        border: 2.5px solid var(--theme-border) !important;
        border-radius: 18px !important;
        padding: 12px 14px !important;
        min-height: 98px !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        box-shadow: 3px 3px 0px rgba(18, 18, 18, 0.08) !important;
    }
    .stat-label {
        font-size: 10px !important;
        font-weight: 900 !important;
        letter-spacing: 0.05em !important;
        color: var(--border-dark) !important;
        text-transform: uppercase !important;
        margin: 0 !important;
        line-height: 1.2 !important;
    }
    .stat-value {
        font-size: 22px !important;
        font-weight: 900 !important;
        font-family: 'JetBrains Mono', monospace !important;
        color: var(--border-dark) !important;
        line-height: 1.1 !important;
        margin: 0 !important;
    }
    .stat-sub {
        font-size: 9px !important;
        font-weight: 700 !important;
        color: #52525b !important;
    }

    #apiList {
        background-color: transparent !important;
    }

    .category-group {
        margin-bottom: 16px !important;
    }

    .category-group > div.glass-panel {
        background-color: var(--card-bg) !important;
        border: 2.5px solid var(--theme-border) !important;
        border-radius: 20px !important;
        box-shadow: 4px 4px 0px rgba(18, 18, 18, 0.08) !important;
        overflow: hidden !important;
    }

    #apiList .api-item {
        background-color: var(--card-bg) !important;
        border-top: 2px solid var(--theme-border) !important;
        transition: background-color 0.15s ease;
    }

    #apiList .api-item > button {
        background-color: transparent !important;
        color: var(--border-dark) !important;
    }
    #apiList .api-item > button p { color: var(--border-dark) !important; font-weight: 800 !important; }

    #apiList .api-item > div[id^="ep-"] {
        background-color: #FAF7EF !important; 
        border-top: 2px dashed var(--theme-border) !important;
        padding: 16px !important;
    }
    
    #apiList .api-item > div[id^="ep-"] .bg-slate-900\/60,
    #apiList .api-item > div[id^="ep-"] .bg-slate-900\/40,
    #apiList .api-item > div[id^="ep-"] > div.mb-4 > div.bg-slate-900\/40 {
        background-color: #FFFDF8 !important;
        border: 2px solid var(--theme-border) !important;
        box-shadow: none !important;
        color: var(--border-dark) !important;
        border-radius: 14px !important;
    }

    #apiList .api-item > div[id^="ep-"] h4,
    #apiList .api-item > div[id^="ep-"] p,
    #apiList .api-item > div[id^="ep-"] span,
    #apiList .api-item > div[id^="ep-"] code {
        color: var(--border-dark) !important;
    }

    #apiList form label {
        color: var(--border-dark) !important;
        font-weight: 900 !important;
    }

    #apiList form input,
    #apiList form select,
    #apiList form button[id^="custom-select-"] {
        background-color: #FFFDF8 !important;
        border: 2px solid var(--theme-border) !important;
        color: var(--border-dark) !important;
        font-weight: 700 !important;
        border-radius: 12px !important;
        box-shadow: none !important;
    }
    #apiList form input::placeholder { color: #a1a1aa !important; font-weight: 600 !important; }

    .select-modal-container {
        background-color: #FFFDF8 !important;
        border: 2.5px solid var(--theme-border) !important;
        border-radius: 20px !important;
    }
    .select-modal-container .select-modal-item { color: var(--border-dark) !important; border-bottom: 1px solid rgba(18,18,18,0.1) !important; }
    .select-modal-container .select-modal-item.selected { background-color: var(--theme-border) !important; color: #fff !important; }

    #apiList button[type="submit"] {
        background-color: var(--theme-accent) !important;
        color: var(--theme-text) !important;
        border: 2px solid var(--theme-border) !important;
        border-radius: 12px !important;
        font-weight: 900 !important;
        box-shadow: 3px 3px 0px rgba(18,18,18,0.12) !important;
        transition: all 0.15s ease !important;
    }
    #apiList button[type="submit"]:active { transform: translateY(1px) !important; box-shadow: 1px 1px 0px rgba(18,18,18,0.12) !important; }

    #apiList button[onclick^="clearResponse"] {
        background-color: #FFFDF8 !important;
        color: var(--border-dark) !important;
        border: 2px solid var(--theme-border) !important;
        border-radius: 12px !important;
        font-weight: 800 !important;
        box-shadow: 2px 2px 0px rgba(18,18,18,0.08) !important;
    }

    #apiList [id^="response-content-"] > div {
        background-color: #FFFDF8 !important;
        border: 2.5px solid var(--theme-border) !important;
        border-radius: 18px !important;
        box-shadow: 4px 4px 0px rgba(18, 18, 18, 0.08) !important;
        overflow: hidden !important;
    }

    #apiList [id^="response-content-"] .bg-black\/60,
    #apiList [id^="response-content-"] .bg-black\/40 {
        background-color: #FAF7EF !important;
        border-bottom: 2px solid var(--theme-border) !important;
    }

    #apiList [id^="response-content-"] .bg-black\/60 span,
    #apiList [id^="response-content-"] .bg-black\/40 span {
        color: var(--border-dark) !important;
        font-weight: 900 !important;
    }

    #apiList [id^="response-content-"] .grid {
        background-color: #FAF7EF !important;
        border-bottom: 2px solid var(--theme-border) !important;
        padding: 10px !important;
        gap: 8px !important;
    }

    #apiList [id^="response-content-"] .grid > div {
        background-color: #FFFDF8 !important;
        border: 2px solid var(--theme-border) !important;
        border-radius: 12px !important;
    }

    #apiList [id^="response-content-"] pre {
        background-color: #FFFDF8 !important;
        color: #0f172a !important;
        font-weight: 600 !important;
        padding: 16px !important;
    }

    #apiList [id^="response-content-"] pre code {
        color: #0284c7 !important;
        font-family: 'JetBrains Mono', monospace !important;
        font-weight: 700 !important;
    }

    #apiList [id^="response-content-"] .border-t-2 {
        background-color: #FAF7EF !important;
        border-top: 2px solid var(--theme-border) !important;
        padding: 12px 16px !important;
    }

    #apiList [id^="response-content-"] button {
        background-color: #FFFDF8 !important;
        color: var(--border-dark) !important;
        border: 2px solid var(--theme-border) !important;
        border-radius: 10px !important;
        font-weight: 800 !important;
        box-shadow: 2px 2px 0px rgba(18, 18, 18, 0.08) !important;
    }

    #apiList .api-item .status-ready { background-color: #86efac !important; color: #121212 !important; border: 1.5px solid var(--theme-border) !important; }
    #apiList .api-item .status-update { background-color: #fde047 !important; color: #121212 !important; border: 1.5px solid var(--theme-border) !important; }
    #apiList .api-item .status-error { background-color: #fca5a5 !important; color: #121212 !important; border: 1.5px solid var(--theme-border) !important; }
    
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
        border: 2.5px solid var(--theme-border) !important;
        color: var(--border-dark) !important;
        border-radius: 18px !important;
        font-weight: 700 !important;
        box-shadow: 3px 3px 0px rgba(18, 18, 18, 0.06) !important;
    }
    #searchInput::placeholder { color: #71717a !important; }

    #categoryFilters button, .filter-btn {
        background-color: #FFFDF8 !important;
        border: 2px solid var(--theme-border) !important;
        color: var(--border-dark) !important;
        border-radius: 9999px !important;
        font-weight: 800 !important;
        font-size: 11px !important;
        padding: 6px 16px !important;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 2px 2px 0px rgba(18, 18, 18, 0.05);
    }
    #categoryFilters button.active, .filter-btn.active {
        background-color: var(--theme-accent) !important;
        color: var(--theme-text) !important;
        border-color: var(--theme-border) !important;
        transform: translateY(-1px);
        box-shadow: 3px 3px 0px rgba(18, 18, 18, 0.12);
    }

    .lang-btn {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 800;
        padding: 4px 10px;
        border: 1.5px solid var(--theme-border);
        background-color: #FAF7EF;
        color: var(--border-dark);
        border-radius: 8px;
    }
    .lang-btn.active {
        background-color: var(--theme-border);
        color: #ffffff;
    }

    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

    .light-popup-bg {
        background-color: var(--card-bg) !important;
        border: 2.5px solid var(--theme-border) !important;
        box-shadow: 8px 8px 0px rgba(18, 18, 18, 0.2) !important;
        color: var(--border-dark) !important;
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
        color: var(--border-dark) !important;
        font-weight: 800 !important;
    }
    .light-solid-header {
        background-color: var(--theme-border) !important;
        color: #ffffff !important;
        font-weight: 900 !important;
        border-radius: 10px !important;
    }
    </style>
</head>
<body class="min-h-screen pb-12 antialiased light-mode text-slate-900">

<!-- Loader Overlay Cyberpunk Light Style -->
<div id="cyber-loader-overlay">
    <div class="cyber-loader-box">
        <div class="cyber-avatar-wrap mb-4">
            <div class="cyber-ring"></div>
            <img src="https://cdn.arulzzxd.my.id/files/iJKbzK38.png" alt="Logo" class="w-14 h-14 rounded-full object-cover border-2 border-zinc-900 shadow-sm">
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
    <div class="p-6 w-full max-w-md relative font-['Plus_Jakarta_Sans'] text-zinc-900 bg-[#FFFDF8] border-2 border-zinc-900 rounded-2xl shadow-xl">
      <button id="closePopupBtn" class="absolute top-4 right-4 text-zinc-500 hover:text-zinc-900 bg-zinc-200 rounded-full p-1.5 focus:outline-none border border-zinc-900">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      
      <div class="text-center mb-4">
        <h1 class="text-xl font-extrabold text-zinc-900 leading-tight">
          WELCOME TO <span class="theme-text-accent font-black">ARULZ-XD API</span>
        </h1>
      </div>
      
      <div class="mb-4 rounded-xl overflow-hidden border-2 border-zinc-900 bg-black relative">
        <img src="https://cdn.arulzzxd.my.id/files/K4Sf61.png" alt="Welcome Banner" class="w-full h-auto object-cover max-h-44" />
      </div>
      
      <div class="text-center text-zinc-700 text-xs mb-5 leading-relaxed font-semibold">
        <p>Halo! Selamat datang di Arulz-XD REST API Core. Gunakan API Key di bawah ini untuk memulai pengujian endpoint secara langsung.</p>
      </div>
      
      <div class="mb-5 flex justify-center">
        <div class="bg-zinc-100 border-2 border-zinc-900 rounded-full py-2 px-5 text-center">
          <span class="font-bold text-xs text-zinc-900 font-mono">
            APIKEY : <span id="welcomeApiKey" class="font-mono text-blue-600 select-all font-extrabold">${(req.user && req.user.apikey) ? req.user.apikey : 'Silakan Login'}</span>
          </span>
        </div>
      </div>
      
      <a href="/support" class="w-full theme-bg-accent font-extrabold py-3 px-6 rounded-xl border-2 border-zinc-900 text-xs block text-center uppercase tracking-wider shadow-xs">
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
                    <div class="w-full h-full rounded-full p-0.5 border-2 border-zinc-900 shadow-sm overflow-hidden bg-white">
                        <img id="userAvatar" src="https://cdn.arulzzxd.my.id/files/X1F0Cn.png" class="w-full h-full rounded-full object-cover">
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
                <span class="text-[10px] font-black text-white border-2 border-zinc-900 bg-zinc-900 px-2.5 py-0.5 rounded-md uppercase">Api Key Kamu :</span>
            </div>
            
            <div class="light-pill-capsule text-zinc-900 text-xs font-black py-1.5 px-3 truncate mb-3 text-center font-mono">
                <span id="userApiKey">loading-key</span>
            </div>

            <div id="vipCustomKeyBox" class="hidden mb-3">
                <div class="flex gap-1.5">
                    <input type="text" id="customApiKeyInput" placeholder="Ketik Custom API Key..." class="w-full bg-[#FFFDF8] border-2 border-zinc-900 rounded-xl px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-500 focus:outline-none font-bold">
                    <button onclick="saveCustomApiKey()" class="theme-bg-accent text-zinc-900 border-2 border-zinc-900 text-[10px] px-3 rounded-xl uppercase font-extrabold shadow-sm active:scale-95">SIMPAN</button>
                </div>
            </div>
            
            <button onclick="copyText(document.getElementById('userApiKey').innerText, 'API Key')" class="w-full bg-zinc-900 hover:bg-zinc-800 text-white border-2 border-zinc-900 text-xs py-2 rounded-xl uppercase tracking-widest font-extrabold active:scale-95 transition-all">
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
            <a href="/upgrade-apikey" class="w-full theme-bg-accent text-zinc-900 border-2 border-zinc-900 font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 uppercase tracking-widest active:scale-95 transition-all shadow-sm">
                UPGRADE VIP
            </a>
            <div class="flex gap-2">
                <button onclick="closeProfilePopup()" class="flex-1 light-pill-capsule hover:bg-zinc-200 text-zinc-900 font-black text-xs py-2 uppercase tracking-widest transition-all">
                    TUTUP
                </button>
                <a href="/auth/logout" class="flex-1 border-2 border-zinc-900 bg-red-500 hover:bg-red-600 text-white font-black text-xs py-2 rounded-full flex items-center justify-center uppercase tracking-widest transition-all shadow-sm">
                    LOG OUT
                </a>
            </div>
        </div>
    </div>
  </div>
</div>

<div id="toast" class="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none items-end"></div>

<!-- Header Top Bar -->
<header class="fixed top-0 left-0 right-0 w-full bg-[#FAF7EF] border-b-2 border-zinc-900 z-30 shadow-xs">
    <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl border-2 border-zinc-900 bg-black flex items-center justify-center shadow-sm">
                <img src="https://cdn.arulzzxd.my.id/files/iJKbzK38.png" alt="Logo" class="w-8 h-8 rounded-lg object-cover">
            </div>
            <div>
                <span class="text-base font-black text-zinc-900 tracking-tight block leading-none">Arulzxd API</span>
                <span class="text-[10px] font-mono font-bold text-zinc-600 uppercase">DOCUMENTATION GATEWAY</span>
            </div>
        </div>

        <div class="flex items-center gap-2 relative">
            <button id="themePickerBtn" title="Ubah Style Warna" class="w-10 h-10 rounded-xl border-2 border-zinc-900 theme-bg-accent flex items-center justify-center active:scale-95 shadow-sm transition-all">
                <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61.43.53 1.03.89 1.7.89h1.83c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.97-4.03-9-9-9zm-6.5 9c-.83 0-1.5-.67-1.5-1.5S4.67 9 5.5 9s1.5.67 1.5 1.5S6.33 12 5.5 12zm3-4C7.67 8 7 7.33 7 6.5S7.67 5 8.5 5s1.5.67 1.5 1.5S9.33 8 8.5 8zm7 0c-.83 0-1.5-.67-1.5-1.5S14.67 5 15.5 5s1.5.67 1.5 1.5S16.33 8 15.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
            </button>

            <button id="bioMenuBtn" class="w-10 h-10 rounded-xl border-2 border-zinc-900 bg-[#FAF7EF] flex items-center justify-center text-zinc-900 active:scale-95 shadow-sm">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            </button>

            <div id="themeMenuDropdown" class="hidden absolute top-12 right-0 w-44 bg-[#FFFDF8] border-2 border-zinc-900 rounded-xl p-2 shadow-2xl z-50 flex flex-col gap-1.5">
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

<div id="menuOverlay" class="fixed inset-0 bg-black/60 hidden z-40"></div>

<!-- Sidebar Dropdown Nav -->
<div id="bioDropdown" class="fixed top-0 right-0 h-full w-80 bg-[#FAF7EF] border-l-2 border-zinc-900 transform translate-x-full transition-transform duration-300 ease-in-out z-50 shadow-2xl flex flex-col p-4 text-zinc-900 overflow-y-auto scrollbar-hide">
    <div class="flex items-center justify-between pb-3 mb-3 border-b-2 border-zinc-900">
        <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 theme-bg-accent border-2 border-zinc-900 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                ARULZXD API
            </span>
        </div>

        <div class="flex items-center gap-2">
            <div class="flex border-2 border-zinc-900 rounded-lg p-0.5 bg-zinc-200">
                <button id="lang-id" class="lang-btn active" onclick="setLanguage('id')">ID</button>
                <button id="lang-en" class="lang-btn" onclick="setLanguage('en')">EN</button>
            </div>
            <button id="closeMenuBtn" class="w-8 h-8 rounded-lg border-2 border-zinc-900 bg-[#FAF7EF] flex items-center justify-center text-zinc-900 active:scale-95">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    </div>

    <div class="mb-3.5 rounded-xl border-2 border-zinc-900 overflow-hidden bg-black h-44 w-full relative shadow-sm">
        <video id="sidebarBannerVideo" autoplay loop muted playsinline preload="auto" class="w-full h-full object-cover">
            <source src="https://files.catbox.moe/dvlk00.mp4" type="video/mp4">
        </video>
    </div>

    <div id="sidebarAuthBtnContainer" class="mb-3">
        ${req.user ? `
        <button <a href="/profile" class="w-full bg-blue-50 border-2 border-blue-600 rounded-xl p-2.5 flex items-center justify-between text-zinc-900 transition-all active:scale-95 shadow-xs"> 
            <div class="flex items-center gap-2.5 truncate">
                <img id="sidebarUserAvatar" src="${req.user.avatar || 'https://cdn.arulzzxd.my.id/files/X1F0Cn.png'}" class="w-7 h-7 rounded-lg border-2 border-zinc-900 object-cover">
                <div class="truncate text-left leading-tight">
                    <span class="block text-xs font-black truncate">${req.user.username}</span>
                    <span class="block text-[9px] text-blue-600 font-bold">AKUN TERHUBUNG</span>
                </div>
            </div>
            <span class="text-[9px] bg-blue-600 text-white font-black px-2 py-1 rounded-md tracking-wider">PROFILE</span>
        </button>
        ` : `
        <div class="p-3 bg-amber-100 border-2 border-zinc-900 rounded-xl shadow-xs">
            <div class="flex items-center gap-1.5 text-amber-900 text-xs font-black mb-1">
                <svg class="w-4 h-4 text-amber-700 fill-current" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <span>PERINGATAN!</span>
            </div>
            <p class="text-[10px] font-semibold text-zinc-700 leading-tight mb-2.5">
                Anda belum login. Silakan login untuk membuka akses penuh fitur dan endpoint API.
            </p>
            <a href="/login" class="w-full bg-zinc-900 text-white border-2 border-zinc-900 rounded-xl py-2 px-3 text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all text-center">
                <svg class="w-3.5 h-3.5 fill-white shrink-0" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                <span>LOGIN / REGISTER</span>
            </a>
        </div>
        `}
    </div>

    <nav class="space-y-2 flex-1 pb-4">
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
            <span class="bg-zinc-900 text-white text-[9px] font-black px-2 py-0.5 rounded-full lowercase">new</span>
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

<!-- Main Mobile & Desktop Container -->
<main class="max-w-4xl mx-auto px-4 pt-20 pb-5 relative z-10 space-y-5">
    
    <!-- 1. Banner Video Utama -->
    <div class="banner-video-container h-52 sm:h-72 md:h-80">
        <video autoplay loop muted playsinline class="banner-video-el">
            <source src="https://files.catbox.moe/dvlk00.mp4" type="video/mp4">
            <img src="https://files.catbox.moe/dvlk00.mp4" alt="Main Banner" class="banner-video-el">
        </video>
    </div>

    <!-- 2. Grid Statistik Real-time -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="stat-box">
            <span class="stat-label">REAL-TIME CLOCK</span>
            <div id="liveClock" class="stat-value">00:00:00</div>
            <div id="liveDate" class="stat-sub uppercase truncate">Loading...</div>
        </div>
        <div class="stat-box">
            <div class="flex items-center justify-between w-full">
                <span class="stat-label">LIMIT USED</span>
                <span id="userLimitBadge" class="text-[9px] font-black text-zinc-900 bg-zinc-200 px-1.5 py-0.5 rounded border border-zinc-900 uppercase">FREE</span>
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

    <!-- 3. Search Bar -->
    <div class="pt-1">
        <div class="relative">
            <input 
                type="text" 
                id="searchInput" 
                placeholder="Cari Endpoint Atau Kategori...."
                class="theme-input w-full py-4 pl-11 pr-4 text-xs font-bold rounded-2xl border-2 border-zinc-900 bg-[#FFFDF8] text-zinc-900 placeholder-zinc-500 focus:outline-none"
            >
            <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
        </div>
        <div id="categoryFilters" class="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide"></div>
    </div>

    <div id="noResults" class="text-center py-8 hidden">
        <h3 id="no-results-title" class="text-xs font-black text-zinc-900 mb-1">Endpoint Tidak Ditemukan</h3>
        <p id="no-results-desc" class="text-[10px] font-semibold text-zinc-600">Coba gunakan kata kunci pencarian yang lain.</p>
    </div>

    <!-- 4. Daftar API List -->
    <div id="apiList" class="space-y-4 pt-1"></div>

    <footer id="siteFooter" class="mt-10 pt-4 border-t-2 border-zinc-300 text-center text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
        © 2026 ARULZ-XD API REST CORE
    </footer>
</main>

<div id="imageLightbox" class="fixed inset-0 bg-black/90 z-[100] hidden flex items-center justify-center p-4">
    <div class="relative max-w-4xl max-h-[90vh]">
        <img id="lightboxImage" src="" alt="Preview" class="max-w-full max-h-[85vh] rounded-lg object-contain" />
        <button id="closeLightbox" class="absolute -top-10 right-0 text-white font-mono text-xs bg-black px-3 py-1 rounded border border-white">✕ Close</button>
    </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/moment.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/locale/id.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment-timezone/0.5.45/moment-timezone-with-data.min.js"></script>

<script class="notranslate" translate="no">
    const displayApiKey = "${currentApiKey}";
</script>
<script src="script.js"></script>

<script>
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
                background: '#FFFDF8',
                color: '#121212',
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
                    const latestAvatar = data.user.avatar || 'https://cdn.arulzzxd.my.id/files/X1F0Cn.png';

                    document.querySelectorAll('#userAvatar, #sidebarUserAvatar').forEach(img => {
                        if (img) img.src = latestAvatar;
                    });

                    document.getElementById('userName').innerText = data.user.username || 'User';
                    document.getElementById('userEmail').innerText = data.user.email || 'no-email@mail.com';
                    
                    const userKey = data.user.apikey || '';
                    document.getElementById('userApiKey').innerText = userKey || 'No Key Found';
                                            
                    setRoleTheme(data.user.role || 'Free User');

                    fetchUserActivityLogs();
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

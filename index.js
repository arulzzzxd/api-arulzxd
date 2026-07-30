const express = require('express');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const mime = require('mime-types');
const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const compression = require('compression');
const os = require('os');

// === TAMBAHAN IMPORT DEPENDENSI YANG KURANG ===
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(cookieParser());
app.set('trust proxy', 1);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arulz-xd-owner:Haqqi0213@cluster0.fgxhxqm.mongodb.net/?appName=Cluster0'; 

mongoose.connect(MONGODB_URI)
    .then(() => console.log('📦 Berhasil terhubung ke MongoDB!'))
    .catch(err => console.error('❌ Gagal koneksi ke MongoDB:', err));

const PAYWUZ_API_KEY = process.env.PAYWUZ_API_KEY || "pk_live_f1429e9285d76999cc3f8bb6c3df552f";
const PAYWUZ_BASE_URL = "https://api.paywuz.id/v1";
const PAYWUZ_HEADERS = {
    "Authorization": `Bearer ${PAYWUZ_API_KEY}`,
    "Content-Type": "application/json"
};

function scheduleTransactionDeletion(orderId) {
    setTimeout(async () => {
        try {
            await Transaction.deleteOne({ orderId });
            console.log(`🗑️ Transaksi ${orderId} berhasil dihapus dari database (1 menit setelah selesai/batal).`);
        } catch (err) {
            console.error(`❌ Gagal menghapus transaksi ${orderId}:`, err.message);
        }
    }, 60 * 1000);
}

mongoose.connection.once('open', async () => {
    try {
        await mongoose.connection.db.collection('transactions').dropIndex('transactionId_1');
        console.log('🧹 Berhasil menghapus index lama transactionId_1');
    } catch (e) {
        // Abaikan jika index sudah tidak ada
    }
});

const transactionSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    paymentNumber: { type: String, default: null }, // QRIS String / URL
    paymentMethod: { type: String, default: "QRIS" },
    status: { type: String, default: "UNPAID" }, // UNPAID, PAID, SETTLED, EXPIRED, CANCELLED
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
    expiredAt: { type: Date, required: true }, // Batas Waktu 15 Menit
    updatedAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

function verifyPaywuzSignature(payload, receivedSignature, secretKey) {
    if (!receivedSignature) return false;
    try {
        const computedSignature = crypto
            .createHmac('sha256', secretKey)
            .update(JSON.stringify(payload))
            .digest('hex');
        return crypto.timingSafeEqual(
            Buffer.from(computedSignature), 
            Buffer.from(receivedSignature)
        );
    } catch (err) {
        return false;
    }
}

app.post('/transactions', async (req, res) => {
    try {
        const { orderId, amount, itemDetails } = req.body;

        if (!orderId || !amount) {
            return res.status(400).json({ status: false, message: "orderId dan amount wajib diisi!" });
        }

        // Tembak API PayWuz untuk Generate QRIS
        const paywuzRes = await axios.post(`${PAYWUZ_BASE_URL}/transactions`, {
            orderId,
            amount,
            paymentMethod: "QRIS"
        }, { headers: PAYWUZ_HEADERS });

        const transactionData = paywuzRes.data?.data || paywuzRes.data;
        const qrisNumber = transactionData.paymentNumber || transactionData.qrString || transactionData.qrUrl;

        // AMBIL TOTAL NOMINAL + FEE DARI PAYWUZ (Fallback ke grossAmount / totalAmount / total)
        const finalAmountWithFee = Number(
            transactionData.grossAmount || 
            transactionData.totalAmount || 
            transactionData.total || 
            (transactionData.fee ? Number(amount) + Number(transactionData.fee) : amount)
        );

        // Cari link dari itemDetails atau fallback ke produk.json
        let pLink = itemDetails?.link || null;
        if (!pLink && itemDetails?.nama) {
            const pathProduk = path.join(__dirname, 'database', 'produk.json');
            if (fs.existsSync(pathProduk)) {
                const products = JSON.parse(fs.readFileSync(pathProduk, 'utf8'));
                const matchedProduct = products.find(p => p.nama === itemDetails.nama);
                if (matchedProduct) pLink = matchedProduct.link || null;
            }
        }

        // Set Batas Waktu 15 Menit dari sekarang
        const expiredAt = new Date(Date.now() + 15 * 60 * 1000);

        // Simpan Transaksi ke MongoDB dengan nominal final (+fee)
        const newTransaction = new Transaction({
            orderId,
            amount: finalAmountWithFee, // Simpan amount beserta fee
            paymentNumber: qrisNumber,
            paymentMethod: "QRIS",
            status: transactionData.status || "UNPAID",
            itemDetails: itemDetails || null,
            productLink: pLink,
            expiredAt: expiredAt
        });

        await newTransaction.save();

        res.json({
            status: true,
            message: "Transaksi QRIS berhasil dibuat",
            data: newTransaction
        });
    } catch (error) {
        console.error("Error Create TRX:", error.response?.data || error.message);
        res.status(500).json({
            status: false,
            message: "Gagal membuat transaksi QRIS",
            error: error.response?.data || error.message
        });
    }
});


// 2. Cek Status Transaksi (/transactions/:orderId)
app.get('/transactions/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        let localTrx = await Transaction.findOne({ orderId });

        if (!localTrx) {
            return res.status(404).json({ status: false, message: "Transaksi tidak ditemukan" });
        }

        // Cek jika waktu sekarang melebihi expiredAt dan status masih UNPAID
        if (localTrx.status === "UNPAID" && new Date() > new Date(localTrx.expiredAt)) {
            localTrx.status = "EXPIRED";
            localTrx.updatedAt = new Date();
            await localTrx.save();
            scheduleTransactionDeletion(orderId);

            return res.json({
                status: true,
                data: {
                    orderId: localTrx.orderId,
                    status: "EXPIRED",
                    amount: localTrx.amount,
                    paymentNumber: localTrx.paymentNumber,
                    expiredAt: localTrx.expiredAt
                }
            });
        }

        const paywuzRes = await axios.get(`${PAYWUZ_BASE_URL}/transactions/${orderId}`, {
            headers: PAYWUZ_HEADERS
        });

        const statusData = paywuzRes.data?.data || paywuzRes.data;
        const currentStatus = statusData.status;

        const previousStatus = localTrx.status;
        localTrx.status = currentStatus;
        localTrx.updatedAt = new Date();

        if ((currentStatus === "PAID" || currentStatus === "SETTLED" || currentStatus === "SUCCESS") && !localTrx.productLink) {
            const pathProduk = path.join(__dirname, 'database', 'produk.json');
            if (fs.existsSync(pathProduk)) {
                const products = JSON.parse(fs.readFileSync(pathProduk, 'utf8'));
                const matchedProduct = products.find(p => p.nama === localTrx.itemDetails?.nama);
                if (matchedProduct && matchedProduct.link) {
                    localTrx.productLink = matchedProduct.link;
                }
            }
        }

        await localTrx.save();

        const isDone = ["PAID", "SETTLED", "SUCCESS", "CANCELLED", "EXPIRED"].includes(currentStatus.toUpperCase());
        if (isDone && previousStatus !== currentStatus) {
            scheduleTransactionDeletion(orderId);
        }

        res.json({
            status: true,
            data: {
                orderId: statusData.orderId || orderId,
                status: currentStatus,
                amount: statusData.amount || localTrx?.amount,
                paymentNumber: statusData.paymentNumber || localTrx?.paymentNumber,
                expiredAt: localTrx.expiredAt,
                productLink: (currentStatus === "PAID" || currentStatus === "SETTLED" || currentStatus === "SUCCESS") ? localTrx?.productLink : null
            }
        });
    } catch (error) {
        console.error("Error Status TRX:", error.response?.data || error.message);
        const localTrx = await Transaction.findOne({ orderId: req.params.orderId });
        if (localTrx) {
            return res.json({ status: true, data: localTrx });
        }
        res.status(500).json({ status: false, message: "Gagal mengambil status transaksi" });
    }
});

// 3. Batalkan Transaksi (/transactions/:orderId/cancel)
app.post('/transactions/:orderId/cancel', async (req, res) => {
    try {
        const { orderId } = req.params;

        const cancelRes = await axios.post(`${PAYWUZ_BASE_URL}/transactions/${orderId}/cancel`, {}, {
            headers: PAYWUZ_HEADERS
        });

        // Update status di MongoDB menjadi CANCELLED
        await Transaction.findOneAndUpdate(
            { orderId },
            { status: "CANCELLED", updatedAt: new Date() }
        );

        // Hapus dari DB setelah 1 menit
        scheduleTransactionDeletion(orderId);

        res.json({
            status: true,
            message: "Transaksi berhasil dibatalkan",
            data: cancelRes.data?.data || cancelRes.data
        });
    } catch (error) {
        console.error("Error Cancel TRX:", error.response?.data || error.message);
        res.status(500).json({
            status: false,
            message: "Gagal membatalkan transaksi",
            error: error.response?.data || error.message
        });
    }
});

// 4. Webhook Callback Handler PayWuz (/webhook)
app.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-paywuz-signature'];
        
        const isValid = verifyPaywuzSignature(req.body, signature, PAYWUZ_API_KEY);
        if (!isValid && process.env.NODE_ENV === 'production') {
            return res.status(401).json({ status: false, message: "Signature tidak valid!" });
        }

        const { orderId, status } = req.body;

        if (orderId && status) {
            await Transaction.findOneAndUpdate(
                { orderId },
                { status: status, updatedAt: new Date() }
            );

            // Hapus dari DB setelah 1 menit jika transaksi selesai/batal/expired
            if (["PAID", "SETTLED", "SUCCESS", "CANCELLED", "EXPIRED"].includes(status.toUpperCase())) {
                scheduleTransactionDeletion(orderId);
            }
        }

        res.json({ status: true, message: "Webhook berhasil diproses" });
    } catch (err) {
        console.error("Webhook Error:", err);
        res.status(500).json({ status: false, message: "Error memproses webhook" });
    }
});

app.use(compression()); 
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'arulzxd_secret_session_key_99', 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } 
}));

app.use(passport.initialize());
app.use(passport.session());

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, default: null }, // Null jika terdaftar via OAuth (Google/GitHub)
    provider: { type: String, default: 'local' }, // 'local', 'github', atau 'google'
    providerId: { type: String, default: null },   // ID unik dari GitHub / Google
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    apikey: { type: String, required: true, unique: true },
    role: { type: String, default: 'Free User' },
    avatar: { type: String, default: 'https://arulz-xd.my.id/files/X1F0Cn.png' }, 
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

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
                    background: #111827 !important; /* Ganti rgba semi-transparent menjadi warna solid (menghindari render overhead) */
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3) !important; /* Mengurangi ukuran blur bayangan */
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
            return sendSweetAlert(res, 'success', 'Berhasil!', 'Pendaftaran berhasil! Selamat datang.', '/doc?showProfile=true');
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
        return res.redirect('/doc?showProfile=true'); 
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
        // 1. Tukarkan code dengan access token
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code: code
        }, { headers: { accept: 'application/json' } });

        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) return res.send('Authentication failed: Invalid access token');

        // 2. Ambil data profile user
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `token ${accessToken}` }
        });

        const userData = userResponse.data;
        let userEmail = userData.email;

        // 3. Jika email null, ambil dari endpoint /user/emails
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

        // 4. Cari atau Buat User Baru di MongoDB
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

            // SIMPAN USER BARU KE MONGODB TANPA PASSWORD
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
            // Update Avatar jika berubah
            if (userData.avatar_url && dbUser.avatar !== userData.avatar_url) {
                dbUser.avatar = userData.avatar_url;
                await dbUser.save();
            }
        }

        // 5. Satukan payload menggunakan MongoDB Document ID
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

        res.redirect('/doc?showProfile=true');
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

        // 1. Cari atau Buat User Baru di MongoDB
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

            // SIMPAN USER BARU KE MONGODB TANPA PASSWORD
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
            // Update Avatar jika berubah
            if (userData.picture && dbUser.avatar !== userData.picture) {
                dbUser.avatar = userData.picture;
                await dbUser.save();
            }
        }

        // 2. Buat JWT Payload menggunakan data dari MongoDB
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

        res.redirect('/doc?showProfile=true');
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
        res.redirect('/');
    });
});

const listNotifikasi = require('./database/notifikasi');
const playlist = require('./database/playlist');
const PREMIUM_USERS = require('./database/PREMIUM_USERS');
const VIP_USERS = require('./database/VIP_USERS');

const localFileUploader = fileUpload({
    createParentPath: true,
    limits: { fileSize: 100 * 1024 * 1024 }, 
});

const title = "API-ARULZXD - REST";
const favicon = "https://arulz-xd.my.id/files/X1F0Cn.png";
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

    // Fallback otomatis ke user yang sedang terautentikasi session web dashboard
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

    // Blokir langsung jika limit sudah terlampaui / habis
    if (keyType !== 'vip' && USER_LIMIT_TRACKER[userKey] >= maxLimit) {
        return res.status(429).json({
            status: false,
            creator: "ArulzXD",
            message: getLimitMessage(keyType, maxLimit)
        });
    }

    // Tambah counter jika limit belum habis
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

        // Mapping Tipe Laporan
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

        // ==========================================
        // 1. EMAIL NOTIFIKASI UNTUK ADMIN
        // ==========================================
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

        // ==========================================
        // 2. EMAIL BALASAN OTOMATIS UNTUK PENGGUNA (USER)
        // ==========================================
        const userMailOptions = {
            from: '"Support ArulzXD" <supportarulzxd@gmail.com>', 
            to: email, 
            subject: `[Received] Terima Kasih atas Feedback Anda - API-ARULZXD`,
            html: `
            <div style="background-color: #030712; padding: 40px 15px; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f3f4f6;">
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #0b0f17; border-radius: 20px; border: 1px solid rgba(6, 182, 212, 0.3); box-shadow: 0 0 35px rgba(6, 182, 212, 0.15); overflow: hidden;">
                    
                    <!-- Cyber Banner Header -->
                    <tr>
                        <td style="padding: 30px 30px 20px 30px; text-align: center; background: linear-gradient(180deg, rgba(6, 182, 212, 0.12) 0%, transparent 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.025em; color: #ffffff;">
                                ARULZ<span style="color: #22d3ee; text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);">XD</span> <span style="font-size: 14px; font-family: monospace; color: #64748b; font-weight: 400;">API</span>
                            </h1>
                        </td>
                    </tr>

                    <!-- Content Area -->
                    <tr>
                        <td style="padding: 30px;">
                            
                            <!-- Status Confirmation Badge -->
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

                            <!-- Ringkasan Pesan yang Dikirim User -->
                            <div style="background-color: #020617; border: 1px solid rgba(6, 182, 212, 0.15); border-radius: 14px; padding: 20px; margin-bottom: 25px;">
                                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 10px; margin-bottom: 12px; font-size: 12px;">
                                    <span style="color: #64748b; font-family: monospace;">TIPE TRANSMISI:</span>
                                    <span style="color: ${categoryColor}; font-weight: 700; font-family: monospace;">${kategoriTeks.toUpperCase()}</span>
                                </div>
                                <div style="font-size: 10px; font-family: monospace; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">// SALINAN_PESAN_ANDA</div>
                                <p style="margin: 0; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 13px; color: #cbd5e1; white-space: pre-wrap; line-height: 1.6;">${message}</p>
                            </div>

                            <!-- Info Estimasi Respons -->
                            <div style="background-color: rgba(6, 182, 212, 0.05); border-left: 3px solid #06b6d4; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 30px;">
                                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                                    📌 <strong style="color: #ffffff;">Catatan:</strong> Tim kami biasanya memproses dan membalas masukan dalam kurun waktu <span style="color: #22d3ee;">1x24 jam</span>. Pengguna paket Premium/VIP akan diprioritaskan.
                                </p>
                            </div>

                            <!-- Quick Action Buttons -->
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

                    <!-- Cyber Footer -->
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

        // Kirim email ke admin & email balasan ke pengguna sekaligus
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

    // OPTIMASI FRONTEND: Menghapus backdrop-filter blur, radial-gradient, animasi checkmark draw, 
    // dan scaleIn yang berlebihan untuk menjaga kenyamanan device berspesifikasi rendah.
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
      let params = { apikey: "" }; 

      if (layer.route.stack && layer.route.stack.length) {
        layer.route.stack.forEach(mw => {
          if (!mw.handle) return;
          const fnString = mw.handle.toString();

          [...fnString.matchAll(/req\.query\.([a-zA-Z0-9_]+)/g)].forEach(match => {
            if (match[1] !== 'apikey') {
              if (route.paramsConfig && route.paramsConfig[match[1]]) {
                params[match[1]] = route.paramsConfig[match[1]];
              } else {
                params[match[1]] = "";
              }
            }
          });

          [...fnString.matchAll(/req\.body\.([a-zA-Z0-9_]+)/g)].forEach(match => {
            if (match[1] !== 'apikey') params[match[1]] = "";
          });

          [...fnString.matchAll(/req\.files\.([a-zA-Z0-9_]+)/g)].forEach(match => {
             if (match[1] !== 'apikey') params[match[1]] = "";
          });

          [...fnString.matchAll(/req\.file\.([a-zA-Z0-9_]+)/g)].forEach(match => {
             if (match[1] !== 'apikey') params[match[1]] = "";
          });
        });
      }

      if (methods.includes("POST") && Object.keys(params).length <= 1) {
        params.file = "file";
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
  res.sendFile(path.join(__dirname, 'public', 'styles.css'));
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
    // Sesuaikan path ke file produk.json Anda
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

app.get('/doc', (req, res) => {
    const notifHtmlItems = listNotifikasi.map((notif) => `
        <div class="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-cyan-500/30 transition-all duration-200">
            <div class="flex justify-between items-start mb-1">
                <h4 class="font-semibold text-xs text-cyan-400">${notif.judul}</h4>
                <span class="text-[9px] text-slate-500 font-mono">${notif.waktu}</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">${notif.deskripsi}</p>
        </div>
    `).join('');

    let authButtonHtml = '';
    let displayApiKey = 'Silakan Login';

    if (req.user) {
        displayApiKey = req.user.apiKey;

        authButtonHtml = `
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
`;
    } else {
        authButtonHtml = `
        <div class="mb-3 flex flex-col gap-2">
            <a href="/login" class="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-wider transition-all duration-200">
                <span>Masuk ke Akun</span>
            </a>
        </div>`;
    }

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
    /* 3D CHROME STYLE BADGES */
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
    </style>
</head>
<body class="min-h-screen antialiased bg-[#020617] text-slate-100 relative">
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
                apikey : <span class="font-mono text-cyan-400 select-all">${displayApiKey}</span>
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
            <!-- User Profile Pop-up Modal -->
    <div id="profilePopup" class="fixed inset-0 z-[99999] hidden">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" onclick="closeProfilePopup()"></div>
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <div class="w-full max-w-sm bg-slate-900/95 border border-white/10 rounded-2xl p-6 shadow-2xl relative font-['Space_Grotesk'] overflow-hidden">
            
            <!-- Glow Aesthetic Decor -->
            <div class="absolute -top-10 -left-10 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div class="flex flex-col items-center text-center mt-2 relative z-10">
                <!-- Avatar Section -->
                <div class="relative w-32 h-32 flex items-center justify-center mb-3">
                    <!-- Badge Rank / Role -->
                    <div id="avatarBadge" class="absolute -top-5 z-20 transform scale-90"></div>
                    
                    <!-- 3D Border & Main Avatar Core -->
                    <div id="avatar3DBorder" class="w-24 h-24 rounded-full p-[4px] z-10 flex items-center justify-center transition-all duration-300">
                        <div class="w-full h-full rounded-full bg-slate-950 p-[2px] flex items-center justify-center shadow-inner">
                            <img id="userAvatar" src="https://via.placeholder.com/150" alt="Avatar" class="w-full h-full rounded-full object-cover">
                        </div>
                    </div>
                </div>

                <!-- User Meta Information -->
                <h2 id="userName" class="text-xl font-extrabold text-white tracking-wide mb-0.5">Loading...</h2>
                <p id="userEmail" class="text-slate-400 font-mono text-xs mb-5">loading-email@mail.com</p>
                
                <!-- Detail Info Container -->
                <div class="w-full space-y-4 text-left mb-5">
                    <!-- Role Card -->
                    <div class="bg-slate-950/40 border border-white/5 rounded-xl p-3.5 flex flex-col gap-1">
                        <span class="text-[10px] text-cyan-400 font-mono tracking-wider uppercase font-bold opacity-80">Account Type / Role</span>
                        <div id="userRoleContainer" class="flex items-center gap-2 font-bold text-slate-200 text-sm">
                            <span id="userRole" class="flex items-center gap-1.5">Loading...</span>
                        </div>
                    </div>

                    <!-- API Key Card -->
                    <div class="bg-slate-950/40 border border-white/5 rounded-xl p-3.5 flex flex-col gap-2">
                        <!-- Warning/Notice Animasi Kedip -->
                        <div class="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium tracking-wide animate-pulse bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
                            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 block"></span>
                            Jangan bagikan API Key ini kepada siapapun!
                        </div>
                        
                        <div class="flex items-center justify-between mt-1">
                            <span class="text-[10px] text-cyan-400 font-mono tracking-wider uppercase font-bold opacity-80">Your Personal API Key</span>
                            <!-- Tombol Copy Diperbesar -->
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

                <!-- Action & Navigation Buttons -->
                <div class="w-full flex flex-col gap-3">
                    <!-- Tombol Upgrade Premium (Diatas Tutup & Logout) -->
                    <a href="/upgrade-apikey" class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 text-xs font-black py-3 px-4 rounded-xl transition duration-200 tracking-wider uppercase shadow-lg shadow-amber-500/10">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                        Upgrade
                    </a>
                    
                    <!-- Bottom Control Buttons -->
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

    <!-- Notification Center -->
    <div id="notifPopup" class="fixed inset-0 z-[99999] hidden">
        <div id="notifOverlay" class="fixed inset-0 bg-black/85 backdrop-blur-xs"></div>
        <div class="fixed inset-0 flex items-center justify-center p-4">
            <div class="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 font-['Space_Grotesk'] text-slate-100 relative max-h-[85vh] flex flex-col">
                
                <button id="closeNotifBtn" class="absolute top-4 right-4 text-slate-400 hover:text-red-400 transition-colors bg-white/5 hover:bg-white/10 rounded-full p-1.5 focus:outline-none">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
                
                <div class="mb-4">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                        </svg>
                        Pusat Pemberitahuan
                    </h3>
                    <p class="text-xs text-slate-400">Informasi update fitur dan sistem berkala</p>
                </div>
                
                <div class="space-y-3 overflow-y-auto pr-1 flex-1 custom-scrollbar" style="content-visibility: auto;">
                    ${notifHtmlItems}
                </div>
            </div>
        </div>
    </div>

<!-- Ganti template lama Anda dengan container kosong ini -->
<div id="toast" class="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none items-end"></div>

    <!-- Header Actions -->
    <div class="fixed top-6 right-6 z-40 flex items-center gap-3">
        <button id="notifMenuBtn" class="relative flex items-center justify-center w-10 h-10 rounded-xl glass-panel text-slate-300 hover:text-white shadow-lg transition-all active:scale-95 focus:outline-none light-mode:text-slate-700 light-mode:hover:text-slate-900 border border-white/5">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <span id="notifBadge" class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-md border border-slate-950">•</span>
        </button>

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

        ${authButtonHtml}

        <div class="mb-5 p-3.5 bg-cyan-950/20 border border-cyan-500/20 rounded-xl light-mode:bg-cyan-50/50 light-mode:border-cyan-200">
            <span class="text-[9px] font-bold text-cyan-400 light-mode:text-cyan-700 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Current API Key
            </span>
            <div class="flex items-center justify-between bg-black/40 rounded-lg px-2.5 py-2 font-mono text-xs text-slate-200 border border-white/5 light-mode:bg-white light-mode:text-slate-800 light-mode:border-slate-200">
                <span onclick="copyText('${displayApiKey}', 'API Key')" class="select-all cursor-pointer hover:text-cyan-400 transition-colors truncate mr-1" title="Click to copy API Key">${displayApiKey}</span>
                
                <button onclick="copyText('${displayApiKey}', 'API Key')" class="p-1 text-slate-400 hover:text-cyan-400 transition-colors" title="Copy API Key">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                </button>
            </div>
        </div>

        <nav class="flex flex-col gap-3.5 text-xs font-semibold tracking-wider uppercase text-slate-300 light-mode:text-slate-700 flex-1 py-1">
            <a href="/" class="menu-link hover:text-cyan-400 transition-colors flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
                <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>
                HOME
            </a>
            <a href="/doc" class="menu-link hover:text-cyan-400 transition-colors flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
                <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                DOCUMENTATION
            </a>

            <button id="uploaderMenuBtn" class="menu-link hover:text-cyan-400 transition-colors flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 text-left w-full focus:outline-none">
                <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                File Upload
            </button>
            
            <a href="/pastecode" class="menu-link hover:text-cyan-400 transition-colors flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
                <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                PASTECODE
            </a>
            <a href="/store" class="menu-link hover:text-cyan-400 transition-colors flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5">
    <svg class="w-5 h-5 text-cyan-400 text-center" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
    STORE
</a>

            <hr class="border-white/5 my-1 light-mode:border-slate-200">
            
            <a href="/feedback" class="menu-link hover:text-cyan-400 transition-colors flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 lowercase">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Feedback
            </a>
            
            <a href="/privacy" class="menu-link hover:text-cyan-400 transition-colors flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
                <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                PRIVACY
            </a>

            <a href="/support" class="menu-link hover:text-cyan-400 transition-colors flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
                <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
                SUPPORT
            </a>
            <a href="https://t.me/arulzzxd" target="_blank" class="menu-link hover:text-cyan-400 transition-colors flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 text-[10px] opacity-80 normal-case">
                <svg class="w-5 h-5 text-cyan-400 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.58.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.51-.46-.01-1.33-.26-1.99-.48-.8-.26-1.43-.41-1.38-.86.03-.24.35-.48.97-.73 3.8-1.65 6.34-2.74 7.61-3.25 3.61-1.47 4.36-1.73 4.85-1.74.11 0 .35.03.5.16.13.12.17.27.18.38-.01.12.01.27 0 .42z"/>
                </svg>
                Owner (Telegram)
            </a>
        </nav>
    </div>

    <div id="menuOverlay" class="fixed inset-0 bg-black/60 backdrop-blur-xs hidden z-30 transition-opacity duration-300"></div>

    <!-- Main Container -->
    <div class="max-w-5xl mx-auto px-4 py-8 relative z-10">
        <header id="api" class="mb-10 text-center">
            <div class="flex items-center justify-center gap-3 mb-3">
                <span class="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 light-mode:bg-cyan-100 light-mode:text-cyan-700">
                    <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span> ONLINE
                </span>
            </div>
            
            <div id="mainTitle" class="flex justify-center mb-3 min-h-[50px] items-center text-4xl md:text-5xl font-extrabold tracking-tight text-white">${headertitle}</div>
            <p id="mainDescription" class="text-sm md:text-base font-normal tracking-wide text-slate-400 max-w-xl mx-auto leading-relaxed">${headerdescription}</p>
            
            <!-- Statistics Grid -->
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

            <!-- Host URL & Request Feature -->
            <div class="glass-panel max-w-4xl mx-auto mt-4 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-cyan-500/10">
                <div class="flex items-center gap-2 text-xs md:text-sm text-cyan-400 light-mode:text-cyan-700 font-mono">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span class="underline break-all font-semibold">https://arulz-xd.my.id/</span>
                </div>
                <a href="https://wa.me/6285122629940?text=Halo%20Arulz,%20saya%20ingin%20request%20fitur%20baru%20di%20REST%20API%20:" 
                   target="_blank" 
                   class="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-bold text-[11px] uppercase rounded-lg shadow-md transition-all active:scale-95 light-mode:text-white text-center flex items-center justify-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Request Feature
                </a>
            </div>

            <!-- Social Links -->
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

            <!-- Music Player -->
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

        <!-- Search Bar and Filter Section -->
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

        <!-- No Results -->
        <div id="noResults" class="text-center py-12 hidden">
            <div class="flex justify-center mb-3">
                <svg class="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h3 id="no-results-title" class="text-sm font-bold mb-1 text-white">Endpoint tidak ditemukan</h3>
            <p id="no-results-desc" class="text-xs text-slate-400 light-mode:text-slate-500">Coba gunakan kata kunci lain</p>
        </div>

        <!-- API List -->
        <div id="apiList" class="space-y-4 max-w-4xl mx-auto"></div>

        <!-- Footer -->
        <footer id="siteFooter" class="mt-16 pt-6 border-t border-white/5 text-center text-[11px] text-slate-500">
            ${footer}
        </footer>
    </div>

    <!-- Image Lightbox -->
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
    const displayApiKey = "${displayApiKey}";
</script>
<script src="script.js"></script>

<script>
function openProfilePopup() {
            document.getElementById('profilePopup').classList.remove('hidden');
            fetchUserProfile();
        }

        function closeProfilePopup() {
            document.getElementById('profilePopup').classList.add('hidden');
        }

        function setRoleTheme(roleName) {
            const roleContainer = document.getElementById('userRoleContainer');
            const avatar3DBorder = document.getElementById('avatar3DBorder');
            const avatarBadge = document.getElementById('avatarBadge');
            const usernameTag = document.getElementById('userEmail');
            const normalizedRole = roleName.toLowerCase();

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
                        document.getElementById('userAvatar').src = data.user.avatar;
                        document.getElementById('userName').innerText = data.user.name;
                        document.getElementById('userEmail').innerText = data.user.email;
                        document.getElementById('userApiKey').innerText = data.user.apiKey;
                        setRoleTheme(data.user.role);
                    }
                })
                .catch(() => {
                    setRoleTheme("free"); 
                });
        }
document.addEventListener('DOMContentLoaded', () => {
    const popup = document.getElementById('welcomePopup');
    const closeBtn = document.getElementById('closePopupBtn');
    
    popup.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    
    closeBtn.addEventListener('click', () => {
        popup.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    });
});
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
const BASE_URL = window.location.origin;
let isRequestInProgress = false;
let apiData = null;
let currentTheme = 'dark';
let currentLang = 'id';
let allApiElements = [];
let totalEndpoints = 0;
let totalCategories = 0;
let activeCategory = 'all';


const themeToggleBtn = document.getElementById('themeToggle');
const body = document.body;
const themeBg = document.getElementById('themeBg');

const categoryIcons = {
    'ai': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 1 1 12 2zm-2 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm4 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>',
    'download': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm9 4H3v-2h18v2z"/></svg>',
    'search': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
    'image': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
    'tools': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.1L9 6 6 9 1.8 4.7C.5 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
    'maker': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
    'stalker': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    'canvas': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>',
    'security': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>',
    'news': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 16H5V5h14v14zm-9-2h8v-2h-8v2zm0-4h8v-2h-8v2zm0-4h8V7h-8v2zm-4 8h2v-8H6v8z"/></svg>',
    'random': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>',
    'islam': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>',
    'game': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M7 8h10a4 4 0 0 1 4 4v4a3 3 0 0 1-5.12 2.12L13.76 16H10.24l-2.12 2.12A3 3 0 0 1 3 16v-4a4 4 0 0 1 4-4zm0 3v2H5v2h2v2h2v-2h2v-2H9v-2H7zm9 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm3 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
    'quotes': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M7 17H3V9h6v6c0 1.1-.9 2-2 2zm10 0h-4V9h6v6c0 1.1-.9 2-2 2z"/></svg>',
    'sticker': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M5 3h10l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm9 1v4h4M8 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-4 5c2.2 0 4-1.3 4-3H8c0 1.7 1.8 3 4 3z"/></svg>',
    'default': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-cyan-400"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>'
};

const i18n = {
    id: {
        searchPlaceholder: "Cari endpoint berdasarkan nama, path, atau kategori...",
        noResultsTitle: "Endpoint tidak ditemukan",
        noResultsDesc: "Coba gunakan kata kunci lain",
        endpointsTitle: "Total Endpoint",
        categoriesTitle: "Total Kategori",
        endpointsCount: "endpoints",
        btnExecute: "Eksekusi",
        btnClear: "Bersihkan",
        toastMediaCopy: "Media URL disalin ke papan klip!",
        toastMediaFail: "Gagal menyalin URL",
        endpointNotAvailable: "⚠️ Endpoint ini tidak tersedia untuk pengujian",
        toastRequestWait: "Harap tunggu permintaan saat ini selesai",
        toastRequestSuccess: "Permintaan berhasil diselesaikan!",
        toastRequestFailed: "Permintaan gagal!"
    },
    en: {
        searchPlaceholder: "Search endpoints by name, path, or category...",
        noResultsTitle: "No endpoints found",
        noResultsDesc: "Try a different search term",
        endpointsTitle: "Total Endpoints",
        categoriesTitle: "Total Categories",
        endpointsCount: "endpoints",
        btnExecute: "Execute",
        btnClear: "Clear",
        toastMediaCopy: "Media URL copied to clipboard!",
        toastMediaFail: "Failed to copy URL",
        endpointNotAvailable: "⚠️ This endpoint is not available for testing",
        toastRequestWait: "Please wait for current request",
        toastRequestSuccess: "Request completed successfully!",
        toastRequestFailed: "Request failed!"
    }
};

/* =========================================================================
   ADDITIONAL / MISSING CORE FUNCTIONS
   ========================================================================= */

// Fungsi Toggle Grup Kategori Utama
function toggleCategory(catIdx) {
    const catDiv = document.getElementById(`cat-${catIdx}`);
    const catIcon = document.getElementById(`cat-icon-${catIdx}`);
    if (catDiv && catIcon) {
        const isHidden = catDiv.classList.contains('hidden');
        if (isHidden) {
            catDiv.classList.remove('hidden');
            catIcon.style.transform = 'rotate(180deg)';
        } else {
            catDiv.classList.add('hidden');
            catIcon.style.transform = 'rotate(0deg)';
        }
    }
}

// SVG Icon Helper untuk Plus (+) & Minus (-)
const SVG_PLUS = `<svg class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`;
const SVG_MINUS = `<svg class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15"/></svg>`;

// Fungsi Toggle Detail Formulir Endpoint (+ / -)
function toggleEndpoint(catIdx, epIdx) {
    const epDiv = document.getElementById(`ep-${catIdx}-${epIdx}`);
    const epIcon = document.getElementById(`ep-icon-${catIdx}-${epIdx}`);
    if (epDiv && epIcon) {
        const isHidden = epDiv.classList.contains('hidden');
        if (isHidden) {
            epDiv.classList.remove('hidden');
            epIcon.innerHTML = SVG_MINUS;
        } else {
            epDiv.classList.add('hidden');
            epIcon.innerHTML = SVG_PLUS;
        }
    }
}


// Fungsi Menutup Sidebar Menu Bio & Overlay
function closeSidebarMenu() {
    const bioDropdown = document.getElementById('bioDropdown');
    const menuOverlay = document.getElementById('menuOverlay');
    if (bioDropdown && menuOverlay) {
        bioDropdown.style.transform = 'translateX(100%)';
        menuOverlay.classList.add('hidden');
    }
}

// Fungsi Generator Komponen Pratinjau Media Hasil Eksekusi
function createMediaPreview(url, contentType, fullPath) {
    const type = contentType || '';
    if (type.startsWith('image/') || url.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
        return `<div class="mt-2 flex justify-center bg-black/20 p-2 rounded-lg border border-white/5"><img src="${url}" class="media-image max-h-64 rounded-lg object-contain cursor-pointer transition-transform hover:scale-[1.02]" alt="Preview"></div>`;
    } else if (type.startsWith('video/') || url.match(/\.(mp4|webm|mov)/i)) {
        return `<div class="mt-2 bg-black/20 p-2 rounded-lg border border-white/5"><video src="${url}" controls class="w-full max-h-64 rounded-lg"></video></div>`;
    } else if (type.startsWith('audio/') || url.match(/\.(mp3|wav|ogg)/i)) {
        return `<div class="mt-2 bg-black/20 p-3 rounded-lg border border-white/5"><audio src="${url}" controls class="w-full"></audio></div>`;
    } else if (type.includes('application/pdf') || url.match(/\.pdf/i)) {
        return `<div class="mt-2 bg-black/20 p-2 rounded-lg border border-white/5"><iframe src="${url}" class="w-full h-64 rounded-lg border-0"></iframe></div>`;
    }
    return `<div class="mt-2 p-3 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs break-all border border-cyan-500/20">Media URL: <a href="${url}" target="_blank" class="underline hover:text-cyan-300">${url}</a></div>`;
}

/* =========================================================================
   THEME & APPLICATION FUNCTIONS
   ========================================================================= */

function updateThemeBackground(theme) {
    if (themeBg) {
        themeBg.className = "fixed inset-0 -z-50 transition-all duration-300";
        if (theme === 'light') {
            document.body.style.backgroundColor = "#ffffff";
            themeBg.style.backgroundColor = "#ffffff";
            themeBg.style.backgroundImage = "radial-gradient(#cbd5e1 1.5px, transparent 1.5px)";
            themeBg.style.backgroundSize = "24px 24px";
        } else {
            document.body.style.backgroundColor = "#030712";
            themeBg.style.backgroundColor = "#030712";
            themeBg.style.backgroundImage = "radial-gradient(rgba(255, 255, 255, 0.12) 1.5px, transparent 1.5px)";
            themeBg.style.backgroundSize = "24px 24px";
        }
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    currentTheme = savedTheme;

    const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
    const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

    if (savedTheme === 'light') {
        body.classList.add('light-mode');
        body.classList.remove('text-slate-100');
        body.classList.add('text-slate-900');
        themeToggleDarkIcon?.classList.add('hidden');
        themeToggleLightIcon?.classList.remove('hidden');
    } else {
        body.classList.remove('light-mode');
        body.classList.remove('text-slate-900');
        body.classList.add('text-slate-100');
        themeToggleDarkIcon?.classList.remove('hidden');
        themeToggleLightIcon?.classList.add('hidden');
    }
    updateThemeBackground(currentTheme);
    updateSocialBadges();
}

function toggleTheme() {
    const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
    const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

    if (body.classList.contains('light-mode')) {
        body.classList.remove('light-mode');
        body.classList.remove('text-slate-900');
        body.classList.add('text-slate-100');
        themeToggleDarkIcon?.classList.remove('hidden');
        themeToggleLightIcon?.classList.add('hidden');
        currentTheme = 'dark';
    } else {
        body.classList.add('light-mode');
        body.classList.remove('text-slate-100');
        body.classList.add('text-slate-900');
        themeToggleDarkIcon?.classList.add('hidden');
        themeToggleLightIcon?.classList.remove('hidden');
        currentTheme = 'light';
    }

    localStorage.setItem('theme', currentTheme);
    updateThemeBackground(currentTheme);
    updateSocialBadges();
    if (apiData) loadApis();
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);

    document.getElementById('lang-id').classList.toggle('active', lang === 'id');
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');

    document.getElementById('searchInput').placeholder = i18n[lang].searchPlaceholder;
    document.getElementById('no-results-title').textContent = i18n[lang].noResultsTitle;
    document.getElementById('no-results-desc').textContent = i18n[lang].noResultsDesc;
    document.getElementById('stat-endpoints-title').textContent = i18n[lang].endpointsTitle;
    document.getElementById('stat-categories-title').textContent = i18n[lang].categoriesTitle;

    const dateElement = document.getElementById('liveDate');
    if (dateElement && typeof moment !== 'undefined') {
        const now = moment().tz("Asia/Jakarta");
        const formatLang = lang === 'id' ? 'id' : 'en';
        dateElement.textContent = now.locale(formatLang).format('dddd, D MMMM YYYY');
    }

    if (apiData) loadApis();
}

function updateSocialBadges() {
    const isLightMode = body.classList.contains('light-mode');
    const socialBadges = document.querySelectorAll('.social-badge > div');

    socialBadges.forEach(badge => {
        if (isLightMode) {
            badge.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-colors text-center border bg-white/80 text-slate-900 hover:bg-slate-100 border-black/10 shadow-sm';
        } else {
            badge.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-colors text-center border bg-slate-900/40 text-slate-200 hover:bg-slate-800/60 border-white/10';
        }
    });
}

function initDigitalClock() {
    const clockElement = document.getElementById('liveClock');
    const dateElement = document.getElementById('liveDate');
    if (!clockElement || !dateElement) return;

    function updateClock() {
        if (typeof moment !== 'undefined') {
            const now = moment().tz("Asia/Jakarta");
            clockElement.textContent = now.format('HH:mm:ss');
            if (currentLang === 'id') dateElement.textContent = now.locale('id').format('dddd, D MMMM YYYY');
            else dateElement.textContent = now.locale('en').format('dddd, MMMM D, YYYY');
        }
    }
    updateClock();
    setInterval(updateClock, 1000);
}

function updateTotalEndpoints() { document.getElementById('totalEndpoints').textContent = totalEndpoints; }
function updateTotalCategories() { document.getElementById('totalCategories').textContent = totalCategories; }

function showToast(message, isError = false) {
    const container = document.getElementById('toast');
    if (!container) return;

    // 1. BUAT ELEMEN BOX TOAST SECARA DINAMIS (Bentuk Persegi Panjang Cyberpunk)
    const toast = document.createElement('div');

    // Base Class: Desain persegi panjang, backdrop blur, dan animasi performa tinggi
    toast.className = "flex items-center gap-3.5 px-5 py-3.5 rounded-xl border backdrop-blur-xl min-w-[300px] max-w-[420px] transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] opacity-0 translate-y-[-20px] scale-95 pointer-events-auto will-change-[transform,opacity] select-none";

    let iconHTML = '';
    let iconColor = '';

    // 2. ATUR WARNA NEON CYBERPUNK (Cyan untuk Sukses, Pink-Red untuk Error)
    if (isError) {
        iconHTML = '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>';
        iconColor = '#ff2a74'; // Neon Pink
        toast.classList.add('border-pink-500/50', 'bg-slate-950/90', 'shadow-[0_0_20px_rgba(255,42,116,0.15)]');
    } else {
        iconHTML = '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>';
        iconColor = '#00f0ff'; // Electric Cyan
        toast.classList.add('border-cyan-500/50', 'bg-slate-950/90', 'shadow-[0_0_20px_rgba(0,240,255,0.15)]');
    }

    // 3. STRUKTUR INTERNAL (Mirip komponen lama Anda tapi berbasis template string dinamis)
    toast.innerHTML = `
        <div class="flex-shrink-0 p-1.5 rounded-lg bg-white/5">
            <svg class="w-6 h-6 flex-shrink-0 transition-all duration-500 scale-100" viewBox="0 0 20 20" fill="currentColor" style="color: ${iconColor};">
                ${iconHTML}
            </svg>
        </div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-sans font-semibold tracking-wider leading-relaxed break-words text-slate-100 dark:text-slate-100 light-mode:text-slate-900 uppercase">
                ${message}
            </p>
        </div>
    `;

    // 4. MASUKKAN KE CONTAINER (Otomatis menumpuk ke bawah)
    container.appendChild(toast);

    // Memicu animasi muncul yang mulus
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-[-20px]', 'scale-95');
        toast.classList.add('opacity-100', 'translate-y-0', 'scale-100');
    });

    // 5. ANIMASI HILANG SATU PER SATU (Setiap toast punya timer 4 detik mandiri)
    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
        toast.classList.add('opacity-0', 'scale-90', 'translate-x-[20px]');

        // Hapus dari DOM setelah animasi transisi CSS selesai
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 4000);
}

function copyText(text, type = 'path') {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`${type} berhasil disalin ke papan klip!`);
    }).catch(() => {
        showToast('Gagal menyalin text', true);
    });
}

function copyFromElement(elementId, type) {
    const el = document.getElementById(elementId);
    if (el) copyText(el.innerText || el.textContent, type);
}

function updateLivePreview(catIdx, epIdx, method, basePath, endpointType) {
    const form = document.getElementById(`form-${catIdx}-${epIdx}`);
    if (!form) return;

    const formData = new FormData(form);

    // Cek apakah ada file yang dipilih
    let formHasFile = false;
    form.querySelectorAll('input[type="file"]').forEach(fileInput => {
        if (fileInput.files && fileInput.files.length > 0) {
            formHasFile = true;
        }
    });

    let finalMethod = method.toUpperCase();
    if (formHasFile) {
        finalMethod = 'POST';
    }

    const params = new URLSearchParams();
    if (finalMethod === 'GET' || finalMethod === 'DELETE') {
        for (const [key, value] of formData.entries()) {
            if (value && typeof value === 'string') {
                params.append(key, value);
            }
        }
    }

    const queryStr = params.toString();
    const finalUrl = queryStr ? `${BASE_URL}${basePath}?${queryStr}` : `${BASE_URL}${basePath}`;

    const urlContainer = document.getElementById(`live-url-${catIdx}-${epIdx}`);
    const curlContainer = document.getElementById(`live-curl-${catIdx}-${epIdx}`);

    if (urlContainer) urlContainer.textContent = finalUrl;

    if (curlContainer) {
        if (finalMethod === 'GET' || finalMethod === 'DELETE') {
            curlContainer.textContent = `curl -X ${finalMethod} "${finalUrl}"`;
        } else if (formHasFile) {
            // Tampilan cURL khusus upload multipart/form-data
            const bodyParams = [];
            for (const [key, value] of formData.entries()) {
                if (value instanceof File) {
                    const fileName = value.name ? value.name : 'file.bin';
                    bodyParams.push(`-F "${key}=@${fileName}"`);
                } else if (value) {
                    bodyParams.push(`-F "${key}=${value}"`);
                }
            }
            const dataString = bodyParams.length ? ` ${bodyParams.join(' ')}` : '';
            curlContainer.textContent = `curl -X POST "${finalUrl}"${dataString}`;
        } else {
            // Tampilan cURL JSON biasa
            const bodyParams = [];
            for (const [key, value] of formData.entries()) {
                if (value && typeof value === 'string') {
                    bodyParams.push(`"${key}": "${value}"`);
                }
            }
            const dataString = bodyParams.length ? ` -H "Content-Type: application/json" -d '{${bodyParams.join(', ')}}'` : '';
            curlContainer.textContent = `curl -X ${finalMethod} "${finalUrl}"${dataString}`;
        }
    }
}

async function executeRequest(e, catIdx, epIdx, method, path, endpointType) {
    e.preventDefault();
    if (isRequestInProgress) {
        showToast(i18n[currentLang].toastRequestWait, true);
        return;
    }

    const form = document.getElementById(`form-${catIdx}-${epIdx}`);
    const responseDiv = document.getElementById(`response-${catIdx}-${epIdx}`);
    const responseContent = document.getElementById(`response-content-${catIdx}-${epIdx}`);
    const executeBtn = form.querySelector('button[type="submit"]');

    let spinner = executeBtn.querySelector('.local-spinner');
    if (!spinner) {
        spinner = document.createElement('span');
        spinner.className = 'local-spinner ml-2';
        executeBtn.appendChild(spinner);
    }

    isRequestInProgress = true;
    executeBtn.disabled = true;
    executeBtn.classList.add('btn-loading');

    spinner.style.setProperty('display', 'none', 'important');
    spinner.classList.remove('active');

    responseDiv.classList.remove('hidden');

    // LOADING STATE: Menggunakan skeleton loader & pulse modern
    responseContent.innerHTML = `
        <div class="flex flex-col items-center justify-center p-12 text-sm font-mono tracking-wider text-cyan-400 gap-3">
            <div class="relative flex h-4 w-4">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-4 w-4 bg-cyan-500"></span>
            </div>
            <span class="animate-pulse text-xs uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-400 light-mode:text-slate-500">Fetching Response...</span>
        </div>
    `;

    const originalBtnHtml = executeBtn.innerHTML;

    executeBtn.innerHTML = `
        <div class="flex items-center justify-center gap-1">
            <span class="tracking-wide">LOADING</span>
            <span class="flex gap-0.5 ml-0.5">
                <span class="w-1 h-1 bg-current rounded-full animate-[bounce_1s_infinite_100ms]"></span>
                <span class="w-1 h-1 bg-current rounded-full animate-[bounce_1s_infinite_200ms]"></span>
                <span class="w-1 h-1 bg-current rounded-full animate-[bounce_1s_infinite_300ms]"></span>
            </span>
        </div>
    `;

    const rawFormData = new FormData(form);
    const queryParams = new URLSearchParams();

    let formHasFile = false;
    form.querySelectorAll('input[type="file"]').forEach(fileInput => {
        if (fileInput.files.length > 0) {
            formHasFile = true;
        }
    });

    let finalMethod = method.toUpperCase();
    if (formHasFile) {
        finalMethod = 'POST';
    }

    let fetchOptions = { method: finalMethod };
    let fullPath = `${BASE_URL}${path.split('?')[0]}`;
    let isMedia = false;

    try {
        if (finalMethod === 'GET' || finalMethod === 'DELETE') {
            for (const [key, value] of rawFormData.entries()) {
                if (value && typeof value === 'string') {
                    queryParams.append(key, value);
                }
            }
            const qStr = queryParams.toString();
            if (qStr) fullPath += '?' + qStr;
        } else {
            if (formHasFile) {
                fetchOptions.body = rawFormData;
            } else {
                fetchOptions.headers = { 'Content-Type': 'application/json' };
                const jsonBody = {};
                for (const [key, value] of rawFormData.entries()) {
                    if (value) jsonBody[key] = value;
                }
                fetchOptions.body = JSON.stringify(jsonBody);
            }
        }

        const startTime = performance.now();
        const response = await fetch(fullPath, fetchOptions);
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        // Handler Error Status (403 / 429 / 503)
        if (response.status === 403 || response.status === 429 || response.status === 503) {
            const data = await response.json().catch(() => ({ message: "Akses Ditolak" }));
            const rawErrText = JSON.stringify(data, null, 2);
            responseContent.innerHTML = `
                <div class="rounded-xl overflow-hidden border-2 border-red-500 bg-slate-950/50 backdrop-blur-md shadow-2xl">
                    <div class="flex items-center justify-between px-4 py-3 bg-red-950/20 border-b-2 border-red-500">
                        <span class="px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase border border-red-500 bg-red-500/10 text-red-400">
                            STATUS: ${response.status}
                        </span>
                        <button type="button" onclick="copyText(\`${rawErrText.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, 'Error Response')" class="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        </button>
                    </div>
                    <pre class="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-red-400 max-h-96 scrollbar-thin bg-black/20 shadow-inner"><code>${escapeHtml(rawErrText)}</code></pre>
                </div>
            `;
            showToast(data.message || "Akses Ditolak!", true);

            if (typeof fetchAndUpdateUserLimit === 'function') {
                fetchAndUpdateUserLimit();
            }
            return;
        }

        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const cleanContentType = contentType.split(';')[0].trim();
        const contentLength = response.headers.get("content-length");

        let sizeText = "0 B";
        let bytes = contentLength ? parseInt(contentLength, 10) : 0;
        let rawResponseText = "";
        let finalInnerContent = "";
        let mediaBlobObject = null;
        let hintText = ""; 

        function getMediaHint(urlOrMime) {
            const str = urlOrMime.toLowerCase();
            if (str.includes('image/') || str.match(/\.(jpeg|jpg|gif|png|webp)/i)) return "Klik gambar untuk memperbesar gambar";
            if (str.includes('audio/') || str.match(/\.(mp3|wav|ogg|mpeg)/i)) return "Gunakan pemutar audio di bawah";
            if (str.includes('video/') || str.match(/\.(mp4|webm|mov)/i)) return "Klik video untuk memutar full screen";
            if (str.includes('application/pdf') || str.match(/\.pdf/i)) return "Klik untuk membuka dokumen PDF";
            return "Berkas media terdeteksi";
        }

        if (cleanContentType.includes("application/json")) {
            const data = await response.json();
            rawResponseText = JSON.stringify(data, null, 2);

            if (!bytes) bytes = new Blob([rawResponseText]).size;

            let detectedMediaUrl = null;
            if (data.url && typeof data.url === 'string' && data.url.startsWith('http')) detectedMediaUrl = data.url;
            else if (data.result && data.result.url && typeof data.result.url === 'string') detectedMediaUrl = data.result.url;

            if (detectedMediaUrl && (detectedMediaUrl.match(/\.(jpeg|jpg|gif|png|webp|mp4|mp3|webm|mov|wav|ogg|pdf|docx|xlsx|zip|txt|js)/i))) {
                 hintText = getMediaHint(detectedMediaUrl);

                 let mediaMarkup = '';
                 const isAudioUrl = detectedMediaUrl.match(/\.(mp3|wav|ogg)/i);

                 if (isAudioUrl) {
                     mediaMarkup = `<audio controls class="w-full max-w-md mx-auto block" src="${detectedMediaUrl}">Browser tidak mendukung pemutar audio.</audio>`;
                 } else {
                     mediaMarkup = createMediaPreview(detectedMediaUrl, null, detectedMediaUrl);
                 }

                 finalInnerContent = `
                    <div class="p-4 border-b-2 border-white/20 dark:border-white/20 light-mode:border-slate-300 bg-black/20 flex justify-center items-center w-full max-w-full overflow-hidden" ${!isAudioUrl ? `onclick="if(typeof zoomMedia==='function') zoomMedia('${detectedMediaUrl}')"` : ''}>
                        <div class="w-full flex justify-center [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_video]:max-w-full">
                            ${mediaMarkup}
                        </div>
                    </div>
                    <div class="px-4 pt-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 light-mode:text-slate-500 uppercase tracking-widest font-mono">RAW JSON DATA</div>
                    <pre id="raw-text-${catIdx}-${epIdx}" class="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-cyan-400 dark:text-cyan-400 light-mode:text-cyan-600 max-h-80 scrollbar-thin bg-black/10 dark:bg-black/20 light-mode:bg-slate-50 shadow-inner"><code>${escapeHtml(rawResponseText)}</code></pre>
                 `;
                 isMedia = true;
            } else {
                 finalInnerContent = `<pre id="raw-text-${catIdx}-${epIdx}" class="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-cyan-400 dark:text-cyan-400 light-mode:text-cyan-600 max-h-96 scrollbar-thin bg-black/10 dark:bg-black/20 light-mode:bg-slate-50 shadow-inner"><code>${escapeHtml(rawResponseText)}</code></pre>`;
            }
        } else if (cleanContentType.startsWith("image/") || cleanContentType.startsWith("video/") || cleanContentType.startsWith("audio/") || cleanContentType.includes("application/pdf")) {
            isMedia = true;
            hintText = getMediaHint(cleanContentType);
            mediaBlobObject = await response.blob(); 
            if (!bytes) bytes = mediaBlobObject.size;
            const blobUrl = URL.createObjectURL(mediaBlobObject);

            if (cleanContentType.startsWith("audio/")) {
                finalInnerContent = `
                    <div class="p-6 bg-black/20 dark:bg-black/30 light-mode:bg-slate-50 shadow-inner flex justify-center items-center w-full max-w-full">
                        <audio controls class="w-full max-w-md mx-auto block" src="${blobUrl}">
                            Browser Anda tidak mendukung pemutar audio.
                        </audio>
                    </div>
                `;
            } else {
                finalInnerContent = `
                    <div class="p-6 bg-black/10 dark:bg-black/20 light-mode:bg-slate-50 shadow-inner flex justify-center items-center cursor-zoom-in w-full max-w-full overflow-hidden" onclick="if(typeof zoomMedia==='function') zoomMedia('${blobUrl}')">
                        <div class="w-full flex justify-center [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_video]:max-w-full">
                            ${createMediaPreview(blobUrl, cleanContentType, fullPath)}
                        </div>
                    </div>
                `;
            }
        } else {
            rawResponseText = await response.text();
            if (!bytes) bytes = new Blob([rawResponseText]).size;
            hintText = "Klik teks untuk memperbesar";
            finalInnerContent = `
                <div class="px-4 pt-3 text-[10px] font-bold text-slate-400 dark:text-slate-400 light-mode:text-slate-500 uppercase tracking-widest font-mono">RAW TEXT DATA</div>
                <pre id="raw-text-${catIdx}-${epIdx}" class="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-slate-300 dark:text-slate-300 light-mode:text-slate-700 max-h-96 scrollbar-thin bg-black/10 dark:bg-black/20 light-mode:bg-slate-50 shadow-inner cursor-zoom-in" onclick="if(typeof zoomText==='function'){zoomText(this.innerText)}else{showToast('Klik terdeteksi')}"><code>${escapeHtml(rawResponseText)}</code></pre>
            `;
        }

        if (bytes >= 1048576) sizeText = `${(bytes / 1048576).toFixed(1)} MB`;
        else if (bytes >= 1024) sizeText = `${(bytes / 1024).toFixed(1)} KB`;
        else sizeText = `${bytes} B`;

        const statusColor = response.ok 
            ? 'text-emerald-400 bg-emerald-500/10 border-2 border-emerald-500/50 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-2 dark:border-emerald-500/50 light-mode:text-emerald-700 light-mode:bg-emerald-500/5 light-mode:border-2 light-mode:border-emerald-500/60' 
            : 'text-red-400 bg-red-500/10 border-2 border-red-500/50 dark:text-red-400 dark:bg-red-500/10 dark:border-2 dark:border-red-500/50 light-mode:text-red-700 light-mode:bg-red-500/5 light-mode:border-2 light-mode:border-red-500/60';

        let downloadButtonHtml = `
            <button type="button" id="download-btn-${catIdx}-${epIdx}" class="px-3.5 py-2 bg-slate-900/80 dark:bg-slate-900/80 light-mode:bg-slate-200/80 hover:bg-slate-800 light-mode:hover:bg-slate-300 text-white light-mode:text-slate-800 rounded-lg text-xs font-semibold border-2 border-white/20 dark:border-2 dark:border-white/20 light-mode:border-2 light-mode:border-slate-300 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
                <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                <span>Download ${isMedia ? 'Media' : 'Response'}</span>
            </button>
        `;

        // RENDER CONTAINER UTAMA
        responseContent.innerHTML = `
            <div class="rounded-xl overflow-hidden border-2 border-cyan-500/40 dark:border-2 dark:border-cyan-500/40 light-mode:border-2 light-mode:border-slate-400 bg-slate-950/40 dark:bg-slate-950/40 light-mode:bg-white shadow-2xl transition-all duration-300">
                
                <div class="px-4 py-2.5 bg-black/60 dark:bg-black/60 light-mode:bg-slate-100 border-b-2 border-white/20 light-mode:border-slate-300 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                        <span class="text-xs font-bold tracking-wider font-mono text-slate-300 dark:text-slate-300 light-mode:text-slate-700 uppercase">Server Response</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-black/30 dark:bg-black/30 light-mode:bg-slate-50 border-b-2 border-white/20 light-mode:border-slate-300 text-center text-xs font-mono">
                    <div class="flex flex-col justify-center items-center p-2 rounded-lg border-2 border-white/10 light-mode:border-2 light-mode:border-slate-200 bg-black/10 dark:bg-black/10 light-mode:bg-white">
                        <span class="text-[10px] text-slate-500 uppercase font-semibold mb-1">Status</span>
                        <span class="px-2 py-0.5 rounded text-[11px] font-black ${statusColor}">${response.status}</span>
                    </div>
                    <div class="flex flex-col justify-center items-center p-2 rounded-lg border-2 border-white/10 light-mode:border-2 light-mode:border-slate-200 bg-black/10 dark:bg-black/10 light-mode:bg-white">
                        <span class="text-[10px] text-slate-500 uppercase font-semibold mb-1">Time</span>
                        <span class="text-[11px] text-amber-400 dark:text-amber-400 light-mode:text-amber-600 font-bold">${duration} ms</span>
                    </div>
                    <div class="flex flex-col justify-center items-center p-2 rounded-lg border-2 border-white/10 light-mode:border-2 light-mode:border-slate-200 bg-black/10 dark:bg-black/10 light-mode:bg-white">
                        <span class="text-[10px] text-slate-500 uppercase font-semibold mb-1">Size</span>
                        <span class="text-[11px] text-cyan-400 dark:text-cyan-400 light-mode:text-cyan-600 font-bold">${sizeText}</span>
                    </div>
                    <div class="flex flex-col justify-center items-center p-2 rounded-lg border-2 border-white/10 light-mode:border-2 light-mode:border-slate-200 bg-black/10 dark:bg-black/10 light-mode:bg-white col-span-2 sm:col-span-2 text-left px-3">
                        <span class="text-[10px] text-slate-500 uppercase font-semibold mb-1">Content Type</span>
                        <span class="text-[11px] text-slate-300 dark:text-slate-300 light-mode:text-slate-600 truncate max-w-full font-semibold" title="${cleanContentType}">${cleanContentType}</span>
                    </div>
                    
                    ${hintText ? `
                    <div class="flex flex-col justify-center items-center p-2 rounded-lg border-2 border-cyan-500/30 bg-cyan-950/20 col-span-2 sm:col-span-1">
                        <span class="text-[9px] text-cyan-500 uppercase font-bold tracking-wider mb-0.5">Action Hint</span>
                        <span class="text-[10px] text-cyan-400 dark:text-cyan-400 light-mode:text-cyan-600 font-black tracking-tight uppercase text-center">${hintText}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="relative group w-full overflow-hidden">
                    ${finalInnerContent}
                </div>

                <div class="flex flex-wrap items-center gap-3 px-4 py-3 bg-black/40 dark:bg-black/40 light-mode:bg-slate-50 border-t-2 border-white/20 light-mode:border-slate-300">
                    <button type="button" id="copy-btn-${catIdx}-${epIdx}" class="px-3.5 py-2 bg-slate-900/80 dark:bg-slate-900/80 light-mode:bg-slate-200/80 hover:bg-slate-800 light-mode:hover:bg-slate-300 text-white light-mode:text-slate-800 rounded-lg text-xs font-semibold border-2 border-white/20 dark:border-2 dark:border-white/20 light-mode:border-slate-300 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                        <span>Copy Response</span>
                    </button>
                    
                    ${downloadButtonHtml}
                </div>

            </div>
        `;

        // PENGIKAT EVENT HANDLER
        document.getElementById(`copy-btn-${catIdx}-${epIdx}`).onclick = () => {
            copyText(rawResponseText || JSON.stringify({status: response.status, info: cleanContentType}), "Response");
        };

        const downloadBtn = document.getElementById(`download-btn-${catIdx}-${epIdx}`);
        if (!isMedia) {
            downloadBtn.onclick = () => {
                const blob = new Blob([rawResponseText], { type: cleanContentType });
                const extension = cleanContentType.includes('json') ? 'json' : (cleanContentType.includes('html') ? 'html' : 'txt');
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `response-${Date.now()}.${extension}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
            };
        } else {
            downloadBtn.onclick = async () => {
                try {
                    let finalBlob = mediaBlobObject;
                    if (!finalBlob) {
                        const mediaRes = await fetch(fullPath);
                        finalBlob = await mediaRes.blob();
                    }
                    const downloadUrl = URL.createObjectURL(finalBlob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    const ext = cleanContentType.split('/')[1] || 'bin';
                    a.download = `media-${Date.now()}.${ext}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(downloadUrl);
                } catch (err) {
                    showToast('Gagal mengunduh file media', true);
                }
            };
        }

        showToast(i18n[currentLang].toastRequestSuccess);

        if (typeof fetchAndUpdateUserLimit === 'function') {
            fetchAndUpdateUserLimit();
        }

    } catch (error) {
        responseContent.innerHTML = `
            <div class="p-4 rounded-xl border-2 border-red-500 bg-red-500/5 text-red-400 text-xs font-mono break-all flex items-center gap-2">
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                <span>Error: ${error.message}</span>
            </div>
        `;
        showToast(i18n[currentLang].toastRequestFailed, true);
    } finally {
        isRequestInProgress = false;
        executeBtn.disabled = false;
        executeBtn.classList.remove('btn-loading');
        spinner.style.display = ''; 
        spinner.classList.remove('active');
        executeBtn.innerHTML = originalBtnHtml;
        fetchAndUpdateUserLimit();
    }
}

// Helper sanitasi string tag HTML
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function clearResponse(catIdx, epIdx, endpointType) {
    const responseDiv = document.getElementById(`response-${catIdx}-${epIdx}`);
    if (responseDiv) responseDiv.classList.add('hidden');

    const form = document.getElementById(`form-${catIdx}-${epIdx}`);
    if (form) {
        form.reset(); 
        const urlContainer = document.getElementById(`live-url-${catIdx}-${epIdx}`);
        if (urlContainer) {
            const basePath = urlContainer.textContent.split('?')[0];
            urlContainer.textContent = basePath;
        }

        const curlContainer = document.getElementById(`live-curl-${catIdx}-${epIdx}`);
        if (curlContainer) {
            const method = curlContainer.textContent.split(' ')[1] || 'GET';
            const baseUrl = curlContainer.textContent.split('"')[1] || '';
            curlContainer.textContent = `curl -X ${method} "${baseUrl.split('?')[0]}"`;
        }
    }
}


function renderCategoryFilters() {
    const container = document.getElementById('categoryFilters');
    if (!container || !apiData || !apiData.categories) return;

    let html = `<button class="filter-btn active" data-filter="all" onclick="filterByCategory('all')">semua (${totalEndpoints})</button>`;
    apiData.categories.forEach(category => {
        const catName = category.name.toLowerCase();
        html += `<button class="filter-btn" data-filter="${catName}" onclick="filterByCategory('${catName}')">${catName} (${category.items.length})</button>`;
    });
    container.innerHTML = html;
}

function filterByCategory(catName) {
    activeCategory = catName;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.filter === catName) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    performSearch();
}

function performSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const noResults = document.getElementById('noResults');
    let hasVisibleItems = false;

    requestAnimationFrame(() => {
        document.querySelectorAll('.category-group').forEach(category => {
            const catName = category.dataset.category;
            if (activeCategory !== 'all' && catName !== activeCategory) {
                category.classList.add('hidden');
                return;
            }

            let categoryHasVisibleItems = false;
            const items = category.querySelectorAll('.api-item');

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const matches = item.dataset.path.includes(searchTerm) || 
                                item.dataset.alias.includes(searchTerm) || 
                                item.dataset.description.includes(searchTerm) ||
                                item.dataset.category.includes(searchTerm);
                if (matches) {
                    item.classList.remove('hidden');
                    categoryHasVisibleItems = true;
                    hasVisibleItems = true;
                } else {
                    item.classList.add('hidden');
                }
            }
            category.classList.toggle('hidden', !categoryHasVisibleItems);
        });
        noResults.classList.toggle('hidden', hasVisibleItems);
    });
}

// Toggle Popup Select dengan Animasi Spring/Bounce
// Toggle Popup Select dengan penanganan z-index dinamis
function toggleCyberSelect(event, triggerEl) {
    event.stopPropagation();
    const wrapper = triggerEl.closest('.cyber-select-wrapper');
    const optionsEl = wrapper.querySelector('.cyber-select-options');
    const isOpen = optionsEl.classList.contains('show');

    // Tutup semua dropdown lain yang sedang terbuka
    closeAllCyberSelects();

    if (!isOpen) {
        optionsEl.classList.add('show');
        triggerEl.classList.add('active');
        
        // Naikkan z-index wrapper & elemen kontainer induk agar tidak tertutup elemen di bawahnya
        if (wrapper) {
            wrapper.style.zIndex = '9999';
            const apiItem = wrapper.closest('.api-item');
            if (apiItem) apiItem.style.zIndex = '9999';
        }
    }
}

// Handler Pemilihan Opsi + Animasi Bintang
function selectCyberOption(optionEl, catIdx, epIdx, paramName, method, path, epType) {
    const wrapper = optionEl.closest('.cyber-select-wrapper');
    const hiddenInput = wrapper.querySelector(`input[id="select-input-${catIdx}-${epIdx}-${paramName}"]`);
    const triggerText = wrapper.querySelector('.selected-text');
    const triggerEl = wrapper.querySelector('.cyber-select-trigger');
    const optionsContainer = wrapper.querySelector('.cyber-select-options');
    const val = optionEl.getAttribute('data-value');

    // Update Nilai
    if (hiddenInput) hiddenInput.value = val;
    if (triggerText) triggerText.textContent = val;

    // Reset dan aktifkan kelas 'selected' (Memicu animasi bintang)
    optionsContainer.querySelectorAll('.cyber-option').forEach(el => el.classList.remove('selected'));
    optionEl.classList.add('selected');

    // Tutup Popup
    optionsContainer.classList.remove('show');
    if (triggerEl) triggerEl.classList.remove('active');

    // Pembaruan URL Live Preview
    if (typeof updateLivePreview === 'function') {
        updateLivePreview(catIdx, epIdx, method, path, epType);
    }
}

// Tutup Semua Popup Select
function closeAllCyberSelects() {
    document.querySelectorAll('.cyber-select-options.show').forEach(el => {
        el.classList.remove('show');
        const wrapper = el.closest('.cyber-select-wrapper');
        if (wrapper) {
            wrapper.style.zIndex = '';
            const apiItem = wrapper.closest('.api-item');
            if (apiItem) apiItem.style.zIndex = '';
        }
    });
    document.querySelectorAll('.cyber-select-trigger.active').forEach(el => el.classList.remove('active'));
}

// Listener Klik di Luar Menu
document.addEventListener('click', closeAllCyberSelects);

function loadApis() {
    const apiList = document.getElementById('apiList');
    if (!apiData || !apiData.categories) {
        apiList.innerHTML = '<p class="text-center">No API data loaded.</p>';
        return;
    }

    totalEndpoints = 0;
    totalCategories = apiData.categories.length;
    apiData.categories.forEach(category => { totalEndpoints += category.items.length; });

    updateTotalEndpoints();
    updateTotalCategories();
    renderCategoryFilters();

    const isLightMode = body.classList.contains('light-mode');
    const pathColorClass = isLightMode ? 'text-cyan-700' : 'text-cyan-200';
    const subTextColorClass = isLightMode ? 'text-slate-600' : 'opacity-70';

    let html = '';
    apiData.categories.forEach((category, catIdx) => {
        const catNameLower = category.name.toLowerCase();
        let iconSvg = categoryIcons.default;
        for (const [key, svg] of Object.entries(categoryIcons)) {
            if (catNameLower.includes(key)) { iconSvg = svg; break; }
        }

        html += `
        <div class="category-group" data-category="${catNameLower}">
            <div class="glass-panel border rounded-xl overflow-hidden shadow-lg mb-4">
                <button onclick="toggleCategory(${catIdx})" class="w-full px-4 py-4 flex items-center justify-between hover:bg-white/5 light-mode:hover:bg-black/5 transition-colors">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 flex items-center justify-center bg-slate-950/40 light-mode:bg-slate-200/50 rounded-xl border border-white/10 light-mode:border-slate-300 shadow-inner flex-shrink-0">
                            ${iconSvg}
                        </div>
                        <div class="text-left">
                            <h3 class="font-bold text-sm tracking-widest text-cyan-400 light-mode:text-cyan-600 uppercase font-['Space_Grotesk']">${category.name}</h3>
                            <p class="text-[11px] code-font ${subTextColorClass}">${category.items.length} ${i18n[currentLang].endpointsCount}</p>
                        </div>
                    </div>
                    <svg id="cat-icon-${catIdx}" class="w-5 h-5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <div id="cat-${catIdx}" class="hidden">`;

        category.items.forEach((item, epIdx) => {
            const method = item.methods && item.methods.length ? item.methods[0] : 'GET';
            const pathParts = item.path.split('?');
            const path = pathParts[0];
            const epType = item.type || 'free';

            let statusClass = "status-ready";
            let statusText = "READY"; 
            if (item.status === 'update') { statusClass = 'status-update'; statusText = "UPDATE"; }
            else if (item.status === 'error' || item.status === 'perbaikan') { statusClass = 'status-error'; statusText = "MAINTENANCE"; }

            // Menentukan Badge Berdasarkan Tipe Endpoint (VIP, PREMIUM, FREE) dengan SVG
            let badgeTypeHtml = '';
            if (epType === 'vip') {
                badgeTypeHtml = `<span class="flex items-center px-1.5 py-0.5 text-[9px] rounded-sm bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold uppercase tracking-wider animate-pulse">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8.25l-7 11.5-7-11.5L9.25 3h5.5L19 8.25z"/></svg> VIP
                </span>`;
            } else if (epType === 'premium') {
                badgeTypeHtml = `<span class="flex items-center px-1.5 py-0.5 text-[9px] rounded-sm bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold uppercase tracking-wider animate-pulse">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg> PREMIUM
                </span>`;
            } else {
                badgeTypeHtml = `<span class="flex items-center px-1.5 py-0.5 text-[9px] rounded-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold uppercase tracking-wider">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> FREE
                </span>`;
            }

            html += `
            <div class="api-item border-t border-white/10 light-mode:border-slate-200" 
                data-method="${method}" data-path="${path}" data-alias="${item.name.toLowerCase()}" data-description="${item.desc.toLowerCase()}" data-category="${category.name.toLowerCase()}">
                <button onclick="toggleEndpoint(${catIdx}, ${epIdx})" class="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 light-mode:hover:bg-black/5 transition-colors">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <span class="bg-cyan-500 light-mode:bg-cyan-600 text-slate-950 light-mode:text-white px-2 py-0.5 rounded text-[10px] flex-shrink-0 code-font font-black">${method}</span>
                        <div class="text-left flex-1 min-w-0">
                            <p class="code-font font-semibold text-[13px] ${pathColorClass} truncate">${path}</p>
                            <div class="flex items-center gap-2 mt-1">
                                <p class="text-xs ${subTextColorClass} truncate">${item.name}</p>
                                <span class="px-1.5 py-0.5 text-[9px] rounded-sm ${statusClass} flex-shrink-0 uppercase tracking-wider font-bold">${statusText}</span>
                                ${badgeTypeHtml}
                            </div>
                        </div>
                    </div>
                    <span id="ep-icon-${catIdx}-${epIdx}" class="text-cyan-400 light-mode:text-cyan-600 px-2 flex items-center justify-center">
                   ${SVG_PLUS}
                 </span>
                </button>
                <div id="ep-${catIdx}-${epIdx}" class="hidden bg-slate-950/40 light-mode:bg-slate-50/50 px-4 py-4 border-t border-white/10 light-mode:border-slate-200 backdrop-blur-sm">
                    <p class="text-xs mb-4 ${isLightMode ? 'text-slate-700' : 'opacity-80'}">${item.desc}</p>
                    
                    <div class="mb-4">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="font-bold text-[11px] uppercase tracking-wider text-slate-400 light-mode:text-slate-600 code-font">ENDPOINT / REQUEST URL</h4>
                            <button type="button" onclick="copyFromElement('live-url-${catIdx}-${epIdx}', 'URL')" class="px-3 py-1 bg-white/5 hover:bg-white/10 light-mode:bg-slate-200 light-mode:hover:bg-slate-300 border border-white/10 light-mode:border-slate-300 rounded-lg text-[10px] transition-all active:scale-95 code-font text-slate-300 light-mode:text-slate-800">Copy URL</button>
                        </div>
                        <div class="bg-slate-900/40 light-mode:bg-slate-200/60 border border-white/10 light-mode:border-slate-300 px-4 py-3 rounded-xl backdrop-blur-md shadow-inner">
                            <code id="live-url-${catIdx}-${epIdx}" class="code-font text-xs text-cyan-400 light-mode:text-cyan-700 font-medium break-all">${BASE_URL}${path}</code>
                        </div>
                    </div>

                    <div class="mb-4">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="font-bold text-[11px] uppercase tracking-wider text-slate-400 light-mode:text-slate-600 code-font">cURL Command</h4>
                            <button type="button" onclick="copyFromElement('live-curl-${catIdx}-${epIdx}', 'cURL')" class="px-3 py-1 bg-white/5 hover:bg-white/10 light-mode:bg-slate-200 light-mode:hover:bg-slate-300 border border-white/10 light-mode:border-slate-300 rounded-lg text-[10px] transition-all active:scale-95 code-font text-slate-300 light-mode:text-slate-800">Copy cURL</button>
                        </div>
                        <div class="bg-slate-900/40 light-mode:bg-slate-200/60 border border-white/10 light-mode:border-slate-300 px-4 py-3 rounded-xl backdrop-blur-md shadow-inner">
                            <code id="live-curl-${catIdx}-${epIdx}" class="code-font text-xs text-slate-300 light-mode:text-slate-700 block overflow-x-auto whitespace-pre">curl -X ${method} "${BASE_URL}${path}"</code>
                        </div>
                    </div>`;

            if (item.status === 'ready' || item.status === 'update') {
                html += `
                    <div>
                        <h4 class="font-bold text-[11px] uppercase tracking-wider text-slate-400 light-mode:text-slate-600 mb-3">Parameter</h4>
                        <form id="form-${catIdx}-${epIdx}" onsubmit="executeRequest(event, ${catIdx}, ${epIdx}, '${method}', '${path}', '${epType}')">
                            <div class="space-y-4 mb-4">`;

                if (item.params) {
                    Object.keys(item.params).forEach(paramName => {
                        const pType = item.params[paramName];
                        const isRequired = true; 
                        let paramDesc = (pType && pType.type) ? pType.type : (pType || paramName);

                        let inputValue = '';
                        let inputPlaceholder = `Masukkan ${paramName}`;

                        // Logika API Key dengan pemisahan tipe Free, Premium, dan VIP
if (paramName.toLowerCase() === 'apikey') {
    // Cek apakah displayApiKey terdefinisi dan BUKAN 'Silakan Login'
    const isUserLoggedIn = (typeof displayApiKey !== 'undefined' && displayApiKey !== 'Silakan Login' && displayApiKey !== '');

    if (epType === 'vip') {
        // KOSONGKAN value agar tidak memakai apikey free
        inputValue = ''; 
        inputPlaceholder = 'Masukkan apikey VIP';
    } else if (epType === 'premium') {
        // KOSONGKAN value agar tidak memakai apikey free
        inputValue = ''; 
        inputPlaceholder = 'Masukkan apikey Premium';
    } else {
        // Isi otomatis HANYA untuk endpoint tipe FREE
        inputValue = isUserLoggedIn ? displayApiKey : '';
        inputPlaceholder = isUserLoggedIn ? 'Masukkan apikey' : 'Silakan login terlebih dahulu';
    }
}

                        html += `
                        <div>
                            <div class="flex items-center justify-between mb-1.5">
                                <label class="block text-xs font-semibold text-slate-300 light-mode:text-slate-700 code-font">
                                    ${paramName} ${isRequired ? '<span class="text-red-500">*</span>' : ''}
                                </label>
                                <span class="text-[10px] text-slate-500 light-mode:text-slate-400 italic font-normal">${paramDesc}</span>
                            </div>`;

                        // Potongan kode di dalam fungsi loadApis() saat generate form parameter:
if ((pType && pType.type === 'file') || pType === 'file' || paramName.toLowerCase() === 'file') {
    html += `<input type="file" name="${paramName}" onchange="updateLivePreview(${catIdx}, ${epIdx}, '${method}', '${path}', '${epType}')" class="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-cyan-500 code-font text-sm file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 cursor-pointer" ${isRequired ? 'required' : ''}>`;
} else if (pType && pType.type === 'select' && Array.isArray(pType.options)) {
    const defaultVal = pType.options[0] || '';

    // SVG Bintang Beranimasi & Chevron Transisi Halus
    const SVG_STAR = `<svg class="cyber-star-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    const SVG_CHEVRON = `<svg class="w-4 h-4 chevron-icon transition-transform duration-200 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>`;

    html += `
    <div class="cyber-select-wrapper">
        <input type="hidden" name="${paramName}" value="${defaultVal}" id="select-input-${catIdx}-${epIdx}-${paramName}">
        <div class="cyber-select-trigger" onclick="toggleCyberSelect(event, this)">
            <span class="selected-text">${defaultVal}</span>
            ${SVG_CHEVRON}
        </div>
        <div class="cyber-select-options scrollbar-thin">`;

    pType.options.forEach((opt, oIdx) => {
        const isSel = oIdx === 0 ? 'selected' : '';
        html += `
            <div class="cyber-option ${isSel}" onclick="selectCyberOption(this, '${catIdx}', '${epIdx}', '${paramName}', '${method}', '${path}', '${epType}')" data-value="${opt}">
                <span>${opt}</span>
                ${SVG_STAR}
            </div>`;
    });

    html += `
        </div>
    </div>`;
} else {
    html += `<input type="text" name="${paramName}" value="${inputValue}" oninput="updateLivePreview(${catIdx}, ${epIdx}, '${method}', '${path}', '${epType}')" class="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-cyan-500 code-font text-sm" placeholder="${inputPlaceholder}" ${isRequired ? 'required' : ''}>`;
}
                        html += `</div>`;
                    });
                }

                html += `
                            </div>
                            <div class="flex gap-3">
                                <button type="submit" class="px-5 py-2 bg-cyan-500 light-mode:bg-cyan-600 hover:bg-cyan-400 light-mode:hover:bg-cyan-500 text-slate-950 light-mode:text-white rounded-md font-bold text-xs tracking-wider transition-all flex items-center justify-center">EKSEKUSI</button>
                                <button type="button" onclick="clearResponse(${catIdx}, ${epIdx}, '${epType}')" class="px-5 py-2 bg-transparent border border-white/20 light-mode:border-slate-300 hover:border-white/40 light-mode:hover:bg-slate-100 text-slate-300 light-mode:text-slate-700 rounded-md font-bold text-xs transition-colors">BERSIHKAN</button>
                            </div>
                        </form>

                        <div id="response-${catIdx}-${epIdx}" class="hidden mt-6 space-y-4">
                            <div>
                                <h5 class="text-[11px] uppercase tracking-wider font-bold mb-2 text-slate-400 light-mode:text-slate-500">Response</h5>
                                <div class="bg-slate-950/80 light-mode:bg-slate-100 border border-white/10 light-mode:border-slate-300 p-3 rounded-lg min-h-[100px] overflow-x-auto" id="response-content-${catIdx}-${epIdx}"></div>
                            </div>
                        </div>
                    </div>`;
            } else {
                html += `<div class="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500 font-medium">${i18n[currentLang].endpointNotAvailable}</div>`;
            }
            html += `</div></div>`;
        });
        html += `</div></div></div>`;
    });
    apiList.innerHTML = html;
    allApiElements = Array.from(document.querySelectorAll('.api-item'));
}

function initMultiMusicPlayer() {
    const playlist = window.musicPlaylist || [];
    if (!playlist.length) {
        console.warn("Playlist kosong atau tidak ditemukan.");
        return;
    }

    let currentTrackIdx = 0;
    const audio = document.getElementById('audioElement');
    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    const progressBar = document.getElementById('progressBar');
    const progressContainer = document.getElementById('progressContainer');
    const currentTimeEl = document.getElementById('currentTime');
    const totalDurationEl = document.getElementById('totalDuration');
    const coverImg = document.getElementById('musicCoverImg');
    const titleEl = document.getElementById('musicTitle');
    const artistEl = document.getElementById('musicArtist');
    const playlistPanel = document.getElementById('playlistPanel');

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    function formatTime(secs) {
        if (isNaN(secs)) return "0:00";
        const mins = Math.floor(secs / 60);
        const remainingSecs = Math.floor(secs % 60);
        return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
    }

    // Fungsi utama mengirim durasi dan posisi detik ke sistem Android
    function updateMediaSessionPosition() {
        if ('mediaSession' in navigator && audio && !isNaN(audio.duration) && audio.duration > 0) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: audio.duration,
                    playbackRate: audio.playbackRate || 1.0,
                    position: audio.currentTime
                });
            } catch (error) {
                console.error("Gagal memperbarui posisi MediaSession:", error);
            }
        }
    }

    function loadTrack(index) {
        currentTrackIdx = index;
        const track = playlist[index];

        // Memastikan elemen ada sebelum memanipulasi DOM
        if (audio) audio.src = track.url || '';
        if (titleEl) titleEl.textContent = track.title || 'Unknown Title';
        if (artistEl) artistEl.textContent = track.artist || 'Unknown Artist';
        if (coverImg) coverImg.src = track.cover || 'default-cover.png';

        if (progressBar) progressBar.style.width = '0%';
        if (currentTimeEl) currentTimeEl.textContent = '0:00';

        // --- Integrasi dengan Notifikasi Sistem / Media Session API ---
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title || 'Unknown Title',
                artist: track.artist || 'Unknown Artist',
                album: 'Web Player',
                artwork: [
                    { src: track.cover || 'default-cover.png', sizes: '96x96',   type: 'image/png' },
                    { src: track.cover || 'default-cover.png', sizes: '128x128', type: 'image/png' },
                    { src: track.cover || 'default-cover.png', sizes: '192x192', type: 'image/png' },
                    { src: track.cover || 'default-cover.png', sizes: '256x256', type: 'image/png' },
                    { src: track.cover || 'default-cover.png', sizes: '384x384', type: 'image/png' },
                    { src: track.cover || 'default-cover.png', sizes: '512x512', type: 'image/png' },
                ]
            });

            // Reset posisi bar Android menjadi 0 saat lagu berpindah
            if ('setPositionState' in navigator.mediaSession) {
                navigator.mediaSession.setPositionState({
                    duration: 0,
                    playbackRate: 1.0,
                    position: 0
                });
            }

            // Hubungkan tombol notifikasi sistem Android ke aksi player web
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                if (prevBtn) prevBtn.click();
            });
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                if (nextBtn) nextBtn.click();
            });
            navigator.mediaSession.setActionHandler('play', () => {
                if (audio) audio.play().catch(e => console.log(e));
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                if (audio) audio.pause();
            });

            // Fitur agar garis durasi di Android bisa digeser maju-mundur
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (audio && details.seekTime) {
                    audio.currentTime = details.seekTime;
                    updateMediaSessionPosition();
                }
            });
        }
        // -------------------------------------------------------------

        renderPlaylistItems();
    }

    function renderPlaylistItems() {
        if (!playlistPanel) return;
        playlistPanel.innerHTML = '';

        playlist.forEach((track, idx) => {
            const isActive = idx === currentTrackIdx;
            const itemBtn = document.createElement('button');
            itemBtn.className = `w-full text-left px-3 py-2 text-xs rounded-xl flex items-center justify-between transition-all ${
                isActive 
                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 light-mode:text-cyan-700 font-bold' 
                : 'hover:bg-white/5 light-mode:hover:bg-black/5 text-slate-400 light-mode:text-slate-600'
            }`;

            itemBtn.innerHTML = `
                <div class="flex items-center gap-2 truncate">
                    <span class="opacity-50 text-[10px] code-font">${String(idx + 1).padStart(2, '0')}</span>
                    <span class="truncate">${track.title} <span class="opacity-60 font-normal">- ${track.artist}</span></span>
                </div>
                ${isActive ? '<span class="text-[9px] tracking-wider text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded animate-pulse font-bold">PLAYING</span>' : ''}
            `;

            itemBtn.addEventListener('click', () => {
                loadTrack(idx);
                audio.play().catch(e => console.log("Playback dicegah oleh browser:", e));
            });
            playlistPanel.appendChild(itemBtn);
        });
    }

    // Event Listeners dengan pengecekan elemen gratis (anti error)
    if (playBtn && audio) {
        playBtn.addEventListener('click', () => { 
            audio.paused ? audio.play().catch(e => console.log(e)) : audio.pause(); 
        });
    }

    if (audio) {
        audio.addEventListener('play', () => {
            if (playIcon) playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
            if (coverImg) coverImg.classList.add('scale-105', 'rotate-3');

            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "playing";
            }
            updateMediaSessionPosition();
        });

        audio.addEventListener('pause', () => {
            if (playIcon) playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
            if (coverImg) coverImg.classList.remove('scale-105', 'rotate-3');

            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
        });

        audio.addEventListener('timeupdate', () => {
            if (audio.duration && progressBar && currentTimeEl) {
                progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
                currentTimeEl.textContent = formatTime(audio.currentTime);
            }
            // Kirim data waktu berjalan secara berkala ke sistem Android
            updateMediaSessionPosition();
        });

        audio.addEventListener('loadedmetadata', () => { 
            if (totalDurationEl) totalDurationEl.textContent = formatTime(audio.duration); 

            // Memberikan sedikit jeda agar objek audio.duration siap terbaca penuh oleh browser
            setTimeout(() => {
                updateMediaSessionPosition();
            }, 250);
        });

        audio.addEventListener('ended', () => { 
            loadTrack(currentTrackIdx + 1 >= playlist.length ? 0 : currentTrackIdx + 1); 
            audio.play().catch(e => console.log(e)); 
        });
    }

    if (progressContainer && audio) {
        progressContainer.addEventListener('click', (e) => { 
            if (audio.duration) {
                audio.currentTime = (e.offsetX / progressContainer.clientWidth) * audio.duration; 
                updateMediaSessionPosition();
            }
        });
    }

    if (prevBtn && audio) {
        prevBtn.addEventListener('click', () => { 
            loadTrack(currentTrackIdx - 1 < 0 ? playlist.length - 1 : currentTrackIdx - 1); 
            audio.play().catch(e => console.log(e)); 
        });
    }

    if (nextBtn && audio) {
        nextBtn.addEventListener('click', () => { 
            loadTrack(currentTrackIdx + 1 >= playlist.length ? 0 : currentTrackIdx + 1); 
            audio.play().catch(e => console.log(e)); 
        });
    }

    const playlistToggleBtn = document.getElementById('playlistToggleBtn');
    if (playlistToggleBtn && playlistPanel) {
        playlistToggleBtn.addEventListener('click', () => { 
            playlistPanel.classList.toggle('hidden'); 
        });
    }

    // Muat lagu pertama saat inisialisasi awal
    loadTrack(0);
}

function initImageLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImg = document.getElementById('lightboxImage');
    const closeBtn = document.getElementById('closeLightbox');

    if (!lightbox || !lightboxImg) return;

    document.getElementById('apiList').addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG' && e.target.classList.contains('media-image')) {
            e.preventDefault();
            lightboxImg.src = e.target.src;
            lightbox.classList.remove('hidden');
            requestAnimationFrame(() => {
                lightbox.classList.remove('opacity-0');
                lightbox.classList.add('opacity-100');
                lightboxImg.classList.remove('scale-95');
                lightboxImg.classList.add('scale-100');
            });
        }
    });

    function hideLightbox() {
        lightbox.classList.remove('opacity-100');
        lightbox.classList.add('opacity-0');
        lightboxImg.classList.remove('scale-100');
        lightboxImg.classList.add('scale-95');
        setTimeout(() => {
            lightbox.classList.add('hidden');
            lightboxImg.src = '';
        }, 300);
    }

    if (closeBtn) closeBtn.addEventListener('click', hideLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.id === 'closeLightbox') {
            hideLightbox();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) {
            hideLightbox();
        }
    });
}

async function fetchAndUpdateUserLimit() {
    try {
        const urlParams = new URLSearchParams(window.location.search);

        // Prioritas pencarian API Key: URL Param -> Global Variable -> LocalStorage -> Form Input
        let apiKey = urlParams.get('apikey') 
            || (typeof displayApiKey !== 'undefined' && displayApiKey !== 'Silakan Login' ? displayApiKey : '');

        if (!apiKey) {
            const firstApiKeyInput = document.querySelector('input[name="apikey"]');
            if (firstApiKeyInput && firstApiKeyInput.value) {
                apiKey = firstApiKeyInput.value;
            }
        }

        // Panggil endpoint user-limit (cookie auth_session akan otomatis terkirim via credentials)
        const response = await fetch(`/api/user-limit?apikey=${encodeURIComponent(apiKey)}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });

        if (!response.ok) return;

        const data = await response.json();

        const limitUsedEl = document.getElementById('userLimitUsed');
        const limitMaxEl = document.getElementById('userLimitMax');
        const limitBadgeEl = document.getElementById('userLimitBadge');

        if (limitUsedEl && limitMaxEl) {
            // Update UI jika data dari server valid
            if (data.limitUsed !== undefined && data.limitUsed !== null) {
                limitUsedEl.textContent = data.limitUsed;
            }
            if (data.maxLimit !== undefined && data.maxLimit !== null) {
                limitMaxEl.textContent = data.maxLimit;
            }

            if (limitBadgeEl && data.type) {
                limitBadgeEl.textContent = data.type.toUpperCase();

                // Ubah styling badge secara konsisten
                if (data.type === 'vip') {
                    limitBadgeEl.className = "text-[9px] font-bold px-2 py-0.5 mt-1 rounded bg-purple-500/20 text-purple-400 uppercase tracking-widest border border-purple-500/30";
                } else if (data.type === 'premium') {
                    limitBadgeEl.className = "text-[9px] font-bold px-2 py-0.5 mt-1 rounded bg-amber-500/20 text-amber-400 uppercase tracking-widest border border-amber-500/30";
                } else {
                    limitBadgeEl.className = "text-[9px] font-bold px-2 py-0.5 mt-1 rounded bg-slate-800 text-slate-400 uppercase tracking-widest border border-white/5";
                }
            }
        }
    } catch (error) {
        console.error("Gagal memperbarui data limit di UI:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('lang') || 'id';
    const urlParams = new URLSearchParams(window.location.search);

    initTheme();
    initDigitalClock();
    initImageLightbox(); 
    setLanguage(savedLang);
    fetchAndUpdateUserLimit();
    if (typeof initMultiMusicPlayer === 'function') {
        initMultiMusicPlayer();
    }

    const notifBtn = document.getElementById('notifMenuBtn');
const notifPopup = document.getElementById('notifPopup');
const closeNotifBtn = document.getElementById('closeNotifBtn');
const notifOverlay = document.getElementById('notifOverlay');
const notifBadge = document.getElementById('notifBadge');

if (notifBtn && notifPopup) {
    // Buka Notifikasi
    notifBtn.addEventListener('click', () => {
        notifPopup.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');

        // Sembunyikan angka 1 saat ditekan / dibaca
        if (notifBadge) {
            notifBadge.classList.add('hidden');
        }
    });

    // Tutup Notifikasi via Tombol X
    if (closeNotifBtn) {
        closeNotifBtn.addEventListener('click', () => {
            notifPopup.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        });
    }

    // Tutup Notifikasi via Klik Area Gelap Luar
    if (notifOverlay) {
        notifOverlay.addEventListener('click', () => {
            notifPopup.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        });
    }
}

if (urlParams.get('showProfile') === 'true') {
        if (typeof openProfilePopup === "function") {
            openProfilePopup();
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const uploaderBtn = document.getElementById('uploaderMenuBtn'); 
    const bioMenuBtn = document.getElementById('bioMenuBtn');
    const bioDropdown = document.getElementById('bioDropdown');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const menuOverlay = document.getElementById('menuOverlay');

    if (bioMenuBtn && bioDropdown && menuOverlay) {
        bioMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            bioDropdown.style.transform = 'translateX(0)';
            menuOverlay.classList.remove('hidden');
        });
        if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeSidebarMenu);
        menuOverlay.addEventListener('click', closeSidebarMenu);
        bioDropdown.addEventListener('click', (e) => { e.stopPropagation(); });
    }

    if (uploaderBtn) {
        uploaderBtn.addEventListener('click', () => {
            window.location.href = '/uploader'; 
        });
    }

    fetch('/api/apilist')
        .then(res => res.json())
        .then(data => {
            apiData = data;
            loadApis();
            fetchAndUpdateUserLimit();

        })
        .catch(err => {
            const apiListEl = document.getElementById('apiList');
            if(apiListEl) {
               apiListEl.innerHTML = `<div class="text-center p-8 bg-red-900/20 border border-red-700 rounded-lg"><div class="text-4xl mb-4">⚠️</div><h3 class="font-bold text-lg mb-2">Failed to load API data</h3></div>`;
            }
        });
});

themeToggleBtn.addEventListener('click', toggleTheme);

let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 150);
});
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
    'ai': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-cyan-400"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 1 1 12 2zm-2 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm4 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>',
    'download': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-cyan-400"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm9 4H3v-2h18v2z"/></svg>',
    'search': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-cyan-400"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
    'tools': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-cyan-400"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.1L9 6 6 9 1.8 4.7C.5 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
    'default': '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-cyan-400"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>'
};

const i18n = {
    id: {
        searchPlaceholder: "Cari endpoint berdasarkan nama, path, atau kategori...",
        noResultsTitle: "Endpoint tidak ditemukan",
        noResultsDesc: "Coba gunakan kata kunci lain",
        endpointsTitle: "Total Endpoint",
        categoriesTitle: "Total Kategori",
        endpointsCount: "endpoints",
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
        toastRequestWait: "Please wait for current request",
        toastRequestSuccess: "Request completed successfully!",
        toastRequestFailed: "Request failed!"
    }
};

function toggleCategory(catIdx) {
    const catDiv = document.getElementById(`cat-${catIdx}`);
    const catIcon = document.getElementById(`cat-icon-${catIdx}`);
    if (catDiv && catIcon) {
        const isHidden = catDiv.classList.contains('hidden');
        catDiv.classList.toggle('hidden', !isHidden);
        catIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
}

const SVG_PLUS = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`;
const SVG_MINUS = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15"/></svg>`;

function toggleEndpoint(catIdx, epIdx) {
    const epDiv = document.getElementById(`ep-${catIdx}-${epIdx}`);
    const epIcon = document.getElementById(`ep-icon-${catIdx}-${epIdx}`);
    if (epDiv && epIcon) {
        const isHidden = epDiv.classList.contains('hidden');
        epDiv.classList.toggle('hidden', !isHidden);
        epIcon.innerHTML = isHidden ? SVG_MINUS : SVG_PLUS;
    }
}

function closeSidebarMenu() {
    const bioDropdown = document.getElementById('bioDropdown');
    const menuOverlay = document.getElementById('menuOverlay');
    if (bioDropdown && menuOverlay) {
        bioDropdown.style.transform = 'translateX(100%)';
        menuOverlay.classList.add('hidden');
    }
}

function createMediaPreview(url, contentType) {
    const type = contentType || '';
    if (type.startsWith('image/') || url.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
        return `<img src="${url}" class="media-image w-full h-auto max-h-[75vh] rounded-lg object-contain cursor-pointer" alt="Preview">`;
    } else if (type.startsWith('video/') || url.match(/\.(mp4|webm|mov)/i)) {
        return `<video src="${url}" controls autoplay loop playsinline class="w-full h-auto max-h-[75vh] rounded-lg object-contain bg-black"></video>`;
    } else if (type.startsWith('audio/') || url.match(/\.(mp3|wav|ogg)/i)) {
        return `<audio src="${url}" controls autoplay class="w-full"></audio>`;
    }
    return `<div class="p-3 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs break-all">URL: <a href="${url}" target="_blank" class="underline">${url}</a></div>`;
}

function updateThemeBackground(theme) {
    if (themeBg) {
        if (theme === 'light') {
            document.body.style.backgroundColor = "#f8fafc";
            themeBg.style.backgroundColor = "#f8fafc";
        } else {
            document.body.style.backgroundColor = "#030712";
            themeBg.style.backgroundColor = "#030712";
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
        themeToggleDarkIcon?.classList.add('hidden');
        themeToggleLightIcon?.classList.remove('hidden');
    } else {
        body.classList.remove('light-mode');
        themeToggleDarkIcon?.classList.remove('hidden');
        themeToggleLightIcon?.classList.add('hidden');
    }

    updateThemeBackground(currentTheme);
}

function toggleTheme() {
    const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
    const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

    if (body.classList.contains('light-mode')) {
        body.classList.remove('light-mode');
        themeToggleDarkIcon?.classList.remove('hidden');
        themeToggleLightIcon?.classList.add('hidden');
        currentTheme = 'dark';
    } else {
        body.classList.add('light-mode');
        themeToggleDarkIcon?.classList.add('hidden');
        themeToggleLightIcon?.classList.remove('hidden');
        currentTheme = 'light';
    }

    localStorage.setItem('theme', currentTheme);
    updateThemeBackground(currentTheme);
    if (apiData) loadApis();
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);

    document.getElementById('lang-id')?.classList.toggle('active', lang === 'id');
    document.getElementById('lang-en')?.classList.toggle('active', lang === 'en');

    if (document.getElementById('searchInput')) document.getElementById('searchInput').placeholder = i18n[lang].searchPlaceholder;
    if (document.getElementById('no-results-title')) document.getElementById('no-results-title').textContent = i18n[lang].noResultsTitle;
    if (document.getElementById('no-results-desc')) document.getElementById('no-results-desc').textContent = i18n[lang].noResultsDesc;
    if (document.getElementById('stat-endpoints-title')) document.getElementById('stat-endpoints-title').textContent = i18n[lang].endpointsTitle;
    if (document.getElementById('stat-categories-title')) document.getElementById('stat-categories-title').textContent = i18n[lang].categoriesTitle;

    if (apiData) loadApis();
}

function initDigitalClock() {
    const clockElement = document.getElementById('liveClock');
    const dateElement = document.getElementById('liveDate');
    if (!clockElement || !dateElement) return;

    function updateClock() {
        if (typeof moment !== 'undefined') {
            const now = moment().tz("Asia/Jakarta");
            clockElement.textContent = now.format('HH:mm:ss');
            dateElement.textContent = now.locale(currentLang).format('dddd, D MMMM YYYY');
        }
    }
    updateClock();
    setInterval(updateClock, 1000);
}

function showToast(message, isError = false) {
    const container = document.getElementById('toast');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `px-4 py-2.5 rounded-xl border backdrop-blur-md text-xs font-mono font-semibold shadow-xl transition-all duration-300 transform translate-y-[-10px] opacity-0 ${
        isError ? 'border-red-500/40 bg-slate-950/90 text-red-400' : 'border-cyan-500/40 bg-slate-950/90 text-cyan-400'
    }`;

    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-[-10px]');
        toast.classList.add('opacity-100', 'translate-y-0');
    });

    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function copyText(text, type = 'path') {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`${type} disalin!`);
    }).catch(() => {
        showToast('Gagal menyalin text', true);
    });
}

function copyFromElement(elementId, type) {
    const el = document.getElementById(elementId);
    if (el) copyText(el.innerText || el.textContent, type);
}

function updateLivePreview(catIdx, epIdx, method, basePath) {
    const form = document.getElementById(`form-${catIdx}-${epIdx}`);
    if (!form) return;

    const formData = new FormData(form);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
        if (value && typeof value === 'string') {
            params.append(key, value);
        }
    }

    const queryStr = params.toString();
    const finalUrl = queryStr ? `${BASE_URL}${basePath}?${queryStr}` : `${BASE_URL}${basePath}`;

    const urlContainer = document.getElementById(`live-url-${catIdx}-${epIdx}`);
    const curlContainer = document.getElementById(`live-curl-${catIdx}-${epIdx}`);

    if (urlContainer) urlContainer.textContent = finalUrl;
    if (curlContainer) curlContainer.textContent = `curl -X ${method.toUpperCase()} "${finalUrl}"`;
}

async function executeRequest(e, catIdx, epIdx, method, path) {
    e.preventDefault();
    if (isRequestInProgress) {
        showToast(i18n[currentLang].toastRequestWait, true);
        return;
    }

    const form = document.getElementById(`form-${catIdx}-${epIdx}`);
    const responseDiv = document.getElementById(`response-${catIdx}-${epIdx}`);
    const responseContent = document.getElementById(`response-content-${catIdx}-${epIdx}`);
    const executeBtn = form.querySelector('button[type="submit"]');

    isRequestInProgress = true;
    executeBtn.disabled = true;
    responseDiv.classList.remove('hidden');

    responseContent.innerHTML = `<div class="p-4 text-xs font-mono text-cyan-400 animate-pulse text-center">Loading...</div>`;

    const rawFormData = new FormData(form);
    const queryParams = new URLSearchParams();
    let finalMethod = method.toUpperCase();
    let fetchOptions = { method: finalMethod };
    let fullPath = `${BASE_URL}${path.split('?')[0]}`;

    try {
        if (finalMethod === 'GET' || finalMethod === 'DELETE') {
            for (const [key, value] of rawFormData.entries()) {
                if (value && typeof value === 'string') queryParams.append(key, value);
            }
            const qStr = queryParams.toString();
            if (qStr) fullPath += '?' + qStr;
        } else {
            fetchOptions.body = rawFormData;
        }

        const startTime = performance.now();
        const response = await fetch(fullPath, fetchOptions);
        const duration = Math.round(performance.now() - startTime);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentType = response.headers.get("content-type") || "";
        let rawResponseText = "";
        let finalInnerContent = "";

        if (contentType.includes("application/json")) {
            const data = await response.json();
            rawResponseText = JSON.stringify(data, null, 2);
            finalInnerContent = `<pre class="p-3 text-xs font-mono text-cyan-400 overflow-x-auto max-h-80 bg-black/20 rounded-lg"><code>${escapeHtml(rawResponseText)}</code></pre>`;
        } else if (contentType.startsWith("image/") || contentType.startsWith("video/") || contentType.startsWith("audio/")) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            finalInnerContent = `<div class="p-2 flex justify-center">${createMediaPreview(blobUrl, contentType)}</div>`;
        } else {
            rawResponseText = await response.text();
            finalInnerContent = `<pre class="p-3 text-xs font-mono text-slate-300 overflow-x-auto max-h-80 bg-black/20 rounded-lg"><code>${escapeHtml(rawResponseText)}</code></pre>`;
        }

        responseContent.innerHTML = `
            <div class="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                <div class="flex items-center justify-between text-[10px] font-mono mb-2 text-slate-400">
                    <span>STATUS: ${response.status}</span>
                    <span>TIME: ${duration}ms</span>
                </div>
                ${finalInnerContent}
            </div>
        `;

        showToast(i18n[currentLang].toastRequestSuccess);
    } catch (error) {
        responseContent.innerHTML = `<div class="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono">Error: ${error.message}</div>`;
        showToast(i18n[currentLang].toastRequestFailed, true);
    } finally {
        isRequestInProgress = false;
        executeBtn.disabled = false;
        fetchAndUpdateUserLimit();
    }
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clearResponse(catIdx, epIdx) {
    const responseDiv = document.getElementById(`response-${catIdx}-${epIdx}`);
    if (responseDiv) responseDiv.classList.add('hidden');
    const form = document.getElementById(`form-${catIdx}-${epIdx}`);
    if (form) form.reset();
}

function renderCategoryFilters() {
    const container = document.getElementById('categoryFilters');
    if (!container || !apiData || !apiData.categories) return;

    let html = `<button class="filter-btn active" onclick="filterByCategory('all')">semua (${totalEndpoints})</button>`;
    apiData.categories.forEach(category => {
        const catName = category.name.toLowerCase();
        html += `<button class="filter-btn" onclick="filterByCategory('${catName}')">${catName} (${category.items.length})</button>`;
    });
    container.innerHTML = html;
}

function filterByCategory(catName) {
    activeCategory = catName;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(catName));
    });
    performSearch();
}

function performSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    let hasVisibleItems = false;

    document.querySelectorAll('.category-group').forEach(category => {
        const catName = category.dataset.category;
        if (activeCategory !== 'all' && catName !== activeCategory) {
            category.classList.add('hidden');
            return;
        }

        let categoryHasVisibleItems = false;
        const items = category.querySelectorAll('.api-item');

        items.forEach(item => {
            const matches = item.dataset.path.includes(searchTerm) || 
                            item.dataset.alias.includes(searchTerm) || 
                            item.dataset.description.includes(searchTerm);
            item.classList.toggle('hidden', !matches);
            if (matches) {
                categoryHasVisibleItems = true;
                hasVisibleItems = true;
            }
        });
        category.classList.toggle('hidden', !categoryHasVisibleItems);
    });

    document.getElementById('noResults')?.classList.toggle('hidden', hasVisibleItems);
}

function loadApis() {
    const apiList = document.getElementById('apiList');
    if (!apiData || !apiData.categories) return;

    totalEndpoints = 0;
    totalCategories = apiData.categories.length;
    apiData.categories.forEach(category => { totalEndpoints += category.items.length; });

    document.getElementById('totalEndpoints').textContent = totalEndpoints;
    document.getElementById('totalCategories').textContent = totalCategories;
    renderCategoryFilters();

    let html = '';
    apiData.categories.forEach((category, catIdx) => {
        const catNameLower = category.name.toLowerCase();

        html += `
        <div class="category-group" data-category="${catNameLower}">
            <div class="glass-panel border rounded-xl overflow-hidden shadow-lg mb-4">
                <button onclick="toggleCategory(${catIdx})" class="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 flex items-center justify-center bg-slate-950/40 rounded-lg border border-white/10 shrink-0">
                            ${categoryIcons[catNameLower] || categoryIcons.default}
                        </div>
                        <div class="text-left">
                            <h3 class="font-bold text-xs tracking-wider text-cyan-400 uppercase font-['Space_Grotesk']">${category.name}</h3>
                            <p class="text-[10px] code-font opacity-60">${category.items.length} ${i18n[currentLang].endpointsCount}</p>
                        </div>
                    </div>
                    <svg id="cat-icon-${catIdx}" class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <div id="cat-${catIdx}" class="hidden">`;

        category.items.forEach((item, epIdx) => {
            const method = item.methods?.[0] || 'GET';
            const path = item.path.split('?')[0];

            html += `
            <div class="api-item border-t border-white/10 hover:bg-white/5 transition-colors" 
                 data-method="${method}" data-path="${path}" data-alias="${item.name.toLowerCase()}" data-description="${item.desc.toLowerCase()}">
                <button onclick="toggleEndpoint(${catIdx}, ${epIdx})" class="w-full px-4 py-3 flex items-center justify-between">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <span class="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded text-[9px] code-font font-bold">${method}</span>
                        <div class="text-left flex-1 min-w-0">
                            <p class="font-bold text-sm text-slate-100 truncate">${item.name}</p>
                            <p class="code-font text-xs text-cyan-400/80 truncate">${path}</p>
                        </div>
                    </div>
                    <span id="ep-icon-${catIdx}-${epIdx}" class="text-cyan-400 px-2 flex items-center justify-center">
                        ${SVG_PLUS}
                    </span>
                </button>
                <div id="ep-${catIdx}-${epIdx}" class="hidden bg-slate-950/60 px-4 py-4 border-t border-white/10">
                    <p class="text-xs text-slate-300 mb-3">${item.desc}</p>
                    <form id="form-${catIdx}-${epIdx}" onsubmit="executeRequest(event, ${catIdx}, ${epIdx}, '${method}', '${path}')">
                        <div class="space-y-3 mb-4">`;

            if (item.params) {
                Object.keys(item.params).forEach(paramName => {
                    let inputValue = paramName.toLowerCase() === 'apikey' ? (displayApiKey !== 'Silakan Login' ? displayApiKey : '') : '';
                    html += `
                        <div>
                            <label class="block text-[10px] font-bold text-slate-400 code-font mb-1 uppercase">${paramName}</label>
                            <input type="text" name="${paramName}" value="${inputValue}" oninput="updateLivePreview(${catIdx}, ${epIdx}, '${method}', '${path}')" class="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-cyan-500 code-font text-xs" placeholder="Masukkan ${paramName}" required>
                        </div>`;
                });
            }

            html += `
                        </div>
                        <div class="flex gap-2">
                            <button type="submit" class="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg font-bold text-xs tracking-wider transition-all">EKSEKUSI</button>
                            <button type="button" onclick="clearResponse(${catIdx}, ${epIdx})" class="px-4 py-1.5 border border-white/20 hover:border-white/40 text-slate-300 rounded-lg font-bold text-xs transition-colors">BERSIHKAN</button>
                        </div>
                    </form>
                    <div id="response-${catIdx}-${epIdx}" class="hidden mt-4">
                        <div id="response-content-${catIdx}-${epIdx}"></div>
                    </div>
                </div>
            </div>`;
        });
        html += `</div></div></div>`;
    });
    apiList.innerHTML = html;
}

function fetchAndUpdateUserLimit() {
    fetch('/api/user-limit')
        .then(res => res.json())
        .then(data => {
            if (document.getElementById('userLimitUsed')) document.getElementById('userLimitUsed').textContent = data.limitUsed || 0;
            if (document.getElementById('userLimitMax')) document.getElementById('userLimitMax').textContent = data.maxLimit || 100;
        })
        .catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initDigitalClock();
    setLanguage(localStorage.getItem('lang') || 'id');
    
    const bioMenuBtn = document.getElementById('bioMenuBtn');
    const bioDropdown = document.getElementById('bioDropdown');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const menuOverlay = document.getElementById('menuOverlay');

    if (bioMenuBtn && bioDropdown && menuOverlay) {
        bioMenuBtn.addEventListener('click', () => {
            bioDropdown.style.transform = 'translateX(0)';
            menuOverlay.classList.remove('hidden');
        });
        closeMenuBtn?.addEventListener('click', closeSidebarMenu);
        menuOverlay.addEventListener('click', closeSidebarMenu);
    }

    fetch('/api/apilist')
        .then(res => res.json())
        .then(data => {
            apiData = data;
            loadApis();
        });
});

if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);


let searchTimeout;
const searchInputEl = document.getElementById('searchInput');
if (searchInputEl) {
    searchInputEl.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 150);
    });
}
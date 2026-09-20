const BASE_URL = window.location.origin;
let isRequestInProgress = false;
let apiData = null;
let currentTheme = 'dark';
let currentLang = 'id';
let allApiElements = [];
let totalEndpoints = 0;
let totalCategories = 0;
let activeCategory = 'all';

const dotColors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-400', 
    'bg-rose-500', 'bg-cyan-400', 'bg-purple-500', 'bg-pink-500'
];

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

const SVG_PLUS = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>`;
const SVG_MINUS = `<svg class="w-4 h-4 transform rotate-180" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>`;

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

function closeSidebarMenu() {
    const bioDropdown = document.getElementById('bioDropdown');
    const menuOverlay = document.getElementById('menuOverlay');
    if (bioDropdown && menuOverlay) {
        bioDropdown.style.transform = 'translateX(-100%)';
        menuOverlay.classList.add('hidden');
    }
}

function createMediaPreview(url, contentType, fullPath) {
    const type = contentType || '';
    if (type.startsWith('image/') || url.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
        return `<div class="w-full flex justify-center bg-black/40 p-2 rounded-xl border border-slate-800"><img src="${url}" class="media-image w-full h-auto max-h-[80vh] rounded-lg object-contain cursor-pointer" alt="Preview"></div>`;
    } else if (type.startsWith('video/') || url.match(/\.(mp4|webm|mov)/i)) {
        return `<div class="w-full bg-black/40 p-2 rounded-xl border border-slate-800"><video src="${url}" controls autoplay loop playsinline class="w-full h-auto max-h-[85vh] rounded-lg object-contain bg-black"></video></div>`;
    } else if (type.startsWith('audio/') || url.match(/\.(mp3|wav|ogg)/i)) {
        return `<div class="mt-2 bg-black/40 p-3 rounded-lg border border-slate-800"><audio src="${url}" controls autoplay class="w-full"></audio></div>`;
    }
    return `<div class="mt-2 p-3 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs break-all border border-cyan-500/20">Media URL: <a href="${url}" target="_blank" class="underline">${url}</a></div>`;
}

function showToast(message, isError = false) {
    const container = document.getElementById('toast');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `px-4 py-2.5 rounded-xl border font-mono text-xs shadow-lg transition-all duration-300 ${isError ? 'bg-red-950/90 text-red-400 border-red-500/50' : 'bg-slate-900/90 text-cyan-400 border-cyan-500/50'}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function copyText(text, type = 'path') {
    navigator.clipboard.writeText(text).then(() => showToast(`${type} berhasil disalin!`)).catch(() => showToast('Gagal menyalin text', true));
}

function copyFromElement(elementId, type) {
    const el = document.getElementById(elementId);
    if (el) copyText(el.innerText || el.textContent, type);
}

function updateLivePreview(catIdx, epIdx, method, basePath, endpointType) {
    const form = document.getElementById(`form-${catIdx}-${epIdx}`);
    if (!form) return;
    const formData = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
        if (value && typeof value === 'string') params.append(key, value);
    }
    const queryStr = params.toString();
    const finalUrl = queryStr ? `${BASE_URL}${basePath}?${queryStr}` : `${BASE_URL}${basePath}`;

    const urlContainer = document.getElementById(`live-url-${catIdx}-${epIdx}`);
    const curlContainer = document.getElementById(`live-curl-${catIdx}-${epIdx}`);
    if (urlContainer) urlContainer.textContent = finalUrl;
    if (curlContainer) curlContainer.textContent = `curl -X ${method} "${finalUrl}"`;
}

async function executeRequest(e, catIdx, epIdx, method, path, endpointType) {
    e.preventDefault();
    if (isRequestInProgress) {
        showToast("Tunggu request sebelumnya selesai", true);
        return;
    }

    const form = document.getElementById(`form-${catIdx}-${epIdx}`);
    const responseDiv = document.getElementById(`response-${catIdx}-${epIdx}`);
    const responseContent = document.getElementById(`response-content-${catIdx}-${epIdx}`);
    const executeBtn = form.querySelector('button[type="submit"]');

    isRequestInProgress = true;
    executeBtn.disabled = true;
    responseDiv.classList.remove('hidden');

    responseContent.innerHTML = `<div class="p-4 text-center font-mono text-xs text-cyan-400">Loading Response...</div>`;

    const rawFormData = new FormData(form);
    const queryParams = new URLSearchParams();
    let fullPath = `${BASE_URL}${path.split('?')[0]}`;

    if (method === 'GET' || method === 'DELETE') {
        for (const [key, value] of rawFormData.entries()) {
            if (value && typeof value === 'string') queryParams.append(key, value);
        }
        const qStr = queryParams.toString();
        if (qStr) fullPath += '?' + qStr;
    }

    try {
        const response = await fetch(fullPath, { method });
        const contentType = response.headers.get("content-type") || "";
        
        if (contentType.includes("application/json")) {
            const data = await response.json();
            responseContent.innerHTML = `<pre class="p-3 text-xs font-mono text-cyan-400 bg-slate-950 rounded-lg overflow-x-auto"><code>${JSON.stringify(data, null, 2)}</code></pre>`;
        } else {
            const text = await response.text();
            responseContent.innerHTML = `<pre class="p-3 text-xs font-mono text-slate-300 bg-slate-950 rounded-lg overflow-x-auto"><code>${text}</code></pre>`;
        }
        showToast("Request Sukses!");
    } catch (err) {
        responseContent.innerHTML = `<div class="p-3 text-xs font-mono text-red-400 bg-red-950/40 rounded-lg">Error: ${err.message}</div>`;
        showToast("Request Gagal", true);
    } finally {
        isRequestInProgress = false;
        executeBtn.disabled = false;
    }
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
    let html = `<button class="filter-btn active" onclick="filterByCategory('all')">SEMUA (${totalEndpoints})</button>`;
    apiData.categories.forEach(category => {
        const catName = category.name.toLowerCase();
        html += `<button class="filter-btn" onclick="filterByCategory('${catName}')">${catName} (${category.items.length})</button>`;
    });
    container.innerHTML = html;
}

function filterByCategory(catName) {
    activeCategory = catName;
    performSearch();
}

function performSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const noResults = document.getElementById('noResults');
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
            if (matches) {
                item.classList.remove('hidden');
                categoryHasVisibleItems = true;
                hasVisibleItems = true;
            } else {
                item.classList.add('hidden');
            }
        });
        category.classList.toggle('hidden', !categoryHasVisibleItems);
    });
    if (noResults) noResults.classList.toggle('hidden', hasVisibleItems);
}

function loadApis() {
    const apiList = document.getElementById('apiList');
    if (!apiData || !apiData.categories) return;

    totalEndpoints = 0;
    totalCategories = apiData.categories.length;
    apiData.categories.forEach(category => { totalEndpoints += category.items.length; });

    const totalEndpointsEl = document.getElementById('totalEndpoints');
    const navEndpointCount = document.getElementById('navEndpointCount');
    if (totalEndpointsEl) totalEndpointsEl.textContent = totalEndpoints;
    if (navEndpointCount) navEndpointCount.textContent = `${totalEndpoints} Endpoint`;

    renderCategoryFilters();

    let html = '';
    apiData.categories.forEach((category, catIdx) => {
        const catNameLower = category.name.toLowerCase();
        const dotColor = dotColors[catIdx % dotColors.length];

        html += `
        <div class="category-group" data-category="${catNameLower}">
            <div class="style-category-card mb-2">
                <button onclick="toggleCategory(${catIdx})" class="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                    <div class="flex items-center gap-3">
                        <span class="w-2.5 h-2.5 rounded-full ${dotColor}"></span>
                        <h3 class="font-bold text-sm tracking-wide text-white uppercase font-mono">${category.name}</h3>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-slate-400 font-mono">${category.items.length}</span>
                        <svg id="cat-icon-${catIdx}" class="w-4 h-4 text-slate-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </div>
                </button>
                <div id="cat-${catIdx}" class="hidden border-t border-slate-800 bg-[#050b14]">`;

        category.items.forEach((item, epIdx) => {
            const method = item.methods && item.methods.length ? item.methods[0] : 'GET';
            const path = item.path.split('?')[0];

            html += `
            <div class="api-item border-b border-slate-800/80 last:border-0 hover:bg-slate-900/40 transition-colors" 
                data-method="${method}" data-path="${path}" data-alias="${item.name.toLowerCase()}" data-description="${item.desc.toLowerCase()}">
                <button onclick="toggleEndpoint(${catIdx}, ${epIdx})" class="w-full px-4 py-3 flex items-center justify-between text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded text-[10px] font-bold code-font">${method}</span>
                        <div class="min-w-0">
                            <p class="font-bold text-xs text-slate-200 truncate">${item.name}</p>
                            <p class="code-font text-[11px] text-slate-400 truncate">${path}</p>
                        </div>
                    </div>
                    <span id="ep-icon-${catIdx}-${epIdx}" class="text-slate-400 px-1">
                        ${SVG_PLUS}
                    </span>
                </button>
                <div id="ep-${catIdx}-${epIdx}" class="hidden px-4 py-3 bg-[#030710] border-t border-slate-800 font-mono">
                    <p class="text-xs text-slate-400 mb-3">${item.desc}</p>
                    
                    <div class="mb-3">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-[10px] text-slate-500 uppercase">Request URL</span>
                            <button onclick="copyFromElement('live-url-${catIdx}-${epIdx}', 'URL')" class="text-[10px] text-cyan-400 hover:underline">Copy</button>
                        </div>
                        <code id="live-url-${catIdx}-${epIdx}" class="block p-2 bg-slate-950 rounded border border-slate-800 text-xs text-cyan-400 break-all">${BASE_URL}${path}</code>
                    </div>

                    <form id="form-${catIdx}-${epIdx}" onsubmit="executeRequest(event, ${catIdx}, ${epIdx}, '${method}', '${path}')">
                        <div class="space-y-3 mb-3">`;

            if (item.params) {
                Object.keys(item.params).forEach(paramName => {
                    html += `
                    <div>
                        <label class="block text-[11px] text-slate-300 mb-1">${paramName}</label>
                        <input type="text" name="${paramName}" oninput="updateLivePreview(${catIdx}, ${epIdx}, '${method}', '${path}')" class="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono" placeholder="Masukkan ${paramName}">
                    </div>`;
                });
            }

            html += `
                        </div>
                        <div class="flex gap-2">
                            <button type="submit" class="px-4 py-1.5 bg-cyan-400 text-slate-950 rounded font-bold text-xs">EKSEKUSI</button>
                            <button type="button" onclick="clearResponse(${catIdx}, ${epIdx})" class="px-4 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded font-bold text-xs">BERSIHKAN</button>
                        </div>
                    </form>

                    <div id="response-${catIdx}-${epIdx}" class="hidden mt-3">
                        <div id="response-content-${catIdx}-${epIdx}"></div>
                    </div>
                </div>
            </div>`;
        });
        html += `</div></div></div>`;
    });
    apiList.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
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
    }

    const searchInputEl = document.getElementById('searchInput');
    if (searchInputEl) {
        searchInputEl.addEventListener('input', performSearch);
    }

    fetch('/api/apilist')
        .then(res => res.json())
        .then(data => {
            apiData = data;
            loadApis();
        });
});

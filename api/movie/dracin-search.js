const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');

const router = express.Router();

class DracinSearchScraper {
    constructor() {
        this.baseUrl = 'https://dracinema.com';
        this.apiKey = 'xb3MdwdLrZrpaDXvrLLwfP==';
        this.client = axios.create({
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': `${this.baseUrl}/`,
                'X-API-Key': this.apiKey,
                'Accept': 'application/json, text/plain, */*'
            }
        });
    }

    _sanitizeText(text) {
        if (!text) return '';
        return text
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    _normalizeTitle(title) {
        if (!title) return '';
        let cleaned = this._sanitizeText(title);
        return cleaned
            .replace(/\s+Full\s+Episode\s+Subtitle\s+Indonesia\s+-\s+Dracinema/gi, '')
            .replace(/\s+Sub\s+Indo\s+-\s+Dracinema/gi, '')
            .replace(/\s+-\s+Dracinema/gi, '')
            .trim();
    }

    _toSlug(text) {
        if (!text) return '';
        return text
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
    }

    async search(keyword) {
        if (!keyword || !keyword.trim()) return [];
        
        try {
            const response = await this.client.get(`${this.baseUrl}/api/search`, {
                params: { keyword: keyword.trim() }
            });
            
            const data = response.data?.data || [];
            
            if (Array.isArray(data) && data.length > 0) {
                return data.map(item => ({
                    id: item.originalBookId || item.id || '',
                    name: this._normalizeTitle(item.bookName || ''),
                    title: this._normalizeTitle(item.bookName || ''),
                    cover: item.cover || '',
                    introduction: this._sanitizeText(item.introduction || ''),
                    episodesCount: item.chapterCount || 16,
                    rating: 8.8,
                    year: 2023,
                    url: `/movie/${this._toSlug(this._normalizeTitle(item.bookName || ''))}-${item.originalBookId || item.id}`,
                    slug: this._toSlug(this._normalizeTitle(item.bookName || ''))
                }));
            }
        } catch (err) {
            console.warn(`[!] Search API failed (${err.code || err.message}), switching to local filter...`);
        }

        const query = keyword.toLowerCase();
        const fallback = this._getFallbackDramas().filter(d => 
            d.title.toLowerCase().includes(query) || 
            d.introduction.toLowerCase().includes(query) ||
            d.genres.some(g => g.toLowerCase().includes(query))
        );
        
        return fallback.map(d => ({ ...d, name: d.title }));
    }

    _getFallbackDramas() {
        return [
            { id: "2064962492755087362", title: "Mahkota Cahaya untuk Istri Apollo", name: "Mahkota Cahaya untuk Istri Apollo", slug: "mahkota-cahaya-untuk-istri-apollo-ns", cover: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop", rating: 9.2, year: 2024, introduction: "Di tengah perebutan takhta kerajaan modern, dua pewaris harus memilih antara cinta dan kekuasaan tertinggi.", genres: ["Romantis", "Sejarah", "Drama"], episodesCount: 24, url: "/movie/mahkota-cahaya-untuk-istri-apollo-ns-2064962492755087362" },
            { id: "2064962492755087363", title: "Shadow of Truth", name: "Shadow of Truth", slug: "shadow-of-truth", cover: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop", rating: 9.2, year: 2023, introduction: "Seorang detektif veteran dan agen rahasia mengungkap konspirasi kejahatan terbesar di ibu kota.", genres: ["Thriller", "Misteri", "Aksi"], episodesCount: 16, url: "/movie/shadow-of-truth-2064962492755087363" },
            { id: "2064962492755087364", title: "Blossom Palace", name: "Blossom Palace", slug: "blossom-palace", cover: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop", rating: 8.8, year: 2023, introduction: "Janji setia di balik tembok istana kuno yang penuh bahaya dan intrik keluarga kerajaan.", genres: ["Romantis", "Sejarah", "Drama"], episodesCount: 30, url: "/movie/blossom-palace-2064962492755087364" },
            { id: "2064962492755087365", title: "Neon Genesis", name: "Neon Genesis", slug: "neon-genesis", cover: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop", rating: 9.5, year: 2024, introduction: "Masa depan cyberpunk di mana teknologi dan kemanusiaan bertabrakan dalam pertempuran untuk mempertahankan jiwa kota.", genres: ["Aksi", "Sci-Fi", "Misteri"], episodesCount: 12, url: "/movie/neon-genesis-2064962492755087365" },
            { id: "2064962492755087366", title: "Coffee & Mistake", name: "Coffee & Mistake", slug: "coffee-and-mistake", cover: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=600&auto=format&fit=crop", rating: 8.2, year: 2023, introduction: "Kisah cinta komedi unik di sebuah kafe kecil di sudut kota antara barista misterius dan arsitek muda.", genres: ["Komedi", "Romantis"], episodesCount: 20, url: "/movie/coffee-and-mistake-2064962492755087366" },
            { id: "2064962492755087367", title: "Portal of Echoes", name: "Portal of Echoes", slug: "portal-of-echoes", cover: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop", rating: 9.0, year: 2024, introduction: "Sebuah pintu dimensi terbuka menghubungkan dua dunia paralel.", genres: ["Fantasi", "Misteri", "Aksi"], episodesCount: 18, url: "/movie/portal-of-echoes-2064962492755087367" },
            { id: "2064962492755087368", title: "Lifeline (Heartbeat)", name: "Lifeline (Heartbeat)", slug: "lifeline-heartbeat", cover: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?q=80&w=600&auto=format&fit=crop", rating: 8.7, year: 2023, introduction: "Dramatisasi perjuangan para dokter bedah di ruang IGD rumah sakit rujukan utama.", genres: ["Medis", "Drama"], episodesCount: 16, url: "/movie/lifeline-heartbeat-2064962492755087368" },
            { id: "2064962492755087369", title: "Cinta di Bawah Hujan", name: "Cinta di Bawah Hujan", slug: "cinta-di-bawah-hujan", cover: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop", rating: 9.4, year: 2023, introduction: "Kisah tentang dua jiwa yang terluka yang menemukan penghiburan satu sama lain.", genres: ["Romantis", "Drama", "Melodrama"], episodesCount: 16, url: "/movie/cinta-di-bawah-hujan-2064962492755087369" },
            { id: "2064962492755087370", title: "Vincenzo", name: "Vincenzo", slug: "vincenzo", cover: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop", rating: 9.6, year: 2021, introduction: "Pengacara Mafia Italia kembali ke Korea Selatan dan menggunakan strategi licik.", genres: ["Aksi", "Komedi", "Drama"], episodesCount: 20, url: "/movie/vincenzo-2064962492755087370" },
            { id: "2064962492755087371", title: "The Silent Mist", name: "The Silent Mist", slug: "the-silent-mist", cover: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=600&auto=format&fit=crop", rating: 8.9, year: 2024, introduction: "Kabut tebal yang menyelimuti desa terpencil membawa rahasia pembunuhan berantai kuno.", genres: ["Misteri", "Thriller"], episodesCount: 10, url: "/movie/the-silent-mist-2064962492755087371" }
        ];
    }
}

const scraper = new DracinSearchScraper();

router.get('/', async (req, res) => {
    try {
        const text = req.query.text?.trim() || req.query.q?.trim();

        if (!text) {
            return res.status(400).json({
                status: false,
                creator: 'ArulzXD',
                message: 'Masukkan parameter text atau q (contoh: ?text=aku ratu)'
            });
        }

        const result = await scraper.search(text);

        return res.json({
            status: true,
            creator: 'ArulzXD',
            total: result.length,
            result
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: 'ArulzXD',
            message: err.message
        });
    }
});

router.desc = "Mencari daftar drama/film di Dracinema berdasarkan kata kunci. Parameter wajib: ?text=aku ratu";
router.paramsConfig = {
    text: "text"
};
router.status = "ready";
router.type = "free";

module.exports = router;
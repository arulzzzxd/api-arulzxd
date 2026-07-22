const axios = require("axios");
const cheerio = require("cheerio");
const express = require("express");
const router = express.Router();

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  Referer: "https://www.jadwalsholat.org/"
};

// ==========================================================
// INTERNAL HELPER: Ambil ID Kota Terdekat dari Teks Nama Kota
// ==========================================================
async function getInternalCityId(cityName) {
  try {
    const targetUrl = "https://www.jadwalsholat.org/adzan/monthly.php";
    const { data } = await axios.get(targetUrl, { headers, validateStatus: () => true });
    const $ = cheerio.load(data);
    
    let exactId = null;
    let fallbackId = null;

    $("select option").each((_, el) => {
      const id = $(el).attr("value");
      const name = $(el).text().trim().toLowerCase();
      const searchName = cityName.toLowerCase();

      if (id && /^\d+$/.test(id)) {
        if (name === searchName) {
          exactId = id; // Ketemu yang sama persis
          return false; // Break loop
        } else if (name.includes(searchName) && !fallbackId) {
          fallbackId = id; // Ketemu yang mirip (contoh: "yogyakarta")
        }
      }
    });

    return exactId || fallbackId;
  } catch (e) {
    return null;
  }
}

// ===============================
// FUNCTION SCRAPER UTAMA
// ===============================
async function JHJadwalSholat(input) {
  /*
  - HARGAI WOY JANGAN DIHAPUS!
  - Skrep by *JH a.k.a DHIKA - FIONY BOT*
  - Credits to all Fiony's Bot Admin. 
  */
  const baseRes = { 
    creator: "Arulzxd",
    author_skrep: "JH a.k.a Dhika", 
    kesayangan: "Fiony Alveria" 
  };

  try {
    let idKota = input;

    // JIKA INPUT BUKAN ANGKA (BERUPA TEKS NAMA KOTA)
    if (isNaN(input)) {
      const foundId = await getInternalCityId(input);
      if (!foundId) throw new Error(`Kota '${input}' tidak ditemukan di database!`);
      idKota = foundId;
    }

    // Bersihkan karakter non-angka untuk pengaman
    idKota = String(idKota).replace(/\D/g, "") || "309";
    const targetUrl = `https://www.jadwalsholat.org/adzan/monthly.php?id=${idKota}`;
    
    const { data } = await axios.get(targetUrl, { headers, validateStatus: () => true });
    const $ = cheerio.load(data);

    // AMBIL NAMA KOTA DARI HALAMAN
    const kota = $("h1").first().text().replace(/Jadwal Sholat untuk|Jadwal Imsyakiyah|,/g, "").trim() || "Tidak diketahui";
    const results = [];
    let todayData = null;

    const tglHariIni = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    const hariIniNum = new Date(tglHariIni).getDate();

    $("tr").each((_, el) => {
      const tds = $(el).find("td");
      if (tds.length > 0) {
        const rawTexts = tds.map((i, col) => {
          $(col).find("br").replaceWith(" ");
          return $(col).text().replace(/\s+/g, " ").trim();
        }).get();

        const times = rawTexts.filter(x => /\d{2}:\d{2}/.test(x));

        if (times.length >= 6) {
          const dateStr = rawTexts[0];
          let masehi = dateStr;
          let hijriyah = "-";

          const regexTgl = /^(\d{2})(\d{2}\s+[a-zA-Z\s\']+.*)$/;
          if (regexTgl.test(dateStr)) {
            const matchVal = dateStr.match(regexTgl);
            masehi = matchVal[1];
            hijriyah = matchVal[2];
          } else {
            const spl = dateStr.split(" ");
            if (spl.length > 1 && !isNaN(spl[0])) {
              masehi = spl[0];
              hijriyah = spl.slice(1).join(" ");
            }
          }

          const jadwal = {
            tanggal_masehi: masehi,
            tanggal_hijriyah: hijriyah,
            imsyak: times[0] || "-",
            shubuh: times[1] || "-",
            terbit: times[2] || "-",
            dhuha: times[3] || "-",
            dzuhur: times[4] || "-",
            ashr: times[5] || "-",
            maghrib: times[6] || "-",
            isya: times[7] || "-"
          };
          results.push(jadwal);

          const trClass = $(el).attr("class") || "";
          if (trClass.includes("highlight") || Number(masehi.replace(/\D/g, "")) === hariIniNum) {
             todayData = jadwal;
          }
        }
      }
    });

    if (results.length === 0) throw new Error("Data jadwal kosong! Struktur HTML web jadwalsholat berubah.");

    if (!todayData) todayData = results[results.length - 1];

    return { 
      ...baseRes, 
      status: true, 
      mode: "hari_ini", 
      target_id: idKota, 
      kota: `Jadwal Sholat ${kota}`, 
      data: todayData 
    };

  } catch (e) {
    return { 
      status: false, 
      creator: "Arulzxd", 
      error: e.message || String(e) 
    };
  }
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    const query = req.query.query;

    if (!query) {
        return res.status(400).json({
            status: false,
            creator: "Arulzxd",
            message: "Parameter 'query' wajib diisi! Contoh: ?query=yogyakarta atau ?query=307",
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = await JHJadwalSholat(query);
        
        if (!result.status) {
            return res.status(400).json({
                ...result,
                timestamp: new Date().toISOString()
            });
        }

        return res.status(200).json({
            ...result,
            metadata: {
                source: "JadwalSholat Org Engine",
                engine_mode: "auto_detect (hari_ini)",
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: error.message || "Terjadi kesalahan server internal",
            timestamp: new Date().toISOString()
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
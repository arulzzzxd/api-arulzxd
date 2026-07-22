const express = require("express");
const axios = require("axios");

const router = express.Router();

// 1. Fungsi Helper untuk menerjemahkan Weather Code Open-Meteo ke Teks Bahasa Indonesia
function getWeatherDescription(code) {
    const weatherMap = {
        0: "Cerah Sempurna",
        1: "Cerah Berawan",
        2: "Berawan Sebagian",
        3: "Berawan Tebal / Mendung",
        45: "Kabut",
        48: "Kabut Rime Deposisi",
        51: "Gerimis Ringan",
        53: "Gerimis Sedang",
        55: "Gerimis Padat/Lebat",
        61: "Hujan Ringan",
        63: "Hujan Sedang",
        65: "Hujan Lebat",
        71: "Hujan Salju Ringan",
        73: "Hujan Salju Sedang",
        75: "Hujan Salju Lebat",
        80: "Hujan Pancaroba / Ringan Terputus-putus",
        81: "Hujan Deras / Sedang",
        82: "Hujan Badai Sangat Lebat",
        95: "Badai Petir Ringan/Sedang",
        96: "Badai Petir disertai Hujan Es Ringan",
        99: "Badai Petir disertai Hujan Es Padat"
    };
    return weatherMap[code] || "Cuaca Tidak Diketahui";
}

// 2. Fungsi Helper untuk mengubah Celcius (°C) ke Fahrenheit (°F)
function celsiusToFahrenheit(celsius) {
    return parseFloat(((celsius * 9) / 5 + 32).toFixed(1));
}

// --- ENDPOINT ROUTE ---
router.get("/", async (req, res) => {
    try {
        const kota = req.query.kota;
        const lang = req.query.lang || "id";

        if (!kota) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Parameter 'kota' diperlukan.",
                example: "/api/search/cuaca?kota=Jakarta&lang=id"
            });
        }

        // Fetch Data Geocoding Lokasi Kota
        const geo = await axios.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            {
                params: {
                    name: kota,
                    count: 1,
                    language: lang,
                    format: "json"
                }
            }
        );

        if (!geo.data.results || !geo.data.results.length) {
            return res.status(404).json({
                status: false,
                creator: "ArulzXD",
                message: "Kota tidak ditemukan."
            });
        }

        const city = geo.data.results[0];

        // Fetch Data Prakiraan Cuaca Mentah
        const weather = await axios.get(
            "https://api.open-meteo.com/v1/forecast",
            {
                params: {
                    latitude: city.latitude,
                    longitude: city.longitude,
                    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
                    timezone: "auto"
                }
            }
        );

        const rawCuaca = weather.data.current;
        const tempC = rawCuaca.temperature_2m;
        const feelsLikeC = rawCuaca.apparent_temperature;

        // Formatisasi data akhir agar lebih jelas dan mudah dibaca
        res.json({
            status: true,
            creator: "ArulzXD",
            result: {
                kota: city.name,
                negara: city.country,
                provinsi: city.admin1 || "",
                latitude: city.latitude,
                longitude: city.longitude,
                timezone: weather.data.timezone,
                waktu_pantau: rawCuaca.time,
                kondisi_cuaca: {
                    teks: getWeatherDescription(rawCuaca.weather_code),
                    kode: rawCuaca.weather_code,
                    waktu: rawCuaca.is_day === 1 ? "Siang Hari" : "Malam Hari"
                },
                suhu: {
                    celcius: `${tempC}°C`,
                    fahrenheit: `${celsiusToFahrenheit(tempC)}°F`,
                    sensasi_tubuh_celcius: `${feelsLikeC}°C`,
                    sensasi_tubuh_fahrenheit: `${celsiusToFahrenheit(feelsLikeC)}°F`
                },
                kelembaban: `${rawCuaca.relative_humidity_2m}%`,
                hujan: {
                    curah_hujan: `${rawCuaca.precipitation} mm`,
                    status_hujan: rawCuaca.precipitation > 0 ? "Sedang Turun Hujan" : "Tidak Hujan"
                },
                angin: {
                    kecepatan: `${rawCuaca.wind_speed_10m} km/h`,
                    arah_derajat: `${rawCuaca.wind_direction_10m}°`
                }
            }
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.message
        });
    }
});

// --- CONFIG DROPDOWN SELECT ---
router.paramsConfig = {
    lang: {
        type: "select",
        options: [
            "aa | Afar", "ab | Abkhazian", "ae | Avestan", "af | Afrikaans", "ak | Akan", "am | Amharic", 
            "an | Aragonese", "ar | Arabic", "as | Assamese", "av | Avaric", "ay | Aymara", "az | Azerbaijani", 
            "ba | Bashkir", "be | Belarusian", "bg | Bulgarian", "bh | Bihari", "bi | Bislama", "bm | Bambara", 
            "bn | Bengali", "bo | Tibetan", "br | Breton", "bs | Bosnian", "ca | Catalan", "ce | Chechen", 
            "ch | Chamorro", "co | Corsican", "cr | Cree", "cs | Czech", "cu | Church Slavic", "cv | Chuvash", 
            "cy | Welsh", "da | Danish", "de | German", "dv | Maldivian", "dz | Dzongkha", "ee | Ewe", 
            "el | Greek", "en | English", "eo | Esperanto", "es | Spanish", "et | Estonian", "eu | Basque", 
            "fa | Persian", "ff | Fulah", "fi | Finnish", "fj | Fijian", "fo | Faroese", "fr | French", 
            "fy | Western Frisian", "ga | Irish", "gd | Gaelic", "gl | Galician", "gn | Guarani", "gu | Gujarati", 
            "gv | Manx", "ha | Hausa", "he | Hebrew", "hi | Hindi", "ho | Hiri Motu", "hr | Croatian", 
            "ht | Haitian", "hu | Hungarian", "hy | Armenian", "hz | Herero", "ia | Interlingua", "id | Indonesian", 
            "ie | Interlingue", "ig | Igbo", "ii | Sichuan Yi", "ik | Inupiaq", "io | Ido", "is | Icelandic", 
            "it | Italian", "iu | Inuktitut", "ja | Japanese", "jv | Javanese", "ka | Georgian", "kg | Kongo", 
            "ki | Kikuyu", "kj | Kuanyama", "kk | Kazakh", "kl | Kalaallisut", "km | Central Khmer", "kn | Kannada", 
            "ko | Korean", "kr | Kanuri", "ks | Kashmiri", "ku | Kurdish", "kv | Komi", "kw | Cornish", 
            "ky | Kirghiz", "la | Latin", "lb | Luxembourgish", "lg | Ganda", "li | Limburgan", "ln | Lingala", 
            "lo | Lao", "lt | Lithuanian", "lu | Luba-Katanga", "lv | Latvian", "mg | Malagasy", "mh | Marshallese", 
            "mi | Maori", "mk | Macedonian", "ml | Malayalam", "mn | Mongolian", "mr | Marathi", "ms | Malay", 
            "mt | Maltese", "my | Burmese", "na | Nauru", "nb | Norwegian Bokmal", "nd | North Ndebele", "ne | Nepali", 
            "ng | Ndonga", "nl | Dutch", "nn | Norwegian Nynorsk", "no | Norwegian", "nr | South Ndebele", "nv | Navajo", 
            "ny | Chichewa", "oc | Occitan", "oj | Ojibwa", "om | Oromo", "or | Oriya", "os | Ossetian", 
            "pa | Panjabi", "pi | Pali", "pl | Polish", "ps | Pushto", "pt | Portuguese", "qu | Quechua", 
            "rm | Romansh", "rn | Rundi", "ro | Romanian", "ru | Russian", "rw | Kinyarwanda", "sa | Sanskrit", 
            "sc | Sardinian", "sd | Sindhi", "se | Northern Sami", "sg | Sango", "si | Sinhala", "sk | Slovak", 
            "sl | Slovenian", "sm | Samoan", "sn | Shona", "so | Somali", "sq | Albanian", "sr | Serbian", 
            "ss | Swati", "st | Sotho, Southern", "su | Sundanese", "sv | Swedish", "sw | Swahili", "ta | Tamil", 
            "te | Telugu", "tg | Tajik", "th | Thai", "ti | Tigrinya", "tk | Turkmen", "tl | Tagalog", 
            "tn | Tswana", "to | Tonga", "tr | Turkish", "ts | Tsonga", "tt | Tatar", "tw | Twi", 
            "ty | Tahitian", "ug | Uighur", "uk | Ukrainian", "ur | Urdu", "uz | Uzbek", "ve | Venda", 
            "vi | Vietnamese", "vo | Volapuk", "wa | Walloon", "wo | Wolof", "xh | Xhosa", "yi | Yiddish", 
            "yo | Yoruba", "za | Zhuang", "zh | Chinese", "zu | Zulu"
        ]
    }
};

router.status = "ready";
router.type = "free";
module.exports = router;

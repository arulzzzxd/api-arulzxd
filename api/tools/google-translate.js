const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { translate, speak } = require("google-translate-api-x");

const router = express.Router();

const OPTIONS = {
    client: "gtx",
    forceBatch: true,
    fallbackBatch: true,
    autoCorrect: true
};

router.get("/", async (req, res) => {
    try {
        const mode = req.query.mode || "text-to-audio";
        const text = req.query.text;
        
        // Memotong string opsi (contoh: "id | Indonesian" menjadi "id")
        const rawFrom = req.query.from || "auto";
        const rawTo = req.query.to || "ja";
        const from = rawFrom.split(' ')[0];
        const to = rawTo.split(' ')[0];

        if (!text) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Parameter text diperlukan."
            });
        }

        const started = Date.now();

        if (mode === "text-to-text") {
            const result = await translate(text, {
                from,
                to,
                ...OPTIONS
            });

            return res.json({
                status: true,
                creator: "ArulzXD",
                mode,
                input: text,
                from: result.from?.language?.iso || from,
                to,
                result: result.text,
                pronunciation: result.pronunciation || null,
                correction: result.from?.text || null,
                time_ms: Date.now() - started
            });
        }

        if (mode === "text-to-audio") {
            const translated = await translate(text, {
                from,
                to,
                ...OPTIONS
            });

            const ttsText = translated.text;

            const audio = await speak(ttsText, {
                to,
                client: "gtx"
            });

            const output = path.join(
                os.tmpdir(),
                `tts-${Date.now()}.mp3`
            );

            fs.writeFileSync(output, audio, {
                encoding: "base64"
            });

            res.setHeader("Content-Type", "audio/mpeg");
            res.setHeader(
                "Content-Disposition",
                "inline; filename=tts.mp3"
            );

            const stream = fs.createReadStream(output);

            stream.pipe(res);

            stream.on("close", () => {
                fs.unlink(output, () => {});
            });

            return;
        }

        res.status(400).json({
            status: false,
            creator: "ArulzXD",
            message: "Mode tidak valid.",
            available_mode: [
                "text-to-text",
                "text-to-audio"
            ]
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.message
        });
    }
});

router.paramsConfig = {
    text: "text", // 👈 Ditambahkan agar muncul input teks di dashboard
    mode: {
        type: "select",
        options: [
            "text-to-text",
            "text-to-audio"
        ]
    },
    from: {
        type: "select",
        options: [
            "auto",
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
    },
    to: {
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

const express = require('express');
const router = express.Router();

// ======================================================
// DATABASE NIAT SHALAT (SENDIRI, IMAM, MAKMUM)
// ======================================================
const databaseNiat = [
    {
        index: 1,
        solat: "subuh",
        sendiri: {
            arabic: "اُصَلِّى فَرْضَ الصُّبْحِ رَكْعَتَيْنِ مُسْتَقْبِلَ الْقِبْلَةِ اَدَاءً ِللهِ تَعَالَى",
            latin: "Ushalli fardhosh shubhi rok'ataini mustaqbilal qiblati adaa-an lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Shubuh dua raka'at menghadap kiblat, tunai karena Allah Ta'ala"
        },
        imam: {
            arabic: "اُصَلِّى فَرْضَ الصُّبْحِ رَكْعَتَيْنِ مُسْتَقْبِلَ الْقِبْلَةِ اِامَامًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhosh shubhi rok'ataini mustaqbilal qiblati imaaman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Shubuh dua raka'at menghadap kiblat, sebagai imam karena Allah Ta'ala"
        },
        makmum: {
            arabic: "اُصَلِّى فَرْضَ الصُّبْحِ رَكْعَتَيْنِ مُسْتَقْبِلَ الْقِبْلَةِ مَأْمُوْمًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhosh shubhi rok'ataini mustaqbilal qiblati ma'muuman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Shubuh dua raka'at menghadap kiblat, sebagai makmum karena Allah Ta'ala"
        }
    },
    {
        index: 2,
        solat: "dzuhur",
        sendiri: {
            arabic: "اُصَلِّى فَرْضَ الظُّهْرِ اَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ اَدَاءً ِللهِ تَعَالَى",
            latin: "Ushalli fardhodl dhuhri arba'a raka'aatim mustaqbilal qiblati adaa-an lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Dzuhur empat raka'at menghadap kiblat, tunai karena Allah Ta'ala"
        },
        imam: {
            arabic: "اُصَلِّى فَرْضَ الظُّهْرِ اَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ اِامَامًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhodl dhuhri arba'a raka'aatim mustaqbilal qiblati imaaman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Dzuhur empat raka'at menghadap kiblat, sebagai imam karena Allah Ta'ala"
        },
        makmum: {
            arabic: "اُصَلِّى فَرْضَ الظُّهْرِ اَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ مَأْمُوْمًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhodl dhuhri arba'a raka'aatim mustaqbilal qiblati ma'muuman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Dzuhur empat raka'at menghadap kiblat, sebagai makmum karena Allah Ta'ala"
        }
    },
    {
        index: 3,
        solat: "ashar",
        sendiri: {
            arabic: "اُصَلِّى فَرْضَ الْعَصْرِ اَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ اَدَاءً ِللهِ تَعَالَى",
            latin: "Ushalli fardhol 'ashri arba'a raka'aatim mustaqbilal qiblati adaa-an lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu 'Ashar empat raka'at menghadap kiblat, tunai karena Allah Ta'ala"
        },
        imam: {
            arabic: "اُصَلِّى فَرْضَ الْعَصْرِ اَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ اِامَامًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhol 'ashri arba'a raka'aatim mustaqbilal qiblati imaaman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu 'Ashar empat raka'at menghadap kiblat, sebagai imam karena Allah Ta'ala"
        },
        makmum: {
            arabic: "اُصَلِّى فَرْضَ الْعَصْرِ اَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ مَأْمُوْمًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhol 'ashri arba'a raka'aatim mustaqbilal qiblati ma'muuman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu 'Ashar empat raka'at menghadap kiblat, sebagai makmum karena Allah Ta'ala"
        }
    },
    {
        index: 4,
        solat: "maghrib",
        sendiri: {
            arabic: "اُصَلِّى فَرْضَ الْمَغْرِبِ ثَلاَثَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ اَدَاءً ِللهِ تَعَالَى",
            latin: "Ushalli fardhol maghribi tsalaata raka'aatim mustaqbilal qiblati adaa-an lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Maghrib tiga raka'at menghadap kiblat, tunai karena Allah Ta'ala"
        },
        imam: {
            arabic: "اُصَلِّى فَرْضَ الْمَغْرِبِ ثَلاَثَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ اِامَامًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhol maghribi tsalaata raka'aatim mustaqbilal qiblati imaaman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Maghrib tiga raka'at menghadap kiblat, sebagai imam karena Allah Ta'ala"
        },
        makmum: {
            arabic: "اُصَلِّى فَرْضَ الْمَغْرِبِ ثَلاَثَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ مَأْمُوْمًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhol maghribi tsalaata raka'aatim mustaqbilal qiblati ma'muuman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Maghrib tiga raka'at menghadap kiblat, sebagai makmum karena Allah Ta'ala"
        }
    },
    {
        index: 5,
        solat: "isha",
        sendiri: {
            arabic: "اُصَلِّى فَرْضَ الْعِشَاءِ اَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ اَدَاءً ِللهِ تَعَالَى",
            latin: "Ushalli fardhol 'isyaa-i arba'a raka'aatim mustaqbilal qiblati adaa-an lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Isya empat raka'at menghadap kiblat, tunai karena Allah Ta'ala"
        },
        imam: {
            arabic: "اُصَلِّى فَرْضَ الْعِشَاءِ اَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ اِامَامًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhol 'isyaa-i arba'a raka'aatim mustaqbilal qiblati imaaman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Isya empat raka'at menghadap kiblat, sebagai imam karena Allah Ta'ala"
        },
        makmum: {
            arabic: "اُصَلِّى فَرْضَ الْعِشَاءِ اَرْبَعَ رَكَعَاتٍ مُسْتَقْبِلَ الْقِبْلَةِ مَأْمُوْمًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhol 'isyaa-i arba'a raka'aatim mustaqbilal qiblati ma'muuman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Isya empat raka'at menghadap kiblat, sebagai makmum karena Allah Ta'ala"
        }
    },
    {
        index: 6,
        solat: "jumat",
        sendiri: null, // Shalat Jumat wajib berjamaah
        imam: {
            arabic: "اُصَلِّى فَرْضَ الْجُمُعَةِ رَكْعَتَيْنِ مُسْتَقْبِلَ الْقِبْلَةِ اِامَامًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhol jumu'ati rok'ataini mustaqbilal qiblati imaaman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Jumat dua raka'at menghadap kiblat, sebagai imam karena Allah Ta'ala"
        },
        makmum: {
            arabic: "اُصَلِّى فَرْضَ الْجُمُعَةِ رَكْعَتَيْنِ مُسْتَقْبِلَ الْقِبْلَةِ مَأْمُوْمًا ِللهِ تَعَالَى",
            latin: "Ushalli fardhol jumu'ati rok'ataini mustaqbilal qiblati ma'muuman lillaahi ta'aala",
            translation: "Aku berniat shalat fardhu Jumat dua raka'at menghadap kiblat, sebagai makmum karena Allah Ta'ala"
        }
    }
];

// ======================================================
// ENDPOINT DIRECT JSON RESPONSE
// ======================================================
router.get('/', (req, res) => {
    return res.status(200).json({
        status: true,
        creator: 'Arulzxd',
        result: databaseNiat,
        metadata: {
            total_data: databaseNiat.length,
            timestamp: new Date().toISOString()
        }
    });
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
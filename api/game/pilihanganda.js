/**
 * NAMA SCRAPE  :: RANDOM QUIZ / TRIVIA QUESTION
 * [•] BASIS        :: Local Quiz Dataset
 */

const express = require('express');
const router = express.Router();

const questions = [
  {
    "id": 1,
    "category": "Biology",
    "question": "Organel sel penghasil energi adalah?",
    "options": {
      "a": "Ribosom",
      "b": "Mitokondria",
      "c": "Lisosom",
      "d": "Nukleus"
    },
    "answer": "b"
  },
  {
    "id": 2,
    "category": "Biology",
    "question": "Fotosintesis membutuhkan cahaya dan?",
    "options": {
      "a": "Oksigen",
      "b": "Nitrogen",
      "c": "Karbon dioksida",
      "d": "Hidrogen"
    },
    "answer": "c"
  },
  {
    "id": 3,
    "category": "Biology",
    "question": "Makhluk hidup terkecil adalah?",
    "options": {
      "a": "Bakteri",
      "b": "Virus",
      "c": "Protozoa",
      "d": "Jamur"
    },
    "answer": "b"
  },
  {
    "id": 4,
    "category": "Coding",
    "question": "Tipe data boolean bernilai?",
    "options": {
      "a": "0 dan 1",
      "b": "Ya dan Tidak",
      "c": "True dan False",
      "d": "On dan Off"
    },
    "answer": "c"
  },
  {
    "id": 5,
    "category": "Coding",
    "question": "Perintah untuk deklarasi variabel di JS modern?",
    "options": {
      "a": "var",
      "b": "int",
      "c": "let",
      "d": "define"
    },
    "answer": "c"
  },
  {
    "id": 6,
    "category": "Coding",
    "question": "Async/await digunakan untuk?",
    "options": {
      "a": "Loop",
      "b": "Asynchronous code",
      "c": "Debug",
      "d": "Styling"
    },
    "answer": "b"
  },
  {
    "id": 7,
    "category": "Programming",
    "question": "Function digunakan untuk?",
    "options": {
      "a": "Menyimpan data",
      "b": "Mengulang kode",
      "c": "Menjalankan perintah berulang",
      "d": "Membuat server"
    },
    "answer": "b"
  },
  {
    "id": 8,
    "category": "Programming",
    "question": "Bahasa backend populer?",
    "options": {
      "a": "HTML",
      "b": "CSS",
      "c": "JavaScript",
      "d": "Photoshop"
    },
    "answer": "c"
  },
  {
    "id": 9,
    "category": "Math",
    "question": "25% dari 200 adalah?",
    "options": {
      "a": "25",
      "b": "50",
      "c": "75",
      "d": "100"
    },
    "answer": "b"
  },
  {
    "id": 10,
    "category": "Math",
    "question": "Akar dari 144?",
    "options": {
      "a": "10",
      "b": "11",
      "c": "12",
      "d": "14"
    },
    "answer": "c"
  },
  {
    "id": 11,
    "category": "Logic",
    "question": "Jika semua A adalah B, dan semua B adalah C, maka?",
    "options": {
      "a": "Semua C adalah A",
      "b": "Semua A adalah C",
      "c": "Semua B adalah A",
      "d": "Tidak bisa disimpulkan"
    },
    "answer": "b"
  },
  {
    "id": 12,
    "category": "Logic",
    "question": "3, 6, 12, 24, ...?",
    "options": {
      "a": "30",
      "b": "36",
      "c": "48",
      "d": "60"
    },
    "answer": "c"
  },
  {
    "id": 13,
    "category": "Technology",
    "question": "AI singkatan dari?",
    "options": {
      "a": "Automatic Internet",
      "b": "Artificial Intelligence",
      "c": "Advanced Interface",
      "d": "Auto Input"
    },
    "answer": "b"
  },
  {
    "id": 14,
    "category": "Technology",
    "question": "Machine Learning adalah bagian dari?",
    "options": {
      "a": "IoT",
      "b": "AI",
      "c": "Blockchain",
      "d": "UI/UX"
    },
    "answer": "b"
  },
  {
    "id": 15,
    "category": "Cyber",
    "question": "Firewall berfungsi untuk?",
    "options": {
      "a": "Mempercepat internet",
      "b": "Mengamankan jaringan",
      "c": "Menyimpan data",
      "d": "Menghapus virus"
    },
    "answer": "b"
  },
  {
    "id": 16,
    "category": "Cyber",
    "question": "Brute force adalah?",
    "options": {
      "a": "Serangan coba-coba password",
      "b": "Virus email",
      "c": "Backup sistem",
      "d": "Enkripsi data"
    },
    "answer": "a"
  },
  {
    "id": 17,
    "category": "Science",
    "question": "Air mendidih pada suhu?",
    "options": {
      "a": "90°C",
      "b": "100°C",
      "c": "110°C",
      "d": "120°C"
    },
    "answer": "b"
  },
  {
    "id": 18,
    "category": "Science",
    "question": "Matahari adalah?",
    "options": {
      "a": "Planet",
      "b": "Bintang",
      "c": "Satelit",
      "d": "Asteroid"
    },
    "answer": "b"
  },
  {
    "id": 19,
    "category": "Physics",
    "question": "Kecepatan cahaya mendekati?",
    "options": {
      "a": "300 km/s",
      "b": "3.000 km/s",
      "c": "300.000 km/s",
      "d": "3.000.000 km/s"
    },
    "answer": "c"
  },
  {
    "id": 20,
    "category": "Physics",
    "question": "Gaya diukur dalam satuan?",
    "options": {
      "a": "Joule",
      "b": "Newton",
      "c": "Watt",
      "d": "Pascal"
    },
    "answer": "b"
  },
  {
    "id": 21,
    "category": "Internet",
    "question": "HTTP digunakan untuk?",
    "options": {
      "a": "Transfer file",
      "b": "Browsing web",
      "c": "Chat",
      "d": "Streaming"
    },
    "answer": "b"
  },
  {
    "id": 22,
    "category": "Internet",
    "question": "DNS berfungsi untuk?",
    "options": {
      "a": "Menyimpan data",
      "b": "Mengubah domain ke IP",
      "c": "Mengamankan server",
      "d": "Mengirim email"
    },
    "answer": "b"
  },
  {
    "id": 23,
    "category": "AI",
    "question": "ChatGPT termasuk jenis AI?",
    "options": {
      "a": "Rule-based",
      "b": "Generative AI",
      "c": "Expert system",
      "d": "IoT"
    },
    "answer": "b"
  },
  {
    "id": 24,
    "category": "AI",
    "question": "Dataset digunakan untuk?",
    "options": {
      "a": "Testing hardware",
      "b": "Melatih model",
      "c": "Membuat UI",
      "d": "Menghapus bug"
    },
    "answer": "b"
  },
  {
    "id": 25,
    "category": "Random",
    "question": "CPU adalah otak dari?",
    "options": {
      "a": "Monitor",
      "b": "Komputer",
      "c": "Keyboard",
      "d": "Mouse"
    },
    "answer": "b"
  },
  {
    "id": 26,
    "category": "Random",
    "question": "Open source berarti?",
    "options": {
      "a": "Gratis selamanya",
      "b": "Kode bisa diubah publik",
      "c": "Rahasia",
      "d": "Berbayar"
    },
    "answer": "b"
  },
  {
    "id": 27,
    "category": "Logic",
    "question": "Jika hari ini Senin, 3 hari lagi adalah?",
    "options": {
      "a": "Selasa",
      "b": "Rabu",
      "c": "Kamis",
      "d": "Jumat"
    },
    "answer": "c"
  },
  {
    "id": 28,
    "category": "Math",
    "question": "7 × 8 = ?",
    "options": {
      "a": "54",
      "b": "56",
      "c": "58",
      "d": "64"
    },
    "answer": "b"
  },
  {
    "id": 29,
    "category": "Cyber",
    "question": "VPN berfungsi untuk?",
    "options": {
      "a": "Mempercepat CPU",
      "b": "Menyembunyikan IP",
      "c": "Menghapus virus",
      "d": "Backup data"
    },
    "answer": "b"
  },
  {
    "id": 30,
    "category": "Cyber",
    "question": "Malware adalah?",
    "options": {
      "a": "Software berbahaya",
      "b": "Antivirus",
      "c": "Firewall",
      "d": "Framework"
    },
    "answer": "a"
  },
  {
    "id": 31,
    "category": "Coding",
    "question": "JSON kepanjangan dari?",
    "options": {
      "a": "Java Syntax Object",
      "b": "JavaScript Object Notation",
      "c": "Java Source Object",
      "d": "Joint System Object"
    },
    "answer": "b"
  },
  {
    "id": 32,
    "category": "Coding",
    "question": "API digunakan untuk?",
    "options": {
      "a": "Desain UI",
      "b": "Komunikasi antar sistem",
      "c": "Menulis kode",
      "d": "Testing hardware"
    },
    "answer": "b"
  },
  {
    "id": 33,
    "category": "Science",
    "question": "Manusia bernapas menggunakan?",
    "options": {
      "a": "Paru-paru",
      "b": "Jantung",
      "c": "Ginjal",
      "d": "Hati"
    },
    "answer": "a"
  },
  {
    "id": 34,
    "category": "Biology",
    "question": "Sel manusia bersifat?",
    "options": {
      "a": "Prokariotik",
      "b": "Eukariotik",
      "c": "Bakterial",
      "d": "Virus"
    },
    "answer": "b"
  },
  {
    "id": 35,
    "category": "AI",
    "question": "Neural Network terinspirasi dari?",
    "options": {
      "a": "Mesin",
      "b": "Otak manusia",
      "c": "Internet",
      "d": "Database"
    },
    "answer": "b"
  },
  {
    "id": 36,
    "category": "Internet",
    "question": "Browser digunakan untuk?",
    "options": {
      "a": "Coding",
      "b": "Browsing web",
      "c": "Editing video",
      "d": "Design"
    },
    "answer": "b"
  },
  {
    "id": 37,
    "category": "Random",
    "question": "SSD lebih cepat dari?",
    "options": {
      "a": "RAM",
      "b": "HDD",
      "c": "CPU",
      "d": "GPU"
    },
    "answer": "b"
  },
  {
    "id": 38,
    "category": "Logic",
    "question": "Jika semua manusia hidup, batu hidup?",
    "options": {
      "a": "Ya",
      "b": "Tidak",
      "c": "Kadang",
      "d": "Mungkin"
    },
    "answer": "b"
  },
  {
    "id": 39,
    "category": "Math",
    "question": "100 - 45 = ?",
    "options": {
      "a": "45",
      "b": "50",
      "c": "55",
      "d": "60"
    },
    "answer": "c"
  },
  {
    "id": 40,
    "category": "Physics",
    "question": "Energi diukur dengan satuan?",
    "options": {
      "a": "Newton",
      "b": "Joule",
      "c": "Volt",
      "d": "Ampere"
    },
    "answer": "b"
  },
  {
    "id": 41,
    "category": "Cyber",
    "question": "2FA digunakan untuk?",
    "options": {
      "a": "Login ganda",
      "b": "Keamanan tambahan",
      "c": "Backup",
      "d": "Debug"
    },
    "answer": "b"
  },
  {
    "id": 42,
    "category": "Technology",
    "question": "Cloud computing berarti?",
    "options": {
      "a": "Komputer awan",
      "b": "Server online",
      "c": "Offline storage",
      "d": "Local server"
    },
    "answer": "b"
  },
  {
    "id": 43,
    "category": "Programming",
    "question": "Loop digunakan untuk?",
    "options": {
      "a": "Percabangan",
      "b": "Pengulangan",
      "c": "Penyimpanan",
      "d": "Input"
    },
    "answer": "b"
  },
  {
    "id": 44,
    "category": "Random",
    "question": "Keyboard termasuk perangkat?",
    "options": {
      "a": "Output",
      "b": "Input",
      "c": "Storage",
      "d": "Process"
    },
    "answer": "b"
  },
  {
    "id": 45,
    "category": "Science",
    "question": "Bumi mengelilingi?",
    "options": {
      "a": "Bulan",
      "b": "Mars",
      "c": "Matahari",
      "d": "Venus"
    },
    "answer": "c"
  },
  {
    "id": 46,
    "category": "Math",
    "question": "9² = ?",
    "options": {
      "a": "18",
      "b": "81",
      "c": "72",
      "d": "99"
    },
    "answer": "b"
  },
  {
    "id": 47,
    "category": "AI",
    "question": "Prompt digunakan untuk?",
    "options": {
      "a": "Menjalankan server",
      "b": "Memberi instruksi AI",
      "c": "Menghapus data",
      "d": "Compile kode"
    },
    "answer": "b"
  },
  {
    "id": 48,
    "category": "Cyber",
    "question": "Password kuat harus?",
    "options": {
      "a": "Pendek",
      "b": "Mudah ditebak",
      "c": "Kombinasi karakter",
      "d": "Nama sendiri"
    },
    "answer": "c"
  },
  {
    "id": 49,
    "category": "Internet",
    "question": "Email digunakan untuk?",
    "options": {
      "a": "Telepon",
      "b": "Pesan elektronik",
      "c": "Video call",
      "d": "Streaming"
    },
    "answer": "b"
  },
  {
    "id": 50,
    "category": "Random",
    "question": "Komputer bekerja menggunakan?",
    "options": {
      "a": "Logika dan data",
      "b": "Perasaan",
      "c": "Insting",
      "d": "Keberuntungan"
    },
    "answer": "a"
  }
];

// Endpoint GET Utama (Tanpa Parameter)
router.get('/', (req, res) => {
  try {
    const randomIndex = Math.floor(Math.random() * questions.length);
    const randomQuestion = questions[randomIndex];

    return res.json({
      status: true,
      data: randomQuestion
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      error: err.message
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;

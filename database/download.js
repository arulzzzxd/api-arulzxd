export default async function handler(req, res) {
    const imageUrl = "https://arulz-uploader.vercel.app/files/CVmlrD.jpg";

    try {
        // Server Vercel nge-fetch gambar (bebas CORS karena server-to-server)
        const response = await fetch(imageUrl);
        
        if (!response.ok) {
            throw new Error("Gagal mengambil gambar dari uploader");
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Set header untuk memaksa browser langsung mendownload (attachment)
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Content-Disposition", 'attachment; filename="QRIS_Idzharul_Store.jpg"');
        
        // Kirim file biner ke client
        res.send(buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Gagal memproses unduhan" });
    }
}

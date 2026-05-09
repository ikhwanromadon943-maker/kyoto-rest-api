// Kyoto API — Storage Endpoints
// Upload / List / Delete — simulasi penyimpanan dengan feedback realistis

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/storage/', '');

  try {
    // ---------- UPLOAD ----------
    if (endpoint === 'upload') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan method POST' });
      // Di Vercel, file upload via multipart akan tersedia di req.body
      // Untuk production, integrasikan dengan Cloudinary / Uploadthing / S3
      const fileId = `kyoto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return res.json({
        status: 200,
        message: 'File berhasil diupload',
        file: {
          id: fileId,
          url: `https://storage.kyoto-api.vercel.app/${fileId}`,
          uploaded_at: new Date().toISOString(),
        },
        note: 'Storage production: integrasikan dengan Cloudinary, Uploadthing, atau AWS S3.',
      });
    }

    // ---------- LIST ----------
    if (endpoint === 'list') {
      const folder = url.searchParams.get('folder') || 'root';
      return res.json({
        status: 200,
        folder,
        files: [
          { id: 'kyoto_demo_001', name: 'sample-image.jpg', size: '245 KB', uploaded_at: new Date().toISOString() },
          { id: 'kyoto_demo_002', name: 'document.pdf', size: '1.2 MB', uploaded_at: new Date().toISOString() },
        ],
        note: 'Data di atas adalah sampel. Gunakan backend storage untuk production.',
      });
    }

    // ---------- DELETE ----------
    if (endpoint === 'delete') {
      if (req.method !== 'DELETE') return res.status(405).json({ error: 'Gunakan method DELETE' });
      const file = url.searchParams.get('file');
      if (!file) return res.status(400).json({ error: 'Parameter "file" diperlukan' });
      return res.json({ status: 200, message: `File "${file}" berhasil dihapus` });
    }

    return res.status(404).json({ error: `Storage "${endpoint}" tidak ditemukan` });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memproses storage', detail: err.message });
  }
}
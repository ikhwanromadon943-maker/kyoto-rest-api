// Kyoto API — Storage Endpoints
// Upload / List / Delete — simulasi dengan feedback realistis
// Production: integrasikan dengan Cloudinary, Uploadthing, atau AWS S3

export default async function handler(req, res) {
  const start = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ status: true, message: 'CORS preflight OK', response_time: `${Date.now() - start}ms` });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/storage/', '');

  try {
    // ---------- UPLOAD ----------
    if (endpoint === 'upload') {
      if (req.method !== 'POST') {
        return res.status(405).json({
          status: false, author: 'Kyoto API',
          error: 'Method not allowed. Use POST with multipart/form-data.',
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
      const fileId = `kyoto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return res.json({
        status: true,
        author: 'Kyoto API',
        message: 'File uploaded successfully (simulation)',
        file: {
          id: fileId,
          url: `https://storage.kyoto-api.vercel.app/${fileId}`,
          uploaded_at: new Date().toISOString()
        },
        production_note: 'For production, integrate with Cloudinary, Uploadthing, or AWS S3.',
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    }

    // ---------- LIST ----------
    if (endpoint === 'list') {
      const folder = url.searchParams.get('folder') || 'root';
      return res.json({
        status: true,
        author: 'Kyoto API',
        folder,
        files: [
          { id: 'kyoto_demo_001', name: 'sample-image.jpg', size: '245 KB', uploaded_at: new Date().toISOString() },
          { id: 'kyoto_demo_002', name: 'document.pdf', size: '1.2 MB', uploaded_at: new Date().toISOString() },
        ],
        production_note: 'Sample data. Integrate with real storage backend for production.',
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    }

    // ---------- DELETE ----------
    if (endpoint === 'delete') {
      if (req.method !== 'DELETE') {
        return res.status(405).json({
          status: false, author: 'Kyoto API',
          error: 'Method not allowed. Use DELETE.',
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
      const file = url.searchParams.get('file');
      if (!file) {
        return res.status(400).json({
          status: false, author: 'Kyoto API',
          error: 'Parameter "file" is required',
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
      return res.json({
        status: true,
        author: 'Kyoto API',
        message: `File "${file}" deleted successfully (simulation)`,
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    }

    return res.status(404).json({
      status: false, author: 'Kyoto API',
      error: `Endpoint /api/storage/${endpoint} not found`,
      timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
    });
  } catch (err) {
    return res.status(500).json({
      status: false, author: 'Kyoto API',
      error: `Internal server error: ${err.message}`,
      timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
    });
  }
}
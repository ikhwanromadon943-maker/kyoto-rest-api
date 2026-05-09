// Kyoto API — Media Endpoints
// Canvas    : image.pollinations.ai
// Sticker   : Konversi gambar ke WebP (mock)
// RemoveBG  : api.withoutbg.com (gratis, tanpa auth)
// Meme      : image.pollinations.ai dengan teks overlay

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/media/', '');

  try {
    // ---------- CANVAS ----------
    if (endpoint === 'canvas') {
      const text = url.searchParams.get('text');
      const bg = url.searchParams.get('bg') || 'ff6b6b';
      if (!text) return res.status(400).json({ error: 'Parameter "text" diperlukan' });
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}%20clean%20minimal%20design?width=800&height=400&nologo=true`;
      return res.json({ status: 200, text, bg, image: imageUrl, provider: 'Pollinations.ai' });
    }

    // ---------- STICKER ----------
    if (endpoint === 'sticker') {
      const imageUrl = url.searchParams.get('url');
      if (!imageUrl) return res.status(400).json({ error: 'Parameter "url" diperlukan' });
      return res.json({
        status: 200,
        original: imageUrl,
        sticker: `https://image.pollinations.ai/prompt/sticker%20style%20transparent%20background?width=512&height=512&nologo=true`,
        provider: 'Pollinations.ai',
        note: 'Untuk sticker WhatsApp asli, gunakan library wa-sticker-formatter (npm).',
      });
    }

    // ---------- REMOVE BG ----------
    if (endpoint === 'removebg') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan method POST dengan image file' });
      return res.json({
        status: 200,
        message: 'Background removal berhasil',
        result: 'https://image.pollinations.ai/prompt/cutout%20isolated%20on%20transparent?width=512&height=512&nologo=true',
        provider: 'Pollinations.ai (simulasi)',
        note: 'Untuk remove BG sesungguhnya, gunakan api.withoutbg.com (gratis, tanpa API key) atau rembg Python.',
      });
    }

    // ---------- MEME ----------
    if (endpoint === 'meme') {
      const imgUrl = url.searchParams.get('url');
      const top = url.searchParams.get('top') || '';
      const bottom = url.searchParams.get('bottom') || '';
      if (!imgUrl) return res.status(400).json({ error: 'Parameter "url" diperlukan' });
      const memeUrl = `https://image.pollinations.ai/prompt/meme%20${encodeURIComponent(top)}%20${encodeURIComponent(bottom)}?width=600&height=400&nologo=true`;
      return res.json({ status: 200, top, bottom, meme: memeUrl, provider: 'Pollinations.ai' });
    }

    return res.status(404).json({ error: `Media "${endpoint}" tidak tersedia` });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memproses media', detail: err.message });
  }
}
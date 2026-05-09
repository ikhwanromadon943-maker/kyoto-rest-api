export default async function handler(req, res) {
  const start = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ status: true, message: 'CORS preflight OK', response_time: `${Date.now() - start}ms` });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/media/', '');

  try {
    if (endpoint === 'canvas') {
      const text = url.searchParams.get('text');
      const bg = url.searchParams.get('bg') || 'ff6b6b';
      if (!text) {
        return res.status(400).json({ status: false, author: 'Kyoto API', error: 'Parameter "text" is required', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
      }
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}%20minimal%20clean%20design?width=800&height=400&nologo=true`;
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', text, background_color: `#${bg}`, image: imageUrl, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }

    if (endpoint === 'sticker') {
      const imageUrl = url.searchParams.get('url');
      if (!imageUrl) {
        return res.status(400).json({ status: false, author: 'Kyoto API', error: 'Parameter "url" is required', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
      }
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', original: imageUrl, sticker: `https://image.pollinations.ai/prompt/sticker%20style?width=512&height=512&nologo=true`, production_note: 'Use wa-sticker-formatter (npm) for real WhatsApp stickers.', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }

    if (endpoint === 'removebg') {
      if (req.method !== 'POST') {
        return res.status(405).json({ status: false, author: 'Kyoto API', error: 'Method not allowed. Use POST with multipart/form-data.', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
      }
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai (simulation)', message: 'Background removal processed', result: `https://image.pollinations.ai/prompt/cutout%20isolated?width=512&height=512&nologo=true`, production_note: 'Use rembg (Python) or api.withoutbg.com for production.', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }

    if (endpoint === 'meme') {
      const imgUrl = url.searchParams.get('url');
      const top = url.searchParams.get('top') || '';
      const bottom = url.searchParams.get('bottom') || '';
      if (!imgUrl) {
        return res.status(400).json({ status: false, author: 'Kyoto API', error: 'Parameter "url" is required', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
      }
      const memeUrl = `https://image.pollinations.ai/prompt/meme%20${encodeURIComponent(top)}%20${encodeURIComponent(bottom)}?width=600&height=400&nologo=true`;
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', top_text: top, bottom_text: bottom, meme: memeUrl, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }

    return res.status(404).json({ status: false, author: 'Kyoto API', error: `Endpoint /api/media/${endpoint} not found`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: `Internal server error: ${err.message}`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
  }
}
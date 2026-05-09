export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace('/api/media/', '');
    const t = url.searchParams.get('text');
    const top = url.searchParams.get('top') || '';
    const bottom = url.searchParams.get('bottom') || '';

    if (ep === 'canvas') {
      if (!t) return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "text" is required' });
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', text: t, image: `https://image.pollinations.ai/prompt/${encodeURIComponent(t)}%20clean?width=800&height=400&nologo=true` });
    }

    if (ep === 'meme') {
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', top, bottom, meme: `https://image.pollinations.ai/prompt/meme%20${encodeURIComponent(top)}%20${encodeURIComponent(bottom)}?width=600&height=400&nologo=true` });
    }

    return res.json({ status: false, author: 'Kyoto API', error: `Endpoint /api/media/${ep} not found` });
  } catch (err) { return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message }); }
}
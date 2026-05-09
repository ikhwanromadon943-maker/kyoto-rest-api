export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const endpoint = pathname.replace('/api/media/', '');

    try {
        switch (endpoint) {
            case 'canvas': {
                const text = new URL(req.url, `http://${req.headers.host}`).searchParams.get('text');
                const bg = new URL(req.url, `http://${req.headers.host}`).searchParams.get('bg') || '#ff6b6b';
                if (!text) return res.status(400).json({ error: 'Parameter "text" is required' });
                return res.json({
                    status: 200,
                    text,
                    bg,
                    image: `https://via.placeholder.com/800x400/${bg.replace('#','')}/fff?text=${encodeURIComponent(text)}`
                });
            }
            case 'sticker': {
                const url = new URL(req.url, `http://${req.headers.host}`).searchParams.get('url');
                if (!url) return res.status(400).json({ error: 'Parameter "url" is required' });
                return res.json({
                    status: 200,
                    original: url,
                    sticker: 'https://example.com/media/sticker.webp'
                });
            }
            case 'removebg': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
                return res.json({
                    status: 200,
                    message: 'Background removed',
                    result: 'https://example.com/media/nobg.png'
                });
            }
            case 'meme': {
                const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
                const imgUrl = params.get('url');
                const top = params.get('top');
                const bottom = params.get('bottom');
                if (!imgUrl || !top || !bottom) return res.status(400).json({ error: 'Parameters "url", "top", "bottom" are required' });
                return res.json({
                    status: 200,
                    meme: `https://via.placeholder.com/600x400/ff6b6b/fff?text=${encodeURIComponent(top)}+${encodeURIComponent(bottom)}`,
                    top,
                    bottom
                });
            }
            default:
                return res.status(404).json({ error: `Media endpoint ${endpoint} not found` });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
}
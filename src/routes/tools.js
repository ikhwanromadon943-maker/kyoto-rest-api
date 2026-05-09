export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const endpoint = pathname.replace('/api/tools/', '');
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;

    try {
        switch (endpoint) {
            case 'ssweb': {
                const url = params.get('url');
                if (!url) return res.status(400).json({ error: 'Parameter "url" is required' });
                return res.json({
                    status: 200,
                    url,
                    screenshot: `https://via.placeholder.com/1280x720/ff6b6b/fff?text=Screenshot+${encodeURIComponent(url.slice(0,20))}`,
                    full: params.get('full') === 'true'
                });
            }
            case 'qr': {
                const text = params.get('text');
                if (!text) return res.status(400).json({ error: 'Parameter "text" is required' });
                return res.json({
                    status: 200,
                    text,
                    qr: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
                });
            }
            case 'shortlink': {
                const url = params.get('url');
                if (!url) return res.status(400).json({ error: 'Parameter "url" is required' });
                return res.json({
                    status: 200,
                    original: url,
                    short: `https://kyo.to/${Math.random().toString(36).slice(2,8)}`
                });
            }
            case 'cuaca': {
                const city = params.get('city');
                if (!city) return res.status(400).json({ error: 'Parameter "city" is required' });
                return res.json({
                    status: 200,
                    city,
                    temp: `${Math.floor(Math.random()*15+15)}°C`,
                    condition: ['Sunny', 'Cloudy', 'Rainy', 'Clear'][Math.floor(Math.random()*4)],
                    humidity: `${Math.floor(Math.random()*40+40)}%`
                });
            }
            case 'calculator': {
                const expr = params.get('expr');
                if (!expr) return res.status(400).json({ error: 'Parameter "expr" is required' });
                try {
                    const result = Function(`'use strict'; return (${expr})`)();
                    return res.json({ status: 200, expression: expr, result });
                } catch {
                    return res.status(400).json({ error: 'Invalid expression' });
                }
            }
            default:
                return res.status(404).json({ error: `Tool ${endpoint} not found` });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
}
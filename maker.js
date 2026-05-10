import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/maker\/?/, '');

    if (ep === 'canvas') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', image: `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=800&height=400&nologo=true` });
    }

    if (ep === 'meme') {
      const top = url.searchParams.get('top') || '';
      const bottom = url.searchParams.get('bottom') || '';
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', image: `https://image.pollinations.ai/prompt/meme%20${encodeURIComponent(top)}%20${encodeURIComponent(bottom)}?width=600&height=400&nologo=true` });
    }

    if (ep === 'quote-image') {
      const quote = url.searchParams.get('text') || 'The best way to predict the future is to create it';
      const author = url.searchParams.get('author') || 'Abraham Lincoln';
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', image: `https://image.pollinations.ai/prompt/${encodeURIComponent(quote)}%20-%20${encodeURIComponent(author)}?width=800&height=400&nologo=true` });
    }

    if (ep === 'password') {
      const len = Math.min(parseInt(url.searchParams.get('length')) || 16, 64);
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
      const pw = Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      return res.json({ status: true, author: 'Kyoto API', password: pw, length: len });
    }

    // NEW: Random avatar (via DiceBear)
    if (ep === 'avatar') {
      const seed = url.searchParams.get('seed') || Math.random().toString(36).slice(2);
      const style = url.searchParams.get('style') || 'avataaars'; // avataaars, bottts, identicon, pixel-art, lorelei, fun-emoji
      return res.json({ status: true, author: 'Kyoto API', provider: 'DiceBear', seed, style, url: `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`, png: `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(seed)}` });
    }

    // NEW: Placeholder image
    if (ep === 'placeholder') {
      const width = url.searchParams.get('width') || '400';
      const height = url.searchParams.get('height') || '300';
      const text = url.searchParams.get('text') || `${width}x${height}`;
      const bg = url.searchParams.get('bg') || '333';
      const color = url.searchParams.get('color') || 'fff';
      return res.json({ status: true, author: 'Kyoto API', provider: 'placehold.co', url: `https://placehold.co/${width}x${height}/${bg}/${color}?text=${encodeURIComponent(text)}` });
    }

    // NEW: QR code with logo (via goQR)
    if (ep === 'qr-styled') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const size = url.searchParams.get('size') || '300x300';
      const color = url.searchParams.get('color') || '000000';
      const bg = url.searchParams.get('bg') || 'ffffff';
      return res.json({ status: true, author: 'Kyoto API', provider: 'goQR.me', text, qr: `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(text)}&color=${color}&bgcolor=${bg}&qzone=1` });
    }

    // NEW: Gradient image
    if (ep === 'gradient') {
      const from = url.searchParams.get('from') || 'ff6b6b';
      const to = url.searchParams.get('to') || '4ecdc4';
      const width = url.searchParams.get('width') || '800';
      const height = url.searchParams.get('height') || '400';
      const text = url.searchParams.get('text') || '';
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', url: `https://image.pollinations.ai/prompt/smooth%20gradient%20from%20%23${from}%20to%20%23${to}${text ? '%20' + encodeURIComponent(text) : ''}?width=${width}&height=${height}&nologo=true` });
    }

    // NEW: Name card generator
    if (ep === 'namecard') {
      const name = url.searchParams.get('name') || 'John Doe';
      const title = url.searchParams.get('title') || 'Developer';
      const prompt = `Professional name card for "${name}" with title "${title}", minimal dark design, elegant typography`;
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', name, title, image: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=450&nologo=true` });
    }

    return errRes(res, `Endpoint /api/maker/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}

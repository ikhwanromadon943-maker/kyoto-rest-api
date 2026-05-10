import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/maker\/?/, '');
    const rt = () => `${Date.now() - start}ms`;

    if (ep === 'canvas') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        image: `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=800&height=400&nologo=true`,
        text, response_time: rt()
      });
    }

    if (ep === 'meme') {
      const top = url.searchParams.get('top') || '';
      const bottom = url.searchParams.get('bottom') || '';
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        image: `https://image.pollinations.ai/prompt/meme%20${encodeURIComponent(top)}%20${encodeURIComponent(bottom)}?width=600&height=400&nologo=true`,
        top, bottom, response_time: rt()
      });
    }

    if (ep === 'quote-image') {
      const quote = url.searchParams.get('text') || 'The best way to predict the future is to create it';
      const author = url.searchParams.get('author') || 'Abraham Lincoln';
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        image: `https://image.pollinations.ai/prompt/${encodeURIComponent(quote)}%20-%20${encodeURIComponent(author)}?width=800&height=400&nologo=true`,
        quote, author, response_time: rt()
      });
    }

    if (ep === 'password') {
      const len = Math.min(parseInt(url.searchParams.get('length')) || 16, 128);
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
      const pw = Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      return res.json({
        status: true, author: 'Kyoto API',
        password: pw, length: len, response_time: rt()
      });
    }

    if (ep === 'avatar') {
      const seed = url.searchParams.get('seed') || Math.random().toString(36).slice(2);
      const style = url.searchParams.get('style') || 'avataaars';
      const validStyles = ['avataaars', 'bottts', 'identicon', 'pixel-art', 'lorelei', 'fun-emoji'];
      if (!validStyles.includes(style)) return errRes(res, `Invalid style. Allowed: ${validStyles.join(', ')}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'DiceBear',
        seed, style,
        svg: `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`,
        png: `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(seed)}`,
        response_time: rt()
      });
    }

    if (ep === 'placeholder') {
      const width = url.searchParams.get('width') || '400';
      const height = url.searchParams.get('height') || '300';
      const text = url.searchParams.get('text') || `${width}x${height}`;
      const bg = url.searchParams.get('bg') || '333';
      const color = url.searchParams.get('color') || 'fff';
      return res.json({
        status: true, author: 'Kyoto API', provider: 'placehold.co',
        url: `https://placehold.co/${width}x${height}/${bg}/${color}?text=${encodeURIComponent(text)}`,
        response_time: rt()
      });
    }

    if (ep === 'qr-styled') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const size = url.searchParams.get('size') || '300x300';
      const color = (url.searchParams.get('color') || '000000').replace('#', '');
      const bg = (url.searchParams.get('bg') || 'ffffff').replace('#', '');
      return res.json({
        status: true, author: 'Kyoto API', provider: 'goQR.me',
        text,
        qr: `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(text)}&color=${color}&bgcolor=${bg}&qzone=1`,
        response_time: rt()
      });
    }

    if (ep === 'gradient') {
      const from = url.searchParams.get('from') || 'ff6b6b';
      const to = url.searchParams.get('to') || '4ecdc4';
      const width = url.searchParams.get('width') || '800';
      const height = url.searchParams.get('height') || '400';
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        url: `https://image.pollinations.ai/prompt/smooth%20gradient%20from%20%23${from}%20to%20%23${to}?width=${width}&height=${height}&nologo=true`,
        from: `#${from}`, to: `#${to}`, response_time: rt()
      });
    }

    if (ep === 'namecard') {
      const name = url.searchParams.get('name') || 'John Doe';
      const title = url.searchParams.get('title') || 'Developer';
      const prompt = `Professional name card for "${name}" with title "${title}", minimal dark design, elegant typography, business card style`;
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        name, title,
        image: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=450&nologo=true`,
        response_time: rt()
      });
    }

    // NEW: Color palette generator via Colormind
    if (ep === 'color-palette') {
      try {
        const d = await safeFetch('http://colormind.io/api/', {
          method: 'POST',
          body: JSON.stringify({ model: 'default' })
        }, 6000);
        
        const palette = (d.result || []).map(rgb => {
          const hex = rgb.map(c => c.toString(16).padStart(2, '0')).join('');
          return {
            hex: `#${hex}`,
            rgb: `rgb(${rgb.join(', ')})`
          };
        });
        
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Colormind',
          palette,
          response_time: rt()
        });
      } catch {
        // Fallback: generate random palette
        const palette = Array.from({ length: 5 }, () => {
          const hex = Array.from({ length: 6 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
          return { hex: `#${hex}` };
        });
        return res.json({
          status: true, author: 'Kyoto API',
          palette,
          note: 'Random palette (Colormind API unavailable)',
          response_time: rt()
        });
      }
    }

    return errRes(res, `Endpoint /api/maker/${ep} not found. Available: canvas, meme, quote-image, password, avatar, placeholder, qr-styled, gradient, namecard, color-palette`);
  
  } catch (err) {
    return res.status(500).json({
      status: false, author: 'Kyoto API',
      error: err.message,
      hint: 'Upstream API may be rate-limited or blocked',
      timestamp: new Date().toISOString()
    });
  }
}
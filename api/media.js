import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/media\/?/, '');

    if (ep === 'canvas') {
      const t = url.searchParams.get('text');
      if (!t) return errRes(res, 'Parameter "text" is required');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', image: `https://image.pollinations.ai/prompt/${encodeURIComponent(t)}?width=800&height=400&nologo=true` });
    }

    if (ep === 'meme') {
      const top = url.searchParams.get('top') || '';
      const bottom = url.searchParams.get('bottom') || '';
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', image: `https://image.pollinations.ai/prompt/meme%20${encodeURIComponent(top)}%20${encodeURIComponent(bottom)}?width=600&height=400&nologo=true` });
    }

    if (ep === 'quote-image') {
      const q = url.searchParams.get('text') || 'Stay hungry, stay foolish';
      const a = url.searchParams.get('author') || 'Steve Jobs';
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', image: `https://image.pollinations.ai/prompt/${encodeURIComponent(q)}%20-%20${encodeURIComponent(a)}?width=800&height=400&nologo=true` });
    }

    // NEW: Generate wallpaper
    if (ep === 'wallpaper') {
      const theme = url.searchParams.get('theme') || 'nature landscape 4k ultra hd';
      const width = url.searchParams.get('width') || '1920';
      const height = url.searchParams.get('height') || '1080';
      const seed = Math.floor(Math.random() * 999999);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', theme, width, height, seed, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(theme)}?width=${width}&height=${height}&seed=${seed}&nologo=true` });
    }

    // NEW: AI art styles
    if (ep === 'art') {
      const subject = url.searchParams.get('subject') || 'cat';
      const style = url.searchParams.get('style') || 'oil painting'; // oil painting, watercolor, anime, pixel art, sketch
      const seed = Math.floor(Math.random() * 999999);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', subject, style, seed, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(subject + ' in ' + style + ' style')}?width=512&height=512&seed=${seed}&nologo=true` });
    }

    // NEW: Profile picture generator
    if (ep === 'profile-pic') {
      const prompt = url.searchParams.get('prompt') || 'portrait of a person, professional, minimal background';
      const seed = Math.floor(Math.random() * 999999);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt, seed, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&seed=${seed}&nologo=true` });
    }

    // NEW: Banner image
    if (ep === 'banner') {
      const text = url.searchParams.get('text') || 'Welcome';
      const style = url.searchParams.get('style') || 'modern dark gradient banner with glowing text';
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', text, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(style + ' text: ' + text)}?width=1200&height=400&nologo=true` });
    }

    // NEW: Thumbnail generator
    if (ep === 'thumbnail') {
      const title = url.searchParams.get('title') || 'My Video';
      const bg = url.searchParams.get('bg') || 'dark cyberpunk background';
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', title, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(bg + ' youtube thumbnail text: ' + title)}?width=1280&height=720&nologo=true` });
    }

    return errRes(res, `Endpoint /api/media/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}

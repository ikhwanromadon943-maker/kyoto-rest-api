import { safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/media\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  // Rate limit check
  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  try {
    if (ep === 'wallpaper') {
      const theme = url.searchParams.get('theme') || 'nature landscape 4k ultra hd';
      const width = url.searchParams.get('width') || '1920';
      const height = url.searchParams.get('height') || '1080';
      const seed = Math.floor(Math.random() * 999999);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', theme, width, height, seed, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(theme)}?width=${width}&height=${height}&seed=${seed}&nologo=true`, response_time: rt() });
    }

    if (ep === 'art') {
      const subject = url.searchParams.get('subject') || 'cat';
      const style = url.searchParams.get('style') || 'oil painting';
      const seed = Math.floor(Math.random() * 999999);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', subject, style, seed, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(subject + ' in ' + style + ' style')}?width=512&height=512&seed=${seed}&nologo=true`, response_time: rt() });
    }

    if (ep === 'profile-pic') {
      const prompt = url.searchParams.get('prompt') || 'professional portrait, minimal background';
      const seed = Math.floor(Math.random() * 999999);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt, seed, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&seed=${seed}&nologo=true`, response_time: rt() });
    }

    if (ep === 'banner') {
      const text = url.searchParams.get('text') || 'Welcome';
      const style = url.searchParams.get('style') || 'modern dark gradient banner with glowing text';
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', text, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(style + ' text: ' + text)}?width=1200&height=400&nologo=true`, response_time: rt() });
    }

    if (ep === 'thumbnail') {
      const title = url.searchParams.get('title') || 'My Video';
      const bg = url.searchParams.get('bg') || 'cyberpunk background';
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', title, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(bg + ' youtube thumbnail text: ' + title)}?width=1280&height=720&nologo=true`, response_time: rt() });
    }

    if (ep === 'youtube') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) return errRes(res, 'Parameter "url" is required (YouTube video URL)');
      try {
        const d = await safeFetch(`https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`, {}, 6000);
        if (d.error) throw new Error(d.error);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Noembed', title: d.title, author: d.author_name, author_url: d.author_url, thumbnail: d.thumbnail_url, html: d.html, provider: d.provider_name, response_time: rt() });
      } catch { return errRes(res, 'Failed to fetch YouTube info. Check URL format.'); }
    }

    if (ep === 'unsplash') {
      const query = url.searchParams.get('query') || 'nature';
      const imageUrl = `https://source.unsplash.com/random/800x600/?${encodeURIComponent(query)}`;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Unsplash Source', query, url: imageUrl, note: 'Image URL redirects to random high-quality photo', response_time: rt() });
    }

    // Legacy endpoints
    if (ep === 'canvas') {
      const t = url.searchParams.get('text');
      if (!t) return errRes(res, 'Parameter "text" is required');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', image: `https://image.pollinations.ai/prompt/${encodeURIComponent(t)}?width=800&height=400&nologo=true`, response_time: rt() });
    }

    if (ep === 'meme') {
      const top = url.searchParams.get('top') || '';
      const bottom = url.searchParams.get('bottom') || '';
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', image: `https://image.pollinations.ai/prompt/meme%20${encodeURIComponent(top)}%20${encodeURIComponent(bottom)}?width=600&height=400&nologo=true`, response_time: rt() });
    }

    if (ep === 'quote-image') {
      const q = url.searchParams.get('text') || 'Stay hungry, stay foolish';
      const a = url.searchParams.get('author') || 'Steve Jobs';
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', image: `https://image.pollinations.ai/prompt/${encodeURIComponent(q)}%20-%20${encodeURIComponent(a)}?width=800&height=400&nologo=true`, response_time: rt() });
    }

    return errRes(res, `Endpoint /api/media/${ep} not found.`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked', timestamp: new Date().toISOString() });
  }
}
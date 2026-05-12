import { safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/maker\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  // Pollinations image helper
  const pollinationsImg = (prompt, w = 512, h = 512, seed = null) => {
    const s = seed ?? Math.floor(Math.random() * 999999);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${s}&nologo=true`;
  };

  try {
    // ─── AI CANVAS / IMAGE ────────────────────────────────────────────────────
    if (ep === 'canvas') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const width = Math.min(parseInt(url.searchParams.get('width')) || 800, 1280);
      const height = Math.min(parseInt(url.searchParams.get('height')) || 400, 1280);
      const seed = Math.floor(Math.random() * 999999);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        prompt: text, width, height, seed,
        image: pollinationsImg(text, width, height, seed),
        response_time: rt()
      });
    }

    // ─── MEME GENERATOR ───────────────────────────────────────────────────────
    if (ep === 'meme') {
      const top = url.searchParams.get('top') || '';
      const bottom = url.searchParams.get('bottom') || '';
      const style = url.searchParams.get('style') || 'classic meme impact font white text black outline';
      const prompt = `${style}, top text: "${top}", bottom text: "${bottom}", funny meme format`;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        top, bottom,
        image: pollinationsImg(prompt, 600, 600),
        response_time: rt()
      });
    }

    // ─── QUOTE IMAGE ──────────────────────────────────────────────────────────
    if (ep === 'quote-image') {
      const quote = url.searchParams.get('text') || 'The best way to predict the future is to create it';
      const author = url.searchParams.get('author') || 'Abraham Lincoln';
      const style = url.searchParams.get('style') || 'minimalist dark background';
      const prompt = `${style}, inspirational quote card, elegant typography, quote: "${quote}" — ${author}`;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        quote, author,
        image: pollinationsImg(prompt, 800, 400),
        response_time: rt()
      });
    }

    // ─── QR CODE (styled) ─────────────────────────────────────────────────────
    if (ep === 'qr-styled') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const size = url.searchParams.get('size') || '300x300';
      const color = (url.searchParams.get('color') || '000000').replace('#', '');
      const bg = (url.searchParams.get('bg') || 'ffffff').replace('#', '');
      const errorLevel = url.searchParams.get('error') || 'M'; // L | M | Q | H
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'goQR.me',
        text, size,
        qr: `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(text)}&color=${color}&bgcolor=${bg}&qzone=1&ecc=${errorLevel}`,
        download: `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(text)}&format=png`,
        svg: `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(text)}&format=svg`,
        response_time: rt()
      });
    }

    // ─── AVATAR ───────────────────────────────────────────────────────────────
    if (ep === 'avatar') {
      const seed = url.searchParams.get('seed') || Math.random().toString(36).slice(2);
      const style = url.searchParams.get('style') || 'avataaars';
      const validStyles = ['avataaars', 'bottts', 'identicon', 'pixel-art', 'lorelei', 'fun-emoji', 'micah', 'notionists', 'open-peeps', 'personas', 'rings', 'shapes'];
      if (!validStyles.includes(style)) return errRes(res, `Invalid style. Allowed: ${validStyles.join(', ')}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'DiceBear v7',
        seed, style,
        svg: `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`,
        png: `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(seed)}&size=256`,
        response_time: rt()
      });
    }

    // ─── PLACEHOLDER IMAGE ────────────────────────────────────────────────────
    if (ep === 'placeholder') {
      const width = Math.min(parseInt(url.searchParams.get('width')) || 400, 2000);
      const height = Math.min(parseInt(url.searchParams.get('height')) || 300, 2000);
      const text = url.searchParams.get('text') || `${width}x${height}`;
      const bg = (url.searchParams.get('bg') || '1a1a1a').replace('#', '');
      const color = (url.searchParams.get('color') || 'ffffff').replace('#', '');
      const format = url.searchParams.get('format') || 'png'; // png | webp | svg
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'placehold.co',
        width, height, text,
        url: `https://placehold.co/${width}x${height}/${bg}/${color}.${format}?text=${encodeURIComponent(text)}`,
        response_time: rt()
      });
    }

    // ─── PASSWORD GENERATOR ───────────────────────────────────────────────────
    if (ep === 'password') {
      const len = Math.min(parseInt(url.searchParams.get('length')) || 16, 128);
      const useSymbols = url.searchParams.get('symbols') !== 'false';
      const useNumbers = url.searchParams.get('numbers') !== 'false';
      const useUpper = url.searchParams.get('uppercase') !== 'false';
      const count = Math.min(parseInt(url.searchParams.get('count')) || 1, 10);

      let chars = 'abcdefghijklmnopqrstuvwxyz';
      if (useUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (useNumbers) chars += '0123456789';
      if (useSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

      const generate = () => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const strength = len < 8 ? 'weak' : len < 12 ? 'fair' : len < 16 ? 'strong' : 'very strong';
      const passwords = count === 1 ? generate() : Array.from({ length: count }, generate);

      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API',
        passwords, length: len, strength,
        options: { symbols: useSymbols, numbers: useNumbers, uppercase: useUpper },
        response_time: rt()
      });
    }

    // ─── COLOR PALETTE ────────────────────────────────────────────────────────
    if (ep === 'color-palette') {
      const count = Math.min(parseInt(url.searchParams.get('count')) || 5, 10);
      const mode = url.searchParams.get('mode') || 'random'; // random | warm | cool | pastel | dark
      try {
        const d = await safeFetch('http://colormind.io/api/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'default' })
        }, 6000);
        const palette = (d.result || []).slice(0, count).map(rgb => {
          const hex = '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
          return { hex, rgb: `rgb(${rgb.join(', ')})`, r: rgb[0], g: rgb[1], b: rgb[2] };
        });
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Colormind', count: palette.length, palette, response_time: rt() });
      } catch {
        // Fallback: generate palette based on mode
        const generateColor = () => {
          let r, g, b;
          if (mode === 'warm') { r = 180 + Math.floor(Math.random() * 75); g = Math.floor(Math.random() * 150); b = Math.floor(Math.random() * 100); }
          else if (mode === 'cool') { r = Math.floor(Math.random() * 100); g = 100 + Math.floor(Math.random() * 100); b = 150 + Math.floor(Math.random() * 105); }
          else if (mode === 'pastel') { r = 180 + Math.floor(Math.random() * 75); g = 180 + Math.floor(Math.random() * 75); b = 180 + Math.floor(Math.random() * 75); }
          else if (mode === 'dark') { r = Math.floor(Math.random() * 80); g = Math.floor(Math.random() * 80); b = Math.floor(Math.random() * 80); }
          else { r = Math.floor(Math.random() * 256); g = Math.floor(Math.random() * 256); b = Math.floor(Math.random() * 256); }
          const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
          return { hex, rgb: `rgb(${r}, ${g}, ${b})`, r, g, b };
        };
        const palette = Array.from({ length: count }, generateColor);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Generated', mode, count: palette.length, palette, response_time: rt() });
      }
    }

    // ─── GRADIENT ─────────────────────────────────────────────────────────────
    if (ep === 'gradient') {
      const from = (url.searchParams.get('from') || 'ff6b6b').replace('#', '');
      const to = (url.searchParams.get('to') || '4ecdc4').replace('#', '');
      const direction = url.searchParams.get('direction') || 'linear'; // linear | radial
      const width = Math.min(parseInt(url.searchParams.get('width')) || 800, 1920);
      const height = Math.min(parseInt(url.searchParams.get('height')) || 400, 1080);
      const prompt = `beautiful smooth ${direction} gradient from #${from} to #${to}, minimal clean background, no text, high quality`;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        from: `#${from}`, to: `#${to}`, direction,
        url: pollinationsImg(prompt, width, height),
        // Also provide CSS gradient string
        css: `background: ${direction}-gradient(to right, #${from}, #${to});`,
        response_time: rt()
      });
    }

    // ─── NAME CARD ────────────────────────────────────────────────────────────
    if (ep === 'namecard') {
      const name = url.searchParams.get('name') || 'John Doe';
      const title = url.searchParams.get('title') || 'Software Developer';
      const theme = url.searchParams.get('theme') || 'dark';
      const prompt = `Professional business name card for "${name}", job title: "${title}", ${theme} theme, elegant minimal design, clean typography, high quality`;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        name, title, theme,
        image: pollinationsImg(prompt, 900, 500),
        response_time: rt()
      });
    }

    // ─── THUMBNAIL GENERATOR ─────────────────────────────────────────────────
    if (ep === 'thumbnail') {
      const title = url.searchParams.get('title') || 'My Awesome Video';
      const bg = url.searchParams.get('bg') || 'cinematic dark gradient';
      const style = url.searchParams.get('style') || 'YouTube thumbnail';
      const prompt = `${style}, ${bg} background, bold text overlay: "${title}", high contrast, eye-catching, professional`;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        title, bg, style,
        image: pollinationsImg(prompt, 1280, 720),
        response_time: rt()
      });
    }

    // ─── BANNER GENERATOR ─────────────────────────────────────────────────────
    if (ep === 'banner') {
      const text = url.searchParams.get('text') || 'Welcome';
      const style = url.searchParams.get('style') || 'modern dark gradient';
      const width = Math.min(parseInt(url.searchParams.get('width')) || 1200, 1920);
      const height = Math.min(parseInt(url.searchParams.get('height')) || 400, 600);
      const prompt = `${style} website banner, large bold text: "${text}", professional design, clean minimal, high resolution`;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        text, style, width, height,
        image: pollinationsImg(prompt, width, height),
        response_time: rt()
      });
    }

    // ─── PROFILE PICTURE ──────────────────────────────────────────────────────
    if (ep === 'profile-pic') {
      const prompt = url.searchParams.get('prompt') || 'professional portrait photo, clean background, well-lit';
      const style = url.searchParams.get('style') || 'realistic';
      const seed = Math.floor(Math.random() * 999999);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        prompt, style, seed,
        image: pollinationsImg(`${prompt}, ${style} style, profile picture format`, 512, 512, seed),
        response_time: rt()
      });
    }

    // ─── LOREM IPSUM ──────────────────────────────────────────────────────────
    if (ep === 'lorem') {
      const paragraphs = Math.min(parseInt(url.searchParams.get('paragraphs')) || 1, 10);
      const words = url.searchParams.get('words'); // optional: word count mode
      try {
        const endpoint = words
          ? `https://loripsum.net/api/${words}/plaintext`
          : `https://loripsum.net/api/${paragraphs}/medium/plaintext`;
        const text = await safeFetch(endpoint, {}, 6000);
        logRequest(url.pathname, ip, ua, rt());
        const result = typeof text === 'string' ? text.trim() : JSON.stringify(text);
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Loripsum.net',
          paragraphs: words ? null : paragraphs, words: words || null,
          text: result,
          word_count: result.split(/\s+/).length,
          response_time: rt()
        });
      } catch {
        // Fallback: static lorem
        const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
        return res.json({ status: true, author: 'Kyoto API', provider: 'Static fallback', text: lorem, response_time: rt() });
      }
    }

    // ─── UUID GENERATOR ───────────────────────────────────────────────────────
    if (ep === 'uuid') {
      const count = Math.min(parseInt(url.searchParams.get('count')) || 1, 50);
      const uuids = Array.from({ length: count }, () => crypto.randomUUID());
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', count, uuids, response_time: rt() });
    }

    // ─── SLUG GENERATOR ───────────────────────────────────────────────────────
    if (ep === 'slug') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const slug = text
        .toLowerCase()
        .trim()
        .replace(/[àáâäæãåā]/g, 'a').replace(/[çćč]/g, 'c').replace(/[èéêëēėę]/g, 'e')
        .replace(/[îïíīįì]/g, 'i').replace(/[ôöòóœøōõ]/g, 'o').replace(/[ûüùúū]/g, 'u')
        .replace(/[ñń]/g, 'n').replace(/[ßś]/g, 's').replace(/ž/g, 'z').replace(/ý/g, 'y')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', original: text, slug, length: slug.length, response_time: rt() });
    }

    // ─── MARKDOWN TO HTML ─────────────────────────────────────────────────────
    if (ep === 'markdown') {
      const md = url.searchParams.get('text');
      if (!md) return errRes(res, 'Parameter "text" is required');
      // Simple but comprehensive markdown converter
      const html = md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
        .replace(/!\[(.+?)\]\((.+?)\)/g, '<img alt="$1" src="$2">')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/^---$/gm, '<hr>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/^(?!<[hpulbicod])(.+)$/gm, '<p>$1</p>');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', markdown: md.slice(0, 2000), html, response_time: rt() });
    }

    // ─── BADGE GENERATOR ──────────────────────────────────────────────────────
    if (ep === 'badge') {
      const label = url.searchParams.get('label') || 'build';
      const message = url.searchParams.get('message') || 'passing';
      const color = (url.searchParams.get('color') || '4ade80').replace('#', '');
      const style = url.searchParams.get('style') || 'flat'; // flat | flat-square | plastic | for-the-badge | social
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Shields.io',
        label, message, color, style,
        svg: `https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(message)}-${color}?style=${style}`,
        png: `https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(message)}-${color}?style=${style}&format=png`,
        response_time: rt()
      });
    }

    // ─── OG IMAGE GENERATOR ───────────────────────────────────────────────────
    if (ep === 'og-image') {
      const title = url.searchParams.get('title') || 'My Website';
      const description = url.searchParams.get('description') || '';
      const brand = url.searchParams.get('brand') || '';
      const prompt = `Open Graph social preview image, website title: "${title}"${description ? `, description: "${description}"` : ''}${brand ? `, brand: "${brand}"` : ''}, clean modern design, 1200x630 format, professional`;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        title, description, brand,
        image: pollinationsImg(prompt, 1200, 630),
        response_time: rt()
      });
    }

    return errRes(res, `Endpoint /api/maker/${ep} not found. Available: canvas, meme, quote-image, qr-styled, avatar, placeholder, password, color-palette, gradient, namecard, thumbnail, banner, profile-pic, lorem, uuid, slug, markdown, badge, og-image`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked', timestamp: new Date().toISOString() });
  }
}

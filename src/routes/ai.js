// Kyoto API — AI Endpoints
// ChatGPT   : free-unoficial-gpt4o-mini-api-g70n.onrender.com
// DALL·E    : image.pollinations.ai
// Translate : lingva.ml

export default async function handler(req, res) {
  const start = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ status: true, message: 'CORS preflight OK', response_time: `${Date.now() - start}ms` });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/ai/', '');

  try {
    // ---------- CHATGPT ----------
    if (endpoint === 'chatgpt') {
      const text = url.searchParams.get('text');
      if (!text) {
        return res.status(400).json({
          status: false, author: 'Kyoto API',
          error: 'Parameter "text" is required',
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }

      let prompt = text;
      if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const messages = body.messages || [{ role: 'user', content: text }];
        prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const external = await fetch(
          `https://free-unoficial-gpt4o-mini-api-g70n.onrender.com/chat/?query=${encodeURIComponent(prompt)}`,
          { headers: { Accept: 'application/json' }, signal: controller.signal }
        );
        clearTimeout(timeout);
        const data = await external.json();

        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'GPT-4o-mini (free-unoficial)',
          result: data.response || data.result || data,
          model: 'gpt-4o-mini',
          timestamp: new Date().toISOString(),
          response_time: `${Date.now() - start}ms`
        });
      } catch (err) {
        clearTimeout(timeout);
        return res.status(500).json({
          status: false, author: 'Kyoto API',
          error: err.name === 'AbortError' ? 'Upstream API timeout' : `Request failed: ${err.message}`,
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
    }

    // ---------- DALL·E ----------
    if (endpoint === 'dalle') {
      const prompt = url.searchParams.get('prompt');
      const size = url.searchParams.get('size') || '512x512';
      if (!prompt) {
        return res.status(400).json({
          status: false, author: 'Kyoto API',
          error: 'Parameter "prompt" is required',
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
      const [w, h] = size.split('x');
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`;

      return res.json({
        status: true,
        author: 'Kyoto API',
        provider: 'Pollinations.ai',
        prompt,
        size: `${w}x${h}`,
        url: imageUrl,
        generated: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    }

    // ---------- TRANSLATE ----------
    if (endpoint === 'translate') {
      const text = url.searchParams.get('text');
      const to = url.searchParams.get('to') || 'en';
      if (!text) {
        return res.status(400).json({
          status: false, author: 'Kyoto API',
          error: 'Parameter "text" is required',
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
      const ext = await fetch(
        `https://lingva.ml/api/v1/auto/${to}/${encodeURIComponent(text)}`,
        { headers: { Accept: 'application/json' } }
      );
      const data = await ext.json();

      return res.json({
        status: true,
        author: 'Kyoto API',
        provider: 'Lingva.ml',
        original: text,
        translated: data.translation || text,
        from: data.info?.detectedSource || 'auto',
        to,
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    }

    // ---------- OCR ----------
    if (endpoint === 'ocr') {
      if (req.method !== 'POST') {
        return res.status(405).json({
          status: false, author: 'Kyoto API',
          error: 'Method not allowed. Use POST with multipart/form-data.',
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
      return res.json({
        status: true,
        author: 'Kyoto API',
        provider: 'Kyoto OCR',
        text: 'OCR processing requires image upload via multipart/form-data.',
        note: 'Upload an image file with key "image" to extract text.',
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    }

    return res.status(404).json({
      status: false, author: 'Kyoto API',
      error: `Endpoint /api/ai/${endpoint} not found`,
      timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
    });
  } catch (err) {
    return res.status(500).json({
      status: false, author: 'Kyoto API',
      error: `Internal server error: ${err.message}`,
      timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
    });
  }
}
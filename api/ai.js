export default async function handler(req, res) {
  const start = Date.now();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ status: true, message: 'CORS preflight OK' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/ai/', '');
  const text = url.searchParams.get('text');

  if (endpoint === 'chatgpt') {
    if (!text) {
      return res.json({
        status: false,
        author: 'Kyoto API',
        error: 'Parameter "text" is required',
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const ext = await fetch(
        `https://free-unoficial-gpt4o-mini-api-g70n.onrender.com/chat/?query=${encodeURIComponent(text)}`,
        { headers: { Accept: 'application/json' }, signal: controller.signal }
      );
      clearTimeout(timeout);
      const data = await ext.json();

      return res.json({
        status: true,
        author: 'Kyoto API',
        provider: 'GPT-4o-mini',
        result: data.response || data.result || data,
        model: 'gpt-4o-mini',
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    } catch (err) {
      clearTimeout(timeout);
      return res.json({
        status: false,
        author: 'Kyoto API',
        error: err.name === 'AbortError' ? 'Upstream API timeout' : `Request failed: ${err.message}`,
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    }
  }

  if (endpoint === 'dalle') {
    const prompt = url.searchParams.get('prompt');
    const size = url.searchParams.get('size') || '512x512';
    if (!prompt) {
      return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "prompt" is required', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }
    const [w, h] = size.split('x');
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`;
    return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt, size, url: imageUrl, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
  }

  if (endpoint === 'translate') {
    const text = url.searchParams.get('text');
    const to = url.searchParams.get('to') || 'en';
    if (!text) {
      return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "text" is required', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }
    try {
      const ext = await fetch(`https://lingva.ml/api/v1/auto/${to}/${encodeURIComponent(text)}`, { headers: { Accept: 'application/json' } });
      const data = await ext.json();
      return res.json({ status: true, author: 'Kyoto API', provider: 'Lingva.ml', original: text, translated: data.translation || text, from: data.info?.detectedSource || 'auto', to, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    } catch (err) {
      return res.json({ status: false, author: 'Kyoto API', error: `Translate failed: ${err.message}`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }
  }

  return res.json({ status: false, author: 'Kyoto API', error: `Endpoint /api/ai/${endpoint} not found`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
}
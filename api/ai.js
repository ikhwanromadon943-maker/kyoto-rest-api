export default async function handler(req, res) {
  const start = Date.now();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ status: true, message: 'CORS preflight OK' });
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const endpoint = url.pathname.replace('/api/ai/', '');
    const text = url.searchParams.get('text');

    // ---------- CHATGPT ----------
    if (endpoint === 'chatgpt') {
      if (!text) {
        return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "text" is required' });
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const ext = await fetch(
          `https://free-unoficial-gpt4o-mini-api-g70n.onrender.com/chat/?query=${encodeURIComponent(text)}`,
          { headers: { Accept: 'application/json' }, signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!ext.ok) {
          return res.json({ status: false, author: 'Kyoto API', error: `Upstream API error: ${ext.status}` });
        }

        const data = await ext.json();
        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'GPT-4o-mini',
          result: data.response || data.result || JSON.stringify(data),
          timestamp: new Date().toISOString(),
          response_time: `${Date.now() - start}ms`
        });
      } catch (err) {
        return res.json({ status: false, author: 'Kyoto API', error: err.name === 'AbortError' ? 'Timeout' : err.message });
      }
    }

    // ---------- DALL·E ----------
    if (endpoint === 'dalle') {
      const prompt = url.searchParams.get('prompt');
      const size = url.searchParams.get('size') || '512x512';
      if (!prompt) {
        return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "prompt" is required' });
      }
      const [w, h] = size.split('x');
      return res.json({
        status: true,
        author: 'Kyoto API',
        provider: 'Pollinations.ai',
        prompt,
        url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`
      });
    }

    // ---------- TRANSLATE ----------
    if (endpoint === 'translate') {
      const text = url.searchParams.get('text');
      const to = url.searchParams.get('to') || 'en';
      if (!text) {
        return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "text" is required' });
      }
      try {
        const ext = await fetch(`https://lingva.ml/api/v1/auto/${to}/${encodeURIComponent(text)}`);
        if (!ext.ok) throw new Error(`Status ${ext.status}`);
        const data = await ext.json();
        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'Lingva.ml',
          original: text,
          translated: data.translation || text,
          to
        });
      } catch (err) {
        return res.json({ status: false, author: 'Kyoto API', error: err.message });
      }
    }

    return res.json({ status: false, author: 'Kyoto API', error: `Endpoint ${endpoint} not found` });
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message });
  }
}
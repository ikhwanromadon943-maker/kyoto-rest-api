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

    // ---------- CHATGPT (by Pollinations.AI) ----------
    if (endpoint === 'chatgpt') {
      if (!text) {
        return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "text" is required' });
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        // API stabil untuk text generation
        const apiUrl = `https://text.pollinations.ai/${encodeURIComponent(text)}`;
        const ext = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!ext.ok) {
          throw new Error(`Upstream API error: ${ext.status}`);
        }

        const result = await ext.text();

        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'Pollinations.AI',
          result: result,
          timestamp: new Date().toISOString(),
          response_time: `${Date.now() - start}ms`
        });
      } catch (err) {
        return res.json({
          status: false,
          author: 'Kyoto API',
          error: err.name === 'AbortError' ? 'Timeout' : `Request failed: ${err.message}`
        });
      }
    }

    // ---------- DALL·E (by Pollinations.AI) ----------
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
        provider: 'Pollinations.AI',
        prompt,
        url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`
      });
    }

    // ---------- TRANSLATE (by Google Translate) ----------
    if (endpoint === 'translate') {
      const text = url.searchParams.get('text');
      const to = url.searchParams.get('to') || 'en';
      if (!text) {
        return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "text" is required' });
      }
      try {
        // API Google Translate paling stabil & tanpa key
        const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
        const ext = await fetch(apiUrl);
        if (!ext.ok) throw new Error(`Status ${ext.status}`);
        const data = await ext.json();
        
        // Parse responsenya (agak unik)
        const translatedText = data?.[0]?.[0]?.[0] || text;

        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'Google Translate',
          original: text,
          translated: translatedText,
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

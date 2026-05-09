// Kyoto API — AI Endpoints
// ChatGPT   : free-unoficial-gpt4o-mini-api-g70n.onrender.com
// DALL·E    : image.pollinations.ai
// Translate : lingva.ml

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/ai/', '');

  try {
    // ---------- CHATGPT ----------
    if (endpoint === 'chatgpt') {
      const text = url.searchParams.get('text');
      if (!text) return res.status(400).json({ error: 'Parameter "text" diperlukan' });

      if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const messages = body.messages || [{ role: 'user', content: text }];
        const userMessage = messages.map(m => m.content).join('\n');
        const external = await fetch(
          `https://free-unoficial-gpt4o-mini-api-g70n.onrender.com/chat/?query=${encodeURIComponent(userMessage)}`,
          { headers: { Accept: 'application/json' } }
        );
        const data = await external.json();
        return res.json({ status: 200, result: data.response || data.result || data, model: 'gpt-4o-mini', timestamp: new Date().toISOString() });
      }

      // GET
      const external = await fetch(
        `https://free-unoficial-gpt4o-mini-api-g70n.onrender.com/chat/?query=${encodeURIComponent(text)}`,
        { headers: { Accept: 'application/json' } }
      );
      const data = await external.json();
      return res.json({ status: 200, result: data.response || data.result || data, model: 'gpt-4o-mini', timestamp: new Date().toISOString() });
    }

    // ---------- DALL·E ----------
    if (endpoint === 'dalle') {
      const prompt = url.searchParams.get('prompt');
      const size = url.searchParams.get('size') || '512x512';
      if (!prompt) return res.status(400).json({ error: 'Parameter "prompt" diperlukan' });
      const [w, h] = size.split('x');
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`;
      return res.json({ status: 200, prompt, size, url: imageUrl, generated: new Date().toISOString() });
    }

    // ---------- TRANSLATE ----------
    if (endpoint === 'translate') {
      const text = url.searchParams.get('text');
      const to = url.searchParams.get('to') || 'en';
      if (!text) return res.status(400).json({ error: 'Parameter "text" diperlukan' });
      const ext = await fetch(
        `https://lingva.ml/api/v1/auto/${to}/${encodeURIComponent(text)}`,
        { headers: { Accept: 'application/json' } }
      );
      const data = await ext.json();
      return res.json({
        status: 200,
        original: text,
        translated: data.translation || text,
        from: data.info?.detectedSource || 'auto',
        to
      });
    }

    // ---------- OCR ----------
    if (endpoint === 'ocr') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Hanya method POST' });
      return res.json({
        status: 200,
        text: 'OCR membutuhkan file binary; silakan upload image melalui form-data.',
        note: 'OCR endpoint tersedia saat Anda mengupload gambar via multipart/form-data.'
      });
    }

    return res.status(404).json({ error: `Endpoint /api/ai/${endpoint} tidak ditemukan` });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menghubungi API eksternal', detail: err.message });
  }
}
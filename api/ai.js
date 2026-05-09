export default async function handler(req, res) {
  const start = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace('/api/ai/', '');

    if (ep === 'chatgpt') {
      const text = url.searchParams.get('text');
      if (!text) return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "text" is required' });
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 10000);
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(text)}`, { signal: c.signal });
      clearTimeout(t);
      if (!ext.ok) throw new Error(`Status ${ext.status}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', result: await ext.text(), timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }

    if (ep === 'dalle') {
      const prompt = url.searchParams.get('prompt');
      const size = url.searchParams.get('size') || '512x512';
      if (!prompt) return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "prompt" is required' });
      const [w, h] = size.split('x');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }

    if (ep === 'translate') {
      const text = url.searchParams.get('text');
      const to = url.searchParams.get('to') || 'en';
      if (!text) return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "text" is required' });
      const ext = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await ext.json();
      return res.json({ status: true, author: 'Kyoto API', provider: 'Google Translate', original: text, translated: data?.[0]?.[0]?.[0] || text, to, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }

    if (ep === 'image-variation') {
      const prompt = url.searchParams.get('prompt');
      if (!prompt) return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "prompt" is required' });
      const seed = Math.floor(Math.random() * 1000000);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=512&height=512&nologo=true`, seed, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }

    if (ep === 'text-to-speech') {
      const text = url.searchParams.get('text');
      if (!text) return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "text" is required' });
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', audio_url: `https://text.pollinations.ai/${encodeURIComponent(text)}?model=openai-audio`, text, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }

    return res.json({ status: false, author: 'Kyoto API', error: `Endpoint /api/ai/${ep} not found` });
  } catch (err) { return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message }); }
}
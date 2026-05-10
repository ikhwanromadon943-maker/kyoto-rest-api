import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/ai\/?/, '');
    const rt = () => `${Date.now() - start}ms`;

    if (ep === 'chatgpt') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 10000);
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(text)}`, { signal: c.signal });
      clearTimeout(t);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', result: await ext.text(), timestamp: new Date().toISOString(), response_time: rt() });
    }

    if (ep === 'dalle') {
      const prompt = url.searchParams.get('prompt'); const size = url.searchParams.get('size') || '512x512';
      if (!prompt) return errRes(res, 'Parameter "prompt" is required');
      const [w, h] = size.split('x');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`, timestamp: new Date().toISOString(), response_time: rt() });
    }

    if (ep === 'translate') {
      const text = url.searchParams.get('text'); const to = url.searchParams.get('to') || 'en';
      if (!text) return errRes(res, 'Parameter "text" is required');
      const data = await safeFetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Google Translate', original: text, translated: data?.[0]?.[0]?.[0] || text, to, timestamp: new Date().toISOString(), response_time: rt() });
    }

    if (ep === 'text-to-speech') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', audio_url: `https://text.pollinations.ai/${encodeURIComponent(text)}?model=openai-audio`, text, timestamp: new Date().toISOString(), response_time: rt() });
    }

    if (ep === 'image-variation') {
      const prompt = url.searchParams.get('prompt');
      if (!prompt) return errRes(res, 'Parameter "prompt" is required');
      const seed = Math.floor(Math.random() * 1000000);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=512&height=512&nologo=true`, seed, timestamp: new Date().toISOString(), response_time: rt() });
    }

    if (ep === 'summarize') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 10000);
      const prompt = `Summarize the following text concisely in 2-3 sentences: ${text}`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: c.signal });
      clearTimeout(t);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', original_length: text.length, summary: await ext.text(), timestamp: new Date().toISOString(), response_time: rt() });
    }

    if (ep === 'roast') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 10000);
      const prompt = `Roast this in a funny, witty way (max 2 sentences): ${text}`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: c.signal });
      clearTimeout(t);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', target: text, roast: await ext.text(), timestamp: new Date().toISOString(), response_time: rt() });
    }

    if (ep === 'eli5') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 10000);
      const prompt = `Explain this like I am 5 years old, simply and clearly: ${text}`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: c.signal });
      clearTimeout(t);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', topic: text, explanation: await ext.text(), timestamp: new Date().toISOString(), response_time: rt() });
    }

    if (ep === 'detect-language') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const data = await safeFetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Google Translate', text, detected_language: data?.[2] || 'unknown', timestamp: new Date().toISOString(), response_time: rt() });
    }

    if (ep === 'ask') {
      const q = url.searchParams.get('q');
      if (!q) return errRes(res, 'Parameter "q" is required');
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 10000);
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(q)}`, { signal: c.signal });
      clearTimeout(t);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', question: q, answer: await ext.text(), timestamp: new Date().toISOString(), response_time: rt() });
    }

    if (ep === 'random-image') {
      const topics = ['futuristic city', 'anime landscape', 'fantasy forest', 'cyberpunk street', 'space nebula', 'underwater world', 'ancient temple', 'robot samurai'];
      const prompt = topics[Math.floor(Math.random() * topics.length)];
      const seed = Math.floor(Math.random() * 999999);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt, url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=512&height=512&nologo=true`, seed, timestamp: new Date().toISOString(), response_time: rt() });
    }

    return errRes(res, `Endpoint /api/ai/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}

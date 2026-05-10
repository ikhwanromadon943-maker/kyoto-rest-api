import { safeFetch, setCORS, errRes, checkRateLimit, logRequest, logAbuse } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/ai\/?/, '');
    const rt = () => `${Date.now() - start}ms`;

    // ===== EXISTING ENDPOINTS (OPTIMIZED) =====
    
    if (ep === 'chatgpt') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(text)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      const result = await ext.text();
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        result, timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'dalle') {
      const prompt = url.searchParams.get('prompt');
      const size = url.searchParams.get('size') || '512x512';
      if (!prompt) return errRes(res, 'Parameter "prompt" is required');
      const [w, h] = size.split('x');
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        prompt,
        url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`,
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'translate') {
      const text = url.searchParams.get('text');
      const to = url.searchParams.get('to') || 'en';
      if (!text) return errRes(res, 'Parameter "text" is required');
      const data = await safeFetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(text)}`
      );
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Google Translate',
        original: text, translated: data?.[0]?.[0]?.[0] || text,
        to, timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'text-to-speech') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        audio_url: `https://text.pollinations.ai/${encodeURIComponent(text)}?model=openai-audio`,
        text, timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'image-variation') {
      const prompt = url.searchParams.get('prompt');
      if (!prompt) return errRes(res, 'Parameter "prompt" is required');
      const seed = Math.floor(Math.random() * 1000000);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        prompt,
        url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=512&height=512&nologo=true`,
        seed, timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'summarize') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const prompt = `Summarize the following text concisely in 2-3 sentences:\n\n${text}`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        original_length: text.length, summary: await ext.text(),
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'roast') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const prompt = `Roast this in a funny, witty way (max 2 sentences):\n${text}`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        target: text, roast: await ext.text(),
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'eli5') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const prompt = `Explain this like I am 5 years old, simply and clearly:\n${text}`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        topic: text, explanation: await ext.text(),
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'detect-language') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const data = await safeFetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`
      );
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Google Translate',
        text, detected_language: data?.[2] || 'unknown',
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'ask') {
      const q = url.searchParams.get('q');
      if (!q) return errRes(res, 'Parameter "q" is required');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(q)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        question: q, answer: await ext.text(),
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'random-image') {
      const topics = [
        'futuristic city', 'anime landscape', 'fantasy forest',
        'cyberpunk street', 'space nebula', 'underwater world',
        'ancient temple', 'robot samurai', 'dragon mountain',
        'steampunk airship'
      ];
      const prompt = topics[Math.floor(Math.random() * topics.length)];
      const seed = Math.floor(Math.random() * 999999);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        prompt,
        url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=512&height=512&nologo=true`,
        seed, timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    // ===== NEW ENDPOINTS =====
    
    if (ep === 'sentiment') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const prompt = `Analyze sentiment of this text. Reply ONLY with JSON: {"sentiment":"positive/negative/neutral","confidence":0-100,"emotion":"happy/sad/angry/excited/etc"}\nText: ${text}`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      const result = await ext.text();
      let parsed;
      try {
        parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
      } catch {
        parsed = { sentiment: result.includes('positive') ? 'positive' : 'neutral', confidence: 70, raw: result };
      }
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        text, ...parsed, timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'keywords') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const prompt = `Extract 5-10 main keywords from this text. Reply ONLY with a JSON array of strings.\nText: ${text}`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      const result = await ext.text();
      let keywords;
      try {
        keywords = JSON.parse(result.replace(/```json|```/g, '').trim());
      } catch {
        keywords = result.split(',').map(k => k.trim().replace(/^["']|["']$/g, ''));
      }
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        text: text.slice(0, 100) + '...', keywords,
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'grammar') {
      const text = url.searchParams.get('text');
      const lang = url.searchParams.get('lang') || 'en-US';
      if (!text) return errRes(res, 'Parameter "text" is required');
      try {
        const data = await safeFetch('https://api.languagetool.org/v2/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ text, language: lang })
        }, 8000);
        return res.json({
          status: true, author: 'Kyoto API', provider: 'LanguageTool',
          text: text.slice(0, 150) + (text.length > 150 ? '...' : ''),
          matches: (data.matches || []).map(m => ({
            message: m.message, short_message: m.shortMessage,
            replacements: m.replacements?.slice(0, 3).map(r => r.value),
            offset: m.offset, length: m.length
          })),
          total_issues: data.matches?.length || 0,
          timestamp: new Date().toISOString(), response_time: rt()
        });
      } catch {
        // Fallback to Pollinations
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const prompt = `Check grammar and spelling of this text. List errors found:\n"${text}"`;
        const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Pollinations.ai (fallback)',
          text, analysis: await ext.text(),
          timestamp: new Date().toISOString(), response_time: rt()
        });
      }
    }

    if (ep === 'paraphrase') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const prompt = `Paraphrase this text while maintaining the same meaning. Make it sound different but convey the same message:\n"${text}"`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        original: text, paraphrased: await ext.text(),
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'math') {
      const problem = url.searchParams.get('problem');
      if (!problem) return errRes(res, 'Parameter "problem" is required');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const prompt = `Solve this math problem step by step. Show your work:\n${problem}`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        problem, solution: await ext.text(),
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'code') {
      const prompt = url.searchParams.get('prompt');
      const lang = url.searchParams.get('lang') || 'python';
      if (!prompt) return errRes(res, 'Parameter "prompt" is required');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const fullPrompt = `Write ${lang} code for: ${prompt}. Return ONLY the code, no explanations.`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      let code = await ext.text();
      code = code.replace(/```[\w]*\n?|```/g, '').trim();
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        prompt, language: lang, code,
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    if (ep === 'poetry') {
      const theme = url.searchParams.get('theme') || 'love';
      try {
        const data = await safeFetch(`https://poetrydb.org/theme/${encodeURIComponent(theme)}`, {}, 6000);
        const poem = data[Math.floor(Math.random() * data.length)];
        return res.json({
          status: true, author: 'Kyoto API', provider: 'PoetryDB',
          title: poem?.title, author: poem?.author,
          poem: poem?.lines, linecount: poem?.linecount,
          timestamp: new Date().toISOString(), response_time: rt()
        });
      } catch {
        // Fallback ke Pollinations
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const prompt = `Write a short poem about ${theme}. Max 8 lines.`;
        const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Pollinations.ai (AI-generated)',
          theme, poem: (await ext.text()).split('\n').filter(l => l.trim()),
          timestamp: new Date().toISOString(), response_time: rt()
        });
      }
    }

    if (ep === 'story') {
      const prompt = url.searchParams.get('prompt');
      if (!prompt) return errRes(res, 'Parameter "prompt" is required');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const fullPrompt = `Write a creative short story (200-300 words) based on this premise:\n${prompt}`;
      const ext = await fetch(`https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!ext.ok) throw new Error(`Upstream error: HTTP ${ext.status}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        prompt, story: await ext.text(),
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    return errRes(res, `Endpoint /api/ai/${ep} not found. Available: chatgpt, dalle, translate, text-to-speech, image-variation, summarize, roast, eli5, detect-language, ask, random-image, sentiment, keywords, grammar, paraphrase, math, code, poetry, story`);
  
  } catch (err) {
    return res.status(500).json({
      status: false, author: 'Kyoto API',
      error: err.message,
      hint: 'Upstream API may be rate-limited or blocked. Try again in 60 seconds.',
      timestamp: new Date().toISOString()
    });
  }
}
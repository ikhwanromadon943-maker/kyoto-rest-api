import { fetchAI, safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/ai\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  try {
    // ─── CHAT / ASK ───────────────────────────────────────────────────────────
    if (ep === 'chatgpt' || ep === 'ask') {
      const text = url.searchParams.get('text') || url.searchParams.get('q');
      if (!text) return errRes(res, `Parameter "${ep === 'ask' ? 'q' : 'text'}" is required`);
      const result = await fetchAI(text);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', result, timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── IMAGE GENERATION ─────────────────────────────────────────────────────
    if (ep === 'dalle' || ep === 'imagine') {
      const prompt = url.searchParams.get('prompt');
      if (!prompt) return errRes(res, 'Parameter "prompt" is required');
      const size = url.searchParams.get('size') || '512x512';
      const [w, h] = size.split('x').map(Number);
      const width = Math.min(w || 512, 1280);
      const height = Math.min(h || 512, 1280);
      const seed = Math.floor(Math.random() * 999999);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        prompt, width, height, seed,
        url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`,
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    // ─── TRANSLATE ────────────────────────────────────────────────────────────
    if (ep === 'translate') {
      const text = url.searchParams.get('text');
      const to = url.searchParams.get('to') || 'en';
      const from = url.searchParams.get('from') || 'auto';
      if (!text) return errRes(res, 'Parameter "text" is required');
      try {
        const data = await safeFetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&dt=ld&q=${encodeURIComponent(text)}`,
          {}, 8000
        );
        const translated = (data?.[0] || []).map(seg => seg?.[0]).filter(Boolean).join('');
        const detectedLang = data?.[2] || from;
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Google Translate',
          original: text, translated: translated || text,
          from: detectedLang, to,
          timestamp: new Date().toISOString(), response_time: rt()
        });
      } catch {
        // Fallback: AI translate
        const result = await fetchAI(`Translate this text to ${to}. Reply ONLY with the translation, no extra text:\n"${text}"`);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai (fallback)', original: text, translated: result.trim(), to, timestamp: new Date().toISOString(), response_time: rt() });
      }
    }

    // ─── TEXT TO SPEECH ───────────────────────────────────────────────────────
    if (ep === 'text-to-speech' || ep === 'tts') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const voice = url.searchParams.get('voice') || 'alloy';
      const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
      const safeVoice = validVoices.includes(voice) ? voice : 'alloy';
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai',
        text, voice: safeVoice,
        audio_url: `https://text.pollinations.ai/${encodeURIComponent(text)}?model=openai-audio&voice=${safeVoice}`,
        note: 'Audio URL — play directly in browser or fetch as audio/mpeg',
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    // ─── SUMMARIZE ────────────────────────────────────────────────────────────
    if (ep === 'summarize') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const sentences = parseInt(url.searchParams.get('sentences')) || 3;
      const summary = await fetchAI(`Summarize the following text in ${sentences} concise sentence(s). Reply ONLY with the summary:\n\n${text}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', original_length: text.length, summary: summary.trim(), sentences_requested: sentences, timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── ROAST ────────────────────────────────────────────────────────────────
    if (ep === 'roast') {
      const text = url.searchParams.get('text');
      const level = url.searchParams.get('level') || 'mild'; // mild | medium | savage
      if (!text) return errRes(res, 'Parameter "text" is required');
      const intensity = { mild: 'mildly and playfully', medium: 'with sharp wit', savage: 'brutally and savagely' }[level] || 'with sharp wit';
      const roast = await fetchAI(`Roast this ${intensity} in 1-2 funny sentences. NO disclaimers, NO apologies, just the roast:\n${text}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', target: text, level, roast: roast.trim(), timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── ELI5 ─────────────────────────────────────────────────────────────────
    if (ep === 'eli5') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const explanation = await fetchAI(`Explain this like I am 5 years old, simply and clearly. No jargon:\n${text}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', topic: text, explanation: explanation.trim(), timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── SENTIMENT ────────────────────────────────────────────────────────────
    if (ep === 'sentiment') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const raw = await fetchAI(`Analyze the sentiment of this text. Reply ONLY with a valid JSON object with keys: sentiment (positive/negative/neutral), confidence (0-100), emoji, reason (max 20 words).\nText: "${text}"`);
      let parsed;
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch {
        const lower = raw.toLowerCase();
        parsed = {
          sentiment: lower.includes('positive') ? 'positive' : lower.includes('negative') ? 'negative' : 'neutral',
          confidence: 70, emoji: '😐', reason: raw.slice(0, 80)
        };
      }
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', text, ...parsed, timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── KEYWORDS ─────────────────────────────────────────────────────────────
    if (ep === 'keywords') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const count = Math.min(parseInt(url.searchParams.get('count')) || 8, 20);
      const raw = await fetchAI(`Extract ${count} main keywords from this text. Reply ONLY with a JSON array of strings, no extra text.\nText: ${text}`);
      let keywords;
      try {
        keywords = JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch {
        keywords = raw.split(',').map(k => k.trim().replace(/^["'\[\]]|["'\[\]]$/g, '')).filter(Boolean);
      }
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', text: text.slice(0, 100) + (text.length > 100 ? '...' : ''), keywords, count: keywords.length, timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── GRAMMAR ─────────────────────────────────────────────────────────────
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
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'LanguageTool',
          text: text.slice(0, 150) + (text.length > 150 ? '...' : ''),
          total_issues: data.matches?.length || 0,
          matches: (data.matches || []).map(m => ({
            message: m.message,
            short_message: m.shortMessage,
            replacements: m.replacements?.slice(0, 3).map(r => r.value),
            offset: m.offset, length: m.length
          })),
          timestamp: new Date().toISOString(), response_time: rt()
        });
      } catch {
        const analysis = await fetchAI(`Find grammar and spelling errors in this text. List them clearly:\n"${text}"`);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai (fallback)', text, analysis: analysis.trim(), timestamp: new Date().toISOString(), response_time: rt() });
      }
    }

    // ─── PARAPHRASE ───────────────────────────────────────────────────────────
    if (ep === 'paraphrase') {
      const text = url.searchParams.get('text');
      const tone = url.searchParams.get('tone') || 'neutral'; // neutral | formal | casual
      if (!text) return errRes(res, 'Parameter "text" is required');
      const paraphrased = await fetchAI(`Paraphrase this text in a ${tone} tone. Keep the same meaning but use different words and structure. Reply ONLY with the paraphrased version:\n"${text}"`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', original: text, paraphrased: paraphrased.trim(), tone, timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── MATH SOLVER ──────────────────────────────────────────────────────────
    if (ep === 'math') {
      const problem = url.searchParams.get('problem');
      if (!problem) return errRes(res, 'Parameter "problem" is required');
      const solution = await fetchAI(`Solve this math problem step by step. Be clear and show your work:\n${problem}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', problem, solution: solution.trim(), timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── CODE GENERATOR ───────────────────────────────────────────────────────
    if (ep === 'code') {
      const prompt = url.searchParams.get('prompt');
      const lang = url.searchParams.get('lang') || 'python';
      if (!prompt) return errRes(res, 'Parameter "prompt" is required');
      let code = await fetchAI(`Write clean ${lang} code for: ${prompt}. Return ONLY the code, no explanations, no markdown.`);
      code = code.replace(/```[\w]*\n?|```/g, '').trim();
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt, language: lang, code, timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── POETRY ───────────────────────────────────────────────────────────────
    if (ep === 'poetry') {
      const theme = url.searchParams.get('theme') || 'love';
      try {
        const data = await safeFetch(`https://poetrydb.org/theme/${encodeURIComponent(theme)}`, {}, 6000);
        if (!Array.isArray(data) || data.length === 0) throw new Error('No poems found');
        const poem = data[Math.floor(Math.random() * data.length)];
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'PoetryDB', title: poem?.title, poet: poem?.author, poem: poem?.lines, linecount: poem?.linecount, timestamp: new Date().toISOString(), response_time: rt() });
      } catch {
        const poem = await fetchAI(`Write a short, beautiful poem about "${theme}". Max 10 lines. No title needed.`);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai (AI-generated)', theme, poem: poem.trim().split('\n').filter(l => l.trim()), timestamp: new Date().toISOString(), response_time: rt() });
      }
    }

    // ─── STORY GENERATOR ──────────────────────────────────────────────────────
    if (ep === 'story') {
      const prompt = url.searchParams.get('prompt');
      const genre = url.searchParams.get('genre') || 'fiction';
      if (!prompt) return errRes(res, 'Parameter "prompt" is required');
      const story = await fetchAI(`Write a creative ${genre} short story (200-300 words) based on this premise: ${prompt}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt, genre, story: story.trim(), word_count: story.trim().split(/\s+/).length, timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── DETECT LANGUAGE ──────────────────────────────────────────────────────
    if (ep === 'detect-language') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      try {
        const data = await safeFetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`, {}, 6000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Google Translate', text, detected_language: data?.[2] || 'unknown', timestamp: new Date().toISOString(), response_time: rt() });
      } catch {
        const result = await fetchAI(`Detect the language of this text. Reply ONLY with the ISO language code (e.g. "en", "id", "ja"):\n"${text}"`);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai (fallback)', text, detected_language: result.trim().toLowerCase().slice(0, 5), timestamp: new Date().toISOString(), response_time: rt() });
      }
    }

    // ─── IMAGE VARIATION ──────────────────────────────────────────────────────
    if (ep === 'image-variation') {
      const prompt = url.searchParams.get('prompt');
      if (!prompt) return errRes(res, 'Parameter "prompt" is required');
      const seeds = Array.from({ length: 3 }, () => Math.floor(Math.random() * 999999));
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt,
        variations: seeds.map((seed, i) => ({
          variation: i + 1, seed,
          url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&seed=${seed}&nologo=true`
        })),
        timestamp: new Date().toISOString(), response_time: rt()
      });
    }

    // ─── TWEET GENERATOR ──────────────────────────────────────────────────────
    if (ep === 'tweet') {
      const topic = url.searchParams.get('topic');
      const tone = url.searchParams.get('tone') || 'engaging'; // engaging | funny | professional | motivational
      if (!topic) return errRes(res, 'Parameter "topic" is required');
      const tweet = await fetchAI(`Write a ${tone} tweet about "${topic}". Max 280 characters. Include relevant hashtags. Reply ONLY with the tweet text.`);
      const result = tweet.trim().slice(0, 280);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', topic, tone, tweet: result, character_count: result.length, timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── CAPTION GENERATOR ────────────────────────────────────────────────────
    if (ep === 'caption') {
      const topic = url.searchParams.get('topic');
      const platform = url.searchParams.get('platform') || 'instagram'; // instagram | tiktok | linkedin | twitter
      if (!topic) return errRes(res, 'Parameter "topic" is required');
      const caption = await fetchAI(`Write a ${platform} caption for: "${topic}". Include emojis and relevant hashtags. Keep it engaging and platform-appropriate. Reply ONLY with the caption.`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', topic, platform, caption: caption.trim(), timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── CHAT (multi-turn style) ───────────────────────────────────────────────
    if (ep === 'chat') {
      const message = url.searchParams.get('message');
      const system = url.searchParams.get('system') || 'You are a helpful assistant.';
      if (!message) return errRes(res, 'Parameter "message" is required');
      const result = await fetchAI(`${system}\n\nUser: ${message}\nAssistant:`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', message, reply: result.trim(), timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── RECIPE GENERATOR ─────────────────────────────────────────────────────
    if (ep === 'recipe') {
      const dish = url.searchParams.get('dish');
      if (!dish) return errRes(res, 'Parameter "dish" is required');
      const raw = await fetchAI(`Create a recipe for "${dish}". Reply ONLY with valid JSON with keys: name, description, prep_time, cook_time, servings, ingredients (array), steps (array), tips (array).`);
      let recipe;
      try {
        recipe = JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch {
        recipe = { name: dish, raw: raw.trim() };
      }
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', ...recipe, timestamp: new Date().toISOString(), response_time: rt() });
    }

    // ─── QUIZ GENERATOR ───────────────────────────────────────────────────────
    if (ep === 'quiz') {
      const topic = url.searchParams.get('topic');
      const difficulty = url.searchParams.get('difficulty') || 'medium';
      const count = Math.min(parseInt(url.searchParams.get('count')) || 5, 10);
      if (!topic) return errRes(res, 'Parameter "topic" is required');
      const raw = await fetchAI(`Generate ${count} ${difficulty} multiple-choice quiz questions about "${topic}". Reply ONLY with a JSON array. Each item: { question, options: [A,B,C,D], answer, explanation }.`);
      let questions;
      try {
        questions = JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch {
        questions = [{ raw: raw.trim() }];
      }
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', topic, difficulty, count: questions.length, questions, timestamp: new Date().toISOString(), response_time: rt() });
    }

    return errRes(res, `Endpoint /api/ai/${ep} not found. Check /category for available endpoints.`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'AI service may be busy — try again in a moment.', timestamp: new Date().toISOString() });
  }
}

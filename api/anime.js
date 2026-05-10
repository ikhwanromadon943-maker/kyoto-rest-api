import { safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest, logAbuse } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/anime\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  // Rate limit check
  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  try {
    if (ep === 'search') {
      const q = url.searchParams.get('query');
      const type = url.searchParams.get('type') || 'anime';
      if (!q) return errRes(res, 'Parameter "query" is required');
      const endpoint = type === 'manga' ? 'manga' : 'anime';
      const d = await safeFetch(`https://api.jikan.moe/v4/${endpoint}?q=${encodeURIComponent(q)}&limit=10&order_by=popularity`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', type, results: (d.data || []).map(i => ({ id: i.mal_id, title: i.title, image: i.images?.jpg?.image_url, score: i.score, synopsis: i.synopsis?.slice(0, 150) })), response_time: rt() });
    }

    if (ep === 'anime') {
      const title = url.searchParams.get('title');
      if (!title) return errRes(res, 'Parameter "title" is required');
      const d = await safeFetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
      const a = d.data?.[0] || {};
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', title: a.title, episodes: a.episodes, score: a.score, image: a.images?.jpg?.large_image_url, synopsis: a.synopsis?.slice(0, 300), genres: a.genres?.map(g => g.name), status: a.status, rating: a.rating, response_time: rt() });
    }

    if (ep === 'random') {
      for (let i = 0; i < 3; i++) {
        const id = Math.floor(Math.random() * 50000) + 1;
        try {
          const d = await safeFetch(`https://api.jikan.moe/v4/anime/${id}/full`);
          const a = d.data || {};
          logRequest(url.pathname, ip, ua, rt());
          return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', anime: { id: a.mal_id, title: a.title, episodes: a.episodes, score: a.score, image: a.images?.jpg?.image_url, synopsis: a.synopsis?.slice(0, 200) }, response_time: rt() });
        } catch (_) {}
      }
      return errRes(res, 'Failed to get random anime after 3 attempts');
    }

    if (ep === 'waifu') {
      const cat = url.searchParams.get('category') || 'waifu';
      const allowed = ['waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe'];
      if (!allowed.includes(cat)) return errRes(res, `Invalid category. Allowed: ${allowed.join(', ')}`);
      const d = await safeFetch(`https://api.waifu.pics/sfw/${cat}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Waifu.pics', category: cat, url: d.url, response_time: rt() });
    }

    if (ep === 'character') {
      const q = url.searchParams.get('query');
      if (!q) return errRes(res, 'Parameter "query" is required');
      const d = await safeFetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(q)}&limit=5`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', results: (d.data || []).map(i => ({ id: i.mal_id, name: i.name, image: i.images?.jpg?.image_url, about: i.about?.slice(0, 200), favorites: i.favorites })), response_time: rt() });
    }

    if (ep === 'top') {
      const type = url.searchParams.get('type') || 'anime';
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 10, 25);
      const d = await safeFetch(`https://api.jikan.moe/v4/top/${type}?limit=${limit}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', type, results: (d.data || []).map((a, i) => ({ rank: i + 1, id: a.mal_id, title: a.title, score: a.score, episodes: a.episodes, image: a.images?.jpg?.image_url })), response_time: rt() });
    }

    if (ep === 'genre') {
      const genre_id = url.searchParams.get('id') || '1';
      const d = await safeFetch(`https://api.jikan.moe/v4/anime?genres=${genre_id}&order_by=score&sort=desc&limit=10`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', genre_id, results: (d.data || []).map(a => ({ id: a.mal_id, title: a.title, score: a.score, episodes: a.episodes, image: a.images?.jpg?.image_url })), response_time: rt() });
    }

    if (ep === 'schedule') {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const day = url.searchParams.get('day') || days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
      if (!days.includes(day)) return errRes(res, `Invalid day. Use: ${days.join(', ')}`);
      const d = await safeFetch(`https://api.jikan.moe/v4/schedules/${day}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', day, results: (d.data || []).slice(0, 10).map(a => ({ id: a.mal_id, title: a.title, episodes: a.episodes, score: a.score, image: a.images?.jpg?.image_url })), response_time: rt() });
    }

    if (ep === 'random-waifu') {
      const cats = ['waifu', 'neko', 'shinobu', 'megumin'];
      const cat = cats[Math.floor(Math.random() * cats.length)];
      const d = await safeFetch(`https://api.waifu.pics/sfw/${cat}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Waifu.pics', category: cat, url: d.url, response_time: rt() });
    }

    if (ep === 'news') {
      const d = await safeFetch('https://api.jikan.moe/v4/anime?order_by=start_date&sort=desc&limit=15');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', results: (d.data || []).slice(0, 10).map(a => ({ id: a.mal_id, title: a.title, type: a.type, episodes: a.episodes, image: a.images?.jpg?.image_url, synopsis: a.synopsis?.slice(0, 100) })), response_time: rt() });
    }

    if (ep === 'quotes') {
      const title = url.searchParams.get('title');
      try {
        const endpoint = title ? `https://animechan.xyz/api/random/anime?title=${encodeURIComponent(title)}` : 'https://animechan.xyz/api/random';
        const d = await safeFetch(endpoint, {}, 6000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'AnimeChan', quote: d.quote, character: d.character, anime: d.anime, response_time: rt() });
      } catch { return errRes(res, 'Failed to fetch anime quote. Try again.'); }
    }

    if (ep === 'recommendations') {
      try {
        const d = await safeFetch('https://api.jikan.moe/v4/recommendations/anime');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', recommendations: (d.data || []).slice(0, 10).map(r => ({ title: r.entry?.[0]?.title, url: r.entry?.[0]?.url, image: r.entry?.[0]?.images?.jpg?.image_url, votes: r.votes })), response_time: rt() });
      } catch { return errRes(res, 'Failed to fetch recommendations'); }
    }

    if (ep === 'seasonal') {
      try {
        const d = await safeFetch('https://api.jikan.moe/v4/seasons/now');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', season: 'current', results: (d.data || []).slice(0, 15).map(a => ({ id: a.mal_id, title: a.title, episodes: a.episodes, score: a.score, image: a.images?.jpg?.image_url, genres: a.genres?.map(g => g.name) })), response_time: rt() });
      } catch { return errRes(res, 'Failed to fetch seasonal anime'); }
    }

    if (ep === 'reviews') {
      try {
        const d = await safeFetch('https://api.jikan.moe/v4/reviews/anime?preliminary=true&spoiler=false');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', reviews: (d.data || []).slice(0, 10).map(r => ({ title: r.entry?.title, reviewer: r.user?.username, score: r.score, review: r.review?.slice(0, 200), date: r.date })), response_time: rt() });
      } catch { return errRes(res, 'Failed to fetch reviews'); }
    }

    if (ep === 'studios') {
      const id = url.searchParams.get('id');
      if (!id) return errRes(res, 'Parameter "id" is required');
      try {
        const d = await safeFetch(`https://api.jikan.moe/v4/producers/${id}`);
        const p = d.data || {};
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', studio: { id: p.mal_id, name: p.titles?.[0]?.title, established: p.established, about: p.about?.slice(0, 300), favorites: p.favorites, count: p.count }, response_time: rt() });
      } catch { return errRes(res, 'Failed to fetch studio info'); }
    }

    return errRes(res, `Endpoint /api/anime/${ep} not found`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked', timestamp: new Date().toISOString() });
  }
}
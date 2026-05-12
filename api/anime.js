import { safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/anime\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  // Jikan has a 1 req/s rate limit — small delay helper
  const jikanFetch = (path) => safeFetch(`https://api.jikan.moe/v4${path}`, {}, 10000);

  try {
    // ─── SEARCH ──────────────────────────────────────────────────────────────
    if (ep === 'search') {
      const q = url.searchParams.get('query');
      const type = url.searchParams.get('type') || 'anime'; // anime | manga
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 10, 25);
      if (!q) return errRes(res, 'Parameter "query" is required');
      const endpoint = type === 'manga' ? 'manga' : 'anime';
      const d = await jikanFetch(`/${endpoint}?q=${encodeURIComponent(q)}&limit=${limit}&order_by=popularity`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4', type,
        total: d.pagination?.items?.total || d.data?.length || 0,
        results: (d.data || []).map(i => ({
          id: i.mal_id, title: i.title, title_english: i.title_english,
          image: i.images?.jpg?.image_url,
          score: i.score, scored_by: i.scored_by,
          episodes: i.episodes, status: i.status,
          genres: i.genres?.map(g => g.name),
          synopsis: i.synopsis?.slice(0, 180) + (i.synopsis?.length > 180 ? '...' : '')
        })),
        response_time: rt()
      });
    }

    // ─── ANIME INFO ───────────────────────────────────────────────────────────
    if (ep === 'anime') {
      const title = url.searchParams.get('title');
      const id = url.searchParams.get('id');
      if (!title && !id) return errRes(res, 'Parameter "title" or "id" is required');
      let a;
      if (id) {
        const d = await jikanFetch(`/anime/${id}/full`);
        a = d.data || {};
      } else {
        const d = await jikanFetch(`/anime?q=${encodeURIComponent(title)}&limit=1`);
        a = d.data?.[0] || {};
      }
      if (!a.mal_id) return errRes(res, 'Anime not found');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        id: a.mal_id, title: a.title, title_english: a.title_english,
        title_japanese: a.title_japanese,
        episodes: a.episodes, score: a.score, scored_by: a.scored_by,
        rank: a.rank, popularity: a.popularity,
        image: a.images?.jpg?.large_image_url,
        trailer: a.trailer?.url,
        synopsis: a.synopsis,
        genres: a.genres?.map(g => g.name),
        themes: a.themes?.map(t => t.name),
        studios: a.studios?.map(s => s.name),
        status: a.status, rating: a.rating,
        aired: a.aired?.string, duration: a.duration,
        source: a.source, type: a.type,
        response_time: rt()
      });
    }

    // ─── MANGA INFO ───────────────────────────────────────────────────────────
    if (ep === 'manga') {
      const title = url.searchParams.get('title');
      const id = url.searchParams.get('id');
      if (!title && !id) return errRes(res, 'Parameter "title" or "id" is required');
      let m;
      if (id) {
        const d = await jikanFetch(`/manga/${id}`);
        m = d.data || {};
      } else {
        const d = await jikanFetch(`/manga?q=${encodeURIComponent(title)}&limit=1`);
        m = d.data?.[0] || {};
      }
      if (!m.mal_id) return errRes(res, 'Manga not found');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        id: m.mal_id, title: m.title, title_english: m.title_english,
        chapters: m.chapters, volumes: m.volumes,
        score: m.score, rank: m.rank, popularity: m.popularity,
        image: m.images?.jpg?.large_image_url,
        synopsis: m.synopsis,
        genres: m.genres?.map(g => g.name),
        authors: m.authors?.map(a => a.name),
        status: m.status, published: m.published?.string,
        response_time: rt()
      });
    }

    // ─── RANDOM ───────────────────────────────────────────────────────────────
    if (ep === 'random') {
      const type = url.searchParams.get('type') || 'anime'; // anime | manga
      const d = await jikanFetch(`/random/${type}`);
      const a = d.data || {};
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4', type,
        id: a.mal_id, title: a.title, title_english: a.title_english,
        episodes: a.episodes, score: a.score,
        image: a.images?.jpg?.image_url,
        synopsis: a.synopsis?.slice(0, 250),
        genres: a.genres?.map(g => g.name),
        status: a.status,
        response_time: rt()
      });
    }

    // ─── WAIFU ────────────────────────────────────────────────────────────────
    if (ep === 'waifu') {
      const cat = url.searchParams.get('category') || 'waifu';
      const type = url.searchParams.get('type') || 'sfw'; // sfw | nsfw (nsfw filtered server-side)
      const allowedSFW = ['waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'happy', 'wink', 'poke', 'dance', 'cringe'];
      const safeType = 'sfw'; // always SFW
      if (!allowedSFW.includes(cat)) return errRes(res, `Invalid category. Allowed: ${allowedSFW.join(', ')}`);
      const d = await safeFetch(`https://api.waifu.pics/sfw/${cat}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Waifu.pics', category: cat, type: safeType, url: d.url, response_time: rt() });
    }

    // ─── WAIFU.IM ─────────────────────────────────────────────────────────────
    if (ep === 'waifu-im') {
      const tag = url.searchParams.get('tag') || 'waifu';
      const validTags = ['waifu', 'maid', 'marin-kitagawa', 'mori-calliope', 'raiden-shogun', 'oppai', 'selfies', 'uniform'];
      if (!validTags.includes(tag)) return errRes(res, `Invalid tag. Allowed: ${validTags.join(', ')}`);
      const d = await safeFetch(`https://api.waifu.im/search?included_tags=${tag}&is_nsfw=false`, {}, 8000);
      const img = d.images?.[0];
      if (!img) throw new Error('No image returned');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Waifu.im', tag, url: img.url, preview: img.preview_url, artist: img.artist?.name, source: img.source, response_time: rt() });
    }

    // ─── CHARACTER ────────────────────────────────────────────────────────────
    if (ep === 'character') {
      const q = url.searchParams.get('query');
      if (!q) return errRes(res, 'Parameter "query" is required');
      const d = await jikanFetch(`/characters?q=${encodeURIComponent(q)}&limit=5`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        results: (d.data || []).map(i => ({
          id: i.mal_id, name: i.name, name_kanji: i.name_kanji,
          image: i.images?.jpg?.image_url,
          about: i.about?.slice(0, 200),
          favorites: i.favorites,
          nicknames: i.nicknames
        })),
        response_time: rt()
      });
    }

    // ─── TOP ──────────────────────────────────────────────────────────────────
    if (ep === 'top') {
      const type = url.searchParams.get('type') || 'anime'; // anime | manga | characters | people
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 10, 25);
      const filter = url.searchParams.get('filter') || ''; // airing | upcoming | bypopularity | favorite
      const query = filter ? `/top/${type}?filter=${filter}&limit=${limit}` : `/top/${type}?limit=${limit}`;
      const d = await jikanFetch(query);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4', type, filter: filter || 'all',
        results: (d.data || []).map((a, i) => ({
          rank: a.rank || i + 1, id: a.mal_id, title: a.title || a.name,
          score: a.score, episodes: a.episodes,
          image: a.images?.jpg?.image_url,
          genres: a.genres?.map(g => g.name)
        })),
        response_time: rt()
      });
    }

    // ─── SEASONAL ─────────────────────────────────────────────────────────────
    if (ep === 'seasonal') {
      const year = url.searchParams.get('year');
      const season = url.searchParams.get('season'); // winter | spring | summer | fall
      const path = year && season ? `/seasons/${year}/${season}` : '/seasons/now';
      const d = await jikanFetch(path);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        season: season || 'current', year: year || 'current',
        results: (d.data || []).slice(0, 20).map(a => ({
          id: a.mal_id, title: a.title,
          episodes: a.episodes, score: a.score,
          image: a.images?.jpg?.image_url,
          genres: a.genres?.map(g => g.name),
          synopsis: a.synopsis?.slice(0, 120)
        })),
        response_time: rt()
      });
    }

    // ─── SCHEDULE ─────────────────────────────────────────────────────────────
    if (ep === 'schedule') {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const today = days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
      const day = url.searchParams.get('day') || today;
      if (!days.includes(day)) return errRes(res, `Invalid day. Use: ${days.join(', ')}`);
      const d = await jikanFetch(`/schedules/${day}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4', day,
        results: (d.data || []).slice(0, 15).map(a => ({
          id: a.mal_id, title: a.title,
          episodes: a.episodes, score: a.score,
          image: a.images?.jpg?.image_url,
          broadcast: a.broadcast?.string
        })),
        response_time: rt()
      });
    }

    // ─── GENRE ────────────────────────────────────────────────────────────────
    if (ep === 'genre') {
      const genre_id = url.searchParams.get('id') || '1';
      const type = url.searchParams.get('type') || 'anime';
      const d = await jikanFetch(`/${type}?genres=${genre_id}&order_by=score&sort=desc&limit=15`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4', genre_id, type,
        results: (d.data || []).map(a => ({
          id: a.mal_id, title: a.title,
          score: a.score, episodes: a.episodes,
          image: a.images?.jpg?.image_url,
          synopsis: a.synopsis?.slice(0, 120)
        })),
        response_time: rt()
      });
    }

    // ─── GENRES LIST ──────────────────────────────────────────────────────────
    if (ep === 'genres') {
      const type = url.searchParams.get('type') || 'anime';
      const d = await jikanFetch(`/genres/${type}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4', type,
        genres: (d.data || []).map(g => ({ id: g.mal_id, name: g.name, count: g.count })),
        response_time: rt()
      });
    }

    // ─── QUOTES ───────────────────────────────────────────────────────────────
    if (ep === 'quotes') {
      const title = url.searchParams.get('title');
      // Use animechan.io (new domain, animechan.xyz is dead)
      try {
        const endpoint = title
          ? `https://animechan.io/api/v1/quotes/anime?title=${encodeURIComponent(title)}`
          : 'https://animechan.io/api/v1/quotes/random';
        const d = await safeFetch(endpoint, {}, 8000);
        const q = Array.isArray(d?.data) ? d.data[0] : d?.data || d;
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'AnimeChan',
          quote: q?.content || q?.quote,
          character: q?.character?.name || q?.character,
          anime: q?.anime?.name || q?.anime,
          response_time: rt()
        });
      } catch {
        // Fallback: random quote from a curated list
        const fallbacks = [
          { quote: "Hard work is worthless for those that don't believe in themselves.", character: 'Naruto Uzumaki', anime: 'Naruto' },
          { quote: "No matter how hard or impossible it is, never lose sight of your goal.", character: 'Monkey D. Luffy', anime: 'One Piece' },
          { quote: "People's lives don't end when they die. It ends when they lose faith.", character: 'Itachi Uchiha', anime: 'Naruto' },
          { quote: "If you don't take risks, you can't create a future.", character: 'Monkey D. Luffy', anime: 'One Piece' },
          { quote: "Whatever you do, enjoy it to the fullest. That is the secret of life.", character: 'Rider', anime: 'Fate/Zero' },
        ];
        const q = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Curated (AnimeChan unavailable)', ...q, response_time: rt() });
      }
    }

    // ─── NEWS ─────────────────────────────────────────────────────────────────
    if (ep === 'news') {
      const d = await jikanFetch('/anime?order_by=start_date&sort=desc&limit=15&status=airing');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        results: (d.data || []).slice(0, 12).map(a => ({
          id: a.mal_id, title: a.title, type: a.type,
          episodes: a.episodes, score: a.score,
          image: a.images?.jpg?.image_url,
          aired: a.aired?.string,
          synopsis: a.synopsis?.slice(0, 120)
        })),
        response_time: rt()
      });
    }

    // ─── RECOMMENDATIONS ─────────────────────────────────────────────────────
    if (ep === 'recommendations') {
      const d = await jikanFetch('/recommendations/anime');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        recommendations: (d.data || []).slice(0, 10).map(r => ({
          title: r.entry?.[0]?.title,
          url: r.entry?.[0]?.url,
          image: r.entry?.[0]?.images?.jpg?.image_url,
          votes: r.votes
        })),
        response_time: rt()
      });
    }

    // ─── REVIEWS ──────────────────────────────────────────────────────────────
    if (ep === 'reviews') {
      const d = await jikanFetch('/reviews/anime?preliminary=false&spoiler=false');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        reviews: (d.data || []).slice(0, 10).map(r => ({
          title: r.entry?.title,
          image: r.entry?.images?.jpg?.image_url,
          reviewer: r.user?.username,
          score: r.score,
          review: r.review?.slice(0, 250),
          date: r.date,
          reactions: r.reactions
        })),
        response_time: rt()
      });
    }

    // ─── RANDOM WAIFU ─────────────────────────────────────────────────────────
    if (ep === 'random-waifu') {
      const cats = ['waifu', 'neko', 'shinobu', 'megumin'];
      const cat = cats[Math.floor(Math.random() * cats.length)];
      const d = await safeFetch(`https://api.waifu.pics/sfw/${cat}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Waifu.pics', category: cat, url: d.url, response_time: rt() });
    }

    // ─── STUDIOS ──────────────────────────────────────────────────────────────
    if (ep === 'studios') {
      const id = url.searchParams.get('id');
      if (!id) return errRes(res, 'Parameter "id" is required (e.g. id=1 for Studio Pierrot)');
      const d = await jikanFetch(`/producers/${id}`);
      const p = d.data || {};
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        studio: {
          id: p.mal_id, name: p.titles?.[0]?.title,
          established: p.established,
          about: p.about?.slice(0, 300),
          favorites: p.favorites, count: p.count,
          image: p.images?.jpg?.image_url
        },
        response_time: rt()
      });
    }

    // ─── EPISODES ─────────────────────────────────────────────────────────────
    if (ep === 'episodes') {
      const id = url.searchParams.get('id');
      if (!id) return errRes(res, 'Parameter "id" is required (anime MAL ID)');
      const page = url.searchParams.get('page') || 1;
      const d = await jikanFetch(`/anime/${id}/episodes?page=${page}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        anime_id: id, page,
        total: d.pagination?.items?.total,
        episodes: (d.data || []).map(e => ({
          number: e.mal_id, title: e.title,
          title_japanese: e.title_japanese,
          aired: e.aired, filler: e.filler, recap: e.recap,
          score: e.score
        })),
        response_time: rt()
      });
    }

    return errRes(res, `Endpoint /api/anime/${ep} not found. Check /category for available endpoints.`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Jikan API may be rate-limited (1 req/s). Retry in a moment.', timestamp: new Date().toISOString() });
  }
}

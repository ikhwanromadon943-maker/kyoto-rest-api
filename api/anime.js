import { safeFetch, setCORS, errRes, checkRateLimit, logRequest, logAbuse } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/anime\/?/, '');

    // ===== EXISTING =====
    if (ep === 'search') {
      const q = url.searchParams.get('query');
      const type = url.searchParams.get('type') || 'anime';
      if (!q) return errRes(res, 'Parameter "query" is required');
      const endpoint = type === 'manga' ? 'manga' : 'anime';
      const d = await safeFetch(`https://api.jikan.moe/v4/${endpoint}?q=${encodeURIComponent(q)}&limit=10&order_by=popularity`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        type,
        results: (d.data || []).map(i => ({
          id: i.mal_id, title: i.title,
          image: i.images?.jpg?.image_url,
          score: i.score, synopsis: i.synopsis?.slice(0, 150)
        }))
      });
    }

    if (ep === 'anime') {
      const title = url.searchParams.get('title');
      if (!title) return errRes(res, 'Parameter "title" is required');
      const d = await safeFetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
      const a = d.data?.[0] || {};
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        title: a.title, episodes: a.episodes, score: a.score,
        image: a.images?.jpg?.large_image_url,
        synopsis: a.synopsis?.slice(0, 300),
        genres: a.genres?.map(g => g.name),
        status: a.status, rating: a.rating
      });
    }

    if (ep === 'random') {
      for (let i = 0; i < 3; i++) {
        const id = Math.floor(Math.random() * 50000) + 1;
        try {
          const d = await safeFetch(`https://api.jikan.moe/v4/anime/${id}/full`);
          const a = d.data || {};
          return res.json({
            status: true, author: 'Kyoto API', provider: 'Jikan API v4',
            anime: {
              id: a.mal_id, title: a.title, episodes: a.episodes,
              score: a.score, image: a.images?.jpg?.image_url,
              synopsis: a.synopsis?.slice(0, 200)
            }
          });
        } catch (_) {
          // Retry with different ID
        }
      }
      return errRes(res, 'Failed to get random anime after 3 attempts');
    }

    if (ep === 'waifu') {
      const cat = url.searchParams.get('category') || 'waifu';
      const allowed = ['waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe'];
      if (!allowed.includes(cat)) return errRes(res, `Invalid category. Allowed: ${allowed.join(', ')}`);
      const d = await safeFetch(`https://api.waifu.pics/sfw/${cat}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Waifu.pics',
        category: cat, url: d.url
      });
    }

    if (ep === 'character') {
      const q = url.searchParams.get('query');
      if (!q) return errRes(res, 'Parameter "query" is required');
      const d = await safeFetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(q)}&limit=5`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        results: (d.data || []).map(i => ({
          id: i.mal_id, name: i.name,
          image: i.images?.jpg?.image_url,
          about: i.about?.slice(0, 200),
          favorites: i.favorites
        }))
      });
    }

    if (ep === 'top') {
      const type = url.searchParams.get('type') || 'anime';
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 10, 25);
      const d = await safeFetch(`https://api.jikan.moe/v4/top/${type}?limit=${limit}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        type,
        results: (d.data || []).map((a, i) => ({
          rank: i + 1, id: a.mal_id, title: a.title,
          score: a.score, episodes: a.episodes,
          image: a.images?.jpg?.image_url
        }))
      });
    }

    if (ep === 'genre') {
      const genre_id = url.searchParams.get('id') || '1';
      const d = await safeFetch(`https://api.jikan.moe/v4/anime?genres=${genre_id}&order_by=score&sort=desc&limit=10`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        genre_id,
        results: (d.data || []).map(a => ({
          id: a.mal_id, title: a.title,
          score: a.score, episodes: a.episodes,
          image: a.images?.jpg?.image_url
        }))
      });
    }

    if (ep === 'schedule') {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const day = url.searchParams.get('day') || days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
      if (!days.includes(day)) return errRes(res, `Invalid day. Use: ${days.join(', ')}`);
      const d = await safeFetch(`https://api.jikan.moe/v4/schedules/${day}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        day,
        results: (d.data || []).slice(0, 10).map(a => ({
          id: a.mal_id, title: a.title,
          episodes: a.episodes, score: a.score,
          image: a.images?.jpg?.image_url
        }))
      });
    }

    if (ep === 'random-waifu') {
      const cats = ['waifu', 'neko', 'shinobu', 'megumin'];
      const cat = cats[Math.floor(Math.random() * cats.length)];
      const d = await safeFetch(`https://api.waifu.pics/sfw/${cat}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Waifu.pics',
        category: cat, url: d.url
      });
    }

    if (ep === 'news') {
      const d = await safeFetch('https://api.jikan.moe/v4/anime?order_by=start_date&sort=desc&limit=15');
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Jikan API v4',
        results: (d.data || []).slice(0, 10).map(a => ({
          id: a.mal_id, title: a.title,
          type: a.type, episodes: a.episodes,
          image: a.images?.jpg?.image_url,
          synopsis: a.synopsis?.slice(0, 100)
        }))
      });
    }

    // ===== NEW ENDPOINTS =====
    
    if (ep === 'quotes') {
      const title = url.searchParams.get('title');
      try {
        const endpoint = title 
          ? `https://animechan.xyz/api/random/anime?title=${encodeURIComponent(title)}`
          : 'https://animechan.xyz/api/random';
        const d = await safeFetch(endpoint, {}, 6000);
        return res.json({
          status: true, author: 'Kyoto API', provider: 'AnimeChan',
          quote: d.quote, character: d.character, anime: d.anime
        });
      } catch {
        return errRes(res, 'Failed to fetch anime quote. Try again.');
      }
    }

    if (ep === 'recommendations') {
      try {
        const d = await safeFetch('https://api.jikan.moe/v4/recommendations/anime');
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Jikan API v4',
          recommendations: (d.data || []).slice(0, 10).map(r => ({
            title: r.entry?.[0]?.title,
            url: r.entry?.[0]?.url,
            image: r.entry?.[0]?.images?.jpg?.image_url,
            votes: r.votes
          }))
        });
      } catch {
        return errRes(res, 'Failed to fetch recommendations');
      }
    }

    if (ep === 'seasonal') {
      try {
        const d = await safeFetch('https://api.jikan.moe/v4/seasons/now');
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Jikan API v4',
          season: 'current',
          results: (d.data || []).slice(0, 15).map(a => ({
            id: a.mal_id, title: a.title,
            episodes: a.episodes, score: a.score,
            image: a.images?.jpg?.image_url,
            genres: a.genres?.map(g => g.name)
          }))
        });
      } catch {
        return errRes(res, 'Failed to fetch seasonal anime');
      }
    }

    if (ep === 'reviews') {
      try {
        const d = await safeFetch('https://api.jikan.moe/v4/reviews/anime?preliminary=true&spoiler=false');
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Jikan API v4',
          reviews: (d.data || []).slice(0, 10).map(r => ({
            title: r.entry?.title,
            reviewer: r.user?.username,
            score: r.score,
            review: r.review?.slice(0, 200),
            date: r.date
          }))
        });
      } catch {
        return errRes(res, 'Failed to fetch reviews');
      }
    }

    if (ep === 'studios') {
      const id = url.searchParams.get('id');
      if (!id) return errRes(res, 'Parameter "id" is required (e.g., 1 for Studio Pierrot, 11 for Madhouse)');
      try {
        const d = await safeFetch(`https://api.jikan.moe/v4/producers/${id}`);
        const p = d.data || {};
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Jikan API v4',
          studio: {
            id: p.mal_id, name: p.titles?.[0]?.title,
            established: p.established,
            about: p.about?.slice(0, 300),
            favorites: p.favorites,
            count: p.count
          }
        });
      } catch {
        return errRes(res, 'Failed to fetch studio info');
      }
    }

    return errRes(res, `Endpoint /api/anime/${ep} not found`);
  } catch (err) {
    return res.status(500).json({
      status: false, author: 'Kyoto API',
      error: err.message,
      hint: 'Upstream API may be rate-limited or blocked'
    });
  }
}
import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/anime\/?/, '');

    if (ep === 'search') {
      const q = url.searchParams.get('query');
      if (!q) return errRes(res, 'Parameter "query" is required');
      const d = await safeFetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=10&order_by=popularity`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', results: (d.data||[]).map(i=>({id:i.mal_id,title:i.title,author:i.authors?.[0]?.name||'Unknown',chapters:i.chapters,score:i.score,image:i.images?.jpg?.image_url})) });
    }

    if (ep === 'anime') {
      const title = url.searchParams.get('title');
      if (!title) return errRes(res, 'Parameter "title" is required');
      const d = await safeFetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
      const a = d.data?.[0] || {};
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', title:a.title, episodes:a.episodes, score:a.score, image:a.images?.jpg?.large_image_url, synopsis:a.synopsis?.slice(0,300) });
    }

    if (ep === 'random') {
      for (let i = 0; i < 3; i++) {
        const id = Math.floor(Math.random() * 50000) + 1;
        try {
          const d = await safeFetch(`https://api.jikan.moe/v4/manga/${id}/full`);
          const m = d.data || {};
          return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', manga: { id:m.mal_id, title:m.title, author:m.authors?.[0]?.name, chapters:m.chapters, score:m.score, image:m.images?.jpg?.image_url } });
        } catch(_) {}
      }
      return errRes(res, 'Failed to get random manga after 3 attempts');
    }

    if (ep === 'waifu') {
      const cat = url.searchParams.get('category') || 'waifu';
      const allowed = ['waifu','neko','shinobu','megumin','bully','cuddle','cry','hug','awoo','kiss','lick','pat','smug','bonk','yeet','blush','smile','wave','highfive','handhold','nom','bite','glomp','slap','kill','kick','happy','wink','poke','dance','cringe'];
      if (!allowed.includes(cat)) return errRes(res, `Invalid category. Allowed: ${allowed.join(', ')}`);
      const d = await safeFetch(`https://api.waifu.pics/sfw/${cat}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Waifu.pics', category: cat, url: d.url });
    }

    if (ep === 'character') {
      const q = url.searchParams.get('query');
      if (!q) return errRes(res, 'Parameter "query" is required');
      const d = await safeFetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(q)}&limit=5`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', results: (d.data||[]).map(i=>({id:i.mal_id,name:i.name,image:i.images?.jpg?.image_url,about:i.about?.slice(0,200)})) });
    }

    // NEW: Top anime
    if (ep === 'top') {
      const type = url.searchParams.get('type') || 'anime';
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 10, 25);
      const d = await safeFetch(`https://api.jikan.moe/v4/top/${type}?limit=${limit}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', type, results: (d.data||[]).map((a,i)=>({rank:i+1,id:a.mal_id,title:a.title,score:a.score,episodes:a.episodes,image:a.images?.jpg?.image_url,synopsis:a.synopsis?.slice(0,150)})) });
    }

    // NEW: Anime by genre
    if (ep === 'genre') {
      const genre_id = url.searchParams.get('id') || '1'; // 1=Action, 2=Adventure, dll
      const d = await safeFetch(`https://api.jikan.moe/v4/anime?genres=${genre_id}&order_by=score&sort=desc&limit=10`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', genre_id, results: (d.data||[]).map(a=>({id:a.mal_id,title:a.title,score:a.score,episodes:a.episodes,image:a.images?.jpg?.image_url})) });
    }

    // NEW: Anime schedule (airing today)
    if (ep === 'schedule') {
      const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      const day = url.searchParams.get('day') || days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
      if (!days.includes(day)) return errRes(res, `Invalid day. Use: ${days.join(', ')}`);
      const d = await safeFetch(`https://api.jikan.moe/v4/schedules/${day}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', day, results: (d.data||[]).slice(0,10).map(a=>({id:a.mal_id,title:a.title,episodes:a.episodes,score:a.score,image:a.images?.jpg?.image_url})) });
    }

    // NEW: Random waifu (SFW)
    if (ep === 'random-waifu') {
      const cats = ['waifu','neko','shinobu','megumin'];
      const cat = cats[Math.floor(Math.random() * cats.length)];
      const d = await safeFetch(`https://api.waifu.pics/sfw/${cat}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Waifu.pics', category: cat, url: d.url });
    }

    // NEW: Anime news
    if (ep === 'news') {
      const d = await safeFetch(`https://api.jikan.moe/v4/news?page=1`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', results: (d.data||[]).slice(0,10).map(n=>({title:n.title,url:n.url,date:n.date,author:n.author_username,image:n.images?.jpg?.image_url})) });
    }

    return errRes(res, `Endpoint /api/anime/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}

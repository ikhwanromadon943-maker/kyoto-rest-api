export default async function handler(req, res) {
  const start = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ status: true, message: 'CORS preflight OK', response_time: `${Date.now() - start}ms` });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/manga/', '');

  try {
    // ---------- SEARCH ----------
    if (endpoint === 'search') {
      const query = url.searchParams.get('query');
      if (!query) {
        return res.status(400).json({ status: false, author: 'Kyoto API', error: 'Parameter "query" is required', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
      }
      const limit = url.searchParams.get('limit') || '10';

      try {
        const ext = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=${limit}&order_by=popularity`);
        if (!ext.ok) {
          return res.status(ext.status).json({ status: false, author: 'Kyoto API', error: `Jikan API returned ${ext.status} — mungkin rate limited, coba lagi nanti`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
        }
        const data = await ext.json();
        const results = (data.data || []).map(item => ({
          id: item.mal_id,
          title: item.title,
          title_jp: item.title_japanese,
          author: item.authors?.[0]?.name || 'Unknown',
          chapters: item.chapters || null,
          score: item.score,
          image: item.images?.jpg?.image_url,
          synopsis: item.synopsis?.slice(0, 300) + (item.synopsis?.length > 300 ? '...' : ''),
        }));

        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'Jikan API v4 (MyAnimeList)',
          query,
          total: data.pagination?.items?.total || 0,
          results,
          timestamp: new Date().toISOString(),
          response_time: `${Date.now() - start}ms`
        });
      } catch (err) {
        return res.status(500).json({ status: false, author: 'Kyoto API', error: `Jikan API request failed: ${err.message}`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
      }
    }

    // ---------- CHAPTER ----------
    if (endpoint === 'chapter') {
      const mangaId = url.searchParams.get('id');
      if (!mangaId) {
        return res.status(400).json({ status: false, author: 'Kyoto API', error: 'Parameter "id" is required', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
      }

      try {
        const ext = await fetch(`https://api.jikan.moe/v4/manga/${mangaId}/full`);
        if (!ext.ok) {
          return res.status(ext.status).json({ status: false, author: 'Kyoto API', error: `Jikan API returned ${ext.status} — manga not found or rate limited`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
        }
        const data = await ext.json();
        const manga = data.data || {};

        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'Jikan API v4 (MyAnimeList)',
          manga_id: manga.mal_id,
          title: manga.title,
          title_jp: manga.title_japanese,
          author: manga.authors?.[0]?.name || 'Unknown',
          total_chapters: manga.chapters || null,
          score: manga.score,
          image: manga.images?.jpg?.large_image_url,
          synopsis: manga.synopsis?.slice(0, 500),
          requested_chapter: url.searchParams.get('chapter') || null,
          note: 'Chapter images are not available via Jikan API. Use MangaDex API (api.mangadex.org) for chapter reading.',
          timestamp: new Date().toISOString(),
          response_time: `${Date.now() - start}ms`
        });
      } catch (err) {
        return res.status(500).json({ status: false, author: 'Kyoto API', error: `Jikan API request failed: ${err.message}`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
      }
    }

    // ---------- ANIME ----------
    if (endpoint === 'anime') {
      const title = url.searchParams.get('title');
      if (!title) {
        return res.status(400).json({ status: false, author: 'Kyoto API', error: 'Parameter "title" is required', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
      }

      try {
        const ext = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
        if (!ext.ok) {
          return res.status(ext.status).json({ status: false, author: 'Kyoto API', error: `Jikan API returned ${ext.status} — mungkin rate limited`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
        }
        const data = await ext.json();
        const anime = data.data?.[0] || {};

        if (!anime.mal_id) {
          return res.status(404).json({ status: false, author: 'Kyoto API', error: `Anime "${title}" not found`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
        }

        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'Jikan API v4 (MyAnimeList)',
          mal_id: anime.mal_id,
          title: anime.title,
          title_jp: anime.title_japanese,
          episodes: anime.episodes || null,
          status: anime.status,
          score: anime.score,
          image: anime.images?.jpg?.large_image_url,
          synopsis: anime.synopsis?.slice(0, 500),
          timestamp: new Date().toISOString(),
          response_time: `${Date.now() - start}ms`
        });
      } catch (err) {
        return res.status(500).json({ status: false, author: 'Kyoto API', error: `Jikan API request failed: ${err.message}`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
      }
    }

    // ---------- RANDOM ----------
    if (endpoint === 'random') {
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const randomId = Math.floor(Math.random() * 50000) + 1;
        try {
          const ext = await fetch(`https://api.jikan.moe/v4/manga/${randomId}/full`);
          if (ext.ok) {
            const data = await ext.json();
            const m = data.data || {};
            return res.json({
              status: true,
              author: 'Kyoto API',
              provider: 'Jikan API v4 (MyAnimeList)',
              manga: {
                id: m.mal_id,
                title: m.title,
                title_jp: m.title_japanese,
                author: m.authors?.[0]?.name || 'Unknown',
                chapters: m.chapters || null,
                score: m.score,
                image: m.images?.jpg?.image_url,
              },
              timestamp: new Date().toISOString(),
              response_time: `${Date.now() - start}ms`
            });
          }
        } catch {}
      }
      return res.status(500).json({ status: false, author: 'Kyoto API', error: 'Failed to fetch random manga after multiple attempts', timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
    }

    // ---------- WAIFU ----------
    if (endpoint === 'waifu') {
      const category = url.searchParams.get('category') || 'waifu';
      const validCategories = ['waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe'];
      const cat = validCategories.includes(category) ? category : 'waifu';

      try {
        const ext = await fetch(`https://api.waifu.pics/sfw/${cat}`);
        const data = await ext.json();
        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'Waifu.pics',
          category: cat,
          url: data.url,
          timestamp: new Date().toISOString(),
          response_time: `${Date.now() - start}ms`
        });
      } catch (err) {
        return res.status(500).json({ status: false, author: 'Kyoto API', error: `Waifu.pics request failed: ${err.message}`, timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms` });
      }
    }

    return res.status(404).json({
      status: false,
      author: 'Kyoto API',
      error: `Endpoint /api/manga/${endpoint} not found`,
      timestamp: new Date().toISOString(),
      response_time: `${Date.now() - start}ms`
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      author: 'Kyoto API',
      error: `Internal server error: ${err.message}`,
      timestamp: new Date().toISOString(),
      response_time: `${Date.now() - start}ms`
    });
  }
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace('/api/manga/', '');

    if (ep === 'search') {
      const q = url.searchParams.get('query');
      if (!q) return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "query" is required' });
      try {
        const e = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=10&order_by=popularity`);
        if (!e.ok) throw new Error(`Status ${e.status}`);
        const d = await e.json();
        const r = (d.data || []).map(i => ({ id: i.mal_id, title: i.title, author: i.authors?.[0]?.name || 'Unknown', chapters: i.chapters, score: i.score, image: i.images?.jpg?.image_url }));
        return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', query: q, results: r });
      } catch (err) { return res.json({ status: false, author: 'Kyoto API', error: err.message }); }
    }

    if (ep === 'anime') {
      const title = url.searchParams.get('title');
      if (!title) return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "title" is required' });
      try {
        const e = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
        if (!e.ok) throw new Error(`Status ${e.status}`);
        const d = await e.json();
        const a = d.data?.[0] || {};
        return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', title: a.title, episodes: a.episodes, score: a.score, image: a.images?.jpg?.large_image_url, synopsis: a.synopsis?.slice(0, 300) });
      } catch (err) { return res.json({ status: false, author: 'Kyoto API', error: err.message }); }
    }

    if (ep === 'random') {
      for (let i = 0; i < 3; i++) {
        const id = Math.floor(Math.random() * 50000) + 1;
        try {
          const e = await fetch(`https://api.jikan.moe/v4/manga/${id}/full`);
          if (e.ok) {
            const d = await e.json();
            const m = d.data || {};
            return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', manga: { id: m.mal_id, title: m.title, author: m.authors?.[0]?.name, chapters: m.chapters, score: m.score, image: m.images?.jpg?.image_url } });
          }
        } catch {}
      }
      return res.json({ status: false, author: 'Kyoto API', error: 'Failed after 3 attempts' });
    }

    return res.json({ status: false, author: 'Kyoto API', error: `Endpoint /api/manga/${ep} not found` });
  } catch (err) { return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message }); }
}
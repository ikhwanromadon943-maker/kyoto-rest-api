// Kyoto API — Manga / Anime Endpoints
// Search   : api.jikan.moe/v4
// Chapter  : api.jikan.moe/v4
// Anime    : api.jikan.moe/v4
// Random   : api.jikan.moe/v4
// Waifu    : api.waifu.pics

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/manga/', '');

  try {
    // ---------- SEARCH ----------
    if (endpoint === 'search') {
      const query = url.searchParams.get('query');
      if (!query) return res.status(400).json({ error: 'Parameter "query" diperlukan' });
      const limit = url.searchParams.get('limit') || '10';
      const ext = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=${limit}&order_by=popularity`);
      const data = await ext.json();
      const results = (data.data || []).map(item => ({
        id: item.mal_id,
        title: item.title,
        title_jp: item.title_japanese,
        author: item.authors?.[0]?.name || 'Unknown',
        chapters: item.chapters || '?',
        score: item.score,
        image: item.images?.jpg?.image_url,
        synopsis: item.synopsis?.slice(0, 300) + '...',
      }));
      return res.json({ status: 200, query, total: data.pagination?.items?.total || 0, results, provider: 'Jikan API (MyAnimeList)' });
    }

    // ---------- CHAPTER ----------
    if (endpoint === 'chapter') {
      const mangaId = url.searchParams.get('id');
      const chapter = url.searchParams.get('chapter');
      if (!mangaId) return res.status(400).json({ error: 'Parameter "id" diperlukan' });
      const ext = await fetch(`https://api.jikan.moe/v4/manga/${mangaId}`);
      const data = await ext.json();
      const manga = data.data || {};
      return res.json({
        status: 200,
        manga_id: mangaId,
        title: manga.title,
        chapter: chapter || 'latest',
        total_chapters: manga.chapters || '?',
        pages: `Untuk membaca chapter, kunjungi: https://mangadex.org atau platform resmi.`,
        provider: 'Jikan API (MyAnimeList)',
        note: 'Chapter images tidak tersedia via Jikan. Gunakan MangaDex API: api.mangadex.org.',
      });
    }

    // ---------- ANIME ----------
    if (endpoint === 'anime') {
      const title = url.searchParams.get('title');
      if (!title) return res.status(400).json({ error: 'Parameter "title" diperlukan' });
      const ext = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
      const data = await ext.json();
      const anime = data.data?.[0] || {};
      return res.json({
        status: 200,
        title: anime.title || title,
        title_jp: anime.title_japanese,
        episodes: anime.episodes || '?',
        status: anime.status,
        score: anime.score,
        synopsis: anime.synopsis?.slice(0, 500) + '...',
        image: anime.images?.jpg?.large_image_url,
        provider: 'Jikan API (MyAnimeList)',
      });
    }

    // ---------- RANDOM ----------
    if (endpoint === 'random') {
      const randomId = Math.floor(Math.random() * 50000) + 1;
      const ext = await fetch(`https://api.jikan.moe/v4/manga/${randomId}/full`);
      if (!ext.ok) {
        // Retry with another ID
        const retryId = Math.floor(Math.random() * 10000) + 1;
        const retry = await fetch(`https://api.jikan.moe/v4/manga/${retryId}/full`);
        const data = await retry.json();
        const m = data.data || {};
        return res.json({ status: 200, manga: { id: m.mal_id, title: m.title, author: m.authors?.[0]?.name, chapters: m.chapters, score: m.score, image: m.images?.jpg?.image_url }, provider: 'Jikan API' });
      }
      const data = await ext.json();
      const m = data.data || {};
      return res.json({ status: 200, manga: { id: m.mal_id, title: m.title, author: m.authors?.[0]?.name, chapters: m.chapters, score: m.score, image: m.images?.jpg?.image_url }, provider: 'Jikan API' });
    }

    // ---------- WAIFU ----------
    if (endpoint === 'waifu') {
      const category = url.searchParams.get('category') || 'waifu';
      const validCategories = ['waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe'];
      const cat = validCategories.includes(category) ? category : 'waifu';
      const ext = await fetch(`https://api.waifu.pics/sfw/${cat}`);
      const data = await ext.json();
      return res.json({ status: 200, category: cat, url: data.url, provider: 'Waifu.pics (gratis, tanpa auth)' });
    }

    return res.status(404).json({ error: `Manga "${endpoint}" tidak tersedia` });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menghubungi API eksternal', detail: err.message });
  }
}
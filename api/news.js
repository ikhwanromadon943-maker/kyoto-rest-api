import { safeFetch, setCORS, errRes, checkRateLimit, logRequest, logAbuse } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/news\/?/, '');

    // ===== INDONESIAN NEWS =====
    const indoNewsSources = ['cnn', 'cnbc', 'detik', 'antara', 'kumparan', 'republika', 'tempo'];
    
    if (indoNewsSources.includes(ep)) {
      const sourceMap = {
        cnn: 'cnn-news', cnbc: 'cnbc-news', detik: 'detik-news',
        antara: 'antara-news', kumparan: 'kumparan-news',
        republika: 'republika-news', tempo: 'tempo-news'
      };
      const d = await safeFetch(`https://berita-indo-api.vercel.app/api/${sourceMap[ep]}`);
      const sourceNames = {
        cnn: 'CNN Indonesia', cnbc: 'CNBC Indonesia', detik: 'Detik.com',
        antara: 'Antara News', kumparan: 'Kumparan',
        republika: 'Republika', tempo: 'Tempo'
      };
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Berita Indo API',
        source: sourceNames[ep],
        results: (d.data || []).slice(0, 15)
      });
    }

    // ===== HACKER NEWS =====
    if (ep === 'hackernews') {
      const type = url.searchParams.get('type') || 'top';
      const validTypes = ['top', 'new', 'best', 'ask', 'show', 'job'];
      if (!validTypes.includes(type)) return errRes(res, `Invalid type. Use: ${validTypes.join(', ')}`);
      
      const stories = await safeFetch(`https://hacker-news.firebaseio.com/v0/${type}stories.json`);
      const topStories = stories.slice(0, 10);
      
      const storyDetails = await Promise.all(
        topStories.map(id => 
          safeFetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)
        )
      );
      
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Hacker News API',
        type,
        results: storyDetails.filter(Boolean).map(s => ({
          id: s.id, title: s.title, url: s.url,
          score: s.score, by: s.by,
          comments: s.descendants,
          time: new Date(s.time * 1000).toISOString()
        }))
      });
    }

    // ===== DEV.TO =====
    if (ep === 'devto') {
      const tag = url.searchParams.get('tag') || '';
      const endpoint = tag 
        ? `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=10`
        : 'https://dev.to/api/articles?per_page=10';
      
      const d = await safeFetch(endpoint);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Dev.to API',
        tag: tag || 'trending',
        results: d.map(a => ({
          title: a.title, description: a.description,
          url: a.url, author: a.user?.name,
          tags: a.tags, reading_time: a.reading_time_minutes,
          published: a.published_at,
          reactions: a.public_reactions_count
        }))
      });
    }

    return errRes(res, `Endpoint /api/news/${ep} not found. Available: cnn, cnbc, detik, antara, kumparan, republika, tempo, hackernews, devto`);
  } catch (err) {
    return res.status(500).json({
      status: false, author: 'Kyoto API',
      error: err.message,
      hint: 'Upstream API may be rate-limited or blocked'
    });
  }
}
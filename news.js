import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/news\/?/, '');

    if (ep === 'cnn') {
      const d = await safeFetch('https://berita-indo-api.vercel.app/api/cnn-news');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Berita Indo API', source: 'CNN Indonesia', results: (d.data||[]).slice(0,10) });
    }

    if (ep === 'cnbc') {
      const d = await safeFetch('https://berita-indo-api.vercel.app/api/cnbc-news');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Berita Indo API', source: 'CNBC Indonesia', results: (d.data||[]).slice(0,10) });
    }

    if (ep === 'detik') {
      const d = await safeFetch('https://berita-indo-api.vercel.app/api/detik-news');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Berita Indo API', source: 'Detik.com', results: (d.data||[]).slice(0,10) });
    }

    // NEW: Antara News
    if (ep === 'antara') {
      const d = await safeFetch('https://berita-indo-api.vercel.app/api/antara-news');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Berita Indo API', source: 'Antara News', results: (d.data||[]).slice(0,10) });
    }

    // NEW: Kumparan
    if (ep === 'kumparan') {
      const d = await safeFetch('https://berita-indo-api.vercel.app/api/kumparan-news');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Berita Indo API', source: 'Kumparan', results: (d.data||[]).slice(0,10) });
    }

    // NEW: Republika
    if (ep === 'republika') {
      const d = await safeFetch('https://berita-indo-api.vercel.app/api/republika-news');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Berita Indo API', source: 'Republika', results: (d.data||[]).slice(0,10) });
    }

    // NEW: Tempo
    if (ep === 'tempo') {
      const d = await safeFetch('https://berita-indo-api.vercel.app/api/tempo-news');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Berita Indo API', source: 'Tempo', results: (d.data||[]).slice(0,10) });
    }

    // NEW: Tech Crunch (global)
    if (ep === 'techcrunch') {
      const d = await safeFetch('https://techcrunch.com/feed/', {}, 10000);
      return res.json({ status: true, author: 'Kyoto API', source: 'TechCrunch', note: 'Use RSS parser for full content', feed_url: 'https://techcrunch.com/feed/' });
    }

    return errRes(res, `Endpoint /api/news/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}

import { safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/news\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  // ─── RSS PARSER HELPER ────────────────────────────────────────────────────
  async function parseRSS(feedUrl, sourceName, limit = 15) {
    // Use rss2json.com — free, no auth, works on Vercel
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=${limit}`;
    const data = await safeFetch(apiUrl, {}, 10000);
    if (data.status !== 'ok') throw new Error(`RSS feed error: ${data.message || 'Unknown'}`);
    return {
      status: true,
      author: 'Kyoto API',
      provider: sourceName,
      source_url: feedUrl,
      total: data.items?.length || 0,
      results: (data.items || []).map(item => ({
        title: item.title,
        description: item.description?.replace(/<[^>]+>/g, '').slice(0, 200) || null,
        url: item.link,
        image: item.thumbnail || item.enclosure?.link || null,
        author: item.author || null,
        published: item.pubDate,
        categories: item.categories || []
      })),
      response_time: rt()
    };
  }

  try {
    // ─── HACKER NEWS ──────────────────────────────────────────────────────────
    if (ep === 'hackernews') {
      const type = url.searchParams.get('type') || 'top';
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 10, 30);
      const validTypes = ['top', 'new', 'best', 'ask', 'show', 'job'];
      if (!validTypes.includes(type)) return errRes(res, `Invalid type. Use: ${validTypes.join(', ')}`);

      const ids = await safeFetch(`https://hacker-news.firebaseio.com/v0/${type}stories.json`, {}, 8000);
      const topIds = ids.slice(0, limit);

      const stories = await Promise.allSettled(
        topIds.map(id => safeFetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {}, 5000))
      );

      const results = stories
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value)
        .map(s => ({
          id: s.id, title: s.title, url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
          score: s.score, author: s.by, comments: s.descendants || 0,
          time: new Date(s.time * 1000).toISOString(), type: s.type
        }));

      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Hacker News API', type, total: results.length, results, response_time: rt() });
    }

    // ─── DEV.TO ───────────────────────────────────────────────────────────────
    if (ep === 'devto') {
      const tag = url.searchParams.get('tag') || '';
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 10, 30);
      const sort = url.searchParams.get('sort') || 'hot'; // hot | latest | rising
      const apiUrl = tag
        ? `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=${limit}&state=${sort}`
        : `https://dev.to/api/articles?per_page=${limit}&state=${sort}`;

      const data = await safeFetch(apiUrl, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Dev.to API',
        tag: tag || 'trending', sort, total: data.length,
        results: data.map(a => ({
          id: a.id, title: a.title,
          description: a.description,
          url: a.url,
          cover_image: a.cover_image,
          author: a.user?.name,
          author_avatar: a.user?.profile_image_90,
          tags: a.tag_list,
          reading_time: a.reading_time_minutes,
          published: a.published_at,
          reactions: a.public_reactions_count,
          comments: a.comments_count
        })),
        response_time: rt()
      });
    }

    // ─── GITHUB TRENDING ─────────────────────────────────────────────────────
    if (ep === 'github-trending') {
      const lang = url.searchParams.get('lang') || '';
      const since = url.searchParams.get('since') || 'daily'; // daily | weekly | monthly
      const apiUrl = `https://gh-trending-api.vercel.app/repositories${lang ? `?language=${encodeURIComponent(lang)}&since=${since}` : `?since=${since}`}`;
      try {
        const data = await safeFetch(apiUrl, {}, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'GitHub Trending',
          language: lang || 'all', since, total: data.length,
          results: (data || []).slice(0, 15).map(r => ({
            name: r.name, full_name: `${r.author}/${r.name}`,
            description: r.description,
            url: r.url, language: r.language,
            stars: r.stars, forks: r.forks,
            stars_today: r.currentPeriodStars,
            avatar: r.avatar
          })),
          response_time: rt()
        });
      } catch {
        // Fallback: GitHub search API (no auth needed for basic search)
        const query = lang ? `language:${lang}` : 'stars:>10000';
        const data = await safeFetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=15`, { headers: { 'Accept': 'application/vnd.github.v3+json' } }, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'GitHub Search API (fallback)',
          language: lang || 'all', since, total: data.items?.length || 0,
          results: (data.items || []).map(r => ({
            name: r.name, full_name: r.full_name,
            description: r.description, url: r.html_url,
            language: r.language, stars: r.stargazers_count,
            forks: r.forks_count, avatar: r.owner?.avatar_url
          })),
          response_time: rt()
        });
      }
    }

    // ─── BBC WORLD ────────────────────────────────────────────────────────────
    if (ep === 'bbc') {
      const result = await parseRSS('https://feeds.bbci.co.uk/news/world/rss.xml', 'BBC World News');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── REUTERS ──────────────────────────────────────────────────────────────
    if (ep === 'reuters') {
      const result = await parseRSS('https://feeds.reuters.com/reuters/topNews', 'Reuters');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── THE GUARDIAN ─────────────────────────────────────────────────────────
    if (ep === 'guardian') {
      const section = url.searchParams.get('section') || 'world'; // world | tech | science | sport | business
      const result = await parseRSS(`https://www.theguardian.com/${section}/rss`, 'The Guardian');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ ...result, section });
    }

    // ─── CNN ──────────────────────────────────────────────────────────────────
    if (ep === 'cnn') {
      const result = await parseRSS('https://rss.cnn.com/rss/edition.rss', 'CNN');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── ESPN / SPORTS ────────────────────────────────────────────────────────
    if (ep === 'sports') {
      const result = await parseRSS('https://www.espn.com/espn/rss/news', 'ESPN Sports');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── SCIENCE NEWS ─────────────────────────────────────────────────────────
    if (ep === 'science') {
      const result = await parseRSS('https://www.sciencedaily.com/rss/all.xml', 'ScienceDaily');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── TECH NEWS (TechCrunch) ───────────────────────────────────────────────
    if (ep === 'tech') {
      const result = await parseRSS('https://techcrunch.com/feed/', 'TechCrunch');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── CRYPTO NEWS ──────────────────────────────────────────────────────────
    if (ep === 'crypto') {
      const result = await parseRSS('https://cointelegraph.com/rss', 'CoinTelegraph');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── INDONESIA NEWS (Detik RSS) ───────────────────────────────────────────
    if (ep === 'detik') {
      const result = await parseRSS('https://rss.detik.com/index.php/detikcom', 'Detik.com');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── KOMPAS ───────────────────────────────────────────────────────────────
    if (ep === 'kompas') {
      const result = await parseRSS('https://rss.kompas.com/whats-new', 'Kompas.com');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── TEMPO ────────────────────────────────────────────────────────────────
    if (ep === 'tempo') {
      const result = await parseRSS('https://www.tempo.co/rss/beritautama', 'Tempo.co');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── PRODUCT HUNT ─────────────────────────────────────────────────────────
    if (ep === 'producthunt') {
      const result = await parseRSS('https://www.producthunt.com/feed', 'Product Hunt');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── GAMING NEWS ──────────────────────────────────────────────────────────
    if (ep === 'gaming') {
      const result = await parseRSS('https://kotaku.com/rss', 'Kotaku');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    // ─── ANIME NEWS NETWORK ───────────────────────────────────────────────────
    if (ep === 'anime-news') {
      const result = await parseRSS('https://www.animenewsnetwork.com/newsroom/rss.xml', 'Anime News Network');
      logRequest(url.pathname, ip, ua, rt());
      return res.json(result);
    }

    return errRes(res, `Endpoint /api/news/${ep} not found. Available: hackernews, devto, github-trending, bbc, reuters, guardian, cnn, sports, science, tech, crypto, detik, kompas, tempo, producthunt, gaming, anime-news`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'RSS feed may be temporarily unavailable', timestamp: new Date().toISOString() });
  }
}

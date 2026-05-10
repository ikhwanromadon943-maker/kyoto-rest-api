import { safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/games\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  // Rate limit check
  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  try {
    if (ep === 'list') {
      const d = await safeFetch('https://www.freetogame.com/api/games');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', total: d.length, games: d.slice(0, 20).map(g => ({ id: g.id, title: g.title, thumbnail: g.thumbnail, genre: g.genre, platform: g.platform, short_description: g.short_description })), response_time: rt() });
    }

    if (ep === 'detail') {
      const id = url.searchParams.get('id');
      if (!id) return errRes(res, 'Parameter "id" is required');
      const d = await safeFetch(`https://www.freetogame.com/api/game?id=${id}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', game: d, response_time: rt() });
    }

    if (ep === 'genre') {
      const genre = url.searchParams.get('genre') || 'shooter';
      const d = await safeFetch(`https://www.freetogame.com/api/games?category=${encodeURIComponent(genre)}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', genre, total: d.length, games: d.slice(0, 15), response_time: rt() });
    }

    if (ep === 'platform') {
      const platform = url.searchParams.get('platform') || 'pc';
      const d = await safeFetch(`https://www.freetogame.com/api/games?platform=${encodeURIComponent(platform)}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', platform, total: d.length, games: d.slice(0, 15), response_time: rt() });
    }

    if (ep === 'random') {
      const d = await safeFetch('https://www.freetogame.com/api/games');
      const game = d[Math.floor(Math.random() * d.length)];
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', game, response_time: rt() });
    }

    if (ep === 'top-rated') {
      const d = await safeFetch('https://www.freetogame.com/api/games?sort-by=release-date');
      const sorted = d.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', games: sorted.slice(0, 10), response_time: rt() });
    }

    if (ep === 'newest') {
      const d = await safeFetch('https://www.freetogame.com/api/games?sort-by=release-date');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', games: d.slice(0, 10), response_time: rt() });
    }

    if (ep === 'chess-puzzle') {
      const d = await safeFetch('https://lichess.org/api/puzzle/daily');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Lichess', puzzle: { id: d.puzzle?.id, rating: d.puzzle?.rating, solution: d.puzzle?.solution, fen: d.game?.fen, url: `https://lichess.org/training/${d.puzzle?.id}` }, response_time: rt() });
    }

    if (ep === 'pokedex') {
      const name = (url.searchParams.get('name') || 'pikachu').toLowerCase();
      try {
        const d = await safeFetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'PokéAPI', pokemon: { id: d.id, name: d.name, height: d.height, weight: d.weight, types: d.types.map(t => t.type.name), abilities: d.abilities.map(a => a.ability.name), image: d.sprites?.other?.['official-artwork']?.front_default || d.sprites?.front_default, stats: d.stats.map(s => ({ name: s.stat.name, value: s.base_stat })), moves_count: d.moves?.length || 0 }, response_time: rt() });
      } catch { return errRes(res, `Pokémon "${name}" not found. Check spelling.`); }
    }

    return errRes(res, `Endpoint /api/games/${ep} not found`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked', timestamp: new Date().toISOString() });
  }
}
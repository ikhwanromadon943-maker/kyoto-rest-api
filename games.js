import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/games\/?/, '');

    if (ep === 'list') {
      const d = await safeFetch('https://www.freetogame.com/api/games');
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', total: d.length, games: d.slice(0, 20) });
    }

    if (ep === 'detail') {
      const id = url.searchParams.get('id');
      if (!id) return errRes(res, 'Parameter "id" is required');
      const d = await safeFetch(`https://www.freetogame.com/api/game?id=${id}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', game: d });
    }

    // NEW: Games by genre
    if (ep === 'genre') {
      const genre = url.searchParams.get('genre') || 'shooter';
      const d = await safeFetch(`https://www.freetogame.com/api/games?genre=${encodeURIComponent(genre)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', genre, total: d.length, games: d.slice(0, 15) });
    }

    // NEW: Games by platform
    if (ep === 'platform') {
      const platform = url.searchParams.get('platform') || 'pc'; // pc, browser, all
      const d = await safeFetch(`https://www.freetogame.com/api/games?platform=${encodeURIComponent(platform)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', platform, total: d.length, games: d.slice(0, 15) });
    }

    // NEW: Random free game
    if (ep === 'random') {
      const d = await safeFetch('https://www.freetogame.com/api/games');
      const game = d[Math.floor(Math.random() * d.length)];
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', game });
    }

    // NEW: Top rated games
    if (ep === 'top-rated') {
      const d = await safeFetch('https://www.freetogame.com/api/games?sort-by=rating');
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', games: d.slice(0, 10) });
    }

    // NEW: Newest games
    if (ep === 'newest') {
      const d = await safeFetch('https://www.freetogame.com/api/games?sort-by=release-date');
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', games: d.slice(0, 10) });
    }

    // NEW: Chess puzzle
    if (ep === 'chess-puzzle') {
      const d = await safeFetch('https://lichess.org/api/puzzle/daily');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Lichess', puzzle: { id:d.puzzle?.id, rating:d.puzzle?.rating, plays:d.puzzle?.plays, solution:d.puzzle?.solution, fen:d.game?.fen, url:`https://lichess.org/training/${d.puzzle?.id}` } });
    }

    return errRes(res, `Endpoint /api/games/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}

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

  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  try {
    // ─── FREE-TO-PLAY GAMES LIST ──────────────────────────────────────────────
    if (ep === 'list') {
      const platform = url.searchParams.get('platform') || 'all'; // pc | browser | all
      const sort = url.searchParams.get('sort') || 'relevance'; // relevance | popularity | release-date | alphabetical | rating
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 50);
      let endpoint = `https://www.freetogame.com/api/games?sort-by=${sort}`;
      if (platform !== 'all') endpoint += `&platform=${platform}`;
      const d = await safeFetch(endpoint, {}, 10000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'FreeToGame',
        platform, sort, total: d.length,
        games: d.slice(0, limit).map(g => ({
          id: g.id, title: g.title, thumbnail: g.thumbnail,
          genre: g.genre, platform: g.platform,
          publisher: g.publisher, developer: g.developer,
          release_date: g.release_date,
          short_description: g.short_description
        })),
        response_time: rt()
      });
    }

    // ─── GAME DETAIL ──────────────────────────────────────────────────────────
    if (ep === 'detail') {
      const id = url.searchParams.get('id');
      if (!id) return errRes(res, 'Parameter "id" is required (game ID from /api/games/list)');
      const d = await safeFetch(`https://www.freetogame.com/api/game?id=${id}`, {}, 8000);
      if (d.status === 0) throw new Error('Game not found');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', game: d, response_time: rt() });
    }

    // ─── GAME BY GENRE ────────────────────────────────────────────────────────
    if (ep === 'genre') {
      const genre = url.searchParams.get('genre') || 'shooter';
      const d = await safeFetch(`https://www.freetogame.com/api/games?category=${encodeURIComponent(genre)}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', genre, total: d.length, games: d.slice(0, 20), response_time: rt() });
    }

    // ─── GAME BY PLATFORM ─────────────────────────────────────────────────────
    if (ep === 'platform') {
      const platform = url.searchParams.get('platform') || 'pc'; // pc | browser
      const d = await safeFetch(`https://www.freetogame.com/api/games?platform=${encodeURIComponent(platform)}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', platform, total: d.length, games: d.slice(0, 20), response_time: rt() });
    }

    // ─── RANDOM GAME ──────────────────────────────────────────────────────────
    if (ep === 'random') {
      const d = await safeFetch('https://www.freetogame.com/api/games', {}, 8000);
      const game = d[Math.floor(Math.random() * d.length)];
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', game, response_time: rt() });
    }

    // ─── NEWEST GAMES ─────────────────────────────────────────────────────────
    if (ep === 'newest') {
      const d = await safeFetch('https://www.freetogame.com/api/games?sort-by=release-date', {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeToGame', total: d.length, games: d.slice(0, 15), response_time: rt() });
    }

    // ─── POKÉDEX ─────────────────────────────────────────────────────────────
    if (ep === 'pokedex') {
      const name = (url.searchParams.get('name') || 'pikachu').toLowerCase().trim();
      try {
        const d = await safeFetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`, {}, 10000);
        const speciesData = await safeFetch(d.species.url, {}, 8000).catch(() => null);
        const flavor = speciesData?.flavor_text_entries?.find(f => f.language.name === 'en')?.flavor_text?.replace(/\f/g, ' ') || null;
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'PokéAPI',
          pokemon: {
            id: d.id, name: d.name,
            height_dm: d.height, weight_hg: d.weight,
            base_experience: d.base_experience,
            types: d.types.map(t => t.type.name),
            abilities: d.abilities.map(a => ({ name: a.ability.name, hidden: a.is_hidden })),
            image: d.sprites?.other?.['official-artwork']?.front_default || d.sprites?.front_default,
            image_shiny: d.sprites?.other?.['official-artwork']?.front_shiny || null,
            gif: d.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default || null,
            stats: d.stats.map(s => ({ name: s.stat.name, base: s.base_stat, effort: s.effort })),
            moves_count: d.moves?.length || 0,
            description: flavor,
            generation: speciesData?.generation?.name,
            is_legendary: speciesData?.is_legendary,
            is_mythical: speciesData?.is_mythical
          },
          response_time: rt()
        });
      } catch {
        return errRes(res, `Pokémon "${name}" not found. Check the spelling.`);
      }
    }

    // ─── POKÉMON LIST ─────────────────────────────────────────────────────────
    if (ep === 'pokemon-list') {
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 100);
      const offset = parseInt(url.searchParams.get('offset')) || 0;
      const d = await safeFetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'PokéAPI',
        total: d.count, limit, offset,
        next_offset: offset + limit,
        pokemon: d.results.map((p, i) => ({
          id: offset + i + 1, name: p.name,
          url: p.url,
          image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${offset + i + 1}.png`
        })),
        response_time: rt()
      });
    }

    // ─── CHESS PUZZLE ─────────────────────────────────────────────────────────
    if (ep === 'chess-puzzle') {
      const d = await safeFetch('https://lichess.org/api/puzzle/daily', {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Lichess',
        puzzle: {
          id: d.puzzle?.id, rating: d.puzzle?.rating,
          solution: d.puzzle?.solution, plays: d.puzzle?.plays,
          themes: d.puzzle?.themes,
          fen: d.game?.fen,
          opening: d.game?.opening,
          url: `https://lichess.org/training/${d.puzzle?.id}`
        },
        response_time: rt()
      });
    }

    // ─── MINECRAFT SKIN ───────────────────────────────────────────────────────
    if (ep === 'minecraft') {
      const username = url.searchParams.get('username');
      if (!username) return errRes(res, 'Parameter "username" is required');
      try {
        // Get UUID from Mojang API
        const profile = await safeFetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`, {}, 8000);
        if (!profile.id) throw new Error('Player not found');
        const uuid = profile.id;
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Mojang API + Mineatar',
          username: profile.name, uuid,
          skin: {
            face: `https://mineatar.io/face/${uuid}?scale=8`,
            body: `https://mineatar.io/body/full/${uuid}?scale=4`,
            skin_url: `https://mineskin.eu/skin/${username}`,
            head: `https://mineatar.io/head/${uuid}?scale=4`,
            bust: `https://mineatar.io/bust/${uuid}?scale=4`
          },
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `Minecraft player "${username}" not found`);
      }
    }

    // ─── VALORANT AGENT ───────────────────────────────────────────────────────
    if (ep === 'valorant') {
      const agent = url.searchParams.get('agent') || '';
      try {
        const d = await safeFetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true', {}, 8000);
        if (!d.data) throw new Error('Failed to fetch agents');
        if (agent) {
          const found = d.data.find(a => a.displayName.toLowerCase() === agent.toLowerCase());
          if (!found) return errRes(res, `Agent "${agent}" not found. Try /api/games/valorant for full list.`);
          logRequest(url.pathname, ip, ua, rt());
          return res.json({
            status: true, author: 'Kyoto API', provider: 'Valorant API',
            agent: {
              uuid: found.uuid, name: found.displayName, description: found.description,
              role: found.role?.displayName, role_description: found.role?.description,
              image: found.displayIcon, background: found.background,
              abilities: found.abilities?.map(ab => ({ slot: ab.slot, name: ab.displayName, description: ab.description, icon: ab.displayIcon }))
            },
            response_time: rt()
          });
        }
        // Return all agents list
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Valorant API',
          total: d.data.length,
          agents: d.data.map(a => ({ uuid: a.uuid, name: a.displayName, role: a.role?.displayName, image: a.displayIcon })),
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `Valorant API error: ${e.message}`);
      }
    }

    // ─── BRAWLSTARS ───────────────────────────────────────────────────────────
    if (ep === 'brawlstars') {
      const type = url.searchParams.get('type') || 'brawlers'; // brawlers | maps
      try {
        const d = await safeFetch(`https://api.brawlapi.com/v1/${type}`, {}, 8000);
        logRequest(url.pathname, ip, ua, rt());
        const list = d.list || d;
        return res.json({
          status: true, author: 'Kyoto API', provider: 'BrawlAPI',
          type, total: list.length,
          items: list.slice(0, 20).map(item => ({
            id: item.id, name: item.name || item.displayName,
            image: item.imageUrl || item.imageUrl2 || null,
            rarity: item.rarity?.name || null,
            class: item.class?.name || null,
            description: item.description || null
          })),
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `BrawlStars API error: ${e.message}`);
      }
    }

    // ─── STEAM APP SEARCH ─────────────────────────────────────────────────────
    if (ep === 'steam') {
      const query = url.searchParams.get('query');
      if (!query) return errRes(res, 'Parameter "query" is required');
      try {
        const d = await safeFetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`, {}, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Steam Store API',
          query, total: d.total,
          results: (d.items || []).slice(0, 10).map(g => ({
            id: g.id, name: g.name,
            image: g.tiny_image || `https://cdn.akamai.steamstatic.com/steam/apps/${g.id}/header.jpg`,
            price: g.price ? `$${(g.price.final / 100).toFixed(2)}` : 'Free',
            platforms: g.platforms,
            url: `https://store.steampowered.com/app/${g.id}`
          })),
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `Steam search failed: ${e.message}`);
      }
    }

    // ─── TRIVIA (moved from info for relevance) ───────────────────────────────
    if (ep === 'trivia') {
      const amount = Math.min(parseInt(url.searchParams.get('amount')) || 5, 15);
      const difficulty = url.searchParams.get('difficulty') || 'medium';
      try {
        const d = await safeFetch(`https://opentdb.com/api.php?amount=${amount}&type=multiple&difficulty=${difficulty}`, {}, 8000);
        if (d.response_code !== 0) throw new Error('No results found');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Open Trivia DB',
          difficulty, total: d.results.length,
          questions: d.results.map(q => ({
            category: q.category, difficulty: q.difficulty,
            question: q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
            correct_answer: q.correct_answer,
            all_answers: [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5)
          })),
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `Trivia fetch failed: ${e.message}`);
      }
    }

    return errRes(res, `Endpoint /api/games/${ep} not found. Available: list, detail, genre, platform, random, newest, pokedex, pokemon-list, chess-puzzle, minecraft, valorant, brawlstars, steam, trivia`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked', timestamp: new Date().toISOString() });
  }
}

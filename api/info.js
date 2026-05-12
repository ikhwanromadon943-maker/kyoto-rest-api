import { safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/info\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  try {
    // ─── WIKIPEDIA ────────────────────────────────────────────────────────────
    if (ep === 'wikipedia') {
      const title = url.searchParams.get('title');
      const lang = url.searchParams.get('lang') || 'en';
      if (!title) return errRes(res, 'Parameter "title" is required');
      const d = await safeFetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Wikipedia',
        title: d.title, extract: d.extract,
        url: d.content_urls?.desktop?.page,
        image: d.thumbnail?.source,
        description: d.description,
        lang, response_time: rt()
      });
    }

    // ─── WIKIPEDIA SEARCH ─────────────────────────────────────────────────────
    if (ep === 'wikipedia-search') {
      const q = url.searchParams.get('query');
      const lang = url.searchParams.get('lang') || 'en';
      if (!q) return errRes(res, 'Parameter "query" is required');
      const d = await safeFetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=10`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Wikipedia',
        query: q, lang,
        total_hits: d.query?.searchinfo?.totalhits,
        results: (d.query?.search || []).map(r => ({
          title: r.title,
          snippet: r.snippet.replace(/<[^>]+>/g, ''),
          wordcount: r.wordcount,
          url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title)}`
        })),
        response_time: rt()
      });
    }

    // ─── DICTIONARY ───────────────────────────────────────────────────────────
    if (ep === 'dictionary') {
      const word = url.searchParams.get('word');
      if (!word) return errRes(res, 'Parameter "word" is required');
      const d = await safeFetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {}, 8000);
      if (!Array.isArray(d)) throw new Error(`Word "${word}" not found`);
      const entry = d[0] || {};
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Free Dictionary API',
        word: entry.word, phonetic: entry.phonetic,
        phonetics: entry.phonetics?.filter(p => p.audio).map(p => ({ text: p.text, audio: p.audio })),
        meanings: entry.meanings?.map(m => ({
          partOfSpeech: m.partOfSpeech,
          definitions: m.definitions?.slice(0, 3).map(d => ({
            definition: d.definition,
            example: d.example,
            synonyms: d.synonyms?.slice(0, 5),
            antonyms: d.antonyms?.slice(0, 5)
          }))
        })),
        response_time: rt()
      });
    }

    // ─── GITHUB USER ──────────────────────────────────────────────────────────
    if (ep === 'github') {
      const username = url.searchParams.get('username');
      if (!username) return errRes(res, 'Parameter "username" is required');
      const [user, repos] = await Promise.all([
        safeFetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers: { 'Accept': 'application/vnd.github.v3+json' } }, 8000),
        safeFetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=stars&per_page=5`, { headers: { 'Accept': 'application/vnd.github.v3+json' } }, 8000).catch(() => [])
      ]);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'GitHub API',
        login: user.login, name: user.name, bio: user.bio,
        public_repos: user.public_repos, followers: user.followers, following: user.following,
        avatar: user.avatar_url, blog: user.blog, location: user.location,
        company: user.company, twitter: user.twitter_username,
        created_at: user.created_at,
        top_repos: repos.map(r => ({ name: r.name, stars: r.stargazers_count, language: r.language, url: r.html_url })),
        response_time: rt()
      });
    }

    // ─── GITHUB REPO ──────────────────────────────────────────────────────────
    if (ep === 'github-repo') {
      const repo = url.searchParams.get('repo');
      if (!repo) return errRes(res, 'Parameter "repo" is required (format: owner/repo)');
      const d = await safeFetch(`https://api.github.com/repos/${repo}`, { headers: { 'Accept': 'application/vnd.github.v3+json' } }, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'GitHub API',
        name: d.name, full_name: d.full_name, description: d.description,
        stars: d.stargazers_count, forks: d.forks_count,
        open_issues: d.open_issues_count, language: d.language,
        topics: d.topics, license: d.license?.spdx_id,
        url: d.html_url, homepage: d.homepage,
        created_at: d.created_at, updated_at: d.updated_at,
        default_branch: d.default_branch,
        owner: { login: d.owner?.login, avatar: d.owner?.avatar_url },
        response_time: rt()
      });
    }

    // ─── NPM PACKAGE ──────────────────────────────────────────────────────────
    if (ep === 'npm') {
      const pkg = url.searchParams.get('package');
      if (!pkg) return errRes(res, 'Parameter "package" is required');
      const d = await safeFetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'NPM Registry',
        name: d.name, version: d.version, description: d.description,
        license: d.license, author: d.author?.name || d.author,
        homepage: d.homepage, repository: d.repository?.url,
        keywords: d.keywords?.slice(0, 10),
        dependencies_count: d.dependencies ? Object.keys(d.dependencies).length : 0,
        response_time: rt()
      });
    }

    // ─── COUNTRY ──────────────────────────────────────────────────────────────
    if (ep === 'country') {
      const name = url.searchParams.get('name');
      const code = url.searchParams.get('code');
      if (!name && !code) return errRes(res, 'Parameter "name" or "code" is required');
      const endpoint = code
        ? `https://restcountries.com/v3.1/alpha/${code}`
        : `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`;
      const d = await safeFetch(endpoint, {}, 8000);
      const c = Array.isArray(d) ? d[0] : d;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'REST Countries',
        name: c.name?.common, official: c.name?.official,
        capital: c.capital?.[0], population: c.population,
        flag: c.flags?.png, flag_emoji: c.flag,
        coat_of_arms: c.coatOfArms?.png,
        region: c.region, subregion: c.subregion,
        languages: c.languages,
        currencies: Object.values(c.currencies || {}).map(x => ({ name: x.name, symbol: x.symbol })),
        timezones: c.timezones, area: c.area,
        maps: c.maps, continents: c.continents,
        tld: c.tld, idd: c.idd,
        response_time: rt()
      });
    }

    // ─── HOLIDAY ──────────────────────────────────────────────────────────────
    if (ep === 'holiday') {
      const year = url.searchParams.get('year') || new Date().getFullYear();
      const country = (url.searchParams.get('country') || 'ID').toUpperCase();
      const d = await safeFetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, {}, 8000);
      if (!Array.isArray(d)) throw new Error('Invalid country code or year');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Nager.Date',
        year, country, total_holidays: d.length,
        holidays: d.map(h => ({
          date: h.date, name: h.name, local_name: h.localName,
          types: h.types, global: h.global
        })),
        response_time: rt()
      });
    }

    // ─── EXCHANGE RATE ────────────────────────────────────────────────────────
    if (ep === 'exchange') {
      const base = (url.searchParams.get('base') || 'USD').toUpperCase();
      const target = url.searchParams.get('to')?.toUpperCase();
      const d = await safeFetch(`https://open.er-api.com/v6/latest/${base}`, {}, 8000);
      if (d.result === 'error') throw new Error(d['error-type'] || 'Exchange rate unavailable');
      const rates = target ? { [target]: d.rates[target] } : d.rates;
      if (target && !d.rates[target]) return errRes(res, `Currency "${target}" not found`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'ExchangeRate-API',
        base, rates, updated: d.time_last_update_utc,
        next_update: d.time_next_update_utc,
        response_time: rt()
      });
    }

    // ─── WORLD TIME ───────────────────────────────────────────────────────────
    if (ep === 'time') {
      const tz = url.searchParams.get('timezone') || 'Asia/Jakarta';
      const d = await safeFetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(tz)}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'WorldTimeAPI',
        timezone: d.timezone, datetime: d.datetime,
        day_of_week: d.day_of_week, day_of_year: d.day_of_year,
        week_number: d.week_number, utc_offset: d.utc_offset,
        unixtime: d.unixtime, response_time: rt()
      });
    }

    // ─── TIMEZONE LIST ────────────────────────────────────────────────────────
    if (ep === 'timezones') {
      const d = await safeFetch('https://worldtimeapi.org/api/timezone', {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'WorldTimeAPI', total: d.length, timezones: d, response_time: rt() });
    }

    // ─── COLOR ────────────────────────────────────────────────────────────────
    if (ep === 'color') {
      const hex = (url.searchParams.get('hex') || 'FF5733').replace('#', '');
      const d = await safeFetch(`https://www.thecolorapi.com/id?hex=${hex}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'The Color API',
        hex: `#${hex}`, name: d.name?.value,
        rgb: d.rgb, hsl: d.hsl, cmyk: d.cmyk,
        image: d.image?.named,
        contrast: d.contrast,
        response_time: rt()
      });
    }

    // ─── UUID GENERATOR ───────────────────────────────────────────────────────
    if (ep === 'uuid') {
      const count = Math.min(parseInt(url.searchParams.get('count')) || 1, 20);
      const uuids = Array.from({ length: count }, () => crypto.randomUUID());
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', count, uuids, response_time: rt() });
    }

    // ─── CRYPTO PRICE ─────────────────────────────────────────────────────────
    if (ep === 'crypto') {
      const coin = (url.searchParams.get('coin') || 'bitcoin').toLowerCase();
      const currency = (url.searchParams.get('currency') || 'usd').toLowerCase();
      try {
        const d = await safeFetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_last_updated_at=true`,
          {}, 8000
        );
        const data = d[coin];
        if (!data) throw new Error(`Coin "${coin}" not found`);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'CoinGecko',
          coin, currency: currency.toUpperCase(),
          price: data[currency],
          change_24h: data[`${currency}_24h_change`]?.toFixed(2) + '%',
          market_cap: data[`${currency}_market_cap`],
          last_updated: new Date(data.last_updated_at * 1000).toISOString(),
          response_time: rt()
        });
      } catch {
        // Fallback: CoinCap
        const d = await safeFetch(`https://api.coincap.io/v2/assets/${coin}`, {}, 8000);
        if (!d.data) throw new Error(`Coin "${coin}" not found`);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'CoinCap (fallback)',
          coin, price_usd: parseFloat(d.data.priceUsd).toFixed(2),
          change_24h: parseFloat(d.data.changePercent24Hr).toFixed(2) + '%',
          rank: d.data.rank, market_cap_usd: d.data.marketCapUsd,
          response_time: rt()
        });
      }
    }

    // ─── MOVIE / TV ───────────────────────────────────────────────────────────
    if (ep === 'movie') {
      const title = url.searchParams.get('title');
      if (!title) return errRes(res, 'Parameter "title" is required');
      // OMDB free key (demo key works for basic use)
      const OMDB_KEY = process.env.OMDB_KEY || 'trilogy';
      try {
        const d = await safeFetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}&plot=full`, {}, 8000);
        if (d.Response === 'False') throw new Error(d.Error || 'Movie not found');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'OMDB',
          title: d.Title, year: d.Year, rated: d.Rated,
          released: d.Released, runtime: d.Runtime,
          genre: d.Genre, director: d.Director,
          actors: d.Actors, plot: d.Plot,
          language: d.Language, country: d.Country,
          awards: d.Awards, poster: d.Poster,
          ratings: d.Ratings,
          imdb: { id: d.imdbID, rating: d.imdbRating, votes: d.imdbVotes },
          box_office: d.BoxOffice, type: d.Type,
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `Movie not found: ${e.message}`);
      }
    }

    // ─── LYRICS ───────────────────────────────────────────────────────────────
    if (ep === 'lyrics') {
      const artist = url.searchParams.get('artist');
      const song = url.searchParams.get('song');
      if (!artist || !song) return errRes(res, 'Parameters "artist" AND "song" are required');
      try {
        const d = await safeFetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`, {}, 8000);
        if (!d.lyrics) throw new Error('No lyrics found');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Lyrics.ovh',
          artist, song, lyrics: d.lyrics,
          lines_count: d.lyrics.split('\n').length,
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `Lyrics not found for "${artist} - ${song}". Check spelling.`);
      }
    }

    // ─── UNIVERSITIES ─────────────────────────────────────────────────────────
    if (ep === 'universities') {
      const country = url.searchParams.get('country');
      if (!country) return errRes(res, 'Parameter "country" is required (e.g. Indonesia, Japan)');
      const d = await safeFetch(`http://universities.hipolabs.com/search?country=${encodeURIComponent(country)}`, {}, 8000);
      if (!Array.isArray(d)) throw new Error('No results found');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Hipolabs Universities API',
        country, total: d.length,
        universities: d.slice(0, 25).map(u => ({
          name: u.name, domains: u.domains,
          web_pages: u.web_pages, country: u.country,
          alpha_two_code: u.alpha_two_code,
          state_province: u['state-province']
        })),
        response_time: rt()
      });
    }

    // ─── IP GEO (moved from info to here as well for convenience) ─────────────
    if (ep === 'ip-geo') {
      const ipAddr = url.searchParams.get('ip') || '';
      const d = await safeFetch(`https://ipapi.co/${ipAddr}/json/`, {}, 8000);
      if (d.error) throw new Error(d.reason || 'IP lookup failed');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'ipapi.co',
        ip: d.ip, city: d.city, region: d.region,
        country: d.country_name, country_code: d.country_code,
        postal: d.postal, timezone: d.timezone,
        org: d.org, lat: d.latitude, lon: d.longitude,
        currency: d.currency, calling_code: d.country_calling_code,
        response_time: rt()
      });
    }

    // ─── RANDOM QUOTE ─────────────────────────────────────────────────────────
    if (ep === 'quote') {
      const category = url.searchParams.get('category') || '';
      try {
        const endpoint = category
          ? `https://api.api-ninjas.com/v1/quotes?category=${encodeURIComponent(category)}`
          : 'https://api.quotable.io/random';
        // quotable.io is free and no auth needed
        const d = await safeFetch('https://api.quotable.io/random', {}, 6000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Quotable.io', content: d.content, author: d.author, tags: d.tags, length: d.length, response_time: rt() });
      } catch {
        const quotes = [
          { content: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
          { content: 'In the middle of every difficulty lies opportunity.', author: 'Albert Einstein' },
          { content: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
        ];
        const q = quotes[Math.floor(Math.random() * quotes.length)];
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Curated', ...q, response_time: rt() });
      }
    }

    // ─── RANDOM FACT ──────────────────────────────────────────────────────────
    if (ep === 'fact') {
      try {
        const d = await safeFetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', {}, 6000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Useless Facts API', fact: d.text, source_url: d.source_url, response_time: rt() });
      } catch {
        const d = await safeFetch('https://api.api-ninjas.com/v1/facts', {}, 6000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'API Ninjas', fact: d?.[0]?.fact, response_time: rt() });
      }
    }

    // ─── RANDOM JOKE ──────────────────────────────────────────────────────────
    if (ep === 'joke') {
      const type = url.searchParams.get('type') || 'any'; // any | programming | dark | pun | spooky | christmas
      try {
        const d = await safeFetch(`https://v2.jokeapi.dev/joke/${type}?blacklistFlags=racist,sexist&type=twopart,single`, {}, 6000);
        const joke = d.type === 'twopart' ? `${d.setup} ... ${d.delivery}` : d.joke;
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'JokeAPI', category: d.category, type: d.type, joke, setup: d.setup, punchline: d.delivery, response_time: rt() });
      } catch {
        return errRes(res, 'Joke service unavailable. Try again.');
      }
    }

    // ─── TRIVIA ───────────────────────────────────────────────────────────────
    if (ep === 'trivia') {
      const amount = Math.min(parseInt(url.searchParams.get('amount')) || 5, 15);
      const difficulty = url.searchParams.get('difficulty') || ''; // easy | medium | hard
      const category = url.searchParams.get('category') || ''; // number 9-32
      let endpoint = `https://opentdb.com/api.php?amount=${amount}&type=multiple`;
      if (difficulty) endpoint += `&difficulty=${difficulty}`;
      if (category) endpoint += `&category=${category}`;
      try {
        const d = await safeFetch(endpoint, {}, 8000);
        if (d.response_code !== 0) throw new Error('OpenTDB returned no results');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Open Trivia DB',
          total: d.results.length,
          questions: d.results.map(q => ({
            category: q.category, difficulty: q.difficulty,
            question: q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
            correct_answer: q.correct_answer,
            incorrect_answers: q.incorrect_answers,
            all_answers: [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5)
          })),
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `Trivia fetch failed: ${e.message}`);
      }
    }

    // ─── ADVICE ───────────────────────────────────────────────────────────────
    if (ep === 'advice') {
      const d = await safeFetch('https://api.adviceslip.com/advice', {}, 6000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Advice Slip', id: d.slip?.id, advice: d.slip?.advice, response_time: rt() });
    }

    return errRes(res, `Endpoint /api/info/${ep} not found. Check /category for available endpoints.`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked', timestamp: new Date().toISOString() });
  }
}

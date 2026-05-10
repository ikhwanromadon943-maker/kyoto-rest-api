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

  // Rate limit check
  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  try {
    if (ep === 'wikipedia') {
      const title = url.searchParams.get('title');
      if (!title) return errRes(res, 'Parameter "title" is required');
      const d = await safeFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Wikipedia', title: d.title, extract: d.extract, url: d.content_urls?.desktop?.page, image: d.thumbnail?.source, description: d.description, response_time: rt() });
    }

    if (ep === 'dictionary') {
      const word = url.searchParams.get('word');
      if (!word) return errRes(res, 'Parameter "word" is required');
      const d = await safeFetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      const entry = d[0] || {};
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Free Dictionary API', word: entry.word, phonetic: entry.phonetic, phonetics: entry.phonetics?.map(p => ({ text: p.text, audio: p.audio })), meanings: entry.meanings?.map(m => ({ partOfSpeech: m.partOfSpeech, definitions: m.definitions?.slice(0, 3).map(d => ({ definition: d.definition, example: d.example, synonyms: d.synonyms?.slice(0, 5), antonyms: d.antonyms?.slice(0, 5) })) })), response_time: rt() });
    }

    if (ep === 'github') {
      const username = url.searchParams.get('username');
      if (!username) return errRes(res, 'Parameter "username" is required');
      const d = await safeFetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'GitHub API', user: { login: d.login, name: d.name, bio: d.bio, public_repos: d.public_repos, followers: d.followers, following: d.following, avatar: d.avatar_url, blog: d.blog, location: d.location, company: d.company, twitter: d.twitter_username, created_at: d.created_at, updated_at: d.updated_at }, response_time: rt() });
    }

    if (ep === 'github-repo') {
      const repo = url.searchParams.get('repo');
      if (!repo) return errRes(res, 'Parameter "repo" is required (format: owner/repo)');
      const d = await safeFetch(`https://api.github.com/repos/${encodeURIComponent(repo)}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'GitHub API', name: d.name, full_name: d.full_name, description: d.description, stars: d.stargazers_count, forks: d.forks_count, open_issues: d.open_issues_count, language: d.language, topics: d.topics, license: d.license?.spdx_id, url: d.html_url, homepage: d.homepage, created_at: d.created_at, updated_at: d.updated_at, default_branch: d.default_branch, response_time: rt() });
    }

    if (ep === 'npm') {
      const pkg = url.searchParams.get('package');
      if (!pkg) return errRes(res, 'Parameter "package" is required');
      const d = await safeFetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'NPM Registry', name: d.name, version: d.version, description: d.description, license: d.license, author: d.author?.name || d.author, homepage: d.homepage, repository: d.repository?.url, keywords: d.keywords?.slice(0, 10), dependencies_count: d.dependencies ? Object.keys(d.dependencies).length : 0, response_time: rt() });
    }

    if (ep === 'country') {
      const name = url.searchParams.get('name');
      if (!name) return errRes(res, 'Parameter "name" is required');
      const d = await safeFetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`);
      const c = d[0] || {};
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'REST Countries', name: c.name?.common, official: c.name?.official, capital: c.capital?.[0], population: c.population, flag: c.flags?.png, coat_of_arms: c.coatOfArms?.png, region: c.region, subregion: c.subregion, languages: c.languages, currencies: Object.values(c.currencies || {}).map(c => ({ name: c.name, symbol: c.symbol })), timezones: c.timezones, area: c.area, maps: c.maps, continents: c.continents, response_time: rt() });
    }

    if (ep === 'holiday') {
      const year = url.searchParams.get('year') || new Date().getFullYear();
      const country = url.searchParams.get('country') || 'ID';
      const d = await safeFetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Nager.Date', year, country, total_holidays: d.length, holidays: d.slice(0, 20).map(h => ({ date: h.date, name: h.name, local_name: h.localName, types: h.types })), response_time: rt() });
    }

    if (ep === 'exchange') {
      const base = url.searchParams.get('base') || 'USD';
      const target = url.searchParams.get('to');
      const d = await safeFetch(`https://open.er-api.com/v6/latest/${base}`);
      if (d.result === 'error') throw new Error(d['error-type'] || 'Exchange rate error');
      const rates = target ? { [target]: d.rates[target] } : d.rates;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'ExchangeRate-API', base, rates, updated: d.time_last_update_utc, next_update: d.time_next_update_utc, response_time: rt() });
    }

    if (ep === 'time') {
      const tz = url.searchParams.get('timezone') || 'Asia/Jakarta';
      const d = await safeFetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(tz)}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'WorldTimeAPI', timezone: d.timezone, datetime: d.datetime, day_of_week: d.day_of_week, day_of_year: d.day_of_year, week_number: d.week_number, utc_offset: d.utc_offset, unixtime: d.unixtime, response_time: rt() });
    }

    if (ep === 'color') {
      const hex = (url.searchParams.get('hex') || 'FF5733').replace('#', '');
      const d = await safeFetch(`https://www.thecolorapi.com/id?hex=${hex}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'The Color API', hex: `#${hex}`, name: d.name?.value, rgb: d.rgb, hsl: d.hsl, cmyk: d.cmyk, image: d.image?.named, response_time: rt() });
    }

    if (ep === 'uuid') {
      const count = Math.min(parseInt(url.searchParams.get('count')) || 1, 10);
      const uuids = Array.from({ length: count }, () => crypto.randomUUID());
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', count, uuids, response_time: rt() });
    }

    if (ep === 'crypto') {
      const coin = url.searchParams.get('coin') || 'bitcoin';
      const currency = url.searchParams.get('currency') || 'usd';
      try {
        const d = await safeFetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_last_updated_at=true`, {}, 8000);
        const data = d[coin];
        if (!data) throw new Error(`Coin "${coin}" not found`);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'CoinGecko', coin, price: data[currency], currency: currency.toUpperCase(), change_24h: data[`${currency}_24h_change`]?.toFixed(2) + '%', market_cap: data[`${currency}_market_cap`], last_updated: new Date(data.last_updated_at * 1000).toISOString(), response_time: rt() });
      } catch (e) {
        try {
          const d = await safeFetch(`https://api.coincap.io/v2/assets/${coin}`, {}, 6000);
          logRequest(url.pathname, ip, ua, rt());
          return res.json({ status: true, author: 'Kyoto API', provider: 'CoinCap (fallback)', coin, price_usd: parseFloat(d.data?.priceUsd).toFixed(2), change_24h: parseFloat(d.data?.changePercent24Hr).toFixed(2) + '%', rank: d.data?.rank, supply: d.data?.supply, market_cap_usd: d.data?.marketCapUsd, response_time: rt() });
        } catch { return errRes(res, 'Failed to fetch crypto data. CoinGecko rate limit may be active.'); }
      }
    }

    if (ep === 'movie') {
      const title = url.searchParams.get('title');
      if (!title) return errRes(res, 'Parameter "title" is required');
      const OMDB_KEY = 'trilogy';
      try {
        const d = await safeFetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`, {}, 8000);
        if (d.Response === 'False') throw new Error(d.Error || 'Movie not found');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'OMDB', title: d.Title, year: d.Year, rated: d.Rated, released: d.Released, runtime: d.Runtime, genre: d.Genre, director: d.Director, writer: d.Writer, actors: d.Actors, plot: d.Plot, language: d.Language, country: d.Country, awards: d.Awards, poster: d.Poster, ratings: d.Ratings, imdb: { id: d.imdbID, rating: d.imdbRating, votes: d.imdbVotes }, box_office: d.BoxOffice, production: d.Production, response_time: rt() });
      } catch { return errRes(res, 'Movie not found or OMDB API error. Try different title.'); }
    }

    if (ep === 'lyrics') {
      const artist = url.searchParams.get('artist');
      const song = url.searchParams.get('song');
      if (!artist || !song) return errRes(res, 'Parameters "artist" AND "song" are required');
      try {
        const d = await safeFetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`, {}, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Lyrics.ovh', artist, song, lyrics: d.lyrics, lines_count: d.lyrics.split('\n').length, preview: d.lyrics.split('\n').slice(0, 5).join('\n'), response_time: rt() });
      } catch { return errRes(res, `Lyrics not found for "${artist} - ${song}". Check spelling.`); }
    }

    if (ep === 'universities') {
      const country = url.searchParams.get('country');
      if (!country) return errRes(res, 'Parameter "country" is required');
      try {
        const d = await safeFetch(`http://universities.hipolabs.com/search?country=${encodeURIComponent(country)}`, {}, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'Hipolabs Universities API', country, total: d.length, universities: d.slice(0, 20).map(u => ({ name: u.name, domains: u.domains, web_pages: u.web_pages, country: u.country, alpha_two_code: u.alpha_two_code, state_province: u['state-province'] })), response_time: rt() });
      } catch { return errRes(res, 'Failed to fetch universities. Check country name.'); }
    }

    if (ep === 'ip-geo') {
      const ipAddr = url.searchParams.get('ip') || '';
      try {
        const d = await safeFetch(`https://ipapi.co/${ipAddr}/json/`, {}, 8000);
        if (d.error) throw new Error(d.reason || 'IP lookup failed');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'ipapi.co', ip: d.ip, city: d.city, region: d.region, country: d.country_name, country_code: d.country_code, continent: d.continent_code, postal: d.postal, timezone: d.timezone, org: d.org, isp: d.org, lat: d.latitude, lon: d.longitude, currency: d.currency, languages: d.languages, response_time: rt() });
      } catch { return errRes(res, 'IP lookup failed. Check IP format.'); }
    }

    if (ep === 'wikipedia-search') {
      const q = url.searchParams.get('query');
      if (!q) return errRes(res, 'Parameter "query" is required');
      const d = await safeFetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=10`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Wikipedia', query: q, total_hits: d.query?.searchinfo?.totalhits, results: (d.query?.search || []).map(r => ({ title: r.title, snippet: r.snippet.replace(/<[^>]+>/g, ''), wordcount: r.wordcount, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}` })), response_time: rt() });
    }

    return errRes(res, `Endpoint /api/info/${ep} not found.`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked', timestamp: new Date().toISOString() });
  }
}
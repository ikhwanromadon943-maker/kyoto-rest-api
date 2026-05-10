import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/info\/?/, '');

    // ===== EXISTING (Optimized) =====
    
    if (ep === 'wikipedia') {
      const title = url.searchParams.get('title');
      if (!title) return errRes(res, 'Parameter "title" is required');
      const d = await safeFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Wikipedia',
        title: d.title, extract: d.extract,
        url: d.content_urls?.desktop?.page,
        image: d.thumbnail?.source,
        description: d.description
      });
    }

    if (ep === 'dictionary') {
      const word = url.searchParams.get('word');
      if (!word) return errRes(res, 'Parameter "word" is required');
      const d = await safeFetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      const entry = d[0] || {};
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Free Dictionary API',
        word: entry.word,
        phonetic: entry.phonetic,
        phonetics: entry.phonetics?.map(p => ({ text: p.text, audio: p.audio })),
        meanings: entry.meanings?.map(m => ({
          partOfSpeech: m.partOfSpeech,
          definitions: m.definitions?.slice(0, 3).map(d => ({
            definition: d.definition,
            example: d.example,
            synonyms: d.synonyms?.slice(0, 5),
            antonyms: d.antonyms?.slice(0, 5)
          }))
        }))
      });
    }

    if (ep === 'github') {
      const username = url.searchParams.get('username');
      if (!username) return errRes(res, 'Parameter "username" is required');
      const d = await safeFetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'GitHub API',
        user: {
          login: d.login, name: d.name, bio: d.bio,
          public_repos: d.public_repos, followers: d.followers,
          following: d.following, avatar: d.avatar_url,
          blog: d.blog, location: d.location,
          company: d.company, twitter: d.twitter_username,
          created_at: d.created_at, updated_at: d.updated_at
        }
      });
    }

    if (ep === 'github-repo') {
      const repo = url.searchParams.get('repo');
      if (!repo) return errRes(res, 'Parameter "repo" is required (format: owner/repo)');
      const d = await safeFetch(`https://api.github.com/repos/${encodeURIComponent(repo)}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'GitHub API',
        name: d.name, full_name: d.full_name,
        description: d.description, stars: d.stargazers_count,
        forks: d.forks_count, open_issues: d.open_issues_count,
        language: d.language, topics: d.topics,
        license: d.license?.spdx_id, url: d.html_url,
        homepage: d.homepage, created_at: d.created_at,
        updated_at: d.updated_at, default_branch: d.default_branch
      });
    }

    if (ep === 'npm') {
      const pkg = url.searchParams.get('package');
      if (!pkg) return errRes(res, 'Parameter "package" is required');
      const d = await safeFetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'NPM Registry',
        name: d.name, version: d.version,
        description: d.description, license: d.license,
        author: d.author?.name || d.author,
        homepage: d.homepage, repository: d.repository?.url,
        keywords: d.keywords?.slice(0, 10),
        dependencies_count: d.dependencies ? Object.keys(d.dependencies).length : 0
      });
    }

    if (ep === 'country') {
      const name = url.searchParams.get('name');
      if (!name) return errRes(res, 'Parameter "name" is required');
      const d = await safeFetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`);
      const c = d[0] || {};
      return res.json({
        status: true, author: 'Kyoto API', provider: 'REST Countries',
        name: c.name?.common, official: c.name?.official,
        capital: c.capital?.[0], population: c.population,
        flag: c.flags?.png, coat_of_arms: c.coatOfArms?.png,
        region: c.region, subregion: c.subregion,
        languages: c.languages,
        currencies: Object.values(c.currencies || {}).map(c => ({
          name: c.name, symbol: c.symbol
        })),
        timezones: c.timezones, area: c.area,
        maps: c.maps, continents: c.continents
      });
    }

    if (ep === 'holiday') {
      const year = url.searchParams.get('year') || new Date().getFullYear();
      const country = url.searchParams.get('country') || 'ID';
      const d = await safeFetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Nager.Date',
        year, country,
        total_holidays: d.length,
        holidays: d.slice(0, 20).map(h => ({
          date: h.date, name: h.name,
          local_name: h.localName,
          types: h.types
        }))
      });
    }

    if (ep === 'exchange') {
      const base = url.searchParams.get('base') || 'USD';
      const target = url.searchParams.get('to');
      const d = await safeFetch(`https://open.er-api.com/v6/latest/${base}`);
      if (d.result === 'error') throw new Error(d['error-type'] || 'Exchange rate error');
      
      const rates = target ? { [target]: d.rates[target] } : d.rates;
      return res.json({
        status: true, author: 'Kyoto API', provider: 'ExchangeRate-API',
        base, rates,
        updated: d.time_last_update_utc,
        next_update: d.time_next_update_utc
      });
    }

    if (ep === 'time') {
      const tz = url.searchParams.get('timezone') || 'Asia/Jakarta';
      const d = await safeFetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(tz)}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'WorldTimeAPI',
        timezone: d.timezone, datetime: d.datetime,
        day_of_week: d.day_of_week, day_of_year: d.day_of_year,
        week_number: d.week_number,
        utc_offset: d.utc_offset, unixtime: d.unixtime
      });
    }

    if (ep === 'color') {
      const hex = (url.searchParams.get('hex') || 'FF5733').replace('#', '');
      const d = await safeFetch(`https://www.thecolorapi.com/id?hex=${hex}`);
      return res.json({
        status: true, author: 'Kyoto API', provider: 'The Color API',
        hex: `#${hex}`, name: d.name?.value,
        rgb: d.rgb, hsl: d.hsl, cmyk: d.cmyk,
        image: d.image?.named
      });
    }

    if (ep === 'uuid') {
      const count = Math.min(parseInt(url.searchParams.get('count')) || 1, 10);
      const uuids = Array.from({ length: count }, () => crypto.randomUUID());
      return res.json({
        status: true, author: 'Kyoto API',
        count, uuids
      });
    }

    // ===== NEW ENDPOINTS =====

    // Crypto prices via CoinGecko free API
    if (ep === 'crypto') {
      const coin = url.searchParams.get('coin') || 'bitcoin';
      const currency = url.searchParams.get('currency') || 'usd';
      
      try {
        const d = await safeFetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_last_updated_at=true`,
          {}, 8000
        );
        
        const data = d[coin];
        if (!data) throw new Error(`Coin "${coin}" not found`);
        
        return res.json({
          status: true, author: 'Kyoto API', provider: 'CoinGecko',
          coin,
          price: data[currency],
          currency: currency.toUpperCase(),
          change_24h: data[`${currency}_24h_change`]?.toFixed(2) + '%',
          market_cap: data[`${currency}_market_cap`],
          last_updated: new Date(data.last_updated_at * 1000).toISOString()
        });
      } catch (e) {
        // Fallback to alternative API
        try {
          const d = await safeFetch(`https://api.coincap.io/v2/assets/${coin}`, {}, 6000);
          const price = currency !== 'usd' 
            ? null 
            : parseFloat(d.data?.priceUsd).toFixed(2);
          
          return res.json({
            status: true, author: 'Kyoto API', provider: 'CoinCap (fallback)',
            coin, price_usd: price,
            change_24h: parseFloat(d.data?.changePercent24Hr).toFixed(2) + '%',
            rank: d.data?.rank,
            supply: d.data?.supply,
            market_cap_usd: d.data?.marketCapUsd
          });
        } catch {
          return errRes(res, `Failed to fetch crypto data. CoinGecko rate limit may be active.`);
        }
      }
    }

    // Movie info via OMDB (free tier - 1000 req/day)
    if (ep === 'movie') {
      const title = url.searchParams.get('title');
      if (!title) return errRes(res, 'Parameter "title" is required');
      
      const OMDB_KEY = 'trilogy'; // OMDB free test key, works for demo
      try {
        const d = await safeFetch(
          `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`,
          {}, 8000
        );
        
        if (d.Response === 'False') throw new Error(d.Error || 'Movie not found');
        
        return res.json({
          status: true, author: 'Kyoto API', provider: 'OMDB',
          title: d.Title, year: d.Year, rated: d.Rated,
          released: d.Released, runtime: d.Runtime,
          genre: d.Genre, director: d.Director,
          writer: d.Writer, actors: d.Actors,
          plot: d.Plot, language: d.Language,
          country: d.Country, awards: d.Awards,
          poster: d.Poster, ratings: d.Ratings,
          imdb: { id: d.imdbID, rating: d.imdbRating, votes: d.imdbVotes },
          box_office: d.BoxOffice, production: d.Production
        });
      } catch {
        return errRes(res, 'Movie not found or OMDB API error. Try different title.');
      }
    }

    // Lyrics via Lyrics.ovh
    if (ep === 'lyrics') {
      const artist = url.searchParams.get('artist');
      const song = url.searchParams.get('song');
      if (!artist || !song) return errRes(res, 'Parameters "artist" AND "song" are required');
      
      try {
        const d = await safeFetch(
          `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`,
          {}, 8000
        );
        
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Lyrics.ovh',
          artist, song,
          lyrics: d.lyrics,
          lines_count: d.lyrics.split('\n').length,
          preview: d.lyrics.split('\n').slice(0, 5).join('\n')
        });
      } catch {
        return errRes(res, `Lyrics not found for "${artist} - ${song}". Check spelling.`);
      }
    }

    // Universities by country
    if (ep === 'universities') {
      const country = url.searchParams.get('country');
      if (!country) return errRes(res, 'Parameter "country" is required (e.g., Indonesia, Japan, United States)');
      
      try {
        const d = await safeFetch(
          `http://universities.hipolabs.com/search?country=${encodeURIComponent(country)}`,
          {}, 8000
        );
        
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Hipolabs Universities API',
          country,
          total: d.length,
          universities: d.slice(0, 20).map(u => ({
            name: u.name,
            domains: u.domains,
            web_pages: u.web_pages,
            country: u.country,
            alpha_two_code: u.alpha_two_code,
            state_province: u['state-province']
          }))
        });
      } catch {
        return errRes(res, 'Failed to fetch universities. Check country name.');
      }
    }

    // IP Geolocation (redundant with stalker but kept for convenience)
    if (ep === 'ip-geo') {
      const ip = url.searchParams.get('ip') || '';
      try {
        const d = await safeFetch(`https://ipapi.co/${ip}/json/`, {}, 8000);
        if (d.error) throw new Error(d.reason || 'IP lookup failed');
        return res.json({
          status: true, author: 'Kyoto API', provider: 'ipapi.co',
          ip: d.ip, city: d.city, region: d.region,
          country: d.country_name, country_code: d.country_code,
          continent: d.continent_code,
          postal: d.postal, timezone: d.timezone,
          org: d.org, isp: d.org,
          lat: d.latitude, lon: d.longitude,
          currency: d.currency, languages: d.languages
        });
      } catch {
        return errRes(res, 'IP lookup failed. Check IP format.');
      }
    }

    // Wikipedia search
    if (ep === 'wikipedia-search') {
      const q = url.searchParams.get('query');
      if (!q) return errRes(res, 'Parameter "query" is required');
      const d = await safeFetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=10`
      );
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Wikipedia',
        query: q,
        total_hits: d.query?.searchinfo?.totalhits,
        results: (d.query?.search || []).map(r => ({
          title: r.title,
          snippet: r.snippet.replace(/<[^>]+>/g, ''),
          wordcount: r.wordcount,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`
        }))
      });
    }

    return errRes(res, `Endpoint /api/info/${ep} not found. Available: wikipedia, dictionary, github, github-repo, npm, country, holiday, exchange, time, color, uuid, crypto, movie, lyrics, universities, ip-geo, wikipedia-search`);
  
  } catch (err) {
    return res.status(500).json({
      status: false, author: 'Kyoto API',
      error: err.message,
      hint: 'Upstream API may be rate-limited or blocked',
      timestamp: new Date().toISOString()
    });
  }
}
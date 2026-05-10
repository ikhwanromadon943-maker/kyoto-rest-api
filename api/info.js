import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/info\/?/, '');

    if (ep === 'wikipedia') {
      const title = url.searchParams.get('title');
      if (!title) return errRes(res, 'Parameter "title" is required');
      const d = await safeFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Wikipedia', title: d.title, extract: d.extract, url: d.content_urls?.desktop?.page, image: d.thumbnail?.source });
    }

    if (ep === 'dictionary') {
      const word = url.searchParams.get('word');
      if (!word) return errRes(res, 'Parameter "word" is required');
      const d = await safeFetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Free Dictionary API', word, definitions: d[0]?.meanings || [] });
    }

    if (ep === 'github') {
      const username = url.searchParams.get('username');
      if (!username) return errRes(res, 'Parameter "username" is required');
      const d = await safeFetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'GitHub API', user: { login:d.login, name:d.name, bio:d.bio, repos:d.public_repos, followers:d.followers, following:d.following, avatar:d.avatar_url, created_at:d.created_at } });
    }

    if (ep === 'npm') {
      const pkg = url.searchParams.get('package');
      if (!pkg) return errRes(res, 'Parameter "package" is required');
      const d = await safeFetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'NPM Registry', name:d.name, version:d.version, description:d.description, license:d.license, author:d.author?.name, homepage:d.homepage });
    }

    if (ep === 'country') {
      const name = url.searchParams.get('name');
      if (!name) return errRes(res, 'Parameter "name" is required');
      const d = await safeFetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`);
      const c = d[0] || {};
      return res.json({ status: true, author: 'Kyoto API', provider: 'REST Countries', name:c.name?.common, official:c.name?.official, capital:c.capital?.[0], population:c.population, flag:c.flags?.png, region:c.region, subregion:c.subregion, currency: Object.values(c.currencies||{})[0] });
    }

    if (ep === 'holiday') {
      const year = url.searchParams.get('year') || new Date().getFullYear();
      const country = url.searchParams.get('country') || 'ID';
      const d = await safeFetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Nager.Date', year, country, holidays: d.slice(0,20) });
    }

    // NEW: GitHub repo info
    if (ep === 'github-repo') {
      const repo = url.searchParams.get('repo'); // format: owner/repo
      if (!repo) return errRes(res, 'Parameter "repo" is required (format: owner/repo)');
      const d = await safeFetch(`https://api.github.com/repos/${repo}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'GitHub API', name:d.name, full_name:d.full_name, description:d.description, stars:d.stargazers_count, forks:d.forks_count, language:d.language, topics:d.topics, url:d.html_url, created_at:d.created_at });
    }

    // NEW: IP geolocation
    if (ep === 'ip-geo') {
      const ip = url.searchParams.get('ip') || '';
      const d = await safeFetch(`https://ipapi.co/${ip}/json/`);
      if (d.error) throw new Error(d.reason || 'IP lookup failed');
      return res.json({ status: true, author: 'Kyoto API', provider: 'ipapi.co', ip:d.ip, city:d.city, region:d.region, country:d.country_name, country_code:d.country_code, timezone:d.timezone, org:d.org, lat:d.latitude, lon:d.longitude });
    }

    // NEW: Exchange rates
    if (ep === 'exchange') {
      const base = url.searchParams.get('base') || 'USD';
      const d = await safeFetch(`https://open.er-api.com/v6/latest/${base}`);
      if (d.result === 'error') throw new Error(d['error-type'] || 'Exchange rate error');
      const to = url.searchParams.get('to');
      const rates = to ? { [to]: d.rates[to] } : d.rates;
      return res.json({ status: true, author: 'Kyoto API', provider: 'ExchangeRate-API', base, rates, updated: d.time_last_update_utc });
    }

    // NEW: UUID generator
    if (ep === 'uuid') {
      const count = Math.min(parseInt(url.searchParams.get('count')) || 1, 10);
      const uuids = Array.from({length: count}, () => crypto.randomUUID());
      return res.json({ status: true, author: 'Kyoto API', count, uuids });
    }

    // NEW: Color info
    if (ep === 'color') {
      const hex = (url.searchParams.get('hex') || 'FF5733').replace('#', '');
      const d = await safeFetch(`https://www.thecolorapi.com/id?hex=${hex}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'The Color API', hex: `#${hex}`, name:d.name?.value, rgb: d.rgb, hsl: d.hsl, cmyk: d.cmyk, image: d.image?.named });
    }

    // NEW: Time & timezone
    if (ep === 'time') {
      const tz = url.searchParams.get('timezone') || 'Asia/Jakarta';
      const d = await safeFetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(tz)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'WorldTimeAPI', timezone:d.timezone, datetime:d.datetime, day_of_week:d.day_of_week, day_of_year:d.day_of_year, utc_offset:d.utc_offset });
    }

    // NEW: Search Wikipedia
    if (ep === 'wikipedia-search') {
      const q = url.searchParams.get('query');
      if (!q) return errRes(res, 'Parameter "query" is required');
      const d = await safeFetch(`https://en.wikipedia.org/w/api.php?action=search&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=5`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Wikipedia', query: q, results: (d.query?.search||[]).map(r=>({title:r.title,snippet:r.snippet.replace(/<[^>]+>/g,''),url:`https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`})) });
    }

    return errRes(res, `Endpoint /api/info/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}

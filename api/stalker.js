import { safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/stalker\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  try {
    // ─── IP LOOKUP ────────────────────────────────────────────────────────────
    if (ep === 'ip') {
      const ipAddr = url.searchParams.get('ip') || '';
      const d = await safeFetch(`http://ip-api.com/json/${ipAddr}?fields=66846719`, {}, 8000);
      if (d.status === 'fail') throw new Error(d.message || 'IP lookup failed');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'ip-api.com',
        ip: d.query, country: d.country, country_code: d.countryCode,
        region: d.regionName, city: d.city, zip: d.zip,
        lat: d.lat, lon: d.lon, timezone: d.timezone,
        isp: d.isp, org: d.org, asn: d.as,
        mobile: d.mobile, proxy: d.proxy, hosting: d.hosting,
        response_time: rt()
      });
    }

    // ─── MY IP ────────────────────────────────────────────────────────────────
    if (ep === 'my-ip') {
      try {
        const d = await safeFetch('https://freeipapi.com/api/json', {}, 6000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'FreeIPAPI', ip: d.ipAddress, country: d.countryName, city: d.cityName, region: d.regionName, lat: d.latitude, lon: d.longitude, timezone: d.timeZone, isp: d.isp, response_time: rt() });
      } catch {
        const d = await safeFetch('https://ipapi.co/json/', {}, 6000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'ipapi.co (fallback)', ip: d.ip, country: d.country_name, city: d.city, region: d.region, timezone: d.timezone, org: d.org, response_time: rt() });
      }
    }

    // ─── DNS LOOKUP ───────────────────────────────────────────────────────────
    if (ep === 'dns') {
      const domain = url.searchParams.get('domain');
      const type = (url.searchParams.get('type') || 'A').toUpperCase();
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const d = await safeFetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Google DNS', domain, type, answers: d.Answer || [], authority: d.Authority || [], response_time: rt() });
    }

    // ─── WHOIS ────────────────────────────────────────────────────────────────
    if (ep === 'whois') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      try {
        const d = await safeFetch(`https://rdap.org/domain/${cleanDomain}`, {}, 10000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'RDAP',
          domain: d.ldhName || cleanDomain, status: d.status,
          registered: d.events?.find(e => e.eventAction === 'registration')?.eventDate,
          updated: d.events?.find(e => e.eventAction === 'last changed')?.eventDate,
          expires: d.events?.find(e => e.eventAction === 'expiration')?.eventDate,
          nameservers: d.nameservers?.map(ns => ns.ldhName),
          registrar: d.entities?.find(e => e.roles?.includes('registrar'))?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3],
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `WHOIS lookup failed: ${e.message}`);
      }
    }

    // ─── GITHUB ACTIVITY ──────────────────────────────────────────────────────
    if (ep === 'github-activity') {
      const username = url.searchParams.get('username');
      if (!username) return errRes(res, 'Parameter "username" is required');
      const d = await safeFetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=15`, { headers: { 'Accept': 'application/vnd.github.v3+json' } }, 8000);
      if (!Array.isArray(d)) throw new Error(`User "${username}" not found`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'GitHub Events API',
        username, total_events: d.length,
        recent_activity: d.slice(0, 15).map(event => ({
          type: event.type, repo: event.repo?.name,
          created_at: event.created_at, action: event.payload?.action,
          ref: event.payload?.ref,
          commits: event.payload?.commits?.length || 0,
          comment: event.payload?.comment?.body?.slice(0, 100)
        })),
        response_time: rt()
      });
    }

    // ─── WEBSITE STATUS ───────────────────────────────────────────────────────
    if (ep === 'website-status') {
      const siteUrl = url.searchParams.get('url');
      if (!siteUrl) return errRes(res, 'Parameter "url" is required');
      if (!siteUrl.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');
      const t0 = Date.now();
      try {
        const response = await fetch(siteUrl, { method: 'HEAD', headers: { 'User-Agent': 'Kyoto-API/3.0' }, signal: AbortSignal.timeout(8000) });
        const latency = Date.now() - t0;
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', url: siteUrl, online: response.ok || response.status < 500, http_status: response.status, latency_ms: latency, server: response.headers.get('server'), response_time: rt() });
      } catch {
        return res.json({ status: true, author: 'Kyoto API', url: siteUrl, online: false, http_status: null, latency_ms: Date.now() - t0, response_time: rt() });
      }
    }

    // ─── NPM PACKAGE STATS ────────────────────────────────────────────────────
    if (ep === 'npm-stats') {
      const pkg = url.searchParams.get('package');
      if (!pkg) return errRes(res, 'Parameter "package" is required');
      const [info, downloads] = await Promise.all([
        safeFetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, {}, 8000),
        safeFetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkg)}`, {}, 8000).catch(() => null)
      ]);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'NPM Registry',
        name: info.name, version: info.version, description: info.description,
        license: info.license, author: info.author?.name || info.author,
        homepage: info.homepage, keywords: info.keywords?.slice(0, 10),
        dependencies: Object.keys(info.dependencies || {}).length,
        downloads_last_month: downloads?.downloads || null,
        response_time: rt()
      });
    }

    // ─── PYPI PACKAGE ─────────────────────────────────────────────────────────
    if (ep === 'pypi') {
      const pkg = url.searchParams.get('package');
      if (!pkg) return errRes(res, 'Parameter "package" is required');
      const d = await safeFetch(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`, {}, 8000);
      const info = d.info;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'PyPI',
        name: info.name, version: info.version, summary: info.summary,
        author: info.author, license: info.license,
        home_page: info.home_page, project_url: info.project_url,
        requires_python: info.requires_python,
        keywords: info.keywords,
        classifiers: info.classifiers?.slice(0, 5),
        response_time: rt()
      });
    }

    // ─── CRATES.IO ────────────────────────────────────────────────────────────
    if (ep === 'crates') {
      const pkg = url.searchParams.get('package');
      if (!pkg) return errRes(res, 'Parameter "package" is required');
      const d = await safeFetch(`https://crates.io/api/v1/crates/${encodeURIComponent(pkg)}`, { headers: { 'User-Agent': 'Kyoto-API/3.0' } }, 8000);
      const c = d.crate;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Crates.io',
        name: c.name, version: d.versions?.[0]?.num,
        description: c.description, license: d.versions?.[0]?.license,
        downloads: c.downloads, recent_downloads: c.recent_downloads,
        repository: c.repository, homepage: c.homepage,
        keywords: d.keywords?.map(k => k.keyword),
        response_time: rt()
      });
    }

    // ─── DOMAIN AVAILABILITY ──────────────────────────────────────────────────
    if (ep === 'domain-check') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      // Check DNS — if no A record exists, likely available
      try {
        const dns = await safeFetch(`https://dns.google/resolve?name=${encodeURIComponent(cleanDomain)}&type=A`, {}, 6000);
        const hasRecords = !!(dns.Answer?.length);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Google DNS',
          domain: cleanDomain, has_dns_records: hasRecords,
          likely_registered: hasRecords,
          note: 'DNS check only — does not guarantee registration status',
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `Domain check failed: ${e.message}`);
      }
    }

    return errRes(res, `Endpoint /api/stalker/${ep} not found. Available: ip, my-ip, dns, whois, github-activity, website-status, npm-stats, pypi, crates, domain-check`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked', timestamp: new Date().toISOString() });
  }
}

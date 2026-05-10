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

  // Rate limit check
  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  try {
    if (ep === 'ip') {
      const ipAddr = url.searchParams.get('ip') || '';
      const d = await safeFetch(`http://ip-api.com/json/${ipAddr}?fields=66846719`);
      if (d.status === 'fail') throw new Error(d.message || 'IP lookup failed');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'ip-api.com', ip: d.query, country: d.country, countryCode: d.countryCode, region: d.regionName, city: d.city, zip: d.zip, lat: d.lat, lon: d.lon, timezone: d.timezone, isp: d.isp, org: d.org, as: d.as, mobile: d.mobile, proxy: d.proxy, hosting: d.hosting, response_time: rt() });
    }

    if (ep === 'my-ip') {
      const d = await safeFetch('https://freeipapi.com/api/json');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeIPAPI', ip: d.ipAddress, country: d.countryName, city: d.cityName, region: d.regionName, lat: d.latitude, lon: d.longitude, timezone: d.timeZone, isp: d.isp, response_time: rt() });
    }

    if (ep === 'dns') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const d = await safeFetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}`);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Google DNS', domain, answers: d.Answer || [], authority: d.Authority || [], question: d.Question, response_time: rt() });
    }

    if (ep === 'whois') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      try {
        const d = await safeFetch(`https://api.domainsdb.info/v1/domains/search?domain=${encodeURIComponent(domain)}&limit=5`);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'domainsdb.info', domain, results: d.domains?.slice(0, 5) || [], response_time: rt() });
      } catch { return errRes(res, 'WHOIS lookup failed. Domain may not exist.'); }
    }

    if (ep === 'ssl') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const d = await safeFetch(`https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(domain)}&fromCache=on&maxAge=24`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'SSL Labs', domain, host: d.host, status: d.status, grade: d.endpoints?.[0]?.grade || 'Pending', server_name: d.endpoints?.[0]?.serverName, ip: d.endpoints?.[0]?.ipAddress, response_time: rt() });
    }

    if (ep === 'website-status') {
      const siteUrl = url.searchParams.get('url');
      if (!siteUrl) return errRes(res, 'Parameter "url" is required');
      const startTime = Date.now();
      try {
        const response = await fetch(siteUrl, { method: 'HEAD', headers: { 'User-Agent': 'Kyoto-API/3.0' }, signal: AbortSignal.timeout(8000) });
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', url: siteUrl, online: response.ok, http_status: response.status, response_time: `${Date.now() - startTime}ms` });
      } catch {
        return res.json({ status: true, author: 'Kyoto API', url: siteUrl, online: false, http_status: null, response_time: `${Date.now() - startTime}ms` });
      }
    }

    if (ep === 'github-activity') {
      const username = url.searchParams.get('username');
      if (!username) return errRes(res, 'Parameter "username" is required');
      try {
        const d = await safeFetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=10`);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'GitHub Events API', username, total_events: d.length, recent_activity: d.slice(0, 10).map(event => ({ type: event.type, repo: event.repo?.name, created_at: event.created_at, action: event.payload?.action, ref: event.payload?.ref, commits: event.payload?.commits?.length })), response_time: rt() });
      } catch { return errRes(res, 'Failed to fetch GitHub activity. User may not exist.'); }
    }

    if (ep === 'email-breach') {
      const email = url.searchParams.get('email');
      if (!email) return errRes(res, 'Parameter "email" is required');
      try {
        const d = await safeFetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=true`, { headers: { 'hibp-api-key': '' } }, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'HaveIBeenPwned', email, breaches_count: d.length, breaches: d.map(b => ({ name: b.Name, domain: b.Domain, date: b.BreachDate, description: b.Description?.slice(0, 150), data_classes: b.DataClasses })), response_time: rt() });
      } catch {
        return res.json({ status: true, author: 'Kyoto API', email, breaches_count: 0, message: 'No breaches found or API unavailable', response_time: rt() });
      }
    }

    return errRes(res, `Endpoint /api/stalker/${ep} not found.`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked', timestamp: new Date().toISOString() });
  }
}
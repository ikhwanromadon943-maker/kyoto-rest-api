import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/stalker\/?/, '');

    if (ep === 'ip') {
      const ip = url.searchParams.get('ip') || '';
      const d = await safeFetch(`http://ip-api.com/json/${ip}`);
      if (d.status === 'fail') throw new Error(d.message || 'IP lookup failed');
      return res.json({ status: true, author: 'Kyoto API', provider: 'ip-api.com', ip:d.query, country:d.country, region:d.regionName, city:d.city, isp:d.isp, org:d.org, lat:d.lat, lon:d.lon, timezone:d.timezone });
    }

    if (ep === 'my-ip') {
      const d = await safeFetch('https://freeipapi.com/api/json');
      return res.json({ status: true, author: 'Kyoto API', provider: 'FreeIPAPI', ip:d.ipAddress, country:d.countryName, city:d.cityName, lat:d.latitude, lon:d.longitude });
    }

    if (ep === 'dns') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const d = await safeFetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Google DNS', domain, answers: d.Answer || [] });
    }

    // NEW: WHOIS lookup
    if (ep === 'whois') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const d = await safeFetch(`https://api.domainsdb.info/v1/domains/search?domain=${encodeURIComponent(domain)}&limit=5`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'domainsdb.info', domain, results: d.domains?.slice(0,5) || [] });
    }

    // NEW: SSL certificate info
    if (ep === 'ssl') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const d = await safeFetch(`https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(domain)}&fromCache=on&maxAge=24`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'SSL Labs', domain, status: d.status, grade: d.endpoints?.[0]?.grade || 'Pending', ip: d.endpoints?.[0]?.ipAddress });
    }

    // NEW: Domain availability check
    if (ep === 'domain-check') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const d = await safeFetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
      const available = !d.Answer || d.Answer.length === 0;
      return res.json({ status: true, author: 'Kyoto API', domain, available, note: available ? 'No DNS A record found — domain may be available' : 'DNS A record found — domain is likely taken' });
    }

    // NEW: Open ports check (simple via external API)
    if (ep === 'port-check') {
      const host = url.searchParams.get('host');
      const port = url.searchParams.get('port') || '80';
      if (!host) return errRes(res, 'Parameter "host" is required');
      const d = await safeFetch(`https://api.hackertarget.com/nmap/?q=${encodeURIComponent(host)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'HackerTarget', host, result: d });
    }

    // NEW: Website status check
    if (ep === 'website-status') {
      const siteUrl = url.searchParams.get('url');
      if (!siteUrl) return errRes(res, 'Parameter "url" is required');
      const start = Date.now();
      try {
        const r = await fetch(siteUrl, { method: 'HEAD' });
        return res.json({ status: true, author: 'Kyoto API', url: siteUrl, online: r.ok, http_status: r.status, response_time: `${Date.now() - start}ms` });
      } catch {
        return res.json({ status: true, author: 'Kyoto API', url: siteUrl, online: false, http_status: null, response_time: `${Date.now() - start}ms` });
      }
    }

    return errRes(res, `Endpoint /api/stalker/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}

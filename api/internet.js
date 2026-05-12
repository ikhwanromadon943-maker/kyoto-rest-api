import { safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/internet\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  try {
    // ─── META EXTRACTOR ───────────────────────────────────────────────────────
    if (ep === 'meta') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return errRes(res, 'Parameter "url" is required');
      if (!targetUrl.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(targetUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Kyoto-API/3.0 Meta Extractor' }
        });
        clearTimeout(timeout);
        const html = await response.text();

        const getMeta = (name) => {
          const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
            || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i'));
          return m ? m[1] : null;
        };

        const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null;
        const origin = new URL(targetUrl).origin;
        const faviconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
        const favicon = faviconMatch ? (faviconMatch[1].startsWith('http') ? faviconMatch[1] : origin + faviconMatch[1]) : `${origin}/favicon.ico`;

        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', url: targetUrl,
          meta: {
            title, description: getMeta('description'), keywords: getMeta('keywords'),
            og: { title: getMeta('og:title'), description: getMeta('og:description'), image: getMeta('og:image'), type: getMeta('og:type'), site_name: getMeta('og:site_name') },
            twitter: { card: getMeta('twitter:card'), title: getMeta('twitter:title'), description: getMeta('twitter:description'), image: getMeta('twitter:image') },
            favicon
          },
          http_status: response.status, response_time: rt()
        });
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') throw new Error('Website timeout');
        throw new Error(`Failed to fetch: ${e.message}`);
      }
    }

    // ─── HEADERS ──────────────────────────────────────────────────────────────
    if (ep === 'headers') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return errRes(res, 'Parameter "url" is required');
      if (!targetUrl.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(targetUrl, {
          method: 'HEAD', signal: controller.signal, redirect: 'follow',
          headers: { 'User-Agent': 'Kyoto-API/3.0 Header Inspector' }
        });
        clearTimeout(timeout);
        const headers = {};
        response.headers.forEach((value, key) => { headers[key] = value; });
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', url: targetUrl, status_code: response.status, status_text: response.statusText, headers, response_time: rt() });
      } catch (e) {
        clearTimeout(timeout);
        throw new Error(`Failed to fetch headers: ${e.name === 'AbortError' ? 'Timeout' : e.message}`);
      }
    }

    // ─── ROBOTS.TXT ───────────────────────────────────────────────────────────
    if (ep === 'robots') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const robotsUrl = `https://${cleanDomain}/robots.txt`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(robotsUrl, { signal: controller.signal, headers: { 'User-Agent': 'Kyoto-API/3.0' } });
        clearTimeout(timeout);
        const text = await response.text();
        const sitemaps = [...text.matchAll(/Sitemap:\s*(.+)/gi)].map(m => m[1].trim());
        const disallowed = [...text.matchAll(/Disallow:\s*(.+)/gi)].map(m => m[1].trim()).filter(Boolean);
        const allowed = [...text.matchAll(/Allow:\s*(.+)/gi)].map(m => m[1].trim()).filter(Boolean);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', domain: cleanDomain, robots_url: robotsUrl, sitemaps, disallowed: disallowed.slice(0, 20), allowed: allowed.slice(0, 20), raw: text.slice(0, 3000), response_time: rt() });
      } catch (e) {
        clearTimeout(timeout);
        return res.json({ status: true, author: 'Kyoto API', domain: cleanDomain, error: `robots.txt not found: ${e.message}`, response_time: rt() });
      }
    }

    // ─── SITEMAP ──────────────────────────────────────────────────────────────
    if (ep === 'sitemap') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const sitemapUrl = `https://${cleanDomain}/sitemap.xml`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(sitemapUrl, { signal: controller.signal, headers: { 'User-Agent': 'Kyoto-API/3.0' } });
        clearTimeout(timeout);
        const text = await response.text();
        const urls = [...text.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m => m[1].trim());
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', domain: cleanDomain, sitemap_url: sitemapUrl, total_urls: urls.length, urls: urls.slice(0, 50), response_time: rt() });
      } catch (e) {
        clearTimeout(timeout);
        return errRes(res, `No sitemap.xml found: ${e.message}`);
      }
    }

    // ─── URL UNSHORTEN ────────────────────────────────────────────────────────
    if (ep === 'unshorten') {
      const shortUrl = url.searchParams.get('url');
      if (!shortUrl) return errRes(res, 'Parameter "url" is required');
      if (!shortUrl.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(shortUrl, { method: 'HEAD', signal: controller.signal, redirect: 'manual', headers: { 'User-Agent': 'Kyoto-API/3.0' } });
        clearTimeout(timeout);
        const location = response.headers.get('location');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', original: shortUrl, expanded: location || shortUrl, is_shortened: !!location, status_code: response.status, response_time: rt() });
      } catch (e) {
        clearTimeout(timeout);
        throw new Error(`Failed to unshorten: ${e.message}`);
      }
    }

    // ─── EMAIL VALIDATOR ──────────────────────────────────────────────────────
    if (ep === 'email-check') {
      const email = url.searchParams.get('email');
      if (!email) return errRes(res, 'Parameter "email" is required');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const formatValid = emailRegex.test(email);

      if (!formatValid) {
        return res.json({ status: true, author: 'Kyoto API', email, valid: false, reason: 'Invalid email format', response_time: rt() });
      }

      const domain = email.split('@')[1];
      const disposableDomains = ['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'throwaway.email', 'fakeinbox.com', 'yopmail.com', 'sharklasers.com'];
      const isDisposable = disposableDomains.some(d => domain.includes(d));

      let hasMX = null;
      try {
        const dns = await safeFetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {}, 5000);
        hasMX = !!(dns.Answer?.length);
      } catch { hasMX = null; }

      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', email, valid: formatValid && !isDisposable, format_valid: formatValid, domain, has_mx_record: hasMX, is_disposable: isDisposable, response_time: rt() });
    }

    // ─── REDIRECT CHAIN ───────────────────────────────────────────────────────
    if (ep === 'redirect') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return errRes(res, 'Parameter "url" is required');
      if (!targetUrl.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');

      const chain = [];
      let currentUrl = targetUrl;

      for (let i = 0; i < 10; i++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(currentUrl, { method: 'HEAD', signal: controller.signal, redirect: 'manual', headers: { 'User-Agent': 'Kyoto-API/3.0' } });
          clearTimeout(timeout);
          chain.push({ step: i + 1, url: currentUrl, status: response.status });
          const location = response.headers.get('location');
          if (location && [301, 302, 303, 307, 308].includes(response.status)) {
            currentUrl = new URL(location, currentUrl).href;
          } else break;
        } catch (e) {
          clearTimeout(timeout);
          chain.push({ step: i + 1, url: currentUrl, error: e.message });
          break;
        }
      }

      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', original_url: targetUrl, final_url: chain[chain.length - 1]?.url || targetUrl, total_redirects: chain.length - 1, chain, response_time: rt() });
    }

    // ─── SSL INFO ─────────────────────────────────────────────────────────────
    if (ep === 'ssl') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      try {
        const d = await safeFetch(`https://api.ssllabs.com/api/v3/analyze?host=${cleanDomain}&fromCache=on&maxAge=24`, {}, 10000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'SSL Labs',
          domain: cleanDomain, analysis_status: d.status,
          grade: d.endpoints?.[0]?.grade || 'Analyzing',
          server_name: d.endpoints?.[0]?.serverName,
          ip_address: d.endpoints?.[0]?.ipAddress,
          response_time: rt()
        });
      } catch {
        // Fallback: just verify HTTPS connection
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        try {
          const resp = await fetch(`https://${cleanDomain}`, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeout);
          logRequest(url.pathname, ip, ua, rt());
          return res.json({ status: true, author: 'Kyoto API', domain: cleanDomain, https_accessible: resp.ok || resp.status < 500, http_status: resp.status, note: 'SSL Labs API unavailable — basic HTTPS check performed', response_time: rt() });
        } catch (e) {
          clearTimeout(timeout);
          return res.json({ status: true, author: 'Kyoto API', domain: cleanDomain, https_accessible: false, error: e.message, response_time: rt() });
        }
      }
    }

    // ─── DNS LOOKUP ───────────────────────────────────────────────────────────
    if (ep === 'dns') {
      const domain = url.searchParams.get('domain');
      const type = (url.searchParams.get('type') || 'A').toUpperCase(); // A | AAAA | MX | TXT | CNAME | NS
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const d = await safeFetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Google DNS',
        domain, type, answers: d.Answer || [], authority: d.Authority || [],
        status_code: d.Status, truncated: d.TC,
        response_time: rt()
      });
    }

    // ─── WHOIS ────────────────────────────────────────────────────────────────
    if (ep === 'whois') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      try {
        // Use rdap.org — free, no auth
        const d = await safeFetch(`https://rdap.org/domain/${cleanDomain}`, {}, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'RDAP',
          domain: d.ldhName || cleanDomain,
          status: d.status,
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

    // ─── PING / STATUS ────────────────────────────────────────────────────────
    if (ep === 'ping') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return errRes(res, 'Parameter "url" is required');
      if (!targetUrl.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');
      const t0 = Date.now();
      try {
        const response = await fetch(targetUrl, { method: 'HEAD', headers: { 'User-Agent': 'Kyoto-API/3.0' }, signal: AbortSignal.timeout(8000) });
        const latency = Date.now() - t0;
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', url: targetUrl, online: true, http_status: response.status, latency_ms: latency, response_time: rt() });
      } catch {
        return res.json({ status: true, author: 'Kyoto API', url: targetUrl, online: false, http_status: null, latency_ms: Date.now() - t0, response_time: rt() });
      }
    }

    return errRes(res, `Endpoint /api/internet/${ep} not found. Available: meta, headers, robots, sitemap, unshorten, email-check, redirect, ssl, dns, whois, ping`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Check the URL or domain and try again', timestamp: new Date().toISOString() });
  }
}

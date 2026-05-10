import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/internet\/?/, '');
    const rt = () => `${Date.now() - start}ms`;

    // Extract meta tags dari website
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
        
        // Extract meta tags with regex
        const getMeta = (name) => {
          const regex = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
          const match = html.match(regex);
          return match ? match[1] : null;
        };
        
        const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || null;
        const description = getMeta('description');
        const keywords = getMeta('keywords');
        const ogTitle = getMeta('og:title');
        const ogDescription = getMeta('og:description');
        const ogImage = getMeta('og:image');
        const ogUrl = getMeta('og:url');
        const twitterCard = getMeta('twitter:card');
        const twitterTitle = getMeta('twitter:title');
        const twitterDescription = getMeta('twitter:description');
        const twitterImage = getMeta('twitter:image');
        const favicon = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)?.[1] || 
                       `${new URL(targetUrl).origin}/favicon.ico`;
        
        const h1Tags = [...html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)].map(m => m[1].trim());
        const headings = {
          h1: h1Tags,
          h2: [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)].map(m => m[1].trim()),
          h3: [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/gi)].map(m => m[1].trim())
        };
        
        const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi)]
          .slice(0, 20)
          .map(m => ({ href: m[1], text: m[2].trim() }));
        
        return res.json({
          status: true, author: 'Kyoto API',
          url: targetUrl,
          meta: {
            title, description, keywords,
            og: { title: ogTitle, description: ogDescription, image: ogImage, url: ogUrl },
            twitter: { card: twitterCard, title: twitterTitle, description: twitterDescription, image: twitterImage },
            favicon
          },
          headings,
          links_count: links.length,
          links_sample: links.slice(0, 10),
          response_time: rt()
        });
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') throw new Error('Website timeout — too slow to respond');
        throw new Error(`Failed to fetch website: ${e.message}`);
      }
    }

    // Get HTTP headers dari URL
    if (ep === 'headers') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return errRes(res, 'Parameter "url" is required');
      if (!targetUrl.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(targetUrl, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'Kyoto-API/3.0 Header Inspector' }
        });
        clearTimeout(timeout);
        
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        
        return res.json({
          status: true, author: 'Kyoto API',
          url: targetUrl,
          status_code: response.status,
          status_text: response.statusText,
          headers,
          response_time: rt()
        });
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') throw new Error('Request timeout — server too slow');
        throw new Error(`Failed to fetch headers: ${e.message}`);
      }
    }

    // Fetch & parse robots.txt
    if (ep === 'robots') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const robotsUrl = `https://${cleanDomain}/robots.txt`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(robotsUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Kyoto-API/3.0' }
        });
        clearTimeout(timeout);
        
        const text = await response.text();
        const rules = [];
        let currentAgent = '';
        
        text.split('\n').forEach(line => {
          line = line.trim();
          if (line.startsWith('User-agent:')) {
            currentAgent = line.split(':')[1].trim();
          } else if ((line.startsWith('Disallow:') || line.startsWith('Allow:')) && currentAgent) {
            const [directive, path] = line.split(':').map(s => s.trim());
            rules.push({ agent: currentAgent, directive: directive.toLowerCase(), path });
          }
        });
        
        const sitemaps = [...text.matchAll(/Sitemap:\s*(.+)/gi)].map(m => m[1]);
        
        return res.json({
          status: true, author: 'Kyoto API',
          domain: cleanDomain,
          robots_url: robotsUrl,
          rules_count: rules.length,
          rules: rules.slice(0, 30),
          sitemaps,
          raw: text.length > 2000 ? text.slice(0, 2000) + '...' : text,
          response_time: rt()
        });
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') throw new Error('Request timeout');
        return res.json({
          status: true, author: 'Kyoto API',
          domain: cleanDomain,
          error: `No robots.txt found or inaccessible: ${e.message}`,
          response_time: rt()
        });
      }
    }

    // Fetch & parse sitemap.xml
    if (ep === 'sitemap') {
      const domain = url.searchParams.get('domain');
      if (!domain) return errRes(res, 'Parameter "domain" is required');
      
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const sitemapUrl = `https://${cleanDomain}/sitemap.xml`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(sitemapUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Kyoto-API/3.0' }
        });
        clearTimeout(timeout);
        
        const text = await response.text();
        const urls = [...text.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m => m[1]);
        const lastmods = [...text.matchAll(/<lastmod>([^<]+)<\/lastmod>/gi)].map(m => m[1]);
        
        return res.json({
          status: true, author: 'Kyoto API',
          domain: cleanDomain,
          sitemap_url: sitemapUrl,
          total_urls: urls.length,
          urls: urls.slice(0, 50),
          last_modified: lastmods[0] || null,
          response_time: rt()
        });
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') throw new Error('Request timeout');
        return errRes(res, `No sitemap.xml found at ${sitemapUrl}: ${e.message}`);
      }
    }

    // Unshorten URL (expand short links)
    if (ep === 'unshorten') {
      const shortUrl = url.searchParams.get('url');
      if (!shortUrl) return errRes(res, 'Parameter "url" is required');
      if (!shortUrl.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(shortUrl, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'manual',
          headers: { 'User-Agent': 'Kyoto-API/3.0 URL Expander' }
        });
        clearTimeout(timeout);
        
        const location = response.headers.get('location');
        
        if (location) {
          return res.json({
            status: true, author: 'Kyoto API',
            original: shortUrl,
            expanded: location,
            is_shortened: true,
            status_code: response.status,
            response_time: rt()
          });
        } else {
          return res.json({
            status: true, author: 'Kyoto API',
            original: shortUrl,
            expanded: shortUrl,
            is_shortened: false,
            message: 'URL does not appear to be shortened',
            response_time: rt()
          });
        }
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') throw new Error('Request timeout');
        throw new Error(`Failed to unshorten URL: ${e.message}`);
      }
    }

    // Email validator
    if (ep === 'email-check') {
      const email = url.searchParams.get('email');
      if (!email) return errRes(res, 'Parameter "email" is required');
      
      // Basic format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const formatValid = emailRegex.test(email);
      
      if (!formatValid) {
        return res.json({
          status: true, author: 'Kyoto API',
          email,
          valid: false,
          reason: 'Invalid email format',
          response_time: rt()
        });
      }
      
      const domain = email.split('@')[1];
      let hasMX = false;
      
      try {
        const dnsResponse = await safeFetch(
          `https://dns.google/resolve?name=${domain}&type=MX`,
          {}, 6000
        );
        hasMX = dnsResponse.Answer && dnsResponse.Answer.length > 0;
      } catch {
        hasMX = null;
      }
      
      return res.json({
        status: true, author: 'Kyoto API',
        email,
        valid: formatValid,
        format_valid: formatValid,
        domain,
        has_mx_record: hasMX,
        disposable: ['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com'].some(d => domain.includes(d)),
        response_time: rt()
      });
    }

    // URL redirect chain tracer
    if (ep === 'redirect') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return errRes(res, 'Parameter "url" is required');
      if (!targetUrl.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');
      
      const chain = [];
      let currentUrl = targetUrl;
      const maxRedirects = 10;
      
      for (let i = 0; i < maxRedirects; i++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(currentUrl, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'manual',
            headers: { 'User-Agent': 'Kyoto-API/3.0' }
          });
          clearTimeout(timeout);
          
          chain.push({
            step: i + 1,
            url: currentUrl,
            status: response.status,
            status_text: response.statusText
          });
          
          const location = response.headers.get('location');
          if (location && [301, 302, 303, 307, 308].includes(response.status)) {
            currentUrl = new URL(location, currentUrl).href;
          } else {
            break;
          }
        } catch (e) {
          clearTimeout(timeout);
          chain.push({ step: i + 1, url: currentUrl, error: e.message });
          break;
        }
      }
      
      return res.json({
        status: true, author: 'Kyoto API',
        original_url: targetUrl,
        final_url: chain[chain.length - 1]?.url || targetUrl,
        total_redirects: chain.length - 1,
        chain,
        response_time: rt()
      });
    }

    return errRes(res, `Endpoint /api/internet/${ep} not found. Available: meta, headers, robots, sitemap, unshorten, email-check, redirect`);
  
  } catch (err) {
    return res.status(500).json({
      status: false, author: 'Kyoto API',
      error: err.message,
      hint: 'Check the URL and try again',
      timestamp: new Date().toISOString()
    });
  }
}
// Helper: fetch dengan timeout + error detection
export async function safeFetch(url, options = {}, timeoutMs = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: c.signal });
    clearTimeout(t);
    const ct = r.headers.get('content-type') || '';
    // Kalau response HTML padahal expect JSON → kemungkinan Cloudflare block
    if (ct.includes('text/html')) {
      const txt = await r.text();
      if (txt.includes('Cloudflare') || txt.includes('Access denied') || txt.includes('cf-error')) {
        throw new Error('Blocked by Cloudflare or WAF on upstream API');
      }
      if (txt.includes('Rate limit') || txt.includes('Too Many Requests')) {
        throw new Error('Rate limited by upstream API');
      }
      throw new Error(`Upstream returned HTML instead of JSON (status ${r.status})`);
    }
    if (r.status === 429) throw new Error('Rate limited by upstream API — try again later');
    if (r.status === 403) throw new Error('Access denied by upstream API (IP may be blocked)');
    if (r.status === 503) throw new Error('Upstream API is unavailable (503)');
    if (!r.ok) throw new Error(`Upstream API error: HTTP ${r.status}`);
    const data = await r.json();
    // Cek kalau upstream return error object
    if (data?.status === false && data?.error) throw new Error(`Upstream: ${data.error}`);
    if (data?.message?.toLowerCase().includes('rate limit')) throw new Error('Rate limited by upstream API');
    return data;
  } catch (e) {
    clearTimeout(t);
    if (e.name === 'AbortError') throw new Error('Upstream API timeout after ' + timeoutMs / 1000 + 's');
    throw e;
  }
}

export function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function errRes(res, message, status = 200) {
  return res.status(status).json({ status: false, author: 'Kyoto API', error: message });
}

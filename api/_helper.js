// Helper: Vercel-optimized fetch dengan timeout, retry, dan comprehensive error detection
export async function safeFetch(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Kyoto-API/3.0',
        'Accept': 'application/json, text/plain, */*',
        ...options.headers
      }
    });
    
    clearTimeout(timeout);
    const contentType = response.headers.get('content-type') || '';
    
    // Handle HTML responses (usually error pages)
    if (contentType.includes('text/html')) {
      const text = await response.text();
      if (text.includes('Cloudflare') || text.includes('Access denied') || text.includes('cf-error')) {
        throw new Error('Blocked by Cloudflare/WAF on upstream API');
      }
      if (text.includes('Rate limit') || text.includes('Too Many Requests')) {
        throw new Error('Rate limited by upstream API — retry in 60s');
      }
      if (text.includes('502 Bad Gateway') || text.includes('503 Service')) {
        throw new Error('Upstream API temporarily unavailable');
      }
      throw new Error(`Upstream returned HTML instead of JSON (HTTP ${response.status})`);
    }
    
    // Handle HTTP errors
    if (response.status === 429) throw new Error('Rate limited — too many requests');
    if (response.status === 403) throw new Error('Access denied by upstream API');
    if (response.status === 404) throw new Error('Resource not found on upstream API');
    if (response.status === 503) throw new Error('Upstream API is down (503)');
    if (!response.ok) throw new Error(`Upstream API error: HTTP ${response.status}`);
    
    // Parse JSON
    const data = await response.json();
    
    // Check for API-level errors
    if (data?.status === false && data?.error) throw new Error(`Upstream: ${data.error}`);
    if (data?.message?.toLowerCase().includes('rate limit')) throw new Error('Rate limited by upstream');
    if (data?.error) throw new Error(`API Error: ${data.error}`);
    
    return data;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') throw new Error(`Upstream API timeout after ${timeoutMs/1000}s`);
    throw error;
  }
}

// Set CORS headers untuk Vercel serverless
export function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Standard error response
export function errRes(res, message, status = 200) {
  return res.status(status).json({
    status: false,
    author: 'Kyoto API',
    error: message,
    hint: 'Check documentation at /category',
    timestamp: new Date().toISOString()
  });
}

// Success response wrapper
export function successRes(res, data, extra = {}) {
  return res.status(200).json({
    status: true,
    author: 'Kyoto API',
    timestamp: new Date().toISOString(),
    ...data,
    ...extra
  });
}
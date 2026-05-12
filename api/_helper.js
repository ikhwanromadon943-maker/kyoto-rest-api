// ============================================
// WEBHOOK CONFIG
// ============================================
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK || '';

// ============================================
// INTERNAL: Send log to Discord (async, non-blocking)
// ============================================
async function sendWebhook(title, description, color, fields = []) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title, description, color, fields,
          timestamp: new Date().toISOString(),
          footer: { text: 'Kyoto API • Monitor', icon_url: 'https://kyoto-rest-api.vercel.app/favicon.ico' }
        }],
        username: 'Kyoto API Monitor',
        avatar_url: 'https://kyoto-rest-api.vercel.app/favicon.ico'
      })
    });
  } catch (e) {
    // Silent fail — webhook is non-critical
  }
}

// ============================================
// LOGGING FUNCTIONS
// ============================================
export async function logRequest(endpoint, ip, userAgent, responseTime) {
  sendWebhook('📡 API Request', `**${endpoint}**`, 0x3B82F6, [
    { name: 'IP', value: ip || 'Unknown', inline: true },
    { name: 'Response', value: `${responseTime}`, inline: true },
    { name: 'UA', value: `\`${(userAgent || 'Unknown').slice(0, 100)}\``, inline: false }
  ]);
}

export async function logSpam(endpoint, ip, count) {
  sendWebhook('🔒 Rate Limit Hit', `**${endpoint}** — rate limit reached`, 0xFACC15, [
    { name: 'IP', value: ip || 'Unknown', inline: true },
    { name: 'Requests', value: `${count} in window`, inline: true },
    { name: 'Action', value: '⏳ Temporarily blocked', inline: false }
  ]);
}

export async function logAbuse(endpoint, ip, reason) {
  sendWebhook('🚨 Abuse Detected', `**${endpoint}** — suspicious activity`, 0xF87171, [
    { name: 'IP', value: ip || 'Unknown', inline: true },
    { name: 'Reason', value: reason, inline: true },
    { name: 'Action', value: '🛡️ Blocked temporarily', inline: false }
  ]);
}

export async function logError(endpoint, error, ip) {
  sendWebhook('⚠️ Endpoint Error', `**${endpoint}** encountered an error`, 0xEF4444, [
    { name: 'Error', value: `\`${String(error).slice(0, 200)}\``, inline: false },
    { name: 'IP', value: ip || 'Unknown', inline: true },
    { name: 'Time', value: new Date().toISOString(), inline: true }
  ]);
}

export async function logUpstreamDown(provider, endpoint) {
  sendWebhook('🔴 Upstream API Down', `**${provider}** is not responding`, 0xFF0000, [
    { name: 'Endpoint', value: `\`${endpoint}\``, inline: false },
    { name: 'Status', value: '❌ Unreachable', inline: true }
  ]);
}

// ============================================
// RATE LIMIT STORE (In-Memory)
// ============================================
const rateStore = new Map();

export function checkRateLimit(ip, endpoint, maxRequests = 30, windowMs = 60_000) {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();

  const existing = rateStore.get(key);

  if (!existing || now > existing.resetAt) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  existing.count++;

  if (existing.count > maxRequests) {
    logSpam(endpoint, ip, existing.count);
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }

  return { allowed: true };
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateStore) {
    if (now > data.resetAt) rateStore.delete(key);
  }
}, 300_000);

// ============================================
// CORE: safeFetch with timeout + smart error handling
// ============================================
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

    if (response.status === 429) throw new Error('Rate limited by upstream API — retry in 60s');
    if (response.status === 403) throw new Error('Access denied by upstream API (403)');
    if (response.status === 404) throw new Error('Resource not found on upstream API (404)');
    if (response.status === 503) {
      logUpstreamDown(String(url).split('/').slice(0, 5).join('/'), url);
      throw new Error('Upstream API is temporarily unavailable (503)');
    }
    if (!response.ok) throw new Error(`Upstream API error: HTTP ${response.status}`);

    // Handle non-JSON gracefully
    if (contentType.includes('text/html')) {
      const text = await response.text();
      if (text.includes('Cloudflare') || text.includes('cf-error') || text.includes('Access denied')) {
        throw new Error('Request blocked by upstream WAF/Cloudflare');
      }
      throw new Error(`Upstream returned HTML instead of JSON (HTTP ${response.status})`);
    }

    if (contentType.includes('text/plain')) {
      return await response.text();
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') throw new Error(`Upstream API timeout after ${timeoutMs / 1000}s`);
    throw error;
  }
}

// ============================================
// CORE: AI text fetch via Pollinations (reusable)
// ============================================
export async function fetchAI(prompt, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Kyoto-API/3.0' }
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Pollinations error: HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('AI service timeout — try again');
    throw err;
  }
}

// ============================================
// CORE: CORS + Response Helpers
// ============================================
export function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
}

export function errRes(res, message, status = 200) {
  return res.status(status).json({
    status: false,
    author: 'Kyoto API',
    error: message,
    hint: 'Check documentation at /category',
    timestamp: new Date().toISOString()
  });
}

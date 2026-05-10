// ============================================
// WEBHOOK CONFIG — GANTI URL INI
// ============================================
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1500483284113555527/aQhFU951vjNTsThy_9Lj0gGSfHJkBkXxedoJAeW1CblxnTLfWg9xUuFAz3pNBNAx3YiW';

// ============================================
// INTERNAL: Kirim log ke Discord (async, non-blocking)
// ============================================
async function sendWebhook(title, description, color, fields = []) {
  if (!WEBHOOK_URL || WEBHOOK_URL.includes('https://discord.com/api/webhooks/1500483284113555527/aQhFU951vjNTsThy_9Lj0gGSfHJkBkXxedoJAeW1CblxnTLfWg9xUuFAz3pNBNAx3YiW')) return; // Skip kalau belum diset
  
  try {
    const embed = {
      title,
      description,
      color,
      fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Kyoto API • Security',
        icon_url: 'https://kyoto-rest-api.vercel.app/favicon.ico'
      }
    };
    
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed],
        username: 'Kyoto API Monitor',
        avatar_url: 'https://kyoto-rest-api.vercel.app/favicon.ico'
      })
    });
  } catch (e) {
    // Silent fail — jangan ganggu user
    console.error('[Webhook] Failed:', e.message);
  }
}

// ============================================
// LOGGING FUNCTIONS
// ============================================
export async function logRequest(endpoint, ip, userAgent, responseTime) {
  await sendWebhook(
    '📡 API Request',
    `**${endpoint}**`,
    0x3B82F6, // Blue
    [
      { name: 'IP', value: ip || 'Unknown', inline: true },
      { name: 'Response', value: `${responseTime}`, inline: true },
      { name: 'UA', value: `\`${(userAgent || 'Unknown').slice(0, 100)}\``, inline: false }
    ]
  );
}

export async function logSpam(endpoint, ip, count) {
  await sendWebhook(
    '🔒 Rate Limit Hit',
    `**${endpoint}** — User reached rate limit`,
    0xFACC15, // Yellow
    [
      { name: 'IP', value: ip || 'Unknown', inline: true },
      { name: 'Requests', value: `${count} in window`, inline: true },
      { name: 'Action', value: '⏳ Temporarily blocked', inline: false }
    ]
  );
}

export async function logAbuse(endpoint, ip, reason) {
  await sendWebhook(
    '🚨 Abuse Detected',
    `**${endpoint}** — Suspicious activity`,
    0xF87171, // Red
    [
      { name: 'IP', value: ip || 'Unknown', inline: true },
      { name: 'Reason', value: reason, inline: true },
      { name: 'Action', value: '🛡️ Blocked temporarily', inline: false }
    ]
  );
}

export async function logError(endpoint, error, ip) {
  await sendWebhook(
    '⚠️ Endpoint Error',
    `**${endpoint}** encountered an error`,
    0xEF4444, // Red
    [
      { name: 'Error', value: `\`${error.slice(0, 200)}\``, inline: false },
      { name: 'IP', value: ip || 'Unknown', inline: true },
      { name: 'Time', value: new Date().toISOString(), inline: true }
    ]
  );
}

export async function logUpstreamDown(provider, endpoint) {
  await sendWebhook(
    '🔴 Upstream API Down',
    `**${provider}** is not responding`,
    0xFF0000, // Red
    [
      { name: 'Endpoint', value: `\`${endpoint}\``, inline: false },
      { name: 'Status', value: '❌ Unreachable', inline: true }
    ]
  );
}

// ============================================
// RATE LIMIT STORE (In-Memory, reset tiap cold start)
// ============================================
const rateStore = new Map();

export function checkRateLimit(ip, endpoint) {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const windowMs = 60_000; // 1 menit
  const maxRequests = 30; // Maks 30 req/menit per endpoint
  
  if (!rateStore.has(key)) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  
  const data = rateStore.get(key);
  
  if (now > data.resetAt) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  
  data.count++;
  
  if (data.count > maxRequests) {
    // Trigger spam log (async)
    logSpam(endpoint, ip, data.count);
    return { allowed: false, retryAfter: Math.ceil((data.resetAt - now) / 1000) };
  }
  
  return { allowed: true };
}

// Cleanup rate store tiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateStore) {
    if (now > data.resetAt) rateStore.delete(key);
  }
}, 300_000);

// ============================================
// CORE: safeFetch dengan timeout + retry
// ============================================
export async function safeFetch(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Kyoto-API/3.0 (Security)',
        'Accept': 'application/json, text/plain, */*',
        ...options.headers
      }
    });
    
    clearTimeout(timeout);
    const contentType = response.headers.get('content-type') || '';
    
    // Deteksi block/halaman error
    if (contentType.includes('text/html')) {
      const text = await response.text();
      if (text.includes('Cloudflare') || text.includes('Access denied') || text.includes('cf-error')) {
        logUpstreamDown('Cloudflare/WAF', url);
        throw new Error('Blocked by Cloudflare or WAF on upstream API');
      }
      if (text.includes('Rate limit') || text.includes('Too Many Requests')) {
        throw new Error('Rate limited by upstream API — retry in 60s');
      }
      throw new Error(`Upstream returned HTML instead of JSON (HTTP ${response.status})`);
    }
    
    if (response.status === 429) throw new Error('Rate limited — too many requests');
    if (response.status === 403) throw new Error('Access denied by upstream API');
    if (response.status === 404) throw new Error('Resource not found on upstream API');
    if (response.status === 503) {
      logUpstreamDown(url.split('/').slice(0, 5).join('/'), url);
      throw new Error('Upstream API is down (503)');
    }
    if (!response.ok) throw new Error(`Upstream API error: HTTP ${response.status}`);
    
    const data = await response.json();
    if (data?.status === false && data?.error) throw new Error(`Upstream: ${data.error}`);
    if (data?.message?.toLowerCase().includes('rate limit')) throw new Error('Rate limited by upstream');
    
    return data;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') throw new Error(`Upstream API timeout after ${timeoutMs / 1000}s`);
    throw error;
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
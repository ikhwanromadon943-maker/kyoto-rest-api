import { safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest } from './_helper.js';
import crypto from 'crypto';

const CITY_COORDS = {
  jakarta: { lat: -6.2, lon: 106.8 }, surabaya: { lat: -7.25, lon: 112.75 },
  bandung: { lat: -6.9, lon: 107.6 }, medan: { lat: 3.6, lon: 98.67 },
  semarang: { lat: -7.0, lon: 110.4 }, yogyakarta: { lat: -7.8, lon: 110.37 },
  bali: { lat: -8.34, lon: 115.09 }, makassar: { lat: -5.13, lon: 119.42 },
  tokyo: { lat: 35.68, lon: 139.65 }, osaka: { lat: 34.7, lon: 135.5 },
  kyoto: { lat: 35.01, lon: 135.77 }, london: { lat: 51.5, lon: -0.13 },
  newyork: { lat: 40.7, lon: -74 }, paris: { lat: 48.85, lon: 2.35 },
  seoul: { lat: 37.57, lon: 126.98 }, sydney: { lat: -33.87, lon: 151.2 },
  singapore: { lat: 1.35, lon: 103.8 }, bangkok: { lat: 13.75, lon: 100.5 },
  dubai: { lat: 25.2, lon: 55.27 }, berlin: { lat: 52.5, lon: 13.4 },
  moscow: { lat: 55.75, lon: 37.62 }, mumbai: { lat: 19.07, lon: 72.88 },
  beijing: { lat: 39.91, lon: 116.39 }, shanghai: { lat: 31.23, lon: 121.47 },
  toronto: { lat: 43.65, lon: -79.38 }, amsterdam: { lat: 52.37, lon: 4.9 },
  madrid: { lat: 40.42, lon: -3.7 }, rome: { lat: 41.9, lon: 12.49 },
  istanbul: { lat: 41.01, lon: 28.95 }
};

const WMO_CODES = {
  0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy Fog', 51: 'Light Drizzle', 53: 'Moderate Drizzle',
  55: 'Dense Drizzle', 61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
  71: 'Slight Snow', 73: 'Moderate Snow', 75: 'Heavy Snow', 80: 'Rain Showers',
  81: 'Moderate Showers', 82: 'Violent Showers', 95: 'Thunderstorm',
  96: 'Thunderstorm with Hail', 99: 'Thunderstorm with Heavy Hail'
};

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/tools\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  // NGL has its own rate handling
  if (ep !== 'ngl') {
    const rateCheck = checkRateLimit(ip, ep);
    if (!rateCheck.allowed) {
      return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
    }
  }

  try {
    // ─── QR CODE ──────────────────────────────────────────────────────────────
    if (ep === 'qr') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const size = url.searchParams.get('size') || '300x300';
      const color = (url.searchParams.get('color') || '000000').replace('#', '');
      const bg = (url.searchParams.get('bg') || 'ffffff').replace('#', '');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'goQR.me',
        text, size,
        qr: `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(text)}&color=${color}&bgcolor=${bg}&qzone=1`,
        download: `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(text)}&format=png`,
        response_time: rt()
      });
    }

    // ─── SHORTLINK ────────────────────────────────────────────────────────────
    if (ep === 'shortlink') {
      const link = url.searchParams.get('url');
      if (!link) return errRes(res, 'Parameter "url" is required');
      if (!link.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');
      try {
        const d = await safeFetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(link)}`, {}, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'is.gd', original: link, short: d.shorturl, response_time: rt() });
      } catch {
        // Fallback: tinyurl
        const d = await safeFetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(link)}`, {}, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', provider: 'TinyURL (fallback)', original: link, short: typeof d === 'string' ? d.trim() : null, response_time: rt() });
      }
    }

    // ─── WEATHER ──────────────────────────────────────────────────────────────
    if (ep === 'cuaca' || ep === 'weather') {
      const cityInput = (url.searchParams.get('city') || 'jakarta').toLowerCase().replace(/\s+/g, '');
      const coords = CITY_COORDS[cityInput];
      if (!coords) {
        return errRes(res, `City not found. Supported cities: ${Object.keys(CITY_COORDS).join(', ')}`);
      }
      const d = await safeFetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&hourly=relativehumidity_2m,apparent_temperature&timezone=auto&forecast_days=1`,
        {}, 8000
      );
      const w = d.current_weather || {};
      const currentHour = new Date(w.time).getHours();
      const humidity = d.hourly?.relativehumidity_2m?.[currentHour] ?? null;
      const feelsLike = d.hourly?.apparent_temperature?.[currentHour] ?? null;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Open-Meteo',
        city: url.searchParams.get('city') || 'Jakarta',
        temperature: `${w.temperature}°C`,
        feels_like: feelsLike !== null ? `${feelsLike}°C` : null,
        humidity: humidity !== null ? `${humidity}%` : null,
        windspeed: `${w.windspeed} km/h`,
        wind_direction: `${w.winddirection}°`,
        condition: WMO_CODES[w.weathercode] || 'Unknown',
        is_day: w.is_day === 1,
        local_time: w.time,
        response_time: rt()
      });
    }

    // ─── CALCULATOR ───────────────────────────────────────────────────────────
    if (ep === 'calculator') {
      const expr = url.searchParams.get('expr');
      if (!expr) return errRes(res, 'Parameter "expr" is required');
      // Safe math eval — only allow numbers and math operators
      const sanitized = expr.replace(/[^0-9+\-*/().%\s^]/g, '').replace(/\^/g, '**');
      if (!sanitized.trim()) return errRes(res, 'Invalid expression — only numbers and +-*/()%.^ allowed');
      try {
        // eslint-disable-next-line no-new-func
        const result = Function(`'use strict'; return (${sanitized})`)();
        if (typeof result !== 'number' || !isFinite(result)) return errRes(res, 'Expression produced an invalid result');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', expression: expr, sanitized, result, response_time: rt() });
      } catch {
        return errRes(res, 'Invalid mathematical expression');
      }
    }

    // ─── BASE64 ───────────────────────────────────────────────────────────────
    if (ep === 'base64') {
      const text = url.searchParams.get('text');
      const action = url.searchParams.get('action') || 'encode';
      if (!text) return errRes(res, 'Parameter "text" is required');
      if (!['encode', 'decode'].includes(action)) return errRes(res, 'Parameter "action" must be "encode" or "decode"');
      try {
        const result = action === 'encode'
          ? Buffer.from(text, 'utf8').toString('base64')
          : Buffer.from(text, 'base64').toString('utf8');
        logRequest(url.pathname, ip, ua, rt());
        return res.json({ status: true, author: 'Kyoto API', action, input: text.slice(0, 200), result, response_time: rt() });
      } catch {
        return errRes(res, 'Invalid input for base64 decode');
      }
    }

    // ─── HASH ─────────────────────────────────────────────────────────────────
    if (ep === 'hash') {
      const text = url.searchParams.get('text');
      const algorithm = url.searchParams.get('algo') || 'sha256'; // sha256 | sha512 | sha1 | md5
      if (!text) return errRes(res, 'Parameter "text" is required');
      const validAlgos = ['sha256', 'sha512', 'sha1', 'md5'];
      if (!validAlgos.includes(algorithm)) return errRes(res, `Invalid algo. Use: ${validAlgos.join(', ')}`);

      // Use Node crypto for all algos
      const hash = crypto.createHash(algorithm).update(text, 'utf8').digest('hex');
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', algorithm, text: text.slice(0, 100), hash, response_time: rt() });
    }

    // ─── PASSWORD GENERATOR ───────────────────────────────────────────────────
    if (ep === 'password') {
      const len = Math.min(parseInt(url.searchParams.get('length')) || 16, 128);
      const useSymbols = url.searchParams.get('symbols') !== 'false';
      const useNumbers = url.searchParams.get('numbers') !== 'false';
      const useUpper = url.searchParams.get('uppercase') !== 'false';

      let chars = 'abcdefghijklmnopqrstuvwxyz';
      if (useUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (useNumbers) chars += '0123456789';
      if (useSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

      const pw = Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const strength = len < 8 ? 'weak' : len < 12 ? 'fair' : len < 16 ? 'strong' : 'very strong';
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', password: pw, length: len, strength, symbols: useSymbols, numbers: useNumbers, uppercase: useUpper, response_time: rt() });
    }

    // ─── BARCODE ──────────────────────────────────────────────────────────────
    if (ep === 'barcode') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const type = url.searchParams.get('type') || 'code128'; // code128 | ean13 | qr | upc
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'bwip-js via barcode.io',
        text, type,
        barcode: `https://barcodeapi.org/api/${type}/${encodeURIComponent(text)}`,
        response_time: rt()
      });
    }

    // ─── SCREENSHOT ───────────────────────────────────────────────────────────
    if (ep === 'screenshot' || ep === 'ssweb') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return errRes(res, 'Parameter "url" is required');
      if (!targetUrl.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');
      // Use screenshotapi.net free endpoint (no key for basic use)
      const screenshotUrl = `https://shot.screenshotapi.net/screenshot?url=${encodeURIComponent(targetUrl)}&output=image&file_type=png&wait_for_event=load`;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'ScreenshotAPI',
        url: targetUrl,
        screenshot: screenshotUrl,
        note: 'Screenshot URL — load directly in browser or <img> tag',
        response_time: rt()
      });
    }

    // ─── META EXTRACTOR ───────────────────────────────────────────────────────
    if (ep === 'meta') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return errRes(res, 'Parameter "url" is required');
      if (!targetUrl.startsWith('http')) return errRes(res, 'URL must start with http:// or https://');
      const d = await safeFetch(`https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Microlink.io',
        url: targetUrl, title: d.data?.title,
        description: d.data?.description,
        image: d.data?.image?.url,
        logo: d.data?.logo?.url,
        publisher: d.data?.publisher,
        lang: d.data?.lang,
        response_time: rt()
      });
    }

    // ─── ZODIAC ───────────────────────────────────────────────────────────────
    if (ep === 'zodiak' || ep === 'zodiac') {
      const sign = url.searchParams.get('sign');
      if (!sign) return errRes(res, 'Parameter "sign" is required');
      const validSigns = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
      if (!validSigns.includes(sign.toLowerCase())) return errRes(res, `Invalid sign. Use: ${validSigns.join(', ')}`);

      // aztro.sameerkumar.website is dead — use a static curated response with AI-feel
      const traits = {
        aries: { element: 'Fire', ruling_planet: 'Mars', traits: ['bold', 'ambitious', 'impulsive'] },
        taurus: { element: 'Earth', ruling_planet: 'Venus', traits: ['reliable', 'patient', 'stubborn'] },
        gemini: { element: 'Air', ruling_planet: 'Mercury', traits: ['adaptable', 'curious', 'inconsistent'] },
        cancer: { element: 'Water', ruling_planet: 'Moon', traits: ['intuitive', 'emotional', 'protective'] },
        leo: { element: 'Fire', ruling_planet: 'Sun', traits: ['confident', 'charismatic', 'arrogant'] },
        virgo: { element: 'Earth', ruling_planet: 'Mercury', traits: ['analytical', 'practical', 'perfectionist'] },
        libra: { element: 'Air', ruling_planet: 'Venus', traits: ['diplomatic', 'fair', 'indecisive'] },
        scorpio: { element: 'Water', ruling_planet: 'Pluto', traits: ['intense', 'resourceful', 'secretive'] },
        sagittarius: { element: 'Fire', ruling_planet: 'Jupiter', traits: ['adventurous', 'optimistic', 'tactless'] },
        capricorn: { element: 'Earth', ruling_planet: 'Saturn', traits: ['disciplined', 'ambitious', 'cold'] },
        aquarius: { element: 'Air', ruling_planet: 'Uranus', traits: ['innovative', 'independent', 'detached'] },
        pisces: { element: 'Water', ruling_planet: 'Neptune', traits: ['empathetic', 'artistic', 'escapist'] },
      };
      const moods = ['Energetic', 'Calm', 'Creative', 'Focused', 'Romantic', 'Adventurous', 'Reflective', 'Social'];
      const colors = ['Ruby Red', 'Sapphire Blue', 'Emerald Green', 'Golden Yellow', 'Violet', 'Coral', 'Turquoise', 'Ivory'];
      const info = traits[sign.toLowerCase()];
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Kyoto Astrology',
        sign, ...info,
        lucky_number: Math.floor(Math.random() * 100) + 1,
        lucky_color: colors[Math.floor(Math.random() * colors.length)],
        mood: moods[Math.floor(Math.random() * moods.length)],
        compatibility: validSigns[Math.floor(Math.random() * validSigns.length)],
        date: new Date().toISOString().split('T')[0],
        response_time: rt()
      });
    }

    // ─── NGL SPAMMER ─────────────────────────────────────────────────────────
    if (ep === 'ngl') {
      const username = url.searchParams.get('username');
      const message = url.searchParams.get('message') || 'Hello from Kyoto API 👋';
      const count = Math.min(parseInt(url.searchParams.get('count')) || 1, 50);
      if (!username) return errRes(res, 'Parameter "username" is required');

      let sent = 0, failed = 0;
      const logs = [];

      for (let i = 0; i < count; i++) {
        try {
          const deviceId = crypto.randomBytes(21).toString('hex');
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const response = await fetch('https://ngl.link/api/submit', {
            method: 'POST', signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
              'Accept': '*/*', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest', 'Referer': `https://ngl.link/${username}`, 'Origin': 'https://ngl.link'
            },
            body: `username=${encodeURIComponent(username)}&question=${encodeURIComponent(message)}&deviceId=${deviceId}&gameSlug=&referrer=`
          });
          clearTimeout(timeout);
          if (response.status === 200) { sent++; logs.push({ index: i + 1, status: 'sent' }); }
          else { failed++; logs.push({ index: i + 1, status: 'ratelimited', code: response.status }); if ([429, 403].includes(response.status)) await new Promise(r => setTimeout(r, 2000)); }
        } catch (err) {
          failed++; logs.push({ index: i + 1, status: 'error', error: err.message });
          await new Promise(r => setTimeout(r, 1000));
        }
        if (i < count - 1) await new Promise(r => setTimeout(r, 800));
      }

      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'NGL.link',
        target: username, message, total_requested: count, sent, failed,
        rate_limited: failed > sent, logs: logs.slice(0, 20),
        note: failed > sent ? 'Rate limit detected. Try again in 60 seconds.' : null,
        response_time: rt()
      });
    }

    // ─── UNIT CONVERTER ───────────────────────────────────────────────────────
    if (ep === 'convert') {
      const value = parseFloat(url.searchParams.get('value'));
      const from = url.searchParams.get('from')?.toLowerCase();
      const to = url.searchParams.get('to')?.toLowerCase();
      if (isNaN(value) || !from || !to) return errRes(res, 'Parameters "value", "from", and "to" are required');

      const conversions = {
        // Length
        m_km: v => v / 1000, km_m: v => v * 1000,
        m_cm: v => v * 100, cm_m: v => v / 100,
        m_mi: v => v * 0.000621371, mi_m: v => v / 0.000621371,
        m_ft: v => v * 3.28084, ft_m: v => v / 3.28084,
        m_in: v => v * 39.3701, in_m: v => v / 39.3701,
        km_mi: v => v * 0.621371, mi_km: v => v / 0.621371,
        // Weight
        kg_lb: v => v * 2.20462, lb_kg: v => v / 2.20462,
        kg_g: v => v * 1000, g_kg: v => v / 1000,
        kg_oz: v => v * 35.274, oz_kg: v => v / 35.274,
        // Temperature
        c_f: v => (v * 9 / 5) + 32, f_c: v => (v - 32) * 5 / 9,
        c_k: v => v + 273.15, k_c: v => v - 273.15,
        // Speed
        kmh_mph: v => v * 0.621371, mph_kmh: v => v / 0.621371,
        ms_kmh: v => v * 3.6, kmh_ms: v => v / 3.6,
        // Data
        mb_gb: v => v / 1024, gb_mb: v => v * 1024,
        gb_tb: v => v / 1024, tb_gb: v => v * 1024,
        kb_mb: v => v / 1024, mb_kb: v => v * 1024,
        // Time
        s_min: v => v / 60, min_s: v => v * 60,
        min_h: v => v / 60, h_min: v => v * 60,
        h_d: v => v / 24, d_h: v => v * 24,
      };

      const key = `${from}_${to}`;
      if (!conversions[key]) {
        return errRes(res, `Conversion "${from}" → "${to}" not supported. Try: m/km/cm/mi/ft/in, kg/lb/g/oz, c/f/k, kmh/mph/ms, mb/gb/tb/kb, s/min/h/d`);
      }

      const result = conversions[key](value);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', value, from, to, result: parseFloat(result.toFixed(6)), response_time: rt() });
    }

    // ─── LOREM IPSUM ──────────────────────────────────────────────────────────
    if (ep === 'lorem') {
      const paragraphs = Math.min(parseInt(url.searchParams.get('paragraphs')) || 1, 10);
      const d = await safeFetch(`https://loripsum.net/api/${paragraphs}/short/plaintext`, {}, 6000);
      logRequest(url.pathname, ip, ua, rt());
      const text = typeof d === 'string' ? d.trim() : JSON.stringify(d);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Loripsum.net', paragraphs, text, response_time: rt() });
    }

    return errRes(res, `Endpoint /api/tools/${ep} not found. Check /category for available endpoints.`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked', timestamp: new Date().toISOString() });
  }
}

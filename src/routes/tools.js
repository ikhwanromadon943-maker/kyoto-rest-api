// Kyoto API — Tools Endpoints
// SSWeb      : api.microlink.io (free 50 req/day)
// QR Code    : api.qrserver.com (free, no auth)
// Shortlink  : is.gd (free, no auth)
// Weather    : api.open-meteo.com (free, no key)
// Calculator : eval lokal (sandboxed)

const CITY_COORDS = {
  jakarta: { lat: -6.2088, lon: 106.8456 },
  surabaya: { lat: -7.2575, lon: 112.7521 },
  bandung: { lat: -6.9175, lon: 107.6191 },
  medan: { lat: 3.5952, lon: 98.6722 },
  tokyo: { lat: 35.6762, lon: 139.6503 },
  london: { lat: 51.5074, lon: -0.1278 },
  newyork: { lat: 40.7128, lon: -74.006 },
  paris: { lat: 48.8566, lon: 2.3522 },
  seoul: { lat: 37.5665, lon: 126.978 },
  sydney: { lat: -33.8688, lon: 151.2093 },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/tools/', '');

  try {
    // ---------- SSWEB ----------
    if (endpoint === 'ssweb') {
      const target = url.searchParams.get('url');
      if (!target) return res.status(400).json({ error: 'Parameter "url" diperlukan' });
      const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(target)}&screenshot=true&meta=false&embed=screenshot.url`;
      const ext = await fetch(screenshotUrl);
      const data = await ext.json();
      return res.json({
        status: 200,
        url: target,
        screenshot: data?.data?.screenshot?.url || `https://image.pollinations.ai/prompt/screenshot%20of%20${encodeURIComponent(target)}?width=1280&height=720&nologo=true`,
        full: url.searchParams.get('full') === 'true',
        provider: 'Microlink (50 req/hari gratis)',
      });
    }

    // ---------- QR ----------
    if (endpoint === 'qr') {
      const text = url.searchParams.get('text');
      if (!text) return res.status(400).json({ error: 'Parameter "text" diperlukan' });
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
      return res.json({ status: 200, text, qr: qrUrl, provider: 'goQR.me (gratis, tanpa auth)' });
    }

    // ---------- SHORTLINK ----------
    if (endpoint === 'shortlink') {
      const longUrl = url.searchParams.get('url');
      if (!longUrl) return res.status(400).json({ error: 'Parameter "url" diperlukan' });
      const ext = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`);
      const data = await ext.json();
      return res.json({
        status: 200,
        original: longUrl,
        short: data.shorturl || `https://is.gd/${Math.random().toString(36).slice(2, 8)}`,
        provider: 'is.gd (gratis, tanpa auth)',
      });
    }

    // ---------- WEATHER ----------
    if (endpoint === 'cuaca') {
      const cityRaw = (url.searchParams.get('city') || 'jakarta').toLowerCase().replace(/\s/g, '');
      const coords = CITY_COORDS[cityRaw] || CITY_COORDS['jakarta'];
      const ext = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&timezone=auto`
      );
      const data = await ext.json();
      const cw = data.current_weather || {};
      const weatherCodes = { 0: 'Cerah', 1: 'Cerah', 2: 'Berawan', 3: 'Mendung', 45: 'Berkabut', 48: 'Berkabut', 51: 'Gerimis', 61: 'Hujan', 80: 'Hujan Deras', 95: 'Badai' };
      return res.json({
        status: 200,
        city: url.searchParams.get('city') || 'Jakarta',
        temperature: `${cw.temperature || 0}°C`,
        windspeed: `${cw.windspeed || 0} km/h`,
        condition: weatherCodes[cw.weathercode] || 'Tidak diketahui',
        provider: 'Open-Meteo (gratis, tanpa API key)',
      });
    }

    // ---------- CALCULATOR ----------
    if (endpoint === 'calculator') {
      const expr = url.searchParams.get('expr');
      if (!expr) return res.status(400).json({ error: 'Parameter "expr" diperlukan' });
      try {
        const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '');
        const result = Function(`'use strict'; return (${sanitized})`)();
        return res.json({ status: 200, expression: expr, result });
      } catch {
        return res.status(400).json({ error: 'Ekspresi tidak valid', expression: expr });
      }
    }

    return res.status(404).json({ error: `Tools "${endpoint}" tidak tersedia` });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal menghubungi API eksternal', detail: err.message });
  }
}
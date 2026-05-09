// Kyoto API — Tools Endpoints
// SSWeb      : api.microlink.io (50 req/day free)
// QR Code    : api.qrserver.com
// Shortlink  : is.gd
// Weather    : api.open-meteo.com
// Calculator : eval lokal sandboxed

const CITY_COORDS = {
  jakarta: { lat: -6.2088, lon: 106.8456 },
  surabaya: { lat: -7.2575, lon: 112.7521 },
  bandung: { lat: -6.9175, lon: 107.6191 },
  medan: { lat: 3.5952, lon: 98.6722 },
  makassar: { lat: -5.1477, lon: 119.4327 },
  yogyakarta: { lat: -7.7956, lon: 110.3695 },
  tokyo: { lat: 35.6762, lon: 139.6503 },
  osaka: { lat: 34.6937, lon: 135.5023 },
  london: { lat: 51.5074, lon: -0.1278 },
  newyork: { lat: 40.7128, lon: -74.006 },
  paris: { lat: 48.8566, lon: 2.3522 },
  seoul: { lat: 37.5665, lon: 126.978 },
  sydney: { lat: -33.8688, lon: 151.2093 },
  singapore: { lat: 1.3521, lon: 103.8198 },
  bangkok: { lat: 13.7563, lon: 100.5018 },
  dubai: { lat: 25.2048, lon: 55.2708 },
  moscow: { lat: 55.7558, lon: 37.6173 },
  berlin: { lat: 52.52, lon: 13.405 },
};

export default async function handler(req, res) {
  const start = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ status: true, message: 'CORS preflight OK', response_time: `${Date.now() - start}ms` });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/tools/', '');

  try {
    // ---------- SSWEB ----------
    if (endpoint === 'ssweb') {
      const target = url.searchParams.get('url');
      if (!target) {
        return res.status(400).json({
          status: false, author: 'Kyoto API',
          error: 'Parameter "url" is required',
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }

      try {
        const ext = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(target)}&screenshot=true&meta=false&embed=screenshot.url`);
        const data = await ext.json();
        const screenshotUrl = data?.data?.screenshot?.url || null;

        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'Microlink.io (50 req/day free)',
          url: target,
          screenshot: screenshotUrl,
          full_page: url.searchParams.get('full') === 'true',
          timestamp: new Date().toISOString(),
          response_time: `${Date.now() - start}ms`
        });
      } catch (err) {
        return res.status(500).json({
          status: false, author: 'Kyoto API',
          error: `Screenshot failed: ${err.message}`,
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
    }

    // ---------- QR ----------
    if (endpoint === 'qr') {
      const text = url.searchParams.get('text');
      if (!text) {
        return res.status(400).json({
          status: false, author: 'Kyoto API',
          error: 'Parameter "text" is required',
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
      return res.json({
        status: true,
        author: 'Kyoto API',
        provider: 'goQR.me',
        text,
        qr: qrUrl,
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    }

    // ---------- SHORTLINK ----------
    if (endpoint === 'shortlink') {
      const longUrl = url.searchParams.get('url');
      if (!longUrl) {
        return res.status(400).json({
          status: false, author: 'Kyoto API',
          error: 'Parameter "url" is required',
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
      try {
        const ext = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`);
        const data = await ext.json();
        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'is.gd',
          original: longUrl,
          short: data.shorturl || null,
          error: data.errorcode ? data.errormessage : null,
          timestamp: new Date().toISOString(),
          response_time: `${Date.now() - start}ms`
        });
      } catch (err) {
        return res.status(500).json({
          status: false, author: 'Kyoto API',
          error: `Shortlink failed: ${err.message}`,
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
    }

    // ---------- WEATHER ----------
    if (endpoint === 'cuaca') {
      const cityRaw = (url.searchParams.get('city') || 'jakarta').toLowerCase().replace(/\s/g, '');
      const coords = CITY_COORDS[cityRaw] || CITY_COORDS['jakarta'];
      const weatherCodes = { 0: 'Clear', 1: 'Clear', 2: 'Partly Cloudy', 3: 'Cloudy', 45: 'Foggy', 48: 'Foggy', 51: 'Drizzle', 61: 'Rain', 80: 'Heavy Rain', 95: 'Thunderstorm' };

      try {
        const ext = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&timezone=auto`);
        const data = await ext.json();
        const cw = data.current_weather || {};

        return res.json({
          status: true,
          author: 'Kyoto API',
          provider: 'Open-Meteo',
          city: url.searchParams.get('city') || 'Jakarta',
          coordinates: { lat: coords.lat, lon: coords.lon },
          temperature: `${cw.temperature || 0}°C`,
          windspeed: `${cw.windspeed || 0} km/h`,
          winddirection: `${cw.winddirection || 0}°`,
          condition: weatherCodes[cw.weathercode] || 'Unknown',
          weathercode: cw.weathercode || 0,
          timezone: data.timezone || 'UTC',
          timestamp: new Date().toISOString(),
          response_time: `${Date.now() - start}ms`
        });
      } catch (err) {
        return res.status(500).json({
          status: false, author: 'Kyoto API',
          error: `Weather fetch failed: ${err.message}`,
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
    }

    // ---------- CALCULATOR ----------
    if (endpoint === 'calculator') {
      const expr = url.searchParams.get('expr');
      if (!expr) {
        return res.status(400).json({
          status: false, author: 'Kyoto API',
          error: 'Parameter "expr" is required',
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
      try {
        const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '');
        const result = Function(`'use strict'; return (${sanitized})`)();
        return res.json({
          status: true,
          author: 'Kyoto API',
          expression: expr,
          result,
          timestamp: new Date().toISOString(),
          response_time: `${Date.now() - start}ms`
        });
      } catch {
        return res.status(400).json({
          status: false, author: 'Kyoto API',
          error: `Invalid expression: "${expr}"`,
          timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
        });
      }
    }

    return res.status(404).json({
      status: false, author: 'Kyoto API',
      error: `Endpoint /api/tools/${endpoint} not found`,
      timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
    });
  } catch (err) {
    return res.status(500).json({
      status: false, author: 'Kyoto API',
      error: `Internal server error: ${err.message}`,
      timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
    });
  }
}
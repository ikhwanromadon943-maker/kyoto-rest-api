import { safeFetch, setCORS, errRes } from './_helper.js';

const CITY={jakarta:{lat:-6.2,lon:106.8},surabaya:{lat:-7.25,lon:112.75},bandung:{lat:-6.9,lon:107.6},medan:{lat:3.6,lon:98.67},tokyo:{lat:35.68,lon:139.65},osaka:{lat:34.7,lon:135.5},london:{lat:51.5,lon:-0.13},newyork:{lat:40.7,lon:-74},paris:{lat:48.85,lon:2.35},seoul:{lat:37.57,lon:126.98},sydney:{lat:-33.87,lon:151.2},singapore:{lat:1.35,lon:103.8},bangkok:{lat:13.75,lon:100.5},dubai:{lat:25.2,lon:55.27},berlin:{lat:52.5,lon:13.4},moscow:{lat:55.75,lon:37.62},mumbai:{lat:19.07,lon:72.88},beijing:{lat:39.91,lon:116.39},cairo:{lat:30.04,lon:31.24},toronto:{lat:43.65,lon:-79.38}};
const WC={0:'Clear',1:'Clear',2:'Partly Cloudy',3:'Cloudy',45:'Foggy',48:'Foggy',51:'Drizzle',61:'Rain',80:'Heavy Rain',95:'Thunderstorm'};

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/tools\/?/, '');
    const rt = () => `${Date.now() - start}ms`;

    if (ep === 'qr') {
      const t = url.searchParams.get('text');
      if (!t) return errRes(res, 'Parameter "text" is required');
      const size = url.searchParams.get('size') || '300x300';
      return res.json({ status: true, author: 'Kyoto API', provider: 'goQR.me', text: t, qr: `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(t)}`, response_time: rt() });
    }

    if (ep === 'shortlink') {
      const l = url.searchParams.get('url');
      if (!l) return errRes(res, 'Parameter "url" is required');
      const d = await safeFetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(l)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'is.gd', original: l, short: d.shorturl || null, response_time: rt() });
    }

    if (ep === 'cuaca') {
      const c = (url.searchParams.get('city') || 'jakarta').toLowerCase().replace(/\s/g,'');
      const co = CITY[c] || CITY['jakarta'];
      const d = await safeFetch(`https://api.open-meteo.com/v1/forecast?latitude=${co.lat}&longitude=${co.lon}&current_weather=true&timezone=auto`);
      const w = d.current_weather || {};
      return res.json({ status: true, author: 'Kyoto API', provider: 'Open-Meteo', city: url.searchParams.get('city') || 'Jakarta', temperature: `${w.temperature||0}°C`, windspeed: `${w.windspeed||0}km/h`, condition: WC[w.weathercode] || 'Unknown', response_time: rt() });
    }

    if (ep === 'calculator') {
      const ex = url.searchParams.get('expr');
      if (!ex) return errRes(res, 'Parameter "expr" is required');
      try {
        const s = ex.replace(/[^0-9+\-*/().%\s]/g, '');
        return res.json({ status: true, author: 'Kyoto API', expression: ex, result: Function(`'use strict';return(${s})`)(), response_time: rt() });
      } catch { return errRes(res, 'Invalid expression'); }
    }

    if (ep === 'ssweb') {
      const t = url.searchParams.get('url');
      if (!t) return errRes(res, 'Parameter "url" is required');
      const d = await safeFetch(`https://api.microlink.io/?url=${encodeURIComponent(t)}&screenshot=true`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Microlink.io', url: t, screenshot: d?.data?.screenshot?.url || null, response_time: rt() });
    }

    // NEW: Barcode generator
    if (ep === 'barcode') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const type = url.searchParams.get('type') || 'code128'; // code128, ean13, upca
      return res.json({ status: true, author: 'Kyoto API', provider: 'barcode.io', text, type, barcode: `https://barcode.io/barcode-api.php?code=${encodeURIComponent(text)}&type=${type}&width=300&height=80`, response_time: rt() });
    }

    // NEW: Lorem ipsum generator
    if (ep === 'lorem') {
      const paras = Math.min(parseInt(url.searchParams.get('paragraphs')) || 1, 10);
      const d = await safeFetch(`https://loripsum.net/api/${paras}/short/plaintext`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'loripsum.net', paragraphs: paras, text: typeof d === 'string' ? d : JSON.stringify(d), response_time: rt() });
    }

    // NEW: Hash generator
    if (ep === 'hash') {
      const text = url.searchParams.get('text');
      if (!text) return errRes(res, 'Parameter "text" is required');
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return res.json({ status: true, author: 'Kyoto API', text, sha256, response_time: rt() });
    }

    // NEW: Base64 encode/decode
    if (ep === 'base64') {
      const text = url.searchParams.get('text');
      const action = url.searchParams.get('action') || 'encode'; // encode or decode
      if (!text) return errRes(res, 'Parameter "text" is required');
      try {
        const result = action === 'encode' ? Buffer.from(text).toString('base64') : Buffer.from(text, 'base64').toString('utf8');
        return res.json({ status: true, author: 'Kyoto API', action, input: text, result, response_time: rt() });
      } catch { return errRes(res, 'Invalid input for base64 decode'); }
    }

    // NEW: URL encode/decode
    if (ep === 'urlencode') {
      const text = url.searchParams.get('text');
      const action = url.searchParams.get('action') || 'encode';
      if (!text) return errRes(res, 'Parameter "text" is required');
      const result = action === 'encode' ? encodeURIComponent(text) : decodeURIComponent(text);
      return res.json({ status: true, author: 'Kyoto API', action, input: text, result, response_time: rt() });
    }

    // NEW: Random password
    if (ep === 'password') {
      const len = Math.min(parseInt(url.searchParams.get('length')) || 16, 128);
      const symbols = url.searchParams.get('symbols') !== 'false';
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' + (symbols ? '!@#$%^&*()_+-=[]{}|;:,.<>?' : '');
      const pw = Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      return res.json({ status: true, author: 'Kyoto API', password: pw, length: len, symbols, response_time: rt() });
    }

    // NEW: Website meta info
    if (ep === 'meta') {
      const t = url.searchParams.get('url');
      if (!t) return errRes(res, 'Parameter "url" is required');
      const d = await safeFetch(`https://api.microlink.io/?url=${encodeURIComponent(t)}`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Microlink.io', url: t, title:d.data?.title, description:d.data?.description, image:d.data?.image?.url, logo:d.data?.logo?.url, response_time: rt() });
    }

    // NEW: IP info (simple)
    if (ep === 'ip') {
      const ip = url.searchParams.get('ip') || '';
      const endpoint = ip ? `http://ip-api.com/json/${ip}` : 'http://ip-api.com/json/';
      const d = await safeFetch(endpoint);
      if (d.status === 'fail') throw new Error(d.message || 'IP lookup failed');
      return res.json({ status: true, author: 'Kyoto API', provider: 'ip-api.com', ip:d.query, country:d.country, region:d.regionName, city:d.city, isp:d.isp, lat:d.lat, lon:d.lon, timezone:d.timezone, response_time: rt() });
    }

    return errRes(res, `Endpoint /api/tools/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}

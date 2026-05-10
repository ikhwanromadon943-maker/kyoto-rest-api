import { safeFetch, setCORS, errRes } from './_helper.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/quran\/?/, '');

    if (ep === 'surah') {
      const n = url.searchParams.get('number') || '1';
      const d = await safeFetch(`https://api.alquran.cloud/v1/surah/${n}`);
      const s = d.data || {};
      return res.json({ status: true, author: 'Kyoto API', provider: 'Al-Quran.cloud', number:s.number, name:s.name, english_name:s.englishName, english_translation:s.englishNameTranslation, revelation:s.revelationType, ayahs:s.numberOfAyahs });
    }

    if (ep === 'search') {
      const q = url.searchParams.get('keyword');
      if (!q) return errRes(res, 'Parameter "keyword" is required');
      const d = await safeFetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(q)}/all/en`);
      return res.json({ status: true, author: 'Kyoto API', provider: 'Al-Quran.cloud', keyword: q, count: d.data?.count, matches: (d.data?.matches||[]).slice(0,10).map(m=>({surah:m.surah?.englishName,ayah:m.ayah?.numberInSurah,text:m.text})) });
    }

    // NEW: List all surahs
    if (ep === 'list') {
      const d = await safeFetch('https://api.alquran.cloud/v1/surah');
      return res.json({ status: true, author: 'Kyoto API', provider: 'Al-Quran.cloud', total: d.data?.length, surahs: (d.data||[]).map(s=>({number:s.number,name:s.name,english_name:s.englishName,ayahs:s.numberOfAyahs,revelation:s.revelationType})) });
    }

    // NEW: Random ayah
    if (ep === 'random-ayah') {
      const surah = Math.floor(Math.random() * 114) + 1;
      const d = await safeFetch(`https://api.alquran.cloud/v1/surah/${surah}/en.asad`);
      const ayahs = d.data?.ayahs || [];
      const ayah = ayahs[Math.floor(Math.random() * ayahs.length)];
      return res.json({ status: true, author: 'Kyoto API', provider: 'Al-Quran.cloud', surah: d.data?.englishName, surah_number: surah, ayah_number: ayah?.numberInSurah, text: ayah?.text, arabic: null, note: 'Use /surah endpoint for Arabic text' });
    }

    // NEW: Specific ayah
    if (ep === 'ayah') {
      const surah = url.searchParams.get('surah') || '1';
      const ayah = url.searchParams.get('ayah') || '1';
      const d = await safeFetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/en.asad`);
      const a = d.data || {};
      return res.json({ status: true, author: 'Kyoto API', provider: 'Al-Quran.cloud', surah: a.surah?.englishName, surah_number: a.surah?.number, ayah_number: a.numberInSurah, text: a.text });
    }

    // NEW: Surah with translation
    if (ep === 'surah-translation') {
      const n = url.searchParams.get('number') || '1';
      const lang = url.searchParams.get('lang') || 'en.asad';
      const d = await safeFetch(`https://api.alquran.cloud/v1/surah/${n}/${lang}`);
      const s = d.data || {};
      return res.json({ status: true, author: 'Kyoto API', provider: 'Al-Quran.cloud', surah: s.englishName, number: s.number, language: lang, ayahs: (s.ayahs||[]).map(a=>({number:a.numberInSurah,text:a.text})) });
    }

    return errRes(res, `Endpoint /api/quran/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}

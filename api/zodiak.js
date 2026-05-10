import { safeFetch, setCORS, errRes } from './_helper.js';

const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace(/^\/api\/zodiak\/?/, '');
    const sign = url.searchParams.get('sign') || 'aries';
    const day = url.searchParams.get('day') || 'today';

    if (!SIGNS.includes(sign)) return errRes(res, `Invalid sign. Allowed: ${SIGNS.join(', ')}`);

    if (ep === 'horoscope' || ep === 'today') {
      const d = await safeFetch(`https://aztro.sameerkumar.website/?sign=${sign}&day=${day}`, { method: 'POST' });
      return res.json({ status: true, author: 'Kyoto API', provider: 'Aztro API', sign, day, date: d.current_date, horoscope: d.description, mood: d.mood, lucky_number: d.lucky_number, lucky_color: d.color, compatibility: d.compatibility });
    }

    // NEW: All signs today
    if (ep === 'all') {
      const results = {};
      for (const s of SIGNS.slice(0, 4)) { // limit 4 to avoid timeout
        try {
          const d = await safeFetch(`https://aztro.sameerkumar.website/?sign=${s}&day=today`, { method: 'POST' });
          results[s] = { horoscope: d.description, mood: d.mood, lucky_number: d.lucky_number };
        } catch { results[s] = { error: 'Failed to load' }; }
      }
      return res.json({ status: true, author: 'Kyoto API', provider: 'Aztro API', note: 'Returns first 4 signs to avoid timeout', results });
    }

    // NEW: Zodiac dates info (static, no API needed)
    if (ep === 'info') {
      const info = {
        aries:       { dates:'Mar 21 - Apr 19', element:'Fire',  ruling_planet:'Mars',    traits:['Brave','Energetic','Impulsive','Confident'] },
        taurus:      { dates:'Apr 20 - May 20', element:'Earth', ruling_planet:'Venus',   traits:['Patient','Reliable','Stubborn','Devoted'] },
        gemini:      { dates:'May 21 - Jun 20', element:'Air',   ruling_planet:'Mercury', traits:['Adaptable','Curious','Inconsistent','Clever'] },
        cancer:      { dates:'Jun 21 - Jul 22', element:'Water', ruling_planet:'Moon',    traits:['Loyal','Intuitive','Moody','Caring'] },
        leo:         { dates:'Jul 23 - Aug 22', element:'Fire',  ruling_planet:'Sun',     traits:['Dramatic','Creative','Arrogant','Generous'] },
        virgo:       { dates:'Aug 23 - Sep 22', element:'Earth', ruling_planet:'Mercury', traits:['Analytical','Practical','Shy','Hardworking'] },
        libra:       { dates:'Sep 23 - Oct 22', element:'Air',   ruling_planet:'Venus',   traits:['Diplomatic','Fair','Indecisive','Social'] },
        scorpio:     { dates:'Oct 23 - Nov 21', element:'Water', ruling_planet:'Pluto',   traits:['Brave','Secretive','Jealous','Passionate'] },
        sagittarius: { dates:'Nov 22 - Dec 21', element:'Fire',  ruling_planet:'Jupiter', traits:['Adventurous','Honest','Restless','Optimistic'] },
        capricorn:   { dates:'Dec 22 - Jan 19', element:'Earth', ruling_planet:'Saturn',  traits:['Responsible','Disciplined','Pessimistic','Ambitious'] },
        aquarius:    { dates:'Jan 20 - Feb 18', element:'Air',   ruling_planet:'Uranus',  traits:['Independent','Humanitarian','Aloof','Inventive'] },
        pisces:      { dates:'Feb 19 - Mar 20', element:'Water', ruling_planet:'Neptune', traits:['Compassionate','Artistic','Escapist','Gentle'] },
      };
      if (!info[sign]) return errRes(res, `Invalid sign`);
      return res.json({ status: true, author: 'Kyoto API', sign, ...info[sign] });
    }

    // NEW: Compatibility check
    if (ep === 'compatibility') {
      const sign2 = url.searchParams.get('sign2');
      if (!sign2) return errRes(res, 'Parameter "sign2" is required');
      if (!SIGNS.includes(sign2)) return errRes(res, `Invalid sign2. Allowed: ${SIGNS.join(', ')}`);
      const elements = { aries:'Fire',taurus:'Earth',gemini:'Air',cancer:'Water',leo:'Fire',virgo:'Earth',libra:'Air',scorpio:'Water',sagittarius:'Fire',capricorn:'Earth',aquarius:'Air',pisces:'Water' };
      const e1 = elements[sign], e2 = elements[sign2];
      const compatible = { Fire:['Fire','Air'], Earth:['Earth','Water'], Air:['Air','Fire'], Water:['Water','Earth'] };
      const isCompatible = compatible[e1]?.includes(e2);
      const score = isCompatible ? Math.floor(Math.random() * 20) + 75 : Math.floor(Math.random() * 30) + 40;
      return res.json({ status: true, author: 'Kyoto API', sign1: sign, sign2, element1: e1, element2: e2, compatible: isCompatible, compatibility_score: `${score}%`, note: isCompatible ? 'Great match! Elements complement each other.' : 'Challenging match, but opposites can attract.' });
    }

    return errRes(res, `Endpoint /api/zodiak/${ep} not found`);
  } catch (err) {
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked' });
  }
}

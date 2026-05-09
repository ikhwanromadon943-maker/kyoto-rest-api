export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return res.status(200).json({status:true,message:'CORS preflight OK'});

  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/zodiak/','');
    const sign=url.searchParams.get('sign')||'aries';
    const day=url.searchParams.get('day')||'today';

    if(ep==='today'||ep==='horoscope'){
      const e=await fetch(`https://aztro.sameerkumar.website/?sign=${sign}&day=${day}`,{method:'POST'});
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Aztro API',sign,date:d.current_date,horoscope:d.description,mood:d.mood,lucky_number:d.lucky_number,lucky_color:d.color});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/zodiak/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
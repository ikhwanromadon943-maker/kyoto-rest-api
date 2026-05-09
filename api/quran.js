export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).json({status:true,message:'CORS preflight OK'});

  try{
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/quran/','');

    if(ep==='surah'){
      const n=url.searchParams.get('number')||'1';
      const e=await fetch(`https://api.alquran.cloud/v1/surah/${n}`);
      const d=await e.json();
      const s=d.data||{};
      return res.json({status:true,author:'Kyoto API',provider:'Al-Quran.cloud',number:s.number,name:s.name,english_name:s.englishName,revelation:s.revelationType,ayahs:s.numberOfAyahs});
    }

    if(ep==='search'){
      const q=url.searchParams.get('keyword');
      if(!q)return res.json({status:false,author:'Kyoto API',error:'Parameter "keyword" is required'});
      const e=await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(q)}/all/en`);
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Al-Quran.cloud',keyword:q,matches:(d.data?.matches||[]).slice(0,10).map(m=>({surah:m.surah?.englishName,ayah:m.ayah?.numberInSurah,text:m.text}))});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/quran/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return res.status(200).json({status:true,message:'CORS preflight OK'});

  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/games/','');

    if(ep==='list'){
      const e=await fetch('https://www.freetogame.com/api/games');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'FreeToGame',games:d.slice(0,20)});
    }

    if(ep==='detail'){
      const id=url.searchParams.get('id');
      if(!id) return res.json({status:false,author:'Kyoto API',error:'Parameter "id" is required'});
      const e=await fetch(`https://www.freetogame.com/api/game?id=${id}`);
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'FreeToGame',game:d});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/games/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
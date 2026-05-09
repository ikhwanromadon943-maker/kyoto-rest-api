export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ep = url.pathname.replace('/api/anime/', '');

    if (ep === 'search') {
      const q = url.searchParams.get('query');
      if (!q) return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "query" is required' });
      const e = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=10&order_by=popularity`);
      const d = await e.json();
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', results: (d.data||[]).map(i=>({id:i.mal_id,title:i.title,author:i.authors?.[0]?.name||'Unknown',chapters:i.chapters,score:i.score,image:i.images?.jpg?.image_url})) });
    }

    if (ep === 'anime') {
      const title = url.searchParams.get('title');
      if (!title) return res.json({ status: false, author: 'Kyoto API', error: 'Parameter "title" is required' });
      const e = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
      const d = await e.json();
      const a = d.data?.[0]||{};
      return res.json({ status: true, author: 'Kyoto API', provider: 'Jikan API v4', title:a.title,episodes:a.episodes,score:a.score,image:a.images?.jpg?.large_image_url,synopsis:a.synopsis?.slice(0,300) });
    }

    if (ep === 'random') {
      for(let i=0;i<3;i++){
        const id=Math.floor(Math.random()*50000)+1;
        const e=await fetch(`https://api.jikan.moe/v4/manga/${id}/full`);
        if(e.ok){const d=await e.json();const m=d.data||{};return res.json({status:true,author:'Kyoto API',provider:'Jikan API v4',manga:{id:m.mal_id,title:m.title,author:m.authors?.[0]?.name,chapters:m.chapters,score:m.score,image:m.images?.jpg?.image_url}})}
      }
      return res.json({status:false,author:'Kyoto API',error:'Failed after 3 attempts'});
    }

    if (ep === 'waifu') {
      const cat=url.searchParams.get('category')||'waifu';
      const e=await fetch(`https://api.waifu.pics/sfw/${cat}`);
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Waifu.pics',category:cat,url:d.url});
    }

    if (ep === 'character') {
      const q=url.searchParams.get('query');
      if(!q) return res.json({status:false,author:'Kyoto API',error:'Parameter "query" is required'});
      const e=await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(q)}&limit=5`);
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Jikan API v4',results:(d.data||[]).map(i=>({id:i.mal_id,name:i.name,image:i.images?.jpg?.image_url}))});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/anime/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
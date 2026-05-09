export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return res.status(200).json({status:true,message:'CORS preflight OK'});

  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/news/','');

    if(ep==='cnn'){
      const e=await fetch('https://berita-indo-api.vercel.app/api/cnn-news');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Berita Indo API',source:'CNN Indonesia',results:(d.data||[]).slice(0,10)});
    }

    if(ep==='cnbc'){
      const e=await fetch('https://berita-indo-api.vercel.app/api/cnbc-news');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Berita Indo API',source:'CNBC Indonesia',results:(d.data||[]).slice(0,10)});
    }

    if(ep==='detik'){
      const e=await fetch('https://berita-indo-api.vercel.app/api/detik-news');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Berita Indo API',source:'Detik.com',results:(d.data||[]).slice(0,10)});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/news/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
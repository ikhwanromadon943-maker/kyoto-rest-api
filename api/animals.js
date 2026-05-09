export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).json({status:true,message:'CORS preflight OK'});

  try{
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/animals/','');

    if(ep==='dog'){
      const e=await fetch('https://dog.ceo/api/breeds/image/random');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Dog CEO',image:d.message});
    }

    if(ep==='cat'){
      const e=await fetch('https://cataas.com/cat?json=true');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Cataas',image:`https://cataas.com/cat/${d._id}`,tags:d.tags});
    }

    if(ep==='cat-fact'){
      const e=await fetch('https://catfact.ninja/fact');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Cat Facts',fact:d.fact});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/animals/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
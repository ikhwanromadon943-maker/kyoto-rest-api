export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return res.status(200).json({status:true,message:'CORS preflight OK'});

  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/random/','');

    if(ep==='user'){
      const e=await fetch('https://randomuser.me/api/');
      const d=await e.json();
      const u=d.results[0];
      return res.json({status:true,author:'Kyoto API',provider:'RandomUser.me',name:`${u.name.first} ${u.name.last}`,email:u.email,country:u.location.country,picture:u.picture.large});
    }

    if(ep==='number'){
      const min=parseInt(url.searchParams.get('min'))||0;
      const max=parseInt(url.searchParams.get('max'))||100;
      return res.json({status:true,author:'Kyoto API',number:Math.floor(Math.random()*(max-min+1))+min,min,max});
    }

    if(ep==='uuid'){
      return res.json({status:true,author:'Kyoto API',uuid:crypto.randomUUID()});
    }

    if(ep==='color'){
      const hex='#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
      return res.json({status:true,author:'Kyoto API',hex,rgb:`${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`});
    }

    if(ep==='timestamp'){
      const now=new Date();
      return res.json({status:true,author:'Kyoto API',unix:Math.floor(now.getTime()/1000),iso:now.toISOString(),utc:now.toUTCString()});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/random/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
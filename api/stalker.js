export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return res.status(200).json({status:true,message:'CORS preflight OK'});

  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/stalker/','');

    if(ep==='ip'){
      const ip=url.searchParams.get('ip')||'';
      const e=await fetch(`http://ip-api.com/json/${ip}`);
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'ip-api.com',ip:d.query,country:d.country,city:d.city,isp:d.isp,lat:d.lat,lon:d.lon});
    }

    if(ep==='my-ip'){
      const e=await fetch('https://freeipapi.com/api/json');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'FreeIPAPI',ip:d.ipAddress,country:d.countryName,city:d.cityName,lat:d.latitude,lon:d.longitude});
    }

    if(ep==='dns'){
      const domain=url.searchParams.get('domain');
      if(!domain) return res.json({status:false,author:'Kyoto API',error:'Parameter "domain" is required'});
      const e=await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}`);
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Google DNS',domain,answers:d.Answer||[]});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/stalker/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
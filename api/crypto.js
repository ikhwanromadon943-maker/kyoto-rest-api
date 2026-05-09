export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).json({status:true,message:'CORS preflight OK'});

  try{
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/crypto/','');

    if(ep==='price'){
      const id=(url.searchParams.get('id')||'bitcoin').toLowerCase();
      const e=await fetch(`https://api.coincap.io/v2/assets/${id}`);
      const d=await e.json();
      const a=d.data||{};
      return res.json({status:true,author:'Kyoto API',provider:'CoinCap',name:a.name,symbol:a.symbol,price_usd:a.priceUsd,change_24h:a.changePercent24Hr,market_cap:a.marketCapUsd});
    }

    if(ep==='list'){
      const e=await fetch('https://api.coincap.io/v2/assets?limit=20');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'CoinCap',assets:(d.data||[]).map(a=>({name:a.name,symbol:a.symbol,price_usd:a.priceUsd,change_24h:a.changePercent24Hr}))});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/crypto/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
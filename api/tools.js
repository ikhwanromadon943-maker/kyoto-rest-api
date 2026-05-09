const CITY={jakarta:{lat:-6.2,lon:106.8},surabaya:{lat:-7.25,lon:112.75},bandung:{lat:-6.9,lon:107.6},medan:{lat:3.6,lon:98.67},tokyo:{lat:35.68,lon:139.65},osaka:{lat:34.7,lon:135.5},london:{lat:51.5,lon:-0.13},newyork:{lat:40.7,lon:-74},paris:{lat:48.85,lon:2.35},seoul:{lat:37.57,lon:126.98},sydney:{lat:-33.87,lon:151.2},singapore:{lat:1.35,lon:103.8},bangkok:{lat:13.75,lon:100.5},dubai:{lat:25.2,lon:55.27},berlin:{lat:52.5,lon:13.4}};
const WC={0:'Clear',1:'Clear',2:'Partly Cloudy',3:'Cloudy',45:'Foggy',48:'Foggy',51:'Drizzle',61:'Rain',80:'Heavy Rain',95:'Thunderstorm'};

export default async function handler(req, res) {
  const start=Date.now();
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).json({status:true,message:'CORS preflight OK'});

  try{
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/tools/','');

    if(ep==='qr'){const t=url.searchParams.get('text');if(!t)return res.json({status:false,author:'Kyoto API',error:'Parameter "text" is required'});return res.json({status:true,author:'Kyoto API',provider:'goQR.me',text:t,qr:`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(t)}`})}
    if(ep==='shortlink'){const l=url.searchParams.get('url');if(!l)return res.json({status:false,author:'Kyoto API',error:'Parameter "url" is required'});const e=await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(l)}`);const d=await e.json();return res.json({status:true,author:'Kyoto API',provider:'is.gd',original:l,short:d.shorturl||null})}
    if(ep==='cuaca'){const c=(url.searchParams.get('city')||'jakarta').toLowerCase().replace(/\s/g,'');const co=CITY[c]||CITY['jakarta'];const e=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${co.lat}&longitude=${co.lon}&current_weather=true&timezone=auto`);const d=await e.json();const w=d.current_weather||{};return res.json({status:true,author:'Kyoto API',provider:'Open-Meteo',city:url.searchParams.get('city')||'Jakarta',temperature:`${w.temperature||0}°C`,windspeed:`${w.windspeed||0}km/h`,condition:WC[w.weathercode]||'Unknown'})}
    if(ep==='calculator'){const ex=url.searchParams.get('expr');if(!ex)return res.json({status:false,author:'Kyoto API',error:'Parameter "expr" is required'});try{const s=ex.replace(/[^0-9+\-*/().%\s]/g,'');return res.json({status:true,author:'Kyoto API',expression:ex,result:Function(`'use strict';return(${s})`)()})}catch{return res.json({status:false,author:'Kyoto API',error:'Invalid expression'})}}
    if(ep==='ssweb'){const t=url.searchParams.get('url');if(!t)return res.json({status:false,author:'Kyoto API',error:'Parameter "url" is required'});const e=await fetch(`https://api.microlink.io/?url=${encodeURIComponent(t)}&screenshot=true`);const d=await e.json();return res.json({status:true,author:'Kyoto API',provider:'Microlink.io',url:t,screenshot:d?.data?.screenshot?.url||null})}

    return res.json({status:false,author:'Kyoto API',error:`/api/tools/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
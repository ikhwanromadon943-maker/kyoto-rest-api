export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).json({status:true,message:'CORS preflight OK'});

  try{
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/media/','');

    if(ep==='canvas'){const t=url.searchParams.get('text');if(!t)return res.json({status:false,author:'Kyoto API',error:'Parameter "text" is required'});return res.json({status:true,author:'Kyoto API',provider:'Pollinations.ai',image:`https://image.pollinations.ai/prompt/${encodeURIComponent(t)}?width=800&height=400&nologo=true`})}
    if(ep==='meme'){const top=url.searchParams.get('top')||'';const bottom=url.searchParams.get('bottom')||'';return res.json({status:true,author:'Kyoto API',provider:'Pollinations.ai',image:`https://image.pollinations.ai/prompt/meme%20${encodeURIComponent(top)}%20${encodeURIComponent(bottom)}?width=600&height=400&nologo=true`})}
    if(ep==='quote-image'){const q=url.searchParams.get('text')||'Stay hungry, stay foolish';const a=url.searchParams.get('author')||'Steve Jobs';return res.json({status:true,author:'Kyoto API',provider:'Pollinations.ai',image:`https://image.pollinations.ai/prompt/${encodeURIComponent(q)}%20-%20${encodeURIComponent(a)}?width=800&height=400&nologo=true`})}

    return res.json({status:false,author:'Kyoto API',error:`/api/media/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
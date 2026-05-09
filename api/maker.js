export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return res.status(200).json({status:true,message:'CORS preflight OK'});

  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/maker/','');

    if(ep==='canvas'){
      const text=url.searchParams.get('text');
      if(!text) return res.json({status:false,author:'Kyoto API',error:'Parameter "text" is required'});
      return res.json({status:true,author:'Kyoto API',provider:'Pollinations.ai',image:`https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=800&height=400&nologo=true`});
    }

    if(ep==='meme'){
      const top=url.searchParams.get('top')||'';
      const bottom=url.searchParams.get('bottom')||'';
      return res.json({status:true,author:'Kyoto API',provider:'Pollinations.ai',image:`https://image.pollinations.ai/prompt/meme%20${encodeURIComponent(top)}%20${encodeURIComponent(bottom)}?width=600&height=400&nologo=true`});
    }

    if(ep==='quote-image'){
      const quote=url.searchParams.get('text')||'The best way to predict the future is to create it';
      const author=url.searchParams.get('author')||'Abraham Lincoln';
      return res.json({status:true,author:'Kyoto API',provider:'Pollinations.ai',image:`https://image.pollinations.ai/prompt/${encodeURIComponent(quote)}%20-%20${encodeURIComponent(author)}?width=800&height=400&nologo=true`});
    }

    if(ep==='password'){
      const len=Math.min(parseInt(url.searchParams.get('length'))||16,64);
      const chars='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
      let pw='';
      for(let i=0;i<len;i++) pw+=chars[Math.floor(Math.random()*chars.length)];
      return res.json({status:true,author:'Kyoto API',password:pw,length:len});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/maker/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
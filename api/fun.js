export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return res.status(200).json({status:true,message:'CORS preflight OK'});

  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/fun/','');

    if(ep==='joke'){
      const e=await fetch('https://v2.jokeapi.dev/joke/Any?type=single');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'JokeAPI',joke:d.joke,category:d.category});
    }

    if(ep==='dadjoke'){
      const e=await fetch('https://icanhazdadjoke.com/',{headers:{Accept:'application/json'}});
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'icanhazdadjoke',joke:d.joke});
    }

    if(ep==='fact'){
      const e=await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Useless Facts',fact:d.text});
    }

    if(ep==='chuck-norris'){
      const e=await fetch('https://api.chucknorris.io/jokes/random');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Chuck Norris API',joke:d.value,url:d.url});
    }

    if(ep==='quote'){
      const e=await fetch('https://api.quotable.io/random');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Quotable',quote:d.content,author:d.author});
    }

    if(ep==='cat-fact'){
      const e=await fetch('https://catfact.ninja/fact');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Cat Facts',fact:d.fact});
    }

    if(ep==='bored'){
      const e=await fetch('https://www.boredapi.com/api/activity');
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Bored API',activity:d.activity,type:d.type,participants:d.participants});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/fun/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
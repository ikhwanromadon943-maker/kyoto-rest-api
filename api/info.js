export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS') return res.status(200).json({status:true,message:'CORS preflight OK'});

  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/info/','');

    if(ep==='wikipedia'){
      const title=url.searchParams.get('title');
      if(!title) return res.json({status:false,author:'Kyoto API',error:'Parameter "title" is required'});
      const e=await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Wikipedia',title:d.title,extract:d.extract,url:d.content_urls?.desktop?.page,image:d.thumbnail?.source});
    }

    if(ep==='dictionary'){
      const word=url.searchParams.get('word');
      if(!word) return res.json({status:false,author:'Kyoto API',error:'Parameter "word" is required'});
      const e=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Free Dictionary API',word,definitions:d[0]?.meanings||[]});
    }

    if(ep==='github'){
      const username=url.searchParams.get('username');
      if(!username) return res.json({status:false,author:'Kyoto API',error:'Parameter "username" is required'});
      const e=await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'GitHub API',user:{login:d.login,name:d.name,bio:d.bio,repos:d.public_repos,followers:d.followers,avatar:d.avatar_url}});
    }

    if(ep==='npm'){
      const pkg=url.searchParams.get('package');
      if(!pkg) return res.json({status:false,author:'Kyoto API',error:'Parameter "package" is required'});
      const e=await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`);
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'NPM Registry',name:d.name,version:d.version,description:d.description,license:d.license});
    }

    if(ep==='country'){
      const name=url.searchParams.get('name');
      if(!name) return res.json({status:false,author:'Kyoto API',error:'Parameter "name" is required'});
      const e=await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`);
      const d=await e.json();
      const c=d[0]||{};
      return res.json({status:true,author:'Kyoto API',provider:'REST Countries',name:c.name?.common,capital:c.capital?.[0],population:c.population,flag:c.flags?.png,region:c.region});
    }

    if(ep==='holiday'){
      const year=url.searchParams.get('year')||new Date().getFullYear();
      const country=url.searchParams.get('country')||'ID';
      const e=await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
      const d=await e.json();
      return res.json({status:true,author:'Kyoto API',provider:'Nager.Date',year,country,holidays:d.slice(0,20)});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/info/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
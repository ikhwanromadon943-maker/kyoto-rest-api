export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).json({status:true,message:'CORS preflight OK'});

  try{
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ep=url.pathname.replace('/api/number-fact/','');

    if(ep==='random'){
      const e=await fetch('http://numbersapi.com/random/trivia');
      const fact=await e.text();
      return res.json({status:true,author:'Kyoto API',provider:'NumbersAPI',fact});
    }

    if(ep==='number'){
      const n=url.searchParams.get('number')||'42';
      const e=await fetch(`http://numbersapi.com/${n}/trivia`);
      const fact=await e.text();
      return res.json({status:true,author:'Kyoto API',provider:'NumbersAPI',number:n,fact});
    }

    if(ep==='math'){
      const n=url.searchParams.get('number')||'42';
      const e=await fetch(`http://numbersapi.com/${n}/math`);
      const fact=await e.text();
      return res.json({status:true,author:'Kyoto API',provider:'NumbersAPI',number:n,fact});
    }

    if(ep==='year'){
      const y=url.searchParams.get('year')||'2024';
      const e=await fetch(`http://numbersapi.com/${y}/year`);
      const fact=await e.text();
      return res.json({status:true,author:'Kyoto API',provider:'NumbersAPI',year:y,fact});
    }

    return res.json({status:false,author:'Kyoto API',error:`/api/number-fact/${ep} not found`});
  } catch(err){return res.status(500).json({status:false,author:'Kyoto API',error:err.message})}
}
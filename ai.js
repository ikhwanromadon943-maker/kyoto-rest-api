export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/ai/', '');
  const text = url.searchParams.get('text');

  if (endpoint === 'chatgpt') {
    if (!text) {
      return res.json({
        status: false,
        author: 'Kyoto API',
        error: 'Parameter "text" is required'
      });
    }
    return res.json({
      status: true,
      author: 'Kyoto API',
      result: `Kyoto AI response to: "${text}"`
    });
  }

  return res.json({
    status: false,
    error: `Endpoint ${endpoint} not found`
  });
}
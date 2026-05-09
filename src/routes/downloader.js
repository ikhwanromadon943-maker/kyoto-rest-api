// Kyoto API — Downloader Endpoints
// Semua downloader perlu self-hosted scraper (yt-dlp / spotdl / tiktok-api-unofficial)
// Endpoint ini mengembalikan info bahwa fitur memerlukan worker khusus

export default async function handler(req, res) {
  const start = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ status: true, message: 'CORS preflight OK', response_time: `${Date.now() - start}ms` });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/downloader/', '');
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return res.status(400).json({
      status: false, author: 'Kyoto API',
      error: 'Parameter "url" is required',
      timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
    });
  }

  const platformMap = {
    tiktok: { platform: 'TikTok', library: 'tiktok-api-unofficial (npm) / yt-dlp' },
    instagram: { platform: 'Instagram', library: 'instagrapi (Python) / igdl (Node)' },
    youtube: { platform: 'YouTube', library: 'yt-dlp (CLI) / youtube-dl-exec (Node)' },
    twitter: { platform: 'Twitter / X', library: 'yt-dlp (CLI) / twitter-api-v2 (Node)' },
    spotify: { platform: 'Spotify', library: 'spotdl (CLI) / spotifydl (npm)' },
  };

  const info = platformMap[endpoint];
  if (!info) {
    return res.status(404).json({
      status: false, author: 'Kyoto API',
      error: `Downloader "${endpoint}" not found`,
      timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`
    });
  }

  return res.json({
    status: true,
    author: 'Kyoto API',
    platform: info.platform,
    requested_url: targetUrl,
    quality: url.searchParams.get('quality') || 'best',
    production_note: `This endpoint requires a self-hosted scraper. Use: ${info.library}. Deploy on a worker with binary support (Railway, dedicated VPS).`,
    timestamp: new Date().toISOString(),
    response_time: `${Date.now() - start}ms`
  });
}
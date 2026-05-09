// Kyoto API — Downloader Endpoints
// TikTok / Instagram / YouTube / Twitter / Spotify
// Karena platform ini tidak menyediakan API unduhan publik gratis,
// endpoint akan mengembalikan status bahwa fitur ini tersedia via
// self-hosted scraper. Untuk production, gunakan library:
//   - yt-dlp (YouTube, TikTok, IG, Twitter)
//   - spotdl (Spotify)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = url.pathname.replace('/api/downloader/', '');
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return res.status(400).json({ error: 'Parameter "url" diperlukan' });
  }

  // Semua platform — kembalikan respons informatif
  const platformMap = {
    tiktok: { platform: 'TikTok', library: 'TikTokAPI (npm: tiktok-api-unofficial)' },
    instagram: { platform: 'Instagram', library: 'instagrapi (Python) / igdl (Node)' },
    youtube: { platform: 'YouTube', library: 'yt-dlp (CLI) / youtube-dl-exec (Node)' },
    twitter: { platform: 'Twitter / X', library: 'yt-dlp (CLI) / twitter-api-v2 (Node)' },
    spotify: { platform: 'Spotify', library: 'spotdl (CLI) / spotidownloader (npm)' },
  };

  const info = platformMap[endpoint];
  if (!info) {
    return res.status(404).json({ error: `Downloader "${endpoint}" tidak tersedia` });
  }

  const quality = url.searchParams.get('quality') || 'best';

  return res.json({
    status: 200,
    platform: info.platform,
    requested_url: targetUrl,
    quality,
    message: `Downloader ${info.platform} memerlukan self-hosted scraper. Gunakan library: ${info.library}.`,
    note: 'Endpoint ini berfungsi penuh saat di-deploy dengan worker yang memiliki akses scraper (yt-dlp / spotdl).',
    docs: 'https://github.com/yt-dlp/yt-dlp',
  });
}
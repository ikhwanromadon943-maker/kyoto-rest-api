export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const endpoint = pathname.replace('/api/downloader/', '');
    const url = new URL(req.url, `http://${req.headers.host}`).searchParams.get('url');

    if (!url) return res.status(400).json({ error: 'Parameter "url" is required' });

    try {
        switch (endpoint) {
            case 'tiktok':
                return res.json({
                    status: 200,
                    platform: 'TikTok',
                    url,
                    download: 'https://example.com/download/tiktok-watermark-free.mp4',
                    title: 'TikTok Video',
                    duration: '00:30'
                });
            case 'instagram':
                return res.json({
                    status: 200,
                    platform: 'Instagram',
                    url,
                    media: [{ type: 'video', url: 'https://example.com/download/ig-reel.mp4' }]
                });
            case 'youtube': {
                const quality = new URL(req.url, `http://${req.headers.host}`).searchParams.get('quality') || '720p';
                return res.json({
                    status: 200,
                    platform: 'YouTube',
                    url,
                    quality,
                    download: `https://example.com/download/yt-${quality}.mp4`,
                    title: 'YouTube Video'
                });
            }
            case 'twitter':
                return res.json({
                    status: 200,
                    platform: 'Twitter/X',
                    url,
                    download: 'https://example.com/download/twitter-video.mp4'
                });
            case 'spotify':
                return res.json({
                    status: 200,
                    platform: 'Spotify',
                    url,
                    download: 'https://example.com/download/spotify-track.mp3',
                    title: 'Spotify Track',
                    artist: 'Artist Name'
                });
            default:
                return res.status(404).json({ error: `Downloader ${endpoint} not found` });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
}
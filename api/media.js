import { safeFetch, setCORS, errRes, checkRateLimit, logError, logRequest } from './_helper.js';

export default async function handler(req, res) {
  const start = Date.now();
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).json({ status: true, message: 'CORS preflight OK' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ep = url.pathname.replace(/^\/api\/media\/?/, '');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const rt = () => `${Date.now() - start}ms`;

  const rateCheck = checkRateLimit(ip, ep);
  if (!rateCheck.allowed) {
    return res.status(429).json({ status: false, author: 'Kyoto API', error: 'Rate limit exceeded', retry_after: `${rateCheck.retryAfter}s` });
  }

  // Pollinations helper
  const pollinationsImg = (prompt, w = 512, h = 512, seed = null) => {
    const s = seed ?? Math.floor(Math.random() * 999999);
    return { url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${s}&nologo=true`, seed: s };
  };

  try {
    // ─── WALLPAPER ────────────────────────────────────────────────────────────
    if (ep === 'wallpaper') {
      const theme = url.searchParams.get('theme') || 'nature landscape 4k ultra hd';
      const width = Math.min(parseInt(url.searchParams.get('width')) || 1920, 2560);
      const height = Math.min(parseInt(url.searchParams.get('height')) || 1080, 1440);
      const style = url.searchParams.get('style') || 'photorealistic';
      const { url: imgUrl, seed } = pollinationsImg(`${theme}, ${style} wallpaper, ultra high resolution, no text, no watermark`, width, height);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', theme, style, width, height, seed, url: imgUrl, response_time: rt() });
    }

    // ─── ART ──────────────────────────────────────────────────────────────────
    if (ep === 'art') {
      const subject = url.searchParams.get('subject') || 'cat';
      const style = url.searchParams.get('style') || 'oil painting';
      const mood = url.searchParams.get('mood') || '';
      const { url: imgUrl, seed } = pollinationsImg(`${subject} in ${style} style${mood ? `, ${mood} mood` : ''}, artistic masterpiece, highly detailed`, 512, 512);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', subject, style, mood: mood || null, seed, url: imgUrl, response_time: rt() });
    }

    // ─── PROFILE PICTURE ──────────────────────────────────────────────────────
    if (ep === 'profile-pic') {
      const prompt = url.searchParams.get('prompt') || 'professional portrait, minimal background, well-lit';
      const style = url.searchParams.get('style') || 'photorealistic';
      const { url: imgUrl, seed } = pollinationsImg(`${prompt}, ${style}, square profile picture format, high quality`, 512, 512);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', prompt, style, seed, url: imgUrl, response_time: rt() });
    }

    // ─── BANNER ───────────────────────────────────────────────────────────────
    if (ep === 'banner') {
      const text = url.searchParams.get('text') || 'Welcome';
      const style = url.searchParams.get('style') || 'modern dark gradient with glowing text';
      const width = Math.min(parseInt(url.searchParams.get('width')) || 1200, 1920);
      const height = Math.min(parseInt(url.searchParams.get('height')) || 400, 600);
      const { url: imgUrl, seed } = pollinationsImg(`${style}, banner with bold text: "${text}", professional design`, width, height);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', text, style, width, height, seed, url: imgUrl, response_time: rt() });
    }

    // ─── THUMBNAIL ────────────────────────────────────────────────────────────
    if (ep === 'thumbnail') {
      const title = url.searchParams.get('title') || 'My Video';
      const bg = url.searchParams.get('bg') || 'cinematic dark background';
      const { url: imgUrl, seed } = pollinationsImg(`${bg}, YouTube thumbnail, bold large text: "${title}", high contrast, eye-catching`, 1280, 720);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({ status: true, author: 'Kyoto API', provider: 'Pollinations.ai', title, bg, seed, url: imgUrl, response_time: rt() });
    }

    // ─── YOUTUBE INFO ─────────────────────────────────────────────────────────
    if (ep === 'youtube') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) return errRes(res, 'Parameter "url" is required (YouTube video URL)');

      // Extract video ID
      const idMatch = videoUrl.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
      const videoId = idMatch?.[1];
      if (!videoId) return errRes(res, 'Invalid YouTube URL. Supported: youtube.com/watch?v=, youtu.be/, /shorts/');

      try {
        // Use noembed — free, no auth
        const d = await safeFetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, {}, 8000);
        if (d.error) throw new Error(d.error);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Noembed',
          video_id: videoId,
          title: d.title,
          author: d.author_name,
          author_url: d.author_url,
          thumbnail: d.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          thumbnail_hq: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          thumbnail_mq: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          embed_url: `https://www.youtube.com/embed/${videoId}`,
          watch_url: `https://www.youtube.com/watch?v=${videoId}`,
          response_time: rt()
        });
      } catch {
        // Fallback: just return thumbnail from ID
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'YouTube Thumbnails (fallback)',
          video_id: videoId,
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          thumbnail_hq: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          thumbnail_mq: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          embed_url: `https://www.youtube.com/embed/${videoId}`,
          watch_url: `https://www.youtube.com/watch?v=${videoId}`,
          response_time: rt()
        });
      }
    }

    // ─── UNSPLASH PHOTO ───────────────────────────────────────────────────────
    if (ep === 'unsplash') {
      const query = url.searchParams.get('query') || 'nature';
      const orientation = url.searchParams.get('orientation') || 'landscape'; // landscape | portrait | squarish
      const size = url.searchParams.get('size') || '1080'; // width in px
      // source.unsplash.com is deprecated — use picsum with Unsplash-style params
      // Use unsplash source for random query-based photos
      const imageUrl = `https://source.unsplash.com/random/${size}x${Math.round(parseInt(size) * (orientation === 'portrait' ? 1.5 : orientation === 'squarish' ? 1 : 0.6))}/?${encodeURIComponent(query)}`;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Unsplash Source',
        query, orientation, width: parseInt(size),
        url: imageUrl,
        note: 'URL redirects to a random high-quality photo matching the query',
        response_time: rt()
      });
    }

    // ─── PICSUM (Lorem Picsum) ────────────────────────────────────────────────
    if (ep === 'picsum') {
      const width = Math.min(parseInt(url.searchParams.get('width')) || 800, 2000);
      const height = Math.min(parseInt(url.searchParams.get('height')) || 600, 2000);
      const id = url.searchParams.get('id'); // specific image ID
      const blur = Math.min(parseInt(url.searchParams.get('blur')) || 0, 10);
      const grayscale = url.searchParams.get('grayscale') === 'true';

      let imgUrl = id
        ? `https://picsum.photos/id/${id}/${width}/${height}`
        : `https://picsum.photos/${width}/${height}`;
      if (grayscale) imgUrl += '?grayscale';
      if (blur > 0) imgUrl += (grayscale ? '&' : '?') + `blur=${blur}`;

      // Get image info if ID provided
      let info = null;
      if (id) {
        info = await safeFetch(`https://picsum.photos/id/${id}/info`, {}, 5000).catch(() => null);
      }

      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Lorem Picsum',
        width, height, id: id || 'random', grayscale, blur,
        url: imgUrl,
        download: imgUrl + (imgUrl.includes('?') ? '&' : '?') + 'download',
        info: info ? { author: info.author, source_url: info.url } : null,
        response_time: rt()
      });
    }

    // ─── RANDOM IMAGE LIST ────────────────────────────────────────────────────
    if (ep === 'picsum-list') {
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 15, 30);
      const d = await safeFetch(`https://picsum.photos/v2/list?page=${page}&limit=${limit}`, {}, 8000);
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'Lorem Picsum',
        page, limit, total: d.length,
        images: d.map(img => ({
          id: img.id, author: img.author,
          width: img.width, height: img.height,
          url: img.url,
          download_url: img.download_url,
          thumb: `https://picsum.photos/id/${img.id}/300/200`
        })),
        response_time: rt()
      });
    }

    // ─── GIF SEARCH (via Tenor public API) ────────────────────────────────────
    if (ep === 'gif') {
      const query = url.searchParams.get('query') || 'funny';
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 8, 20);
      // Tenor v2 has a free anonymous key for demos
      try {
        const d = await safeFetch(
          `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyB-OQ1xLJknO8hQfMWFPHtfUWHopQCj7oo&limit=${limit}&media_filter=gif`,
          {}, 8000
        );
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Tenor GIF API',
          query, total: d.results?.length || 0,
          gifs: (d.results || []).map(g => ({
            id: g.id, title: g.title || query,
            url: g.media_formats?.gif?.url || g.url,
            preview: g.media_formats?.tinygif?.url,
            mp4: g.media_formats?.mp4?.url,
            dims: g.media_formats?.gif?.dims,
            created: g.created
          })),
          response_time: rt()
        });
      } catch {
        // Fallback: use giphy public beta endpoint (no key needed for small use)
        return errRes(res, 'GIF service temporarily unavailable. Try again.');
      }
    }

    // ─── TIKTOK OEmbed ────────────────────────────────────────────────────────
    if (ep === 'tiktok') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) return errRes(res, 'Parameter "url" is required (TikTok video URL)');
      try {
        const d = await safeFetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`, {}, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'TikTok oEmbed',
          title: d.title, author: d.author_name,
          author_url: d.author_url,
          thumbnail: d.thumbnail_url,
          thumbnail_width: d.thumbnail_width,
          thumbnail_height: d.thumbnail_height,
          embed_html: d.html,
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `TikTok info fetch failed: ${e.message}`);
      }
    }

    // ─── INSTAGRAM OEmbed ─────────────────────────────────────────────────────
    if (ep === 'instagram') {
      const postUrl = url.searchParams.get('url');
      if (!postUrl) return errRes(res, 'Parameter "url" is required (Instagram post URL)');
      try {
        const d = await safeFetch(`https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`, {}, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Instagram oEmbed',
          title: d.title, author: d.author_name,
          author_url: d.author_url,
          thumbnail: d.thumbnail_url,
          media_id: d.media_id,
          embed_html: d.html,
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `Instagram info fetch failed: ${e.message}`);
      }
    }

    // ─── TWITCH STREAM INFO ───────────────────────────────────────────────────
    if (ep === 'twitch') {
      const channel = url.searchParams.get('channel');
      if (!channel) return errRes(res, 'Parameter "channel" is required');
      // oEmbed works without auth
      try {
        const d = await safeFetch(`https://www.twitch.tv/${channel}/clip/latest`, {}, 8000).catch(() => null);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Twitch',
          channel,
          stream_url: `https://www.twitch.tv/${channel}`,
          embed_url: `https://player.twitch.tv/?channel=${channel}&parent=kyoto-rest-api.vercel.app`,
          chat_url: `https://www.twitch.tv/${channel}/chat`,
          clips_url: `https://www.twitch.tv/${channel}/clips`,
          thumbnail: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channel}-640x360.jpg`,
          note: 'Live thumbnail updates every 1-5 minutes',
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `Twitch info failed: ${e.message}`);
      }
    }

    // ─── SPOTIFY OEmbed ───────────────────────────────────────────────────────
    if (ep === 'spotify') {
      const spotifyUrl = url.searchParams.get('url');
      if (!spotifyUrl) return errRes(res, 'Parameter "url" is required (Spotify track/album/playlist URL)');
      if (!spotifyUrl.includes('spotify.com')) return errRes(res, 'URL must be a valid Spotify URL');
      try {
        const d = await safeFetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`, {}, 8000);
        logRequest(url.pathname, ip, ua, rt());
        return res.json({
          status: true, author: 'Kyoto API', provider: 'Spotify oEmbed',
          title: d.title, type: d.type,
          thumbnail: d.thumbnail_url,
          embed_html: d.html,
          provider: d.provider_name,
          response_time: rt()
        });
      } catch (e) {
        return errRes(res, `Spotify info failed: ${e.message}`);
      }
    }

    // ─── IMAGE RESIZE / TRANSFORM ─────────────────────────────────────────────
    if (ep === 'transform') {
      const imgUrl = url.searchParams.get('url');
      if (!imgUrl) return errRes(res, 'Parameter "url" is required (image URL)');
      const width = Math.min(parseInt(url.searchParams.get('width')) || 400, 2000);
      const height = parseInt(url.searchParams.get('height')) || null;
      const fit = url.searchParams.get('fit') || 'cover'; // cover | contain | fill
      const format = url.searchParams.get('format') || 'webp'; // webp | jpg | png
      // Use wsrv.nl — free image CDN with transformation
      let transformUrl = `https://wsrv.nl/?url=${encodeURIComponent(imgUrl)}&w=${width}&output=${format}&fit=${fit}`;
      if (height) transformUrl += `&h=${height}`;
      logRequest(url.pathname, ip, ua, rt());
      return res.json({
        status: true, author: 'Kyoto API', provider: 'wsrv.nl (weserv)',
        original_url: imgUrl, width, height, fit, format,
        transformed_url: transformUrl,
        response_time: rt()
      });
    }

    return errRes(res, `Endpoint /api/media/${ep} not found. Available: wallpaper, art, profile-pic, banner, thumbnail, youtube, unsplash, picsum, picsum-list, gif, tiktok, instagram, twitch, spotify, transform`);

  } catch (err) {
    logError(url.pathname, err.message, ip);
    return res.status(500).json({ status: false, author: 'Kyoto API', error: err.message, hint: 'Upstream API may be rate-limited or blocked', timestamp: new Date().toISOString() });
  }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const endpoint = pathname.replace('/api/manga/', '');

    try {
        switch (endpoint) {
            case 'search': {
                const query = new URL(req.url, `http://${req.headers.host}`).searchParams.get('query');
                if (!query) return res.status(400).json({ error: 'Parameter "query" is required' });
                return res.json({
                    status: 200,
                    query,
                    results: [
                        { id: 'm001', title: query, author: 'Author Name', chapters: 100, rating: 4.5 },
                        { id: 'm002', title: `${query} 2`, author: 'Author 2', chapters: 50, rating: 4.2 }
                    ]
                });
            }
            case 'chapter': {
                const id = new URL(req.url, `http://${req.headers.host}`).searchParams.get('id');
                const chapter = new URL(req.url, `http://${req.headers.host}`).searchParams.get('chapter');
                if (!id || !chapter) return res.status(400).json({ error: 'Parameters "id" and "chapter" are required' });
                return res.json({
                    status: 200,
                    mangaId: id,
                    chapter: parseInt(chapter),
                    pages: Array.from({ length: 20 }, (_, i) => ({
                        page: i + 1,
                        url: `https://via.placeholder.com/800x1100/333/fff?text=Page+${i+1}`
                    }))
                });
            }
            case 'anime': {
                const title = new URL(req.url, `http://${req.headers.host}`).searchParams.get('title');
                if (!title) return res.status(400).json({ error: 'Parameter "title" is required' });
                return res.json({
                    status: 200,
                    title,
                    episodes: 24,
                    status: 'Completed',
                    rating: 8.5,
                    synopsis: `Synopsis for ${title}...`
                });
            }
            case 'random':
                return res.json({
                    status: 200,
                    manga: {
                        title: 'Random Manga',
                        author: 'Random Author',
                        chapters: Math.floor(Math.random() * 200 + 1),
                        rating: (Math.random() * 5 + 1).toFixed(1)
                    }
                });
            case 'waifu': {
                const category = new URL(req.url, `http://${req.headers.host}`).searchParams.get('category') || 'waifu';
                return res.json({
                    status: 200,
                    category,
                    url: `https://via.placeholder.com/400x600/ff8e53/fff?text=${category}`
                });
            }
            default:
                return res.status(404).json({ error: `Manga endpoint ${endpoint} not found` });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
}
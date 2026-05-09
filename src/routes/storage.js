export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const endpoint = pathname.replace('/api/storage/', '');

    try {
        switch (endpoint) {
            case 'upload': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
                return res.json({
                    status: 200,
                    message: 'File uploaded successfully',
                    file: {
                        id: `file_${Date.now()}`,
                        name: 'uploaded-file.jpg',
                        size: '1.2 MB',
                        url: 'https://example.com/storage/uploaded-file.jpg',
                        uploadedAt: new Date().toISOString()
                    }
                });
            }
            case 'list': {
                const folder = new URL(req.url, `http://${req.headers.host}`).searchParams.get('folder');
                return res.json({
                    status: 200,
                    folder: folder || 'root',
                    files: [
                        { id: 'file_001', name: 'image1.jpg', size: '500 KB', uploadedAt: '2026-05-09' },
                        { id: 'file_002', name: 'doc.pdf', size: '2.1 MB', uploadedAt: '2026-05-08' },
                        { id: 'file_003', name: 'video.mp4', size: '15 MB', uploadedAt: '2026-05-07' }
                    ]
                });
            }
            case 'delete': {
                if (req.method !== 'DELETE') return res.status(405).json({ error: 'DELETE required' });
                const file = new URL(req.url, `http://${req.headers.host}`).searchParams.get('file');
                if (!file) return res.status(400).json({ error: 'Parameter "file" is required' });
                return res.json({
                    status: 200,
                    message: `File "${file}" deleted successfully`
                });
            }
            default:
                return res.status(404).json({ error: `Storage endpoint ${endpoint} not found` });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
}
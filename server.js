// Zero-dependency static file server for local dev, using Bun's native APIs.
// import.meta.dir is the already-decoded directory of this file (handles
// non-ASCII characters in the path, e.g. the "é" in "pokénet").
const ROOT = import.meta.dir;
const PORT = process.env.PORT || 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const file = Bun.file(ROOT + path);

    if (!(await file.exists())) {
      return new Response('Not found', { status: 404 });
    }

    const ext = path.slice(path.lastIndexOf('.'));
    return new Response(file, {
      headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
    });
  },
});

console.log(`PokéPack Sim running at http://localhost:${PORT}`);

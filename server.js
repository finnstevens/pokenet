// Zero-dependency dev server using Bun's native APIs: serves the static site AND
// a tiny WebSocket presence endpoint at /ws (so "who's online" works for browsers
// hitting this same server — same machine / LAN). No npm packages.
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

// ---- presence ----
const clients = new Set();
let seq = 0;

function roster() {
  return JSON.stringify({
    type: 'roster',
    users: [...clients].map(ws => ({ id: ws.data.id, name: ws.data.name })),
  });
}
function broadcast() {
  const msg = roster();
  for (const ws of clients) {
    try { ws.send(msg); } catch { /* ignore */ }
  }
}

Bun.serve({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket presence endpoint.
    if (url.pathname === '/ws') {
      if (server.upgrade(req, { data: { id: ++seq, name: 'Trainer' } })) return;
      return new Response('Upgrade failed', { status: 400 });
    }

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
  websocket: {
    open(ws) {
      clients.add(ws);
      ws.send(JSON.stringify({ type: 'welcome', id: ws.data.id }));
      broadcast();
    },
    message(ws, raw) {
      try {
        const m = JSON.parse(raw);
        if (m.type === 'hello' && typeof m.name === 'string') {
          ws.data.name = m.name.slice(0, 24) || 'Trainer';
          broadcast();
        }
      } catch { /* ignore malformed */ }
    },
    close(ws) {
      clients.delete(ws);
      broadcast();
    },
  },
});

console.log(`PokéPack Sim running at http://localhost:${PORT}  (presence ws at /ws)`);

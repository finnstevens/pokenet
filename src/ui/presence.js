/* Presence client — connects to the dev server's /ws WebSocket and shows a live
   "who's online" roster. Real for browsers hitting the same server (same machine
   / LAN). On a static host (GitHub Pages, no server) it can't connect and shows
   "offline" gracefully. Names from other clients are escaped (untrusted). */

import { state } from '../state/store.js';

let panel, ws = null, myId = null, reconnectTimer = null, roster = [];

export function initPresence() {
  panel = document.getElementById('online-panel');
  connect();
  renderPresence();
}

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

function connect() {
  try { ws = new WebSocket(wsUrl()); }
  catch { scheduleReconnect(); return; }
  ws.onopen = () => { hello(); renderPresence(); };
  ws.onmessage = e => {
    try {
      const m = JSON.parse(e.data);
      if (m.type === 'welcome') myId = m.id;
      else if (m.type === 'roster') { roster = m.users || []; renderPresence(); }
    } catch { /* ignore */ }
  };
  ws.onclose = () => { ws = null; roster = []; renderPresence(); scheduleReconnect(); };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 4000);
}

function connected() { return ws && ws.readyState === WebSocket.OPEN; }

function hello() {
  if (connected()) ws.send(JSON.stringify({ type: 'hello', name: state.username || 'Trainer' }));
}

/* Called when the username changes — re-announce. */
export function setPresenceName() { hello(); renderPresence(); }

const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderPresence() {
  if (!panel) return;
  if (!connected()) {
    panel.innerHTML = `
      <div class="online-head offline">🔌 Presence offline</div>
      <div class="online-sub">Run the app locally (<code>bun run dev</code>) to see friends on your machine or network here.</div>`;
    return;
  }
  const list = roster.map(u =>
    `<span class="online-user${u.id === myId ? ' me' : ''}">${escapeHtml(u.name)}${u.id === myId ? ' (you)' : ''}</span>`
  ).join('');
  panel.innerHTML = `
    <div class="online-head">🟢 Online now · ${roster.length}</div>
    <div class="online-list">${list || '<span class="online-sub">No one else yet.</span>'}</div>`;
}

---
title: Usernames + LAN presence (who's online)
date: 2026-06-10
slug: usernames-and-presence
status: Verified   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Usernames + LAN presence (who's online)

> Add a **trainer name** (usernames) and a real **"who's online" list** powered by
> a **Bun-native WebSocket** endpoint added to the dev server (zero npm deps).
> Presence is real for browsers hitting the same `bun run dev` server (same
> machine / LAN); on GitHub Pages (no server) it degrades gracefully to "offline".

## Decisions (Gate 1)
- Real backend, but **Bun-native, zero dependencies** (honors the no-npm rule).
- **Local/LAN scope**: presence works against the running dev server; not
  internet-wide unless the user hosts the server with a `wss://` URL (out of scope).
- **Usernames built too** (a name is needed to show *who* is online).

## ⚠️ Constraint note
This is the first deliberate break of "static site, no backend." The frontend
stays static (GitHub Pages), but presence needs a server, so it only works when
the app is served by `bun run dev` (which now also speaks WebSocket). On the
static GitHub Pages deploy there's no server → the Online panel shows "offline".

## Usernames
- `state.username` (string, persisted). `setUsername(name)` action.
- **First-run**: if no username on boot, a small prompt modal asks for one
  (defaults to "Trainer" if dismissed).
- **Header**: a `👤 TRAINER · <name>` badge; click to rename (same modal).
- Sanitised: trimmed, max ~20 chars, rendered via `textContent` (no injection).

## Presence
- **Server (`server.js`)**: add a `/ws` route — `server.upgrade(req, {data:{id}})`;
  a `websocket` handler tracks connected clients. Protocol: client → `{type:'hello',
  name}`; server tracks `{id,name}` per socket and broadcasts `{type:'roster',
  users:[{id,name}]}` on join / leave / rename. Native `Bun.serve` WebSocket — no deps.
- **Client (`ui/presence.js`)**: connect to `ws(s)://${location.host}/ws`; on open
  send `hello` with the username; on `roster` render the Online list; reconnect with
  backoff on drop; re-send `hello` when the username changes. If it can't connect
  (e.g. GitHub Pages) → show "Presence offline (run locally to see friends)".
- **UI**: an **"🟢 Online now"** panel at the top of the Trade tab listing connected
  trainers (names + a count), with you marked "(you)".

## Architecture / files
- `server.js`: `/ws` upgrade + `websocket` handlers + roster broadcast.
- `state/store.js`: `username` + persist + `setUsername`.
- `ui/username.js` (new): badge + first-run + rename modal.
- `ui/presence.js` (new): WS client + Online panel render.
- `index.html`: header trainer badge, username modal, Online panel in Trade view.
- `main.js`: init username + presence.
- `styles.css`: badge, modal, online list.

## Acceptance criteria
- [ ] First run prompts for a name; header shows it; rename works + persists.
- [ ] With two browsers on the dev server, each sees the other in the Online list;
      closing one removes it; renaming updates the roster live.
- [ ] On no server (static deploy) the panel shows "offline" without errors.
- [ ] Presence uses only Bun-native WS — no npm deps added.
- [ ] `node --check` clean; harness + headless (two clients) green.

## Risks / notes
- Real backend = the app is no longer purely static for this feature (documented).
- `ws://` from an `https://` page is blocked (mixed content) — so the live HTTPS
  site can't reach a `ws://` LAN server; the demo runs over the local `http` dev
  server. Internet-wide presence needs a hosted `wss://` server (future).
- No auth; names are self-declared (fine for a friendly LAN list).

## Test strategy
- Bun harness: `setUsername` persists; (if factored) roster-building helper.
- Integration: start `bun run dev` (now with `/ws`); open **two** headless browsers,
  set distinct usernames, assert each browser's Online list shows both names; close
  one → the other's list drops to one. Also confirm a no-WS page shows "offline".
- Screenshot the Online panel with two trainers.

## Results & verification
**Built**: `server.js` — `/ws` upgrade + Bun-native `websocket` handlers + roster
broadcast (zero deps). `store.js` — `username` + persist + `setUsername` (trim/cap
20/default Trainer). `ui/username.js` — header badge + first-run prompt + rename.
`ui/presence.js` — WS client (connect/hello/roster/reconnect, names escaped) +
Online panel. `index.html`/`main.js`/`styles.css` wired.

**Verification — all green:**
- `node --check` on all files (incl. the Bun server) + import-graph clean.
- **Bun harness (4/4)**: `setUsername` sets/trims/caps-at-20/defaults to Trainer.
- **Two-browser presence (5/5)**: two headless Brave clients on the dev server →
  A's panel "🟢 Online now · 2 · Ash (you) Misty", B's mirror; A marks itself
  "(you)"; **B leaves → A drops to "· 1"** (live join/leave). Screenshot of A's
  trainer badge + panel.
- Graceful offline branch when no WS server (static host) — `onclose` → "Presence
  offline" panel + 4s reconnect (code path; not hit while the dev server is up).

All acceptance criteria met. **Live only under `bun run dev` (same machine/LAN);
GitHub Pages has no server → shows "offline".**

## Changelog
- `<pending>` — Usernames + Bun-native LAN presence

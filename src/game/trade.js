/* Offline trade codes (no backend, no deps). A trade "bundle" is
   { cards:[snapshot], packs:{setId:count}, boxes:[{setId,packs}], money }.
   Encoded as POKETRADE.<O|C>.<base64> where O = an offer, C = a confirmation.
   Compact keys keep the copy-paste code shorter. */

const PREFIX = 'POKETRADE';

// card snapshot <-> compact form
function packCard(c) {
  return { u: c.uid, n: c.name, m: c.number, r: c.rarity, t: c.tier, s: c.setId, sn: c.setName, i: c.image, p: c.price };
}
function unpackCard(o) {
  return { uid: o.u, name: o.n, number: o.m, rarity: o.r, tier: o.t, setId: o.s, setName: o.sn, image: o.i, price: o.p };
}
function packBundle(b) {
  return { c: (b.cards || []).map(packCard), pk: b.packs || {}, bx: b.boxes || [], $: +(b.money || 0) };
}
function unpackBundle(o) {
  return { cards: (o.c || []).map(unpackCard), packs: o.pk || {}, boxes: o.bx || [], money: +(o.$ || 0) };
}

function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64decode(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

function encode(type, id, give) {
  return `${PREFIX}.${type}.${b64encode(JSON.stringify({ id, g: packBundle(give) }))}`;
}

/* A trade OFFER (you → friend). */
export function encodeOffer(id, give) { return encode('O', id, give); }
/* A CONFIRMATION (friend → you, accepting your offer). */
export function encodeConfirm(id, give) { return encode('C', id, give); }

/* Parse a pasted code → { type:'offer'|'confirm', id, give } or null. */
export function decodeTrade(code) {
  if (typeof code !== 'string') return null;
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const type = parts[1] === 'O' ? 'offer' : parts[1] === 'C' ? 'confirm' : null;
  if (!type) return null;
  try {
    const obj = JSON.parse(b64decode(parts[2]));
    if (!obj || typeof obj.id !== 'string') return null;
    return { type, id: obj.id, give: unpackBundle(obj.g || {}) };
  } catch {
    return null;
  }
}

/* True if a bundle actually contains anything. */
export function bundleIsEmpty(b) {
  return !b || (!(b.cards || []).length && !Object.keys(b.packs || {}).length && !(b.boxes || []).length && !(b.money > 0));
}

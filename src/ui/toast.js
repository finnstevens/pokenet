/* Transient notifications (achievement unlocks, sales, daily claims). Each
   toast auto-removes after its CSS animation completes (~4.6s). */

let stack;

export function initToast() {
  stack = document.getElementById('toast-stack');
}

export function toast(title, body) {
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="t-title">${title}</div><div class="t-body">${body}</div>`;
  stack.appendChild(el);
  // matches the toastOut animation end in styles.css
  setTimeout(() => el.remove(), 4800);
}

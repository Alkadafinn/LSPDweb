/* LSPD RMS - shared UI helpers */
(function (g) {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  const icon = (name, cls) => '<svg class="ic ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';

  const money = n => '$' + Number(n || 0).toLocaleString('en-US');
  function jailShort(m) { return (m || 0) + ' mo'; }
  function jailLong(m) {
    m = m || 0;
    if (m < 12) return m + (m === 1 ? ' month' : ' months');
    const y = Math.floor(m / 12), r = m % 12;
    return m + ' months (' + y + ' yr' + (r ? ' ' + r + ' mo' : '') + ')';
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowHM() {
    const d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  /* 'YYYY-MM-DD' -> 'MM/DD/YYYY' */
  function fmtDate(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? m[2] + '/' + m[3] + '/' + m[1] : (v || '');
  }
  function fmtStamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function fmtBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
  }
  function debounce(fn, ms) {
    let t;
    const wrapped = function () {
      const a = arguments, c = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(c, a); }, ms);
    };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
  }

  /* Textareas grow with their content so exports never clip text. */
  function autosize(el) {
    if (!el) return;
    el.style.height = 'auto';
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = (el.scrollHeight + Math.max(0, border)) + 'px';
  }
  function autosizeAll(root) {
    $$('textarea', root).forEach(autosize);
  }

  /* Toasts */
  function toast(msg, type, ms) {
    const host = $('#toasts');
    if (!host) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'error' ? 'toast-error' : '');
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => { t.classList.add('toast-out'); setTimeout(() => t.remove(), 250); }, ms || 3200);
  }

  /* Confirm dialog (native <dialog>) */
  function confirmBox(o) {
    return new Promise(resolve => {
      const d = $('#dlgConfirm');
      if (!d || typeof d.showModal !== 'function') { resolve(window.confirm((o.title ? o.title + '\n\n' : '') + (o.message || ''))); return; }
      $('#dlgConfirmTitle').textContent = o.title || 'Confirm';
      $('#dlgConfirmMsg').textContent = o.message || '';
      const ok = $('#dlgConfirmOk');
      ok.textContent = o.confirmText || 'Confirm';
      ok.className = 'btn ' + (o.danger ? 'btn-danger-solid' : 'btn-primary');
      d.returnValue = '';
      d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
      d.showModal();
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  }

  /* Downscale + recompress an image so it fits in localStorage. */
  function readImage(file, max, quality) {
    max = max || 1100; quality = quality || 0.7;
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
        x.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image format is not supported.')); };
      img.src = url;
    });
  }

  /* Generic department seal, used when assets/LSPD-SEALS.png is missing. */
  function starPoints(cx, cy, ro, ri) {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? ri : ro, a = -Math.PI / 2 + i * Math.PI / 5;
      p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return p.join(' ');
  }
  const SEAL_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<path d="M50 4 L88 16 V50 C88 74 72 90 50 97 C28 90 12 74 12 50 V16 Z" fill="#0c1f3f" stroke="#b8912f" stroke-width="4"/>' +
    '<polygon points="' + starPoints(50, 42, 19, 8) + '" fill="#b8912f"/>' +
    '<text x="50" y="76" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">LSPD</text></svg>';
  const SEAL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SEAL_SVG);

  g.UI = {
    $: $, $$: $$, esc: esc, icon: icon, money: money, jailShort: jailShort, jailLong: jailLong,
    todayISO: todayISO, nowHM: nowHM, fmtDate: fmtDate, fmtStamp: fmtStamp, fmtBytes: fmtBytes,
    debounce: debounce, autosize: autosize, autosizeAll: autosizeAll,
    toast: toast, confirmBox: confirmBox, applyTheme: applyTheme, readImage: readImage,
    SEAL: SEAL
  };
})(window);

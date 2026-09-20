/* LSPD RMS - report export (PDF / JPG / PNG / print)
 *
 * The report is cloned off-screen at its true A4 width, form controls are
 * replaced by static text (so html2canvas renders wrapped text exactly), and
 * the result is cut into A4 pages only at block boundaries ([data-blk]).
 * The live editor is never modified. */
(function (g) {
  'use strict';

  const PAPER_W = 794; // 210 mm at 96 dpi
  const A4_RATIO = 297 / 210;

  function controls(root) {
    return Array.from(root.querySelectorAll('input:not([type=file]):not([type=hidden]), select, textarea'));
  }

  function checkboxNode(checked) {
    const s = document.createElement('span');
    s.style.cssText = 'display:inline-block;width:12px;height:12px;border:1.5px solid #0c1f3f;vertical-align:middle;margin-right:6px;position:relative;box-sizing:border-box;background:#fff;';
    if (checked) {
      s.innerHTML = '<svg width="9" height="9" viewBox="0 0 9 9" style="position:absolute;left:0.5px;top:0.5px"><path d="M1 1l7 7M8 1L1 8" stroke="#0c1f3f" stroke-width="1.6" fill="none"/></svg>';
    }
    return s;
  }

  /* Swap every live control in the clone for a static element that copies the original's value and look. */
  function staticify(orig, clone) {
    const a = controls(orig), b = controls(clone);
    a.forEach((o, i) => {
      const c = b[i];
      if (!c) return;
      if (o.type === 'checkbox') { c.replaceWith(checkboxNode(o.checked)); return; }
      const cs = getComputedStyle(o);
      const d = document.createElement('div');
      let v;
      if (o.tagName === 'SELECT') v = o.value && o.selectedIndex >= 0 ? o.options[o.selectedIndex].text : '';
      else if (o.type === 'date') v = UI.fmtDate(o.value);
      else v = o.value;
      d.textContent = v;
      Object.assign(d.style, {
        fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
        color: cs.color, padding: cs.padding, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        boxSizing: 'border-box', width: '100%', minHeight: o.offsetHeight + 'px', borderBottom: '1px solid transparent'
      });
      c.replaceWith(d);
    });
  }

  function imagesReady(root) {
    return Promise.all(Array.from(root.querySelectorAll('img')).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
        setTimeout(res, 2500);
      });
    }));
  }

  function safeEdges(clone, rect) {
    const blocks = Array.from(clone.querySelectorAll('[data-blk]'));
    let edges = new Set([0, rect.height]);
    const pos = blocks.map(el => {
      const r = el.getBoundingClientRect();
      return { el: el, top: r.top - rect.top, bottom: r.bottom - rect.top };
    });
    pos.forEach(p => {
      if (p.top > 0 && p.top < rect.height) edges.add(p.top);
      if (p.bottom > 0 && p.bottom < rect.height) edges.add(p.bottom);
    });
    /* headings must stay with the block that follows them */
    pos.forEach((p, i) => {
      if (!p.el.hasAttribute('data-keepnext') || !pos[i + 1]) return;
      const lo = p.bottom - 0.5, hi = pos[i + 1].top + 0.5;
      edges = new Set(Array.from(edges).filter(e => !(e >= lo && e <= hi)));
    });
    return Array.from(edges).sort((x, y) => x - y);
  }

  async function capture(paper, fallbackSeal) {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-12000px;top:0;width:' + PAPER_W + 'px;pointer-events:none;';
    const clone = paper.cloneNode(true);
    clone.style.transform = '';
    clone.style.margin = '0';
    clone.classList.add('is-export');
    host.appendChild(clone);
    document.body.appendChild(host);
    try {
      staticify(paper, clone);
      clone.querySelectorAll('.no-export').forEach(n => n.remove());
      if (fallbackSeal) {
        clone.querySelectorAll('img').forEach(img => { if (img.src.indexOf('data:') !== 0) img.src = UI.SEAL; });
      }
      await imagesReady(clone);
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const rect = clone.getBoundingClientRect();
      const scale = rect.height > 4500 ? 2 : 2.5;
      const canvas = await html2canvas(clone, { scale: scale, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const k = canvas.width / rect.width;
      return { canvas: canvas, edges: safeEdges(clone, rect).map(e => Math.round(e * k)) };
    } finally {
      host.remove();
    }
  }

  /* A tainted canvas (image loaded from file://) cannot be exported. */
  function assertClean(canvas) {
    const t = document.createElement('canvas');
    t.width = t.height = 1;
    t.getContext('2d').drawImage(canvas, 0, 0, 1, 1, 0, 0, 1, 1);
    t.toDataURL();
  }

  function planPages(total, edges, pageH, mt, mb) {
    const pages = [];
    let cursor = 0;
    while (cursor < total - 1) {
      const top = pages.length ? mt : 0;
      if (total - cursor <= pageH - top) { pages.push({ start: cursor, end: total, top: top }); break; }
      const target = cursor + (pageH - top - mb);
      let cut = null;
      for (let i = 0; i < edges.length; i++) {
        if (edges[i] > cursor && edges[i] <= target) cut = edges[i];
      }
      if (cut === null) cut = target; // a single block taller than a page: hard cut
      pages.push({ start: cursor, end: cut, top: top });
      cursor = cut;
    }
    return pages;
  }

  function composePage(canvas, p, pageH) {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = pageH;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(canvas, 0, p.start, canvas.width, p.end - p.start, 0, p.top, canvas.width, p.end - p.start);
    return c;
  }

  function download(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const safeName = s => (String(s || '').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_')) || 'LSPD-Report';

  async function run(format, paper, opts) {
    opts = opts || {};
    if (format === 'print') { window.print(); return { pages: 0 }; }
    if (typeof html2canvas === 'undefined') throw new Error('Export libraries did not load. Check your internet connection and reload.');

    let cap, usedFallback = false;
    try {
      cap = await capture(paper, false);
      assertClean(cap.canvas);
    } catch (e) {
      if (e && (e.name === 'SecurityError' || /tainted/i.test(e.message || ''))) {
        cap = await capture(paper, true);
        usedFallback = true;
      } else { throw e; }
    }

    const canvas = cap.canvas;
    const pageH = Math.round(canvas.width * A4_RATIO);
    const mm = canvas.width / 210;
    const pages = planPages(canvas.height, cap.edges, pageH, Math.round(9 * mm), Math.round(9 * mm));
    const base = safeName(opts.baseName);

    if (format === 'pdf') {
      if (!g.jspdf) throw new Error('PDF library did not load. Check your internet connection and reload.');
      const pdf = new g.jspdf.jsPDF('p', 'mm', 'a4');
      pages.forEach((p, i) => {
        if (i) pdf.addPage();
        pdf.addImage(composePage(canvas, p, pageH).toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
      });
      pdf.save(base + '.pdf');
    } else {
      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
      for (let i = 0; i < pages.length; i++) {
        const url = composePage(canvas, pages[i], pageH).toDataURL(mime, format === 'jpg' ? 0.93 : undefined);
        download(url, base + (pages.length > 1 ? '-' + String(i + 1).padStart(2, '0') : '') + '.' + format);
        if (i < pages.length - 1) await wait(350);
      }
    }
    return { pages: pages.length, usedFallback: usedFallback };
  }

  g.Exporter = { run: run, planPages: planPages };
})(window);

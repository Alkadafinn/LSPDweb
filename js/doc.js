/* LSPD RMS - shared report editor shell.
 *
 * Incident and surveillance reports are both "documents": a paper form that
 * autosaves to local storage, can be filed, exported and deleted. This file
 * owns everything they have in common; each report module only supplies its
 * paper markup, defaults and custom behaviour. */
(function (g) {
  'use strict';

  const esc = UI.esc, icon = UI.icon, $ = UI.$, $$ = UI.$$;
  const PAPER_W = 794;

  /* ---------- paper building blocks ---------- */
  function header(formTitle) {
    return '<header class="p-head" data-blk>' +
      '<img class="p-seal" src="assets/LSPD-SEALS.png" alt="LSPD seal" onerror="this.onerror=null;this.src=UI.SEAL">' +
      '<div class="p-title"><div class="p-city">CITY OF LOS SANTOS</div><div class="p-dept">LOS SANTOS POLICE DEPARTMENT</div>' +
      '<div class="p-form">' + esc(formTitle) + '</div></div>' +
      '<div class="p-ofo">FOR OFFICIAL<br>USE ONLY</div></header>' +
      '<div class="p-sub" data-blk><span>State of San Andreas</span><span>Record Management System</span></div>';
  }
  function footer(left) {
    return '<footer class="p-foot" data-blk><span>' + esc(left) + '</span><span>FOR OFFICIAL USE ONLY</span></footer>';
  }
  const cell = (span, label, control, extra) =>
    '<label class="p-cell s' + span + (extra ? ' ' + extra : '') + '"><span class="p-lab">' + label + '</span>' + control + '</label>';
  const input = (f, o) => {
    o = o || {};
    return '<input type="' + (o.type || 'text') + '" data-f="' + f + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') +
      (o.list ? ' list="' + o.list + '"' : '') + ' autocomplete="off">';
  };
  const roInput = prop => '<input type="text" data-r="' + prop + '" readonly tabindex="-1">';
  const select = (f, opts) =>
    '<select data-f="' + f + '">' + opts.map(o => '<option value="' + esc(o) + '">' + esc(o || '\u2014') + '</option>').join('') + '</select>';
  const textarea = (f, o) => {
    o = o || {};
    return '<textarea data-f="' + f + '" spellcheck="true"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') +
      ' style="min-height:' + (o.min || 60) + 'px"></textarea>';
  };
  const signBox = (id, label, dateField) =>
    '<div class="p-sign-box"><div class="p-sign-name empty" id="' + id + '"></div><div class="p-sign-line">' + label + '</div>' +
    '<label class="p-sign-date"><span>Date</span><input type="date" data-f="' + dateField + '"></label></div>';
  const signGrid = (a, b) => '<div class="p-sign" data-blk>' + a + b + '</div>';
  function setSignature(el, name, placeholder) {
    if (!el) return;
    el.textContent = name || placeholder;
    el.classList.toggle('empty', !name);
  }

  /* ---------- editor factory ---------- */
  function create(cfg) {
    let S = null;

    function mount(view, params) {
      const id = params.id;
      let rec = null, persisted = false;
      if (id === 'new') rec = cfg.blank();
      else { rec = cfg.api.get(id); persisted = !!rec; }

      if (!rec) {
        view.innerHTML = '<div class="panel"><div class="empty"><strong>Record not found</strong>' +
          '<p>It may have been deleted, or it was created in a different browser or device.</p>' +
          '<a class="btn btn-primary" href="' + cfg.listHref + '">Back to ' + cfg.listLabel.toLowerCase() + '</a></div></div>';
        document.title = 'Record not found | LSPD RMS';
        return;
      }

      S = { rec: rec, persisted: persisted, touched: false, dirty: false, timer: null, warned: false, cleanups: [] };

      view.innerHTML =
        '<div class="doc-bar">' +
          '<a class="btn btn-sm" href="' + cfg.listHref + '">' + icon('back') + ' ' + esc(cfg.listLabel) + '</a>' +
          '<span class="pill" id="docStatus"></span>' +
          '<span class="doc-ref" id="docRef"></span>' +
          '<span class="save-ind" id="docInd" role="status"></span>' +
          '<span class="doc-spacer"></span>' +
          '<button type="button" class="btn btn-sm" id="docFile"></button>' +
          '<div class="menu-wrap">' +
            '<button type="button" class="btn btn-sm" id="docExport" aria-haspopup="true" aria-expanded="false">' + icon('download') + ' Export ' + icon('chevron') + '</button>' +
            '<div class="menu" id="docMenu" hidden>' +
              '<button type="button" data-exp="pdf">PDF document (A4)</button>' +
              '<button type="button" data-exp="jpg">JPG images (A4 per page)</button>' +
              '<button type="button" data-exp="png">PNG images (A4 per page)</button>' +
              '<button type="button" data-exp="print">Print</button>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-sm btn-danger" id="docDelete"' + (persisted ? '' : ' hidden') + '>' + icon('trash') + ' Delete</button>' +
        '</div>' +
        '<div class="desk" id="desk"><div class="paper-fit" id="paperFit">' + cfg.paperHTML(rec) + '</div></div>' +
        '<input type="file" id="attachInput" hidden>';

      const paper = $('.paper', view);
      const ctx = { rec: rec, paper: paper, view: view, markDirty: markDirty, save: save };
      S.ctx = ctx;
      S.paper = paper;

      /* fill controls from the record */
      $$('[data-r]', paper).forEach(el => { el.value = rec[el.dataset.r] || ''; });
      if (cfg.beforeHydrate) cfg.beforeHydrate(ctx);
      $$('[data-f]', paper).forEach(el => {
        const v = rec.data[el.dataset.f];
        if (el.type === 'checkbox') el.checked = !!v;
        else el.value = v == null ? '' : v;
        if (el.tagName === 'SELECT' && el.selectedIndex < 0) el.selectedIndex = 0;
      });
      if (cfg.setup) cfg.setup(ctx);
      UI.autosizeAll(paper);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (S && S.paper === paper) UI.autosizeAll(paper); });

      refreshChrome();
      setInd(persisted ? 'saved' : 'new');
      document.title = cfg.title + ' ' + cfg.refText(rec) + ' | LSPD RMS';
      if (persisted) Records.touch(cfg.kind, rec);

      /* generic field binding */
      const onField = e => {
        const el = e.target;
        if (!el.dataset || !el.dataset.f) return;
        rec.data[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
        if (el.tagName === 'TEXTAREA') UI.autosize(el);
        markDirty();
        if (cfg.onField) cfg.onField(ctx, el.dataset.f, el);
      };
      paper.addEventListener('input', onField);
      paper.addEventListener('change', onField);

      /* toolbar */
      $('#docFile').addEventListener('click', () => {
        rec.status = rec.status === 'filed' ? 'draft' : 'filed';
        if (rec.status === 'filed') rec.filedAt = new Date().toISOString();
        S.touched = true; S.dirty = true;
        if (save()) UI.toast(rec.status === 'filed' ? 'Report filed to local records.' : 'Report reopened as a draft.');
        refreshChrome();
      });

      $('#docDelete').addEventListener('click', async () => {
        const ok = await UI.confirmBox({
          title: 'Delete this report?',
          message: 'This permanently removes it from this browser. This cannot be undone.',
          confirmText: 'Delete report', danger: true
        });
        if (!ok) return;
        clearTimeout(S.timer);
        S.dirty = false;
        cfg.api.remove(rec.id);
        UI.toast('Report deleted.');
        location.hash = cfg.listHref;
      });

      const menu = $('#docMenu'), toggle = $('#docExport');
      const closeMenu = () => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
      toggle.addEventListener('click', e => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
        toggle.setAttribute('aria-expanded', String(!menu.hidden));
      });
      const docClick = e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); };
      const docKey = e => { if (e.key === 'Escape') closeMenu(); };
      document.addEventListener('click', docClick);
      document.addEventListener('keydown', docKey);
      S.cleanups.push(() => { document.removeEventListener('click', docClick); document.removeEventListener('keydown', docKey); });

      menu.addEventListener('click', async e => {
        const b = e.target.closest('[data-exp]');
        if (!b) return;
        closeMenu();
        save();
        const fmt = b.dataset.exp;
        if (fmt === 'print') { window.print(); return; }
        const label = toggle.innerHTML;
        toggle.disabled = true;
        toggle.textContent = 'Exporting...';
        try {
          const r = await Exporter.run(fmt, paper, { baseName: cfg.fileBase(rec) });
          UI.toast(r.usedFallback
            ? 'Exported with a generic seal. The seal image cannot be embedded when the app is opened from a local file.'
            : 'Export complete (' + r.pages + (r.pages === 1 ? ' page' : ' pages') + ').');
        } catch (err) {
          console.error(err);
          UI.toast('Export failed: ' + err.message, 'error', 6500);
        } finally {
          toggle.disabled = false;
          toggle.innerHTML = label;
        }
      });

      /* fit the A4 sheet to narrow screens without changing its layout */
      const fitEl = $('#paperFit'), desk = $('#desk');
      const fit = () => {
        if (!S || S.paper !== paper) return;
        const avail = desk.clientWidth - (window.innerWidth < 700 ? 16 : 48);
        const s = Math.max(0.3, Math.min(1, avail / PAPER_W));
        paper.style.transform = s < 1 ? 'scale(' + s + ')' : '';
        fitEl.style.width = (PAPER_W * s) + 'px';
        fitEl.style.height = (paper.offsetHeight * s) + 'px';
      };
      fit();
      window.addEventListener('resize', fit);
      S.cleanups.push(() => window.removeEventListener('resize', fit));
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(fit);
        ro.observe(paper);
        S.cleanups.push(() => ro.disconnect());
      }

      const onHide = () => save();
      window.addEventListener('pagehide', onHide);
      S.cleanups.push(() => window.removeEventListener('pagehide', onHide));
    }

    function setInd(state) {
      const el = $('#docInd');
      if (!el) return;
      const t = UI.nowHM();
      const map = {
        new: 'Not saved yet. Saved automatically once you start typing.',
        pending: 'Unsaved changes',
        saved: 'Saved on this device at ' + t,
        full: 'Storage full. Not saved.',
        error: 'Could not save'
      };
      el.className = 'save-ind is-' + state;
      el.textContent = map[state] || '';
    }

    function refreshChrome() {
      if (!S) return;
      const rec = S.rec;
      const st = $('#docStatus');
      if (st) { st.textContent = rec.status === 'filed' ? 'Filed' : 'Draft'; st.className = 'pill pill-' + rec.status; }
      const fb = $('#docFile');
      if (fb) {
        fb.innerHTML = rec.status === 'filed' ? 'Reopen as draft' : icon('check') + ' File report';
        fb.className = 'btn btn-sm' + (rec.status === 'filed' ? '' : ' btn-primary');
      }
      const ref = $('#docRef');
      if (ref) ref.textContent = cfg.refText(rec);
    }

    function markDirty() {
      if (!S) return;
      S.touched = true;
      S.dirty = true;
      setInd('pending');
      const ref = $('#docRef');
      if (ref) ref.textContent = cfg.refText(S.rec);
      clearTimeout(S.timer);
      S.timer = setTimeout(save, 700);
    }

    function save() {
      if (!S) return true;
      clearTimeout(S.timer);
      if (!S.dirty) return true;
      if (!S.persisted && !S.touched) return true;
      const res = cfg.api.save(S.rec);
      if (!res.ok) {
        setInd(res.quota ? 'full' : 'error');
        if (!S.warned) {
          UI.toast(res.quota
            ? 'Browser storage is full. Remove large attachments or export a backup, then try again.'
            : 'This report could not be saved to browser storage.', 'error', 7000);
          S.warned = true;
        }
        return false;
      }
      Object.assign(S.rec, res.record);
      S.dirty = false;
      S.warned = false;
      if (!S.persisted) {
        S.persisted = true;
        history.replaceState(null, '', cfg.hrefFor(S.rec.id));
        const del = $('#docDelete');
        if (del) del.hidden = false;
      }
      Records.touch(cfg.kind, S.rec);
      setInd('saved');
      refreshChrome();
      return true;
    }

    function unmount() {
      if (!S) return;
      save();
      S.cleanups.forEach(fn => fn());
      S = null;
    }

    return { mount: mount, unmount: unmount };
  }

  g.Doc = {
    create: create, header: header, footer: footer, cell: cell, input: input, roInput: roInput,
    select: select, textarea: textarea, signBox: signBox, signGrid: signGrid, setSignature: setSignature
  };
})(window);

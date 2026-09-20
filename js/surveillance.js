/* LSPD RMS - Surveillance Report */
(function (g) {
  'use strict';

  const esc = UI.esc, icon = UI.icon, $ = UI.$, $$ = UI.$$;
  const D = Doc;

  const EV_TYPES = ['Photo', 'Text', 'Video Reference', 'Audio Recording', 'Document'];

  const rand6 = () => Math.floor(Math.random() * 900000) + 100000;
  const genURN = () => new Date().getFullYear() + '-' + rand6();
  const genDR = () => String(new Date().getFullYear()).slice(-2) + '-' + rand6();

  function nextReportNumber() {
    const y = new Date().getFullYear();
    let max = 0;
    Store.getSurveillance().forEach(r => {
      const m = /^SR-(\d{4})-(\d+)$/.exec((r.data && r.data.reportNumber) || '');
      if (m && +m[1] === y) max = Math.max(max, +m[2]);
    });
    return 'SR-' + y + '-' + String(max + 1).padStart(4, '0');
  }

  const newEvidence = () => ({ id: Store.uid(), type: 'Photo', title: '', desc: '', att: null });
  const newInfo = () => ({ id: Store.uid(), title: '', desc: '', att: null });

  function blank() {
    const o = Store.getSettings().officer;
    return {
      id: Store.uid(), kind: 'surveillance', status: 'draft',
      evidence: [newEvidence()], info: [newInfo()],
      data: {
        reportNumber: nextReportNumber(), date: UI.todayISO(), time: UI.nowHM(), operationName: '',
        dr: genDR(), urn: genURN(), officers: o.name, reportingOfficer: o.name, supervisor: o.supervisor
      }
    };
  }

  function paperHTML() {
    const c = D.cell, i = D.input, t = D.textarea;
    const narr = (f, label, min, ph) =>
      '<div class="p-narr" data-blk><div class="p-narr-lab">' + label + '</div>' + t(f, { min: min, ph: ph }) + '</div>';
    return '<article class="paper">' +
      D.header('SURVEILLANCE REPORT') +

      '<section class="p-sec" data-blk><div class="p-sec-title">REPORT INFORMATION</div><div class="p-grid">' +
        c(6, 'Report number', i('reportNumber', { ph: 'SR-2026-0001' })) + c(3, 'Date', i('date', { type: 'date' })) + c(3, 'Time', i('time', { type: 'time' })) +
        c(6, 'Operation name', i('operationName', { ph: 'e.g. Operation Nightfall' })) + c(3, 'DR number', i('dr', { ph: 'DR#' })) + c(3, 'URN', i('urn', { ph: 'Reference number' })) +
        c(12, 'Officer(s) assigned <em class="p-hint">one name per line</em>', t('officers', { min: 52, ph: 'Det. P. HyungJae\nDet. John Carter\nOfficer William Fox' })) +
        c(6, 'Reporting officer <em class="p-hint">signs this report</em>', '<select data-f="reportingOfficer" id="fReportingOfficer"></select>') +
        c(6, 'Supervisor', i('supervisor', { ph: 'Sgt. / Lt. name' })) +
        c(6, 'Surveillance location', i('location', { ph: 'Address / coordinates' })) + c(6, 'Target organization / subject', i('target', { ph: 'Name / alias / organization' })) +
        c(12, 'Investigation type', i('investigationType', { ph: 'Narcotics, organized crime, homicide, etc.' })) +
      '</div></section>' +

      '<div class="p-sec-title p-gap" data-blk data-keepnext>NARRATIVE AND FINDINGS</div>' +
      narr('reason', 'Reason for surveillance', 64, 'State the justification and authorization for this surveillance operation.') +
      narr('narrative', 'Narrative', 130, 'Give a full chronological account of the surveillance operation.') +
      narr('observations', 'Observations', 100, 'Direct observations, subject movements, contacts and behaviors.') +
      narr('conclusion', 'Conclusion', 80, 'Summarize findings and recommended follow-up actions.') +

      '<section class="p-sec"><div class="p-sec-title" data-blk data-keepnext>EVIDENCE LOG<small>Photos, notes, references and recordings</small></div>' +
        '<div class="p-entries" id="evEntries"></div>' +
        '<div class="p-add-row no-export"><button type="button" class="p-btn" id="addEv">' + icon('plus') + ' Add evidence</button></div></section>' +

      '<section class="p-sec"><div class="p-sec-title" data-blk data-keepnext>ADDITIONAL INFORMATION</div>' +
        '<div class="p-entries" id="inEntries"></div>' +
        '<div class="p-add-row no-export"><button type="button" class="p-btn" id="addIn">' + icon('plus') + ' Add information</button></div></section>' +

      D.signGrid(D.signBox('sigOfficer', 'REPORTING OFFICER SIGNATURE', 'sigOfficerDate'), D.signBox('sigSupervisor', 'SUPERVISOR REVIEW SIGNATURE', 'sigSupervisorDate')) +
      D.footer('Los Santos Police Department, Department Report') +
    '</article>';
  }

  /* ---------- entries (evidence / additional information) ---------- */
  function attachHTML(e) {
    const a = e.att;
    if (!a) {
      return '<div class="p-attach no-export"><span class="p-lab">Attachment' + (e.type === undefined ? ' (optional)' : '') + '</span>' +
        '<button type="button" class="p-btn" data-act="attach">' + icon('clip') + ' Choose file</button></div>';
    }
    const actions = '<span class="p-att-actions no-export"><button type="button" class="p-btn p-btn-sm" data-act="attach">Replace</button>' +
      '<button type="button" class="p-btn p-btn-sm" data-act="detach">Remove</button></span>';
    if (a.dataUrl) {
      return '<figure class="p-figure"><img src="' + a.dataUrl + '" alt="' + esc(a.name) + '"><figcaption>' + esc(a.name) + actions + '</figcaption></figure>';
    }
    return '<div class="p-filebadge">Attached file: ' + esc(a.name) + ' (' + UI.fmtBytes(a.size || 0) + ')' + actions +
      '<span class="p-note no-export">File contents are not stored in this browser, only the name.</span></div>';
  }

  function entryHTML(kind, e) {
    const ev = kind === 'ev';
    return '<div class="p-entry" data-blk data-kind="' + kind + '" data-eid="' + esc(e.id) + '">' +
      '<div class="p-entry-top">' +
        (ev ? '<div class="p-ef p-ef-type"><span class="p-lab">Evidence type</span><select data-k="type" aria-label="Evidence type">' +
          EV_TYPES.map(t => '<option' + (t === e.type ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div>' : '') +
        '<div class="p-ef p-ef-grow"><span class="p-lab">' + (ev ? 'Evidence title' : 'Title') + '</span>' +
          '<input type="text" data-k="title" value="' + esc(e.title) + '" aria-label="Title" placeholder="' +
          (ev ? 'e.g. Suspect vehicle photograph' : 'e.g. Informant statement') + '"></div>' +
        '<button type="button" class="p-x-btn no-export" data-act="remove">Remove</button>' +
      '</div>' +
      '<span class="p-lab">Description</span>' +
      '<textarea data-k="desc" spellcheck="true" style="min-height:56px" placeholder="' +
        (ev ? 'Describe this piece of evidence in detail.' : 'Additional information relevant to the case.') + '"></textarea>' +
      attachHTML(e) +
    '</div>';
  }

  function renderEntries(ctx, kind) {
    const list = kind === 'ev' ? ctx.rec.evidence : ctx.rec.info;
    const host = $(kind === 'ev' ? '#evEntries' : '#inEntries', ctx.paper);
    host.innerHTML = list.map(e => entryHTML(kind, e)).join('');
    $$('.p-entry', host).forEach((box, idx) => {
      const ta = $('textarea', box);
      ta.value = list[idx].desc || '';
      UI.autosize(ta);
    });
  }

  function findEntry(ctx, box) {
    const list = box.dataset.kind === 'ev' ? ctx.rec.evidence : ctx.rec.info;
    return list.find(x => x.id === box.dataset.eid);
  }

  /* ---------- officers / signatures ---------- */
  function refreshOfficers(ctx) {
    const lines = (ctx.rec.data.officers || '').split('\n').map(s => s.trim()).filter(Boolean);
    const sel = $('#fReportingOfficer', ctx.paper);
    const prev = ctx.rec.data.reportingOfficer || '';
    sel.innerHTML = '<option value="">' + (lines.length ? 'Select reporting officer' : 'Add officer names above first') + '</option>' +
      lines.map(n => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
    if (lines.indexOf(prev) >= 0) sel.value = prev;
    else { sel.value = ''; ctx.rec.data.reportingOfficer = ''; }
  }
  function updateSignatures(ctx) {
    D.setSignature($('#sigOfficer', ctx.paper), ctx.rec.data.reportingOfficer, 'Select reporting officer above');
    D.setSignature($('#sigSupervisor', ctx.paper), ctx.rec.data.supervisor, 'Enter supervisor above');
  }

  const view = Doc.create({
    kind: 'surveillance',
    title: 'Surveillance Report',
    listHref: '#/surveillance',
    listLabel: 'Surveillance reports',
    hrefFor: id => '#/surveillance/' + id,
    api: { get: Store.getSurveillanceReport, save: Store.saveSurveillance, remove: Store.deleteSurveillance },
    blank: blank,
    paperHTML: paperHTML,
    refText: rec => rec.data.reportNumber || 'New report',
    fileBase: rec => rec.data.reportNumber || 'LSPD_Surveillance_Report',

    beforeHydrate(ctx) {
      if (!ctx.rec.evidence) ctx.rec.evidence = [];
      if (!ctx.rec.info) ctx.rec.info = [];
      refreshOfficers(ctx); // options must exist before the select value is restored
    },

    setup(ctx) {
      const paper = ctx.paper;
      const fileInput = $('#attachInput', ctx.view);
      let pending = null;

      renderEntries(ctx, 'ev');
      renderEntries(ctx, 'in');
      updateSignatures(ctx);

      $('#addEv', paper).addEventListener('click', () => {
        ctx.rec.evidence.push(newEvidence());
        renderEntries(ctx, 'ev');
        ctx.markDirty();
        const boxes = $$('#evEntries .p-entry', paper);
        const last = boxes[boxes.length - 1];
        if (last) { last.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('input', last).focus({ preventScroll: true }); }
      });
      $('#addIn', paper).addEventListener('click', () => {
        ctx.rec.info.push(newInfo());
        renderEntries(ctx, 'in');
        ctx.markDirty();
        const boxes = $$('#inEntries .p-entry', paper);
        const last = boxes[boxes.length - 1];
        if (last) { last.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('input', last).focus({ preventScroll: true }); }
      });

      const onEntryInput = e => {
        const el = e.target, k = el.dataset && el.dataset.k;
        if (!k) return;
        const box = el.closest('.p-entry');
        const ent = box && findEntry(ctx, box);
        if (!ent) return;
        ent[k] = el.value;
        if (el.tagName === 'TEXTAREA') UI.autosize(el);
        ctx.markDirty();
      };
      paper.addEventListener('input', onEntryInput);
      paper.addEventListener('change', onEntryInput);

      paper.addEventListener('click', async e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const box = b.closest('.p-entry');
        if (!box) return;
        const kind = box.dataset.kind;
        const ent = findEntry(ctx, box);
        if (!ent) return;
        const act = b.dataset.act;
        if (act === 'remove') {
          const ok = await UI.confirmBox({ title: 'Remove this entry?', message: 'The entry and its attachment will be removed from this report.', confirmText: 'Remove entry', danger: true });
          if (!ok) return;
          if (kind === 'ev') ctx.rec.evidence = ctx.rec.evidence.filter(x => x.id !== ent.id);
          else ctx.rec.info = ctx.rec.info.filter(x => x.id !== ent.id);
          renderEntries(ctx, kind);
          ctx.markDirty();
        } else if (act === 'detach') {
          ent.att = null;
          renderEntries(ctx, kind);
          ctx.markDirty();
        } else if (act === 'attach') {
          pending = { kind: kind, id: ent.id };
          fileInput.accept = (kind === 'ev' && ent.type === 'Photo') ? 'image/*' : '';
          fileInput.value = '';
          fileInput.click();
        }
      });

      fileInput.addEventListener('change', async () => {
        const f = fileInput.files && fileInput.files[0];
        const p = pending;
        pending = null;
        if (!f || !p) return;
        const list = p.kind === 'ev' ? ctx.rec.evidence : ctx.rec.info;
        const ent = list.find(x => x.id === p.id);
        if (!ent) return;
        try {
          if (f.type.indexOf('image/') === 0) {
            const dataUrl = await UI.readImage(f);
            ent.att = { name: f.name, type: 'image/jpeg', size: f.size, dataUrl: dataUrl };
          } else {
            ent.att = { name: f.name, type: f.type, size: f.size, dataUrl: null };
            UI.toast('Only the file name is recorded. Images are the only attachments stored in the browser.');
          }
          renderEntries(ctx, p.kind);
          ctx.markDirty();
        } catch (err) {
          UI.toast(err.message || 'The file could not be attached.', 'error');
        }
        fileInput.value = '';
      });
    },

    onField(ctx, f) {
      if (f === 'officers') { refreshOfficers(ctx); updateSignatures(ctx); }
      if (f === 'reportingOfficer' || f === 'supervisor') updateSignatures(ctx);
    }
  });

  g.Surveillance = { view: view, blank: blank };
})(window);

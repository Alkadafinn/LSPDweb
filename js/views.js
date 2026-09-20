/* LSPD RMS - dashboard, record lists and settings */
(function (g) {
  'use strict';

  const esc = UI.esc, icon = UI.icon, $ = UI.$, $$ = UI.$$;
  const APP_VERSION = '1.0.0';

  const pill = s => '<span class="pill pill-' + esc(s) + '">' + (s === 'filed' ? 'Filed' : s === 'draft' ? 'Draft' : 'Saved') + '</span>';
  const kindTag = k => '<span class="kind">' + icon(Records.KIND_ICON[k]) + ' ' + esc(Records.KIND_LABEL[k]) + '</span>';

  function rowsTable(rows, opts) {
    opts = opts || {};
    if (!rows.length) return opts.empty || '<div class="empty"><strong>No records</strong></div>';
    return '<div class="tbl-wrap"><table class="tbl tbl-rows"><thead><tr>' +
      (opts.compact ? '' : '<th>Type</th>') + '<th>Reference</th><th>Title</th>' +
      (opts.compact ? '' : '<th>Officer</th><th>Date</th>') + '<th>Status</th><th>Updated</th>' +
      (opts.actions ? '<th class="col-act"><span class="sr">Actions</span></th>' : '') + '</tr></thead><tbody>' +
      rows.map(r =>
        '<tr>' + (opts.compact ? '' : '<td>' + kindTag(r.kind) + '</td>') +
        '<td class="mono">' + esc(r.ref || '\u2014') + '</td>' +
        '<td><a class="row-link" href="' + esc(r.href) + '">' + esc(r.title) + '</a></td>' +
        (opts.compact ? '' : '<td>' + esc(r.officer || '\u2014') + '</td><td class="mono">' + esc(UI.fmtDate(r.date) || '\u2014') + '</td>') +
        '<td>' + pill(r.status) + '</td><td class="muted">' + esc(UI.fmtStamp(r.updatedAt)) + '</td>' +
        (opts.actions ? '<td class="col-act"><a class="btn btn-sm" href="' + esc(r.href) + '">Open</a> ' +
          '<button type="button" class="btn btn-sm btn-danger" data-del="' + r.kind + ':' + esc(r.id) + '" aria-label="Delete ' + esc(r.title) + '">' + icon('trash') + '</button></td>' : '') +
        '</tr>').join('') + '</tbody></table></div>';
  }

  /* ---------- dashboard ---------- */
  const dashboard = {
    mount(el) {
      const inc = Store.getIncidents(), sur = Store.getSurveillance(), pen = Store.getPenalCalculations();
      const count = (arr, st) => arr.filter(r => r.status === st).length;
      const drafts = count(inc, 'draft') + count(sur, 'draft');
      const o = Store.getSettings().officer;
      const u = Store.usage();
      const recent = Records.recent(8);

      const who = o.name
        ? esc(o.name) + (o.badge ? ', badge ' + esc(o.badge) : '') + (o.unit ? ', unit ' + esc(o.unit) : '')
        : 'Add your officer details in <a href="#/settings">Settings</a> to prefill new reports.';

      el.innerHTML =
        '<div class="page-head"><div><h1>Dashboard</h1><p>' + who + '</p></div></div>' +
        '<div class="stats">' +
          '<a class="stat" href="#/incident"><span class="stat-label">Incident reports</span><strong>' + inc.length + '</strong><span class="stat-sub">' + count(inc, 'filed') + ' filed, ' + count(inc, 'draft') + ' draft</span></a>' +
          '<a class="stat" href="#/surveillance"><span class="stat-label">Surveillance reports</span><strong>' + sur.length + '</strong><span class="stat-sub">' + count(sur, 'filed') + ' filed, ' + count(sur, 'draft') + ' draft</span></a>' +
          '<a class="stat" href="#/records?status=draft"><span class="stat-label">Open drafts</span><strong>' + drafts + '</strong><span class="stat-sub">Reports not yet filed</span></a>' +
          '<a class="stat" href="#/records?type=penal"><span class="stat-label">Saved calculations</span><strong>' + pen.length + '</strong><span class="stat-sub">From the penal calculator</span></a>' +
        '</div>' +
        '<div class="dash-grid">' +
          '<section class="panel"><div class="panel-head"><h2>Recent records</h2><a class="btn btn-sm head-act" href="#/records">All records</a></div>' +
            rowsTable(recent, { compact: false, empty: '<div class="empty"><strong>No records yet</strong><p>Start with a new incident report. Reports you open or save appear here.</p><a class="btn btn-primary" href="#/incident/new">New incident report</a></div>' }) +
          '</section>' +
          '<div class="dash-side">' +
            '<section class="panel"><div class="panel-head"><h2>Start a record</h2></div>' +
              '<a class="action" href="#/incident/new"><span class="action-ic">' + icon('incident') + '</span><span><strong>New incident report</strong><span class="sub">Form PD-R-49 with penal code charges</span></span></a>' +
              '<a class="action" href="#/surveillance/new"><span class="action-ic">' + icon('eye') + '</span><span><strong>New surveillance report</strong><span class="sub">Narrative, evidence log and attachments</span></span></a>' +
              '<a class="action" href="#/penal"><span class="action-ic">' + icon('calc') + '</span><span><strong>Penal calculator</strong><span class="sub">Fines and jail time for a list of codes</span></span></a>' +
            '</section>' +
            '<section class="panel"><div class="panel-head"><h2>System status</h2></div>' +
              '<table class="kv"><tbody>' +
                '<tr><th>Storage mode</th><td>LOCAL</td></tr>' +
                '<tr><th>Database</th><td>BROWSER LOCAL STORAGE</td></tr>' +
                '<tr><th>Server sync</th><td>DISABLED</td></tr>' +
                '<tr><th>Space used</th><td>' + UI.fmtBytes(u.bytes) + '</td></tr>' +
              '</tbody></table></section>' +
          '</div>' +
        '</div>';
      document.title = 'Dashboard | LSPD RMS';
    },
    unmount() {}
  };

  /* ---------- records / report lists ---------- */
  function recordsView(fixedKind) {
    let root = null, query = {};

    function draw() {
      const kinds = fixedKind ? [fixedKind] : null;
      const q = ($('#fText', root).value || '').trim().toLowerCase();
      const type = fixedKind || ($('#fType', root) ? $('#fType', root).value : '');
      const status = $('#fStatus', root).value;
      let rows = Records.all(kinds);
      if (type) rows = rows.filter(r => r.kind === type);
      if (status) rows = rows.filter(r => r.status === status);
      if (q) rows = rows.filter(r => [r.ref, r.title, r.officer, r.date].join(' ').toLowerCase().indexOf(q) >= 0);
      $('#recCount', root).textContent = rows.length + (rows.length === 1 ? ' record' : ' records');
      const label = fixedKind ? Records.KIND_LABEL[fixedKind].toLowerCase() + 's' : 'records';
      $('#recTable', root).innerHTML = rowsTable(rows, {
        actions: true, compact: !!fixedKind,
        empty: '<div class="empty"><strong>No ' + label + ' found</strong><p>' +
          (q || status || (type && !fixedKind) ? 'Try clearing the search or filters.' : 'Nothing has been saved in this browser yet.') + '</p>' +
          (fixedKind && fixedKind !== 'penal' ? '<a class="btn btn-primary" href="#/' + fixedKind + '/new">New ' + Records.KIND_LABEL[fixedKind].toLowerCase() + '</a>' : '') + '</div>'
      });
    }

    return {
      mount(el, params, qs) {
        root = el; query = qs || {};
        const titles = { incident: 'Incident reports', surveillance: 'Surveillance reports' };
        const title = fixedKind ? titles[fixedKind] : (query.status === 'draft' ? 'Drafts' : 'All records');
        const sub = fixedKind ? 'Reports saved in this browser.' : 'Every report and saved calculation stored in this browser.';
        el.innerHTML =
          '<div class="page-head"><div><h1>' + title + '</h1><p>' + sub + '</p></div>' +
          (fixedKind ? '<div class="actions"><a class="btn btn-primary" href="#/' + fixedKind + '/new">' + icon('plus') + ' New ' + Records.KIND_LABEL[fixedKind].toLowerCase() + '</a></div>' : '') + '</div>' +
          '<section class="panel"><div class="filters">' +
            '<label class="search"><span class="sr">Search records</span>' + icon('search') + '<input id="fText" class="input" type="search" placeholder="Search reference, title, officer or date"></label>' +
            (fixedKind ? '' : '<label><span class="sr">Type</span><select id="fType" class="select"><option value="">All types</option><option value="incident">Incident reports</option><option value="surveillance">Surveillance reports</option><option value="penal">Penal calculations</option></select></label>') +
            '<label><span class="sr">Status</span><select id="fStatus" class="select"><option value="">All statuses</option><option value="draft">Draft</option><option value="filed">Filed</option>' + (fixedKind ? '' : '<option value="saved">Saved</option>') + '</select></label>' +
            '<span class="tag" id="recCount"></span></div>' +
            '<div id="recTable"></div></section>';
        if (query.status) $('#fStatus', el).value = query.status;
        if (query.type && $('#fType', el)) $('#fType', el).value = query.type;
        $$('input,select', $('.filters', el)).forEach(n => { n.addEventListener('input', draw); n.addEventListener('change', draw); });
        $('#recTable', el).addEventListener('click', async e => {
          const b = e.target.closest('[data-del]');
          if (!b) return;
          const parts = b.dataset.del.split(':'), kind = parts[0], id = parts.slice(1).join(':');
          const ok = await UI.confirmBox({ title: 'Delete this record?', message: 'It will be permanently removed from this browser. This cannot be undone.', confirmText: 'Delete', danger: true });
          if (!ok) return;
          Records.remove(kind, id);
          UI.toast('Record deleted.');
          draw();
        });
        draw();
        document.title = title + ' | LSPD RMS';
      },
      unmount() { root = null; }
    };
  }

  /* ---------- settings ---------- */
  const settings = {
    mount(el) {
      const s = Store.getSettings(), o = s.officer;
      const fld = (id, label, val, ph) => '<label class="field"><span class="lbl">' + label + '</span><input class="input" id="' + id + '" value="' + esc(val) + '" placeholder="' + esc(ph || '') + '" autocomplete="off"></label>';
      el.innerHTML =
        '<div class="page-head"><div><h1>Settings</h1><p>Officer details, appearance and local data management.</p></div></div>' +
        '<div class="settings-grid">' +
          '<section class="panel"><div class="panel-head"><h2>Officer information</h2></div>' +
            '<form id="offForm" class="panel-body"><p class="hint">Used to prefill the reporting officer on new reports.</p><div class="form-grid">' +
              fld('sName', 'Name', o.name, 'Lastname, Firstname') + fld('sBadge', 'Badge number', o.badge) + fld('sUnit', 'Unit', o.unit) +
              fld('sDivision', 'Division', o.division) + fld('sSup', 'Supervisor', o.supervisor, 'Lastname, Firstname') + '</div>' +
              '<div class="form-actions"><button class="btn btn-primary" type="submit">Save officer information</button></div></form></section>' +
          '<section class="panel"><div class="panel-head"><h2>Appearance</h2></div><div class="panel-body">' +
            '<fieldset class="radios"><legend class="lbl">Theme</legend>' +
            '<label><input type="radio" name="theme" value="light"' + (s.theme === 'light' ? ' checked' : '') + '> Light</label>' +
            '<label><input type="radio" name="theme" value="dark"' + (s.theme === 'dark' ? ' checked' : '') + '> Dark</label></fieldset>' +
            '<p class="hint">Report forms always stay white so exports and prints look the same.</p></div></section>' +
          '<section class="panel" id="storagePanel"></section>' +
          '<section class="panel"><div class="panel-head"><h2>About</h2></div><div class="panel-body about">' +
            '<p><strong>Los Santos Police Department Record Management System</strong><br>Version ' + APP_VERSION + ' (V1, local mode)</p>' +
            '<p>This system runs entirely in your browser. Nothing is sent to a server. Data is only available on the browser and device you are using, and clearing your browser data removes it. Use Export backup to keep a copy.</p>' +
            '<table class="kv"><tbody>' +
              '<tr><th>Storage mode</th><td>LOCAL</td></tr><tr><th>Database</th><td>BROWSER LOCAL STORAGE</td></tr><tr><th>Server sync</th><td>DISABLED</td></tr></tbody></table></div></section>' +
        '</div>';

      $('#offForm', el).addEventListener('submit', e => {
        e.preventDefault();
        const res = Store.saveSettings({ officer: { name: $('#sName').value.trim(), badge: $('#sBadge').value.trim(), unit: $('#sUnit').value.trim(), division: $('#sDivision').value.trim(), supervisor: $('#sSup').value.trim() } });
        UI.toast(res.ok ? 'Officer information saved.' : 'Could not save settings.', res.ok ? '' : 'error');
      });
      $$('input[name=theme]', el).forEach(r => r.addEventListener('change', () => {
        UI.applyTheme(r.value);
        Store.saveSettings({ theme: r.value });
      }));
      this.drawStorage(el);
      document.title = 'Settings | LSPD RMS';
    },

    drawStorage(el) {
      const u = Store.usage();
      const pct = Math.round(u.ratio * 100);
      $('#storagePanel', el).innerHTML =
        '<div class="panel-head"><h2>Storage and data</h2></div><div class="panel-body">' +
        '<table class="kv"><tbody>' +
          '<tr><th>Incident reports</th><td>' + Store.getIncidents().length + '</td></tr>' +
          '<tr><th>Surveillance reports</th><td>' + Store.getSurveillance().length + '</td></tr>' +
          '<tr><th>Saved calculations</th><td>' + Store.getPenalCalculations().length + '</td></tr>' +
          '<tr><th>Space used</th><td>' + UI.fmtBytes(u.bytes) + ' of about ' + UI.fmtBytes(u.budget) + '</td></tr></tbody></table>' +
        '<div class="meter" role="img" aria-label="Storage ' + pct + ' percent used"><span style="width:' + Math.max(1, pct) + '%"></span></div>' +
        '<p class="hint">Browser storage is limited. Photos are shrunk when attached, but many attachments can fill it. Export a backup regularly.</p>' +
        '<div class="form-actions">' +
          '<button type="button" class="btn" id="bkExport">' + icon('download') + ' Export backup</button>' +
          '<button type="button" class="btn" id="bkImport">' + icon('upload') + ' Import backup</button>' +
          '<button type="button" class="btn btn-danger" id="bkClear">' + icon('trash') + ' Clear all data</button></div></div>';

      $('#bkExport', el).addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(Store.exportAll(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'LSPD-RMS-backup-' + UI.todayISO() + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        UI.toast('Backup downloaded.');
      });
      $('#bkImport', el).addEventListener('click', () => { const f = $('#fileImport'); f.value = ''; f.click(); });
      $('#fileImport').onchange = async ev => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        try {
          const res = Store.importAll(JSON.parse(await file.text()));
          if (!res.ok) { UI.toast(res.error, 'error', 6000); return; }
          const c = res.counts;
          UI.toast('Backup imported: ' + c.incidents + ' incident, ' + c.surveillance + ' surveillance, ' + c.penal + ' calculations added or updated.');
          settings.mount(el);
        } catch (e) { UI.toast('That file could not be read as a backup.', 'error'); }
      };
      $('#bkClear', el).addEventListener('click', async () => {
        const ok = await UI.confirmBox({ title: 'Clear all local data?', message: 'This deletes every report, saved calculation and setting stored in this browser. Export a backup first if you may need them.', confirmText: 'Clear all data', danger: true });
        if (!ok) return;
        Store.clearAll();
        UI.applyTheme('light');
        UI.toast('All local data cleared.');
        settings.mount(el);
      });
    },
    unmount() {}
  };

  g.Views = { dashboard: dashboard, records: recordsView(null), incidentList: recordsView('incident'), surveillanceList: recordsView('surveillance'), settings: settings };
})(window);

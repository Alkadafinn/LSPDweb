/* LSPD RMS - Incident Report (LSPD PD-R-49) */
(function (g) {
  'use strict';

  const esc = UI.esc, icon = UI.icon, $ = UI.$;
  const D = Doc;

  const TYPES = ['', '187 - Homicide', '211 - Robbery', '459 - Burglary', '245 - Assault', '487 - Grand Theft', '484 - Petty Theft',
    '595 - Vandalism', '647 - Public Disturbance', 'Vehicle Code', 'Other'];
  const CLASSES = ['', 'FELONY', 'MISDEMEANOR', 'INFRACTION', 'CIVIL'];
  const SEX = ['', 'Male', 'Female'];
  const RACE = ['', 'White', 'Black', 'Hispanic', 'Asian', 'Arabian', 'Other'];

  const rand6 = () => Math.floor(Math.random() * 900000) + 100000;
  const genURN = () => new Date().getFullYear() + '-' + rand6();
  const genDR = () => String(new Date().getFullYear()).slice(-2) + '-' + rand6();

  function blank() {
    const o = Store.getSettings().officer;
    return {
      id: Store.uid(), kind: 'incident', status: 'draft', urn: genURN(), dr: genDR(), charges: [],
      data: {
        date: UI.todayISO(), time: UI.nowHM(), division: o.division, unit: o.unit,
        officerName: o.name, badge: o.badge, officerUnit: o.unit, supervisor: o.supervisor
      }
    };
  }

  function paperHTML() {
    const c = D.cell, i = D.input, s = D.select, t = D.textarea;
    const check = (f, label) => '<label class="p-check"><input type="checkbox" data-f="' + f + '"> ' + label + '</label>';
    return '<article class="paper">' +
      D.header('INCIDENT REPORT') +

      '<section class="p-sec" data-blk><div class="p-sec-title">INCIDENT INFORMATION</div><div class="p-grid">' +
        c(3, 'URN', D.roInput('urn')) + c(3, 'DR#', D.roInput('dr')) + c(3, 'Date', i('date', { type: 'date' })) + c(3, 'Time', i('time', { type: 'time' })) +
        c(6, 'Division', i('division')) + c(6, 'Unit', i('unit')) +
        c(6, 'Incident type', s('incidentType', TYPES)) + c(6, 'Classification', s('classification', CLASSES)) +
        c(12, 'Location', i('location', { ph: 'Street address, District, Los Santos' })) +
      '</div></section>' +

      '<div class="p-two" data-blk>' +
        '<section class="p-sec"><div class="p-sec-title">VICTIM / REPORTING PARTY</div><div class="p-grid">' +
          c(12, 'Name', i('vName')) + c(4, 'Age', i('vAge')) + c(4, 'Sex', s('vSex', SEX)) + c(4, 'Race', s('vRace', RACE)) +
          c(12, 'Phone', i('vPhone')) +
        '</div></section>' +
        '<section class="p-sec"><div class="p-sec-title">SUSPECT INFORMATION</div><div class="p-grid">' +
          c(12, 'Name', i('sName')) + c(4, 'Age', i('sAge')) + c(4, 'Sex', s('sSex', SEX)) + c(4, 'Race', s('sRace', RACE)) +
          c(12, 'Description', i('sDesc')) +
        '</div></section>' +
      '</div>' +

      '<section class="p-sec">' +
        '<div class="p-sec-title" data-blk data-keepnext>CHARGES (PENAL CODE)<small>Fine and jail time from the LSPD penal code</small></div>' +
        '<table class="p-tbl"><thead><tr data-blk data-keepnext><th>Code</th><th>Offense</th><th class="num">Fine</th><th class="num">Jail</th><th class="no-export"></th></tr></thead>' +
        '<tbody id="chargeRows"></tbody><tfoot id="chargeFoot"></tfoot></table>' +
        '<div class="p-add no-export"><input type="text" id="chargeInput" list="penalCodes" placeholder="Add penal code, e.g. 4K or 1M, 5B" autocomplete="off" spellcheck="false" aria-label="Add penal code">' +
        '<button type="button" class="p-btn" id="chargeAdd">Add charge</button></div>' +
      '</section>' +

      '<section class="p-sec" data-blk><div class="p-sec-title">NARRATIVE SUMMARY</div><div class="p-block">' +
        t('narrative', { min: 170, ph: 'What happened, when and where. Actions taken by officers. Statements from parties involved. Any follow-up required.' }) +
      '</div></section>' +

      '<div class="p-two" data-blk>' +
        '<section class="p-sec"><div class="p-sec-title">REPORTING OFFICER</div><div class="p-grid">' +
          c(12, 'Name', i('officerName', { ph: 'Lastname, Firstname' })) + c(6, 'Badge #', i('badge')) + c(6, 'Unit', i('officerUnit')) +
          c(12, 'Supervisor', i('supervisor', { ph: 'Lastname, Firstname' })) +
        '</div></section>' +
        '<section class="p-sec"><div class="p-sec-title">DISPOSITION</div><div class="p-checks">' +
          check('dispCompleted', 'REPORT COMPLETED') + check('dispArrest', 'ARREST MADE') + check('dispCitation', 'CITATION ISSUED') +
          check('dispDetective', 'TO DETECTIVE') + check('dispUnfounded', 'UNFOUNDED') + check('dispCivil', 'CIVIL MATTER') +
        '</div></section>' +
      '</div>' +

      D.signGrid(D.signBox('sigOfficer', 'REPORTING OFFICER', 'sigOfficerDate'), D.signBox('sigSupervisor', 'SUPERVISOR', 'sigSupervisorDate')) +
      D.footer('LSPD PD-R-49') +
    '</article>';
  }

  function renderCharges(ctx) {
    const calc = Penal.calc(ctx.rec.charges);
    const n = calc.items.length;
    $('#chargeRows', ctx.paper).innerHTML = n
      ? calc.items.map(it =>
        '<tr data-blk><td class="code">' + esc(it.code) + '</td><td>' + esc(it.nama) + '</td><td class="num">' + UI.money(it.denda) +
        '</td><td class="num">' + UI.jailShort(it.penjara) + '</td><td class="no-export p-rm"><button type="button" class="p-x" data-rm="' + esc(it.code) +
        '" aria-label="Remove ' + esc(it.code) + '">' + icon('x') + '</button></td></tr>').join('')
      : '<tr data-blk><td colspan="5" class="p-empty">No charges recorded.</td></tr>';
    $('#chargeFoot', ctx.paper).innerHTML = n
      ? '<tr data-blk><td colspan="2">TOTAL, ' + n + (n === 1 ? ' CHARGE' : ' CHARGES') + '</td><td class="num">' + UI.money(calc.fine) +
        '</td><td class="num">' + UI.jailShort(calc.jail) + (calc.capped ? ' (capped)' : '') + '</td><td class="no-export"></td></tr>'
      : '';
  }

  function addCharges(ctx, text) {
    const parsed = Penal.parse(text);
    const added = [], unknown = [];
    parsed.codes.forEach(code => {
      if (!Penal.lookup(code)) unknown.push(code);
      else if (ctx.rec.charges.indexOf(code) < 0) { ctx.rec.charges.push(code); added.push(code); }
    });
    if (added.length) { renderCharges(ctx); ctx.markDirty(); }
    if (unknown.length) UI.toast('Not in the penal code: ' + unknown.join(', '), 'error');
    return added.length > 0 || (!unknown.length);
  }

  function updateSignatures(ctx) {
    D.setSignature($('#sigOfficer', ctx.paper), ctx.rec.data.officerName, 'Enter reporting officer name');
    D.setSignature($('#sigSupervisor', ctx.paper), ctx.rec.data.supervisor, 'Enter supervisor name');
  }

  const view = Doc.create({
    kind: 'incident',
    title: 'Incident Report',
    listHref: '#/incident',
    listLabel: 'Incident reports',
    hrefFor: id => '#/incident/' + id,
    api: { get: Store.getIncident, save: Store.saveIncident, remove: Store.deleteIncident },
    blank: blank,
    paperHTML: paperHTML,
    refText: rec => 'URN ' + rec.urn,
    fileBase: rec => 'LSPD-Incident-' + rec.urn,
    setup(ctx) {
      renderCharges(ctx);
      updateSignatures(ctx);
      const input = $('#chargeInput', ctx.paper);
      const add = () => { if (input.value.trim() && addCharges(ctx, input.value)) { input.value = ''; } input.focus(); };
      $('#chargeAdd', ctx.paper).addEventListener('click', add);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      ctx.paper.addEventListener('click', e => {
        const b = e.target.closest('[data-rm]');
        if (!b) return;
        ctx.rec.charges = ctx.rec.charges.filter(cd => cd !== b.dataset.rm);
        renderCharges(ctx);
        ctx.markDirty();
      });
    },
    onField(ctx, f) {
      if (f === 'officerName' || f === 'supervisor') updateSignatures(ctx);
    }
  });

  /* Used by the penal calculator: start an incident report with charges attached. */
  function createFromCharges(codes) {
    const rec = blank();
    rec.charges = codes.slice();
    const res = Store.saveIncident(rec);
    if (!res.ok) { UI.toast('Could not create the report: browser storage is full.', 'error'); return; }
    Records.touch('incident', res.record);
    location.hash = '#/incident/' + res.record.id;
  }

  g.Incident = { view: view, blank: blank, createFromCharges: createFromCharges };
})(window);

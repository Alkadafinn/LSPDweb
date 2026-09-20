/* LSPD RMS - Penal calculator (engine + view) */
(function (g) {
  'use strict';

  const esc = UI.esc, icon = UI.icon, $ = UI.$, $$ = UI.$$;
  const DATA = g.PENAL_DATA, CATS = g.PENAL_CATEGORIES, PRESETS = g.PENAL_PRESETS;
  const JAIL_CAP = 90; // months, same cap as the original calculator

  /* ---------- engine ---------- */
  function lookup(code) { return DATA[String(code || '').toUpperCase()] || null; }

  function parse(text) {
    const seen = new Set(), codes = [], dupes = [];
    String(text || '').toUpperCase().split(/[\s,]+/).filter(Boolean).forEach(t => {
      if (seen.has(t)) { if (dupes.indexOf(t) < 0) dupes.push(t); return; }
      seen.add(t); codes.push(t);
    });
    return { codes: codes, dupes: dupes };
  }

  function calc(codes) {
    const items = [], unknown = [];
    let fine = 0, jailRaw = 0;
    (codes || []).forEach(code => {
      const d = lookup(code);
      if (d) { items.push(Object.assign({ code: code }, d)); fine += d.denda; jailRaw += d.penjara; }
      else if (code.length >= 2) unknown.push(code);
    });
    return { items: items, unknown: unknown, fine: fine, jailRaw: jailRaw, jail: Math.min(jailRaw, JAIL_CAP), capped: jailRaw > JAIL_CAP };
  }

  function suggest(prefix, limit) {
    const q = String(prefix || '').toUpperCase();
    if (!q) return [];
    return Object.keys(DATA).filter(k => k.indexOf(q) === 0).slice(0, limit || 6).map(k => Object.assign({ code: k }, DATA[k]));
  }

  const Penal = { lookup: lookup, parse: parse, calc: calc, suggest: suggest, DATA: DATA, JAIL_CAP: JAIL_CAP };

  /* datalist used by the incident report charge field */
  Penal.datalistHTML = () => '<datalist id="penalCodes">' +
    Object.keys(DATA).map(k => '<option value="' + k + '" label="' + esc(DATA[k].nama) + '"></option>').join('') + '</datalist>';

  /* ---------- view ---------- */
  let codesText = '';   // survives navigation within the session
  let activeSugg = -1;
  let cleanups = [];

  function summaryText(c) {
    const lines = c.items.map(i => i.code + '  ' + i.nama + '  ' + UI.money(i.denda) + ' / ' + UI.jailShort(i.penjara));
    lines.push('TOTAL  ' + UI.money(c.fine) + ' / ' + UI.jailLong(c.jail) + (c.capped ? ' (capped at ' + JAIL_CAP + ' months)' : ''));
    return lines.join('\n');
  }

  function template() {
    return '<div class="page-head"><div><h1>Penal calculator</h1>' +
      '<p>Enter penal codes separated by commas or spaces. Totals update as you type.</p></div>' +
      '<div class="actions"><button type="button" class="btn" id="pcList">' + icon('list') + ' Full code list</button></div></div>' +
      '<div class="penal-grid">' +
        '<div class="penal-side">' +
          '<section class="panel"><div class="panel-body">' +
            '<label class="lbl" for="pcInput">Penal codes</label>' +
            '<div class="code-wrap"><div class="code-field">' +
              '<input id="pcInput" class="input mono" type="text" placeholder="e.g. 1M, 4K, 5B" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="pcSugg" aria-autocomplete="list">' +
              '<button type="button" class="btn btn-sm" id="pcClear" hidden>Clear</button></div>' +
              '<div class="sugg" id="pcSugg" role="listbox" hidden></div></div>' +
            '<div class="totals" id="pcTotals"></div>' +
          '</div></section>' +
          '<section class="panel"><div class="panel-head"><h2>Suspect presets</h2></div><div id="pcPresets"></div></section>' +
        '</div>' +
        '<section class="panel penal-main"><div class="panel-head"><h2>Calculation</h2><span class="tag" id="pcCount">0 codes</span></div>' +
          '<div id="pcResult"></div></section>' +
      '</div>';
  }

  function totalsHTML(c) {
    return '<div class="tot"><span>Charges</span><strong>' + c.items.length + '</strong></div>' +
      '<div class="tot"><span>Total fine</span><strong>' + UI.money(c.fine) + '</strong></div>' +
      '<div class="tot"><span>Total jail</span><strong>' + UI.jailShort(c.jail) + '</strong></div>';
  }

  function resultHTML(c, dupes) {
    if (!c.items.length && !c.unknown.length) {
      return '<div class="empty"><strong>No codes entered</strong><p>Type a penal code such as 1M or 4K, or pick a preset.</p></div>';
    }
    let h = '';
    if (c.items.length) {
      h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Offense</th><th class="num">Fine</th><th class="num">Jail</th></tr></thead><tbody>' +
        c.items.map(i => '<tr><td class="mono strong">' + esc(i.code) + '</td><td>' + esc(i.nama) + '<div class="sub">' + esc(i.deskripsi) + '</div></td>' +
          '<td class="num mono">' + UI.money(i.denda) + '</td><td class="num mono">' + UI.jailLong(i.penjara) + '</td></tr>').join('') +
        '</tbody><tfoot><tr><td colspan="2">Total, ' + c.items.length + (c.items.length === 1 ? ' charge' : ' charges') + '</td><td class="num mono">' + UI.money(c.fine) +
        '</td><td class="num mono">' + UI.jailLong(c.jail) + '</td></tr></tfoot></table></div>';
    }
    if (c.capped) h += '<div class="notice">Jail time is capped at ' + JAIL_CAP + ' months. The uncapped sum is ' + c.jailRaw + ' months.</div>';
    if (dupes.length) h += '<div class="notice">Duplicate codes ignored: ' + esc(dupes.join(', ')) + '</div>';
    if (c.unknown.length) h += '<div class="notice notice-warn">Not found in the penal code: ' + esc(c.unknown.join(', ')) + '</div>';
    if (c.items.length) {
      h += '<div class="panel-foot">' +
        '<button type="button" class="btn" id="pcCopy">' + icon('copy') + ' Copy summary</button>' +
        '<button type="button" class="btn" id="pcSave">' + icon('save') + ' Save to records</button>' +
        '<button type="button" class="btn btn-primary" id="pcIncident">' + icon('incident') + ' New incident report with these charges</button></div>';
    }
    return h;
  }

  function render() {
    const p = parse(codesText);
    const c = calc(p.codes);
    $('#pcTotals').innerHTML = totalsHTML(c);
    $('#pcCount').textContent = c.items.length + (c.items.length === 1 ? ' code' : ' codes');
    $('#pcResult').innerHTML = resultHTML(c, p.dupes);
    $('#pcClear').hidden = !codesText.trim();
    const copy = $('#pcCopy');
    if (copy) copy.addEventListener('click', () => {
      const t = summaryText(c);
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(
        () => UI.toast('Summary copied.'), () => UI.toast('Copy is not available in this browser.', 'error'));
    });
    const save = $('#pcSave');
    if (save) save.addEventListener('click', () => {
      const res = Store.savePenalCalculation({ id: Store.uid(), codes: c.items.map(i => i.code), totalFine: c.fine, totalJail: c.jail });
      UI.toast(res.ok ? 'Calculation saved to records.' : 'Could not save: browser storage is full.', res.ok ? '' : 'error');
    });
    const inc = $('#pcIncident');
    if (inc) inc.addEventListener('click', () => Incident.createFromCharges(c.items.map(i => i.code)));
  }

  function setText(v, refocus) {
    codesText = v;
    const inp = $('#pcInput');
    inp.value = v;
    render();
    if (refocus) inp.focus();
  }

  function showSugg(list) {
    const box = $('#pcSugg'), inp = $('#pcInput');
    activeSugg = -1;
    if (!list.length) { box.hidden = true; inp.setAttribute('aria-expanded', 'false'); return; }
    box.innerHTML = list.map((s, i) =>
      '<div class="sugg-item" role="option" id="sg' + i + '" data-code="' + s.code + '"><span class="mono strong">' + s.code + '</span><span>' + esc(s.nama) +
      '</span><span class="mono">' + UI.money(s.denda) + '</span></div>').join('');
    box.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
  }
  function pickSugg(code) {
    const parts = codesText.split(',');
    parts[parts.length - 1] = code;
    setText(parts.map(s => s.trim()).filter(Boolean).join(', ') + ', ', true);
    showSugg([]);
  }
  function lastToken() { return codesText.split(',').pop().trim().replace(/\s/g, ''); }

  function addCodes(codes) {
    const existing = parse(codesText).codes;
    const add = codes.filter(c => existing.indexOf(c) < 0);
    setText(existing.concat(add).join(', '));
    return add.length;
  }

  function presetsHTML() {
    return PRESETS.map(p =>
      '<div class="preset"><div class="preset-top"><strong>' + esc(p.name) + '</strong><span class="sub">' + esc(p.desc) + '</span></div>' +
      '<div class="chips">' + p.codes.map(c => '<span class="chip">' + c + '</span>').join('') + '</div>' +
      '<div class="preset-actions"><button type="button" class="btn btn-sm btn-primary" data-load="' + p.id + '">Calculate</button>' +
      '<button type="button" class="btn btn-sm" data-add="' + p.id + '">Add to list</button></div></div>').join('');
  }

  /* full code list dialog */
  function openList() {
    const d = $('#dlgCodes');
    const body = $('#codesBody'), search = $('#codesSearch');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const by = {};
      Object.keys(DATA).forEach(k => {
        const v = DATA[k];
        if (q && k.toLowerCase().indexOf(q) < 0 && v.nama.toLowerCase().indexOf(q) < 0) return;
        (by[k[0]] = by[k[0]] || []).push(k);
      });
      const keys = Object.keys(by).sort();
      body.innerHTML = keys.length ? keys.map(cat =>
        '<div class="cat"><div class="cat-head">Penal ' + cat + ': ' + esc(CATS[cat] || '') + '</div>' +
        by[cat].map(k => '<button type="button" class="code-row" data-code="' + k + '"><span class="mono strong">' + k + '</span><span>' + esc(DATA[k].nama) +
          '</span><span class="mono">' + UI.money(DATA[k].denda) + '</span></button>').join('') + '</div>').join('')
        : '<div class="empty"><p>No matching codes.</p></div>';
    };
    search.value = '';
    draw();
    search.oninput = draw;
    body.onclick = e => {
      const b = e.target.closest('[data-code]');
      if (!b) return;
      addCodes([b.dataset.code]);
      d.close();
      UI.toast('Added ' + b.dataset.code + '.');
    };
    d.showModal();
    search.focus();
  }

  const view = {
    mount(el, params, query) {
      if (query && query.load) {
        const saved = Store.getPenalCalculation(query.load);
        if (saved) codesText = saved.codes.join(', ');
      }
      el.innerHTML = template();
      document.title = 'Penal Calculator | LSPD RMS';
      $('#pcPresets').innerHTML = presetsHTML();
      const inp = $('#pcInput');
      inp.value = codesText;
      render();

      let timer;
      inp.addEventListener('input', () => {
        let v = inp.value.toUpperCase().replace(/\s+/g, ' ').replace(/,+/g, ',').replace(/^[,\s]+/, '');
        inp.value = v;
        codesText = v;
        showSugg(Penal.suggest(lastToken()));
        clearTimeout(timer);
        timer = setTimeout(render, 150);
      });
      inp.addEventListener('keydown', e => {
        const items = $$('.sugg-item', $('#pcSugg'));
        if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); activeSugg = (activeSugg + 1) % items.length; }
        else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); activeSugg = (activeSugg - 1 + items.length) % items.length; }
        else if (e.key === 'Enter' && activeSugg >= 0 && items[activeSugg]) { e.preventDefault(); pickSugg(items[activeSugg].dataset.code); return; }
        else if (e.key === 'Escape') { showSugg([]); return; }
        else return;
        items.forEach((n, i) => { n.classList.toggle('is-active', i === activeSugg); n.setAttribute('aria-selected', String(i === activeSugg)); });
        if (activeSugg >= 0) inp.setAttribute('aria-activedescendant', 'sg' + activeSugg);
      });
      $('#pcSugg').addEventListener('mousedown', e => {
        const b = e.target.closest('[data-code]');
        if (b) { e.preventDefault(); pickSugg(b.dataset.code); }
      });
      const outside = e => { if (!e.target.closest('.code-wrap')) showSugg([]); };
      document.addEventListener('click', outside);
      cleanups.push(() => document.removeEventListener('click', outside));

      $('#pcClear').addEventListener('click', () => { setText('', true); showSugg([]); });
      $('#pcList').addEventListener('click', openList);
      $('#pcPresets').addEventListener('click', e => {
        const l = e.target.closest('[data-load]'), a = e.target.closest('[data-add]');
        if (l) { const p = PRESETS.find(x => x.id === l.dataset.load); setText(p.codes.join(', ')); }
        if (a) {
          const p = PRESETS.find(x => x.id === a.dataset.add);
          const n = addCodes(p.codes);
          UI.toast(n ? n + ' code' + (n === 1 ? '' : 's') + ' added from ' + p.name + '.' : 'All codes are already in the list.', n ? '' : 'error');
        }
      });
    },
    unmount() { cleanups.forEach(f => f()); cleanups = []; }
  };

  g.Penal = Penal;
  g.PenalView = view;
})(window);

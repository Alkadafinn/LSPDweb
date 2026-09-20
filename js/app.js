/* LSPD RMS - router and shell */
(function () {
  'use strict';

  const $ = UI.$, $$ = UI.$$;
  let current = null;

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const bits = h.split('?');
    return {
      parts: bits[0].split('/').filter(Boolean),
      query: Object.fromEntries(new URLSearchParams(bits[1] || ''))
    };
  }

  function resolve(parts, query) {
    const a = parts[0] || 'dashboard', b = parts[1];
    switch (a) {
      case 'dashboard': return { view: Views.dashboard, nav: 'dashboard' };
      case 'incident':
        return b ? { view: Incident.view, nav: 'incident', params: { id: b } } : { view: Views.incidentList, nav: 'incident' };
      case 'surveillance':
        return b ? { view: Surveillance.view, nav: 'surveillance', params: { id: b } } : { view: Views.surveillanceList, nav: 'surveillance' };
      case 'penal': return { view: PenalView, nav: 'penal' };
      case 'records': return { view: Views.records, nav: query.status === 'draft' ? 'drafts' : 'records' };
      case 'settings': return { view: Views.settings, nav: 'settings' };
      default: return null;
    }
  }

  /* ---------- sign-in gate ---------- */
  function lock() {
    if (current && current.unmount) current.unmount();
    current = null;
    closeDrawer();
    document.body.classList.add('locked');
    document.title = 'Sign in | LSPD RMS';
    const host = $('#auth');
    host.hidden = false;
    AuthView.render(host, unlock);
  }
  function unlock() {
    document.body.classList.remove('locked');
    $('#auth').hidden = true;
    $('#auth').innerHTML = '';
    UI.applyTheme(Store.getSettings().theme);
    updateChrome();
    if (!location.hash || location.hash === '#/login') history.replaceState(null, '', '#/dashboard');
    route();
  }
  function signOut() {
    if (current && current.unmount) current.unmount();
    current = null;
    Auth.logout();
    lock();
  }

  function route() {
    if (!Auth.current()) { lock(); return; }
    const p = parseHash();
    const r = resolve(p.parts, p.query);
    if (current && current.unmount) current.unmount();
    current = null;
    const main = $('#view');
    closeDrawer();
    if (!r) {
      main.innerHTML = '<div class="panel"><div class="empty"><strong>Page not found</strong><p>That address does not exist in this system.</p><a class="btn btn-primary" href="#/dashboard">Go to dashboard</a></div></div>';
      setNav('');
      return;
    }
    setNav(r.nav);
    current = r.view;
    main.innerHTML = '';
    r.view.mount(main, r.params || {}, p.query);
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }

  function setNav(key) {
    $$('.nav-link').forEach(a => {
      if (a.dataset.nav === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function updateChrome() {
    const inc = Store.getIncidents(), sur = Store.getSurveillance();
    const drafts = inc.concat(sur).filter(r => r.status === 'draft').length;
    const set = (id, n) => { const el = $(id); if (el) el.textContent = n ? String(n) : ''; };
    set('#cntIncident', inc.length);
    set('#cntSurveillance', sur.length);
    set('#cntDrafts', drafts);
    const o = Store.getSettings().officer;
    const off = $('#topOfficer');
    const me = Auth.current();
    const nm = me ? me.displayName : o.name;
    off.textContent = nm ? nm + ((me ? me.badge : o.badge) ? ' / ' + (me ? me.badge : o.badge) : '') : 'Officer not set';
  }

  function tick() {
    $('#topClock').textContent = new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function openDrawer() { document.body.classList.add('nav-open'); $('#menuBtn').setAttribute('aria-expanded', 'true'); }
  function closeDrawer() { document.body.classList.remove('nav-open'); const b = $('#menuBtn'); if (b) b.setAttribute('aria-expanded', 'false'); }

  function init() {
    document.body.insertAdjacentHTML('beforeend', Penal.datalistHTML());
    UI.applyTheme(Store.getSettings().theme);
    /* the seal may have failed before this script ran */
    $$('img.seal').forEach(img => { if (img.complete && img.naturalWidth === 0) img.src = UI.SEAL; });
    $('#menuBtn').addEventListener('click', () => document.body.classList.contains('nav-open') ? closeDrawer() : openDrawer());
    $('#scrim').addEventListener('click', closeDrawer);
    document.addEventListener('lspd:changed', updateChrome);
    window.addEventListener('hashchange', () => { if (!document.body.classList.contains('locked')) route(); });
    $('#btnSignOut').addEventListener('click', signOut);
    tick();
    setInterval(tick, 20000);
    if (Auth.current()) {
      updateChrome();
      if (!location.hash) history.replaceState(null, '', '#/dashboard');
      route();
    } else {
      lock();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

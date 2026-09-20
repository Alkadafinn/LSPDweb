/* LSPD RMS - sign-in / create-account screen */
(function (g) {
  'use strict';

  const esc = UI.esc, $ = UI.$;

  function field(id, label, opts) {
    opts = opts || {};
    return '<label class="field" id="w-' + id + '"><span class="lbl">' + label + '</span>' +
      '<input class="input auth-input" id="' + id + '" type="' + (opts.type || 'text') + '"' +
      (opts.auto ? ' autocomplete="' + opts.auto + '"' : ' autocomplete="off"') +
      (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + (opts.req ? ' required' : '') + ' spellcheck="false"></label>';
  }

  function render(host, onDone) {
    const first = !Auth.hasAccounts();
    let mode = first ? 'register' : 'login';

    function draw() {
      host.innerHTML =
        '<div class="auth-wrap">' +
          '<aside class="auth-brand">' +
            '<img class="auth-seal" src="assets/LSPD-SEALS.png" alt="" onerror="this.onerror=null;this.src=UI.SEAL">' +
            '<div class="auth-dept">LOS SANTOS POLICE DEPARTMENT</div>' +
            '<div class="auth-sys">RECORD MANAGEMENT SYSTEM</div>' +
            '<p class="auth-note">Authorized personnel only. Reports and records in this system are for official use.</p>' +
            '<p class="auth-foot">Local mode: accounts and records are stored in this browser and are not synced to a server.</p>' +
          '</aside>' +
          '<section class="auth-panel"><div class="auth-card">' +
            (first ? '' :
              '<div class="auth-tabs" role="tablist"><button type="button" role="tab" data-mode="login" aria-selected="' + (mode === 'login') + '">Sign in</button>' +
              '<button type="button" role="tab" data-mode="register" aria-selected="' + (mode === 'register') + '">Create account</button></div>') +
            (mode === 'login' ? loginHTML() : registerHTML(first)) +
          '</div></section></div>';

      $$tabs().forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; draw(); }));
      if (mode === 'login') bindLogin(); else bindRegister();
      const firstInput = host.querySelector('input');
      if (firstInput) firstInput.focus();
    }
    const $$tabs = () => Array.from(host.querySelectorAll('.auth-tabs [data-mode]'));

    function loginHTML() {
      return '<h1>Sign in</h1><p class="auth-sub">Use the account created on this device.</p>' +
        '<div class="auth-err" id="auErr" role="alert" hidden></div>' +
        '<form class="auth-form" id="loginForm" novalidate>' +
          field('auUser', 'Username', { auto: 'username', req: true }) +
          field('auPass', 'Password', { type: 'password', auto: 'current-password', req: true }) +
          '<label class="check"><input type="checkbox" id="auRemember"> Keep me signed in on this device for 7 days</label>' +
          '<button class="btn btn-primary auth-submit" type="submit" id="auSubmit">Sign in</button>' +
        '</form>' + notice();
    }

    function registerHTML(isFirst) {
      return '<h1>' + (isFirst ? 'Create the first account' : 'Create account') + '</h1>' +
        '<p class="auth-sub">' + (isFirst ? 'This account becomes the administrator for this device.' : 'Accounts are stored only in this browser.') + '</p>' +
        '<div class="auth-err" id="auErr" role="alert" hidden></div>' +
        '<form class="auth-form" id="regForm" novalidate>' +
          field('rgName', 'Full name', { ph: 'Lastname, Firstname', auto: 'name', req: true }) +
          '<div class="auth-row2">' + field('rgBadge', 'Badge number') + field('rgUnit', 'Unit') + '</div>' +
          '<div class="auth-row2">' + field('rgDivision', 'Division') + field('rgSup', 'Supervisor', { ph: 'Lastname, Firstname' }) + '</div>' +
          field('rgUser', 'Username', { auto: 'username', req: true }) +
          '<div class="auth-row2">' + field('rgPass', 'Password', { type: 'password', auto: 'new-password', req: true }) +
            field('rgConfirm', 'Confirm password', { type: 'password', auto: 'new-password', req: true }) + '</div>' +
          '<p class="hint" style="margin:0">Use at least 8 characters. Passwords cannot be recovered; an administrator can reset them.</p>' +
          '<button class="btn btn-primary auth-submit" type="submit" id="auSubmit">' + (isFirst ? 'Create administrator account' : 'Create account and sign in') + '</button>' +
        '</form>' + notice();
    }

    function notice() {
      return '<p class="auth-legal">Sign-in on this site is a local access gate. It identifies who is using this browser but does not protect data from someone with access to the device.</p>';
    }

    function showErr(msg, fieldId) {
      const e = $('#auErr');
      e.textContent = msg; e.hidden = !msg;
      host.querySelectorAll('.field').forEach(f => f.classList.remove('field-err'));
      if (fieldId && $('#w-' + fieldId)) { $('#w-' + fieldId).classList.add('field-err'); $('#' + fieldId).focus(); }
    }
    function busy(on, label) {
      const b = $('#auSubmit');
      b.disabled = on;
      if (label) b.dataset.label = b.dataset.label || b.textContent;
      b.textContent = on ? label : (b.dataset.label || b.textContent);
    }

    function bindLogin() {
      $('#loginForm').addEventListener('submit', async e => {
        e.preventDefault();
        const u = $('#auUser').value, p = $('#auPass').value;
        if (!u.trim() || !p) { showErr('Enter your username and password.', u.trim() ? 'auPass' : 'auUser'); return; }
        busy(true, 'Signing in...');
        const r = await Auth.login(u, p, $('#auRemember').checked);
        busy(false);
        if (!r.ok) { showErr(r.error); $('#auPass').value = ''; $('#auPass').focus(); return; }
        onDone();
      });
    }

    const IDS = { displayName: 'rgName', username: 'rgUser', password: 'rgPass', confirm: 'rgConfirm' };
    function bindRegister() {
      $('#regForm').addEventListener('submit', async e => {
        e.preventDefault();
        const v = id => $('#' + id).value;
        const f = { displayName: v('rgName'), badge: v('rgBadge'), unit: v('rgUnit'), division: v('rgDivision'), supervisor: v('rgSup'), username: v('rgUser'), password: v('rgPass'), confirm: v('rgConfirm') };
        busy(true, 'Creating account...');
        const r = await Auth.register(f);
        if (!r.ok) { busy(false); showErr(r.error, IDS[r.field]); return; }
        const s = await Auth.login(f.username, f.password, false);
        busy(false);
        if (!s.ok) { showErr(s.error); return; }
        UI.toast('Account created. Welcome, ' + r.account.displayName + '.');
        onDone();
      });
    }

    draw();
  }

  g.AuthView = { render: render };
})(window);

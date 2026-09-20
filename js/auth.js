/* LSPD RMS - local accounts and sign-in (V1).
 *
 * IMPORTANT: this is an access gate and identity feature, not real security.
 * The app is static and everything lives in the browser, so anyone with access
 * to the browser profile (or the site itself) can bypass or read it. Passwords
 * are still never stored in plain text: they are salted and hashed with
 * PBKDF2-SHA256 through the Web Crypto API. Real access control needs a
 * server (planned for V2). */
(function (g) {
  'use strict';

  const ITER = 150000;
  const REMEMBER_MS = 7 * 24 * 60 * 60 * 1000;
  const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAA==';
  const enc = new TextEncoder();
  const attempts = {}; // username -> { n, until }  (in memory only)

  const b64 = buf => btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(buf))));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const fail = (error, field) => ({ ok: false, error: error, field: field });

  function available() { return !!(g.crypto && g.crypto.subtle && g.crypto.getRandomValues); }
  function newSalt() { return b64(g.crypto.getRandomValues(new Uint8Array(16))); }

  async function derive(password, saltB64, iterations) {
    const key = await g.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await g.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iterations }, key, 256);
    return b64(bits);
  }
  function same(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  }

  function pub(a) {
    return a ? { id: a.id, username: a.username, displayName: a.displayName, badge: a.badge, unit: a.unit, division: a.division, supervisor: a.supervisor, role: a.role, createdAt: a.createdAt, lastLoginAt: a.lastLoginAt } : null;
  }
  function syncSettings(a) {
    Store.saveSettings({ officer: { name: a.displayName, badge: a.badge || '', unit: a.unit || '', division: a.division || '', supervisor: a.supervisor || '' } });
  }

  function checkPassword(p, username) {
    if (!p || p.length < 8) return 'Use at least 8 characters.';
    if (username && p.toLowerCase() === username.toLowerCase()) return 'The password cannot be the same as the username.';
    return '';
  }

  function hasAccounts() { return Store.getAccounts().length > 0; }

  function current() {
    const s = Store.getSession();
    if (!s) return null;
    if (s.expires && Date.now() > s.expires) { Store.clearSession(); return null; }
    const a = Store.getAccount(s.userId);
    if (!a) { Store.clearSession(); return null; }
    return pub(a);
  }
  const isAdmin = () => { const c = current(); return !!c && c.role === 'admin'; };

  async function register(f) {
    if (!available()) return fail('Passwords cannot be secured in this context. Open the site over HTTPS (GitHub Pages) or localhost.');
    const displayName = (f.displayName || '').trim();
    const username = (f.username || '').trim().toLowerCase();
    if (!displayName) return fail('Enter your full name.', 'displayName');
    if (!/^[a-z0-9._-]{3,24}$/.test(username)) return fail('Username must be 3 to 24 characters: letters, numbers, dot, dash or underscore.', 'username');
    if (Store.getAccounts().some(a => a.username === username)) return fail('That username is already taken on this device.', 'username');
    const pwErr = checkPassword(f.password, username);
    if (pwErr) return fail(pwErr, 'password');
    if (f.password !== f.confirm) return fail('The passwords do not match.', 'confirm');

    const salt = newSalt();
    const hash = await derive(f.password, salt, ITER);
    const acc = {
      id: Store.uid(), username: username, displayName: displayName,
      badge: (f.badge || '').trim(), unit: (f.unit || '').trim(), division: (f.division || '').trim(), supervisor: (f.supervisor || '').trim(),
      role: hasAccounts() ? 'officer' : 'admin', salt: salt, hash: hash, iterations: ITER, lastLoginAt: null
    };
    const res = Store.saveAccount(acc);
    if (!res.ok) return fail('The account could not be saved: browser storage is full.');
    return { ok: true, account: pub(res.record) };
  }

  async function login(usernameRaw, password, remember) {
    if (!available()) return fail('Sign-in is not available in this context. Open the site over HTTPS (GitHub Pages) or localhost.');
    const username = (usernameRaw || '').trim().toLowerCase();
    const t = attempts[username] || { n: 0, until: 0 };
    if (Date.now() < t.until) return fail('Too many failed attempts. Try again in ' + Math.ceil((t.until - Date.now()) / 1000) + ' seconds.');

    const a = Store.getAccounts().find(x => x.username === username);
    const hash = await derive(password || '', a ? a.salt : DUMMY_SALT, a ? a.iterations : ITER);
    if (!a || !same(hash, a.hash)) {
      t.n += 1;
      if (t.n >= 5) { t.until = Date.now() + 30000; t.n = 0; }
      attempts[username] = t;
      return fail('Incorrect username or password.');
    }
    attempts[username] = { n: 0, until: 0 };
    const upd = Store.saveAccount(Object.assign({}, a, { lastLoginAt: new Date().toISOString() }));
    const rec = upd.ok ? upd.record : a;
    Store.saveSession({ userId: a.id, at: Date.now(), expires: remember ? Date.now() + REMEMBER_MS : null }, !!remember);
    syncSettings(rec);
    return { ok: true, account: pub(rec) };
  }

  function logout() { Store.clearSession(); }

  function updateProfile(patch) {
    const c = current();
    if (!c) return fail('You are not signed in.');
    const a = Store.getAccount(c.id);
    const next = Object.assign({}, a, {
      displayName: (patch.displayName || a.displayName).trim() || a.displayName,
      badge: (patch.badge || '').trim(), unit: (patch.unit || '').trim(),
      division: (patch.division || '').trim(), supervisor: (patch.supervisor || '').trim()
    });
    const res = Store.saveAccount(next);
    if (res.ok) syncSettings(res.record);
    return res.ok ? { ok: true } : fail('Could not save the profile.');
  }

  async function changePassword(currentPw, newPw, confirmPw) {
    const c = current();
    if (!c) return fail('You are not signed in.');
    const a = Store.getAccount(c.id);
    const h = await derive(currentPw || '', a.salt, a.iterations);
    if (!same(h, a.hash)) return fail('The current password is incorrect.', 'current');
    const err = checkPassword(newPw, a.username);
    if (err) return fail(err, 'new');
    if (newPw !== confirmPw) return fail('The new passwords do not match.', 'confirm');
    const salt = newSalt();
    const res = Store.saveAccount(Object.assign({}, a, { salt: salt, hash: await derive(newPw, salt, ITER), iterations: ITER }));
    return res.ok ? { ok: true } : fail('Could not save the new password.');
  }

  async function adminReset(id, newPw) {
    if (!isAdmin()) return fail('Only an administrator can reset passwords.');
    const a = Store.getAccount(id);
    if (!a) return fail('Account not found.');
    const err = checkPassword(newPw, a.username);
    if (err) return fail(err);
    const salt = newSalt();
    const res = Store.saveAccount(Object.assign({}, a, { salt: salt, hash: await derive(newPw, salt, ITER), iterations: ITER }));
    return res.ok ? { ok: true } : fail('Could not save the new password.');
  }

  function removeAccount(id) {
    const c = current();
    if (!c || c.role !== 'admin') return fail('Only an administrator can delete accounts.');
    if (c.id === id) return fail('You cannot delete the account you are signed in with.');
    const a = Store.getAccount(id);
    if (!a) return fail('Account not found.');
    if (a.role === 'admin' && Store.getAccounts().filter(x => x.role === 'admin').length < 2) return fail('At least one administrator must remain.');
    const res = Store.deleteAccount(id);
    return res.ok ? { ok: true } : fail('Could not delete the account.');
  }

  g.Auth = {
    available: available, hasAccounts: hasAccounts, current: current, isAdmin: isAdmin,
    register: register, login: login, logout: logout, updateProfile: updateProfile,
    changePassword: changePassword, adminReset: adminReset, removeAccount: removeAccount, checkPassword: checkPassword
  };
})(window);

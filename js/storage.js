/* LSPD RMS - Storage layer (V1: browser localStorage).
 *
 * The UI never touches localStorage directly. Everything goes through the
 * functions on `Store`, so V2 can replace this file with a database/API
 * client that exposes the same functions (async wrappers aside) without
 * changing any view code.
 *
 * Every write returns { ok: true, record } or { ok: false, quota, error }.
 */
(function (g) {
  'use strict';

  const KEYS = Object.freeze({
    incidents: 'lspd_incident_reports',
    surveillance: 'lspd_surveillance_reports',
    recent: 'lspd_recent_records',
    penal: 'lspd_penal_calculations',
    settings: 'lspd_settings'
  });

  const RECENT_LIMIT = 20;
  const STORAGE_BUDGET = 5 * 1024 * 1024; // typical per-origin localStorage budget
  const DEFAULT_OFFICER = { name: '', badge: '', unit: '', division: '', supervisor: '' };

  function isQuota(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  }
  function notify() {
    try { document.dispatchEvent(new CustomEvent('lspd:changed')); } catch (e) { /* ignore */ }
  }
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn('[Store] could not read', key, e);
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      notify();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e, quota: isQuota(e) };
    }
  }
  function uid() {
    if (g.crypto && typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID();
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  const nowISO = () => new Date().toISOString();

  /* Generic keyed collection: list / get / save (upsert) / update / remove */
  function collection(key, kind) {
    return {
      key: key,
      kind: kind,
      list() {
        const a = read(key, []);
        return Array.isArray(a) ? a : [];
      },
      get(id) {
        return this.list().find(r => r.id === id) || null;
      },
      save(rec) {
        const all = this.list();
        const t = nowISO();
        const next = Object.assign({}, rec, {
          id: rec.id || uid(),
          kind: kind,
          createdAt: rec.createdAt || t,
          updatedAt: t
        });
        const i = all.findIndex(r => r.id === next.id);
        if (i >= 0) all[i] = next; else all.push(next);
        const res = write(key, all);
        return res.ok ? { ok: true, record: next } : res;
      },
      update(id, patch) {
        const cur = this.get(id);
        if (!cur) return { ok: false, error: new Error('Record not found') };
        return this.save(Object.assign({}, cur, patch));
      },
      remove(id) {
        const all = this.list();
        const next = all.filter(r => r.id !== id);
        if (next.length === all.length) return { ok: false, error: new Error('Record not found') };
        const res = write(key, next);
        if (res.ok) Store.forgetRecent(kind, id);
        return res;
      }
    };
  }

  const incidents = collection(KEYS.incidents, 'incident');
  const surveillance = collection(KEYS.surveillance, 'surveillance');
  const penal = collection(KEYS.penal, 'penal');

  const Store = {
    KEYS: KEYS,
    uid: uid,
    STORAGE_BUDGET: STORAGE_BUDGET,

    /* Incident reports */
    saveIncident: r => incidents.save(r),
    getIncidents: () => incidents.list(),
    getIncident: id => incidents.get(id),
    updateIncident: (id, patch) => incidents.update(id, patch),
    deleteIncident: id => incidents.remove(id),

    /* Surveillance reports */
    saveSurveillance: r => surveillance.save(r),
    getSurveillance: () => surveillance.list(),
    getSurveillanceReport: id => surveillance.get(id),
    updateSurveillance: (id, patch) => surveillance.update(id, patch),
    deleteSurveillance: id => surveillance.remove(id),

    /* Saved penal calculations */
    savePenalCalculation: r => penal.save(r),
    getPenalCalculations: () => penal.list(),
    getPenalCalculation: id => penal.get(id),
    deletePenalCalculation: id => penal.remove(id),

    /* Recent records (activity log of opened/saved records) */
    getRecent() {
      const a = read(KEYS.recent, []);
      return Array.isArray(a) ? a : [];
    },
    pushRecent(entry) {
      const list = this.getRecent().filter(e => !(e.kind === entry.kind && e.id === entry.id));
      list.unshift(Object.assign({}, entry, { at: nowISO() }));
      return write(KEYS.recent, list.slice(0, RECENT_LIMIT));
    },
    forgetRecent(kind, id) {
      const list = this.getRecent();
      const next = list.filter(e => !(e.kind === kind && e.id === id));
      if (next.length !== list.length) write(KEYS.recent, next);
    },

    /* Settings: officer information + theme preference */
    getSettings() {
      const s = read(KEYS.settings, {}) || {};
      return {
        theme: s.theme === 'dark' ? 'dark' : 'light',
        officer: Object.assign({}, DEFAULT_OFFICER, s.officer || {})
      };
    },
    saveSettings(patch) {
      const cur = this.getSettings();
      const next = {
        theme: patch.theme || cur.theme,
        officer: Object.assign({}, cur.officer, patch.officer || {})
      };
      return write(KEYS.settings, next);
    },

    /* Backup / restore / usage */
    usage() {
      let chars = 0;
      const perKey = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('lspd_') === 0) {
          const n = k.length + (localStorage.getItem(k) || '').length;
          perKey[k] = n;
          chars += n;
        }
      }
      const bytes = chars * 2; // UTF-16
      return { bytes: bytes, budget: STORAGE_BUDGET, ratio: Math.min(1, bytes / STORAGE_BUDGET), perKey: perKey };
    },
    exportAll() {
      return {
        app: 'LSPD-RMS',
        schema: 1,
        exportedAt: nowISO(),
        storageMode: 'local',
        data: {
          incidents: incidents.list(),
          surveillance: surveillance.list(),
          penalCalculations: penal.list(),
          recent: this.getRecent(),
          settings: read(KEYS.settings, {})
        }
      };
    },
    importAll(obj) {
      if (!obj || obj.app !== 'LSPD-RMS' || !obj.data) {
        return { ok: false, error: 'This file is not an LSPD RMS backup.' };
      }
      const counts = { incidents: 0, surveillance: 0, penal: 0 };
      const merge = (col, arr, label) => {
        if (!Array.isArray(arr)) return { ok: true };
        const all = col.list();
        arr.forEach(r => {
          if (!r || !r.id) return;
          const i = all.findIndex(x => x.id === r.id);
          if (i < 0) { all.push(r); counts[label]++; }
          else if ((r.updatedAt || '') > (all[i].updatedAt || '')) { all[i] = r; counts[label]++; }
        });
        return write(col.key, all);
      };
      const results = [
        merge(incidents, obj.data.incidents, 'incidents'),
        merge(surveillance, obj.data.surveillance, 'surveillance'),
        merge(penal, obj.data.penalCalculations, 'penal')
      ];
      const failed = results.find(r => !r.ok);
      if (failed) return { ok: false, quota: failed.quota, error: failed.quota ? 'Not enough browser storage to import this backup.' : 'Import failed.' };
      if (obj.data.settings && typeof obj.data.settings === 'object') {
        write(KEYS.settings, Object.assign({}, read(KEYS.settings, {}), obj.data.settings));
      }
      return { ok: true, counts: counts };
    },
    clearAll() {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('lspd_') === 0) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
      notify();
      return keys.length;
    }
  };

  g.Store = Store;
})(window);

/* LSPD RMS - unified view over every record type */
(function (g) {
  'use strict';

  const KIND_LABEL = { incident: 'Incident report', surveillance: 'Surveillance report', penal: 'Penal calculation' };
  const KIND_ICON = { incident: 'incident', surveillance: 'eye', penal: 'calc' };

  const clean = v => (v && v !== '-' ? v : '');

  const SUMMARY = {
    incident(r) {
      const d = r.data || {};
      const title = [clean(d.incidentType), d.location].filter(Boolean).join(' at ') || 'Untitled incident report';
      return { kind: 'incident', id: r.id, ref: r.urn || '', title: title, officer: d.officerName || '', date: d.date || '', status: r.status || 'draft', updatedAt: r.updatedAt, href: '#/incident/' + r.id };
    },
    surveillance(r) {
      const d = r.data || {};
      return { kind: 'surveillance', id: r.id, ref: d.reportNumber || d.urn || '', title: d.operationName || d.target || 'Untitled surveillance report', officer: d.reportingOfficer || '', date: d.date || '', status: r.status || 'draft', updatedAt: r.updatedAt, href: '#/surveillance/' + r.id };
    },
    penal(r) {
      const n = (r.codes || []).length;
      return { kind: 'penal', id: r.id, ref: (r.codes || []).join(', '), title: 'Penal calculation, ' + n + (n === 1 ? ' code' : ' codes'), officer: '', date: (r.createdAt || '').slice(0, 10), status: 'saved', updatedAt: r.updatedAt, href: '#/penal?load=' + r.id };
    }
  };

  function summary(kind, rec) { return SUMMARY[kind](rec); }

  function fetchAll(kind) {
    if (kind === 'incident') return Store.getIncidents();
    if (kind === 'surveillance') return Store.getSurveillance();
    return Store.getPenalCalculations();
  }

  function all(kinds) {
    const rows = [];
    (kinds || ['incident', 'surveillance', 'penal']).forEach(k => {
      fetchAll(k).forEach(r => rows.push(SUMMARY[k](r)));
    });
    rows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return rows;
  }

  function get(kind, id) {
    if (kind === 'incident') return Store.getIncident(id);
    if (kind === 'surveillance') return Store.getSurveillanceReport(id);
    return Store.getPenalCalculation(id);
  }

  function touch(kind, rec) {
    const s = summary(kind, rec);
    Store.pushRecent({ kind: kind, id: rec.id, ref: s.ref, title: s.title });
  }

  function remove(kind, id) {
    if (kind === 'incident') return Store.deleteIncident(id);
    if (kind === 'surveillance') return Store.deleteSurveillance(id);
    return Store.deletePenalCalculation(id);
  }

  /* Recent entries resolved against live data; deleted records are skipped. */
  function recent(limit) {
    const out = [];
    Store.getRecent().forEach(e => {
      const r = get(e.kind, e.id);
      if (r && out.length < (limit || 8)) out.push(Object.assign(summary(e.kind, r), { openedAt: e.at }));
    });
    return out;
  }

  g.Records = { KIND_LABEL: KIND_LABEL, KIND_ICON: KIND_ICON, summary: summary, all: all, get: get, touch: touch, remove: remove, recent: recent };
})(window);

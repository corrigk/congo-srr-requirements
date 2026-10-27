// SQLite store for the requirements (Node's built-in node:sqlite, no native build).
// The .db file is a local working copy and is not committed. After every change the whole graph is exported to
// data/working.json (sorted, pretty-printed) so git can diff and merge it; a fresh clone rebuilds the database
// from that file. "Finalize" freezes a named baseline into data/baselines/ and data/published.json, which the
// static site serves.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { SEED } from './seed.mjs';
import { build } from '../src/model.js';

const COLS = ['type', 'sort', 'name', 'statement', 'threshold', 'objective', 'rationale', 'source', 'verification', 'verNote', 'segment', 'owner', 'status', 'example', 'srr', 'fn'];
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

export function openStore(root) {
  const dataDir = path.join(root, 'data');
  const files = {
    db: path.join(dataDir, 'requirements.db'),
    working: path.join(dataDir, 'working.json'),
    published: path.join(dataDir, 'published.json'),
    baselines: path.join(dataDir, 'baselines'),
  };
  fs.mkdirSync(files.baselines, { recursive: true });
  const db = new DatabaseSync(files.db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS req (
      id TEXT PRIMARY KEY, type TEXT NOT NULL DEFAULT 'req', sort INTEGER, name TEXT, statement TEXT, threshold TEXT,
      objective TEXT, rationale TEXT, source TEXT, verification TEXT, verNote TEXT, segment TEXT, owner TEXT,
      status TEXT, example INTEGER NOT NULL DEFAULT 0, srr TEXT NOT NULL DEFAULT '[]', fn TEXT NOT NULL DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS link (
      parent TEXT NOT NULL REFERENCES req(id) ON UPDATE CASCADE ON DELETE CASCADE,
      child TEXT NOT NULL REFERENCES req(id) ON UPDATE CASCADE ON DELETE CASCADE,
      ord REAL NOT NULL, PRIMARY KEY (parent, child));
    PRAGMA foreign_keys = ON;`);
  // Databases made before the functional-flow trace had no fn column.
  if (!db.prepare('PRAGMA table_info(req)').all().some(c => c.name === 'fn')) db.exec("ALTER TABLE req ADD COLUMN fn TEXT NOT NULL DEFAULT '[]'");

  // ---------- read / write whole snapshots ----------
  const rowToReq = r => {
    const o = { id: r.id };
    for (const c of COLS) if (r[c] !== null && r[c] !== '' && r[c] !== undefined) o[c] = r[c];
    o.example = !!r.example;
    o.srr = JSON.parse(r.srr || '[]');
    if (!o.srr.length) delete o.srr;
    o.fn = JSON.parse(r.fn || '[]');
    if (!o.fn.length) delete o.fn;
    if (!o.example) delete o.example;
    return o;
  };
  function snapshot() {
    const reqs = db.prepare('SELECT * FROM req ORDER BY id').all().map(rowToReq);
    const links = db.prepare('SELECT parent, child, ord FROM link ORDER BY parent, ord').all().map(l => ({ ...l }));
    return { reqs, links };
  }
  const insertReq = db.prepare(`INSERT INTO req (id, ${COLS.join(', ')}) VALUES (?, ${COLS.map(() => '?').join(', ')})
    ON CONFLICT(id) DO UPDATE SET ${COLS.map(c => `${c} = excluded.${c}`).join(', ')}`);
  const reqValues = r => [r.id, ...COLS.map(c => (c === 'srr' || c === 'fn' ? JSON.stringify(r[c] || []) : c === 'example' ? (r.example ? 1 : 0) : r[c] ?? null))];
  function load(snap) {
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM link; DELETE FROM req;');
      for (const r of snap.reqs) insertReq.run(...reqValues(r));
      const ins = db.prepare('INSERT INTO link (parent, child, ord) VALUES (?, ?, ?)');
      for (const l of snap.links) ins.run(l.parent, l.child, l.ord);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  const writeJSON = (file, obj) => fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
  function exportWorking() { writeJSON(files.working, { format: 'congo-srr-requirements/1', ...snapshot() }); }

  // First run: rebuild from the committed working.json, or start from the seed.
  if (db.prepare('SELECT COUNT(*) AS n FROM req').get().n === 0) {
    load(fs.existsSync(files.working) ? JSON.parse(fs.readFileSync(files.working, 'utf8')) : SEED);
    exportWorking();
  }

  // ---------- edits (each one re-exports working.json) ----------
  const fail = msg => { const e = new Error(msg); e.status = 400; throw e; };
  const exists = id => !!db.prepare('SELECT 1 FROM req WHERE id = ?').get(id);
  const graph = () => build(snapshot());
  const siblings = parent => db.prepare('SELECT child, ord FROM link WHERE parent = ? ORDER BY ord').all(parent);
  // Sort position for a new link: before `beforeId`, or at the end.
  function ordFor(parent, beforeId) {
    const sib = siblings(parent);
    if (!beforeId) return (sib.at(-1)?.ord ?? 0) + 1;
    const i = sib.findIndex(s => s.child === beforeId);
    if (i < 0) return (sib.at(-1)?.ord ?? 0) + 1;
    const prev = i > 0 ? sib[i - 1].ord : sib[i].ord - 2;
    return (prev + sib[i].ord) / 2;
  }
  function mutate(fn) {
    db.exec('BEGIN');
    try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    exportWorking();
    return snapshot();
  }

  return {
    files,
    snapshot,
    saveReq(r) {
      if (!r?.id || !ID_RE.test(r.id)) fail('IDs use letters, numbers, dot, dash or underscore (max 40).');
      return mutate(() => {
        const old = db.prepare('SELECT * FROM req WHERE id = ?').get(r.id);
        insertReq.run(...reqValues({ ...(old ? rowToReq(old) : { type: 'req' }), ...r }));
      });
    },
    renameReq(from, to) {
      if (!ID_RE.test(to)) fail('IDs use letters, numbers, dot, dash or underscore (max 40).');
      if (exists(to)) fail(`${to} already exists.`);
      return mutate(() => db.prepare('UPDATE req SET id = ? WHERE id = ?').run(to, from)); // links follow (ON UPDATE CASCADE)
    },
    deleteReq(id) {
      return mutate(() => db.prepare('DELETE FROM req WHERE id = ?').run(id));
    },
    link(parent, child, beforeId) {
      if (!exists(parent) || !exists(child)) fail('Unknown requirement.');
      if (graph().wouldCycle(parent, child)) fail(`${child} can't go under ${parent}: ${parent} is already below ${child}.`);
      return mutate(() => db.prepare('INSERT OR REPLACE INTO link (parent, child, ord) VALUES (?, ?, ?)').run(parent, child, ordFor(parent, beforeId)));
    },
    unlink(parent, child) {
      return mutate(() => db.prepare('DELETE FROM link WHERE parent = ? AND child = ?').run(parent, child));
    },
    // Move a requirement from one parent to another (or reorder under the same parent).
    move(id, from, to, beforeId) {
      if (!exists(id) || !exists(to)) fail('Unknown requirement.');
      const g = graph();
      if (g.wouldCycle(to, id)) fail(`${id} can't go under ${to}: ${to} is already below ${id}.`);
      return mutate(() => {
        if (from) db.prepare('DELETE FROM link WHERE parent = ? AND child = ?').run(from, id);
        db.prepare('DELETE FROM link WHERE parent = ? AND child = ?').run(to, id);
        db.prepare('INSERT INTO link (parent, child, ord) VALUES (?, ?, ?)').run(to, id, ordFor(to, beforeId === id ? null : beforeId));
      });
    },
    clearExamples() {
      return mutate(() => db.prepare('DELETE FROM req WHERE example = 1').run());
    },
    replaceAll(snap) { load(snap); exportWorking(); return snapshot(); },

    // ---------- baselines ----------
    baselines() {
      const idx = path.join(files.baselines, 'index.json');
      return fs.existsSync(idx) ? JSON.parse(fs.readFileSync(idx, 'utf8')) : [];
    },
    baseline(slug) {
      const f = path.join(files.baselines, `${slug}.json`);
      if (!/^[a-z0-9-]+$/.test(slug) || !fs.existsSync(f)) fail('Unknown baseline.');
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    },
    finalize(name, note = '') {
      name = String(name || '').trim();
      if (!name) fail('Give the baseline a name, e.g. "SRR baseline v1".');
      const created = new Date().toISOString();
      const slug = `${created.slice(0, 10)}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 60);
      const snap = { format: 'congo-srr-requirements/1', baseline: { slug, name, note, created }, ...snapshot() };
      writeJSON(path.join(files.baselines, `${slug}.json`), snap);
      const list = this.baselines().filter(b => b.slug !== slug);
      list.push({ slug, name, note, created, count: snap.reqs.length });
      writeJSON(path.join(files.baselines, 'index.json'), list);
      writeJSON(files.published, snap);
      return { slug, list };
    },
  };
}

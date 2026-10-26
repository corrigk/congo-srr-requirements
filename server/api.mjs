// JSON API for the local editor, mounted on the Vite dev server (see vite.config.js). Local use only.
//   GET  /api/data                 current graph + baseline list
//   GET  /api/baseline/:slug       one frozen baseline
//   POST /api/req      {req}       create or update
//   POST /api/rename   {from, to}
//   POST /api/delete   {id}
//   POST /api/link     {parent, child, before?}        add a parent (keeps existing ones)
//   POST /api/unlink   {parent, child}
//   POST /api/move     {id, from?, to, before?}        re-parent or reorder
//   POST /api/clear-examples
//   POST /api/finalize {name, note?}
import { openStore } from './db.mjs';

export function apiMiddleware(root) {
  const store = openStore(root);
  const body = req => new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => { s += c; });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
  });
  const send = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
  const data = snap => ({ ...snap, baselines: store.baselines() });

  return async (req, res, next) => {
    if (!req.url.startsWith('/api/')) return next();
    const [, , route, arg] = req.url.split('?')[0].split('/');
    try {
      if (req.method === 'GET' && route === 'data') return send(res, 200, data(store.snapshot()));
      if (req.method === 'GET' && route === 'baseline') return send(res, 200, store.baseline(arg));
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      const b = await body(req);
      const actions = {
        req: () => store.saveReq(b.req),
        rename: () => store.renameReq(b.from, b.to),
        delete: () => store.deleteReq(b.id),
        link: () => store.link(b.parent, b.child, b.before),
        unlink: () => store.unlink(b.parent, b.child),
        move: () => store.move(b.id, b.from, b.to, b.before),
        'clear-examples': () => store.clearExamples(),
        finalize: () => { const f = store.finalize(b.name, b.note); return { ...store.snapshot(), finalized: f.slug }; },
      };
      if (!actions[route]) return send(res, 404, { error: 'Unknown action' });
      const out = actions[route]();
      return send(res, 200, data(out));
    } catch (e) {
      return send(res, e.status || 500, { error: e.message });
    }
  };
}

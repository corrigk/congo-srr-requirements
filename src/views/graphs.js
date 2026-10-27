// Thread tree, radial, and force graph. All three draw every parent link, so a requirement with two parents shows
// two threads (the second dashed). Clicking a block lights its whole thread, above and below; everything else dims.
import { hierarchy, tree as d3tree, select, zoom, zoomIdentity, linkHorizontal, linkVertical, linkRadial,
  forceSimulation, forceLink, forceManyBody, forceX, forceY, forceCollide, drag } from 'd3';
import { short } from '../model.js';

const BOX_W = 232, BOX_H = 26, COL = 290, ROW = 32;

// The primary tree (each node under the parent through which it is first reached), rooted at a virtual node.
function primaryTree(m) {
  return hierarchy({ id: '__root' }, d => (d.id === '__root' ? m.mos : m.childrenOf(d.id).filter(c => m.primary.get(c) === d.id).map(id => ({ id }))));
}

// An <svg> filling the stage with pan / zoom. The transform is remembered per view and selection, so picking a
// requirement frames its thread and clearing the selection returns to the overview.
function canvas(el, ctx, view, fit, label = view) {
  const key = `${view}:${ctx.state.selected || ''}`;
  const { width: W, height: H } = el.getBoundingClientRect();
  el.innerHTML = `<svg class="gv" width="${W}" height="${H}" role="img" aria-label="${label} view of the requirements"><g class="gv-root"></g></svg>
    <div class="gv-tools"><button class="btn btn-ghost" data-fit>Fit</button></div>`;
  const svg = select(el).select('svg'), g = svg.select('g');
  const z = zoom().scaleExtent([0.15, 4]).on('zoom', e => { g.attr('transform', e.transform); if (e.sourceEvent) ctx.state.zoom[key] = e.transform; }); // remember only zooms you made yourself
  svg.call(z).on('dblclick.zoom', null);
  const doFit = (all = false) => { ctx.fitAll = all; const t = fit(W, H); ctx.fitAll = false; svg.call(z.transform, t); };
  el.querySelector('[data-fit]').onclick = () => doFit(true);
  if (ctx.state.zoom[key]) svg.call(z.transform, ctx.state.zoom[key]); else doFit();
  return { svg, g, W, H, doFit, userZoomed: !!ctx.state.zoom[key] };
}

const lit = (ctx, a, b) => ctx.on(a) && ctx.on(b);
const extraLinks = m => m.links.filter(l => m.primary.get(l.child) !== l.parent && m.get(l.parent)?.level != null);

// ---------- thread tree: across (L0 left → L4 right) or down (L0 top → L4 bottom) ----------
// Depth control folds everything below a level into "+N" badges (click one to open that branch). With segments
// chosen, the tree shows only those requirements plus the parents above them (focus view).
const V_W = 196, V_COL = 214, V_ROW = 70, V_STACK = 31, V_INDENT = 18;

// The visible tree for the current depth, expansions, segment focus and selected thread.
function visibleTree(m, ctx, { pinned = true } = {}) {
  const st = ctx.state, limit = st.depth ?? Infinity;
  const moIds = m.mos.map(x => x.id);
  let keep = null;
  if (st.segs.size) {
    keep = new Set(moIds);
    for (const r of m.reqs) if (st.segs.has(r.segment)) for (let id = r.id; id && !keep.has(id); id = m.primary.get(id)) keep.add(id);
  }
  const kids = id => m.childrenOf(id).filter(c => m.primary.get(c) === id && (!keep || keep.has(c)));
  const below = new Map();
  const count = id => { if (!below.has(id)) below.set(id, kids(id).reduce((n, c) => n + 1 + count(c), 0)); return below.get(id); };
  const hidden = new Map(); // id -> number of requirements folded under it
  const open = (id, depth) => depth < limit || (pinned && (st.expanded.has(id) || (ctx.focus && kids(id).some(c => ctx.focus.has(c)))));
  const node = (id, depth) => {
    const k = kids(id);
    if (!k.length) return { id };
    if (!open(id, depth)) { hidden.set(id, count(id)); return { id }; }
    return { id, children: k.map(c => node(c, depth + 1)) };
  };
  const data = { id: '__root', children: moIds.filter(id => !keep || keep.has(id)).map(id => node(id, 0)) };
  const shown = keep ? m.reqs.filter(r => r.type !== 'mo' && st.segs.has(r.segment)).length : null;
  return { data, hidden, keep, shown };
}

// Across: d3's tidy tree, one column per level.
function layoutAcross(data) {
  const root = hierarchy(data);
  d3tree().nodeSize([ROW, COL]).separation((a, b) => (a.parent === b.parent ? 1 : 1.25))(root);
  const pos = new Map(), edges = [];
  for (const d of root.descendants()) if (d.depth > 0) {
    pos.set(d.data.id, { x: (d.depth - 1) * COL, y: d.x, w: BOX_W, depth: d.depth - 1 });
    if (d.depth > 1) edges.push({ parent: d.parent.data.id, child: d.data.id, kind: 'h' });
  }
  return { pos, edges, dir: 'h' };
}

// Down: one row per level. Each run of sibling leaves stacks in a column under its parent (org-chart style),
// so 170-odd leaves don't make the tree tens of thousands of pixels wide.
function layoutDown(data) {
  const pack = d => {
    if (!d.children) return d;
    const out = [];
    for (const k of d.children.map(pack)) {
      const last = out.at(-1), leaf = !k.children;
      if (leaf && last?.run) last.stack.push(k.id);
      else out.push(leaf ? { id: `__stack:${k.id}`, run: true, stack: [k.id] } : k);
    }
    return { ...d, children: out };
  };
  const root = hierarchy(pack(data));
  d3tree().nodeSize([V_COL, V_ROW]).separation((a, b) => (a.parent === b.parent ? 1 : 1.12))(root);
  const pos = new Map(), edges = [];
  for (const d of root.descendants()) {
    if (d.depth === 0) continue;
    if (d.data.stack) {
      const p = d.parent.data.id;
      d.data.stack.forEach((id, i) => {
        pos.set(id, { x: d.x - V_W / 2 + V_INDENT, y: (d.depth - 1) * V_ROW + i * V_STACK, w: V_W - V_INDENT, depth: d.depth - 1 });
        edges.push({ parent: p, child: id, kind: 'rail' });
      });
      continue;
    }
    pos.set(d.data.id, { x: d.x - V_W / 2, y: (d.depth - 1) * V_ROW, w: V_W, depth: d.depth - 1 });
    if (d.depth > 1) edges.push({ parent: d.parent.data.id, child: d.data.id, kind: 'v' });
  }
  return { pos, edges, dir: 'v' };
}

const extent = ps => ({
  x0: Math.min(...ps.map(p => p.x)), x1: Math.max(...ps.map(p => p.x + p.w)),
  y0: Math.min(...ps.map(p => p.y)) - ROW, y1: Math.max(...ps.map(p => p.y)) + ROW,
});
const fitScale = (L, W, H) => { const e = extent([...L.pos.values()]); return Math.min((W - 80) / (e.x1 - e.x0), (H - 140) / (e.y1 - e.y0 + 40)); };

export const tree = {
  render(el, ctx) {
    const m = ctx.model, st = ctx.state;
    const vis = visibleTree(m, ctx);
    const { width: W0, height: H0 } = el.getBoundingClientRect();
    const across = layoutAcross(vis.data), down = layoutDown(vis.data);
    // Auto: whichever direction fits the stage at the larger scale, judged on the tree before any branch was opened
    // by hand, so opening a branch or picking a thread never flips the direction.
    const base = visibleTree(m, ctx, { pinned: false }).data;
    const auto = fitScale(layoutDown(base), W0, H0) > fitScale(layoutAcross(base), W0, H0) * 1.05 ? 'v' : 'h';
    const L = (st.dir === 'auto' ? auto : st.dir) === 'v' ? down : across;
    const { pos } = L, vert = L.dir === 'v';
    const ids = [...pos.keys()];

    const fit = (W, H) => {
      const box = ctx.focus && !ctx.fitAll ? ids.filter(id => ctx.focus.has(id)) : ids;
      const e = extent((box.length ? box : ids).map(id => pos.get(id)));
      const k = Math.min(1.25, (W - 80) / (e.x1 - e.x0), (H - 140) / (e.y1 - e.y0 + 40));
      // A long thread in a small stage would be unreadable: keep labels legible and centre the selected block.
      const sel = st.selected && pos.get(st.selected);
      if (sel && k < 0.75 && !ctx.fitAll) return zoomIdentity.translate(W / 2 - (sel.x + sel.w / 2) * 0.75, H / 2 - sel.y * 0.75).scale(0.75);
      return zoomIdentity.translate((W - (e.x1 - e.x0) * k) / 2 - e.x0 * k, (H - (e.y1 - e.y0) * k) / 2 - e.y0 * k + 30).scale(k);
    };
    const key = `tree:${L.dir}:${st.depth ?? 'all'}:${[...st.segs].join(',')}`;
    const { g } = canvas(el, ctx, key, fit, 'Thread tree');

    // Level labels over each column (across). Down, stacked leaves share rows with the next level, so only the
    // MO row is labelled; block IDs carry their level (L1-, L2-…).
    const ps = [...pos.values()], e = extent(ps), levels = vert ? [0] : [...new Set(ps.map(p => p.depth))].sort((a, b) => a - b);
    const rowY = l => Math.min(...ps.filter(p => p.depth === l).map(p => p.y));
    g.append('g').attr('class', 'gv-levels').selectAll('text').data(levels).join('text')
      .attr('x', l => (vert ? e.x0 - 24 : l * COL)).attr('y', l => (vert ? rowY(l) + 4 : e.y0 - 16))
      .attr('text-anchor', vert ? 'end' : 'start')
      .text(l => (l === 0 ? (vert ? 'L0 · MOs' : 'Level 0 · Mission objectives') : vert ? `L${l}` : `Level ${l}`));

    const ph = linkHorizontal().x(p => p[0]).y(p => p[1]), pv = linkVertical().x(p => p[0]).y(p => p[1]);
    const edge = l => {
      const a = pos.get(l.parent), b = pos.get(l.child);
      if (l.kind === 'rail') return `M${a.x + a.w / 2},${a.y + BOX_H / 2}V${a.y + V_ROW / 2}H${b.x - V_INDENT + 10}V${b.y}H${b.x}`;
      if (vert) return pv({ source: [a.x + a.w / 2, a.y + BOX_H / 2], target: [b.x + b.w / 2, b.y - BOX_H / 2] });
      return ph({ source: [a.x + a.w, a.y], target: [b.x, b.y] });
    };
    const all = [
      ...L.edges.map(l => ({ ...l, extra: false })),
      ...extraLinks(m).filter(l => pos.has(l.parent) && pos.has(l.child)).map(l => ({ ...l, extra: true, kind: vert ? 'v' : 'h' })),
    ];
    // In a segment focus the parents above the chosen requirements are context: half strength, not dimmed away.
    const plainFocus = vis.keep && !ctx.focus && !st.search.trim();
    const isCtx = id => vis.keep && m.get(id).type !== 'mo' && !st.segs.has(m.get(id).segment) && (!ctx.focus || ctx.focus.has(id));
    g.append('g').selectAll('path').data(all).join('path')
      .attr('class', l => `gv-link${l.extra ? ' is-extra' : ''}${ctx.filtered && !lit(ctx, l.parent, l.child) && !plainFocus ? ' is-dim' : ''}${ctx.focus && lit(ctx, l.parent, l.child) ? ' is-hot' : ''}`)
      .attr('stroke', l => ctx.color(m.get(l.child))).attr('d', edge);

    const n = g.append('g').selectAll('g').data(ids).join('g')
      .attr('class', id => { const r = m.get(id); return `gv-node${r.type === 'mo' ? ' is-mo' : ''}${ctx.on(id) ? '' : isCtx(id) ? ' is-ctx' : ' is-dim'}${st.selected === id ? ' is-sel' : ''}`; })
      .attr('transform', id => `translate(${pos.get(id).x},${pos.get(id).y - BOX_H / 2})`)
      .attr('data-select', id => id).attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', id => `${id} ${m.get(id).name || ''}`)
      .style('--c', id => ctx.color(m.get(id)));
    n.append('rect').attr('width', id => pos.get(id).w).attr('height', BOX_H).attr('rx', 6);
    n.append('rect').attr('class', 'gv-stripe').attr('width', 4).attr('height', BOX_H).attr('rx', 2);
    n.append('text').attr('class', 'gv-id').attr('x', 11).attr('y', 17).text(id => id);
    // In the down layout the +N badge sits inside the block's right end, so the name makes room for it.
    const room = id => pos.get(id).w - 30 - id.length * 7.2 - (vert && (vis.hidden.has(id) || st.expanded.has(id)) ? 42 : 0);
    n.append('text').attr('class', 'gv-nm').attr('x', id => 11 + id.length * 7.2 + 8).attr('y', 17)
      .text(id => short(m.get(id).name, Math.max(3, Math.floor(room(id) / 6.6))));
    n.append('title').text(id => `${id} · ${m.get(id).name || ''}\n${m.get(id).statement || ''}`);

    // "+N" on a folded block opens that branch; "−" on a branch opened past the depth limit folds it again.
    const toggles = ids.filter(id => vis.hidden.has(id) || st.expanded.has(id));
    const t = g.append('g').selectAll('g').data(toggles).join('g')
      .attr('class', id => `gv-more${ctx.on(id) ? '' : isCtx(id) ? ' is-ctx' : ' is-dim'}`).attr('data-expand', id => id).attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', id => (vis.hidden.has(id) ? `Show ${vis.hidden.get(id)} requirements below ${id}` : `Fold the branch below ${id}`))
      .attr('transform', id => { const p = pos.get(id); return vert ? `translate(${p.x + p.w - 41},${p.y - 9})` : `translate(${p.x + p.w + 6},${p.y - 9})`; });
    t.append('rect').attr('width', 36).attr('height', 18).attr('rx', 9);
    t.append('text').attr('x', 18).attr('y', 13).attr('text-anchor', 'middle').text(id => (vis.hidden.has(id) ? `+${vis.hidden.get(id)}` : '−'));

    // Controls: direction and depth, plus the focus bar when segments are chosen.
    const seg = (name, attr, items, cur) => `<div class="gv-seg" role="group" aria-label="${name}"><span>${name}</span>${items.map(([v, l]) =>
      `<button data-${attr}="${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div>`;
    const depths = [...Array(m.maxLevel).keys()].map(i => [String(i + 1), `L${i + 1}`]);
    el.insertAdjacentHTML('beforeend', `<div class="gv-ctl">
      ${seg('Direction', 'tree-dir', [['auto', `Auto · ${vert ? 'down' : 'across'}`], ['h', 'Across'], ['v', 'Down']], st.dir)}
      ${seg('Depth', 'tree-depth', [...depths, ['all', 'All']], st.depth == null ? 'all' : String(st.depth))}
      ${st.expanded.size ? '<button class="btn btn-ghost" data-tree-fold>Fold opened branches</button>' : ''}
    </div>`);
    if (vis.keep) {
      el.insertAdjacentHTML('beforeend', `<div class="gv-focusbar" role="status"><span>Focus: <b>${ctx.esc([...st.segs].join(', '))}</b></span>
        <span>${vis.shown} of ${m.reqs.filter(r => r.type !== 'mo').length} requirements, with the parents above them</span>
        <button class="btn btn-ghost" data-act="seg-clear">Show all</button></div>`);
    }
    if (m.orphans.length) el.insertAdjacentHTML('beforeend', `<div class="gv-note">${m.orphans.length} not connected: see the Outline</div>`);
  },
};

// ---------- radial: MOs on the first ring, each level one ring further out ----------
export const radial = {
  render(el, ctx) {
    const m = ctx.model, root = primaryTree(m);
    const { width: W0, height: H0 } = el.getBoundingClientRect();
    const R = Math.max(320, Math.min(W0, H0) / 2 - 90), ring = R / Math.max(1, m.maxLevel + 1);
    d3tree().size([2 * Math.PI, R]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth))(root);
    const nodes = root.descendants().filter(d => d.depth > 0);
    const polar = new Map(nodes.map(d => [d.data.id, { a: d.x, r: d.depth * ring }]));
    const xy = ({ a, r }) => [r * Math.sin(a), -r * Math.cos(a)];
    const fit = (W, H) => zoomIdentity.translate(W / 2, H / 2 + 10).scale(Math.min(1.1, (Math.min(W, H) - 40) / (2 * (R + 80))));
    const { g } = canvas(el, ctx, 'radial', fit);

    g.append('g').attr('class', 'gv-rings').selectAll('circle').data([...Array(m.maxLevel + 1).keys()]).join('circle').attr('r', l => (l + 1) * ring);
    g.append('g').attr('class', 'gv-levels').selectAll('text').data([...Array(m.maxLevel + 1).keys()]).join('text')
      .attr('x', 4).attr('y', l => -(l + 1) * ring - 4).text(l => `L${l}`);
    g.append('text').attr('class', 'gv-center').attr('text-anchor', 'middle').attr('y', 6).text('S-3');

    const rl = linkRadial().angle(p => p.a).radius(p => p.r);
    const all = [
      ...nodes.map(d => ({ parent: d.parent.depth ? d.parent.data.id : null, child: d.data.id, extra: false })),
      ...extraLinks(m).filter(l => polar.has(l.parent) && polar.has(l.child)).map(l => ({ ...l, extra: true })),
    ];
    g.append('g').selectAll('path').data(all).join('path')
      .attr('class', l => `gv-link${l.extra ? ' is-extra' : ''}${ctx.filtered && !(l.parent ? lit(ctx, l.parent, l.child) : ctx.on(l.child)) ? ' is-dim' : ''}`)
      .attr('stroke', l => ctx.color(m.get(l.child)))
      .attr('d', l => rl({ source: l.parent ? polar.get(l.parent) : { a: polar.get(l.child).a, r: 0 }, target: polar.get(l.child) }));

    const size = l => [11, 7.5, 6, 5, 4.5][l] ?? 4;
    const n = g.append('g').selectAll('g').data(nodes).join('g')
      .attr('class', d => { const r = m.get(d.data.id); return `gv-dot${ctx.on(r.id) ? '' : ' is-dim'}${ctx.state.selected === r.id ? ' is-sel' : ''}`; })
      .attr('transform', d => `translate(${xy(polar.get(d.data.id)).join(',')})`)
      .attr('data-select', d => d.data.id).attr('tabindex', 0).attr('role', 'button');
    n.append('circle').attr('r', d => size(d.depth - 1)).attr('fill', d => ctx.color(m.get(d.data.id)));
    n.append('text')
      .attr('transform', d => { const deg = (d.x * 180) / Math.PI - 90; return `rotate(${deg}) translate(${size(d.depth - 1) + 5},0) ${d.x > Math.PI ? 'rotate(180)' : ''}`; })
      .attr('text-anchor', d => (d.x > Math.PI ? 'end' : 'start')).attr('dy', '0.32em')
      .attr('class', d => (d.depth === 1 ? 'gv-id is-mo' : 'gv-id'))
      // Overview: label the MOs and the outer leaves only (inner labels would cross the next ring).
      // With a thread selected, label every block in it.
      .text(d => {
        const id = d.data.id, leaf = !d.children;
        if (ctx.focus) return ctx.focus.has(id) ? id : '';
        return d.depth === 1 ? `${id} ${m.get(id).name || ''}` : leaf ? id : '';
      });
    n.append('title').text(d => `${d.data.id} · ${m.get(d.data.id).name || ''}\n${m.get(d.data.id).statement || ''}`);
  },
};

// ---------- force graph: every requirement and link as a web of strings, drifting left to right by level ----------
const posCache = new Map();
let sim = null;
export const stopForce = () => sim?.stop();
export const force = {
  render(el, ctx) {
    const m = ctx.model;
    sim?.stop();
    const nodes = m.reqs.map(r => ({ id: r.id, level: r.level ?? m.maxLevel + 1, ...(posCache.get(r.id) || {}) }));
    const links = m.links.map(l => ({ source: l.parent, target: l.child }));
    const span = 170;
    // Fit the laid-out web (or the selected thread) once the simulation has settled.
    const fit = (W, H) => {
      const box = nodes.filter(d => d.x != null && (!ctx.focus || ctx.focus.has(d.id) || ctx.fitAll));
      if (!box.length) return zoomIdentity.translate(W / 2 - ((m.maxLevel + 1) * span) / 2, H / 2).scale(0.9);
      const x0 = Math.min(...box.map(d => d.x)) - 40, x1 = Math.max(...box.map(d => d.x)) + 120;
      const y0 = Math.min(...box.map(d => d.y)) - 40, y1 = Math.max(...box.map(d => d.y)) + 40;
      const k = Math.min(1.6, (W - 40) / (x1 - x0), (H - 40) / (y1 - y0));
      return zoomIdentity.translate((W - (x1 - x0) * k) / 2 - x0 * k, (H - (y1 - y0) * k) / 2 - y0 * k).scale(k);
    };
    const { g, doFit, userZoomed } = canvas(el, ctx, 'graph', fit);

    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('class', l => `gv-link${ctx.filtered && !lit(ctx, l.source, l.target) ? ' is-dim' : ''}`)
      .attr('stroke', l => ctx.color(m.get(l.target)));
    const size = l => [16, 10, 7.5, 6, 5][l] ?? 5;
    const node = g.append('g').selectAll('g').data(nodes).join('g')
      .attr('class', d => `gv-dot${ctx.on(d.id) ? '' : ' is-dim'}${ctx.state.selected === d.id ? ' is-sel' : ''}`)
      .attr('data-select', d => d.id).attr('tabindex', 0).attr('role', 'button');
    node.append('circle').attr('r', d => size(d.level)).attr('fill', d => ctx.color(m.get(d.id)));
    node.append('text').attr('class', d => `gv-id${d.level === 0 ? ' is-mo' : ''}`).attr('x', d => size(d.level) + 4).attr('dy', '0.32em')
      .text(d => (d.level <= 1 || (ctx.filtered && ctx.on(d.id)) ? d.id : ''));
    node.append('title').text(d => `${d.id} · ${m.get(d.id).name || ''}`);

    sim = forceSimulation(nodes)
      .force('link', forceLink(links).id(d => d.id).distance(l => 46 + 8 * (l.target.level || 0)).strength(0.7))
      .force('charge', forceManyBody().strength(-210))
      .force('x', forceX(d => d.level * span).strength(0.22))
      .force('y', forceY(0).strength(0.04))
      .force('collide', forceCollide(d => size(d.level) + 6))
      .alpha(posCache.size ? 0.25 : 1)
      .on('tick', () => {
        link.attr('x1', l => l.source.x).attr('y1', l => l.source.y).attr('x2', l => l.target.x).attr('y2', l => l.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
        for (const d of nodes) posCache.set(d.id, { x: d.x, y: d.y });
      })
      .on('end', () => { if (!userZoomed) doFit(); });
    node.call(drag()
      .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
  },
};

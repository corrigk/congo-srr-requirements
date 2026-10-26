// Thread tree, radial, and force graph. All three draw every parent link, so a requirement with two parents shows
// two threads (the second dashed). Clicking a block lights its whole thread, above and below; everything else dims.
import { hierarchy, tree as d3tree, select, zoom, zoomIdentity, linkHorizontal, linkRadial,
  forceSimulation, forceLink, forceManyBody, forceX, forceY, forceCollide, drag } from 'd3';
import { short } from '../model.js';

const BOX_W = 232, BOX_H = 26, COL = 290, ROW = 32;

// The primary tree (each node under the parent through which it is first reached), rooted at a virtual node.
function primaryTree(m) {
  return hierarchy({ id: '__root' }, d => (d.id === '__root' ? m.mos : m.childrenOf(d.id).filter(c => m.primary.get(c) === d.id).map(id => ({ id }))));
}

// An <svg> filling the stage with pan / zoom. The transform is remembered per view and selection, so picking a
// requirement frames its thread and clearing the selection returns to the overview.
function canvas(el, ctx, view, fit) {
  const key = `${view}:${ctx.state.selected || ''}`;
  const { width: W, height: H } = el.getBoundingClientRect();
  el.innerHTML = `<svg class="gv" width="${W}" height="${H}" role="img" aria-label="${view} view of the requirements"><g class="gv-root"></g></svg>
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

// ---------- thread tree (left to right: L0 → L4) ----------
export const tree = {
  render(el, ctx) {
    const m = ctx.model, root = primaryTree(m);
    d3tree().nodeSize([ROW, COL]).separation((a, b) => (a.parent === b.parent ? 1 : 1.25))(root);
    const nodes = root.descendants().filter(d => d.depth > 0);
    const pos = new Map(nodes.map(d => [d.data.id, { x: (d.depth - 1) * COL, y: d.x }]));
    const xs = nodes.map(d => d.x);
    const top = Math.min(...xs);
    // Fit everything, or just the selected thread.
    const fit = (W, H) => {
      const box = (ctx.focus ? nodes.filter(d => ctx.focus.has(d.data.id)) : nodes);
      const y0 = Math.min(...box.map(d => d.x)) - ROW, y1 = Math.max(...box.map(d => d.x)) + ROW;
      const x0 = Math.min(...box.map(d => (d.depth - 1) * COL)), x1 = Math.max(...box.map(d => (d.depth - 1) * COL)) + BOX_W;
      const k = Math.min(1.25, (W - 80) / (x1 - x0), (H - 100) / (y1 - y0 + 40));
      // A long thread in a narrow stage would be unreadable: keep labels legible and centre the selected block.
      const sel = ctx.state.selected && pos.get(ctx.state.selected);
      if (sel && k < 0.75 && !ctx.fitAll) return zoomIdentity.translate(W / 2 - (sel.x + BOX_W / 2) * 0.75, H / 2 - sel.y * 0.75).scale(0.75);
      return zoomIdentity.translate((W - (x1 - x0) * k) / 2 - x0 * k, (H - (y1 - y0) * k) / 2 - y0 * k + 20).scale(k);
    };
    const { g } = canvas(el, ctx, 'tree', fit);

    g.append('g').attr('class', 'gv-levels').selectAll('text').data([...Array(m.maxLevel + 1).keys()]).join('text')
      .attr('x', l => l * COL).attr('y', top - 40).text(l => (l === 0 ? 'Level 0 · Mission objectives' : `Level ${l}`));

    const path = linkHorizontal().x(p => p[0]).y(p => p[1]);
    const edge = (a, b) => path({ source: [pos.get(a).x + BOX_W, pos.get(a).y], target: [pos.get(b).x, pos.get(b).y] });
    const all = [
      ...nodes.filter(d => d.depth > 1).map(d => ({ parent: d.parent.data.id, child: d.data.id, extra: false })),
      ...extraLinks(m).filter(l => pos.has(l.parent) && pos.has(l.child)).map(l => ({ ...l, extra: true })),
    ];
    g.append('g').selectAll('path').data(all).join('path')
      .attr('class', l => `gv-link${l.extra ? ' is-extra' : ''}${ctx.filtered && !lit(ctx, l.parent, l.child) ? ' is-dim' : ''}${ctx.focus && lit(ctx, l.parent, l.child) ? ' is-hot' : ''}`)
      .attr('stroke', l => ctx.color(m.get(l.child))).attr('d', l => edge(l.parent, l.child));

    const n = g.append('g').selectAll('g').data(nodes).join('g')
      .attr('class', d => { const r = m.get(d.data.id); return `gv-node${r.type === 'mo' ? ' is-mo' : ''}${ctx.on(r.id) ? '' : ' is-dim'}${ctx.state.selected === r.id ? ' is-sel' : ''}`; })
      .attr('transform', d => `translate(${(d.depth - 1) * COL},${d.x - BOX_H / 2})`)
      .attr('data-select', d => d.data.id).attr('tabindex', 0).attr('role', 'button')
      .style('--c', d => ctx.color(m.get(d.data.id)));
    n.append('rect').attr('width', BOX_W).attr('height', BOX_H).attr('rx', 6);
    n.append('rect').attr('class', 'gv-stripe').attr('width', 4).attr('height', BOX_H).attr('rx', 2);
    n.append('text').attr('class', 'gv-id').attr('x', 11).attr('y', 17).text(d => d.data.id);
    n.append('text').attr('class', 'gv-nm').attr('x', d => 11 + d.data.id.length * 7.2 + 8).attr('y', 17)
      .text(d => short(m.get(d.data.id).name, Math.max(6, 30 - d.data.id.length)));
    n.append('title').text(d => `${d.data.id} · ${m.get(d.data.id).name || ''}\n${m.get(d.data.id).statement || ''}`);
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

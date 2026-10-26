// Outline: the whole decomposition as an indented list. In the editor, drag a block onto another to make it a
// child, or above / below one to reorder. Hold Ctrl (or Alt) while dropping to ADD a parent instead of moving.
import { checks, short } from '../model.js';
import { ICON } from '../icons.js';
import { addChild } from '../panel.js';

const collapsed = new Set();
let ctxRef = null, bound = false;

export function render(el, ctx) {
  ctxRef = ctx;
  const { model: m, esc, readonly, state } = ctx;
  const vName = { I: 'Inspection', A: 'Analysis', D: 'Demonstration', T: 'Test' };

  const row = (id, parent, depth, path) => {
    const r = m.get(id), key = `${path}/${id}`;
    const secondary = parent && m.primary.get(id) !== parent; // shown again under a second parent
    const kids = r.children;
    const open = !collapsed.has(key) && !secondary;
    const others = r.parents.filter(p => p !== parent);
    return `
      <li class="ol-item${secondary ? ' is-secondary' : ''}" data-key="${esc(key)}">
        <div class="ol-row${ctx.on(id) ? '' : ' is-dim'}${state.selected === id ? ' is-sel' : ''}${r.type === 'mo' ? ' is-mo' : ''}"
             data-id="${esc(id)}" data-parent="${esc(parent || '')}" ${readonly || r.type === 'mo' ? '' : 'draggable="true"'} style="--c:${ctx.color(r)}; --d:${depth}">
          ${readonly || r.type === 'mo' ? '<span class="ol-grip"></span>' : `<span class="ol-grip" title="Drag to move · Ctrl+drag to add a parent">${ICON.grip}</span>`}
          <button class="ol-caret${kids.length && !secondary ? '' : ' is-leaf'}${open ? ' is-open' : ''}" data-toggle="${esc(key)}" aria-label="Expand or collapse" ${kids.length && !secondary ? '' : 'tabindex="-1"'}>${ICON.caret}</button>
          <span class="ol-num">${esc(r.outline || '–')}</span>
          <button class="ol-main" data-select="${esc(id)}">
            <span class="ol-id">${esc(id)}</span>
            <span class="ol-name">${esc(r.name || '')}</span>
            <span class="ol-st">${esc(short(r.statement, 120))}</span>
          </button>
          <span class="ol-tags">
            ${secondary ? `<span class="tag tag-link" title="Also under ${esc(m.primary.get(id) || '')}">${ICON.link} also here</span>` : ''}
            ${!secondary && others.length ? `<span class="tag tag-link" title="Also under ${esc(others.join(', '))}">${ICON.link} +${others.length}</span>` : ''}
            ${r.example ? '<span class="tag tag-ex">Example</span>' : ''}
            ${r.status && r.type !== 'mo' ? `<span class="tag tag-st is-${esc(r.status)}">${esc(r.status)}</span>` : ''}
            ${r.verification ? `<span class="tag" title="${vName[r.verification]}">${r.verification}</span>` : ''}
            ${r.segment && r.type !== 'mo' ? `<span class="tag">${esc(r.segment)}</span>` : ''}
          </span>
          ${readonly ? '' : `<button class="ol-add" data-addchild="${esc(id)}" title="Add a child requirement" aria-label="Add a child under ${esc(id)}">${ICON.plus}</button>`}
        </div>
        ${open && kids.length ? `<ol>${kids.map(c => row(c, id, depth + 1, key)).join('')}</ol>` : ''}
      </li>`;
  };

  const issues = readonly ? [] : checks(m);
  const sev = { error: 0, warn: 1, info: 2 };
  el.innerHTML = `
    <div class="ol-wrap">
      ${readonly ? '' : `
      <div class="ol-actions">
        <button class="btn" data-ol="new">${ICON.plus} New requirement</button>
        <button class="btn btn-ghost" data-ol="checks" aria-expanded="${!!state.showChecks}">Checks · ${issues.filter(i => i.severity !== 'info').length} to fix · ${issues.filter(i => i.severity === 'info').length} notes</button>
        ${m.reqs.some(r => r.example) ? `<button class="btn btn-ghost" data-ol="clear-examples">Delete all examples (${m.reqs.filter(r => r.example).length})</button>` : ''}
        <span class="ol-hint">Drag <kbd>⋮⋮</kbd> onto a block to nest it, above or below to reorder. Hold <kbd>Ctrl</kbd> while dropping to add a second parent.</span>
      </div>
      ${state.showChecks ? `<ul class="ol-checks">${issues.sort((a, b) => sev[a.severity] - sev[b.severity]).map(i => `
        <li class="is-${i.severity}"><button data-select="${esc(i.id)}"><b>${esc(i.id)}</b><span>${esc(i.text)}</span></button></li>`).join('') || '<li class="is-ok">Nothing to fix.</li>'}</ul>` : ''}`}
      <ol class="ol-tree">${m.mos.map(mo => row(mo.id, null, 0, '')).join('')}</ol>
      ${m.orphans.length ? `<div class="ol-orphans"><div class="ol-sec">Not connected <small>drag onto a parent</small></div><ol class="ol-tree">${m.orphans.map(id => row(id, null, 0, 'orphan')).join('')}</ol></div>` : ''}
    </div>`;

  if (!bound) { bind(el); bound = true; }
}

function bind(el) {
  let drag = null;
  const zoneOf = (row, e) => {
    const b = row.getBoundingClientRect(), y = (e.clientY - b.top) / b.height;
    return y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
  };
  const clearMarks = () => el.querySelectorAll('.drop-before, .drop-after, .drop-inside').forEach(n => n.classList.remove('drop-before', 'drop-after', 'drop-inside'));

  el.addEventListener('click', async e => {
    const ctx = ctxRef;
    const t = e.target.closest('[data-toggle], [data-addchild], [data-ol]');
    if (!t) return;
    if (t.dataset.toggle) { collapsed.has(t.dataset.toggle) ? collapsed.delete(t.dataset.toggle) : collapsed.add(t.dataset.toggle); return ctx.rerender(); }
    if (t.dataset.addchild) return addChild(ctx, t.dataset.addchild);
    const act = t.dataset.ol;
    if (act === 'checks') { ctx.state.showChecks = !ctx.state.showChecks; return ctx.rerender(); }
    if (act === 'new') {
      let n = ctx.model.reqs.length + 1, id = `REQ-${n}`;
      while (ctx.model.get(id)) id = `REQ-${++n}`;
      await ctx.api('req', { req: { id, type: 'req', name: 'New requirement', status: 'draft', source: 'derived', statement: 'The system shall ' } });
      ctx.state.selected = id; ctx.rerender();
      ctx.toast(`${id} added under "Not connected": drag it onto its parent.`);
    }
    if (act === 'clear-examples' && confirm('Delete every requirement marked "Example"? Your own requirements stay.')) {
      await ctx.api('clear-examples');
      ctx.toast('Examples deleted.');
    }
  });

  el.addEventListener('dragstart', e => {
    const row = e.target.closest('.ol-row[draggable]');
    if (!row) return;
    drag = { id: row.dataset.id, from: row.dataset.parent || null };
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', drag.id);
    row.classList.add('is-dragging');
  });
  el.addEventListener('dragend', e => { e.target.closest?.('.ol-row')?.classList.remove('is-dragging'); clearMarks(); drag = null; });
  el.addEventListener('dragover', e => {
    const row = e.target.closest('.ol-row');
    if (!drag || !row || row.dataset.id === drag.id) return;
    const zone = row.classList.contains('is-mo') ? 'inside' : zoneOf(row, e);
    e.preventDefault();
    e.dataTransfer.dropEffect = e.ctrlKey || e.altKey ? 'copy' : 'move';
    clearMarks();
    row.classList.add(`drop-${zone}`);
  });
  el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) clearMarks(); });
  el.addEventListener('drop', async e => {
    const row = e.target.closest('.ol-row');
    if (!drag || !row) return;
    e.preventDefault();
    const ctx = ctxRef, zone = row.classList.contains('is-mo') ? 'inside' : zoneOf(row, e);
    const target = row.dataset.id, targetParent = row.dataset.parent || null;
    clearMarks();
    // Inside = becomes a child of the target; before/after = sibling of the target under the target's parent.
    let to = target, before = null;
    if (zone !== 'inside') {
      if (!targetParent) return ctx.toast('Drop onto a block to nest it there.', true);
      to = targetParent;
      const sibs = ctx.model.childrenOf(to).filter(c => c !== drag.id);
      before = zone === 'before' ? target : sibs[sibs.indexOf(target) + 1] || null;
    }
    const { id, from } = drag;
    drag = null;
    try {
      if (e.ctrlKey || e.altKey) { await ctx.api('link', { parent: to, child: id, before }); ctx.toast(`${id} now also under ${to}.`); }
      else { await ctx.api('move', { id, from, to, before }); }
    } catch { /* message already shown */ }
  });
}

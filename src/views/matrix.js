// Traceability matrix: every requirement (rows, in outline order) against parents, verification, segment or status.
// Rows with nothing in the chosen dimension are flagged: orphans, unverified, unallocated, no status.
import { SEGMENTS, STATUSES, VERIFICATION, short } from '../model.js';

let mode = 'parents', bound = false, ctxRef = null;

export function render(el, ctx) {
  ctxRef = ctx;
  const { model: m, esc } = ctx;
  const rows = [...m.order.filter(id => m.get(id).type !== 'mo'), ...m.orphans];
  const parentsCols = m.order.filter(id => (m.get(id).level ?? 9) <= 1);
  const cols = {
    parents: parentsCols.map(id => ({ k: id, label: id, sub: m.get(id).name || '' })),
    verification: VERIFICATION.map(v => ({ k: v.k, label: v.k, sub: v.name })),
    segment: SEGMENTS.map(s => ({ k: s, label: s, sub: '' })),
    status: STATUSES.map(s => ({ k: s, label: s, sub: '' })),
  }[mode];
  const anc = new Map(rows.map(id => [id, m.ancestors(id)]));
  const cell = (id, c) => {
    const r = m.get(id);
    if (mode === 'parents') return r.parents.includes(c.k) ? '<i class="mx-dot" title="Direct parent"></i>' : anc.get(id).has(c.k) ? '<i class="mx-ring" title="Traces up through another requirement"></i>' : '';
    const v = mode === 'verification' ? r.verification : mode === 'segment' ? r.segment : r.status;
    return v === c.k ? '<i class="mx-dot"></i>' : '';
  };
  const gap = id => {
    const r = m.get(id);
    return mode === 'parents' ? !r.parents.length : mode === 'verification' ? !r.verification : mode === 'segment' ? !r.segment : !r.status;
  };
  const gaps = rows.filter(gap).length;
  el.innerHTML = `
    <div class="mx-wrap">
      <div class="mx-bar">
        <div class="seg-btns" role="group" aria-label="Columns">
          ${[['parents', 'Parents (L0–L1)'], ['verification', 'Verification'], ['segment', 'Segment'], ['status', 'Status']].map(([k, t]) => `<button data-mx="${k}" aria-pressed="${k === mode}">${t}</button>`).join('')}
        </div>
        <span class="mx-sum">${rows.length} requirements · <b class="${gaps ? 'is-warn' : ''}">${gaps} without ${mode === 'parents' ? 'a parent' : `a ${mode}`}</b>${mode === 'parents' ? ' · <i class="mx-dot"></i> direct parent · <i class="mx-ring"></i> traces up through another requirement' : ''}</span>
      </div>
      <div class="mx-scroll">
        <table class="mx" style="--cols:${cols.length}">
          <thead><tr><th class="mx-rh">Requirement</th>${cols.map(c => `<th title="${esc(c.sub)}"><span>${esc(c.label)}</span></th>`).join('')}<th class="mx-gap">Gap</th></tr></thead>
          <tbody>${rows.map(id => { const r = m.get(id); return `
            <tr class="${ctx.on(id) ? '' : 'is-dim'}${ctx.state.selected === id ? ' is-sel' : ''}">
              <th class="mx-rh" style="--d:${Math.max(0, (r.level ?? 1) - 1)}; --c:${ctx.color(r)}"><button data-select="${esc(id)}"><b>${esc(id)}</b><span>${esc(short(r.name, 34))}</span></button></th>
              ${cols.map(c => `<td>${cell(id, c)}</td>`).join('')}
              <td class="mx-gap">${gap(id) ? '<i class="mx-flag" title="Missing">!</i>' : ''}</td>
            </tr>`; }).join('')}</tbody>
        </table>
      </div>
    </div>`;
  if (!bound) {
    el.addEventListener('click', e => { const b = e.target.closest('[data-mx]'); if (b) { mode = b.dataset.mx; ctxRef.rerender(); } });
    bound = true;
  }
}

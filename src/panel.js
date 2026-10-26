// Side panel for the selected requirement: an edit form in the local editor, read-only details on the static site.
import { SEGMENTS, STATUSES, VERIFICATION, SOURCES } from './model.js';
import { SRR_REFS, srrRef } from './refs.js';
import { ICON } from './icons.js';

const vName = Object.fromEntries(VERIFICATION.map(v => [v.k, v.name]));

export function renderPanel(el, ctx) {
  const { model: m, state, esc } = ctx;
  const r = state.selected && m.get(state.selected);
  el.classList.toggle('is-open', !!r);
  if (!r) { el.innerHTML = ''; return; }

  // Keep focus and caret across re-renders (every save re-renders the page).
  const active = document.activeElement?.closest?.('#panel [data-field]');
  const keep = active && { f: active.dataset.field, s: active.selectionStart, e: active.selectionEnd };

  const chip = id => { const x = m.get(id); return `<button class="pc" data-select="${esc(id)}" style="--c:${ctx.color(x)}"><b>${esc(id)}</b><span>${esc(x?.name || '')}</span></button>`; };
  const head = `
    <div class="p-head" style="--c:${ctx.color(r)}">
      <button class="icon-btn p-close" data-act="clear" aria-label="Close">${ICON.close}</button>
      <div class="p-eyebrow">${r.type === 'mo' ? 'Mission objective · Level 0' : `Level ${r.level ?? '?'} · ${esc(r.outline || 'not connected')}`}${r.example ? ' · <em>Example</em>' : ''}</div>
      <h2 class="p-title">${esc(r.id)}</h2>
      <div class="p-name">${esc(r.name || '')}</div>
    </div>`;
  const lists = `
    <div class="p-h">Parents ${r.type === 'mo' ? '' : `<small>${r.parents.length > 1 ? 'serves several parents' : ''}</small>`}</div>
    <div class="p-chips">${r.parents.map(p => `<span class="pc-wrap">${chip(p)}${ctx.readonly ? '' : `<button class="pc-x" data-unlink="${esc(p)}" aria-label="Remove ${esc(p)} as a parent" title="Remove this parent">${ICON.close}</button>`}</span>`).join('') || `<span class="p-none">${r.type === 'mo' ? 'Top of the tree' : 'None: not connected to a mission objective'}</span>`}</div>
    ${ctx.readonly || r.type === 'mo' ? '' : `<select class="p-add" data-add="parent"><option value="">+ Add a parent…</option>${m.order.filter(id => id !== r.id && !r.parents.includes(id) && !m.wouldCycle(id, r.id)).map(id => `<option value="${esc(id)}">${'  '.repeat(m.get(id).level || 0)}${esc(id)} · ${esc(m.get(id).name || '')}</option>`).join('')}</select>`}
    <div class="p-h">Children <small>${r.children.length || ''}</small></div>
    <div class="p-chips">${r.children.map(chip).join('') || '<span class="p-none">None yet</span>'}</div>
    ${ctx.readonly ? '' : `<button class="p-btn" data-act-p="add-child">${ICON.plus} Add a child requirement</button>`}`;
  const srr = `
    <div class="p-h">On the SRR page</div>
    <div class="p-chips">${(r.srr || []).map(x => { const ref = srrRef(x.kind, x.ref); return `<span class="pc-wrap"><a class="pc pc-ext" href="${ref.url}" target="_blank" rel="noopener">${ICON.external}<span>${esc(ref.label)}</span></a>${ctx.readonly ? '' : `<button class="pc-x" data-unsrr="${esc(x.kind)}:${esc(x.ref)}" aria-label="Remove link">${ICON.close}</button>`}</span>`; }).join('') || '<span class="p-none">No links</span>'}</div>
    ${ctx.readonly ? '' : `<select class="p-add" data-add="srr"><option value="">+ Link to a scenario step, interface, trade or RFP item…</option>${SRR_REFS.filter(x => !(r.srr || []).some(y => y.kind === x.kind && y.ref === x.ref)).map(x => `<option value="${x.kind}:${x.ref}">${esc(x.label)}</option>`).join('')}</select>`}`;

  if (ctx.readonly) {
    const row = (k, v) => (v ? `<div class="p-kv"><span>${k}</span><p>${esc(v)}</p></div>` : '');
    el.innerHTML = `<div class="p-inner">${head}
      <p class="p-statement">${esc(r.statement || '')}</p>
      ${r.threshold || r.objective ? `<div class="p-tv"><div><span>Threshold</span><p>${esc(r.threshold || '—')}</p></div><div><span>Objective</span><p>${esc(r.objective || '—')}</p></div></div>` : ''}
      ${row('Rationale', r.rationale)}${row('Source', r.source)}${row('Verification', r.verification && `${vName[r.verification]}${r.verNote ? ` · ${r.verNote}` : ''}`)}
      ${row('Segment', r.segment)}${row('Owner', r.owner)}${row('Status', r.status)}
      ${lists}${srr}</div>`;
    return;
  }

  const opt = (list, v, blank = '—') => `<option value="">${blank}</option>${list.map(x => { const [k, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}`;
  const input = (f, label, v, extra = '') => `<label class="p-field"><span>${label}</span><input data-field="${f}" value="${esc(v || '')}" ${extra} /></label>`;
  const area = (f, label, v, rows = 3) => `<label class="p-field"><span>${label}</span><textarea data-field="${f}" rows="${rows}">${esc(v || '')}</textarea></label>`;
  const sel = (f, label, list, v) => `<label class="p-field"><span>${label}</span><select data-field="${f}">${opt(list, v)}</select></label>`;
  el.innerHTML = `<div class="p-inner">${head}
    <div class="p-form">
      ${input('id', 'ID', r.id, 'spellcheck="false"')}
      ${input('name', 'Short name', r.name)}
      ${area('statement', r.type === 'mo' ? 'Objective' : 'Requirement ("shall" statement)', r.statement, 4)}
      ${r.type === 'mo' ? '' : `<div class="p-row">${input('threshold', 'Threshold', r.threshold)}${input('objective', 'Objective value', r.objective)}</div>`}
      ${area('rationale', 'Rationale', r.rationale, 2)}
      ${r.type === 'mo' ? '' : `
      <div class="p-row">${sel('verification', 'Verification', VERIFICATION.map(v => [v.k, v.name]), r.verification)}${sel('segment', 'Segment', SEGMENTS, r.segment)}</div>
      ${input('verNote', 'Verification note', r.verNote)}
      <div class="p-row">${sel('status', 'Status', STATUSES, r.status)}${input('owner', 'Owner', r.owner)}</div>
      <div class="p-row"><label class="p-field"><span>Source</span><input data-field="source" list="sources" value="${esc(r.source || '')}" /><datalist id="sources">${SOURCES.map(s => `<option value="${s}">`).join('')}</datalist></label>
        <label class="p-check"><input type="checkbox" data-field="example" ${r.example ? 'checked' : ''} /> Example (placeholder)</label></div>`}
    </div>
    ${lists}${srr}
    ${r.type === 'mo' ? '' : `<button class="p-btn p-del" data-act-p="delete">${ICON.trash} Delete ${esc(r.id)}</button>`}
  </div>`;

  if (keep) {
    const f = el.querySelector(`[data-field="${keep.f}"]`);
    if (f) { f.focus(); try { f.setSelectionRange(keep.s, keep.e); } catch { /* selects and checkboxes */ } }
  }
}

// Editor actions (bound once; the panel is re-rendered on every change).
export function bindPanel(el, getCtx) {
  el.addEventListener('change', async e => {
    const ctx = getCtx(), r = ctx.model.get(ctx.state.selected);
    const t = e.target;
    if (!r || ctx.readonly) return;
    try {
      if (t.dataset.field === 'id') {
        const to = t.value.trim();
        if (to && to !== r.id) { await ctx.api('rename', { from: r.id, to }); ctx.state.selected = to; ctx.rerender(); }
      } else if (t.dataset.field) {
        await ctx.api('req', { req: { id: r.id, [t.dataset.field]: t.type === 'checkbox' ? t.checked : t.value } });
      } else if (t.dataset.add === 'parent' && t.value) {
        await ctx.api('link', { parent: t.value, child: r.id });
      } else if (t.dataset.add === 'srr' && t.value) {
        const [kind, ref] = t.value.split(':');
        await ctx.api('req', { req: { id: r.id, srr: [...(r.srr || []), { kind, ref }] } });
      }
    } catch { ctx.rerender(); }
  });
  el.addEventListener('click', async e => {
    const ctx = getCtx(), r = ctx.model.get(ctx.state.selected);
    const t = e.target.closest('[data-unlink], [data-unsrr], [data-act-p]');
    if (!t || !r || ctx.readonly) return;
    if (t.dataset.unlink) return ctx.api('unlink', { parent: t.dataset.unlink, child: r.id });
    if (t.dataset.unsrr) {
      const [kind, ref] = t.dataset.unsrr.split(':');
      return ctx.api('req', { req: { id: r.id, srr: (r.srr || []).filter(x => !(x.kind === kind && x.ref === ref)) } });
    }
    if (t.dataset.actP === 'add-child') return addChild(ctx, r.id);
    if (t.dataset.actP === 'delete' && confirm(`Delete ${r.id}? Its children stay but lose this parent.`)) {
      await ctx.api('delete', { id: r.id });
      ctx.state.selected = null; ctx.rerender();
    }
  });
}

// New requirement under `parentId`, with an ID suggested from the parent's position (editable afterwards).
export async function addChild(ctx, parentId) {
  const m = ctx.model, p = m.get(parentId);
  const lvl = (p?.level ?? 0) + 1, base = `L${lvl}-${p?.outline || 'X'}`;
  let n = (p?.children.length || 0) + 1, id = `${base}.${n}`;
  while (m.get(id)) id = `${base}.${++n}`;
  await ctx.api('req', { req: { id, type: 'req', name: 'New requirement', status: 'draft', source: 'derived', statement: 'The system shall ' } });
  await ctx.api('link', { parent: parentId, child: id });
  ctx.state.selected = id;
  ctx.rerender();
}

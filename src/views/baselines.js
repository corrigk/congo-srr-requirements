// Baselines: freeze the current decomposition under a name ("Finalize"), and compare any two versions.
import { diff, short } from '../model.js';

let pick = { a: '', b: 'current' }, ctxRef = null, bound = false, cache = new Map();

export function render(el, ctx) {
  ctxRef = ctx;
  const { esc, readonly } = ctx;
  const list = [...(ctx.state.data.baselines || [])].sort((x, y) => y.created.localeCompare(x.created));
  if (!pick.a && list.length) pick.a = list[readonly && list.length > 1 ? 1 : 0].slug;
  if (readonly && pick.b === 'current' && list.length) pick.b = list[0].slug;
  const opts = sel => `${readonly ? '' : `<option value="current" ${sel === 'current' ? 'selected' : ''}>Current working copy</option>`}${list.map(b => `<option value="${b.slug}" ${b.slug === sel ? 'selected' : ''}>${esc(b.name)} · ${b.created.slice(0, 10)}</option>`).join('')}`;

  el.innerHTML = `
    <div class="bl-wrap">
      ${readonly ? '' : `
      <section class="bl-card">
        <h2>Finalize a baseline</h2>
        <p>Freezes everything as it is now. The baseline is saved in <code>data/baselines/</code> and becomes <code>data/published.json</code>,
           which the static site and the SRR page show once you commit and push.</p>
        <form class="bl-form" data-bl="finalize">
          <input name="name" placeholder="Name, e.g. SRR baseline v1" required aria-label="Baseline name" />
          <input name="note" placeholder="Note (optional)" aria-label="Baseline note" />
          <button class="btn" type="submit">Finalize</button>
        </form>
      </section>`}
      <section class="bl-card">
        <h2>Baselines <small>${list.length}</small></h2>
        ${list.length ? `<ol class="bl-list">${list.map(b => `<li><b>${esc(b.name)}</b><span>${b.created.slice(0, 16).replace('T', ' ')} · ${b.count} requirements</span>${b.note ? `<em>${esc(b.note)}</em>` : ''}</li>`).join('')}</ol>`
          : `<p class="bl-empty">None yet.${readonly ? '' : ' Finalize one above when the decomposition is ready to share.'}</p>`}
      </section>
      ${list.length ? `
      <section class="bl-card bl-diff">
        <h2>What changed</h2>
        <div class="bl-pick"><select data-bl="a" aria-label="From">${opts(pick.a)}</select><span>→</span><select data-bl="b" aria-label="To">${opts(pick.b)}</select></div>
        <div class="bl-out" id="bl-out">Comparing…</div>
      </section>` : ''}
    </div>`;
  if (list.length) compare(el);
  if (!bound) { bind(el); bound = true; }
}

async function snap(key) {
  const ctx = ctxRef;
  if (key === 'current') return ctx.state.data;
  if (!cache.has(key)) cache.set(key, await ctx.fetchBaseline(key));
  return cache.get(key);
}

async function compare(el) {
  const ctx = ctxRef, { esc } = ctx, out = el.querySelector('#bl-out');
  try {
    const [a, b] = await Promise.all([snap(pick.a), snap(pick.b)]);
    const d = diff(a, b);
    const B = new Map(b.reqs.map(r => [r.id, r])), A = new Map(a.reqs.map(r => [r.id, r]));
    const item = (id, extra = '', src = B) => `<li><button data-select="${esc(id)}"><b>${esc(id)}</b> ${esc(short(src.get(id)?.name, 50))}</button>${extra}</li>`;
    const n = d.added.length + d.removed.length + d.changed.length + d.moved.length;
    out.innerHTML = !n ? '<p class="bl-empty">No differences.</p>' : `
      <div class="bl-sum"><span class="is-add">${d.added.length} added</span><span class="is-rem">${d.removed.length} removed</span><span class="is-mov">${d.moved.length} moved</span><span class="is-chg">${d.changed.length} changed</span></div>
      <div class="bl-cols">
        ${d.added.length ? `<div><h3 class="is-add">Added</h3><ul>${d.added.map(id => item(id)).join('')}</ul></div>` : ''}
        ${d.removed.length ? `<div><h3 class="is-rem">Removed</h3><ul>${d.removed.map(id => item(id, '', A)).join('')}</ul></div>` : ''}
        ${d.moved.length ? `<div><h3 class="is-mov">Moved</h3><ul>${d.moved.map(x => item(x.id, `<small>${esc(x.from)} → ${esc(x.to)}</small>`)).join('')}</ul></div>` : ''}
        ${d.changed.length ? `<div><h3 class="is-chg">Changed</h3><ul>${d.changed.map(x => item(x.id, `<small>${x.fields.map(f => `${f}: <s>${esc(short(String(x.before[f] ?? '—'), 40))}</s> → ${esc(short(String(x.after[f] ?? '—'), 40))}`).join('<br>')}</small>`)).join('')}</ul></div>` : ''}
      </div>`;
  } catch (e) { out.textContent = `Could not compare: ${e.message}`; }
}

function bind(el) {
  el.addEventListener('change', e => {
    const k = e.target.dataset.bl;
    if (k === 'a' || k === 'b') { pick[k] = e.target.value; compare(el); }
  });
  el.addEventListener('submit', async e => {
    if (e.target.dataset.bl !== 'finalize') return;
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const res = await ctxRef.api('finalize', { name: f.get('name'), note: f.get('note') });
      cache.clear();
      pick = { a: res.finalized, b: 'current' };
      ctxRef.toast(`Finalized "${f.get('name')}". Commit and push data/ to publish it.`);
      ctxRef.rerender();
    } catch { /* shown already */ }
  });
}

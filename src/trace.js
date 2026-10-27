// "Suggest functions" dialog: pre-fills function tags for Level 1 requirements that have none yet.
// Nothing is saved until Apply; every box can be changed. Level 2–4 inherit from their L1 (see model.js).
import { FUNCTIONS, suggest } from './functions.js';
import { short } from './model.js';

export function openSuggestions(ctx) {
  const m = ctx.model, esc = ctx.esc, dlg = document.getElementById('fn-dialog');
  const rows = m.reqs.filter(r => r.type !== 'mo' && r.level === 1 && !r.fnOwn.length);
  if (!rows.length) return ctx.toast('Every L1 requirement already has a function.');
  const hint = new Map(rows.map(r => [r.id, suggest(r, m)]));
  dlg.innerHTML = `
    <form method="dialog" class="fd">
      <header><h2>Trace L1 requirements to the functional flow</h2>
        <p>Suggested from each requirement's wording and its children's names. <b>Check the boxes you agree with</b>, change the rest, then Apply.
        Level 2–4 requirements under an L1 inherit its functions unless you tag them separately.</p></header>
      <div class="fd-scroll"><table class="fd-table">
        <thead><tr><th>Requirement</th>${FUNCTIONS.map(f => `<th title="${esc(`${f.id} ${f.title}`)}"><span>${f.id}</span><small>${esc(f.title.split(' ')[0])}</small></th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr data-id="${esc(r.id)}">
          <th><b>${esc(r.id)}</b> ${esc(r.name || '')}<small>${esc(short(r.statement, 140))}</small>${hint.get(r.id).length ? '' : '<em>no suggestion: pick by hand</em>'}</th>
          ${FUNCTIONS.map(f => `<td><input type="checkbox" value="${f.id}" aria-label="${esc(`${r.id} ${f.id}`)}" ${hint.get(r.id).includes(f.id) ? 'checked' : ''} /></td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
      <footer><span class="fd-count" role="status"></span>
        <button class="btn btn-ghost" value="cancel" formnovalidate>Cancel</button>
        <button class="btn" type="button" data-apply>Apply</button></footer>
    </form>`;
  const count = () => {
    const tagged = [...dlg.querySelectorAll('tbody tr')].filter(tr => tr.querySelector('input:checked')).length;
    dlg.querySelector('.fd-count').textContent = `${tagged} of ${rows.length} will be tagged`;
  };
  dlg.onchange = count;
  count();
  // Apply saves from its own click (not the dialog's close event), then closes. Cancel / Esc just close.
  dlg.onclick = async e => {
    if (!e.target.closest('[data-apply]')) return;
    e.preventDefault();
    const picks = [...dlg.querySelectorAll('tbody tr')]
      .map(tr => ({ id: tr.dataset.id, fn: [...tr.querySelectorAll('input:checked')].map(i => i.value) }))
      .filter(p => p.fn.length);
    dlg.close();
    try {
      for (const p of picks) await ctx.api('req', { req: p });
      ctx.toast(`${picks.length} L1 requirement${picks.length === 1 ? '' : 's'} traced to the functional flow.`);
    } catch { /* message already shown */ }
  };
  dlg.showModal();
}

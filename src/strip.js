// Summary strip above the Outline, Thread tree and Table: how many requirements, where they sit (level, segment,
// function, verification), what is still open, and the filters that go with those numbers (mission objective,
// segment, function). Counts follow the current filters; a facet ignores its own filter, so you can still see
// what clicking another option would give.
import { SEGMENTS, VERIFICATION } from './model.js';
import { FUNCTIONS } from './functions.js';
import { ICON } from './icons.js';

export const STRIP_VIEWS = ['outline', 'tree', 'table'];
const VKEYS = VERIFICATION.map(v => v.k);
const vName = Object.fromEntries(VERIFICATION.map(v => [v.k, v.name]));

export function renderStrip(ctx) {
  const { model: m, state, esc } = ctx;
  const reqs = m.reqs.filter(r => r.type !== 'mo');
  const within = skip => reqs.filter(r => ctx.inScope(r, skip));
  const scoped = within();
  const n = (list, f) => list.filter(f).length;

  // ----- headline: totals, levels, status, mission-objective filter -----
  const levels = [...Array(m.maxLevel).keys()].map(i => i + 1).map(l => ({ l, c: n(scoped, r => r.level === l) })).filter(x => x.c || x.l <= 3);
  const status = ['draft', 'agreed', 'TBR', 'TBD'].map(s => ({ s, c: n(scoped, r => r.status === s) })).filter(x => x.c);
  const unset = n(scoped, r => !r.status);
  const moBtn = (id, label, c) => `<button data-mo="${esc(id)}" aria-pressed="${(ctx.mo || '') === id}"><b>${esc(label)}</b> <i>${c}</i></button>`;
  const moBase = within('mo');
  const head = `
    <div class="st-head">
      <div class="st-total"><b>${scoped.length}</b>${scoped.length !== reqs.length ? ` <small>of ${reqs.length}</small>` : ''} requirements</div>
      <div class="st-levels" aria-label="By level">${levels.map(x => `<span><b>${x.c}</b> L${x.l}</span>`).join('')}</div>
      <div class="st-status" aria-label="By status">${status.map(x => `<span class="is-${esc(x.s)}"><b>${x.c}</b> ${esc(x.s)}</span>`).join('')}${unset ? `<span><b>${unset}</b> no status</span>` : ''}</div>
      <div class="st-mo" role="group" aria-label="Mission objective">
        ${moBtn('', 'All MOs', moBase.length)}${m.mos.map(mo => moBtn(mo.id, mo.id, n(moBase, r => r.mos.includes(mo.id)))).join('')}
      </div>
      ${ctx.scoped ? '<button class="st-clear" data-act="scope-clear">Clear filters</button>' : ''}
      <button class="st-toggle" data-strip aria-expanded="${state.strip}" title="${state.strip ? 'Hide' : 'Show'} the summary">${ICON.caret}<span>Summary</span></button>
    </div>`;
  if (!state.strip) return head;

  // ----- functional flow -----
  const fnBase = within('fn');
  const fnBox = f => `<button class="st-fn" data-fn="${f.id}" aria-pressed="${state.fns.has(f.id)}" title="${esc(`${f.id} ${f.title}: ${f.description}`)}">
      <em>${f.id}</em><span>${esc(f.short)}</span><b>${n(fnBase, r => r.fnAll.includes(f.id))}</b></button>`;
  const noFn = n(fnBase, r => !r.fnAll.length);
  const untagged = m.reqs.filter(r => r.type !== 'mo' && r.level === 1 && !r.fnOwn.length).length;
  const fns = `
    <section class="st-card st-card-fn"><h3>Functional flow <small>requirements traced to each function (L2–L4 inherit from their L1)</small></h3>
      <div class="st-flow">${FUNCTIONS.map(fnBox).join('<span class="st-arrow" aria-hidden="true">›</span>')}</div>
      <div class="st-fn-foot">
        <button class="st-fn st-fn-none" data-fn="none" aria-pressed="${state.fns.has('none')}"><span>No function</span><b>${noFn}</b></button>
        ${!ctx.readonly && untagged ? `<button class="btn btn-ghost" data-act="suggest">Suggest functions for ${untagged} L1 requirement${untagged === 1 ? '' : 's'}…</button>` : ''}
      </div>
    </section>`;

  // ----- segment × verification, and what is missing -----
  const segBase = within('seg');
  const vSegs = [...SEGMENTS, 'none'].filter(x => segBase.some(r => (r.segment || 'none') === x) || state.segs.has(x));
  const cell = (list, v) => n(list, r => (VKEYS.includes(r.verification) ? r.verification : 'other') === v);
  const segOf = x => segBase.filter(r => (r.segment || 'none') === x);
  const vMax = Math.max(1, ...vSegs.flatMap(x => [...VKEYS, 'other'].map(v => cell(segOf(x), v))));
  const segMax = Math.max(1, ...vSegs.map(x => segOf(x).length));
  const cols = [...VKEYS.slice().reverse(), 'other']; // Test, Demonstration, Analysis, Inspection, Other
  const vm = `
    <section class="st-card st-card-seg"><h3>Segment <small>and how each is verified (T test · D demonstration · A analysis · I inspection)</small></h3>
      <table class="st-vm"><thead><tr><th>Segment</th><th class="st-barh"></th>${cols.map(v => `<th title="${v === 'other' ? 'Not set, or a note typed in the method field' : vName[v]}">${v === 'other' ? '?' : v}</th>`).join('')}</tr></thead>
        <tbody>${vSegs.map(x => {
    const list = segOf(x);
    return `<tr><th><button data-seg="${esc(x)}" aria-pressed="${state.segs.has(x)}">${x === 'none' ? 'No segment' : esc(x)}</button></th>
            <td class="st-barcell" style="--w:${(100 * list.length) / segMax}%"><i></i><b>${list.length}</b></td>${cols.map(v => { const c = cell(list, v); return `<td${c ? ` style="--a:${(c / vMax).toFixed(2)}"` : ' class="is-zero"'}>${c || ''}</td>`; }).join('')}</tr>`;
  }).join('')}
          <tr class="st-sum"><th>All</th><td class="st-barcell"><b>${segBase.length}</b></td>${cols.map(v => `<td>${cell(segBase, v) || ''}</td>`).join('')}</tr></tbody></table>
      <p class="st-gaps"><span>Missing:</span>${[
    ['owner', n(scoped, r => !r.owner)], ['threshold', n(scoped, r => !r.threshold)], ['rationale', n(scoped, r => !r.rationale)], ['L1 function', n(scoped, r => r.level === 1 && !r.fnAll.length)],
  ].map(([k, c]) => `<span class="${c ? 'is-gap' : 'is-ok'}"><b>${c}</b> ${k}</span>`).join('')}</p>
    </section>`;

  return `${head}<div class="st-body">${vm}${fns}</div>`;
}

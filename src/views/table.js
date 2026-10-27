// Table: every requirement as one row (outline order), for reading, a slide, or Excel.
// Follows the filters (mission objective, segment, function) and the search box. "Copy for slides" puts a
// formatted table on the clipboard (paste into PowerPoint or Word); Download CSV has every field.
import { VERIFICATION } from '../model.js';
import { ICON } from '../icons.js';

const vName = Object.fromEntries(VERIFICATION.map(v => [v.k, v.name]));
const verText = r => (r.verification ? vName[r.verification] || r.verification : '');
const lvl = r => (r.type === 'mo' ? 'L0' : r.level == null ? '' : `L${r.level}`);

// Columns you can show. `get` is the text (copy and CSV); `cls` styles the cell.
const COLS = [
  { k: 'id', label: 'ID', get: r => r.id, def: true },
  { k: 'level', label: 'Level', get: lvl },
  { k: 'name', label: 'Name', get: r => r.name || '', def: true },
  { k: 'statement', label: 'Requirement', get: r => r.statement || '', def: true, cls: 'rt-wide' },
  { k: 'threshold', label: 'Threshold', get: r => r.threshold || '', def: true },
  { k: 'objective', label: 'Objective', get: r => r.objective || '', def: true },
  { k: 'rationale', label: 'Rationale', get: r => r.rationale || '', cls: 'rt-wide' },
  { k: 'verification', label: 'Verification', get: verText, def: true },
  { k: 'verNote', label: 'Verification note', get: r => r.verNote || '' },
  { k: 'segment', label: 'Segment', get: r => r.segment || '', def: true },
  { k: 'status', label: 'Status', get: r => r.status || '' },
  { k: 'fn', label: 'Functions', get: r => r.fnAll.join(', '), def: true },
  { k: 'mo', label: 'MO', get: r => r.mos.join(', ') },
  { k: 'parents', label: 'Parents', get: r => r.parents.join(', ') },
  { k: 'owner', label: 'Owner', get: r => r.owner || '' },
  { k: 'source', label: 'Source', get: r => r.source || '' },
];

const loadCols = () => { try { const v = JSON.parse(localStorage.getItem('req-table-cols')); if (Array.isArray(v)) return new Set(v); } catch { /* none saved */ } return new Set(COLS.filter(c => c.def).map(c => c.k)); };
let shown = loadCols(), bound = false, ctxRef = null;

// The rows to show: outline order, filtered. Mission objectives only when no segment / function filter is on.
export function rowsOf(ctx) {
  const m = ctx.model, st = ctx.state;
  return [...m.order, ...m.orphans].map(id => m.get(id))
    .filter(r => ctx.matches(r) && (r.type !== 'mo' || (!st.segs.size && !st.fns.size)));
}

const csvCell = v => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCSV(ctx, rows) {
  const head = ['ID', 'Outline', 'Level', 'Type', 'Name', 'Statement', 'Threshold', 'Objective', 'Rationale', 'Source', 'Verification', 'Verification note',
    'Segment', 'Owner', 'Status', 'Functions (traced)', 'Functions (own tags)', 'Parents', 'Mission objectives', 'Example'];
  const line = r => [r.id, r.outline, lvl(r), r.type === 'mo' ? 'Mission objective' : 'Requirement', r.name, r.statement, r.threshold, r.objective, r.rationale, r.source,
    verText(r), r.verNote, r.segment, r.owner, r.status, r.fnAll.join(', '), r.fnOwn.join(', '), r.parents.join(', '), r.mos.join(', '), r.example ? 'yes' : ''];
  return `﻿${[head, ...rows.map(line)].map(l => l.map(csvCell).join(',')).join('\r\n')}\r\n`; // BOM so Excel reads UTF-8
}

function fileName(ctx) {
  const base = ctx.state.data.baseline;
  return `s3-requirements-${base?.slug || 'draft'}-${new Date().toISOString().slice(0, 10)}`;
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// A formatted table for PowerPoint / Word: inline styles survive the paste.
function slideHTML(cols, rows, esc) {
  const td = 'border:1px solid #9a9a9a;padding:3px 6px;vertical-align:top;font:10pt Calibri,Arial,sans-serif;color:#111';
  return `<table style="border-collapse:collapse"><thead><tr>${cols.map(c => `<th style="${td};background:#CFB991;text-align:left;font-weight:bold">${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(c => `<td style="${td}${r.type === 'mo' ? ';font-weight:bold;background:#F1ECE0' : ''}">${esc(c.get(r))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

export function render(el, ctx) {
  ctxRef = ctx;
  const { model: m, esc, state } = ctx;
  const cols = COLS.filter(c => shown.has(c.k));
  const rows = rowsOf(ctx);
  const total = m.reqs.length;
  const cell = (r, c) => {
    if (c.k === 'id') return `<td class="rt-id" style="--d:${Math.max(0, (r.level ?? 1) - 1) * (r.type === 'mo' ? 0 : 1)};--c:${ctx.color(r)}"><button data-select="${esc(r.id)}">${esc(r.id)}</button></td>`;
    if (c.k === 'fn') return `<td class="${r.fnInherited ? 'is-inh' : ''}" title="${r.fnInherited ? 'Inherited from the parent' : ''}">${r.fnAll.map(f => `<span class="rt-fn">${f}</span>`).join('')}</td>`;
    if (c.k === 'status') return `<td>${r.status ? `<span class="tag tag-st is-${esc(r.status)}">${esc(r.status)}</span>` : ''}</td>`;
    return `<td class="${c.cls || ''}">${esc(c.get(r))}</td>`;
  };
  el.innerHTML = `
    <div class="rt-view">
      <div class="rt-bar">
        <span class="rt-sum"><b>${rows.length}</b> row${rows.length === 1 ? '' : 's'}${rows.length !== total ? ` of ${total}` : ''}${ctx.scoped ? ` · ${esc(ctx.scopeLabel)}` : ''}</span>
        <details class="rt-cols"><summary class="btn btn-ghost">Columns · ${cols.length}</summary>
          <div class="rt-colpick">${COLS.map(c => `<label><input type="checkbox" data-col="${c.k}" ${shown.has(c.k) ? 'checked' : ''} /> ${esc(c.label)}</label>`).join('')}</div></details>
        <span class="rt-spacer"></span>
        <button class="btn btn-ghost" data-rt="copy" title="Copy the table as shown, to paste into PowerPoint or Word">Copy for slides</button>
        <button class="btn btn-ghost" data-rt="csv" title="Every field, one row per requirement, opens in Excel">${ICON.download} Download CSV</button>
        <button class="btn btn-ghost" data-rt="print" title="Print or save as PDF (landscape)">Print / PDF</button>
      </div>
      <div class="rt-scroll">
        <table class="rt">
          <caption class="rt-print-title">S-3 requirements${state.data.baseline ? ` · ${esc(state.data.baseline.name)}` : ' · draft'}${ctx.scoped ? ` · ${esc(ctx.scopeLabel)}` : ''}</caption>
          <thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr class="${r.type === 'mo' ? 'is-mo' : ''}${state.selected === r.id ? ' is-sel' : ''}">${cols.map(c => cell(r, c)).join('')}</tr>`).join('')
    || `<tr><td colspan="${cols.length}" class="rt-empty">No requirements match the current filters.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;

  if (bound) return;
  bound = true;
  el.addEventListener('change', e => {
    const k = e.target.dataset.col;
    if (!k) return;
    e.target.checked ? shown.add(k) : shown.delete(k);
    if (!shown.size) shown.add('id');
    try { localStorage.setItem('req-table-cols', JSON.stringify([...shown])); } catch { /* no memory */ }
    ctxRef.rerender();
    document.querySelector('.rt-cols')?.setAttribute('open', '');
  });
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-rt]');
    if (!b) return;
    const ctx = ctxRef, rows = rowsOf(ctx), cols = COLS.filter(c => shown.has(c.k));
    if (b.dataset.rt === 'csv') { download(`${fileName(ctx)}.csv`, toCSV(ctx, rows), 'text/csv;charset=utf-8'); ctx.toast(`Downloaded ${rows.length} rows.`); }
    if (b.dataset.rt === 'print') window.print();
    if (b.dataset.rt === 'copy') {
      const tsv = [cols.map(c => c.label), ...rows.map(r => cols.map(c => c.get(r).replace(/\s+/g, ' ')))].map(l => l.join('\t')).join('\n');
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([slideHTML(cols, rows, ctx.esc)], { type: 'text/html' }), 'text/plain': new Blob([tsv], { type: 'text/plain' }) })]);
        ctx.toast(`Copied ${rows.length} rows: paste into PowerPoint, Word or Excel.`);
      } catch {
        try { await navigator.clipboard.writeText(tsv); ctx.toast(`Copied ${rows.length} rows as text: paste into Excel.`); } catch { ctx.toast('Could not copy: use Download CSV.', true); }
      }
    }
  });
}

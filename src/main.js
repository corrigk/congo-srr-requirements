import './style.css';
import './app.css';
import { build, checks, SEGMENTS } from './model.js';
import { COLOR_BY, colorFn, legend } from './refs.js';
import { ICON } from './icons.js';
import { renderPanel, bindPanel } from './panel.js';
import * as outline from './views/outline.js';
import * as graphs from './views/graphs.js';
import * as matrix from './views/matrix.js';
import * as baselines from './views/baselines.js';

// Local `npm start` = editor (SQLite API). The built site on GitHub Pages = read-only, from the published baseline.
const READONLY = import.meta.env.PROD;
const VIEWS = { outline, tree: graphs.tree, radial: graphs.radial, matrix, graph: graphs.force, baselines };
const NAMES = Object.keys(VIEWS);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app'), stage = $('#stage'), panel = $('#panel');

// Thread tree: dir 'auto' | 'h' (across) | 'v' (down), remembered on this computer; depth null = all levels;
// expanded = folded branches opened by hand.
const savedDir = (() => { try { return localStorage.getItem('req-tree-dir') || 'auto'; } catch { return 'auto'; } })();
const state = { data: null, model: null, view: 'outline', selected: null, colorBy: 'mo', segs: new Set(), search: '', present: false, zoom: {},
  dir: savedDir, depth: null, expanded: new Set() };
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// ---------- data ----------
async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }
async function load() {
  if (READONLY) {
    const [pub, list] = await Promise.all([getJSON('./data/published.json'), getJSON('./data/baselines/index.json').catch(() => [])]);
    setData({ ...pub, baselines: list });
  } else setData(await getJSON('/api/data'));
}
const fetchBaseline = slug => getJSON(READONLY ? `./data/baselines/${slug}.json` : `/api/baseline/${slug}`);

let saveT;
function saveState(text, error = false) {
  const el = $('#save-state');
  el.textContent = text;
  el.classList.toggle('is-error', error);
  clearTimeout(saveT);
  if (!error && text.startsWith('Saved')) saveT = setTimeout(() => { el.textContent = 'All changes saved'; }, 2500);
}
async function api(route, body = {}) {
  saveState('Saving…');
  const r = await fetch(`/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: 'Bad response from the local server' }));
  if (!r.ok) { saveState('Change not applied', true); toast(j.error || 'Something went wrong', true); throw new Error(j.error); }
  saveState('Saved to data/working.json');
  setData(j);
  return j;
}
function setData(d) {
  state.data = d;
  state.model = build(d);
  if (state.selected && !state.model.get(state.selected)) state.selected = null;
  render();
}

let toastT;
function toast(text, error = false) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.toggle('is-error', error);
  t.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('is-on'), error ? 5000 : 2500);
}

// ---------- context handed to every view ----------
function context() {
  const m = state.model, q = state.search.trim().toLowerCase();
  const focus = state.selected ? m.thread(state.selected) : null;
  const match = r => !q || `${r.id} ${r.name || ''} ${r.statement || ''}`.toLowerCase().includes(q);
  const segOk = r => !state.segs.size || r.type === 'mo' || state.segs.has(r.segment);
  return {
    model: m, readonly: READONLY, state, api, toast, fetchBaseline, esc,
    color: colorFn(state.colorBy, m),
    focus,
    // Is this requirement "lit" (in the selected thread, the chosen segments and the search)?
    on: id => { const r = m.get(id); return !!r && (!focus || focus.has(id)) && segOk(r) && match(r); },
    filtered: !!(focus || state.segs.size || q),
    select: id => select(id),
    rerender: () => render(),
  };
}

// ---------- render ----------
function render() {
  if (!state.model) return;
  app.dataset.view = state.view;
  app.classList.toggle('is-readonly', READONLY);
  app.classList.toggle('has-panel', !!state.selected);
  for (const t of $$('.tabs [data-view]')) { const on = t.dataset.view === state.view; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; }
  moveInk();
  renderToolbar();
  const ctx = context();
  if (state.view !== 'graph') graphs.stopForce();
  VIEWS[state.view].render(stage, ctx);
  renderPanel(panel, ctx);
  writeHash();
}

function renderToolbar() {
  const m = state.model;
  const issues = READONLY ? [] : checks(m).filter(c => c.severity !== 'info');
  const base = state.data.baseline;
  $('#toolbar').innerHTML = `
    <label class="tb-field"><span>Colour</span>
      <select data-tool="color">${Object.entries(COLOR_BY).map(([k, v]) => `<option value="${k}" ${k === state.colorBy ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="tb-legend">${legend(state.colorBy, m).map(l => `<span><i style="background:${l.color}"></i>${esc(l.label)}</span>`).join('')}</div>
    <div class="tb-segs" role="group" aria-label="Segment filter">
      ${SEGMENTS.map(s => `<button data-seg="${s}" aria-pressed="${state.segs.has(s)}">${s}</button>`).join('')}
    </div>
    <input class="tb-search" type="search" placeholder="Search  /" value="${esc(state.search)}" data-tool="search" aria-label="Search requirements" />
    <div class="tb-right">
      ${state.selected ? `<button class="tb-chip is-focus" data-act="clear">Thread: <b>${esc(state.selected)}</b> ${ICON.close}</button>` : ''}
      ${READONLY ? `<span class="tb-chip">Read-only · ${base ? `${esc(base.name)} · ${base.created.slice(0, 10)}` : 'draft, not finalized yet'}</span>`
        : `<button class="tb-chip ${issues.length ? 'is-warn' : 'is-ok'}" data-act="checks" title="Problems to fix before a baseline">${issues.length ? `${issues.length} to fix` : 'No problems'}</button>`}
      <span class="tb-count">${m.reqs.length} requirements · L0–L${m.maxLevel}</span>
    </div>`;
}

function moveInk() {
  const t = $(`.tabs [data-view="${state.view}"]`), ink = $('.tabs-ink');
  if (t) Object.assign(ink.style, { width: `${t.offsetWidth}px`, transform: `translateX(${t.offsetLeft - 4}px)` });
}
document.fonts?.ready.then(() => moveInk()); // tab widths change once Inter has loaded
addEventListener('resize', () => { moveInk(); if (['tree', 'radial', 'graph'].includes(state.view)) render(); });

// ---------- routing: #view/ID?seg=Space,Ground&color=segment&depth=2&dir=v (deep links for presenting) ----------
function readHash() {
  const [path, query = ''] = location.hash.slice(1).split('?');
  const [view, id] = path.split('/');
  if (NAMES.includes(view)) state.view = view;
  state.selected = id ? decodeURIComponent(id) : null;
  const p = new URLSearchParams(query);
  state.segs = new Set((p.get('seg') || '').split(',').filter(s => SEGMENTS.includes(s)));
  if (COLOR_BY[p.get('color')]) state.colorBy = p.get('color');
  state.depth = +p.get('depth') || null;
  if (['h', 'v'].includes(p.get('dir'))) state.dir = p.get('dir');
}
function writeHash() {
  const p = new URLSearchParams();
  if (state.segs.size) p.set('seg', [...state.segs].join(','));
  if (state.colorBy !== 'mo') p.set('color', state.colorBy);
  if (state.depth) p.set('depth', state.depth);
  if (state.dir !== 'auto') p.set('dir', state.dir);
  const h = `#${state.view}${state.selected ? `/${encodeURIComponent(state.selected)}` : ''}${p.size ? `?${p}` : ''}`;
  if (location.hash !== h) history.replaceState(null, '', h);
}
addEventListener('hashchange', () => { readHash(); render(); });

// ---------- actions ----------
function select(id) { state.selected = id && state.selected === id ? null : id; render(); }
function toggleBranch(id) { state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id); render(); }
function setView(v) { if (VIEWS[v]) { state.view = v; render(); } }
function setPresent(on) { state.present = on; app.classList.toggle('is-present', on); $('[data-act="present"]').setAttribute('aria-pressed', on); render(); }

document.addEventListener('click', e => {
  const t = e.target.closest('[data-view], [data-act], [data-seg], [data-select], [data-expand], [data-tree-dir], [data-tree-depth], [data-tree-fold]');
  if (!t) return;
  const d = t.dataset;
  if (d.view && t.closest('.tabs')) return setView(d.view);
  if (d.seg) { state.segs.has(d.seg) ? state.segs.delete(d.seg) : state.segs.add(d.seg); return render(); }
  if (d.select) return select(d.select);
  if (d.expand) return toggleBranch(d.expand);
  if (d.treeDir) { state.dir = d.treeDir; try { localStorage.setItem('req-tree-dir', d.treeDir); } catch { /* no memory */ } return render(); }
  if (d.treeDepth) { state.depth = d.treeDepth === 'all' ? null : +d.treeDepth; state.expanded.clear(); return render(); }
  if ('treeFold' in d) { state.expanded.clear(); return render(); }
  switch (d.act) {
    case 'clear': state.selected = null; return render();
    case 'seg-clear': state.segs.clear(); return render();
    case 'present': return setPresent(!state.present);
    case 'fullscreen': return document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    case 'checks': state.view = 'outline'; state.showChecks = true; return render();
  }
});
document.addEventListener('change', e => {
  if (e.target.dataset.tool === 'color') { state.colorBy = e.target.value; render(); }
});
let searchT;
document.addEventListener('input', e => {
  if (e.target.dataset.tool !== 'search') return;
  clearTimeout(searchT);
  searchT = setTimeout(() => {
    state.search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const s = $('[data-tool="search"]'); s.focus(); s.setSelectionRange(pos, pos);
  }, 180);
});
document.addEventListener('keydown', e => {
  // Enter / Space on a focused block in the SVG views selects it, like a click.
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('g[data-select]')) { e.preventDefault(); return select(e.target.dataset.select); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('g[data-expand]')) { e.preventDefault(); return toggleBranch(e.target.dataset.expand); }
  if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (/^[1-6]$/.test(k)) setView(NAMES[+k - 1]);
  else if (k === 'escape') { state.selected = null; render(); }
  else if (k === 'p') setPresent(!state.present);
  else if (k === 'f') $('[data-act="fullscreen"]').click();
  else if (k === '/') { e.preventDefault(); $('[data-tool="search"]').focus(); }
});

bindPanel(panel, context);
$('[data-act="present"]').innerHTML = ICON.present;
$('[data-act="fullscreen"]').innerHTML = ICON.expand;
readHash();
load().catch(err => { stage.innerHTML = `<div class="empty"><b>Could not load the requirements.</b><span>${esc(err.message)}</span></div>`; });
window.__req = { state, render };

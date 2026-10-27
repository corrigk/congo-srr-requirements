// Colours, legends and the SRR page items a requirement can link to.
import { SEGMENTS, STATUSES, VERIFICATION } from './model.js';

const css = n => getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim();

export const COLOR_BY = { mo: 'Mission objective', segment: 'Segment', status: 'Status', verification: 'Verification' };

const PALETTE = {
  mo: { 'MO-1': 'data', 'MO-2': 'alert', 'MO-3': 'river' },
  segment: { Space: 'gold', Ground: 'river', Air: 'precip', Launch: 'rust-hi', 'User equipment': 'data', System: 'paper' },
  status: { draft: 'muted', agreed: 'data', TBR: 'alert', TBD: 'rust-hi' },
  verification: { I: 'precip', A: 'river', D: 'alert', T: 'data' },
};
const SHARED = '#C9A0FF', NONE = 'rgba(245,242,234,.35)';

// Colour for a requirement under the current "colour by" choice.
export function colorFn(by, model) {
  const P = PALETTE[by];
  return r => {
    if (!r) return NONE;
    if (by === 'mo') {
      if (r.mos.length > 1) return SHARED;
      const k = r.mos[0];
      if (!k) return NONE;
      const i = model.mos.findIndex(m => m.id === k);
      return css(P[k] || ['data', 'alert', 'river', 'precip', 'pink'][i % 5]);
    }
    const v = by === 'segment' ? r.segment : by === 'status' ? r.status : r.verification;
    return v && P[v] ? css(P[v]) : NONE;
  };
}

export function legend(by, model) {
  if (by === 'mo') return [...model.mos.map(m => ({ label: `${m.id} ${m.name || ''}`, color: colorFn('mo', model)(m) })), { label: 'Serves several MOs', color: SHARED }];
  const keys = by === 'segment' ? SEGMENTS : by === 'status' ? STATUSES : VERIFICATION.map(v => v.k);
  const names = by === 'verification' ? Object.fromEntries(VERIFICATION.map(v => [v.k, v.name])) : {};
  const c = colorFn(by, model);
  return [...keys.map(k => ({ label: names[k] || k, color: c({ mos: [], segment: k, status: k, verification: k }) })), { label: 'Not set', color: NONE }];
}

// ---------- links into the SRR page ----------
export const SRR_URL = 'https://corrigk.github.io/congo-river-basin-SRR/';
const steps = {
  A: ['Trigger', 'Uplink (BASINLINK)', 'Ground and COP', 'Authority decision', 'Broadcast (BASINCAST)', 'Confirmation', 'Response coordination'],
  B: ['Terminals across the basin', 'Daily payloads', 'A-4 balloons ride the same link', 'Into the COP'],
  C: ['Terrestrial networks go down', 'Two-way over S-3', 'A-1 relay as a complement', 'Service holds through the weather'],
  D: ['S-2 detects disturbance', 'Alert reaches rangers', 'A-2 confirms overhead', 'Two-way link for the response'],
};
export const SRR_REFS = [
  ...Object.entries(steps).flatMap(([s, list]) => list.map((t, i) => ({ kind: 'scenario', ref: `${s}${i + 1}`, label: `Scenario ${s}${i + 1} · ${t}`, url: `${SRR_URL}#scenario/${s}/${i + 1}` }))),
  ...['S-1', 'S-2', 'A-1', 'A-2', 'A-3', 'A-4'].map(r => ({ kind: 'interface', ref: r, label: `Interface · ${r}`, url: `${SRR_URL}#interfaces` })),
  ...[['orbit', 'One orbit vs hybrid'], ['freq', 'Frequency vs foliage, rain, antenna'], ['relay', 'Store-and-forward vs ISL vs bent pipe'], ['receiver', 'Broadcast receivers vs direct-to-phone'], ['payload', 'Shared vs separate payloads']]
    .map(([r, t]) => ({ kind: 'trade', ref: r, label: `Trade · ${t}`, url: `${SRR_URL}#trades` })),
  ...Array.from({ length: 10 }, (_, i) => `S3-${String(i + 1).padStart(2, '0')}`).map(r => ({ kind: 'srr-req', ref: r, label: `RFP ${r}`, url: `${SRR_URL}#requirements` })),
];
export const srrRef = (kind, ref) => SRR_REFS.find(x => x.kind === kind && x.ref === ref) || { kind, ref, label: `${kind} ${ref}`, url: SRR_URL };

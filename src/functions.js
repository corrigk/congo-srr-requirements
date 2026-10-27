// The functional flow (F1–F8) that requirements trace to. The list comes from the SRR page (npm run sync:functions).
// Tag the Level 1 requirements; Level 2–4 inherit unless they carry their own tags (see model.js).
import data from './functions.json';

const cap = s => s.charAt(0) + s.slice(1).toLowerCase();
export const FUNCTIONS = data.functions.map(f => ({ ...f, title: cap(f.name) }));
export const FN_IDS = FUNCTIONS.map(f => f.id);
export const fnBy = Object.fromEntries(FUNCTIONS.map(f => [f.id, f]));
export const fnLabel = id => (fnBy[id] ? `${id} ${fnBy[id].title}` : id);

// Words that hint a requirement belongs to a function. Only used to PRE-FILL the suggestion dialog; nothing is
// saved until you accept, and you can change every tick box.
const HINTS = {
  F1: ['sensor', 'gauge', 'detect', 'tag', 'handheld', 'ranger device', 'canopy', 'terminal life', 'battery', 'solar', 'low-power', 'wildlife', 'collect', 'measure', 'telemetry', 'trigger'],
  F2: ['uplink', 'transmit', 'satellite', 'link budget', 'link margin', 'frequency', 'spectrum', 'rain', 'antenna', 'contention', 'access', 'burst', 'relay', 'modulation', 'waveform'],
  F3: ['gateway', 'downlink', 'database', 'store', 'duplicate', 'cop', 'common operating', 'backhaul', 'integrity', 'ingest', 'forward', 'delivery to the cop', 'data delivery'],
  F4: ['process', 'evaluate', 'assess', 'threat', 'forecast', 'analytic', 'fusion', 'validate', 'situational'],
  F5: ['authorize', 'authoriz', 'authority', 'agency', 'cap ', 'common alerting', 'approval', 'authenticat', 'issue an alert', 'issue alerts'],
  F6: ['broadcast', 'alert uplink', 'geo-target', 'geotarget', 'geo target', 'footprint', 'language', 'message format', 'retransmit', 'encode'],
  F7: ['receiver', 'community', 'audible', 'speaker', 'spoken', 'village', 'outpost', 'alert delivery', 'siren', 'reach'],
  F8: ['confirm', 'acknowledg', 'verification', 'verify', 'two-way', 'responder', 'command', 'feedback', 'return link', 'ack '],
};

// Suggested functions for a requirement, best first (up to three), from its own text and its children's names.
export function suggest(r, m) {
  const text = [r.name, r.statement, r.rationale, ...r.children.map(c => m.get(c)?.name)].filter(Boolean).join(' ').toLowerCase();
  return FN_IDS
    .map(id => ({ id, score: HINTS[id].reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map(x => x.id);
}

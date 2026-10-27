// The functional flow (F1–F9) that requirements trace to: nine blocks, listed in src/functions.json.
// Tag the Level 1 requirements; Level 2–4 inherit unless they carry their own tags (see model.js).
import data from './functions.json';

export const FUNCTIONS = data.functions.map(f => ({ ...f, title: f.name }));
export const FN_IDS = FUNCTIONS.map(f => f.id);
export const fnBy = Object.fromEntries(FUNCTIONS.map(f => [f.id, f]));
export const fnLabel = id => (fnBy[id] ? `${id} ${fnBy[id].title}` : id);

// Words that hint a requirement belongs to a function (from the block names and their sub-steps). Only used to
// PRE-FILL the suggestion dialog; nothing is saved until you accept, and every box can be changed.
const HINTS = {
  F1: ['sensor', 'gauge', 'data source', 'measure', 'metadata', 'standardized', 'observation', 'tag', 'handheld', 'canopy', 'terminal life', 'battery', 'solar', 'low-power', 'wildlife', 'collect', 'detect', 'time-stamp', 'timestamp', 'queue'],
  F2: ['transmit', 'satellite', 'uplink', 'link', 'communication path', 'establish', 'direct message', 'forward', 'ground terminal', 'acknowledge reception', 'contention', 'access', 'antenna', 'frequency', 'rain', 'spectrum', 'handover', 'gateway', 'downlink'],
  F3: ['validate', 'identify message', 'reconcile', 'store', 'database', 'central', 'duplicate', 'model', 'distribute', 'monitors', 'process', 'ingest', 'integrity', 'record', 'retention', 'archive', 'common operating'],
  F4: ['evaluate', 'threshold', 'correlate', 'severity', 'hazard', 'assess', 'necessity', 'determine', 'forecast', 'analytic', 'retrieve', 'compare', 'alert decision'],
  F5: ['generate', 'proposed alert', 'customize', 'geographic', 'alert message', 'common alerting', 'cap ', 'authoriz', 'authority', 'agency', 'message content'],
  F6: ['broadcast', 'target recipients', 'pathway', 'relay', 'deliver', 'delivery', 'report delivery', 'alert delivery', 'footprint', 'coverage', 'geo-target', 'targeting', 'receivers and responders'],
  F7: ['receiver', 'community', 'audible', 'spoken', 'audio', 'notification', 'present', 'display', 'alert reception', 'acknowledgement', 'reception status', 'validate alert', 'village', 'siren', 'convert', 'language', 'crank'],
  F8: ['monitor', 'health', 'degradation', 'missing acknowledg', 'delivery status', 'delivery acknowledg', 'inspect', 'availability', 'operators', 'notify', 'diagnos', 'telemetry', 'fault', 'reliability'],
  F9: ['responder', 'authenticate', 'priority', 'outpost', 'return command', 'return message', 'field report', 'queue', 'command', 'two-way', 'distress', 'location report', 'mobility', 'ranger', 'traffic'],
};
const score = (id, text) => HINTS[id].reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
const textOf = (r, extra = []) => [r.name, r.statement, r.rationale, ...extra].filter(Boolean).join(' ').toLowerCase();

// Suggested functions for a requirement, best first (up to three), from its own text and its children's names.
export function suggest(r, m) {
  const text = textOf(r, r.children.map(c => m.get(c)?.name));
  return FN_IDS
    .map(id => ({ id, score: score(id, text) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map(x => x.id);
}

// Copy the functional flow (F1-F8) from the SRR page's analysis data, so requirements can be traced to it.
// Run with both repos side by side:  npm run sync:functions
import fs from 'node:fs';

const SRC = new URL('../../congo-river-basin-SRR/analysis/data/functions.json', import.meta.url);
const OUT = new URL('../src/functions.json', import.meta.url);
const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const functions = src.functions.map(f => ({ id: f.id, name: f.name, label: f.flood_label, description: f.description }));
fs.writeFileSync(OUT, `${JSON.stringify({ source: 'congo-river-basin-SRR analysis/data/functions.json', functions }, null, 2)}\n`);
console.log(`${functions.length} functions: ${functions.map(f => f.id).join(' ')}`);

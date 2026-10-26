// Starting data for a fresh database (used only when data/working.json does not exist yet).
// - Mission objectives and the RFP S3-xx values are verbatim from the RFP.
// - L1-2.1 to L1-2.5 are the team's MO-2 Level 1 drafts, verbatim.
// - Everything flagged `example: true` is a placeholder showing how the tree works: edit or delete it.
// - Where each S3-xx sits in the tree is a proposal (status TBR); the IDs are new, the source keeps the RFP number.

const mo = (id, sort, name, statement) => ({ id, type: 'mo', sort, name, statement, source: 'mission', status: 'agreed' });
const req = (id, o) => ({ id, type: 'req', status: 'draft', source: 'derived', ...o });

const reqs = [
  mo('MO-1', 1, 'Collect', 'Collect short messages from thousands of low-power gauges, sensors, wildlife tags, and ranger devices anywhere in the basin, including under canopy.'),
  mo('MO-2', 2, 'Warn', 'Broadcast geo-targeted, spoken alerts to every community and confirm delivery.'),
  mo('MO-3', 3, 'Coordinate', 'Give rangers and responders two-way communications that survive loss of terrestrial networks.'),

  // ---- MO-2 Level 1 (team drafts, verbatim) ----
  req('L1-2.1', { name: 'Alert transmission', statement: 'The system shall transmit emergency alerts to designated communities throughout the Congo River Basin.', rationale: 'Establishes the alert transmission capability.', segment: 'System' }),
  req('L1-2.2', { name: 'Geographic targeting', statement: 'The system shall support geographically targeted alert distribution to individually selected communities or groups of communities.', rationale: 'Ensures alerts reach the intended geographic areas.', segment: 'System' }),
  req('L1-2.3', { name: 'Audible spoken alerts', statement: 'The system shall provide designated communities with the capability to receive and reproduce emergency alerts as audible spoken messages.', rationale: 'Establishes the need for community receivers and spoken alerts.', segment: 'System' }),
  req('L1-2.4', { name: 'Reception confirmation', statement: 'The system shall provide confirmation of successful alert reception from each targeted community.', rationale: 'Establishes the delivery acknowledgment capability.', segment: 'System' }),
  req('L1-2.5', { name: 'Independent of terrestrial networks', statement: 'The system shall support emergency alert delivery to designated communities without reliance on terrestrial communication networks.', rationale: 'Establishes independence from existing infrastructure.', segment: 'System' }),

  // ---- MO-1 and MO-3 Level 1: examples to replace ----
  req('L1-1.1', { example: true, name: 'Basin-wide collection', statement: 'The system shall collect short messages from sensor terminals anywhere in the Congo River Basin, including under forest canopy.', rationale: 'Example: basin-wide, under-canopy collection (MO-1).', segment: 'System', verification: 'A' }),
  req('L1-1.2', { example: true, name: 'Priority delivery to the COP', statement: 'The system shall deliver priority sensor messages to the common operating picture.', rationale: 'Example: time-critical data reaches decision makers (MO-1).', segment: 'System', verification: 'T' }),
  req('L1-1.3', { example: true, name: 'Low-power terminals', statement: 'The system shall support low-power, low-cost sensor terminals.', rationale: 'Example: terminals must be affordable and long-lived in the field (MO-1).', segment: 'User equipment', verification: 'A' }),
  req('L1-3.1', { example: true, name: 'Responder two-way comms', statement: 'The system shall provide two-way communications between responders and coordinating authorities.', rationale: 'Example: field coordination (MO-3).', segment: 'System', verification: 'D' }),
  req('L1-3.2', { example: true, name: 'Commands and acknowledgments', statement: 'The system shall deliver commands and acknowledgments to any responder terminal.', rationale: 'Example: closes the coordination loop (MO-3).', segment: 'System', verification: 'T' }),
  req('L1-3.3', { example: true, name: 'Survives terrestrial outages', statement: 'The system shall maintain responder communications without reliance on terrestrial networks.', rationale: 'Example: towers and grid fail in floods and conflict (MO-3).', segment: 'System', verification: 'D' }),

  // ---- Level 2: RFP S3-xx (values verbatim; placement proposed, TBR) ----
  ...[
    ['S3-01', 'Service area', 'Entire 3.7M km² basin, including under 30-40 m canopy for sensors', 'All 10 basin countries', 'System'],
    ['S3-02', 'Sensor terminals served / routine data per terminal per day', '≥10,000 / ≥2 kB', '≥100,000 / ≥50 kB', 'System'],
    ['S3-03', 'Priority sensor message to the COP', '≤30 min, ≥95% delivered', '≤5 min, ≥99% delivered', 'System'],
    ['S3-04', 'Sensor terminal life on solar or battery / unit cost', '≥1 yr / ≤$150', '≥3 yr / ≤$50, ≤25 g tag variant', 'User equipment'],
    ['S3-05', 'Authorized alert to audible at a community receiver', '≤10 min for ≥95% of receivers', '≤3 min for ≥99%', 'System'],
    ['S3-06', 'Alert geo-targeting / spoken languages', '≤50,000 km² / French + Lingala, Kiswahili, Kikongo, Tshiluba', '≤2,500 km² / ≥10, selected by district', 'Ground'],
    ['S3-07', 'Community receiver', '≤$25, solar or crank, fixed antenna with no pointing', '≤$10, or reception on existing phones', 'User equipment'],
    ['S3-08', 'Responder two-way terminals', '≥500 simultaneous at ≥4.8 kbps', '≥5,000 at ≥64 kbps', 'User equipment'],
    ['S3-09', 'Command or acknowledgment delivered to any terminal', '≤6 h', '≤15 min', 'System'],
    ['S3-10', 'Service availability in heavy tropical rain / service life', '≥99.5% / 10 yr', '≥99.9% / 15 yr', 'System'],
  ].map(([s3, name, threshold, objective, segment]) => req(`L2-${s3}`, {
    name, threshold, objective, segment, source: `RFP ${s3}`, status: 'TBR',
    statement: `The system shall meet RFP requirement ${s3}: ${name}.`,
    rationale: `RFP Level 0 requirement ${s3}, values verbatim. Placement in this tree is proposed (TBR).`,
    srr: [{ kind: 'srr-req', ref: s3 }],
  })),

  // ---- Level 3 and 4: one example thread per segment (values TBD on purpose) ----
  req('L3-ALERT-GND', { example: true, name: 'CAP ingest', statement: 'The ground segment shall validate and ingest CAP alerts issued by authorized national agencies.', segment: 'Ground', verification: 'T', rationale: 'Example: alert authority stays with national agencies (constraint).', srr: [{ kind: 'scenario', ref: 'A4' }] }),
  req('L3-ALERT-SPC', { example: true, name: 'Broadcast relay', statement: 'The space segment shall relay geo-targeted alert broadcasts to community receivers.', segment: 'Space', verification: 'A', rationale: 'Example: allocation of the broadcast leg to the space segment.', srr: [{ kind: 'scenario', ref: 'A5' }, { kind: 'trade', ref: 'receiver' }] }),
  req('L3-ALERT-RX', { example: true, name: 'Receiver plays alerts', statement: 'The community receiver shall play received alerts as audible speech.', segment: 'User equipment', verification: 'D', rationale: 'Example: allocation of S3-05 and S3-07 to the receiver.' }),
  req('L4-RX-POWER', { example: true, name: 'Receiver power', statement: 'The community receiver shall operate from solar or hand-crank power.', segment: 'User equipment', verification: 'D', rationale: 'Example: derived from S3-07 (solar or crank).' }),
  req('L4-RX-AUDIO', { example: true, name: 'Receiver loudness', statement: 'The community receiver shall produce speech at a sound level of TBD dB at TBD m.', segment: 'User equipment', verification: 'T', status: 'TBD', rationale: 'Example: placeholder value; set by analysis.' }),
  req('L3-LAUNCH', { example: true, name: 'Launch to orbit', statement: 'The launch segment shall deliver the space segment to its operational orbit (orbit TBD by trade study).', segment: 'Launch', verification: 'I', status: 'TBD', rationale: 'Example: launch allocation; orbit not selected.', srr: [{ kind: 'trade', ref: 'orbit' }] }),
  req('L2-AIR-RELAY', { example: true, name: 'Airborne relay interface', statement: 'The system shall interface with airborne relay platforms for regional coverage during terrestrial outages.', segment: 'Air', source: 'interface', verification: 'D', status: 'TBR', rationale: 'Example: complementary A-1 relay; overlap TBR with the A-1 team.', srr: [{ kind: 'interface', ref: 'A-1' }] }),
];

const L = [];
const link = (parent, ...children) => children.forEach(child => L.push({ parent, child, ord: L.filter(l => l.parent === parent).length + 1 }));
link('MO-1', 'L1-1.1', 'L1-1.2', 'L1-1.3');
link('MO-2', 'L1-2.1', 'L1-2.2', 'L1-2.3', 'L1-2.4', 'L1-2.5');
link('MO-3', 'L1-3.1', 'L1-3.2', 'L1-3.3');
link('L1-1.1', 'L2-S3-01', 'L2-S3-02');
link('L1-2.1', 'L2-S3-01');           // one requirement, two parents: service area serves collection and alerting
link('L1-1.2', 'L2-S3-03');
link('L1-1.3', 'L2-S3-04');
link('L1-2.1', 'L2-S3-05');
link('L1-2.3', 'L2-S3-05', 'L2-S3-07', 'L2-S3-06');
link('L1-2.2', 'L2-S3-06');
link('L1-3.1', 'L2-S3-08');
link('L1-3.2', 'L2-S3-09');
link('L1-2.5', 'L2-S3-10');
link('L1-3.3', 'L2-S3-10', 'L2-AIR-RELAY');
link('L2-S3-05', 'L3-ALERT-GND', 'L3-ALERT-SPC', 'L3-ALERT-RX');
link('L2-S3-07', 'L3-ALERT-RX');
link('L3-ALERT-RX', 'L4-RX-POWER', 'L4-RX-AUDIO');
link('L2-S3-10', 'L3-LAUNCH');

export const SEED = { reqs, links: L };

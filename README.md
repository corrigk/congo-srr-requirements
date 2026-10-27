# S-3 Requirements: BASINLINK & BASINCAST decomposition

Requirements decomposition for RFP S-3 (Congo River Basin SRR): the three mission objectives (Level 0) down through
Level 1–4 requirements, with the threads between them.

- **Local editor** (`npm start`): add, edit, drag to rearrange, stored in SQLite on your computer.
- **Static site** (GitHub Pages): read-only views of the latest finalized baseline, for sharing and presenting.
  **Live:** https://corrigk.github.io/congo-srr-requirements/
- Companion to the SRR demo page: https://corrigk.github.io/congo-river-basin-SRR/

## Run the editor

Needs Node 22.5 or newer (it uses Node's built-in SQLite; nothing to compile).

```bash
npm install
npm start          # opens http://localhost:5180
```

| View (key) | What it shows |
| --- | --- |
| Outline (1) | The whole decomposition as an indented list. The editor lives here. |
| Thread tree (2) | Across (L0 left → L4 right) or down (L0 top, leaf siblings stacked under their parent); **Auto** picks whichever fills the screen. **Depth** (L1 … All) folds everything deeper into **+N** badges: click one to open that branch, **−** to fold it. Choosing segments in the toolbar turns the tree into a **focus view**: only those requirements and the parents above them, with **Show all** to zoom back out. Click a block to light its full thread, up and down. |
| Radial (3) | MOs in the centre, one ring per level: the whole decomposition in one picture. |
| Matrix (4) | Every requirement against its parents, verification method, segment, status or **function** (F1–F8). Gaps are flagged. |
| Table (5) | One row per requirement, in outline order, for reading or a slide. Pick the **columns**; **Copy for slides** puts a formatted table on the clipboard (paste into PowerPoint or Word); **Download CSV** has every field and opens in Excel; **Print / PDF** is a landscape page with the header repeated. It follows the filters and the search box. |
| Graph (6) | Force-directed web of every requirement and link. Drag nodes around. |
| Baselines (7) | Finalize a baseline; compare any two versions (added, removed, moved, changed). |

**Summary strip** (Outline, Thread tree and Table; **Summary** hides or shows it, and it remembers which). Totals by
level and status, and a **mission-objective** filter. Open it for the segment table (how many requirements per segment,
and how each is verified: T test, D demonstration, A analysis, I inspection, `?` not set), what is still missing
(owner, threshold, rationale, L1 function) and the functional flow. Every number follows the filters, and clicking a
segment, function or MO is the filter (click again to clear; the link remembers it).

**Tracing to the functional flow (F1–F8).** Tag each **Level 1** requirement with the functions it supports (panel →
Functional flow). Level 2–4 **inherit** their L1's tags, shown dashed; tag one separately to override. Tags show in the
panel, the strip (counts per function, click to filter), the Matrix (Function mode), the Table and the CSV (traced and
own tags in separate columns). **Suggest functions…** in the strip fills in a review dialog for untagged L1s from their
wording; nothing is saved until you press Apply, and every box can be changed. The F1–F8 list is a copy of the SRR
page's `functions.json`: after changing it there, run `npm run sync:functions` (both repos side by side).

**Editing**

- Click a requirement to open its form on the right. Every change saves straight away.
- Drag the `⋮⋮` handle onto a block to nest it there, or just above / below a block to reorder.
- Hold **Ctrl** (or Alt) while dropping to add a **second parent** instead of moving. A requirement can serve several
  parents; the extra threads are drawn dashed.
- `+` on a row (or "Add a child requirement" in the form) creates a child with a suggested ID. IDs are permanent
  labels you can change; the outline number (2.3.1) is worked out from where a block sits, so moving never breaks an ID.
- Moves that would create a loop (a requirement under its own child) are refused.
- **Checks** lists problems to fix before a baseline: not connected to an MO, no "shall" statement, no verification
  method, an L1 not traced to a function, deeper than Level 4, and items marked TBR / TBD or Example.
- Everything marked **Example** is a placeholder from the starter data. "Delete all examples" removes them in one go.

**Presenting:** `P` toggles presenter mode (larger, higher contrast, no editing controls). The segment, mission-objective and function filters dim everything outside them (the Thread tree shows only those requirements plus the parents above them; the Table shows only those rows). Links remember the view, selection and filters,
so a slide can open straight to a thread: `…/#tree/L1-2.3?seg=Space,Ground`. Filters in a link: `seg=` (segment names, or `none`), `mo=MO-2`, `fn=F1,F2` (or `none`). Tree options go in the link too: `depth=2`, `dir=h` (across) or `dir=v` (down), e.g. `…/#tree?seg=Ground&depth=2`.

## Where the data lives

| File | Committed | What it is |
| --- | --- | --- |
| `data/requirements.db` | no | Your local SQLite working copy. |
| `data/working.json` | yes | The same data as readable JSON, rewritten after every change. Git can diff and merge it, and a fresh clone rebuilds the database from it. |
| `data/baselines/*.json` | yes | Frozen baselines from **Finalize**. |
| `data/published.json` | yes | The latest finalized baseline: what the static site shows. |

To share or publish: finalize a baseline in the Baselines view, then commit and push `data/`. GitHub Actions rebuilds
the static site. Until the first baseline exists, the site shows the working copy, marked "draft, not finalized yet".

Teammates later: clone, `npm install`, `npm start`. Each person edits their own local copy and commits
`data/working.json`. If two people edit at once, git merges the JSON like any text file.

## Starting data

- MO-1 to MO-3 are verbatim from the RFP. **L1-2.1 to L1-2.5** are the team's MO-2 Level 1 drafts, verbatim.
- The RFP's S3-01 to S3-10 appear at Level 2 under new IDs (`L2-S3-05` …). Their values are verbatim and their
  source field keeps the RFP number; where each sits in the tree is a proposal (status TBR).
- MO-1 and MO-3 Level 1s and the Level 3–4 thread are **examples** to show how the tree works. Replace them.

## Code map

- `server/db.mjs`: SQLite store, cycle check, export to JSON, finalize. `server/api.mjs`: the editor's JSON API.
  `server/seed.mjs`: starter data.
- `src/model.js`: levels, outline numbers, MO lineage, threads, checks, baseline diff (shared by every view).
- `src/views/`: outline (editor), graphs (tree, radial, force), matrix, baselines. `src/panel.js`: the side panel.
- `vite.config.js`: mounts the API on the dev server; the build copies the published data next to the static page.

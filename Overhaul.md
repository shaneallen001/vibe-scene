# Vibe Scenes -- Visual Overhaul Goals

Three improvements to bring generated dungeons closer to modern battlemap quality.

---

## Goal 1: Multi-Cell Assets -- IMPLEMENTED

**Problem:** Every placed object (beds, desks, crate piles, altars) renders as a single 1x1 grid cell, regardless of its logical size. A bed should be 2x1, a large desk 2x1, a pile of crates 2x2, etc.

**What changed:**

- The AI planner prompts (`DUNGEON_PLANNER`, `DUNGEON_CONTENT_PLANNER`, `ROOM_CONTENT`) now request and return `width`/`height` per placed item, with a size guide (1x1 for small, 2x1 for medium, 2x2 for large, 3x2 for very large).
- Item placement code in `DungeongenService._planAndPopulate()` honors `width`/`height` from the AI plan and resolved asset, converting them to pixel dimensions (`cellW * gridSize` x `cellH * gridSize`) instead of always using `gridSize x gridSize`.
- The SVG generation system (`AiAssetService.generateSVG()`) now accepts `width`/`height` options and generates non-square viewBoxes (e.g. `0 0 1024 512` for a 2x1 object) so art fills the intended footprint.
- `saveAsset()` stores the actual `width`, `height`, and `placement` in `library.json` via `AssetLibraryService.registerAsset()`.
- Wishlist items carry `width`/`height` through the generation pipeline.
- SVG validation and sanitization handle non-512 viewBoxes correctly.

---

## Goal 2: Ambient Room Population (Decor Layer) -- IMPLEMENTED

**Problem:** Rooms look empty. While some assets are obstacles (tables, chests), many decorative elements -- wall torches, rugs, banners, cobwebs, bloodstains -- could populate rooms without blocking movement.

**What changed:**

- Introduced a `placement` field on assets: `"blocking"` (furniture, obstacles) vs `"ambient"` (decor, non-blocking). Stored in `library.json` and carried through the entire pipeline.
- The AI planner prompts now distinguish between blocking contents and ambient decor, with separate density budgets:
  - Blocking: 0 items for tiny rooms, 1-3 for small, 3-5 for medium, 5-10 for large.
  - Ambient: 1-2 for tiny rooms, 2-4 for small, 4-6 for medium, 6-10 for large.
  - Corridors get 0 blocking but 1-3 ambient items (torches, cobwebs, cracks).
- `_planAndPopulate()` tracks blocking and ambient counts separately, with `_getDesiredRoomItemCounts()` returning `{ blocking, ambient }`.
- Wall-adjacent ambient items use `_pickWallAdjacentCell()` to snap to room perimeter cells.
- The scene importer marks ambient tiles with `overhead: false`, `occlusion: { mode: 0 }`, and a `flags["vibe-scenes"].placement` tag so they are purely visual, non-blocking decor in Foundry.
- Available assets sent to the AI include `width`, `height`, and `placement` fields so the planner can make informed decisions.

---

## Goal 3: (Future) Lighting & Atmosphere

Not yet started. Potential improvements: dynamic lighting from placed torches, ambient sound zones, fog-of-war presets per room theme.

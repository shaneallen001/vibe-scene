# Vibe Scenes -- Visual Overhaul Goals

Three improvements to bring generated dungeons closer to modern battlemap quality.

---

## Goal 1: Multi-Cell Assets

**Problem:** Every placed object (beds, desks, crate piles, altars) renders as a single 1x1 grid cell, regardless of its logical size. A bed should be 2x1, a large desk 2x1, a pile of crates 2x2, etc.

**What needs to change:**

- The `width` and `height` fields already exist in `library.json` but are always `1`. Assets should be generated at their natural dimensions and the library entries updated accordingly.
- The AI planner prompts (`DUNGEON_PLANNER`, `DUNGEON_CONTENT_PLANNER`) need to request and return `width`/`height` per placed item so the planner can reason about multi-cell footprints.
- Item placement code in `DungeongenService._planAndPopulate()` must honor `width`/`height` from the resolved asset, converting them to pixel dimensions instead of always using `gridSize x gridSize`.
- The SVG generation prompts should be aware of the target aspect ratio so generated art fills the intended footprint.

---

## Goal 2: Ambient Room Population (Decor Layer)

**Problem:** Rooms look empty. While some assets are obstacles (tables, chests), many decorative elements -- wall torches, rugs, banners, cobwebs, bloodstains -- could populate rooms without blocking movement.

**What needs to change:**

- Introduce a `placement` tag or category on assets: `"blocking"` (furniture, obstacles) vs `"ambient"` (decor, non-blocking). This could be a new field in `library.json` or inferred from tags.
- The AI planner should distinguish between blocking contents and ambient decor, placing ambient items along walls, in corners, or as overlays.
- Wall-mounted items (torches, sconces, banners) should snap to wall-adjacent cells facing inward.
- Ambient items should not count toward the room's "clutter" budget -- they fill visual space without impeding gameplay.
- The scene importer should mark ambient items as non-blocking (no collision in Foundry).

---

## Goal 3: Textured Wall Borders (Priority)

**Problem:** Room and corridor boundaries are currently rendered as thin 2px dark lines. Modern dungeon generators render thick, textured wall bands (1-2 cells wide) with repeating patterns -- stone blocks, wooden planks, ancient sandstone, etc. -- that communicate the dungeon's architectural style.

**What needs to change:**

- **Grid layer:** After room/corridor carving, mark `EMPTY` cells adjacent to `FLOOR` cells as `CellType.WALL` (value 2, already defined but unused). This creates a 1-cell-thick band of wall cells around every room and corridor.
- **AI planning layer:** Update planner prompts to return `"default_wall"` (dungeon-wide wall texture) and optional per-room `"wall_texture"` overrides. Add `"WALL"` as a valid wishlist type so missing wall textures are generated on the fly.
- **Service layer:** Resolve wall textures from the library the same way floor textures are resolved. Pass `wallTexture` and `roomWallTextures` to the renderer.
- **Render layer:** Replace the thin stroke in `_drawWalls()` with a textured fill of `WALL` cells using `createPattern()`, plus a thin outline on the `WALL`/`EMPTY` boundary for crispness.
- **WallBuilder:** Update Foundry wall segment extraction to place vision-blocking walls at the `FLOOR`/`WALL` boundary (where players stop) instead of `FLOOR`/`EMPTY`.

This is the first goal to implement because it has the highest visual impact and the infrastructure (CellType.WALL, SVG_WALL prompt, WALL asset type) already partially exists.

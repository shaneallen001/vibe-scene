# Vibe Scenes Architecture & Developer Guide

This document is intended for AI agents and human developers working on the `vibe-scenes` module. Complete usage details are in [README.md](./README.md).

## 1. Entry Point & Hooks (`scripts/main.js`)

```
Hooks.once("init")            → Checks for `vibe-common` dependency, then calls registerModuleSettings() — 
                                settings registered early so they're available to all modules during init phase
Hooks.once("ready")           → migrateGeminiSvgModelDefault() — one-time data migration
Hooks.on("renderSceneDirectory") → addVibeSceneButton() via requestAnimationFrame
Hooks.on("renderSidebarTab")  → Same, guards on app.tabName === "scenes"
```

> **Why `init` for settings?** Unlike vibe-actor and vibe-combat, vibe-scenes registers settings in the `init` hook (not `ready`). This ensures settings are available during the module initialization phase, which is important for services that read settings during their own initialization.

## 2. Directory Structure

```
scripts/
├── main.js                         # Entry point, hook registration
├── settings.js                     # game.settings.register() + migrateGeminiSvgModelDefault()
├── ai/
│   └── prompts.js                  # Centralized AI system prompts and instructions
├── data/
│   └── library.json                # (Runtime write target) Asset library index
├── debug/
│   └── ...                         # Debug utilities
├── dungeongen/                     # Pure JS dungeon generation library (no Foundry dependency)
│   ├── dungeongen.js               # Main entry: DungeonGenerator + DungeonRenderer classes
│   ├── algorithms/                 # Pathfinding, graph algorithms (A*, MST)
│   ├── layout/                     # Phase-based layout data structures
│   └── map/                        # WallBuilder and DungeonRenderer
├── services/
│   ├── dungeongen-service.js       # Main orchestrator: Generate → Plan → Render → Return
│   ├── ai-asset-service.js         # AiAssetService: Gemini SVG generation, dungeon planner
│   ├── asset-library-service.js    # AssetLibraryService: Read/write library.json
│   ├── gemini-service.js           # Extended Gemini client (text + vision/multimodal)
│   └── scene-importer.js           # SceneImporter: Creates Foundry Scene from dungeon output
├── ui/                             # Vibe Scene and Studio dialogs
└── tests/                          # Standalone Node.js testers
```

## 3. Full Generation Flow (`services/dungeongen-service.js`)

`DungeongenService.generate(options)` is the top-level orchestrator. It runs four major phases:

```
DungeongenService.generate(options)
│
├─ Phase 1: Layout Generation
│   ├─ Procedural mode → DungeonGenerator.generate()
│   │     Uses phase-based room placement (random/relaxation/symmetric) + MST + A* corridor carving
│   └─ Intentional mode (AI) → AiAssetService.planDungeonOutline() → DungeonGenerator.generateFromOutline()
│         AI designs the room/connection structure; generator implements it deterministically
│
├─ Phase 2: AI Planning & Population → _planAndPopulate(grid, options)
│   ├─ Load asset library (AssetLibraryService.load())
│   ├─ AiAssetService.planDungeon(rooms, assets, description) → { plan[], wishlist[], default_floor, default_wall }
│   │     plan[]:    Per-room { id, theme, description, contents[], floor_texture, wall_texture }
│   │     wishlist[]: New assets to generate { name, type, visual_style, width, height, placement }
│   ├─ Wishlist Processing (bounded concurrency pool, DungeongenService.WISHLIST_CONCURRENCY)
│   │     For each wishlist item: AiAssetService.generateSVG() → saveAsset()
│   │     Failures are swallowed — one bad asset doesn't block the batch
│   ├─ AssetLibraryService.reload() — Force-reloads library.json after wishlist generation
│   ├─ Texture Resolution: _findTexture() — 3-strategy fuzzy match
│   └─ Item Placement: Converts plan contents to pixel coordinates
│
├─ Phase 3: Canvas Rendering → DungeonRenderer.renderToBlob()
│   ├─ Multi-layer approach: Floor → Wall textures → Wall edges → Items → Doors
│   ├─ ctx.createPattern() fillls FLOOR cells with default/per-room textures
│   └─ Optional Visual Review Pass: AI inspects the rendered PNG and proposes adjustments
│         Then re-renders if changes are suggested
│
└─ Phase 4: Wall Building → WallBuilder.build(grid, gridSize, padding)
      Collinear merging: Collapses tile-sized segments into long single wall lines
      Walls placed 1/3 cell inward from FLOOR/WALL boundary (lets players see wall texture)
      Returns { blob, walls[], items[], rooms[] }
```

## 4. Scene Import (`services/scene-importer.js`)

`SceneImporter` consumes the output of `DungeongenService.generate()` and creates a Foundry `Scene` document:

```
SceneImporter.importScene({ blob, walls, items, rooms, name, gridSize, ... })
  1. Upload blob → FilePicker upload → scene background image path
  2. Scene.create({ name, background, grid, ... })
  3. scene.createEmbeddedDocuments("Wall", walls)         — Vision walls + doors
  4. scene.createEmbeddedDocuments("Tile", items)         — Decor tiles (blocking + ambient)
  5. For each room with a description → JournalEntry.create() + Note placed on map
```

> **Tile vs Token**: Room objects are created as **Tiles** (`scene.createEmbeddedDocuments("Tile")`), not Tokens. Tiles are static map decorations.

## 5. Dungeongen Library (`scripts/dungeongen/`)

This is a self-contained JavaScript port of the `dungeongen` library. It has **no dependency on Foundry APIs** and can be run standalone via `tests/test_generator.js`.

**`CellType` enum**:
- `EMPTY` — Outside the dungeon (no rendering)
- `FLOOR` — Walkable room/corridor interior
- `WALL` — 1-cell-thick textured border around FLOOR cells (carved by `DungeonGrid.carveWallPerimeter()`)
- `DOOR` — Wall cell designated as a door

## 6. AiAssetService (`services/ai-asset-service.js`)

The main AI planner and SVG generator. Uses a **two-model split** for quality vs. speed:
- `textModel` (configurable, default `gemini-2.5-flash`) — Used for dungeon planning JSON. Fast, structured output.
- `svgModel` (configurable, default `gemini-pro`) — Used for SVG generation. Higher quality for richer art.

**Asset types** understood by the service: `OBJECT` (decor), `TEXTURE` (floor fill), `WALL` (wall band fill).

**SVG quality loop**: `generateSVG` uses an iterative critique-refine loop (generate → critique → refine) to push assets toward a higher detail target before returning the final SVG.

**`_sanitizeSVG(svg)`**: All AI-generated SVGs are sanitized before saving:
- Removes `<style>` blocks (inline styles only — browser VTT compatibility)
- Ensures `viewBox` attribute is present
- Performs aggressive minification to drastically reduce file size.

## 7. Dynamic Texture Pipeline (Floors & Walls)

1.  **AI Planning**: `AiAssetService.planDungeon()` returns `default_floor`, `default_wall`, and per-room `floor_texture`/`wall_texture` values.
2.  **Wishlist Generation**: Generates new textures if required.
3.  **Library Reload**: `AssetLibraryService.reload()` forces a fresh read from `library.json`.
4.  **Fuzzy Texture Resolution**: `DungeongenService._findTexture()` matches AI-returned texture names to library assets.
5.  **Wall Perimeter Carving**: `DungeonGrid.carveWallPerimeter()` creates a 1-cell-thick textured wall band around every room.
6.  **Canvas Rendering**: `ctx.createPattern()` fills polygons for floors and walls.
7.  **Foundry Walls**: `WallBuilder` places vision-blocking wall segments **1/3 cell outward** from the `FLOOR`/`WALL` boundary.

## 8. Common Gotchas
- **Library reload after wishlist**: Always call `AssetLibraryService.reload()` after generating wishlist assets. Wait 1-second for filesystem flush.
- **Two `GeminiService` files**: `vibe-scenes/scripts/services/gemini-service.js` is NOT the same as `vibe-common/scripts/services/gemini-service.js`. The scenes version supports multimodal requests.
- **`DungeongenService.WISHLIST_CONCURRENCY`**: Controls parallel SVG generation. Adjust carefully.

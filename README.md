# Vibe Scenes

A Foundry VTT v13 module for generating procedural dungeon maps and importing them as new scenes.

> **Part of the Vibe Project**: This module works alongside `vibe-common`, `vibe-combat`, and `vibe-actor` to provide a comprehensive AI-enhanced Foundry experience.

## Features

- **"Vibe Scene" Button**: Adds a button to the Scenes directory sidebar for quick dungeon generation
- **Built-in Dungeon Generator**: Procedural dungeon generation runs entirely within Foundry (no external dependencies!)
- **Dungeon Configuration**: Configure dungeon size, symmetry, water features, and random seed
- **Scene Import**: Automatically creates a new Foundry scene with the generated dungeon map
- **AI Asset Library**: Manage your generated assets with a visual library, featuring filtering, sorting, and easy regeneration.
- **Auto-Walls & Doors**: Automatically constructs vision-blocking walls and interactive doors
- **Textured Wall Borders**: Rooms and corridors are wrapped in thick, textured wall bands (stone blocks, wood planks, sandstone, etc.) that communicate the dungeon's architectural style. The AI planner selects a dungeon-wide default wall texture and can override per-room.
- **AI Asset Generator**: Built-in integration with Google Gemini to generate custom SVG map assets
- **Smart Room Population**: Uses AI to intelligently furnish every room with multi-cell furniture and atmospheric decor based on your specific asset library
- **Roleplay Ready**: Automatically generates descriptive flavor text for each room and creates Journal Entries linked to the map.
- **Floor Style Selection**: Choose from available floor textures in your library (e.g., Stone, Wood)
- **Grid Settings**: Configurable grid size for the generated scenes

## Installation

1. Download the module files to your Foundry VTT modules folder:
   ```
   [FoundryVTT Data]/Data/modules/vibe-scenes/
   ```
2. **Install Dependency**: Ensure `vibe-common` is installed and enabled (vibe-scenes will cleanly abort initialization and show an error notification if this dependency is missing).
3. Enable "Vibe Scenes" in Foundry VTT's Module Management

## Usage

1. Navigate to the **Scenes** tab in the sidebar
2. Click the **"Vibe Scene"** button
3. Configure your dungeon:
   - **Scene Name**: Name for the new scene
   - **Dungeon Size**: TINY (4-6 rooms) to XLARGE (35-50 rooms)
   - **Dungeon Shape**: Rectangle, Round, Cross, Keep, or Cavernous
   - **Symmetry**: None (asymmetric) or Bilateral (mirror)
   - **Room Density**: 0.1 (Sparse) to 1.0 (Dense)
   - **Floor Style**: Visual style for the dungeon floor (e.g. Stone, Wood)
   - **Corridor Style**: L-Path (Standard), Straight (Jagged), or Wandering
   - **Connectivity**: Standard, Minimal (Tree), Full (Cyclic), or Chain
   - **Seed**: Optional number for reproducible dungeons
   - **Grid Size**: Pixels per grid square
4. Click **Generate** to create the dungeon

## Configuration

- **API Keys**: Configure your Gemini API key in the **Vibe Common** module settings.

Configure module settings in **Settings → Module Settings → Vibe Scenes**:

- **Default Grid Size**: Default grid size in pixels (default: 100)
- **Map Render Resolution**: Pixels per cell when rendering (default: 100)
- **Image Storage Path**: Folder for saving dungeon images (default: `vibe-scenes/dungeons`)
- **Gemini Text Model**: Used for planner/layout JSON tasks (default: `gemini-3-flash-preview`)
- **Gemini SVG Model**: Used for asset SVG generation; set this to a higher-quality model for richer detail (default: `gemini-3-pro-preview`)

### Advanced Configuration (Generator Options)

The underlying generator options are now fully exposed in the dialog:

- **Dead End Removal**: Controls pruning of dead-end corridors (`none`, `some`, `all`).
- **Peripheral Egress**: If true, digs exits from the dungeon edge to the map boundary.

- **Door Density**: Probability (0.0 - 1.0) of placing a door at a valid location.

---

## Developer Guide

### Module Entry Point & Hooks (`scripts/main.js`)

```
Hooks.once("init")            → Checks for `vibe-common` dependency, then calls registerModuleSettings() — 
                                settings registered early so they're available to all modules during init phase
Hooks.once("ready")           → migrateGeminiSvgModelDefault() — one-time data migration
Hooks.on("renderSceneDirectory") → addVibeSceneButton() via requestAnimationFrame
Hooks.on("renderSidebarTab")  → Same, guards on app.tabName === "scenes"
```

> **Why `init` for settings?** Unlike vibe-actor and vibe-combat, vibe-scenes registers settings in the `init` hook (not `ready`). This ensures settings are available during the module initialization phase, which is important for services that read settings during their own initialization.

### Directory Structure

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
│   │   ├── a-star.js
│   │   ├── mst.js
│   │   └── ...
│   ├── layout/                     # Phase-based layout data structures
│   │   ├── dungeon-grid.js         # DungeonGrid: CellType enum, grid state, carveWallPerimeter()
│   │   ├── room.js                 # Room data class
│   │   └── ...
│   └── map/
│       ├── wall-builder.js         # WallBuilder: converts grid cells → Foundry wall segments
│       └── dungeon-renderer.js     # DungeonRenderer: Canvas API rendering of grid to PNG/blob
├── services/
│   ├── dungeongen-service.js       # Main orchestrator: Generate → Plan → Render → Return
│   ├── ai-asset-service.js         # AiAssetService: Gemini SVG generation, dungeon planner
│   ├── asset-library-service.js    # AssetLibraryService: Read/write library.json
│   ├── gemini-service.js           # Extended Gemini client (text + vision/multimodal)
│   └── scene-importer.js           # SceneImporter: Creates Foundry Scene from dungeon output
├── tools/
│   └── ...                         # Internal dev tools
├── ui/
│   ├── button-injector.js          # Injects "Vibe Scene" button into Scene Directory header
│   ├── vibe-scene-dialog.js        # Main dungeon configuration dialog
│   ├── vibe-studio-dialog.js       # Asset generator dialog
│   └── asset-library.js            # Asset browser Application (includes pagination)
└── utils/
    └── ...
tests/
├── test_generator.js               # Standalone dungeon generator tester (Node.js, no Foundry)
├── test_ai_generator.js            # Standalone AI SVG generator tester
└── config.json                     # (gitignored) API key for standalone testing
styles/
├── main.css                        # Scene dialog, progress bar, studio dialog
└── asset-library.css               # Asset library table, preview panel, filter bar
```

### Full Generation Flow (`services/dungeongen-service.js`)

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
│   │     (1-second delay for filesystem consistency before reload)
│   ├─ Texture Resolution: _findTexture(textures, name) — 3-strategy fuzzy match
│   │     1. Exact name match (case-insensitive)
│   │     2. Substring match
│   │     3. Keyword overlap scoring
│   └─ Item Placement: Converts plan contents to pixel coordinates
│         Items are bounds-checked against room dimensions
│         Fallback population fills rooms the AI didn't cover (deterministic, seed-stable)
│         Post-pass guarantees no room is completely empty
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

### Scene Import (`services/scene-importer.js`)

`SceneImporter` consumes the output of `DungeongenService.generate()` and creates a Foundry `Scene` document:

```
SceneImporter.importScene({ blob, walls, items, rooms, name, gridSize, ... })
  1. Upload blob → FilePicker upload → scene background image path
  2. Scene.create({ name, background, grid, ... })
  3. scene.createEmbeddedDocuments("Wall", walls)         — Vision walls + doors
  4. scene.createEmbeddedDocuments("Tile", items)         — Decor tiles (blocking + ambient)
  5. For each room with a description → JournalEntry.create() + Note placed on map
```

> **Tile vs Token**: Room objects are created as **Tiles** (`scene.createEmbeddedDocuments("Tile")`), not Tokens. Tiles are static map decorations. This is intentional — they don't need actor backing.

### Dungeongen Library (`scripts/dungeongen/`)

This is a self-contained JavaScript port of the [dungeongen](https://github.com/benjcooley/dungeongen) library. It has **no dependency on Foundry APIs** and can be run standalone via `tests/test_generator.js`.

Key classes:

| Class              | File                          | Role                                                           |
| ------------------ | ----------------------------- | -------------------------------------------------------------- |
| `DungeonGenerator` | `dungeongen.js`               | Generates the grid (rooms, corridors, doors)                   |
| `DungeonRenderer`  | `dungeongen.js` (via imports) | Renders grid to Canvas; produces a `Blob`                      |
| `DungeonGrid`      | `layout/dungeon-grid.js`      | Grid state; `CellType` enum (`FLOOR`, `WALL`, `EMPTY`, `DOOR`) |
| `WallBuilder`      | `map/wall-builder.js`         | Converts grid → Foundry wall segment array                     |
| `AStar`            | `algorithms/a-star.js`        | Pathfinding for corridor carving                               |
| `MST`              | `algorithms/mst.js`           | Minimum spanning tree for room connectivity                    |

**`CellType` enum** (critical for understanding the texture pipeline):
- `EMPTY` — Outside the dungeon (no rendering)
- `FLOOR` — Walkable room/corridor interior
- `WALL` — 1-cell-thick textured border around FLOOR cells (carved by `DungeonGrid.carveWallPerimeter()`)
- `DOOR` — Wall cell designated as a door

**Wall Perimeter**: After layout generation, `DungeonGrid.carveWallPerimeter()` marks all `EMPTY` cells adjacent to `FLOOR` cells as `CellType.WALL`. This creates the textured wall band.

### AiAssetService (`services/ai-asset-service.js`)

The main AI planner and SVG generator. Uses a **two-model split** for quality vs. speed:

- `textModel` (configurable, default `gemini-2.5-flash`) — Used for dungeon planning JSON. Fast, structured output.
- `svgModel` (configurable, default `gemini-pro`) — Used for SVG generation. Higher quality for richer art.

Key methods:

| Method                                         | Description                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| `planDungeon(rooms, assets, description)`      | Returns `{ plan[], wishlist[], default_floor, default_wall }`             |
| `planDungeonOutline({ ... })`                  | AI designs the room/connection structure for intentional mode             |
| `planDungeonFromOutline({ ... }, assets)`      | Plans content from an AI-designed outline                                 |
| `generateSVG(prompt, type, dims)`              | Generates a single SVG asset via Gemini                                   |
| `saveAsset(svg, name, type, tags, meta)`       | Saves SVG file + registers in `library.json`                              |
| `reviewRenderedMap({ imageBase64, metadata })` | Visual QA: sends rendered map image + metadata, returns suggested changes |

**Asset types** understood by the service: `OBJECT` (decor), `TEXTURE` (floor fill), `WALL` (wall band fill).

**SVG quality loop**: `generateSVG` uses an iterative critique-refine loop (generate → critique → refine) to push assets toward a higher detail target before returning the final SVG.

**`_sanitizeSVG(svg)`**: All AI-generated SVGs are sanitized before saving:
- Removes `<style>` blocks (inline styles only — browser VTT compatibility)
- Ensures `viewBox` attribute is present with correct dimensions
- Strips potentially dangerous attributes
- Performs aggressive minification (strips all newlines, carriage returns, and spaces between tags) to drastically reduce file size.

### AssetLibraryService (`services/asset-library-service.js`)

Reads/writes `library.json` — the persistent index of all generated assets.

```json
// library.json structure
{
  "assets": [
    {
      "id": "cracked_stone_floor",
      "name": "Cracked Stone Floor",
      "type": "TEXTURE",
      "path": "vibe-scenes/textures/cracked_stone_floor_123456.svg",
      "tags": ["stone", "floor", "ai-gen"],
      "width": 1,
      "height": 1,
      "placement": "blocking",
      "meta": { "prompt": "...", "model": "...", "createdAt": "..." }
    }
  ]
}
```

Key methods:

| Method            | Description                                                           |
| ----------------- | --------------------------------------------------------------------- |
| `load()`          | Reads `library.json` — caches in memory                               |
| `reload()`        | Force re-reads from disk (used after wishlist generation)             |
| `getAssets(type)` | Returns assets filtered by `type` (`"OBJECT"`, `"TEXTURE"`, `"WALL"`) |
| `addAsset(asset)` | Appends to `assets[]`, writes `library.json`                          |
| `removeAsset(id)` | Removes by id, writes `library.json`, deletes SVG file                |

### Settings (`scripts/settings.js`)

| Key                   | Type   | Notes                                                 |
| --------------------- | ------ | ----------------------------------------------------- |
| `geminiApiKey`        | String | GM-only; used by AiAssetService and DungeongenService |
| `defaultGridSize`     | Number | Default scene grid size                               |
| `mapRenderResolution` | Number | Pixels per cell for renderer                          |
| `imagePath`           | String | Foundry data path for saving dungeon PNGs             |
| `geminiTextModel`     | String | Gemini model for planning/JSON tasks                  |
| `geminiSvgModel`      | String | Gemini model for SVG generation                       |

### Dynamic Texture Pipeline (Floors & Walls)

The texture rendering system uses a multi-stage pipeline for both floor and wall surfaces:

1.  **AI Planning**: `AiAssetService.planDungeon()` receives a list of available assets (with names, types including OBJECT/TEXTURE/WALL, and tags) and the dungeon description. It returns `default_floor`, `default_wall`, and per-room `floor_texture`/`wall_texture` values.
2.  **Wishlist Generation**: If the AI requests textures not in the library (TEXTURE or WALL type), they are generated on-the-fly via `AiAssetService.generateSVG()` and registered with `AssetLibraryService`.
3.  **Library Reload**: After wishlist generation, `AssetLibraryService.reload()` forces a fresh read from `library.json` to pick up newly created assets.
4.  **Fuzzy Texture Resolution**: `DungeongenService._findTexture()` matches AI-returned texture names to library assets using a three-strategy approach: exact name match, substring match, then keyword overlap scoring. This is used for both floor and wall textures.
5.  **Wall Perimeter Carving**: After room/corridor generation, `DungeonGrid.carveWallPerimeter()` marks `EMPTY` cells adjacent to `FLOOR` cells as `CellType.WALL`, creating a 1-cell-thick textured wall band around every room and corridor.
6.  **Canvas Rendering**: `DungeonRenderer` loads resolved texture paths as `Image` elements and uses `ctx.createPattern()` to fill polygons:
    - `FLOOR` cells are filled with the default floor pattern, then per-room floor textures are clipped and overlaid.
    - `WALL` cells are filled with the default wall pattern, then per-room wall textures are clipped to expanded room bounds and overlaid.
    - A thin edge outline is drawn on the `WALL`/`EMPTY` boundary for visual crispness.
7.  **Foundry Walls**: `WallBuilder` places vision-blocking wall segments **1/3 cell outward** from the `FLOOR`/`WALL` boundary into the wall band. This lets players see the wall textures from inside rooms. Doors are widened to span the larger opening.

**Debugging**: If floors or walls appear blank (white/gray or solid dark), check the browser console for `Vibe Scenes |` prefixed warnings about texture resolution or loading failures.

### CSS Architecture
- **`styles/main.css`**: Scene dialog, progress bar, advanced options, studio dialog forms. Uses CSS variables from `vibe-common/styles/vibe-theme.css`.
- **`styles/asset-library.css`**: Asset Library table, preview panel, filter bar, tags, icon buttons. All colours reference `--vibe-*` tokens.
- **Base tokens**: Provided by `vibe-common/styles/vibe-theme.css`. Do not hardcode hex colours; use `var(--vibe-*)` variables.

## Requirements

- Foundry VTT v13 (build 351+)

## Foundry v13 API Compatibility

This module targets the Foundry v13 namespaced API. The following migrations have been applied:

| Deprecated Global  | v13 Namespaced Replacement                            | Removed In |
| ------------------ | ----------------------------------------------------- | ---------- |
| `renderTemplate()` | `foundry.applications.handlebars.renderTemplate()`    | v15        |
| `FilePicker`       | `foundry.applications.apps.FilePicker.implementation` | v15        |
| `mergeObject()`    | `foundry.utils.mergeObject()`                         | v15        |
| `Dialog.confirm()` | `foundry.applications.api.DialogV2.confirm()`         | v16        |



## Credits

- [dungeongen](https://github.com/benjcooley/dungeongen) by benjcooley - Original procedural dungeon generation algorithm

## Development

### Standalone Tester

You can run the dungeon generator without opening Foundry VTT using the included standalone test script. This is useful for rapid testing of the generation algorithm.

1. Navigate to the `tests` directory:
   ```bash
   cd tests
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the generator:
   ```bash
   node test_generator.js
   ```

The script will generate a medium-sized dungeon and save the image to `vibe-scenes/Generated Dungeons/`.

### AI Asset Generator (Vibe Studio)

The module includes a standalone AI service for generating SVG assets (tiles, furniture, etc.) using Google Gemini. The architecture is split into three parts for modularity:

1.  **`GeminiService`**: A generic API client for Google Gemini (handles auth, retries, etc.).
2.  **`AiAssetService`**: A specialized service for generating game assets (handles prompts, SVG cleaning).
3.  **`prompts.js`**: A centralized file for system prompts and instructions.

#### Setup for Development/Testing

1.  Get a free API Key from [Google AI Studio](https://aistudio.google.com/).
2.  Create a local config file (ignored by git): `tests/config.json`
    ```json
    {
      "apiKey": "YOUR_API_KEY_HERE"
    }
    ```
3.  Run the test generator:
    ```bash
    node tests/test_ai_generator.js "A cracked stone floor tile with moss"
    ```
    The resulting SVG will be saved to `vibe-scenes/svgs/`.

## AI Asset Standards

To ensure generated assets work well in a VTT environment, we enforce specific "Archetypes" via system prompts. All SVG styling must be **inline** (no `<style>` blocks) since the `_sanitizeSVG` pipeline strips `<style>` tags for browser compatibility.
The generator now uses an iterative quality loop (generate → critique → refine) to push assets toward a higher detail target before returning the final SVG.

### 1. Textures (The Base Layer)
*   **Role**: The "carpet" or "ground" that fills the entire room or corridor.
*   **Enforcement**: Generated as **Full Bleed** (fills the whole 512x512 square) and **Seamless** (can be repeated infinitely).
*   **Rendering**: The Map Renderer uses these as a `CanvasPattern`. It repeats the texture horizontally and vertically to fill the polygon, ensuring no empty space exists on the floor.
*   **Examples**: Stone paving, grass, dirt, water, wood planks.

### 2. Walls (The Border Layer)
*   **Role**: The textured border that wraps around rooms and corridors, communicating architectural style.
*   **Enforcement**: Generated as **Full Bleed** (fills the whole 512x512 square) and **Seamless** (tiled around room perimeters).
*   **Rendering**: The Map Renderer fills `CellType.WALL` grid cells with a `CanvasPattern`. Per-room wall textures override the default via clipping to expanded room bounds.
*   **Examples**: Rough hewn stone blocks, mortared brick, dark wood paneling, ancient sandstone with glyphs.

### 3. Objects (The Decor Layer)
*   **Role**: Items placed *on top* of the base layer.
*   **Enforcement**: Generated with a **Transparent Background** and **Padding**. The prompt explicitly requests a "Top-down 2D" perspective to match the map.
*   **Rendering**: Drawn as individual images at specific X,Y coordinates on top of the floor pattern.
*   **Examples**: Beds, chests, tables, rocks, trees.

### 4. Structures
*   **Role**: Large features that might act as both walls and floor (e.g., a tent or hut).
*   **Enforcement**: Similar to objects but larger scale.

### Common Gotchas
- **Library reload after wishlist**: Always call `AssetLibraryService.reload()` after generating wishlist assets. There is a deliberate 1-second delay before reload to allow the filesystem to flush new SVG files before the index re-reads them. Without this, newly generated assets are invisible to texture resolution and room population.
- **Two `GeminiService` files**: `vibe-scenes/scripts/services/gemini-service.js` is NOT the same as `vibe-common/scripts/services/gemini-service.js`. The scenes version supports multimodal requests (sending image data for the visual review pass). Do not conflate them.
- **Intentional mode fallback**: If Gemini API key is not configured but intentional mode is selected, the service automatically falls back to procedural generation with a console warning.
- **`DungeongenService.WISHLIST_CONCURRENCY`**: A static class property controlling how many SVG generation requests run in parallel. Adjust carefully — too high and you hit Gemini rate limits; too low and generation is slow.
- **Tiles not Tokens**: Room objects are placed as Foundry Tiles, not Actors/Tokens. They are static map decorations. Do not try to add actor data to them.

# Vibe Scenes

A Foundry VTT v13 module for generating procedural dungeon maps and importing them as new scenes.

## Features

- **"Vibe Scene" Button**: Adds a button to the Scenes directory sidebar for quick dungeon generation
- **Built-in Dungeon Generator**: Procedural dungeon generation runs entirely within Foundry (no external dependencies!)
- **Dungeon Configuration**: Configure dungeon size, symmetry, water features, and random seed
- **Scene Import**: Automatically creates a new Foundry scene with the generated dungeon map
- **AI Asset Library**: Manage your generated assets with a visual library, featuring filtering, sorting, and easy regeneration.
- **Auto-Walls & Doors**: Automatically constructs vision-blocking walls and interactive doors
- **AI Asset Generator**: Built-in integration with Google Gemini to generate custom SVG map assets
- **Smart Room Population**: Uses AI to intelligently furnish the dungeon's "Boss Room" based on your specific asset library
- **Roleplay Ready**: Automatically generates descriptive flavor text for each room and creates Journal Entries linked to the map.
- **Floor Style Selection**: Choose from available floor textures in your library (e.g., Stone, Wood)
- **Grid Settings**: Configurable grid size for the generated scenes

## Installation

1. Download the module files to your Foundry VTT modules folder:
   ```
   [FoundryVTT Data]/Data/modules/vibe-scenes/
   ```
2. Enable "Vibe Scenes" in Foundry VTT's Module Management

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

## Technical Details

This module includes a complete JavaScript port of the [dungeongen](https://github.com/benjcooley/dungeongen) library, enhanced with Foundry-specific optimizations:

- **Layout Generation**: Phase-based procedural generation framework (inspired by Donjon).
- **Advanced Room Placement**: Supports iterative **Relaxation** (physics-based separation) to resolve overlaps and **Symmetric** placement strategies.
- **Passage Routing**: Uses **Minimum Spanning Trees (MST)** for room connectivity and **A* Pathfinding** for carving. "Errant" styles employ weighted noise to create organic, winding paths.
- **Performance Optimization**: The `WallBuilder` performs **Collinear Merging**, collapsing hundreds of tile-sized sections into single long vector lines to maintain high performance in Foundry VTT.
- **Canvas Rendering**: Pure JavaScript rendering using the HTML5 Canvas API, employing a multi-layered approach (Floor → Edges/Walls → Doors).
- **Foundry Vision**: Context-aware door placement and automated wall generation ensure the dungeon is ready for immediate play.
- **Smart Room Population**: The generator identifies key rooms (e.g., Boss Room) and uses the Gemini API to suggest a thematic layout. It is **context-aware**, prioritizing assets available in your library to ensure a coherent look.

### Dynamic Floor Texture Pipeline

The floor rendering system uses a multi-stage pipeline:

1.  **AI Planning**: `AiAssetService.planDungeon()` receives a list of available assets (with names, types, and tags) and the dungeon description. It returns a `default_floor` and per-room `floor_texture` values.
2.  **Wishlist Generation**: If the AI requests textures not in the library, they are generated on-the-fly via `AiAssetService.generateSVG()` and registered with `AssetLibraryService`.
3.  **Library Reload**: After wishlist generation, `AssetLibraryService.reload()` forces a fresh read from `library.json` to pick up newly created assets.
4.  **Fuzzy Texture Resolution**: `DungeongenService._findTexture()` matches AI-returned texture names to library assets using a three-strategy approach: exact name match, substring match, then keyword overlap scoring.
5.  **Canvas Rendering**: `DungeonRenderer` loads resolved texture paths as `Image` elements and uses `ctx.createPattern()` to fill room polygons. Per-room textures are clipped to room boundaries and drawn on top of the default floor pattern.

**Debugging**: If floors appear blank (white/gray), check the browser console for `Vibe Scenes |` prefixed warnings about texture resolution or loading failures.

## Requirements

- Foundry VTT v13 (build 351+)

## Foundry v13 API Compatibility

This module targets the Foundry v13 namespaced API. The following migrations have been applied:

| Deprecated Global | v13 Namespaced Replacement | Removed In |
|---|---|---|
| `renderTemplate()` | `foundry.applications.handlebars.renderTemplate()` | v15 |
| `FilePicker` | `foundry.applications.apps.FilePicker.implementation` | v15 |
| `mergeObject()` | `foundry.utils.mergeObject()` | v15 |
| `Dialog.confirm()` | `foundry.applications.api.DialogV2.confirm()` | v16 |

### Remaining V1 Framework Usage (Migration Planned for v16)

The following components still use the V1 Application/Dialog framework, which is deprecated since v13 and scheduled for removal in v16. These are annotated with `TODO` comments in the source:

- **`VibeSceneDialog`** (`vibe-scene-dialog.js`): Uses V1 `new Dialog()` for the main generation form. Requires migration to `DialogV2.wait()` or a custom `ApplicationV2` subclass to preserve the in-dialog progress bar during generation.
- **`VibeStudio`** (`vibe-studio-dialog.js`): Uses V1 `new Dialog()` for the asset generator form.
- **`AssetLibrary`** (`asset-library.js`): Extends V1 `Application`. Requires full migration to `ApplicationV2` (different template data flow, event handling, and lifecycle).
- **Filter/Column dialogs** (`asset-library.js`): Simple V1 `new Dialog()` forms for filtering and column selection.

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

#### In-game Usage

Once configured in Foundry (Module Settings -> Vibe Scenes -> Gemini API Key), the `AiAssetService` can be used to generate assets dynamically. Currently exposed via the API, with a UI coming soon.

## AI Asset Standards

To ensure generated assets work well in a VTT environment, we enforce specific "Archetypes" via system prompts. All SVG styling must be **inline** (no `<style>` blocks) since the `_sanitizeSVG` pipeline strips `<style>` tags for browser compatibility.
The generator now uses an iterative quality loop (generate -> critique -> refine) to push assets toward a higher detail target before returning the final SVG.

### 1. Textures (The Base Layer)
*   **Role**: The "carpet" or "ground" that fills the entire room or corridor.
*   **Enforcement**: Generated as **Full Bleed** (fills the whole 512x512 square) and **Seamless** (can be repeated infinitely).
*   **Rendering**: The Map Renderer uses these as a `CanvasPattern`. It repeats the texture horizontally and vertically to fill the polygon, ensuring no empty space exists on the floor.
*   **Examples**: Stone paving, grass, dirt, water, wood planks.

### 2. Objects (The Decor Layer)
*   **Role**: Items placed *on top* of the base layer.
*   **Enforcement**: Generated with a **Transparent Background** and **Padding**. The prompt explicitly requests a "Top-down 2D" perspective to match the map.
*   **Rendering**: Drawn as individual images at specific X,Y coordinates on top of the floor pattern.
*   **Examples**: Beds, chests, tables, rocks, trees.

### 3. Structures
*   **Role**: Large features that might act as both walls and floor (e.g., a tent or hut).
*   **Enforcement**: Similar to objects but larger scale.


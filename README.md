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
- **Streaming Auto-writer**: Expand brief concepts into rich, atmospheric dungeon flavor text instantly in the generation dialog.
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

For information on module extenisbility, APIs, AI pipeline, asset library, CSS tokens, and rendering layers, please see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Requirements

- Foundry VTT v13 (build 351+)

## Credits

- [dungeongen](https://github.com/benjcooley/dungeongen) by benjcooley - Original procedural dungeon generation algorithm

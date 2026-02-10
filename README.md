# Vibe Scenes

A Foundry VTT v13 module for generating procedural dungeon maps and importing them as new scenes.

## Features

- **"Vibe Scene" Button**: Adds a button to the Scenes directory sidebar for quick dungeon generation
- **Built-in Dungeon Generator**: Procedural dungeon generation runs entirely within Foundry (no external dependencies!)
- **Dungeon Configuration**: Configure dungeon size, symmetry, water features, and random seed
- **Scene Import**: Automatically creates a new Foundry scene with the generated dungeon map
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
   - **Corridor Style**: L-Path (Standard), Straight (Jagged), or Wandering
   - **Connectivity**: Standard, Minimal (Tree), Full (Cyclic), or Chain
   - **Seed**: Optional number for reproducible dungeons
   - **Grid Size**: Pixels per grid square
4. Click **Generate** to create the dungeon

## Configuration

Configure module settings in **Settings → Module Settings → Vibe Scenes**:

- **Default Grid Size**: Default grid size in pixels (default: 100)
- **Map Render Resolution**: Pixels per cell when rendering (default: 20)
- **Image Storage Path**: Folder for saving dungeon images (default: `vibe-scenes/dungeons`)

### Advanced Configuration (Generator Options)

The underlying generator options are now fully exposed in the dialog:

- **Dead End Removal**: Controls pruning of dead-end corridors (`none`, `some`, `all`).
- **Peripheral Egress**: If true, digs exits from the dungeon edge to the map boundary.
- **Stairs**: Configure number of Up/Down stairs (`{ up: 1, down: 2 }`).
- **Door Density**: Probability (0.0 - 1.0) of placing a door at a valid location.

## Technical Details

This module includes a complete JavaScript port of the [dungeongen](https://github.com/benjcooley/dungeongen) library:

- **Layout Generation**: New phase-based procedural generation framework inspired by Donjon
- **Spatial Constraints**: Support for various map shapes (Rectangle, Round, Cross, Cavernous)
- **Advanced Room Placement**: Intelligent room sizing and placement algorithms
- **Passage Routing**: sophisticated corridor generation with multiple connectivity strategies
- **Door & Exit Placement**: Context-aware door and entrance generation
- **Canvas Rendering**: Pure JavaScript rendering (no external dependencies)

## Requirements

- Foundry VTT v13 (build 351+)

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


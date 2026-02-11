/**
 * Vibe Scenes Module Settings
 * Registers configurable settings for the module
 */

export function registerModuleSettings() {
  game.settings.register("vibe-scenes", "defaultGridSize", {
    name: "Default Grid Size",
    hint: "Default grid size in pixels for generated scenes (affects Foundry grid overlay)",
    scope: "world",
    config: true,
    type: Number,
    default: 20
  });

  game.settings.register("vibe-scenes", "imageStorage", {
    name: "Image Storage Path",
    hint: "Folder path within Foundry's user data where dungeon images will be saved",
    scope: "world",
    config: true,
    type: String,
    default: "vibe-scenes/dungeons"
  });

  game.settings.register("vibe-scenes", "renderCellSize", {
    name: "Map Render Resolution",
    hint: "Pixels per grid cell when rendering dungeon maps. Higher = more detailed but larger files.",
    scope: "world",
    config: true,
    type: Number,
    default: 20,
    range: {
      min: 10,
      max: 50,
      step: 5
    }
  });
}

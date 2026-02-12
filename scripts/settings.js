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
    default: 100
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
    default: 100,
    range: {
      min: 10,
      max: 300,
      step: 10
    }
  });
  game.settings.register("vibe-scenes", "geminiApiKey", {
    name: "Gemini API Key",
    hint: "API Key for Google Gemini (Get one from Google AI Studio)",
    scope: "world",
    config: true,
    type: String,
    default: ""
  });

  game.settings.register("vibe-scenes", "geminiModel", {
    name: "Gemini Model",
    hint: "The specific model version to use for generation",
    scope: "world",
    config: true,
    type: String,
    default: "gemini-2.5-flash"
  });
}

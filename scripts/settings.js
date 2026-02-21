/**
 * Vibe Scenes Module Settings
 * Registers configurable settings for the module
 */

export const DEFAULT_GEMINI_TEXT_MODEL = "gemini-3-flash-preview";
export const DEFAULT_GEMINI_SVG_MODEL = "gemini-3-pro-preview";
const PREVIOUS_GEMINI_SVG_DEFAULT = "gemini-3-flash-preview";
const KNOWN_GOOD_GEMINI_MODELS = {
  "gemini-3.1-pro-preview": "gemini-3.1-pro-preview",
  "gemini-3.1-flash-preview": "gemini-3.1-flash-preview",
  "gemini-3-pro-preview": "gemini-3-pro-preview",
  "gemini-3-flash-preview": "gemini-3-flash-preview",
  "gemini-2.5-pro": "gemini-2.5-pro",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.0-flash": "gemini-2.0-flash",
  "gemini-2.0-flash-lite": "gemini-2.0-flash-lite"
};

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
  game.settings.register("vibe-scenes", "geminiModel", {
    name: "Gemini Model (Legacy Fallback)",
    hint: "Legacy single-model setting retained for backward compatibility.",
    scope: "world",
    config: false,
    type: String,
    default: DEFAULT_GEMINI_TEXT_MODEL
  });

  game.settings.register("vibe-scenes", "geminiTextModel", {
    name: "Gemini Text Model",
    hint: "Model used for planning and JSON tasks (room plans, room contents, critiques). Uses known-good model options.",
    scope: "world",
    config: true,
    type: String,
    choices: KNOWN_GOOD_GEMINI_MODELS,
    default: DEFAULT_GEMINI_TEXT_MODEL
  });

  game.settings.register("vibe-scenes", "geminiSvgModel", {
    name: "Gemini SVG Model",
    hint: "Model used for SVG asset generation. Recommended: gemini-3-pro-preview for higher detail. Uses known-good model options.",
    scope: "world",
    config: true,
    type: String,
    choices: KNOWN_GOOD_GEMINI_MODELS,
    default: DEFAULT_GEMINI_SVG_MODEL
  });
}

/**
 * Upgrade worlds that are still on the original SVG default.
 * Only the GM can write world settings.
 */
export async function migrateGeminiSvgModelDefault() {
  if (!game.user?.isGM) return;
  try {
    const current = String(game.settings.get("vibe-scenes", "geminiSvgModel") || "").trim();
    if (!current || current === PREVIOUS_GEMINI_SVG_DEFAULT) {
      await game.settings.set("vibe-scenes", "geminiSvgModel", DEFAULT_GEMINI_SVG_MODEL);
      console.log("Vibe Scenes | Upgraded geminiSvgModel default to", DEFAULT_GEMINI_SVG_MODEL);
    }
  } catch (error) {
    console.warn("Vibe Scenes | Failed to migrate geminiSvgModel default:", error);
  }
}

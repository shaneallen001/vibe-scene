/**
 * Vibe Scenes Module
 * Main entry point - registers hooks and initializes the module
 */

import { migrateGeminiSvgModelDefault, registerModuleSettings } from "./settings.js";
import { addVibeSceneButton } from "./ui/button-injector.js";
import { VibeSceneDialog } from "./ui/vibe-scene-dialog.js";

Hooks.once("init", () => {
    console.log("Vibe Scenes | Registering module settings");
    registerModuleSettings();

    const module = game.modules.get("vibe-scenes");
    if (module) {
        module.api = {
            VibeSceneDialog
        };
    }
});

Hooks.once("ready", async () => {
    console.log("Vibe Scenes | Module initialized");
    await migrateGeminiSvgModelDefault();
});

// The original "Vibe Scene" sidebar button has been removed in favor of the unified Vibe Menu in vibe-common.

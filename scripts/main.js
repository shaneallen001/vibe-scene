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
});

Hooks.once("ready", async () => {
    console.log("Vibe Scenes | Module initialized");
    await migrateGeminiSvgModelDefault();
});

/**
 * Add Vibe Scene button to Scene Directory
 * For Foundry VTT v13
 */
Hooks.on("renderSceneDirectory", (app, html, data) => {
    // Wait for next frame to ensure DOM is ready
    requestAnimationFrame(() => {
        addVibeSceneButton(app, html, () => VibeSceneDialog.show());
    });
});

// Also hook into sidebar tab rendering for v13
Hooks.on("renderSidebarTab", (app, html, data) => {
    if (app.tabName === "scenes") {
        requestAnimationFrame(() => {
            addVibeSceneButton(app, html, () => VibeSceneDialog.show());
        });
    }
});

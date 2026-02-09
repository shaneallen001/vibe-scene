/**
 * Vibe Scene Dialog
 * Dialog for configuring and generating dungeons
 */

import { DungeongenService } from "../services/dungeongen-service.js";
import { SceneImporter } from "../services/scene-importer.js";

// Configuration options for dungeon generation
const SIZE_OPTIONS = [
    { value: "TINY", label: "Tiny (4-6 rooms)" },
    { value: "SMALL", label: "Small (6-10 rooms)" },
    { value: "MEDIUM", label: "Medium (10-20 rooms)" },
    { value: "LARGE", label: "Large (20-35 rooms)" },
    { value: "XLARGE", label: "Extra Large (35-50 rooms)" }
];

const SYMMETRY_OPTIONS = [
    { value: "NONE", label: "None (Asymmetric)" },
    { value: "BILATERAL", label: "Bilateral (Mirror)" }
];

const WATER_OPTIONS = [
    { value: "DRY", label: "Dry (No water)" },
    { value: "PUDDLES", label: "Puddles (~45% coverage)" },
    { value: "POOLS", label: "Pools (~65% coverage)" },
    { value: "LAKES", label: "Lakes (~82% coverage)" },
    { value: "FLOODED", label: "Flooded (~90% coverage)" }
];

export class VibeSceneDialog {
    static async show() {
        // Get default grid size from settings
        const defaultGridSize = game.settings.get("vibe-scenes", "defaultGridSize") || 100;

        // Generate context for template
        const context = {
            sizeOptions: SIZE_OPTIONS,
            symmetryOptions: SYMMETRY_OPTIONS,
            waterOptions: WATER_OPTIONS,
            defaultGridSize
        };

        const content = await renderTemplate("modules/vibe-scenes/templates/vibe-scene-dialog.html", context);

        new Dialog({
            title: "Vibe Scene - Generate Dungeon",
            content: content,
            buttons: {
                generate: {
                    icon: '<i class="fas fa-dungeon"></i>',
                    label: "Generate",
                    callback: async (html) => {
                        const sceneName = html.find('[name="sceneName"]').val() || "Generated Dungeon";
                        const size = html.find('[name="size"]').val();
                        const symmetry = html.find('[name="symmetry"]').val();
                        const waterDepth = html.find('[name="waterDepth"]').val();
                        const seedInput = html.find('[name="seed"]').val();
                        const gridSize = parseInt(html.find('[name="gridSize"]').val()) || 100;

                        // Parse seed - use random if empty
                        const seed = seedInput ? parseInt(seedInput) : Math.floor(Math.random() * 999999);

                        await this.generateDungeon({
                            sceneName,
                            size,
                            symmetry,
                            waterDepth,
                            seed,
                            gridSize
                        });
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "generate",
            render: (html) => {
                // Add some visual polish
                html.find('.vibe-scene-form').css({
                    'display': 'flex',
                    'flex-direction': 'column',
                    'gap': '12px'
                });
            }
        }, {
            width: 420,
            classes: ["vibe-scene-dialog"]
        }).render(true);
    }

    static async generateDungeon(options) {
        const { sceneName, size, symmetry, waterDepth, seed, gridSize } = options;
        console.log("Vibe Scenes | generateDungeon called with:", { sceneName, size, symmetry, waterDepth, seed, gridSize });

        // Show loading notification
        const notification = ui.notifications.info("Generating dungeon...", { permanent: true });

        try {
            // Get render resolution from settings
            const renderCellSize = game.settings.get("vibe-scenes", "renderCellSize") || 20;
            console.log("Vibe Scenes | Render cell size:", renderCellSize);

            // Create the dungeon service (local generation, no URL needed)
            const dungeonService = new DungeongenService();
            console.log("Vibe Scenes | DungeongenService created, starting generation...");

            // Generate the dungeon image
            const imageData = await dungeonService.generate({
                size,
                symmetry,
                waterDepth,
                seed,
                gridSize: renderCellSize
            });
            console.log("Vibe Scenes | Image data received, size:", imageData?.size || 0, "bytes");

            notification.remove();
            ui.notifications.info("Dungeon generated! Creating scene...");

            // Import as a new scene
            const sceneImporter = new SceneImporter();
            const scene = await sceneImporter.createScene({
                name: sceneName,
                imageData,
                gridSize,
                seed
            });

            ui.notifications.info(`Successfully created scene: ${scene.name}`);

            // Optionally activate the scene
            const activateScene = await Dialog.confirm({
                title: "Activate Scene?",
                content: "<p>Would you like to activate the new dungeon scene?</p>"
            });

            if (activateScene) {
                await scene.activate();
            }

        } catch (error) {
            notification.remove();
            console.error("Vibe Scenes | Error generating dungeon:", error);
            ui.notifications.error(`Failed to generate dungeon: ${error.message}`);
        }
    }
}


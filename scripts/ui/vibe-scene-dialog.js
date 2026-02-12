/**
 * Vibe Scene Dialog
 * Dialog for configuring and generating dungeons
 */

import { DungeongenService } from "../services/dungeongen-service.js";
import { SceneImporter } from "../services/scene-importer.js";

// Configuration options for dungeon generation
const SIZE_OPTIONS = [
    { value: "tiny", label: "Tiny (4-6 rooms)" },
    { value: "small", label: "Small (6-10 rooms)" },
    { value: "medium", label: "Medium (10-20 rooms)" },
    { value: "large", label: "Large (20-35 rooms)" },
    { value: "xlarge", label: "Extra Large (35-50 rooms)" }
];

const SHAPE_OPTIONS = [
    { value: "rectangle", label: "Rectangle" },
    { value: "round", label: "Round" },
    { value: "cross", label: "Cross" },
    { value: "keep", label: "Keep" },
    { value: "cavernous", label: "Cavernous" }
];

const SYMMETRY_OPTIONS = [
    { value: "none", label: "None (Asymmetric)" },
    { value: "bilateral", label: "Bilateral (Mirror)" }
];

const CORRIDOR_OPTIONS = [
    { value: "l_path", label: "L-Path (Standard)" },
    { value: "straight", label: "Straight (Jagged)" },
    { value: "errant", label: "Wandering" }
];

const CONNECTIVITY_OPTIONS = [
    { value: "mst_loops", label: "Standard (Cyclic)" },
    { value: "mst", label: "Minimal (Tree)" },
    { value: "full", label: "Full (Chaos)" },
    { value: "nearest", label: "Chain" }
];

const DEAD_END_OPTIONS = [
    { value: "none", label: "None (Remove all)" },
    { value: "some", label: "Some (Keep ~50%)" },
    { value: "all", label: "All (Keep all)" }
];

export class VibeSceneDialog {
    static async show() {
        // Get default grid size from settings
        const defaultGridSize = game.settings.get("vibe-scenes", "defaultGridSize") || 20;

        // Fetch available floor textures (SVGs)
        let floorTextures = [];
        try {
            // List files in the module's svgs directory
            const result = await FilePicker.browse("data", "modules/vibe-scenes/svgs", { extensions: [".svg"] });
            floorTextures = result.files.map(file => {
                const filename = file.split("/").pop();
                return {
                    value: file,
                    label: filename
                };
            });
        } catch (error) {
            console.error("Vibe Scenes | Failed to load floor textures:", error);
        }

        // Generate context for template
        const context = {
            sizeOptions: SIZE_OPTIONS,
            shapeOptions: SHAPE_OPTIONS,
            symmetryOptions: SYMMETRY_OPTIONS,
            corridorOptions: CORRIDOR_OPTIONS,
            connectivityOptions: CONNECTIVITY_OPTIONS,
            deadEndOptions: DEAD_END_OPTIONS,
            floorTextures,
            defaultGridSize,
            // Defaults for new options
            density: 0.4,
            peripheralEgress: false,
            doorDensity: 0.5,
            doorDensity: 0.5,
            stairs: { up: 1, down: 2 }
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
                        const maskType = html.find('[name="maskType"]').val(); // Renamed from shape in UI for clarity
                        const symmetry = html.find('[name="symmetry"]').val();
                        const floorTexture = html.find('[name="floorTexture"]').val();

                        // New Options
                        const density = parseFloat(html.find('[name="density"]').val());
                        const corridorStyle = html.find('[name="corridorStyle"]').val();
                        const connectivity = html.find('[name="connectivity"]').val();

                        // Advanced
                        const deadEndRemoval = html.find('[name="deadEndRemoval"]').val();
                        const peripheralEgress = html.find('[name="peripheralEgress"]').is(':checked');
                        const doorDensity = parseFloat(html.find('[name="doorDensity"]').val());
                        const stairsUp = parseInt(html.find('[name="stairsUp"]').val()) || 0;
                        const stairsDown = parseInt(html.find('[name="stairsDown"]').val()) || 0;

                        const seedInput = html.find('[name="seed"]').val();
                        const gridSize = parseInt(html.find('[name="gridSize"]').val()) || 20;

                        // Parse seed - use random if empty
                        const seed = seedInput ? parseInt(seedInput) : Math.floor(Math.random() * 999999);

                        await this.generateDungeon({
                            sceneName,
                            size,
                            maskType,
                            symmetry,
                            floorTexture,
                            corridorStyle,
                            connectivity,
                            density,
                            seed,
                            gridSize,
                            deadEndRemoval,
                            peripheralEgress,
                            doorDensity,
                            doorDensity,
                            stairs: { up: stairsUp, down: stairsDown }
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
        const { sceneName, size, maskType, symmetry, corridorStyle, connectivity, density, seed, gridSize, deadEndRemoval, peripheralEgress, doorDensity, stairs } = options;
        console.log("Vibe Scenes | generateDungeon called with:", { sceneName, size, maskType, seed });

        // Show loading notification
        const notification = ui.notifications.info("Generating dungeon...", { permanent: true });

        try {
            // Create the dungeon service (local generation, no URL needed)
            const dungeonService = new DungeongenService();
            console.log("Vibe Scenes | DungeongenService created, starting generation...");

            // Generate the dungeon image
            // We use the requested gridSize for rendering to ensure 1:1 mapping with the scene grid
            const { blob: imageData, walls } = await dungeonService.generate({
                size,
                maskType,
                symmetry,
                corridorStyle,
                connectivity,
                density,
                seed,
                gridSize, // Use the prompt's grid size
                deadEndRemoval,
                peripheralEgress,
                doorDensity,
                peripheralEgress,
                doorDensity,
                stairs,
                floorTexture: options.floorTexture
            });
            console.log("Vibe Scenes | Image data received, size:", imageData?.size || 0, "bytes");

            notification.remove();
            ui.notifications.info("Dungeon generated! Creating scene...");

            // Import as a new scene
            const sceneImporter = new SceneImporter();
            const scene = await sceneImporter.createScene({
                name: sceneName,
                imageData,
                walls,
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


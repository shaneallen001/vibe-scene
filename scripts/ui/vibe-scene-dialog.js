/**
 * Vibe Scene Dialog
 * Dialog for configuring and generating dungeons
 */

import { DungeongenService } from "../services/dungeongen-service.js";
import { SceneImporter } from "../services/scene-importer.js";
import { AssetLibraryService } from "../services/asset-library-service.js";
import { AssetLibrary } from "./asset-library.js";

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

        // Initialize Library Service
        const library = new AssetLibraryService();
        await library.load();

        // Fetch available styles
        const styles = library.getStyles().map(style => ({
            value: style,
            label: style
        }));

        // Generate context for template
        const context = {
            sizeOptions: SIZE_OPTIONS,
            shapeOptions: SHAPE_OPTIONS,
            symmetryOptions: SYMMETRY_OPTIONS,
            corridorOptions: CORRIDOR_OPTIONS,
            connectivityOptions: CONNECTIVITY_OPTIONS,
            deadEndOptions: DEAD_END_OPTIONS,
            styles,
            defaultGridSize,
            // Defaults for new options
            density: 0.4,
            peripheralEgress: false,
            doorDensity: 0.5
        };

        const content = await foundry.applications.handlebars.renderTemplate("modules/vibe-scenes/templates/vibe-scene-dialog.html", context);

        // TODO: Migrate to foundry.applications.api.DialogV2.wait() (V1 Dialog removed in v16)
        const dialog = new Dialog({
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

                        // Dungeon Description for AI
                        const dungeonDescription = html.find('[name="dungeonDescription"]').val();

                        // New Options
                        const density = parseFloat(html.find('[name="density"]').val());
                        const corridorStyle = html.find('[name="corridorStyle"]').val();
                        const connectivity = html.find('[name="connectivity"]').val();

                        // Advanced
                        const deadEndRemoval = html.find('[name="deadEndRemoval"]').val();
                        const peripheralEgress = html.find('[name="peripheralEgress"]').is(':checked');
                        const doorDensity = parseFloat(html.find('[name="doorDensity"]').val());

                        const seedInput = html.find('[name="seed"]').val();
                        const gridSize = parseInt(html.find('[name="gridSize"]').val()) || 20;

                        // Parse seed - use random if empty
                        const seed = seedInput ? parseInt(seedInput) : Math.floor(Math.random() * 999999);

                        await this.generateDungeon({
                            sceneName,
                            size,
                            maskType,
                            symmetry,
                            dungeonDescription,
                            corridorStyle,
                            connectivity,
                            density,
                            seed,
                            gridSize,
                            deadEndRemoval,
                            peripheralEgress,
                            doorDensity
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

                // Auto-resize on details toggle
                html.find('details.advanced-options').on('toggle', (event) => {
                    dialog.setPosition({ height: "auto" });
                });

                // Style the status bar initially
                html.find('.status-bar').hide();

                // Open Studio (now Asset Library)
                html.find('.open-studio').click(async (ev) => {
                    ev.preventDefault();
                    new AssetLibrary().render(true);
                });
            }
        }, {
            width: 420,
            height: "auto",
            classes: ["vibe-scene-dialog"]
        });

        dialog.render(true);
    }

    static async generateDungeon(options) {
        const { sceneName, size, maskType, symmetry, dungeonDescription, corridorStyle, connectivity, density, seed, gridSize, deadEndRemoval, peripheralEgress, doorDensity } = options;
        const runId = `vs-${seed}-${Date.now().toString(36)}`;
        const pipelineStart = performance.now();
        console.groupCollapsed(`Vibe Scenes | [${runId}] generateDungeon`);
        console.log("Vibe Scenes | Generation request:", {
            runId,
            sceneName,
            size,
            maskType,
            symmetry,
            corridorStyle,
            connectivity,
            density,
            seed,
            gridSize,
            deadEndRemoval,
            peripheralEgress,
            doorDensity,
            hasDescription: Boolean(dungeonDescription?.trim())
        });

        // Show status bar
        const dialogElement = $('.vibe-scene-dialog');
        const statusBar = dialogElement.find('.status-bar');
        const statusMessage = dialogElement.find('.status-message');
        const progressBar = dialogElement.find('.progress-bar');

        statusBar.addClass('active');
        const updateStatus = (msg, percent) => {
            statusMessage.text(msg);
            progressBar.css('width', `${percent}%`);
            // Force a repaint so UI updates immediately
            if (dialogElement[0]) dialogElement[0].offsetHeight;
        };

        updateStatus("Initializing...", 0);

        try {
            // Create the dungeon service (local generation, no URL needed)
            const dungeonService = new DungeongenService();
            console.log(`Vibe Scenes | [${runId}] DungeongenService created`);

            // Generate the dungeon image
            // We use the requested gridSize for rendering to ensure 1:1 mapping with the scene grid
            const generationStart = performance.now();
            const { blob: imageData, walls, items, rooms } = await dungeonService.generate({
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
                dungeonDescription: options.dungeonDescription,
                runId,
                onProgress: (msg, pct) => updateStatus(msg, Math.floor(pct * 0.5)) // 0-50%
            });
            console.log(`Vibe Scenes | [${runId}] Generation finished in ${(performance.now() - generationStart).toFixed(0)}ms`, {
                imageBytes: imageData?.size || 0,
                walls: walls?.length || 0,
                items: items?.length || 0,
                rooms: rooms?.length || 0
            });

            updateStatus("Dungeon generated! Creating scene...", 50);

            // Import as a new scene
            const sceneImporter = new SceneImporter();
            const importStart = performance.now();
            const scene = await sceneImporter.createScene({
                name: sceneName,
                imageData,
                walls,
                items,
                rooms,
                gridSize,
                seed,
                runId,
                onProgress: (msg, pct) => updateStatus(msg, 50 + Math.floor(pct * 0.5)) // 50-100%
            });
            console.log(`Vibe Scenes | [${runId}] Scene import finished in ${(performance.now() - importStart).toFixed(0)}ms`, {
                sceneId: scene?.id,
                sceneName: scene?.name
            });

            updateStatus(`Created scene: ${scene.name}`, 100);
            ui.notifications.info(`Successfully created scene: ${scene.name}`);

            // Optionally activate the scene
            console.log(`Vibe Scenes | [${runId}] Prompting user to activate scene`, { sceneId: scene?.id, sceneName: scene?.name });
            const activateScene = await foundry.applications.api.DialogV2.confirm({
                window: { title: "Activate Scene?" },
                content: "<p>Would you like to activate the new dungeon scene?</p>",
                rejectClose: false
            });
            console.log(`Vibe Scenes | [${runId}] Activate prompt result`, { activateScene });

            if (activateScene) {
                updateStatus("Activating scene...", 100);
                try {
                    await this._activateSceneWithDiagnostics(scene, runId, updateStatus);
                } catch (e) {
                    console.error(`Vibe Scenes | [${runId}] Error activating scene:`, e);
                    ui.notifications.warn("Scene created but failed to activate automatically.");
                }
            } else {
                console.log(`Vibe Scenes | [${runId}] User declined scene activation`);
            }

            // Close dialog on success
            // Object.values(ui.windows).find(w => w.title === "Vibe Scene - Generate Dungeon")?.close();

        } catch (error) {
            console.error(`Vibe Scenes | [${runId}] Error generating dungeon:`, error);
            updateStatus(`Error: ${error.message}`, 100);
            progressBar.css('background', '#ff4444');
            ui.notifications.error(`Failed to generate dungeon: ${error.message}`);
        } finally {
            console.log(`Vibe Scenes | [${runId}] Pipeline total ${(performance.now() - pipelineStart).toFixed(0)}ms`);
            console.groupEnd();
        }
    }

    static async _activateSceneWithDiagnostics(scene, runId, updateStatus) {
        const activateStart = performance.now();
        console.log(`Vibe Scenes | [${runId}] Activation start`, {
            sceneId: scene?.id,
            sceneName: scene?.name
        });
        const hasRequiredResolution = window.innerWidth >= 1024 && window.innerHeight >= 768;
        if (!hasRequiredResolution) {
            console.warn(`Vibe Scenes | [${runId}] Window below Foundry minimum resolution`, {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                minWidth: 1024,
                minHeight: 768
            });
            ui.notifications.warn("Foundry window is below 1024x768. Scene rendering can stall until the window is resized.");
        }

        // Track observed scene events so stalled activations can be diagnosed.
        const eventLog = [];
        const viewHook = Hooks.on("canvasReady", (canvasRef) => {
            const observed = canvasRef?.scene?.id;
            eventLog.push({ event: "canvasReady", observedSceneId: observed, t: Date.now() });
            console.log(`Vibe Scenes | [${runId}] Hook canvasReady observed`, {
                observedSceneId: observed,
                expectedSceneId: scene?.id
            });
        });

        try {
            await Promise.race([
                scene.activate(),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error("Scene activation timed out after 60s")), 60000);
                })
            ]);
            console.log(`Vibe Scenes | [${runId}] scene.activate() resolved`, {
                elapsedMs: Math.round(performance.now() - activateStart)
            });

            // Force a client-side scene view to trigger draw even if activate() resolves immediately.
            const viewStart = performance.now();
            await Promise.race([
                scene.view(),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error("scene.view() timed out after 20s")), 20000);
                })
            ]);
            console.log(`Vibe Scenes | [${runId}] scene.view() resolved`, {
                elapsedMs: Math.round(performance.now() - viewStart)
            });

            updateStatus("Waiting for canvas ready...", 100);
            const canvasReady = await this._waitForSceneCanvas(scene?.id, runId, 15000);
            if (canvasReady) {
                console.log(`Vibe Scenes | [${runId}] Canvas ready confirmed for activated scene`, {
                    elapsedMs: Math.round(performance.now() - activateStart)
                });
            } else {
                console.warn(`Vibe Scenes | [${runId}] Canvas ready confirmation timed out`, {
                    expectedSceneId: scene?.id,
                    activeSceneId: game.scenes?.active?.id,
                    currentCanvasSceneId: canvas?.scene?.id,
                    observedEvents: eventLog
                });
                ui.notifications.warn("Scene activation completed, but canvas readiness is delayed. Check window size and console diagnostics.");
            }
        } finally {
            Hooks.off("canvasReady", viewHook);
        }
    }

    static async _waitForSceneCanvas(sceneId, runId, timeoutMs = 45000) {
        if (!sceneId) return false;
        if (canvas?.scene?.id === sceneId && (canvas?.ready || canvas?.stage)) return true;

        // Polling fallback catches cases where hooks don't fire reliably.
        const start = Date.now();
        while ((Date.now() - start) < timeoutMs) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (canvas?.scene?.id === sceneId && (canvas?.ready || canvas?.stage)) {
                console.log(`Vibe Scenes | [${runId}] _waitForSceneCanvas polling success`, {
                    elapsedMs: Date.now() - start,
                    canvasReady: Boolean(canvas?.ready),
                    hasStage: Boolean(canvas?.stage)
                });
                return true;
            }
        }
        console.warn(`Vibe Scenes | [${runId}] _waitForSceneCanvas timeout`, {
            timeoutMs,
            expectedSceneId: sceneId,
            currentCanvasSceneId: canvas?.scene?.id,
            canvasReady: Boolean(canvas?.ready),
            hasStage: Boolean(canvas?.stage)
        });
        return false;
    }
}


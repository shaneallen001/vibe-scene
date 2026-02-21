import { VibeToast } from "../../../vibe-common/scripts/ui/toast-manager.js";
import { AiAssetService } from "../services/ai-asset-service.js";
import { getGeminiApiKey } from "../../../vibe-common/scripts/settings.js";

const ASSET_TYPES = [
    { value: "OBJECT", label: "Object (Furniture, Items)" },
    { value: "TEXTURE", label: "Floor Texture (Seamless)" },
    { value: "WALL", label: "Wall Texture (Seamless)" },
    { value: "STRUCTURE", label: "Structure (Buildings, Large)" }
];

export class VibeStudio {
    static async show(options = {}) {
        // Check for API Key
        let apiKey;
        try {
            apiKey = getGeminiApiKey();
        } catch (e) {
            return;
        }

        const context = {
            types: ASSET_TYPES.map(t => ({
                ...t,
                selected: t.value === (options.type || "OBJECT")
            })),
            prompt: options.prompt || "",
            style: options.style || ""
        };

        const content = await foundry.applications.handlebars.renderTemplate("modules/vibe-scenes/templates/vibe-studio-dialog.html", context);

        // TODO: Migrate to foundry.applications.api.DialogV2.wait() (V1 Dialog removed in v16)
        const dialog = new Dialog({
            title: "Vibe Studio - Asset Generator",
            content: content,
            buttons: {
                generate: {
                    icon: '<i class="fas fa-magic"></i>',
                    label: "Generate",
                    callback: (html) => {
                        // Prevent dialog close by returning false? 
                        // Dialog structure in Foundry closes on button click usually.
                        // We might need to keep it open or reopen.
                        // For a 'studio' feel, re-rendering or keeping open is better.
                        // But standard Dialog closes. Let's process then maybe show results or reopen.
                        // Actually, better to define the callback to run the generation logic.
                        const prompt = html.find('[name="prompt"]').val();
                        const type = html.find('[name="type"]').val();
                        const count = parseInt(html.find('[name="count"]').val()) || 1;
                        const style = html.find('[name="style"]').val();

                        // Run async generation
                        this.generateAssets(prompt, type, count, style);
                    }
                },
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Close"
                }
            },
            default: "generate",
            render: (html) => {
                html.css({ height: "auto" });
            }
        }, {
            width: 400,
            classes: ["vibe-studio-dialog"]
        });

        dialog.render(true);
    }

    static async generateAssets(prompt, type, count, style) {
        if (!prompt) {
            VibeToast.warn("Please enter a prompt.");
            // Re-open dialog to not lose context? 
            // For now just warn.
            return;
        }

        let apiKey;
        try {
            apiKey = getGeminiApiKey();
        } catch (e) {
            return;
        }
        const legacyModel = game.settings.get("vibe-scenes", "geminiModel");
        const textModel = game.settings.get("vibe-scenes", "geminiTextModel") || legacyModel;
        const svgModel = game.settings.get("vibe-scenes", "geminiSvgModel") || textModel;
        const service = new AiAssetService(apiKey, { text: textModel, svg: svgModel });

        // Show progress integration
        // We can't easily keep the dialog open without custom FormApplication, 
        // using UI notifications for now.
        const notification = VibeToast.info(`Starting generation for ${count} assets...`, { permanent: true });

        try {
            let fullPrompt = prompt;
            if (style) {
                fullPrompt += `\nVisual Style: ${style}`;
            }

            let successes = 0;

            for (let i = 0; i < count; i++) {
                // Add variation to prompt if count > 1 to avoid duplicate caching or identical results
                let currentPrompt = fullPrompt;
                if (count > 1) {
                    currentPrompt += `\nVariation: ${i + 1}`;
                }

                try {
                    const svg = await service.generateSVG(currentPrompt, type);

                    // Generate a filename
                    // Sanitize prompt for filename
                    const safeName = prompt.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);
                    // Add random suffix to ensure uniqueness
                    const timestamp = Date.now().toString().slice(-6);
                    const fileName = `${safeName}_${timestamp}`;

                    await service.saveAsset(svg, fileName, type, ["studio", "ai-gen"], {
                        prompt: currentPrompt,
                        model: service.svgModel
                    });
                    successes++;

                } catch (err) {
                    console.error("Vibe Studio | Generation failed:", err);
                }
            }

            notification.remove();

            if (successes > 0) {
                VibeToast.info(`Successfully generated ${successes} assets! Check your library.`);
            } else {
                VibeToast.warn("Failed to generate assets. Check console for details.");
            }

        } catch (e) {
            notification.remove();
            VibeToast.error(e.message);
        }
    }
}

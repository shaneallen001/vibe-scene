/**
 * Asset Library Service
 * 
 * Manages the index of all assets (AI-generated and imported) available to Vibe Scenes.
 * Persists data to assets/library.json.
 */

export class AssetLibraryService {
    constructor() {
        this.index = {};
        this.indexPath = "modules/vibe-scenes/assets/library.json";
        this.isLoaded = false;
    }

    /**
     * Load the library index from disk
     */
    async load() {
        if (this.isLoaded) return;

        try {
            const response = await fetch(this.indexPath);
            if (response.ok) {
                this.index = await response.json();
            } else {
                console.warn("Vibe Scenes | Library index not found, starting fresh.");
                this.index = {};
            }
        } catch (error) {
            console.error("Vibe Scenes | Failed to load library index:", error);
            this.index = {};
        }
        this.isLoaded = true;
    }

    /**
     * Get all assets of a specific type
     * @param {string} type - TEXTURE, OBJECT, STRUCTURE, WALL
     */
    getAssets(type) {
        return Object.values(this.index)
            .filter(asset => asset.type === type)
            .map(asset => ({
                ...asset,
                path: this._resolvePath(asset.path)
            }));
    }

    /**
     * Helper to resolve relative paths to full module paths
     */
    _resolvePath(path) {
        if (path && path.startsWith("assets/")) {
            return `modules/vibe-scenes/${path}`;
        }
        return path;
    }

    /**
     * Get all available floor styles
     * Derived from textures that have the 'floor' tag
     * Returns a list of style names (e.g., "Stone", "Wood", "Dirt")
     */
    getStyles() {
        const textures = this.getAssets("TEXTURE");
        const styles = new Set();

        textures.forEach(tex => {
            // Check if it's a floor
            if (tex.tags && tex.tags.includes("floor")) {
                const style = this._inferStyleFromTags(tex.tags);
                if (style) styles.add(style);
            }
        });

        return Array.from(styles).sort();
    }

    /**
     * Get the best matching floor texture for a style
     * @param {string} style 
     */
    getFloorForStyle(style) {
        const textures = this.getAssets("TEXTURE");
        // Simple case-insensitive match
        // Prioritize "clean" or "base" tags if possible, otherwise just first match
        return textures.find(tex =>
            tex.tags.includes("floor") &&
            this._inferStyleFromTags(tex.tags).toLowerCase() === style.toLowerCase()
        );
    }

    /**
     * Register a new asset and save to index
     * @param {Object} metadata 
     */
    async registerAsset(metadata) {
        if (!this.isLoaded) await this.load();

        this.index[metadata.id] = {
            ...metadata,
            addedAt: Date.now()
        };

        await this._save();
    }

    /**
     * Save the index to disk
     * Note: In a real module, we might need a backend service to write files.
     * For this dev module, we rely on the FilePicker or assume we can't write 
     * from client-side JS without a helper. 
     * 
     * However, since we are in a local dev environment, we can't easily write to 
     * user data from client JS without a socket or API.
     * 
     * WE WILL USE THE FilePicker API to upload the JSON if possible, 
     * or for now, just log it since the `migrator` script wrote the initial file.
     * 
     * WAIT: The `AiAssetService` was running in Node.js for tests, but in browser for Foundry.
     * Writing files in Foundry requires `FilePicker.upload`.
     */
    async _save() {
        // Construct the JSON file
        const jsonString = JSON.stringify(this.index, null, 2);
        const file = new File([jsonString], "library.json", { type: "application/json" });

        try {
            // Upload to the assets folder
            await FilePicker.upload("data", "modules/vibe-scenes/assets", file, {}, { notify: false });
            console.log("Vibe Scenes | Library index saved.");
        } catch (error) {
            console.error("Vibe Scenes | Failed to save library index:", error);
        }
    }

    /**
     * Helper to infer a display "Style" from tags
     * e.g. ["stone", "floor", "cracked"] -> "Stone"
     */
    _inferStyleFromTags(tags) {
        // defined priority of material tags
        const materials = ["stone", "wood", "dirt", "grass", "water", "lava", "ice", "sand", "metal", "tile", "obsidian"];

        for (const mat of materials) {
            if (tags.includes(mat)) {
                // Capitalize
                return mat.charAt(0).toUpperCase() + mat.slice(1);
            }
        }
        return "Generic";
    }
}

import { AssetLibraryService } from "../services/asset-library-service.js";
import { VibeStudio } from "./vibe-studio-dialog.js";

export class AssetLibrary extends Application {
    constructor(options = {}) {
        super(options);
        this.library = new AssetLibraryService();
        this.filters = {}; // { col: value }
        this.sortBy = "id";
        this.sortDesc = false;
        this.previewAsset = null;
        this.visibleColumns = ["id", "name", "type", "width", "tags"]; // Default full
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "vibe-asset-library",
            title: "Vibe Asset Library",
            template: "modules/vibe-scenes/templates/asset-library.hbs",
            width: 800,
            height: 600,
            resizable: true,
            classes: ["vibe-asset-library"]
        });
    }

    async getData() {
        await this.library.load();
        let assets = Object.values(this.library.index);

        // Apply Filters
        for (const [key, value] of Object.entries(this.filters)) {
            if (!value) continue;
            assets = assets.filter(a => {
                const val = a[key]?.toString().toLowerCase() || "";
                return val.includes(value.toLowerCase());
            });
        }

        // Apply Sort
        assets.sort((a, b) => {
            let valA = a[this.sortBy];
            let valB = b[this.sortBy];

            // Specific handling for ID (number) vs others
            if (this.sortBy === 'id') {
                valA = parseInt(valA) || 0;
                valB = parseInt(valB) || 0;
            } else {
                valA = valA?.toString().toLowerCase() || "";
                valB = valB?.toString().toLowerCase() || "";
            }

            if (valA < valB) return this.sortDesc ? 1 : -1;
            if (valA > valB) return this.sortDesc ? -1 : 1;
            return 0;
        });

        return {
            assets,
            activeFilters: this.filters,
            previewAsset: this.previewAsset,
            sortBy: this.sortBy,
            sortDesc: this.sortDesc
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Preview on Hover
        html.find(".asset-row").on("mouseenter", (ev) => {
            const id = $(ev.currentTarget).data("id");
            this._updatePreview(id);
        });

        // Delete
        html.find(".delete-asset").click(async (ev) => {
            ev.stopPropagation(); // prevent row click if we add one
            const id = $(ev.currentTarget).data("id");
            await this._onDelete(id);
        });

        // Regenerate
        html.find(".regenerate-asset").click(async (ev) => {
            ev.stopPropagation();
            const id = $(ev.currentTarget).data("id");
            await this._onRegenerate(id);
        });

        // Open Studio (Empty)
        html.find(".open-studio-btn").click((ev) => {
            ev.preventDefault();
            this._onOpenStudio();
        });

        // Filter Column
        html.find(".filter-col").click((ev) => {
            ev.stopPropagation();
            const col = $(ev.currentTarget).data("col");
            this._showFilterDialog(col);
        });

        // Sort Column
        html.find("th[data-sort]").click((ev) => {
            const col = $(ev.currentTarget).data("sort");
            if (this.sortBy === col) {
                this.sortDesc = !this.sortDesc;
            } else {
                this.sortBy = col;
                this.sortDesc = false;
            }
            this.render();
        });

        // Remove Filter
        html.find(".remove-filter").click((ev) => {
            const key = $(ev.currentTarget).parent().data("key");
            delete this.filters[key];
            this.render();
        });
    }

    _updatePreview(id) {
        const asset = this.library.getAsset(id);
        if (asset) {
            this.previewAsset = asset;
            // Ideally re-render just the preview panel, but full render is safer/easier for now
            // To avoid flickering entire table, we could manually update DOM
            // But let's try just updating the DOM for the preview
            const previewHtml = `
                <img src="${asset.path}" alt="${asset.name}" class="preview-image" style="height: 80px; width: 80px; object-fit: contain; background: #000; border: 1px solid #333;" />
                <div class="preview-details">
                    <h3>${asset.name}</h3>
                    <p><strong>Prompt:</strong> ${asset.prompt || "N/A"}</p>
                    <p><strong>Model:</strong> ${asset.model || "N/A"}</p>
                </div>
            `;
            this.element.find(".preview-image-container").html(previewHtml);
        }
    }

    async _onDelete(id) {
        const confirmed = await Dialog.confirm({
            title: "Delete Asset",
            content: "<p>Are you sure you want to delete this asset? This cannot be undone.</p>"
        });

        if (confirmed) {
            await this.library.deleteAsset(id);
            this.render();
        }
    }

    async _onRegenerate(id) {
        const asset = this.library.getAsset(id);
        if (!asset) return;

        // Open Studio with pre-filled data
        // We need to update VibeStudio.show to accept options
        // Close library? No, keep it open to see result.
        await VibeStudio.show({
            prompt: asset.prompt === "Legacy" ? "" : asset.prompt,
            model: asset.model,
            type: asset.type,
            style: this.library._inferStyleFromTags(asset.tags)
        });
    }

    _onOpenStudio() {
        VibeStudio.show();
    }

    async _showFilterDialog(col) {
        const content = `
            <div class="form-group">
                <label>Filter by ${col}:</label>
                <input type="text" name="filterValue" value="${this.filters[col] || ""}" autofocus/>
            </div>
        `;

        new Dialog({
            title: `Filter ${col}`,
            content: content,
            buttons: {
                apply: {
                    label: "Apply",
                    callback: (html) => {
                        const val = html.find('[name="filterValue"]').val();
                        if (val) {
                            this.filters[col] = val;
                        } else {
                            delete this.filters[col];
                        }
                        this.render();
                    }
                },
                clear: {
                    label: "Clear",
                    callback: () => {
                        delete this.filters[col];
                        this.render();
                    }
                }
            },
            default: "apply"
        }).render(true);
    }
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
// scripts/tools/migrate_assets.js -> (up 2) -> root -> assets
const ASSETS_DIR = path.resolve(__dirname, '../../assets');
const GENERATED_DIR = path.join(ASSETS_DIR, 'generated');
const OLD_INDEX_PATH = path.join(GENERATED_DIR, 'library_index.json');
const NEW_INDEX_PATH = path.join(ASSETS_DIR, 'library.json');

async function migrate() {
    console.log("Starting Asset Migration...");

    if (!fs.existsSync(GENERATED_DIR)) {
        console.log("No 'generated' directory found. Migration might have already run.");
        return;
    }

    // 1. Load Index
    let library = {};
    if (fs.existsSync(OLD_INDEX_PATH)) {
        console.log("Loading library index...");
        library = JSON.parse(fs.readFileSync(OLD_INDEX_PATH, 'utf8'));
    } else {
        console.warn("No library index found in generated directory.");
    }

    // 2. Move Files & Update Index
    const types = ['texture', 'object', 'structure', 'wall'];

    for (const type of types) {
        const sourceDir = path.join(GENERATED_DIR, type);
        const targetDir = path.join(ASSETS_DIR, type);

        // Ensure target directory exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        if (fs.existsSync(sourceDir)) {
            const files = fs.readdirSync(sourceDir);
            for (const file of files) {
                const srcPath = path.join(sourceDir, file);
                const destPath = path.join(targetDir, file);

                // Move file
                console.log(`Moving ${file} to ${type}/...`);
                // Use renameSync (move)
                // Check if dest exists to avoid error, maybe overwrite?
                if (fs.existsSync(destPath)) {
                    console.warn(`File ${file} already exists in target. Overwriting.`);
                    fs.unlinkSync(destPath);
                }
                fs.renameSync(srcPath, destPath);
            }

            // Remove the empty source directory
            try {
                fs.rmdirSync(sourceDir);
            } catch (e) {
                console.warn(`Could not remove ${sourceDir} (not empty?)`);
            }
        }
    }

    // 3. Update Index Data
    console.log("Updating library index...");
    for (const key in library) {
        const entry = library[key];

        // Update Path: Remove 'generated/'
        // Old: assets/generated/texture/file.svg
        // New: assets/texture/file.svg
        if (entry.path && entry.path.includes('assets/generated/')) {
            entry.path = entry.path.replace('assets/generated/', 'assets/');
        }

        // Update Source -> Tag
        if (entry.source) {
            if (!entry.tags) entry.tags = [];
            // Add source as tag if not present
            if (!entry.tags.includes(entry.source)) {
                entry.tags.push(entry.source);
            }
            delete entry.source;
        }
    }

    // 4. Save New Index
    fs.writeFileSync(NEW_INDEX_PATH, JSON.stringify(library, null, 2));
    console.log(`Saved new library index to ${NEW_INDEX_PATH}`);

    // 5. Cleanup
    try {
        if (fs.existsSync(OLD_INDEX_PATH)) fs.unlinkSync(OLD_INDEX_PATH);
        if (fs.existsSync(GENERATED_DIR)) fs.rmdirSync(GENERATED_DIR); // generated/ should be empty now
        console.log("Removed 'generated' directory.");
    } catch (e) {
        console.warn("Could not remove 'generated' directory fully:", e.message);
    }

    console.log("Migration Complete!");
}

migrate().catch(console.error);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AiAssetService } from '../services/ai-asset-service.js';
import { ASSET_WISHLIST } from '../data/asset-wishlist.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ROOT_DIR = path.resolve(__dirname, '../../');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets', 'generated');
const INDEX_FILE = path.join(ASSETS_DIR, 'library_index.json');
const CONFIG_FILE = path.join(ROOT_DIR, 'tests', 'config.json');

// Ensure directories exist
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Load Config
function loadConfig() {
    let config = {};
    if (fs.existsSync(CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } else {
        config.apiKey = process.env.GEMINI_API_KEY;
    }
    return config;
}

// Load or Create Index
function loadIndex() {
    if (fs.existsSync(INDEX_FILE)) {
        return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    }
    return {};
}

function saveIndex(index) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

async function main() {
    const config = loadConfig();
    if (!config.apiKey) {
        console.error("Error: API Key not found. Set GEMINI_API_KEY or create tests/config.json");
        process.exit(1);
    }

    console.log("Starting Asset Generation Library...");
    const service = new AiAssetService(config.apiKey, config.model || "gemini-2.0-flash");
    const index = loadIndex();

    // Ensure base dirs
    ensureDir(ASSETS_DIR);
    ensureDir(path.join(ASSETS_DIR, 'texture'));
    ensureDir(path.join(ASSETS_DIR, 'wall'));
    ensureDir(path.join(ASSETS_DIR, 'object'));
    ensureDir(path.join(ASSETS_DIR, 'structure'));

    // Filter wishlist for missing items
    const missing = ASSET_WISHLIST.filter(item => !index[item.id]);

    if (missing.length === 0) {
        console.log("All assets in wishlist are already generated!");
        return;
    }

    console.log(`Found ${missing.length} missing assets. Starting generation...`);

    for (const item of missing) {
        console.log(`Generating [${item.type}] ${item.id}...`);

        try {
            // Generate
            const svgContent = await service.generateSVG(item.prompt, item.type);

            // Save File
            const typeFolder = item.type.toLowerCase(); // texture, object, structure
            const fileName = `${item.id}.svg`;
            const relativePath = path.join('assets', 'generated', typeFolder, fileName);
            const absolutePath = path.join(ASSETS_DIR, typeFolder, fileName);

            // Ensure type subfolder exists (just in case)
            ensureDir(path.dirname(absolutePath));

            fs.writeFileSync(absolutePath, svgContent);

            // Update Index
            index[item.id] = {
                id: item.id,
                path: relativePath.replace(/\\/g, '/'), // Normalize for web
                fileType: 'svg',
                source: 'ai-gen',
                type: item.type,
                tags: item.tags,
                generatedAt: Date.now(),
                width: item.width || 1,
                height: item.height || 1
            };

            // Save index after every success to prevent data loss on crash
            saveIndex(index);
            console.log(`  -> Saved to ${relativePath}`);

            // Rate limiting (simple sleep)
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (err) {
            console.error(`  !! FAILED to generate ${item.id}:`, err.message);
            // Continue to next item
        }
    }

    console.log("Batch generation complete.");
}

main();

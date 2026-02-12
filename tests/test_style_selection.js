import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom'; // Ensure jsdom is installed or available
import canvas from 'canvas';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// --- Mock Browser Environment ---
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.Image = dom.window.Image;
global.crypto = crypto;
if (!global.crypto.randomUUID) global.crypto.randomUUID = () => crypto.randomUUID();

// Patch canvas
const originalCreateElement = global.document.createElement;
global.document.createElement = (tagName) => {
    if (tagName.toLowerCase() === 'canvas') return canvas.createCanvas(1, 1);
    return originalCreateElement.call(global.document, tagName);
};

// Mock Blob
global.Blob = class Blob {
    constructor(content, options) { this.content = content; this.options = options; }
    async arrayBuffer() { return this.content[0] instanceof Buffer ? this.content[0] : Buffer.from(this.content[0]); }
};

const { generateDungeon } = await import('../scripts/dungeongen/dungeongen.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    console.log("Starting Style Selection Verification...");

    // 1. Load Library
    const libraryPath = path.resolve(__dirname, '../assets/library.json');
    if (!fs.existsSync(libraryPath)) {
        console.error("FAILED: Library index not found at " + libraryPath);
        process.exit(1);
    }
    const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
    console.log("Library loaded.");

    // 2. Pick a texture (simulate UI selection)
    // Find 'floor_stone_paving_clean' if possible, or any floor
    let asset = Object.values(library).find(a => a.id === 'floor_stone_paving_clean');
    if (!asset) {
        asset = Object.values(library).find(a => a.type === 'TEXTURE' && a.tags.includes('floor'));
    }

    if (!asset) {
        console.error("FAILED: No floor texture found in library.");
        process.exit(1);
    }

    // path in library is "assets/texture/..."
    // We need to resolve this relative to the module root for the generator to find it?
    // In Foundry, these are URL paths. In node, we might need file paths.
    // The renderer uses `await loadImage(src)`.
    // If src is a file path, node-canvas `loadImage` usually handles it if implementation supports it.
    // However, the path "assets/texture/..." fits `vibe-scenes` root.
    // We are in `tests/`. Root is `../`.
    // So we should prepend `../` to the path for node execution.

    const relativePath = path.join('..', asset.path);
    console.log(`Selected Floor: ${asset.id} (${asset.path})`);
    console.log(`Resolved Path for Test: ${relativePath}`);

    // 3. Generate
    const options = {
        size: 'small', // Fast
        seed: 12345,
        floorTexture: relativePath // Pass the path
    };

    console.log("Generating dungeon with custom floor...");

    // We need to patch Canvas.prototype.toBlob for node-canvas
    const Canvas = canvas.Canvas;
    if (!Canvas.prototype.toBlob) {
        Canvas.prototype.toBlob = function (callback, type = 'image/png') {
            callback(new global.Blob([this.toBuffer(type)], { type }));
        };
    }

    try {
        const { blob } = await generateDungeon(options);
        const buffer = await blob.arrayBuffer();

        const outputPath = path.join(__dirname, 'verify_style_output.png');
        fs.writeFileSync(outputPath, buffer);
        console.log(`Success! Generated dungeon saved to: ${outputPath}`);
        console.log("Check this image to verify the floor texture is applied.");

    } catch (error) {
        console.error("Generation failed:", error);
        process.exit(1);
    }
}

run();

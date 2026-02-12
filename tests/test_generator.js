import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import canvas from 'canvas';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// --- Mock Browser Environment ---
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.Image = dom.window.Image;
global.crypto = crypto; // Polyfill crypto for randomUUID if needed, or just the object
if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = () => crypto.randomUUID();
}

// Patch canvas creation to use node-canvas
const originalCreateElement = global.document.createElement;
global.document.createElement = (tagName) => {
    if (tagName.toLowerCase() === 'canvas') {
        return canvas.createCanvas(1, 1); // Dimensions will be set later
    }
    return originalCreateElement.call(global.document, tagName);
};

// Mock Blob (simple implementation for this use case)
global.Blob = class Blob {
    constructor(content, options) {
        this.content = content;
        this.options = options;
    }

    // Check if content is a buffer (from node-canvas toBlob)
    async arrayBuffer() {
        if (this.content[0] instanceof Buffer) {
            return this.content[0];
        }
        return Buffer.from(this.content[0]);
    }
};

// Polyfill toBlob for node-canvas if needed (it usually has it, but let's be safe)
// Actually, node-canvas canvas.toBlob() signature is (callback, mimeType, qualityArgument).
// The renderer calls: canvas.toBlob(blob => { ... }, 'image/png');
// This matches node-canvas behavior.

// --- Import Generator ---
// We need to use dynamic import because we are in a module
const { generateDungeon } = await import('../scripts/dungeongen/dungeongen.js');

// --- Configuration ---
// Default inputs:
// 1. Scene Name = Generated Dungeon mmddhhmmss
// 2. Dungeon Size Medium
// 3. No symmetry
// 4. No water depth
// 5. Random seed
// 6. Grid size = 20 pixels
const now = new Date();
const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(4, 14); // MMDDHHMMSS format roughly
// Actually user asked for mmddhhmmss (month, day, hour, minute, second)
const pad = (n) => n.toString().padStart(2, '0');
const timeStr = `${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const sceneName = `Generated Dungeon ${timeStr}`;

const options = {
    name: sceneName,
    size: 'medium',
    symmetry: 'none',
    water: 'none',
    seed: Math.floor(Math.random() * 100000), // Random seed
    gridSize: 100
};

console.log(`Generating dungeon: ${sceneName}`);
console.log(`Options:`, options);

// --- Execution ---

async function run() {
    // Patch toBlob on the node-canvas prototype to match browser API
    // node-canvas toBlob signature: (callback, mimeType, config) -> callback(err, buffer)
    // browser toBlob signature: (callback, mimeType, quality) -> callback(blob)

    // We need to access the Canvas constructor from the canvas package
    // The 'canvas' default export has a Canvas property? Or is it the export itself?
    // Let's check how we imported it.
    // import canvas from 'canvas'; -> default export

    const Canvas = canvas.Canvas;

    // Polyfill toBlob if it doesn't exist (node-canvas doesn't have it)
    if (!Canvas.prototype.toBlob) {
        Canvas.prototype.toBlob = function (callback, type = 'image/png', quality) {
            // Map mime types to node-canvas options
            // node-canvas toBuffer takes (mimeType, config)
            // But toBuffer() defaults to PNG. toBuffer('image/png') works.

            try {
                const buffer = this.toBuffer(type, { quality });
                // Wrap buffer in our mock Blob
                const blob = new global.Blob([buffer], { type: type });
                // Callback is async in browser, let's simulate that or just call it
                setTimeout(() => callback(blob), 0);
            } catch (err) {
                console.error("Canvas toBlob error:", err);
                setTimeout(() => callback(null), 0);
            }
        };
    }

    console.log(`Generating dungeon: ${options.name}`);
    console.log(`Size: ${options.size}, Grid: ${options.gridSize}`);

    try {
        const { blob } = await generateDungeon(options);

        if (!blob) {
            throw new Error("Failed to generate blob");
        }

        const buffer = await blob.arrayBuffer(); // Our mock Blob has this

        // Output directory
        // We want 'Generated Dungeons' inside the module folder.
        // Assuming we run from module root, or relative to this script.
        // Let's make it relative to the script's parent (tests/) -> parent (vibe-scenes/) -> Generated Dungeons

        // __dirname is not available in ES modules, use import.meta.url
        const __dirname = path.dirname(new URL(import.meta.url).pathname);
        // On Windows, pathname starts with /C:/... which might be an issue for path.resolve?
        // path.resolve handles it usually, or use fileURLToPath.

        // Simpler: use process.cwd() if we assume running from root.
        // Or just hardcode 'Generated Dungeons' if running from root.
        // But to be safe and consistent:
        const projectRoot = path.resolve(process.cwd());
        // If running from tests/, cwd might be tests/. If running from root, cwd is root.
        // Let's blindly assume we want it in the 'Generated Dungeons' folder in the CWD if it looks like the project root,
        // or ensure it ends up in vibe-scenes/Generated Dungeons.

        // Best approach: Relative to this script file.
        // test_generator.js is in /tests/
        // We want /Generated Dungeons/

        const scriptDir = path.dirname(new URL(import.meta.url).pathname).substring(1); // Remove leading / on Windows
        // Actually, let's use the 'url' module to be safe
        const __filename = fileURLToPath(import.meta.url);
        const __dirnameDerived = path.dirname(__filename);

        const outputDir = path.join(__dirnameDerived, '..', 'Generated Dungeons');

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Sanitize filename
        const safeName = options.name.replace(/[^a-z0-9 ]/gi, '_');
        const outputPath = path.join(outputDir, `${safeName}.png`);

        fs.writeFileSync(outputPath, buffer); // buffer is already a Buffer object

        console.log(`Success! Dungeon saved to: ${outputPath}`);

    } catch (error) {
        console.error("Error generating dungeon:", error);
    }
}

run();

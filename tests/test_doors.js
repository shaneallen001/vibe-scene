
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
global.crypto = crypto;
if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = () => crypto.randomUUID();
}

// Patch canvas creation
const originalCreateElement = global.document.createElement;
global.document.createElement = (tagName) => {
    if (tagName.toLowerCase() === 'canvas') {
        return canvas.createCanvas(1, 1);
    }
    return originalCreateElement.call(global.document, tagName);
};

global.Blob = class Blob {
    constructor(content, options) {
        this.content = content;
        this.options = options;
    }
    async arrayBuffer() {
        if (this.content[0] instanceof Buffer) {
            return this.content[0];
        }
        return Buffer.from(this.content[0]);
    }
};

// --- Import Generator ---
const { generateDungeonWithData } = await import('../scripts/dungeongen/dungeongen.js');
const { CellType } = await import('../scripts/dungeongen/layout/models.js');

async function run() {
    const Canvas = canvas.Canvas;
    if (!Canvas.prototype.toBlob) {
        Canvas.prototype.toBlob = function (callback, type = 'image/png', quality) {
            try {
                const buffer = this.toBuffer(type, { quality });
                const blob = new global.Blob([buffer], { type: type });
                setTimeout(() => callback(blob), 0);
            } catch (err) {
                console.error("Canvas toBlob error:", err);
                setTimeout(() => callback(null), 0);
            }
        };
    }

    const configurations = [
        {
            name: 'Doors Standard',
            size: 'medium',
            doorDensity: 1.0 // Max probability
        },
        {
            name: 'Doors Sparse',
            size: 'medium',
            doorDensity: 0.1 // Low probability
        }
    ];

    for (const config of configurations) {
        console.log(`Generating: ${config.name}`);

        try {
            const { dungeon: grid, blob } = await generateDungeonWithData(config);

            // Verify Doors
            console.log(`  - Doors count: ${grid.doors.length}`);

            // Validation
            let invalidDoors = 0;

            for (const d of grid.doors) {

                // Check Floor
                if (grid.get(d.x, d.y) !== CellType.FLOOR) {
                    console.error(`    ERROR: Door at ${d.x},${d.y} is not on FLOOR!`);
                    invalidDoors++;
                }

                // Check Geometry (Simplified check)
                const n = grid.get(d.x, d.y - 1) === CellType.FLOOR;
                const s = grid.get(d.x, d.y + 1) === CellType.FLOOR;
                const e = grid.get(d.x + 1, d.y) === CellType.FLOOR;
                const w = grid.get(d.x - 1, d.y) === CellType.FLOOR;

                if (d.direction === 'vertical') {
                    // Should connect W-E (Floors) and have Walls N-S
                    if (!w || !e) console.warn(`    WARNING: Vertical Door at ${d.x},${d.y} might not connect W-E properly.`);
                } else {
                    // Should connect N-S (Floors) and have Walls W-E
                    if (!n || !s) console.warn(`    WARNING: Horizontal Door at ${d.x},${d.y} might not connect N-S properly.`);
                }
            }

            if (invalidDoors === 0) console.log("  - All doors valid.");

            if (!blob) throw new Error("Failed to generate blob");
            const buffer = await blob.arrayBuffer();
            const __filename = fileURLToPath(import.meta.url);
            const __dirnameDerived = path.dirname(__filename);
            const outputDir = path.join(__dirnameDerived, '..', 'Generated Dungeons');

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const safeName = config.name.replace(/[^a-z0-9]/gi, '_');
            const outputPath = path.join(outputDir, `doors_${safeName}.png`);
            fs.writeFileSync(outputPath, buffer);

            console.log(`Saved to: ${outputPath}`);

        } catch (error) {
            console.error(`Error generating ${config.name}:`, error);
        }
    }
}

run();


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
            name: 'Verticality Default',
            size: 'medium',
            stairs: { up: 1, down: 2 }
        },
        {
            name: 'Verticality Heavy',
            size: 'large',
            stairs: { up: 2, down: 5 }
        }
    ];

    for (const config of configurations) {
        console.log(`Generating: ${config.name}`);

        try {
            const { dungeon: grid, blob } = await generateDungeonWithData(config);

            // Verify Stairs
            console.log(`  - Stairs count: ${grid.stairs.length}`);
            const ups = grid.stairs.filter(s => s.type === 'up').length;
            const downs = grid.stairs.filter(s => s.type === 'down').length;
            console.log(`  - Up: ${ups}, Down: ${downs}`);

            if (ups !== config.stairs.up) console.warn(`    WARNING: Expected ${config.stairs.up} Up stairs, got ${ups}`);
            if (downs !== config.stairs.down) console.warn(`    WARNING: Expected ${config.stairs.down} Down stairs, got ${downs}`);

            // Verify Valid Placement
            let invalidStairs = 0;
            for (const s of grid.stairs) {
                if (grid.get(s.x, s.y) !== CellType.FLOOR) {
                    console.error(`    ERROR: Stair at ${s.x},${s.y} is not on FLOOR!`);
                    invalidStairs++;
                }
            }
            if (invalidStairs === 0) console.log("  - All stairs on valid floor tiles.");


            if (!blob) throw new Error("Failed to generate blob");
            const buffer = await blob.arrayBuffer();
            const __filename = fileURLToPath(import.meta.url);
            const __dirnameDerived = path.dirname(__filename);
            const outputDir = path.join(__dirnameDerived, '..', 'Generated Dungeons');

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const safeName = config.name.replace(/[^a-z0-9]/gi, '_');
            const outputPath = path.join(outputDir, `verticality_${safeName}.png`);
            fs.writeFileSync(outputPath, buffer);

            console.log(`Saved to: ${outputPath}`);

        } catch (error) {
            console.error(`Error generating ${config.name}:`, error);
        }
    }
}

run();

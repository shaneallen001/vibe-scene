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

// Patch canvas creation to use node-canvas
const originalCreateElement = global.document.createElement;
global.document.createElement = (tagName) => {
    if (tagName.toLowerCase() === 'canvas') {
        return canvas.createCanvas(1, 1);
    }
    return originalCreateElement.call(global.document, tagName);
};

// Mock Blob (simple implementation for this use case)
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
const { generateDungeon } = await import('../scripts/dungeongen/dungeongen.js');

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

    const maskTypes = ['rectangle', 'round', 'cross', 'cavernous', 'keep'];

    for (const maskType of maskTypes) {
        const options = {
            name: `Test ${maskType}`,
            size: 'medium',
            maskType: maskType,
            gridSize: 10
        };

        console.log(`Generating dungeon with mask: ${maskType}`);

        try {
            const blob = await generateDungeon(options);
            if (!blob) throw new Error("Failed to generate blob");

            const buffer = await blob.arrayBuffer();
            const __filename = fileURLToPath(import.meta.url);
            const __dirnameDerived = path.dirname(__filename);
            const outputDir = path.join(__dirnameDerived, '..', 'Generated Dungeons');

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const outputPath = path.join(outputDir, `mask_test_${maskType}.png`);
            fs.writeFileSync(outputPath, buffer);

            console.log(`Saved to: ${outputPath}`);

        } catch (error) {
            console.error(`Error generating ${maskType}:`, error);
        }
    }
}

run();


import { generateDungeon } from '../scripts/dungeongen/dungeongen.js';
import crypto from 'crypto';
import { JSDOM } from 'jsdom';
import canvas from 'canvas';

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
        const c = canvas.createCanvas(1, 1);
        c.style = {};
        return c;
    }
    return originalCreateElement.call(global.document, tagName);
};

// Mock Blob
global.Blob = class Blob {
    constructor(content, options) {
        this.content = content;
        this.options = options;
    }
    async arrayBuffer() { return Buffer.from(this.content[0]); }
};

// Patch toBlob
const Canvas = canvas.Canvas;
if (!Canvas.prototype.toBlob) {
    Canvas.prototype.toBlob = function (callback, type = 'image/png', quality) {
        try {
            const buffer = this.toBuffer(type);
            const blob = new global.Blob([buffer], { type: type });
            setTimeout(() => callback(blob), 0);
        } catch (err) {
            setTimeout(() => callback(null), 0);
        }
    };
}

async function testPipeline() {
    console.log("Testing generateDungeon pipeline return value...");

    try {
        const result = await generateDungeon({
            size: 'tiny',
            gridSize: 20
        });

        if (!result) {
            console.error("FAILED: Result is null/undefined");
            return;
        }

        if (!result.blob) {
            console.error("FAILED: Result.blob is missing");
        } else {
            console.log("Result.blob is present");
        }

        if (!result.walls) {
            console.error("FAILED: Result.walls is missing");
        } else {
            console.log(`Result.walls is present with ${result.walls.length} walls`);
        }

        if (result.blob && result.walls) {
            console.log("SUCCESS: Pipeline returns blob and walls");
        }

    } catch (error) {
        console.error("FAILED: Error during generation:", error);
    }
}

testPipeline();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OUTPUT_DIR = path.join(__dirname, '../../svgs');
const TILES_FILE = path.join(OUTPUT_DIR, 'tiles.json');
const COUNT_PER_SET = 10;
const SIZE = 512; // 512x512 px

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    console.log(`Creating directory: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper: Random float between min and max
const random = (min, max) => Math.random() * (max - min) + min;

// Helper: Random integer
const randomInt = (min, max) => Math.floor(random(min, max));

// Helper: Generate a unique ID
const uid = () => Math.random().toString(36).substr(2, 9);

// --- SVG Generators ---

// --- SVG Constants & Helpers ---

const SVG_CONFIG = {
    xmlns: "http://www.w3.org/2000/svg",
    style: `
        rect { shape-rendering: geometricPrecision; }
        path { stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    `
};

const getSvgHeader = () => `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="${SVG_CONFIG.xmlns}">
<style>${SVG_CONFIG.style}</style>`;

// --- SVG Generators ---

// 1. Basic Stone Generator (using filters)
function generateStoneTile(index, hue = 0, sat = 0, light = 50) {
    const frequency = random(0.02, 0.05); // Texture scale

    // HSL to RGB conversion for tinting if needed, or just use CSS HSL
    const baseColor = `hsl(${hue}, ${sat}%, ${light}%)`;
    const darkColor = `hsl(${hue}, ${sat}%, ${light - 20}%)`;

    return `${getSvgHeader()}
    <defs>
        <filter id="noise-${index}">
            <feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="4" stitchTiles="stitch" result="noise"/>
            <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" in="noise" result="grayscale"/>
            <feComponentTransfer in="grayscale" result="adjusted">
                <feFuncR type="linear" slope="1.5" intercept="-0.2"/>
                <feFuncG type="linear" slope="1.5" intercept="-0.2"/>
                <feFuncB type="linear" slope="1.5" intercept="-0.2"/>
            </feComponentTransfer>
             <feComposite operator="arithmetic" k1="0" k2="1" k3="1" k4="0" in="SourceGraphic" in2="adjusted" result="texture"/>
        </filter>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="${baseColor}" filter="url(#noise-${index})" />
    <!-- Overlay a bit of darkening for variation -->
    <rect width="${SIZE}" height="${SIZE}" fill="${darkColor}" opacity="${random(0.1, 0.3)}" style="mix-blend-mode: multiply;" />
</svg>`;
}

// 2. Cracked Stone (Stone + Cracks)
// Hard to do seamless cracks with simple paths without wrapping logic. 
// We'll simulate "cracked" texture using high-frequency turbulence or different noise types.
function generateRoughStoneTile(index, hue = 0, sat = 0, light = 40) {
    const frequency = random(0.04, 0.08); // Rougher
    const baseColor = `hsl(${hue}, ${sat}%, ${light}%)`;

    return `${getSvgHeader()}
    <defs>
        <filter id="rough-${index}">
            <feTurbulence type="turbulence" baseFrequency="${frequency}" numOctaves="5" stitchTiles="stitch" result="noise"/>
            <feDiffuseLighting in="noise" lighting-color="#ffffff" surfaceScale="2">
                <feDistantLight azimuth="45" elevation="60" />
            </feDiffuseLighting>
            <feComposite operator="multiply" in2="SourceGraphic" />
        </filter>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="${baseColor}" filter="url(#rough-${index})" />
</svg>`;
}

// 3. Mossy Stone (Stone + Green Noise)
function generateMossyTile(index) {
    const baseFreq = random(0.02, 0.04);
    const mossFreq = random(0.05, 0.1);

    return `${getSvgHeader()}
    <defs>
        <filter id="moss-${index}">
            <!-- Base Stone Noise -->
            <feTurbulence type="fractalNoise" baseFrequency="${baseFreq}" numOctaves="3" stitchTiles="stitch" result="stoneNoise"/>
            
            <!-- Moss Noise -->
            <feTurbulence type="fractalNoise" baseFrequency="${mossFreq}" numOctaves="4" stitchTiles="stitch" result="mossNoise"/>
            
            <!-- Colorize Moss: Greenish -->
            <feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.4  0 0 0 0 0.1  0 0 0 1 0" in="mossNoise" result="mossColor"/>
            
            <!-- Composite -->
             <feComposite operator="in" in="mossColor" in2="mossNoise" result="mossLayer"/>
        </filter>
    </defs>
    <!-- Background Stone -->
    <rect width="${SIZE}" height="${SIZE}" fill="#555555" />
    <rect width="${SIZE}" height="${SIZE}" fill="#000000" opacity="0.3" filter="url(#moss-${index})" />
    
    <!-- Moss Blotches -->
     <circle cx="${random(0, SIZE)}" cy="${random(0, SIZE)}" r="${random(50, 150)}" fill="#3a5a3a" opacity="0.4" filter="url(#moss-${index})" />
     <circle cx="${random(0, SIZE)}" cy="${random(0, SIZE)}" r="${random(30, 100)}" fill="#2a4a2a" opacity="0.4" filter="url(#moss-${index})" />
</svg>`;
}

// --- Main Generation Loop ---

const metadata = {
    sets: [
        {
            id: 'stone_simple',
            name: 'Simple Stone',
            tags: ['stone', 'grey', 'clean'],
            variants: []
        },
        {
            id: 'stone_rough',
            name: 'Rough Stone',
            tags: ['stone', 'grey', 'rough'],
            variants: []
        },
        {
            id: 'earth_dark',
            name: 'Dark Earth',
            tags: ['dirt', 'brown', 'dark'],
            variants: []
        }
    ]
};

console.log("Generating tiles...");

// Set 1: Simple Stone
for (let i = 0; i < COUNT_PER_SET; i++) {
    const filename = `stone_simple_${i + 1}.svg`;
    const svg = generateStoneTile(i, 0, 0, 60); // Grey
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), svg);
    metadata.sets[0].variants.push({ file: filename, weight: 1 });
    console.log(`Generated ${filename}`);
}

// Set 2: Rough Stone / Crackedish
for (let i = 0; i < COUNT_PER_SET; i++) {
    const filename = `stone_rough_${i + 1}.svg`;
    const svg = generateRoughStoneTile(i, 0, 0, 40); // Darker Grey
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), svg);
    metadata.sets[1].variants.push({ file: filename, weight: 1 });
    console.log(`Generated ${filename}`);
}

// Set 3: Dark Earth / Mud
for (let i = 0; i < COUNT_PER_SET; i++) {
    const filename = `earth_dark_${i + 1}.svg`;
    const svg = generateStoneTile(i, 30, 20, 30); // Dark Brownish
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), svg);
    metadata.sets[2].variants.push({ file: filename, weight: 1 });
    console.log(`Generated ${filename}`);
}

// Write Metadata
fs.writeFileSync(TILES_FILE, JSON.stringify(metadata, null, 2));
console.log(`Metadata saved to ${TILES_FILE}`);
console.log("Done.");

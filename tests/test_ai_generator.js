import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AiAssetService } from '../scripts/services/ai-asset-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Output to the main svgs folder for this test
const OUTPUT_DIR = path.join(__dirname, '../svgs');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load Config
let config = {};
if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} else {
    // Check environment variables
    config.apiKey = process.env.GEMINI_API_KEY;
}

if (!config.apiKey) {
    console.error("Error: API Key not found.");
    console.error("Please create 'tests/config.json' with { \"apiKey\": \"YOUR_KEY\" }");
    console.error("OR set GEMINI_API_KEY environment variable.");
    process.exit(1);
}

// Get prompt from CLI args or default
const prompt = process.argv[2] || "A cracked stone dungeon floor tile with moss in the crevices";

console.log(`Generating SVG for: "${prompt}"...`);

const service = new AiAssetService(config.apiKey, config.model || "gemini-3-flash-preview");

service.generateSVG(prompt).then(svg => {
    // Use a clean filename
    const filename = `ai_generated_${Date.now()}.svg`;
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, svg);
    console.log(`Success! Saved to: ${filePath}`);
}).catch(err => {
    console.error("Generation Failed:", err.message);
    process.exit(1);
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '../../assets/object');

console.log(`Scanning directory: ${ASSETS_DIR}`);

if (!fs.existsSync(ASSETS_DIR)) {
    console.error("Directory not found!");
    process.exit(1);
}

const files = fs.readdirSync(ASSETS_DIR).filter(file => file.endsWith('.svg'));
console.log(`Found ${files.length} SVG files.`);

let sanitizedCount = 0;

files.forEach(file => {
    const filePath = path.join(ASSETS_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let originalLength = content.length;
    let modified = false;

    // 1. Remove XML Declaration
    if (content.includes('<?xml')) {
        content = content.replace(/<\?xml[^>]*\?>/gi, '');
        modified = true;
    }

    // 2. Remove <style> blocks
    if (content.includes('<style>')) {
        content = content.replace(/<style>[\s\S]*?<\/style>/gi, '');
        modified = true;
    }

    // 3. Remove <defs> blocks (often contain unused filters)
    if (content.includes('<defs>')) {
        content = content.replace(/<defs>[\s\S]*?<\/defs>/gi, '');
        modified = true;
    }

    // 4. Remove comments
    content = content.replace(/<!--[\s\S]*?-->/g, '');

    // 5. Trim whitespace
    content = content.trim();

    // 6. Ensure xmlns
    if (!content.includes('xmlns="http://www.w3.org/2000/svg"')) {
        content = content.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        modified = true;
    }

    // 7. Inject width/height if missing (CRITICAL for Foundry/PIXI loader)
    const hasWidth = /<svg[^>]*\s+width\s*=/i.test(content);
    const hasHeight = /<svg[^>]*\s+height\s*=/i.test(content);

    if (!hasWidth || !hasHeight) {
        // Try to parse viewBox
        const viewBoxMatch = content.match(/viewBox="[^"]*?\s+[^"]*?\s+(\d+)\s+(\d+)"/);
        let w = "512";
        let h = "512";

        if (viewBoxMatch) {
            w = viewBoxMatch[1];
            h = viewBoxMatch[2];
        }

        let attributesToAdd = "";
        if (!hasWidth) {
            attributesToAdd += ` width="${w}"`;
        }
        if (!hasHeight) {
            attributesToAdd += ` height="${h}"`;
        }

        if (attributesToAdd) {
            content = content.replace('<svg', `<svg${attributesToAdd}`);
            modified = true;
        }
    }

    if (modified || content.length !== originalLength) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Sanitized: ${file}`);
        sanitizedCount++;
    }
});

console.log(`Finished! Sanitized ${sanitizedCount} files.`);

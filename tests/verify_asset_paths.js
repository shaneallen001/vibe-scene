
import { AssetLibraryService } from '../scripts/services/asset-library-service.js';
import fs from 'fs';
import path from 'path';

// Mock fetch for Node environment
global.fetch = async (url) => {
    // In node, we're running from tests/ so we need to go up to root
    // But the service expects "modules/vibe-scenes/assets/library.json"
    // We'll map that to the actual file on disk
    if (url.includes('library.json')) {
        const libraryPath = path.resolve('./assets/library.json');
        const content = fs.readFileSync(libraryPath, 'utf8');
        return {
            ok: true,
            json: async () => JSON.parse(content)
        };
    }
    return { ok: false };
};

async function test() {
    console.log("Testing AssetLibraryService path resolution...");
    const service = new AssetLibraryService();
    await service.load();

    const textures = service.getAssets('TEXTURE');
    if (textures.length === 0) {
        console.error("FAIL: No textures found.");
        process.exit(1);
    }

    const firstTexture = textures[0];
    console.log(`Found texture: ${firstTexture.id}`);
    console.log(`Original Path (in JSON): assets/...`);
    console.log(`Resolved Path: ${firstTexture.path}`);

    if (firstTexture.path.startsWith('modules/vibe-scenes/assets/')) {
        console.log("PASS: Path correctly resolved.");
    } else {
        console.error(`FAIL: Path not resolved correctly. Got: ${firstTexture.path}`);
        process.exit(1);
    }
}

test().catch(console.error);

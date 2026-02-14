import { AiAssetService } from '../scripts/services/ai-asset-service.js';

const mockApiKey = "test_key";
const mockModel = "test_model";

// Mocking the dependencies since we just want to test _sanitizeSVG
class MockAiAssetService extends AiAssetService {
    constructor() {
        super(mockApiKey, mockModel);
    }
}

const service = new MockAiAssetService();

const badSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="M10 10 H 90 V 90 H 10 L 10 10"/>
</svg>`;

const sanitized = service._sanitizeSVG(badSvg);

console.log("Original:", badSvg);
console.log("Sanitized:", sanitized);

if (!sanitized.includes('width="') || !sanitized.includes('height="')) {
    console.log("FAIL: Sanitized SVG is missing width/height attributes.");
    process.exit(1);
} else {
    console.log("PASS: Sanitized SVG has dimensions.");
}


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function listModels() {
    const configPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(configPath)) {
        console.error("No config.json found.");
        return;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const apiKey = config.apiKey;

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.name.includes("flash")) {
                    console.log(`- ${m.name} (${m.supportedGenerationMethods})`);
                }
            });
        } else {
            console.log("Error:", data);
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

listModels();

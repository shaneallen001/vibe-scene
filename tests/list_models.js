import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'config.json');

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const apiKey = config.apiKey;

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    .then(response => response.json())
    .then(data => {
        if (data.models) {
            console.log('Available Models:');
            data.models.forEach(model => console.log(`- ${model.name} (${model.description})`));
        } else {
            console.error('Error:', data);
        }
    })
    .catch(error => console.error('Error:', error));

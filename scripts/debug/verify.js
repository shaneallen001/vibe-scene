
import { DungeongenService } from "../services/dungeongen-service.js";

export async function verifyDungeonPrompt() {
    console.log("Starting Dungeon Prompt Verification...");

    const service = new DungeongenService();
    // Test case: Mixed themes
    const options = {
        size: "small", // Small enough to be quick, large enough to have rooms
        maskType: "rectangle",
        dungeonDescription: "A fire temple with a secret ice chamber.",
        density: 1.0, // High density to ensure rooms
        gridSize: 50,
        onProgress: (msg, pct) => console.log(`[Progress ${pct}%]: ${msg}`)
    };

    try {
        const result = await service.generate(options); // Pass dungeonDescription
        console.log("Generation Complete!", result);
        console.log("Rooms:", result.rooms);

        // Check if rooms have themes assigned (added in service)
        const themes = result.rooms.map(r => r.theme).filter(t => t);
        console.log("Assigned Themes:", themes);

        if (themes.length > 0) {
            console.log("%c PASS: Themes assigned to rooms.", "color: green");
        } else {
            console.warn("%c FAIL: No themes assigned.", "color: red");
        }

        console.log("Inspect the generated visual blob to confirm floor textures.");

        // Helper to visualize blob in console (if supported) or just log size
        console.log("Blob size:", result.blob.size);

    } catch (e) {
        console.error("Verification Failed:", e);
    }
}

// Attach to window for easy access
window.verifyDungeonPrompt = verifyDungeonPrompt;
console.log("verifyDungeonPrompt() available.");

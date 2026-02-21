import { VibeToast } from "../../../vibe-common/scripts/ui/toast-manager.js";
/**
 * Button Injector
 * Functions for injecting Vibe Scene button into Scene Directory
 */

/**
 * Add the Vibe Scene button to the Scene Directory
 */
export function addVibeSceneButton(app, html, showVibeSceneDialogFn) {
    // Try multiple ways to find the Scene Directory element
    let directoryElement = null;

    // Method 1: Use the app's element if available
    if (app && app.element && app.element.length) {
        directoryElement = app.element[0];
    }

    // Method 2: Find by ID
    if (!directoryElement) {
        directoryElement = document.querySelector("#scenes");
    }

    // Method 3: Find by class or data attribute
    if (!directoryElement) {
        directoryElement = document.querySelector(".scenes-directory, [data-tab='scenes']");
    }

    // Method 4: Use the html parameter if it's a DOM element
    if (!directoryElement && html && html.length) {
        directoryElement = html[0];
    }

    if (!directoryElement) {
        console.warn("Vibe Scenes: Could not find Scene Directory element");
        return;
    }

    // Check if button already exists
    if (directoryElement.querySelector(".vibe-scene-button")) return;

    // Create the button
    const button = document.createElement("button");
    button.className = "vibe-scene-button";
    button.type = "button";
    button.innerHTML = '<i class="fas fa-dungeon"></i> Vibe Scene';

    // Add click handler
    button.addEventListener("click", () => {
        if (!game.user.isGM) {
            VibeToast.warn("Only the GM can use Vibe Scene.");
            return;
        }
        showVibeSceneDialogFn();
    });

    // Find the content area within the scene directory
    const contentArea = directoryElement.querySelector(".window-content, .directory-list") || directoryElement;

    // Try to find where the directory control buttons are located
    const existingButtons = contentArea.querySelectorAll("button");
    let inserted = false;

    // Look for directory control buttons (like "Create Scene", etc.)
    for (const existingButton of existingButtons) {
        const buttonText = existingButton.textContent || existingButton.innerText || "";
        if (buttonText.includes("Create") || buttonText.includes("Add")) {
            // Insert after the existing button
            const parent = existingButton.parentNode;
            if (parent) {
                parent.insertBefore(button, existingButton.nextSibling);
                inserted = true;
                break;
            }
        }
    }

    // If we didn't find buttons, try to find the header area
    if (!inserted) {
        const header = contentArea.querySelector(".directory-header, .header-actions, header, .window-header");
        if (header) {
            // Look for any buttons in the header
            const headerButtons = header.querySelectorAll("button");
            if (headerButtons.length > 0) {
                const lastButton = headerButtons[headerButtons.length - 1];
                lastButton.parentNode.insertBefore(button, lastButton.nextSibling);
                inserted = true;
            } else {
                header.appendChild(button);
                inserted = true;
            }
        }
    }

    // Fallback: Find the directory list and insert button before it
    if (!inserted) {
        const directoryList = contentArea.querySelector(".directory-list, .directory-items");
        if (directoryList && directoryList.parentNode) {
            // Create a button container if needed
            const buttonContainer = document.createElement("div");
            buttonContainer.className = "vibe-scene-button-container";
            buttonContainer.appendChild(button);
            directoryList.parentNode.insertBefore(buttonContainer, directoryList);
            inserted = true;
        }
    }

    // Final fallback: Prepend to the content area
    if (!inserted) {
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "vibe-scene-button-container";
        buttonContainer.appendChild(button);
        contentArea.insertBefore(buttonContainer, contentArea.firstChild);
        inserted = true;
    }

    // Log success for debugging
    if (inserted) {
        console.log("Vibe Scenes: Vibe Scene button added successfully");
    } else {
        console.warn("Vibe Scenes: Vibe Scene button could not be inserted");
    }
}

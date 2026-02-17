# Dungeon Generation Flow

End-to-end process from user prompt to Foundry scene. Who hands what off to whom (LLMs vs local code).

```mermaid
flowchart TB
    subgraph User["👤 User"]
        UP[User prompt: dungeon description, size, shape, mode, etc.]
    end

    subgraph UI["Vibe Scene Dialog"]
        DIALOG[VibeSceneDialog]
        GEN_BTN[Generate button]
        OPTS[options: sceneName, size, maskType, dungeonDescription, generationMode, ...]
    end

    subgraph DS["DungeongenService"]
        GEN_ENTRY[generate(options)]
        PLAN_POP[_planAndPopulate]
        RENDER[DungeonRenderer.renderToBlob]
        WALLS[WallBuilder.build]
        OUT_DS[returns blob, walls, items, rooms]
    end

    subgraph AI["AiAssetService"]
        OUTLINE_LLM[planDungeonOutline]
        PLAN_LLM[planDungeon / planDungeonFromOutline]
        SVG_GEN[generateSVG]
        CRITIC[_critiqueSVG]
        SAVE[saveAsset → library]
    end

    subgraph GEMINI["Gemini API"]
        G_TEXT["Gemini (text model)"]
        G_SVG["Gemini (SVG model)"]
    end

    subgraph LOCAL["Local (no LLM)"]
        DUNGEON_GEN[DungeonGenerator]
        PROC[generate → random rooms + connectivity]
        FROM_OUT[generateFromOutline → paint rooms from outline]
    end

    subgraph IMPORTER["Scene Importer"]
        CREATE[SceneImporter.createScene]
        UPLOAD[Upload image, create Foundry Scene]
        PLACE[Place walls, tiles, items]
        SCENE_OUT[New Scene + optional activate]
    end

    UP --> GEN_BTN
    GEN_BTN --> DIALOG
    DIALOG --> |options| GEN_ENTRY

    GEN_ENTRY --> BRANCH{generationMode + API key?}

    BRANCH -->|intentional + key| OUTLINE_LLM
    OUTLINE_LLM --> |description, bounds, targetRoomCount, shapePreference| G_TEXT
    G_TEXT --> |outline: mask_type, rooms, connections, default_floor| OUTLINE_LLM
    OUTLINE_LLM --> |outline| FROM_OUT
    FROM_OUT --> |grid| PLAN_POP

    BRANCH -->|procedural or no key| PROC
    PROC --> |grid| PLAN_POP

    PLAN_POP --> |grid.rooms, availableAssets, description| PLAN_LLM
    PLAN_LLM --> |prompt + DUNGEON_PLANNER or DUNGEON_CONTENT_PLANNER| G_TEXT
    G_TEXT --> |plan, wishlist, default_floor| PLAN_LLM
    PLAN_LLM --> |plan, wishlist, default_floor| PLAN_POP

    PLAN_POP --> |for each wishlist item: name + visual_style| SVG_GEN
    SVG_GEN --> |prompt + SVG_* system prompt| G_SVG
    G_SVG --> |raw SVG text| SVG_GEN
    SVG_GEN --> CRITIC
    CRITIC --> |svg + prompt| G_TEXT
    G_TEXT --> |score, must_fix, revision_prompt| CRITIC
    CRITIC --> |revision loop or accept| SVG_GEN
    SVG_GEN --> |svg| SAVE
    SAVE --> |reload library| PLAN_POP

    PLAN_POP --> |plan → resolve textures, place items| RENDER
    RENDER --> |blob| WALLS
    WALLS --> OUT_DS

    OUT_DS --> |imageData, walls, items, rooms, gridSize| CREATE
    CREATE --> UPLOAD
    UPLOAD --> PLACE
    PLACE --> SCENE_OUT
    SCENE_OUT --> |activate?| DIALOG
```

## Summary

| Step | Who | Hand-off | LLM? |
|------|-----|----------|------|
| 1 | User | Enters dungeon description + options in dialog | — |
| 2 | VibeSceneDialog | Calls `DungeongenService.generate(options)` | — |
| 3a | DungeongenService | **Intentional mode**: `AiAssetService.planDungeonOutline()` → Gemini (text) → outline | ✅ Gemini text |
| 3b | DungeongenService | **Procedural**: `DungeonGenerator.generate()` (local algo) | ❌ |
| 4 | DungeonGenerator | Paints grid from outline or random placement (local) | ❌ |
| 5 | DungeongenService | `_planAndPopulate()` → `AiAssetService.planDungeon()` or `planDungeonFromOutline()` | ✅ Gemini text |
| 6 | AiAssetService | Returns **plan** (per-room themes, textures, blocking+ambient items with width/height) + **wishlist** (missing assets with dimensions+placement) + **default_floor** | — |
| 7 | DungeongenService | For each wishlist item: `AiAssetService.generateSVG()` → Gemini (SVG) → `_critiqueSVG()` → Gemini (text); repeat until pass or best-effort | ✅ Gemini SVG + text |
| 8 | AiAssetService | `saveAsset()` → upload file, register in library; library reload | — |
| 9 | DungeongenService | Map plan to items/textures (multi-cell dims, blocking/ambient placement), then `DungeonRenderer.renderToBlob()`, `WallBuilder.build()` | ❌ |
| 10 | DungeongenService | Returns `{ blob, walls, items, rooms }` to dialog | — |
| 11 | VibeSceneDialog | `SceneImporter.createScene()` → upload image, create Foundry Scene, place walls/items | — |
| 12 | User | Optional: activate new scene | — |

## LLM touchpoints

- **Gemini text model**: outline planner, dungeon/content planner, SVG critic (per wishlist item).
- **Gemini SVG model**: one-or-more passes per wishlist asset (with critic-driven revision loop).

All Gemini calls go through `GeminiService.generateContent()`; `AiAssetService` is the only service that calls it.

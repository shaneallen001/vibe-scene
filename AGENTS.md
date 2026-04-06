# vibe-scenes — Procedural Dungeon Generation

## Commands

```bash
node scripts/tests/test_generator.js   # Standalone dungeon gen test (no Foundry needed)
```

## Key Patterns

- `dungeongen/` is a pure JS library with NO Foundry dependency — can be tested standalone
- Four-phase generation: Layout → AI Plan/Populate → Canvas Render → Wall Build
- SVG quality loop: generate → critique → refine (iterative improvement)
- Asset wishlist: bounded concurrency pool (`WISHLIST_CONCURRENCY`), failures swallowed (one bad asset doesn't block batch)
- Two-model split: `textModel` (fast, for planning JSON) and `svgModel` (higher quality, for SVG art)

## Boundaries

- **IMPORTANT**: This module has its OWN `gemini-service.js` with vision/multimodal support — it is NOT the same as vibe-common's version. Do not replace it with vibe-common's.
- Settings registered in `init` hook (not `ready`) — needed early for service initialization.
- `CellType` enum: `EMPTY` (outside), `FLOOR` (walkable), `WALL` (1-cell border), `DOOR`

## Gotchas

- **Library reload**: MUST call `AssetLibraryService.reload()` after wishlist generation + 1s filesystem flush delay.
- **Fuzzy texture resolution**: `_findTexture()` uses 3-strategy matching — exact, contains, partial.
- **Wall placement**: 1/3 cell inward from FLOOR/WALL boundary (lets players see wall texture).
- **SVG sanitization**: `_sanitizeSVG()` removes `<style>` blocks (inline only for VTT compatibility), ensures `viewBox`, aggressive minification.

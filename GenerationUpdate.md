# Dungeon Generation - Development Notes

## Current Status (2026-02-09)

**Complete passage system rewrite** based on studying original [benjcooley/dungeongen](https://github.com/benjcooley/dungeongen):

### Changes Made
- ✅ **Passage anchors**: Passages now extend INTO rooms (anchor points on room walls)
- ✅ **Passage exits**: Exit points placed OUTSIDE rooms (in hallway space)
- ✅ **L-shaped corridors**: Corner fill squares eliminate gaps at bends
- ✅ **Dual doors**: Doors placed at BOTH ends of each passage
- ✅ **Door positioning**: Doors at exit points (room/hallway boundary)
- ✅ **Duplicate prevention**: Only MST creates passages (no duplicates)

### Waypoint Structure
Passages use 4-5 waypoints: `anchor1 → exit1 → (elbow) → exit2 → anchor2`
- **anchor1/2**: Inside room, on wall - creates visual connection  
- **exit1/2**: Outside room, in hallway - door placement points

---

## Known Limitations

### Passage Routing
- Long corridors may wrap around rooms
- No obstacle avoidance (passages may visually overlap rooms)

### Room Shapes  
- Only rectangular rooms fully supported
- Circle/octagon rooms may have connection issues

---

## Future Improvements

### Phase 1: Enhanced Corridor System
- [ ] A* pathfinding (avoids rooms)
- [ ] Variable corridor widths
- [ ] T-intersections and crossroads

### Phase 2: Door System
- [x] Doors at BOTH ends of passages
- [ ] Secret doors
- [ ] Locked doors with keys

### Phase 3: Map Features
- [ ] Water features
- [ ] Pit traps
- [ ] Columns/pillars

---

## Debug Options

```javascript
const renderer = new DungeonRenderer(dungeon, {
    drawNumbers: true,  // Enable for debugging
    drawGrid: true
});
```

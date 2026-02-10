# Dungeon Generation Update Plan

This document outlines the roadmap for reworking the procedural dungeon generation system to align with the proposed "System-Agnostic Procedural Dungeon Design Framework".

## Phase 1: Foundation & Spatial Constraints [PRIORITY: HIGH]
**Goal**: Establish the new phase-based architecture and implement the spatial constraint system.
- [ ] Refactor `DungeonGenerator` logic to run a sequence of phases.
- [ ] Implement `MapEnvelope` and `GridMask` (Rectangle, Round, Cross, Cavernous, Keep).
- [ ] Define configuration structures for all phases.

## Phase 2: Advanced Room Placement [PRIORITY: HIGH]
**Goal**: Implement sophisticated room placement logic with layout controls.
- [ ] **RoomBudget**: Calculate room count based on density and area.
- [ ] **RoomSizeSampling**: Implement weighted sampling for room sizes (Small/Large bias).
- [ ] **RoomPlacementAlgorithm**:
    - [ ] Random Non-Overlapping (Classic)
    - [ ] Relaxation Method (Scatter + Separate)
    - [ ] Symmetric Mode (Mirroring)
- [ ] **RoomShapeVariance**: Support non-rectangular rooms (Chamfer, L-shapes).

## Phase 3: Intelligent Corridors [PRIORITY: HIGH]
**Goal**: Improve how rooms are connected to create varied dungeon layouts.
- [ ] **ConnectivityStrategy**:
    - [ ] MST (Minimal Spanning Tree)
    - [ ] MST + Extra Edges (Loops)
    - [ ] Nearest Neighbor Chain
- [ ] **CorridorPathing**:
    - [ ] Straight / L-path
    - [ ] Errant (Wandering)
    - [ ] Labyrinth (Maze filling)

## Phase 4: Structural Refinement [PRIORITY: MEDIUM]
**Goal**: Control the flow using dead-ends and edge exits.
- [ ] **Dead-Ends**: Implement pruning logic (None, Some, All).
- [ ] **Edges & Exits**: Implement Peripheral Egress logic.

## Phase 5: Features & Polish [PRIORITY: MEDIUM]
**Goal**: Add interactive elements and final touches.
- [ ] **Verticality**: Stowage/Stair placement.
- [ ] **Doors**: Improved placement logic (Room transitions, choke points).
- [ ] **Post-Processing**: Hub rooms, sub-zones.

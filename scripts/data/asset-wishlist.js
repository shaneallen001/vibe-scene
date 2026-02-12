/**
 * Asset Wishlist
 * Defines the initial set of assets to generate for the library.
 */
export const ASSET_WISHLIST = [
    // --- FLOORS (TEXTURES) ---
    {
        id: "floor_stone_block_large",
        type: "TEXTURE",
        prompt: "Large rectangular grey stone blocks, dungeon floor, heavy texture, seamless",
        tags: ["stone", "floor", "dungeon"]
    },
    {
        id: "floor_stone_paving_clean",
        type: "TEXTURE",
        prompt: "Clean, well-maintained grey stone paving stones, seamless pattern",
        tags: ["stone", "floor", "clean"]
    },
    {
        id: "floor_stone_paving_cracked",
        type: "TEXTURE",
        prompt: "Ancient cracked grey stone paving stones with moss in crevices, seamless pattern",
        tags: ["stone", "floor", "ruin"]
    },
    {
        id: "floor_dirt_packed",
        type: "TEXTURE",
        prompt: "Packed dirt floor, brown and earthy, seamless pattern",
        tags: ["dirt", "floor", "nature"]
    },
    {
        id: "floor_wood_planks",
        type: "TEXTURE",
        prompt: "Old wooden floor planks, dark oak, vertical alignment, seamless pattern",
        tags: ["wood", "floor"]
    },
    {
        id: "water_blue_ripples",
        type: "TEXTURE",
        prompt: "Blue water surface with gentle ripples, seamless pattern",
        tags: ["water", "liquid"]
    },

    // --- WALLS (TEXTURES) ---
    {
        id: "wall_stone_bricks_grey",
        type: "WALL",
        prompt: "Grey stone bricks, standard dungeon wall pattern, seamless",
        tags: ["wall", "stone", "brick"]
    },
    {
        id: "wall_cave_rock_dark",
        type: "WALL",
        prompt: "Dark rough cave rock texture, natural stone, seamless",
        tags: ["wall", "rock", "cave"]
    },
    {
        id: "wall_plaster_cracked",
        type: "WALL",
        prompt: "Old white plaster wall peeling off to reveal bricks underneath, seamless",
        tags: ["wall", "plaster", "ruin"]
    },

    // --- FURNITURE (OBJECTS) ---
    {
        id: "object_puddle_water",
        type: "OBJECT",
        width: 1, height: 1,
        prompt: "A spill of water forming a puddle on a stone floor, transparent background, top down",
        tags: ["decor", "water", "puddle"]
    },
    {
        id: "object_puddle_slime",
        type: "OBJECT",
        width: 1, height: 1,
        prompt: "A bubbling green slime puddle, transparent background, top down",
        tags: ["decor", "slime", "puddle"]
    },
    {
        id: "furniture_chair_decayed",
        type: "OBJECT",
        width: 1, height: 1,
        prompt: "A broken rotting wooden chair, top down view",
        tags: ["furniture", "chair", "ruin"]
    },
    {
        id: "furniture_table_decayed",
        type: "OBJECT",
        width: 2, height: 1,
        prompt: "A rotting broken wooden table, collapsed on one side, top down view",
        tags: ["furniture", "table", "ruin"]
    },
    {
        id: "decor_pot_ceramic",
        type: "OBJECT",
        width: 1, height: 1,
        prompt: "A simple brown ceramic clay pot, top down view, empty",
        tags: ["decor", "container", "pot"]
    },
    {
        id: "decor_pot_broken",
        type: "OBJECT",
        width: 1, height: 1,
        prompt: "A shattered ceramic pot shards on the ground, top down",
        tags: ["decor", "ruin", "pot"]
    },
    {
        id: "furniture_bed_wood",
        type: "OBJECT",
        width: 2, height: 2,
        prompt: "A simple wooden bed with a white pillow and brown blanket",
        tags: ["furniture", "bed"]
    },
    {
        id: "furniture_table_round",
        type: "OBJECT",
        width: 2, height: 2,
        prompt: "A round wooden dining table with four chairs tucked in",
        tags: ["furniture", "table"]
    },
    {
        id: "furniture_bookshelf_full",
        type: "OBJECT",
        width: 2, height: 1,
        prompt: "A tall wooden bookshelf filled with colorful books and scrolls, top down view showing the top of the shelf and books",
        tags: ["furniture", "storage"]
    },
    {
        id: "decor_chest_wooden",
        type: "OBJECT",
        width: 1, height: 1,
        prompt: "A sturdy wooden chest with iron bands, closed latch",
        tags: ["decor", "container", "treasure"]
    },
    {
        id: "decor_rug_oval_red",
        type: "OBJECT",
        width: 2, height: 2,
        prompt: "An oval red ornamental rug with gold trim pattern",
        tags: ["decor", "rug"]
    },

    // --- STRUCTURES ---
    {
        id: "structure_tent_round",
        type: "STRUCTURE",
        width: 4, height: 4,
        prompt: "A beige canvas round tent with a central pole peak, top down roof view",
        tags: ["structure", "tent", "camp"]
    }
];

# Next Steps for Claude Code

## What We've Completed ✅

### Design & Documentation
- **Complete design document** (`docs/design.md`)
  - Core game philosophy (sandbox mechanics, Shapez/Factorio/ONI inspired)
  - Brownian motion & hex-grid molecules
  - Shape-complementarity binding system
  - 12 amino acid types (STR, EX6, CP6, E12, C12, BTA, BTC, BTG, BTT, CRL, RPF, PBF)
  - Protein folding mechanics
  - Heat transport system (deferred for now)
  - ATP energy system (deferred for now)

- **ECS architecture design** (`docs/implementation.md`)
  - Complete component definitions
  - System designs for physics, binding, catalysis, folding
  - Factory functions for creating molecules
  - Clean separation of data and logic

### Working Prototypes
- **ASCII Renderer** (`src/renderers/ascii-renderer-standalone.html`)
  - DNA with hydrogen bonds (|| for AT, ||| for GC)
  - RNA with 60° bends
  - Proteins with 60° and 120° bends
  - Interactive test interface
  - All molecules use proper formatting

- **v1 Prototype** (`prototypes/v1-transcription-vanilla.html`)
  - Basic grid-based transcription mechanic
  - Proof of concept for Opus Magnum-style gameplay

### Git History
- Clean commit history with semantic commits
- Tagged milestones: v0.1-prototype, v0.2-design-complete
- Organized branch structure

---

## Ready for Claude Code 🚀

### Immediate Tasks (Priority 1)

1. **Set up project in Claude Code**
   - Clone/import the git repository
   - Verify all files are present
   - Test ASCII renderer works

2. **Build the Graphics Renderer**
   - Implement full Canvas-based renderer
   - Hex grid background
   - Colored circles for nucleotides/amino acids
   - Proper rotation and positioning
   - Test with simple molecules

3. **Implement Core ECS System**
   - Create World class
   - Implement basic components (Transform, Velocity, HexStructure)
   - Build BrownianMotionSystem
   - Test with a few floating molecules

### Next Milestone (Priority 2)

4. **Hex Grid Math & Rendering**
   - Perfect the hex coordinate system
   - World space transformations
   - Verify molecules render correctly at all rotations

5. **Shape Matching System**
   - Implement basic shape complementarity detection
   - Spatial partitioning (quadtree or spatial hash)
   - Attraction forces and torques
   - Test binding between molecules

6. **Protein Folding Algorithm**
   - Implement moment of inertia calculation
   - Apply bending forces based on amino acid preferences
   - Ensure no self-overlap
   - Visualize folding process

### Future Work (Priority 3)

7. **Catalytic Systems**
   - RPF (transcription): DNA → RNA
   - PBF (translation): RNA → Protein
   - Test with starter proteins

8. **Polish & Features**
   - UI for molecule creation
   - Statistics display
   - Performance optimization
   - Save/load functionality

9. **Advanced Mechanics** (deferred)
   - ATP energy system
   - Heat/temperature simulation
   - Heat shuttle proteins

---

## File Structure Overview

```
protein-folding-game/
├── docs/
│   ├── design.md           # Complete game design
│   ├── implementation.md   # ECS architecture
│   └── hex-test.html       # Hex grid test
├── src/
│   └── renderers/
│       ├── ascii-renderer.js              # ASCII renderer (module)
│       ├── ascii-renderer.test.js         # 15 canonical tests
│       └── ascii-renderer-standalone.html # ASCII test interface
├── assets/                 # Design diagrams (SVGs)
└── README.md
```

---

## Key Design Decisions to Remember

1. **No temperature/ATP initially** - Focus on core mechanics first
2. **12 amino acid types** - All 3 characters, well-defined purposes
3. **Hex-based local coordinates** - Molecules have local hex grids, float in world space
4. **Shape complementarity** - Main binding mechanism with force/torque
5. **Sandbox over puzzles** - Let complexity emerge naturally

---

## Questions to Resolve in Claude Code

1. **Folding algorithm**: Physics-based or rule-based?
2. **Shape matching**: How to efficiently compute complementarity?
3. **Performance**: How many molecules can we handle?
4. **Genetic code**: Real codon table or simplified?

---

Good luck in Claude Code! 🧬💻

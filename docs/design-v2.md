# Design Document - Prototype v2
## Major Rework: Brownian Motion & Hex-Based Molecules

### Core Concept Changes

#### 1. Molecular Movement System
**Brownian Motion Simulation**
- DNA, RNA, and proteins float freely in 2D space
- Position slowly random walks (Brownian motion)
- Orientation slowly random walks (rotational Brownian motion)
- Creates dynamic, organic feel to molecular interactions

**Implications:**
- Machines must "catch" molecules as they drift by
- Timing becomes important - wait for the right orientation
- More realistic molecular behavior
- Adds difficulty/interest: molecules won't always be in perfect position

#### 2. Molecular Representation System
**Hex Grid Local Structure**
- All molecules (DNA, RNA, proteins) are built on hex grid principles
- Each hex contains one component (nucleotide or amino acid)
- Molecules consist of straight segments with 60° or 120° turns
- Locally hex-based, but float freely in continuous space

**Visual Structure:**
```
Example RNA strand on hex grid:
   A --- U --- C --- G
            \
             A --- U
```

#### 3. DNA Structure
**Double Helix → Double Strand (no helix in game)**
- Two parallel strands with complementary base pairs
- One hex gap between strands (middle row has linkage symbols)
- Gap contains X-shaped symbols showing hydrogen bonding
- Each strand mostly straight, occasional 60° corners allowed
- Both strands conform to hex grid alignment
- **Directionality is critical and must be displayed**

**Visual Representation:**
```
3'-A-C-G-T-5'  (top strand, left to right = 3' to 5')
    ╳ ╳ ╳      (middle row: X-shaped linkages between base pairs)
5'-T-G-C-A-3'  (bottom strand, left to right = 5' to 3')

Example with complementary pairing:
- Top: A-C-G-T (reading 3' → 5')
- Bottom: T-G-C-A (reading 5' → 3')
- Base pairing: A-T, C-G, G-C, T-A
- 3 Xs for 4 base pairs (linkages between adjacent pairs)
```

**Critical Details:**
- **Top strand:** 3' to 5' direction (left to right)
- **Bottom strand:** 5' to 3' direction (left to right)  
- **Directionality labels:** Show "3'" and "5'" at the ends of both strands
- **Middle row hexes:** X-shaped linkage symbols (representing hydrogen bonds)
- **Complementary pairing:** A↔T (2 H-bonds), G↔C (3 H-bonds)

**Constraints:**
- Strands maintain exactly one hex spacing (middle row between them)
- Complementary pairing enforced (A-T, G-C)
- Can have 60° bends while maintaining structure
- Both strands must remain on hex grid
- Antiparallel orientation always maintained (one strand 5'→3', other 3'→5')

#### 4. RNA Structure
- Single strand only (no double helix)
- Sequence of A, C, G, U on hex grid
- Each nucleotide occupies one hex
- **No cross-links** (unlike DNA)
- Can bend at **60° angles only** (not 120°)
- Similar visual style to DNA strands but without the complementary pairing

**Visual Representation:**
```
5'ACGUA3'  (straight segment)

Or with 60° bend:
5'ACG
    U
    A3'
```

**Constraints:**
- Single continuous strand
- No linkage symbols (no double helix partner)
- 60° turns allowed between adjacent nucleotides
- 120° turns NOT allowed (would be too sharp/unrealistic)
- Must remain on hex grid
- Directional labels: 5' and 3' at ends

#### 5. Protein Structure
- Single strand (for now - can add folding later)
- Sequence of amino acids
- Each amino acid occupies one hex
- 60°/120° turns allowed
- Different visual representation per amino acid type

### Technical Implementation Notes

**Hex Grid Math:**
- Use axial or cube coordinates for hex positioning
- 60° angles = natural hex grid directions
- Need conversion between hex-local coords and world space coords

**Brownian Motion:**
- Position: Add small random vector each frame
- Rotation: Add small random angle each frame  
- Damping factor to prevent runaway motion
- Configurable "temperature" = motion intensity

**Collision/Interaction:**
- Molecules need bounding boxes for machine interactions
- Hex-aligned hitboxes?
- When does a machine "grab" a floating molecule?

### Questions to Resolve

1. **Scale:** How big should molecules be relative to machines?
2. **Speed:** How fast should Brownian motion be? Too fast = unplayable, too slow = boring
3. **DNA Bending:** Should DNA double-strand be allowed to bend, or only single strands?
4. **Molecule Spawning:** Where do input molecules come from? Edge of screen? Specific spawn points?
5. **Machine Interaction:** Do machines "lock" molecules in place, or do they continue drifting?
6. **Visual Clarity:** How to make hex structure clear while molecules are rotating/moving?

### Next Steps

- Decide on answers to open questions
- Prototype hex grid rendering system
- Implement Brownian motion physics
- Build molecule class system (DNA, RNA, Protein)
- Test interaction with v1's machine placement system

### Future Ideas (Post-v2)

- RNA secondary structure (hairpin loops, etc.)
- Protein folding mechanics
- More complex DNA structures (supercoiling?)
- Molecule-molecule interactions (hybridization, binding)
- Multiple molecules on screen simultaneously

---

**Status:** Design phase - awaiting additional ideas before implementation

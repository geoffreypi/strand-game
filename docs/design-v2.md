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
- One hex gap between strands
- Gap contains visual symbol showing linkage/bonding
- Each strand mostly straight, occasional 60° corners allowed
- Both strands conform to hex grid alignment

**Visual Representation:**
```
A ═══ T --- A ═══ T --- G ═══ C
     ║           ║           ║
T ═══ A --- T ═══ A --- C ═══ G

Where:
- Letters = nucleotides on hex grid
- ═══ = hydrogen bonds (linkage symbols)
- --- = backbone connections
- ║ = visual indicator of pairing
```

**Constraints:**
- Strands maintain one hex spacing
- Complementary pairing enforced (A-T, G-C)
- Can have 60° bends while maintaining structure
- Both strands must remain on hex grid

#### 4. RNA Structure
- Single strand only
- Sequence of A, C, G, U on hex grid
- Straight segments with 60°/120° turns
- Can fold back on itself (for later: secondary structure?)

**Visual Representation:**
```
A --- C --- G --- U
         \
          A --- C --- U
```

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

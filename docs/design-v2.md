# Design Document - Prototype v2
## Major Rework: Brownian Motion & Hex-Based Molecules

### Core Design Philosophy

**Sandbox Mechanics Over Scripted Puzzles**
- Inspired by **Shapez**, **Factorio**, and **Opus Magnum**
- Focus on creating robust, interesting mechanics
- Let complexity and challenges emerge naturally from the mechanics
- Players discover their own solutions and optimizations
- Open-ended goals rather than prescribed solutions

**The Meta-Loop: Proteins ARE the Machines**
- **Central concept:** The proteins produced by translation fold into specific shapes
- **These folded proteins become the functional machines** that enable:
  - Transcription (RNA polymerase)
  - Translation (ribosomes)
  - Modifications (enzymes, chaperones)
  - All other biological processes
- **Bootstrap problem:** How do you make the first proteins without proteins?
- **Self-sustaining system:** Build proteins that build better proteins
- **Emergent complexity:** The "machines" in your factory are the products of your factory

**Key Inspirations:**
- **Shapez**: Simple building blocks → complex emergent systems
- **Factorio**: Logistics, throughput optimization, scaling production, **recursive production chains**
- **Opus Magnum**: Spatial programming, elegant mechanical solutions

**Design Approach:**
1. Build solid core mechanics (molecular motion, protein folding, mechanical interactions)
2. Provide tools and constraints
3. Let players experiment and optimize
4. Challenges arise from the system itself, not artificial puzzle constraints

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
5'-A-C-G-U-A-3'  (straight segment)

Or with 60° bend:
5'-A-C-G
        \
         U
          \
           A-3'
```

**Constraints:**
- Single continuous strand
- No linkage symbols (no double helix partner)
- 60° turns allowed between adjacent nucleotides
- 120° turns NOT allowed (would be too sharp/unrealistic)
- Must remain on hex grid
- Directional labels: 5' and 3' at ends

#### 5. Protein Structure & Folding

**Linear Structure (unfolded):**
- Single strand (like RNA)
- Sequence of amino acids (not nucleotides)
- Each amino acid occupies one hex
- **Can bend at both 60° AND 120° angles** (more flexible than RNA)
- Different visual representation per amino acid type
- Directional labels: N-terminus and C-terminus at ends

**Folding Mechanics:**
- Proteins fold into specific 2D shapes based on amino acid sequence
- **No self-overlap allowed** (2D constraint)
- Folded shape determines protein function
- Different folds = different mechanical properties
- Shape recognition: proteins interact based on complementary shapes

**Functional Proteins (Folded):**
- **Enzymes:** Catalyze specific reactions (e.g., join molecules, split molecules)
- **RNA Polymerase:** Enables transcription (DNA → RNA)
- **Ribosomes:** Enables translation (RNA → Protein)
- **Chaperones:** Assist in folding other proteins
- **Modifiers:** Add/remove chemical groups (phosphorylation, etc.)

**Visual Representation:**
```
Unfolded:
N-Gly-Ala-Val-Leu-Ile-C  (straight segment)

Folded (example):
    Gly-Ala
   /       \
  N         Val
             \
            Leu-Ile-C

Shape determines function!
```

**Constraints:**
- Single continuous chain
- Both 60° and 120° turns allowed (unlike RNA which only allows 60°)
- Must remain on hex grid
- **Cannot self-overlap** (2D game constraint)
- Greater structural flexibility than RNA/DNA

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

### Questions to Resolve (Mechanics-Focused)

**Molecular Physics:**
1. **Brownian motion speed:** How fast should molecules drift? Balance between dynamic and playable
2. **Collision behavior:** What happens when molecules bump into each other?
3. **Molecule spawning:** Continuous flow? Player-controlled? Resource management?

**Protein Folding:**
1. **Folding mechanism:** Automatic based on sequence? Player-controlled? Energy minimization?
2. **Folding rules:** What determines which amino acid sequences fold into which shapes?
3. **No self-overlap:** How do we enforce and visualize this constraint?
4. **Stability:** Can proteins unfold? Do they need to maintain shape?
5. **Shape recognition:** How do proteins recognize and interact with complementary shapes?

**Protein-as-Machine Mechanics:**
1. **Initial bootstrap:** What machines does the player start with? Pre-made proteins? Simple manual tools?
2. **Interaction range:** How do folded proteins detect and act on molecules?
3. **Catalysis:** How do enzyme proteins speed up or enable reactions?
4. **Specificity:** How do we ensure proteins only interact with correct targets?
5. **Degradation:** Do proteins wear out? Need to be replaced?

**Transcription/Translation Mechanics:**
1. **RNA Polymerase (protein):** How does it mechanically unzip DNA and produce RNA?
2. **Ribosome (protein complex):** How does it read mRNA codons and produce proteins?
3. **Strand separation:** How does DNA unzip during transcription?
4. **Complementary pairing:** Automatic or requires specific protein catalysis?
5. **Directional constraints:** How do 3'→5' / 5'→3' directions affect mechanics?
6. **Codon reading:** Real genetic code or simplified?

**Throughput & Optimization:**
1. **Multiple molecules:** How many can be in flight simultaneously?
2. **Timing challenges:** Molecules arriving at different times
3. **Bottlenecks:** What creates interesting optimization problems?
4. **Scaling:** How does complexity scale with production requirements?
5. **Recursive production:** How to build proteins that build better proteins?

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

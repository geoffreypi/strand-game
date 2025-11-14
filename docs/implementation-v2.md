# Implementation Document - Prototype v2
## Data Structures and Architecture

### Overview
This document details the data structures, algorithms, and technical implementation for the protein folding game prototype v2.

---

## Core Data Structures

### 1. Hex Grid Coordinate System

**Axial Coordinates (q, r):**
- Standard hex grid representation
- q = column, r = row
- Supports 6 directional neighbors efficiently
- Conversion to/from world space (x, y) for rendering

```javascript
class HexCoord {
    constructor(q, r) {
        this.q = q;  // column
        this.r = r;  // row
    }
    
    // Cube coordinates for easier calculations
    get s() { return -this.q - this.r; }
    
    // 6 hex neighbors
    neighbors() {
        return [
            new HexCoord(this.q + 1, this.r),
            new HexCoord(this.q + 1, this.r - 1),
            new HexCoord(this.q, this.r - 1),
            new HexCoord(this.q - 1, this.r),
            new HexCoord(this.q - 1, this.r + 1),
            new HexCoord(this.q, this.r + 1)
        ];
    }
    
    // Convert to world space
    toWorld(hexSize) {
        const x = hexSize * Math.sqrt(3) * (this.q + this.r / 2);
        const y = hexSize * (3/2) * this.r;
        return { x, y };
    }
}
```

---

### 2. Nucleotide (Base Unit)

**Properties:**
- Type: 'A', 'C', 'G', 'T' (DNA) or 'A', 'C', 'G', 'U' (RNA)
- Position: HexCoord (local to molecule)
- Color: Visual representation

```javascript
class Nucleotide {
    constructor(type, hexCoord) {
        this.type = type;        // 'A', 'C', 'G', 'T', 'U'
        this.hexCoord = hexCoord; // Position in molecule's local hex grid
    }
    
    getComplement() {
        const complements = {
            'A': 'T', 'T': 'A',
            'G': 'C', 'C': 'G',
            'U': 'A'  // RNA complement
        };
        return complements[this.type];
    }
}
```

---

### 3. Amino Acid (Protein Building Block)

**Properties:**
- Type: S, E60, C60, E120, C120, BA, BC, BG, BT, BU, CRL, RPF, PBF
- Position: HexCoord (local to protein)
- Folding preference: bend angle and direction

```javascript
class AminoAcid {
    constructor(type, hexCoord) {
        this.type = type;         // 'S', 'E60', 'C60', etc.
        this.hexCoord = hexCoord; // Position in protein's local hex grid
    }
    
    getFoldingPreference() {
        const preferences = {
            'S': { angle: 0, direction: null },
            'E60': { angle: 60, direction: 'expand' },
            'C60': { angle: 60, direction: 'compact' },
            'E120': { angle: 120, direction: 'expand' },
            'C120': { angle: 120, direction: 'compact' }
        };
        return preferences[this.type] || { angle: 0, direction: null };
    }
    
    getBindingTarget() {
        const bindings = {
            'BA': 'A', 'BC': 'C', 'BG': 'G', 'BT': 'T', 'BU': 'U'
        };
        return bindings[this.type];
    }
    
    isCatalytic() {
        return this.type === 'RPF' || this.type === 'PBF';
    }
}
```

---

### 4. Molecule (Base Class)

**Common properties for DNA, RNA, Protein:**
- World position: { x, y }
- Rotation: angle in radians
- Velocity: { vx, vy } (Brownian motion)
- Angular velocity: omega (rotational Brownian motion)
- Temperature: current heat
- Bound: boolean (is it bound to another molecule?)
- BoundTo: reference to other molecule(s)

```javascript
class Molecule {
    constructor() {
        this.position = { x: 0, y: 0 };
        this.rotation = 0;
        this.velocity = { vx: 0, vy: 0 };
        this.angularVelocity = 0;
        this.bound = false;
        this.boundTo = null;
        this.components = []; // Nucleotides or AminoAcids
    }
    
    // Brownian motion update
    updateBrownianMotion(deltaTime, diffusionRate) {
        // Add random walk
        const randomX = (Math.random() - 0.5) * diffusionRate;
        const randomY = (Math.random() - 0.5) * diffusionRate;
        const randomOmega = (Math.random() - 0.5) * diffusionRate * 0.1;
        
        this.velocity.vx += randomX;
        this.velocity.vy += randomY;
        this.angularVelocity += randomOmega;
        
        // Apply damping
        const damping = 0.95;
        this.velocity.vx *= damping;
        this.velocity.vy *= damping;
        this.angularVelocity *= damping;
        
        // Update position
        this.position.x += this.velocity.vx * deltaTime;
        this.position.y += this.velocity.vy * deltaTime;
        this.rotation += this.angularVelocity * deltaTime;
    }
    
    // Get world position of a specific component
    getComponentWorldPosition(componentIndex) {
        const component = this.components[componentIndex];
        const localWorld = component.hexCoord.toWorld(HEX_SIZE);
        
        // Rotate and translate to world space
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        
        return {
            x: this.position.x + localWorld.x * cos - localWorld.y * sin,
            y: this.position.y + localWorld.x * sin + localWorld.y * cos
        };
    }
}
```

---

### 5. DNA Molecule

**Structure:**
- Two strands (top and bottom)
- Linkages between strands
- 3' to 5' directionality

```javascript
class DNA extends Molecule {
    constructor(topSequence, bottomSequence) {
        super();
        this.topStrand = [];
        this.bottomStrand = [];
        this.linkages = []; // X positions between strands
        
        // Build strands
        for (let i = 0; i < topSequence.length; i++) {
            // Top strand: row 0
            this.topStrand.push(new Nucleotide(topSequence[i], new HexCoord(i, 0)));
            
            // Bottom strand: row 2 (row 1 is linkages)
            this.bottomStrand.push(new Nucleotide(bottomSequence[i], new HexCoord(i, 2)));
            
            // Linkage: row 1, between bases
            if (i < topSequence.length - 1) {
                this.linkages.push(new HexCoord(i, 1));
            }
        }
        
        this.components = [...this.topStrand, ...this.bottomStrand];
        this.direction = { top: "3'->5'", bottom: "5'->3'" };
    }
}
```

---

### 6. RNA Molecule

**Structure:**
- Single strand
- Can have bends (60° only)
- 5' to 3' directionality

```javascript
class RNA extends Molecule {
    constructor(sequence) {
        super();
        this.strand = [];
        
        // Build strand (straight initially)
        for (let i = 0; i < sequence.length; i++) {
            this.strand.push(new Nucleotide(sequence[i], new HexCoord(i, 0)));
        }
        
        this.components = this.strand;
        this.direction = "5'->3'";
    }
    
    // Apply bend at position (for future folding mechanics)
    applyBend(position, angle) {
        // TODO: Recalculate hex positions after position
    }
}
```

---

### 7. Protein Molecule

**Structure:**
- Chain of amino acids
- Folding state (unfolded vs folded)
- Can have complex 2D shape

```javascript
class Protein extends Molecule {
    constructor(aminoAcidSequence) {
        super();
        this.chain = [];
        this.folded = false;
        
        // Build chain (straight initially)
        for (let i = 0; i < aminoAcidSequence.length; i++) {
            this.chain.push(new AminoAcid(aminoAcidSequence[i], new HexCoord(i, 0)));
        }
        
        this.components = this.chain;
        this.direction = "N->C";
    }
    
    // Fold protein based on amino acid preferences
    fold() {
        // TODO: Complex folding algorithm
        // - Calculate moment of inertia
        // - Apply bending forces
        // - Resolve conflicts
        // - Ensure no self-overlap
        this.folded = true;
    }
    
    // Check if protein can catalyze reaction
    getCatalyticSites() {
        return this.chain
            .map((aa, index) => ({ aa, index }))
            .filter(({ aa }) => aa.isCatalytic());
    }
}
```

---

### 8. World State

**Global state management:**
- All molecules in the world
- Collision/binding detection

```javascript
class World {
    constructor() {
        this.molecules = [];
        this.time = 0;
    }
    
    addMolecule(molecule) {
        this.molecules.push(molecule);
    }
    
    update(deltaTime) {
        // Update all molecules
        for (const molecule of this.molecules) {
            if (!molecule.bound) {
                molecule.updateBrownianMotion(deltaTime, BROWNIAN_DIFFUSION_RATE);
            }
        }
        
        // Check for binding opportunities
        this.checkBindings();
        
        // Process catalytic reactions (simplified - no ATP requirement yet)
        this.processCatalysis();
        
        this.time += deltaTime;
    }
    
    checkBindings() {
        // TODO: Spatial hash grid for efficient collision detection
        // Check shape complementarity between nearby molecules
    }
    
    processCatalysis() {
        // TODO: Check all catalytic sites (RPF, PBF)
        // Execute reactions if conditions are met
    }
}
```

---

## Questions for Implementation

### Immediate Decisions Needed:
1. **Folding algorithm:** Physics simulation or rule-based resolution?
2. **Shape matching:** How to efficiently compute shape complementarity?
3. **Spatial partitioning:** Quad-tree? Spatial hash? For collision detection?
4. **Rendering:** Canvas 2D or WebGL for performance?
5. **Binding mechanics:** Force/torque application - how strong? How fast?

### Future Considerations (defer for now):
- Temperature/heat simulation
- ATP energy system
- Serialization: How to save/load world state?
- Genetic code: Real codon table or simplified?
- Performance: How many molecules can we handle simultaneously?
- UI: How to display molecule properties

---

## Next Steps
1. Implement basic hex grid system
2. Create molecule rendering
3. Add Brownian motion
4. Test shape-complementarity detection
5. Implement simple folding
6. Add catalytic reactions (RPF/PBF)

# Implementation Document - Prototype v2 (ECS Architecture)
## Entity-Component-System Design

### Overview
This document details the Entity-Component-System architecture for the protein folding game prototype v2. ECS provides excellent performance and flexibility for our molecular simulation.

---

## ECS Architecture Overview

**Entities:** Unique IDs representing game objects (DNA molecules, RNA molecules, proteins)

**Components:** Pure data containers with no logic (Position, Velocity, Sequence, etc.)

**Systems:** Logic processors that operate on entities with specific component combinations

### Benefits for our game:
- Clean separation of data and logic
- Easy to add new molecule types or behaviors  
- Cache-friendly iteration over components
- Natural parallelization opportunities
- Easy serialization for save/load

---

## Components (Data Only)

### Core Transform & Motion

#### Transform
```javascript
class Transform {
    x = 0;
    y = 0;
    rotation = 0; // radians
}
```

#### Velocity
```javascript
class Velocity {
    vx = 0;
    vy = 0;
    omega = 0; // angular velocity
}
```

#### BrownianMotion (tag)
```javascript
class BrownianMotion {
    diffusionRate = 1.0;
}
```

---

### Molecular Structure

#### HexStructure
```javascript
class HexStructure {
    hexes = []; // Array of { q, r, type, data }
}
```

#### DNAStrand
```javascript
class DNAStrand {
    topSequence = "";      // "ACGT"
    bottomSequence = "";   // "TGCA"
    topDirection = "3'->5'";
    bottomDirection = "5'->3'";
}
```

#### RNAStrand
```javascript
class RNAStrand {
    sequence = "";  // "ACGU"
    direction = "5'->3'";
}
```

#### ProteinChain
```javascript
class ProteinChain {
    sequence = "";  // "STR-L60-BTA-RPF"
    direction = "N->C";
    folded = false;
}
```

---

### Binding & Interaction

#### Binding
```javascript
class Binding {
    boundTo = [];  // Array of { entityId, attachmentPoints }
    locked = false;
}
```

#### ShapeSignature
```javascript
class ShapeSignature {
    signature = null;  // Computed shape for matching
    bindingSites = []; // Potential binding locations
    dirty = true;      // Needs recomputation?
}
```

#### CatalyticSite
```javascript
class CatalyticSite {
    type = "";         // 'RPF' or 'PBF'
    hexCoords = [];    // Positions of catalytic amino acids
    active = true;
}
```

---

## Systems (Logic Only)

### BrownianMotionSystem
Updates velocity and position for free-floating molecules

```javascript
class BrownianMotionSystem {
    update(world, deltaTime) {
        // Query entities with Transform + Velocity + BrownianMotion
        const entities = world.query([Transform, Velocity, BrownianMotion]);
        
        for (const entity of entities) {
            const transform = world.get(entity, Transform);
            const velocity = world.get(entity, Velocity);
            const brownian = world.get(entity, BrownianMotion);
            
            // Skip if bound
            const binding = world.get(entity, Binding);
            if (binding?.locked) continue;
            
            // Add random walk
            const rate = brownian.diffusionRate;
            velocity.vx += (Math.random() - 0.5) * rate;
            velocity.vy += (Math.random() - 0.5) * rate;
            velocity.omega += (Math.random() - 0.5) * rate * 0.1;
            
            // Apply damping
            velocity.vx *= 0.95;
            velocity.vy *= 0.95;
            velocity.omega *= 0.95;
            
            // Update position
            transform.x += velocity.vx * deltaTime;
            transform.y += velocity.vy * deltaTime;
            transform.rotation += velocity.omega * deltaTime;
        }
    }
}
```

---

### ShapeMatchingSystem
Detects potential bindings based on shape complementarity

```javascript
class ShapeMatchingSystem {
    constructor() {
        this.spatialGrid = new Map();
    }
    
    update(world) {
        // Rebuild spatial grid for efficiency
        this.buildSpatialGrid(world);
        
        const entities = world.query([Transform, HexStructure, ShapeSignature]);
        
        for (const entity of entities) {
            const neighbors = this.getNearbyEntities(world, entity);
            
            for (const other of neighbors) {
                if (entity >= other) continue; // Avoid duplicate checks
                
                const match = this.computeShapeMatch(world, entity, other);
                
                if (match.score > BINDING_THRESHOLD) {
                    // Apply attractive force/torque
                    this.applyBindingForce(world, entity, other, match);
                    
                    // Create binding if close and aligned
                    if (match.distance < BINDING_DISTANCE && match.aligned) {
                        this.createBinding(world, entity, other, match);
                    }
                }
            }
        }
    }
    
    computeShapeMatch(world, entity1, entity2) {
        // TODO: Implement shape complementarity algorithm
        // Consider:
        // - Spatial overlap of hex structures
        // - Type compatibility (DNA-binding amino acids match DNA bases)
        // - Orientation alignment
        return { score: 0, distance: Infinity, aligned: false };
    }
    
    applyBindingForce(world, entity1, entity2, match) {
        const vel1 = world.get(entity1, Velocity);
        const vel2 = world.get(entity2, Velocity);
        const trans1 = world.get(entity1, Transform);
        const trans2 = world.get(entity2, Transform);
        
        // Calculate force direction
        const dx = trans2.x - trans1.x;
        const dy = trans2.y - trans1.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Apply proportional to match score
        const forceMag = match.score * BINDING_FORCE_STRENGTH;
        vel1.vx += (dx / dist) * forceMag;
        vel1.vy += (dy / dist) * forceMag;
        vel2.vx -= (dx / dist) * forceMag;
        vel2.vy -= (dy / dist) * forceMag;
        
        // Apply torque to align rotations
        // TODO: Calculate and apply rotational alignment
    }
    
    createBinding(world, entity1, entity2, match) {
        let binding1 = world.get(entity1, Binding);
        if (!binding1) {
            binding1 = new Binding();
            world.add(entity1, binding1);
        }
        
        let binding2 = world.get(entity2, Binding);
        if (!binding2) {
            binding2 = new Binding();
            world.add(entity2, binding2);
        }
        
        binding1.boundTo.push({ entityId: entity2, ...match.attachments });
        binding2.boundTo.push({ entityId: entity1, ...match.attachments });
        binding1.locked = true;
        binding2.locked = true;
    }
}
```

---

### TranscriptionSystem
Processes RPF catalytic sites (DNA → RNA)

```javascript
class TranscriptionSystem {
    update(world) {
        const polymerases = world.query([
            Transform,
            HexStructure,
            ProteinChain,
            CatalyticSite
        ]);
        
        for (const polymerase of polymerases) {
            const site = world.get(polymerase, CatalyticSite);
            if (site.type !== 'RPF') continue;
            
            // Check if bound to DNA
            const binding = world.get(polymerase, Binding);
            if (!binding || !binding.locked) continue;
            
            const boundDNA = this.findBoundDNA(world, binding);
            if (!boundDNA) continue;
            
            // Check catalytic site conditions
            if (this.canTranscribe(world, polymerase, boundDNA, site)) {
                this.addRNANucleotide(world, polymerase, boundDNA, site);
            }
        }
    }
    
    canTranscribe(world, polymerase, dna, site) {
        // Check:
        // 1. RPF adjacent to DNA codon(s)
        // 2. No RNA codons blocking
        // 3. Space available for new RNA codon
        return true; // TODO: Implement checks
    }
    
    addRNANucleotide(world, polymerase, dna, site) {
        // Read adjacent DNA codon
        // Create complementary RNA nucleotide
        // Place in first open hex clockwise from DNA
        // Attach to existing RNA chain if present
    }
}
```

---

### TranslationSystem  
Processes PBF catalytic sites (RNA → Protein)

```javascript
class TranslationSystem {
    update(world) {
        const ribosomes = world.query([
            Transform,
            HexStructure,
            ProteinChain,
            CatalyticSite
        ]);
        
        for (const ribosome of ribosomes) {
            const site = world.get(ribosome, CatalyticSite);
            if (site.type !== 'PBF') continue;
            
            // Check if bound to RNA
            const binding = world.get(ribosome, Binding);
            if (!binding || !binding.locked) continue;
            
            const boundRNA = this.findBoundRNA(world, binding);
            if (!boundRNA) continue;
            
            // Check catalytic site conditions
            if (this.canTranslate(world, ribosome, boundRNA, site)) {
                this.addAminoAcid(world, ribosome, boundRNA, site);
            }
        }
    }
    
    canTranslate(world, ribosome, rna, site) {
        // Check:
        // 1. PBF adjacent to RNA codon(s)
        // 2. Other side adjacent to nothing or growing protein chain
        // 3. Space available for new amino acid
        return true; // TODO: Implement checks
    }
    
    addAminoAcid(world, ribosome, rna, site) {
        // Read adjacent RNA codon
        // Translate to amino acid using genetic code
        // Add to growing protein chain
    }
}
```

---

### FoldingSystem
Applies folding forces to unfolded proteins

```javascript
class FoldingSystem {
    update(world) {
        const proteins = world.query([HexStructure, ProteinChain]);
        
        for (const protein of proteins) {
            const chain = world.get(protein, ProteinChain);
            if (chain.folded) continue;
            
            const structure = world.get(protein, HexStructure);
            
            // Apply folding based on amino acid preferences
            const folded = this.applyFoldingForces(structure, chain);
            
            if (folded) {
                chain.folded = true;
                // Mark ShapeSignature as dirty for recomputation
                const sig = world.get(protein, ShapeSignature);
                if (sig) sig.dirty = true;
            }
        }
    }
    
    applyFoldingForces(structure, chain) {
        // Parse amino acid sequence
        // For each amino acid with folding preference (L60, R60, L12, R12):
        //   - Calculate moment of inertia of current structure
        //   - Apply bend in direction that satisfies preference
        //   - Check for self-overlap (reject if overlaps)
        //   - Resolve conflicts between contradictory preferences
        // Return true if stable fold achieved
        return false; // TODO: Implement
    }
}
```

---

### RenderSystem
Draws all entities to canvas

```javascript
class RenderSystem {
    render(world, ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Draw background hex grid
        this.drawBackgroundGrid(ctx);
        
        // Draw all molecules
        const entities = world.query([Transform, HexStructure]);
        
        for (const entity of entities) {
            this.renderMolecule(world, entity, ctx);
        }
    }
    
    renderMolecule(world, entity, ctx) {
        const transform = world.get(entity, Transform);
        const structure = world.get(entity, HexStructure);
        
        // Get world positions of all hexes
        const worldHexes = this.getWorldHexPositions(structure, transform);
        
        // Draw hexes
        for (const hex of worldHexes) {
            this.drawHex(ctx, hex.worldX, hex.worldY, hex.type, hex.data);
        }
        
        // Special rendering for DNA linkages
        const dna = world.get(entity, DNAStrand);
        if (dna) {
            this.drawDNALinkages(ctx, worldHexes);
        }
        
        // Render directional labels
        this.drawDirectionalLabels(ctx, worldHexes, dna || world.get(entity, RNAStrand) || world.get(entity, ProteinChain));
    }
    
    getWorldHexPositions(structure, transform) {
        const hexSize = 40;
        return structure.hexes.map(hex => {
            // Axial to local cartesian
            const localX = hexSize * Math.sqrt(3) * (hex.q + hex.r / 2);
            const localY = hexSize * (3/2) * hex.r;
            
            // Rotate
            const cos = Math.cos(transform.rotation);
            const sin = Math.sin(transform.rotation);
            
            // Translate
            return {
                worldX: transform.x + localX * cos - localY * sin,
                worldY: transform.y + localX * sin + localY * cos,
                ...hex
            };
        });
    }
    
    drawHex(ctx, x, y, type, data) {
        // Draw hexagon at (x, y)
        // Color based on type (nucleotide type or amino acid type)
        // Draw label in center
    }
}
```

---

## World (ECS Container)

```javascript
class World {
    constructor() {
        this.nextEntityId = 0;
        this.entities = new Set();
        this.components = new Map(); // Map<ComponentType, Map<EntityId, Component>>
        this.systems = [];
    }
    
    // Entity management
    createEntity() {
        const id = this.nextEntityId++;
        this.entities.add(id);
        return id;
    }
    
    destroyEntity(entityId) {
        // Remove from all component maps
        for (const [type, map] of this.components) {
            map.delete(entityId);
        }
        this.entities.delete(entityId);
    }
    
    // Component management
    add(entityId, component) {
        const type = component.constructor;
        if (!this.components.has(type)) {
            this.components.set(type, new Map());
        }
        this.components.get(type).set(entityId, component);
    }
    
    get(entityId, ComponentType) {
        return this.components.get(ComponentType)?.get(entityId);
    }
    
    remove(entityId, ComponentType) {
        this.components.get(ComponentType)?.delete(entityId);
    }
    
    has(entityId, ComponentType) {
        return this.components.get(ComponentType)?.has(entityId) || false;
    }
    
    // Query entities with specific components
    query(componentTypes) {
        const entities = [];
        for (const entityId of this.entities) {
            if (componentTypes.every(type => this.has(entityId, type))) {
                entities.push(entityId);
            }
        }
        return entities;
    }
    
    // System management
    addSystem(system) {
        this.systems.push(system);
    }
    
    // Main update loop
    update(deltaTime) {
        for (const system of this.systems) {
            system.update(this, deltaTime);
        }
    }
}
```

---

## Factory Functions

Helper functions to create common entities

```javascript
function createDNA(world, x, y, topSeq, bottomSeq) {
    const entity = world.createEntity();
    
    world.add(entity, new Transform(x, y, 0));
    world.add(entity, new Velocity());
    world.add(entity, new BrownianMotion(0.5));
    world.add(entity, new DNAStrand(topSeq, bottomSeq));
    
    const structure = new HexStructure();
    // Top strand (row 0)
    for (let i = 0; i < topSeq.length; i++) {
        structure.hexes.push({ q: i, r: 0, type: topSeq[i], data: { strand: 'top' } });
    }
    // Linkages (row 1)
    for (let i = 0; i < topSeq.length - 1; i++) {
        structure.hexes.push({ q: i, r: 1, type: 'X', data: { linkage: true } });
    }
    // Bottom strand (row 2)
    for (let i = 0; i < bottomSeq.length; i++) {
        structure.hexes.push({ q: i, r: 2, type: bottomSeq[i], data: { strand: 'bottom' } });
    }
    world.add(entity, structure);
    
    world.add(entity, new ShapeSignature());
    
    return entity;
}

function createRNA(world, x, y, sequence) {
    const entity = world.createEntity();
    
    world.add(entity, new Transform(x, y, 0));
    world.add(entity, new Velocity());
    world.add(entity, new BrownianMotion(0.7));
    world.add(entity, new RNAStrand(sequence));
    
    const structure = new HexStructure();
    for (let i = 0; i < sequence.length; i++) {
        structure.hexes.push({ q: i, r: 0, type: sequence[i], data: {} });
    }
    world.add(entity, structure);
    
    world.add(entity, new ShapeSignature());
    
    return entity;
}

function createProtein(world, x, y, aminoAcidSeq) {
    const entity = world.createEntity();
    
    world.add(entity, new Transform(x, y, 0));
    world.add(entity, new Velocity());
    world.add(entity, new BrownianMotion(0.3));
    world.add(entity, new ProteinChain(aminoAcidSeq));
    
    const structure = new HexStructure();
    const aaArray = aminoAcidSeq.split('-');
    for (let i = 0; i < aaArray.length; i++) {
        structure.hexes.push({ q: i, r: 0, type: aaArray[i], data: {} });
    }
    world.add(entity, structure);
    
    world.add(entity, new ShapeSignature());
    
    // Check for catalytic sites
    const catalyticTypes = ['RPF', 'PBF'];
    const sites = aaArray.map((aa, i) => ({ aa, i }))
                        .filter(({ aa }) => catalyticTypes.includes(aa));
    if (sites.length > 0) {
        const site = new CatalyticSite();
        site.type = sites[0].aa;
        site.hexCoords = sites.map(s => ({ q: s.i, r: 0 }));
        world.add(entity, site);
    }
    
    return entity;
}
```

---

## Usage Example

```javascript
// Initialize
const world = new World();
world.addSystem(new BrownianMotionSystem());
world.addSystem(new ShapeMatchingSystem());
world.addSystem(new TranscriptionSystem());
world.addSystem(new TranslationSystem());
world.addSystem(new FoldingSystem());

const renderSystem = new RenderSystem();

// Create starting molecules
const dna1 = createDNA(world, 200, 200, "ACGT", "TGCA");
const polymerase = createProtein(world, 400, 200, "STR-L60-BTA-BTG-RPF-CRL-STR");
const ribosome = createProtein(world, 600, 200, "L60-L60-PBF-R60-FLX-FLX-FLX");

// Game loop
function gameLoop(timestamp) {
    const deltaTime = 0.016; // ~60 FPS
    
    world.update(deltaTime);
    renderSystem.render(world, ctx);
    
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
```

---

## Next Steps

1. ✅ Define ECS architecture
2. ⏭️ Implement basic hex rendering
3. ⏭️ Add Brownian motion
4. ⏭️ Implement shape matching algorithm
5. ⏭️ Build folding system
6. ⏭️ Add catalytic reactions
7. ⏭️ Test with simple scenarios

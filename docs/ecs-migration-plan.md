# ECS Migration Plan

## Overview
This document outlines a detailed, step-by-step plan to migrate STRAND from its current hybrid OOP/ECS architecture to a pure ECS (Entity-Component-System) design for optimal performance at scale.

## Current Architecture Assessment

### What We Have Now
- **Hybrid OOP/ECS**: `Molecule` and `Complex` classes with some ECS patterns
- **Data Location**: Position/state data in residue objects, scattered across Complex
- **Processing**: Methods on Complex (OOP style) with some system-like functions
- **Memory Layout**: Array of Structures (AoS) - each residue is an object

### Target Architecture
- **Pure ECS**: World with component arrays and system functions
- **Data Location**: All data in typed arrays organized by component type
- **Processing**: Pure functions operating on component arrays
- **Memory Layout**: Structure of Arrays (SoA) - contiguous typed arrays

## Migration Strategy: Gradual Refactoring

We'll use a gradual approach that keeps everything working at each step, allowing us to test incrementally and catch issues early.

---

## Phase 1: Foundation (Steps 1-4)

### Step 1: Create ECS Core Infrastructure
**Goal**: Establish the foundational ECS classes without changing existing code.

**Tasks**:
- Create `src/ecs/World.js` with entity/component management
- Create `src/ecs/components.js` defining all component types
- Create `src/ecs/queries.js` for efficient component queries
- No integration with existing code yet - purely additive

**New Files**:
```
src/ecs/
  ├── World.js         (Entity manager, component storage)
  ├── components.js    (Component type definitions)
  └── queries.js       (Query helpers for systems)
```

**Component Types to Define**:
- `PositionComponent`: q, r, moleculeId
- `ResidueComponent`: type, foldState, index
- `SignalComponent`: on, source, strength
- `BondComponent`: targetEntity, bondType (+/-)
- `EnergyComponent`: atp, adp
- `MoleculeMetaComponent`: id, sequence, type

**Testing**:
- Unit tests for World entity/component operations
- Verify component storage and retrieval
- No existing tests should break (no integration yet)

**Estimated Effort**: 1-2 days

---

### Step 2: Dual Data Storage (Compatibility Layer)
**Goal**: Maintain both old and new data structures in sync.

**Tasks**:
- Modify `Complex` constructor to create a `World` instance
- When residues are added, also add entities/components to World
- Add sync methods: `syncToWorld()` and `syncFromWorld()`
- All existing code continues using old data structures

**Changes**:
```javascript
// In Complex.js
class Complex {
  constructor() {
    this.molecules = [];
    this.world = new World();  // NEW
    // ... existing code
  }

  addMolecule(molecule, position) {
    // ... existing code adds to this.molecules

    // NEW: Also add to ECS World
    this._syncMoleculeToWorld(molecule, position);
  }

  _syncMoleculeToWorld(molecule, position) {
    // Create entity for each residue
    // Add PositionComponent, ResidueComponent, etc.
  }
}
```

**Testing**:
- Verify data stays in sync after operations
- All 332 existing tests should still pass
- Add sync verification tests

**Estimated Effort**: 2-3 days

---

### Step 3: Convert Signal System to Pure ECS
**Goal**: Make `computeSignals()` operate on ECS data.

**Tasks**:
- Create `src/ecs/systems/signalSystem.js`
- Rewrite signal logic to operate on component arrays
- Keep old `signal.js` for comparison
- Complex.computeSignals() calls new system but syncs data

**Before**:
```javascript
// Old: signal.js
function computeOneStep(residues, ...) {
  for (const residue of residues) {
    if (residue.type === 'SIG') {
      // Process...
    }
  }
}
```

**After**:
```javascript
// New: ecs/systems/signalSystem.js
export function signalSystem(world, config) {
  const positions = world.getComponents('Position');
  const residues = world.getComponents('Residue');
  const signals = world.getComponents('Signal');

  // Query all SIG residues
  const sigEntities = world.query(['Residue', 'Position', 'Signal'])
    .filter((_, i) => residues[i].type === 'SIG');

  // Process in tight loop over contiguous arrays
  for (const entity of sigEntities) {
    const signal = signals[entity];
    // Process...
  }
}
```

**Testing**:
- Run all signal.test.js tests against new system
- Compare results with old system
- Performance benchmark: measure improvement

**Estimated Effort**: 3-4 days

---

### Step 4: Convert Energy System to Pure ECS
**Goal**: Make energy system operate on ECS data.

**Tasks**:
- Create `src/ecs/systems/energySystem.js`
- Rewrite ATP/ADP logic for component arrays
- Complex.processEnergy() calls new system

**Testing**:
- Run all energy.test.js tests
- Verify ATP movement and consumption
- Performance benchmark

**Estimated Effort**: 2-3 days

---

## Phase 2: System Migration (Steps 5-7)

### Step 5: Create Bonding System
**Goal**: Handle bond creation/breaking in ECS.

**Tasks**:
- Create `src/ecs/systems/bondingSystem.js`
- Migrate bond formation logic (BTx-DNA, ATR-ATP, protein-protein)
- Store bonds as BondComponent pairs

**New Capabilities**:
```javascript
// Efficient bond queries
const bondsToMolecule = world.queryBonds({ target: moleculeId });
const proteinDNABonds = world.queryBonds({
  type: '+',
  sourceType: 'BTx',
  targetType: 'DNA'
});
```

**Testing**:
- Test bond formation/breaking
- Verify complex stability checks
- Test bond queries

**Estimated Effort**: 2-3 days

---

### Step 6: Create Movement System (PSH/RPF)
**Goal**: Handle spatial transformations in ECS.

**Tasks**:
- Create `src/ecs/systems/movementSystem.js`
- Implement PSH pushing logic
- Implement RPF sliding logic
- Update PositionComponent efficiently

**Optimization**:
```javascript
// Batch position updates
function movementSystem(world) {
  const positions = world.getComponents('Position');
  const updates = [];

  // Collect all movements
  for (const entity of pshEntities) {
    updates.push({ entity, newQ, newR });
  }

  // Apply in single pass (better cache locality)
  for (const update of updates) {
    positions[update.entity].q = update.newQ;
    positions[update.entity].r = update.newR;
  }
}
```

**Testing**:
- Test PSH pushing mechanics
- Test RPF sliding mechanics
- Verify collision detection

**Estimated Effort**: 3-4 days

---

### Step 7: Create Transcription System
**Goal**: Implement RPF-RPF RNA synthesis in ECS.

**Tasks**:
- Create `src/ecs/systems/transcriptionSystem.js`
- Implement RNA polymerase mechanics
- Handle RNA molecule creation
- Track transcription progress

**Testing**:
- Test complete transcription cycle
- Verify RNA sequence matches DNA template
- Test ATP consumption during transcription

**Estimated Effort**: 3-4 days

---

## Phase 3: Complete Migration (Steps 8-11)

### Step 8: Migrate Rendering to Query ECS
**Goal**: Make renderers read from World instead of Complex.

**Tasks**:
- Update `asciiRenderer.js` to query World
- Update `canvasRenderer.js` to query World
- Remove dependency on Complex.molecules array

**Before**:
```javascript
// Old renderer
function render(complex) {
  for (const molecule of complex.molecules) {
    for (const residue of molecule.residues) {
      drawResidue(residue.q, residue.r, residue.type);
    }
  }
}
```

**After**:
```javascript
// New renderer
function render(world) {
  const query = world.query(['Position', 'Residue']);
  const positions = world.getComponents('Position');
  const residues = world.getComponents('Residue');

  for (const entity of query) {
    const pos = positions[entity];
    const res = residues[entity];
    drawResidue(pos.q, pos.r, res.type);
  }
}
```

**Testing**:
- Visual comparison tests
- Verify all residues render correctly
- Test bond visualization

**Estimated Effort**: 2-3 days

---

### Step 9: Remove Dual Storage
**Goal**: Delete old data structures, keep only ECS.

**Tasks**:
- Remove sync methods from Complex
- Remove `this.molecules` array
- Remove old residue objects
- Update Complex methods to be thin wrappers over World

**Major Refactor**:
```javascript
// Complex becomes thin facade
class Complex {
  constructor() {
    this.world = new World();
  }

  addMolecule(molecule, position) {
    // Directly add to World
    createMoleculeEntities(this.world, molecule, position);
  }

  computeSignals(options) {
    // Direct system call
    return signalSystem(this.world, options);
  }
}
```

**Testing**:
- ALL 332 tests must still pass
- Remove sync-specific tests
- Performance benchmark: should be faster

**Estimated Effort**: 2-3 days

---

### Step 10: Add TypedArray Optimization
**Goal**: Use TypedArrays for numeric components.

**Tasks**:
- Convert PositionComponent to Float32Array
- Convert SignalComponent to Uint8Array
- Convert EnergyComponent to Uint16Array
- Update queries to work with typed arrays

**Performance Gain**:
```javascript
// Before: object per component (8-16+ bytes overhead each)
const positions = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  // ...
];

// After: contiguous typed arrays (zero overhead)
const positions = {
  q: new Float32Array(1000),
  r: new Float32Array(1000)
};
```

**Testing**:
- Verify all systems work with typed arrays
- Test with large complexes (10k+ residues)
- Benchmark: measure memory reduction

**Estimated Effort**: 2-3 days

---

### Step 11: Implement Parallel Processing
**Goal**: Enable multi-threaded system execution.

**Tasks**:
- Add WorkerPool for parallel system execution
- Make systems operate on entity ranges
- Implement parallel signal propagation
- Add parallel bond queries

**Example**:
```javascript
// Split work across workers
const workerPool = new WorkerPool(4);

async function parallelSignalSystem(world) {
  const entityCount = world.entityCount;
  const chunkSize = Math.ceil(entityCount / 4);

  const promises = [];
  for (let i = 0; i < 4; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, entityCount);

    promises.push(
      workerPool.run('signalSystem', {
        positions: world.positions.slice(start, end),
        residues: world.residues.slice(start, end),
        signals: world.signals.slice(start, end)
      })
    );
  }

  await Promise.all(promises);
}
```

**Testing**:
- Test deterministic results across parallel runs
- Benchmark scaling with 1, 2, 4, 8 threads
- Test with various complex sizes

**Estimated Effort**: 4-5 days

---

## Testing Strategy

### Continuous Testing
- Run `npm test` after every step
- All 332 existing tests must pass throughout migration
- Add new ECS-specific tests incrementally

### Performance Benchmarks
Run after Steps 3, 4, 9, 10, 11:
```javascript
// benchmark.js
const complexSizes = [100, 1000, 10000, 50000];
const systems = ['signal', 'energy', 'bonding', 'movement'];

for (const size of complexSizes) {
  const complex = generateRandomComplex(size);
  for (const system of systems) {
    const start = performance.now();
    runSystem(complex, system, 100); // 100 ticks
    const duration = performance.now() - start;
    console.log(`${system}@${size}: ${duration}ms`);
  }
}
```

### Regression Testing
- Visual comparison: render same complex with old/new code
- State comparison: run simulation, compare final state
- Integration tests: full game scenarios

---

## Risk Mitigation

### Rollback Plan
- Each step is in its own commit
- Tag major phase completions
- Can revert to any phase if issues arise

### Data Validation
After each step, add validation:
```javascript
function validateWorldIntegrity(world) {
  // Check all entities have required components
  // Verify no orphaned components
  // Check position map consistency
  // Validate bond references
  return { valid: true, errors: [] };
}
```

### Incremental Feature Freeze
- Phase 1-2: Can still add features using old API
- Phase 3: Feature freeze, focus on migration
- Post-migration: New features use pure ECS

---

## Expected Performance Gains

| Metric | Current | After Step 9 | After Step 10 | After Step 11 |
|--------|---------|--------------|---------------|---------------|
| Memory/residue | ~200 bytes | ~150 bytes | ~80 bytes | ~80 bytes |
| Signal tick (10k) | 50ms | 30ms | 15ms | 4ms (4 threads) |
| Energy tick (10k) | 30ms | 20ms | 10ms | 3ms (4 threads) |
| Query time | O(n) scan | O(n) filtered | O(n) typed | O(n/t) parallel |
| Cache misses | High | Medium | Low | Low |

---

## Timeline Estimate

| Phase | Steps | Duration | Can Parallelize? |
|-------|-------|----------|------------------|
| Phase 1 | 1-4 | 8-12 days | Steps 1-2, then 3-4 |
| Phase 2 | 5-7 | 8-11 days | Steps 5-7 parallel |
| Phase 3 | 8-11 | 10-14 days | Steps 8-9, then 10-11 |
| **Total** | **11 steps** | **26-37 days** | |

**Note**: Timeline assumes one developer working full-time. Can be compressed with careful parallelization.

---

## Decision Points

### After Step 4
**Question**: Is the ECS performance gain worth continuing?
- Run benchmarks on Steps 3-4
- If >30% improvement, continue
- If <10% improvement, consider stopping

### After Step 9
**Question**: Do we need TypedArray optimization?
- If memory isn't a concern and performance is acceptable, can skip Step 10
- TypedArray adds complexity but maximizes performance

### After Step 10
**Question**: Do we need parallel processing?
- If single-threaded performance is sufficient, can skip Step 11
- Parallel adds significant complexity

---

## Success Criteria

### Must Have
- ✅ All 332 existing tests pass
- ✅ No visual changes to renders
- ✅ No behavioral changes to physics
- ✅ Memory usage reduced by >50%
- ✅ Performance improved by >50%

### Nice to Have
- ✅ Code is more maintainable
- ✅ Systems are composable/reusable
- ✅ Easy to add new component types
- ✅ Can handle 50k+ residues smoothly

---

## Post-Migration Opportunities

Once pure ECS is in place:

1. **Spatial Hashing**: Add spatial partitioning for faster neighbor queries
2. **Component Pooling**: Reuse component memory for destroyed entities
3. **Event System**: Add ECS-native events for game logic
4. **Serialization**: Save/load entire World state efficiently
5. **Network Sync**: Stream component changes for multiplayer
6. **Visualization**: Real-time performance profiling per system

---

## Next Steps

1. **Review this plan** - Does the sequence make sense? Any concerns?
2. **Adjust if needed** - Should we skip any steps? Change order?
3. **Start Step 1** - Create ECS core infrastructure when ready

Ready to proceed, or would you like to adjust the plan?

# STRAND Project Guidelines for Claude

## Core Development Principles

### 1. Always Use the Deepest Simulation
When building visualizations, animations, or demos:
- **ALWAYS** drive renders from actual physics/game logic, never hardcode frames
- Call the real simulation functions (e.g., `computeSignals()`, `processATRs()`)
- Let the underlying engine determine state changes
- This ensures animations accurately reflect the physics and serve as integration tests

**Bad example:**
```javascript
// DON'T manually set states to "fake" propagation
signalResult.state.set(entity.index, { on: true, source: false });
```

**Good example:**
```javascript
// DO call the actual physics engine
const result = complex.computeSignals({ stepped: true });
// Show whatever the engine computed
```

### 2. Architecture: Molecule vs Complex
- **Molecule**: Pure data (sequence, foldStates, type, id) - no position info
- **Complex**: Contains molecules with positions, handles all computation
- Even a single unbound molecule lives in a Complex

### 3. Signal System Design
- **BTx residues**: Signal sources (activate when bound to matching DNA)
- **SIG**: Conductors (OR logic - on if ANY neighbor is on)
- **AND**: Logic gate (on if ALL signal-capable neighbors are on + ATP)
- **ATR**: Actuators (attract ATP when signaled)
- **PSH**: Actuators (push/move when signaled)

### 4. Rendering Conventions
- All residue/base codes are exactly 3 characters
- Use `+` for inter-molecular bonds (e.g., protein-DNA, ATR-ATP)
- Use `-` for intra-molecular bonds (within same protein)
- DNA/RNA bases wrapped in `<>`, e.g., `<A>`, `<G>`

## File Structure
- `src/core/` - Core classes (Molecule, Complex, hex-layout)
- `src/physics/` - Physics engines (signal, energy)
- `src/data/` - Data definitions (amino-acids)
- `src/renderers/` - ASCII and Canvas renderers
- `src/animation/` - Terminal animations (demo purposes)

## Testing
- Run `npm test` before committing
- All tests must pass (currently 322 tests)
- Animations/demos serve as visual integration tests

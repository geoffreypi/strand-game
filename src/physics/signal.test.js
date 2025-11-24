import { describe, test, expect } from '@jest/globals';
import {
  DEFAULT_SIGNAL_CONFIG,
  buildPositionMap,
  getAdjacentResidues,
  getSignalCapableNeighbors,
  isSignalSource,
  isActiveSource,
  initializeSignalState,
  computeSteadyState,
  computeTickUpdate,
  computeSignals,
  hasAdjacentAtp,
  findAdjacentAtp
} from './signal.js';

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Create a residue object for testing
 */
function createResidue(index, type, q, r) {
  return { index, type, q, r };
}

/**
 * Create bound pairs map from array of [residueIndex, nucleotide]
 */
function createBoundPairs(pairs) {
  return new Map(pairs);
}

/**
 * Create ATP positions set from array of [q, r]
 */
function createAtpPositions(positions) {
  return new Set(positions.map(([q, r]) => `${q},${r}`));
}

// =============================================================================
// POSITION MAP TESTS
// =============================================================================

describe('Signal Propagation - Position Map', () => {
  // INPUT: Array of residues with positions
  // EXPECTED: Map from "q,r" string to residue
  // WHY: Need fast O(1) lookup of "what residue is at this hex?"
  test('buildPositionMap creates correct lookup', () => {
    const residues = [
      createResidue(0, 'SIG', 0, 0),
      createResidue(1, 'SIG', 1, 0),
      createResidue(2, 'AND', 2, 1)
    ];

    const map = buildPositionMap(residues);

    expect(map.get('0,0')).toBe(residues[0]);
    expect(map.get('1,0')).toBe(residues[1]);
    expect(map.get('2,1')).toBe(residues[2]);
    expect(map.get('5,5')).toBeUndefined();
  });

  // INPUT: Empty residues array
  // EXPECTED: Empty map
  // WHY: Edge case - should handle gracefully
  test('buildPositionMap handles empty array', () => {
    const map = buildPositionMap([]);
    expect(map.size).toBe(0);
  });
});

// =============================================================================
// ADJACENCY TESTS
// =============================================================================

describe('Signal Propagation - Adjacency', () => {
  // INPUT: Residue at (1,0) with neighbors at (0,0) and (2,0)
  // EXPECTED: Returns both adjacent residues
  // WHY: Core mechanic - signals propagate to hex neighbors
  test('getAdjacentResidues finds neighbors', () => {
    const residues = [
      createResidue(0, 'SIG', 0, 0),
      createResidue(1, 'SIG', 1, 0),  // Center
      createResidue(2, 'SIG', 2, 0)
    ];
    const map = buildPositionMap(residues);

    const adjacent = getAdjacentResidues(1, 0, map);

    expect(adjacent.length).toBe(2);
    expect(adjacent).toContain(residues[0]);
    expect(adjacent).toContain(residues[2]);
  });

  // INPUT: Isolated residue with no neighbors
  // EXPECTED: Empty array
  // WHY: Residue with no neighbors receives no signal
  test('getAdjacentResidues returns empty for isolated residue', () => {
    const residues = [createResidue(0, 'SIG', 0, 0)];
    const map = buildPositionMap(residues);

    const adjacent = getAdjacentResidues(0, 0, map);

    expect(adjacent.length).toBe(0);
  });

  // INPUT: Residue surrounded by all 6 hex neighbors
  // EXPECTED: Returns all 6 neighbors
  // WHY: Hex grid has exactly 6 neighbors per cell
  test('getAdjacentResidues finds all 6 hex neighbors', () => {
    // Center at (0, 0), neighbors in all 6 directions
    const residues = [
      createResidue(0, 'SIG', 0, 0),   // Center
      createResidue(1, 'SIG', 1, 0),   // East
      createResidue(2, 'SIG', 0, 1),   // Southeast
      createResidue(3, 'SIG', -1, 1),  // Southwest
      createResidue(4, 'SIG', -1, 0),  // West
      createResidue(5, 'SIG', 0, -1),  // Northwest
      createResidue(6, 'SIG', 1, -1)   // Northeast
    ];
    const map = buildPositionMap(residues);

    const adjacent = getAdjacentResidues(0, 0, map);

    expect(adjacent.length).toBe(6);
  });

  // INPUT: Mixed residues, some signal-capable, some not
  // EXPECTED: getSignalCapableNeighbors filters to only signal-capable types
  // WHY: Only signal-capable residues participate in signal logic
  test('getSignalCapableNeighbors filters correctly', () => {
    const residues = [
      createResidue(0, 'SIG', 0, 0),  // Center - signal conductor
      createResidue(1, 'STR', 1, 0),  // East - structural, not signal-capable
      createResidue(2, 'AND', -1, 0), // West - signal gate
      createResidue(3, 'BTA', 0, 1)   // Southeast - BTx is signal source
    ];
    const map = buildPositionMap(residues);

    const signalNeighbors = getSignalCapableNeighbors(0, 0, map);

    expect(signalNeighbors.length).toBe(2);
    expect(signalNeighbors).toContain(residues[2]); // AND
    expect(signalNeighbors).toContain(residues[3]); // BTA (signal source)
    expect(signalNeighbors).not.toContain(residues[1]); // STR not signal-capable
  });
});

// =============================================================================
// SIGNAL SOURCE TESTS
// =============================================================================

describe('Signal Propagation - Sources', () => {
  // INPUT: BTA residue type
  // EXPECTED: isSignalSource returns true
  // WHY: BTx types are the original signal sources (when bound)
  test('isSignalSource identifies BTx types', () => {
    expect(isSignalSource('BTA')).toBe(true);
    expect(isSignalSource('BTC')).toBe(true);
    expect(isSignalSource('BTG')).toBe(true);
    expect(isSignalSource('BTT')).toBe(true);
  });

  // INPUT: Non-BTx types
  // EXPECTED: isSignalSource returns false
  // WHY: Only BTx types can be signal sources
  test('isSignalSource returns false for non-BTx', () => {
    expect(isSignalSource('SIG')).toBe(false);
    expect(isSignalSource('AND')).toBe(false);
    expect(isSignalSource('STR')).toBe(false);
    expect(isSignalSource('PSH')).toBe(false);
  });

  // INPUT: BTA bound to 'A' nucleotide
  // EXPECTED: isActiveSource returns true
  // WHY: BTA matches Adenine - creates signal
  test('isActiveSource returns true for matching binding', () => {
    const residue = createResidue(0, 'BTA', 0, 0);
    const boundPairs = createBoundPairs([[0, 'A']]);

    expect(isActiveSource(residue, boundPairs)).toBe(true);
  });

  // INPUT: BTA bound to 'G' (wrong nucleotide)
  // EXPECTED: isActiveSource returns false
  // WHY: Mismatched binding doesn't create signal
  test('isActiveSource returns false for mismatched binding', () => {
    const residue = createResidue(0, 'BTA', 0, 0);
    const boundPairs = createBoundPairs([[0, 'G']]);

    expect(isActiveSource(residue, boundPairs)).toBe(false);
  });

  // INPUT: BTA not bound to anything
  // EXPECTED: isActiveSource returns false
  // WHY: Unbound BTx doesn't create signal
  test('isActiveSource returns false for unbound residue', () => {
    const residue = createResidue(0, 'BTA', 0, 0);
    const boundPairs = createBoundPairs([]);

    expect(isActiveSource(residue, boundPairs)).toBe(false);
  });

  // INPUT: BTT bound to 'U' (RNA)
  // EXPECTED: isActiveSource returns true
  // WHY: BTT binds both Thymine (DNA) and Uracil (RNA)
  test('BTT binds to both T and U', () => {
    const residue = createResidue(0, 'BTT', 0, 0);

    expect(isActiveSource(residue, createBoundPairs([[0, 'T']]))).toBe(true);
    expect(isActiveSource(residue, createBoundPairs([[0, 'U']]))).toBe(true);
  });
});

// =============================================================================
// STEADY STATE PROPAGATION TESTS
// =============================================================================

describe('Signal Propagation - Steady State', () => {
  // INPUT: BTA bound to A, adjacent to SIG
  // EXPECTED: Both BTA and SIG are "on"
  // WHY: Signal flows from source (BTA) to conductor (SIG)
  test('signal propagates from source to SIG', () => {
    const residues = [
      createResidue(0, 'BTA', 0, 0),  // Source
      createResidue(1, 'SIG', 1, 0)   // Adjacent conductor
    ];
    const boundPairs = createBoundPairs([[0, 'A']]);

    const result = computeSteadyState(residues, boundPairs, new Set(), DEFAULT_SIGNAL_CONFIG, () => 0);

    expect(result.state.get(0).on).toBe(true);  // Source on
    expect(result.state.get(1).on).toBe(true);  // SIG on (receives signal)
  });

  // INPUT: BTA not bound, adjacent to SIG
  // EXPECTED: Both are "off"
  // WHY: No source signal means no propagation
  test('no signal when source not bound', () => {
    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0)
    ];
    const boundPairs = createBoundPairs([]);

    const result = computeSteadyState(residues, boundPairs, new Set(), DEFAULT_SIGNAL_CONFIG, () => 0);

    expect(result.state.get(0).on).toBe(false);
    expect(result.state.get(1).on).toBe(false);
  });

  // INPUT: Chain: BTA -> SIG -> SIG -> SIG
  // EXPECTED: All SIG residues are on
  // WHY: Signal propagates through chain of conductors
  test('signal propagates through SIG chain', () => {
    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0),
      createResidue(2, 'SIG', 2, 0),
      createResidue(3, 'SIG', 3, 0)
    ];
    const boundPairs = createBoundPairs([[0, 'A']]);

    const result = computeSteadyState(residues, boundPairs, new Set(), DEFAULT_SIGNAL_CONFIG, () => 0);

    expect(result.state.get(0).on).toBe(true);
    expect(result.state.get(1).on).toBe(true);
    expect(result.state.get(2).on).toBe(true);
    expect(result.state.get(3).on).toBe(true);
  });

  // INPUT: SIG with gap (non-adjacent to source)
  // EXPECTED: Disconnected SIG is off
  // WHY: Signal only propagates to adjacent hexes
  test('signal does not jump gaps', () => {
    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0),   // Adjacent - on
      createResidue(2, 'SIG', 3, 0)    // Gap at (2,0) - off
    ];
    const boundPairs = createBoundPairs([[0, 'A']]);

    const result = computeSteadyState(residues, boundPairs, new Set(), DEFAULT_SIGNAL_CONFIG, () => 0);

    expect(result.state.get(1).on).toBe(true);
    expect(result.state.get(2).on).toBe(false);
  });
});

// =============================================================================
// AND GATE TESTS
// =============================================================================

describe('Signal Propagation - AND Gate', () => {
  // INPUT: AND with one SIG neighbor on, one off
  // EXPECTED: AND is off
  // WHY: AND requires ALL inputs to be on
  test('AND requires all inputs on', () => {
    // Config with instant AND for this test
    const config = { ...DEFAULT_SIGNAL_CONFIG, AND: 1.0 };

    const residues = [
      createResidue(0, 'BTA', 0, 0),   // Source - on
      createResidue(1, 'SIG', 1, 0),   // On (from BTA)
      createResidue(2, 'AND', 2, 0),   // AND gate
      createResidue(3, 'SIG', 3, 0)    // Off (no source)
    ];
    const boundPairs = createBoundPairs([[0, 'A']]);
    const atpPositions = createAtpPositions([[2, 1]]); // ATP adjacent to AND

    const result = computeSteadyState(residues, boundPairs, atpPositions, config, () => 0);

    // AND has two signal neighbors: SIG at (1,0) is on, SIG at (3,0) is off
    expect(result.state.get(2).on).toBe(false);
  });

  // INPUT: AND with both SIG neighbors on + adjacent ATP
  // EXPECTED: AND is on, ATP consumed
  // WHY: All conditions met - AND activates
  test('AND turns on when all inputs on and ATP available', () => {
    const config = { ...DEFAULT_SIGNAL_CONFIG, AND: 1.0 };

    // Two sources powering two SIGs that both connect to AND
    const residues = [
      createResidue(0, 'BTA', 0, 0),   // Source 1
      createResidue(1, 'SIG', 1, 0),   // On from source 1
      createResidue(2, 'AND', 2, 0),   // AND gate - neighbors are (1,0) and (3,0)
      createResidue(3, 'SIG', 3, 0),   // On from source 2
      createResidue(4, 'BTA', 4, 0)    // Source 2
    ];
    const boundPairs = createBoundPairs([[0, 'A'], [4, 'A']]);
    const atpPositions = createAtpPositions([[2, 1]]); // ATP at (2,1) adjacent to AND at (2,0)

    const result = computeSteadyState(residues, boundPairs, atpPositions, config, () => 0);

    expect(result.state.get(2).on).toBe(true);
    expect(result.consumedAtp).toContain('2,1');
  });

  // INPUT: AND with all inputs on but no ATP
  // EXPECTED: AND stays off
  // WHY: AND requires ATP to activate
  test('AND stays off without ATP', () => {
    const config = { ...DEFAULT_SIGNAL_CONFIG, AND: 1.0 };

    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0),
      createResidue(2, 'AND', 2, 0),
      createResidue(3, 'SIG', 3, 0),
      createResidue(4, 'BTA', 4, 0)
    ];
    const boundPairs = createBoundPairs([[0, 'A'], [4, 'A']]);
    const atpPositions = createAtpPositions([]); // No ATP

    const result = computeSteadyState(residues, boundPairs, atpPositions, config, () => 0);

    expect(result.state.get(2).on).toBe(false);
  });

  // INPUT: AND with no signal-capable neighbors
  // EXPECTED: AND is off
  // WHY: AND with no inputs defaults to off
  test('AND with no neighbors is off', () => {
    const config = { ...DEFAULT_SIGNAL_CONFIG, AND: 1.0 };

    const residues = [
      createResidue(0, 'AND', 0, 0),   // Isolated AND
      createResidue(1, 'STR', 1, 0)    // Non-signal neighbor
    ];
    const boundPairs = createBoundPairs([]);
    const atpPositions = createAtpPositions([[0, 1]]);

    const result = computeSteadyState(residues, boundPairs, atpPositions, config, () => 0);

    expect(result.state.get(0).on).toBe(false);
  });
});

// =============================================================================
// ACTUATOR TESTS
// =============================================================================

describe('Signal Propagation - Actuators', () => {
  // INPUT: PSH adjacent to active SIG
  // EXPECTED: PSH is on
  // WHY: Actuators (PSH, ATR) respond to signals like SIG (OR logic)
  test('PSH activates when adjacent signal is on', () => {
    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0),
      createResidue(2, 'PSH', 2, 0)
    ];
    const boundPairs = createBoundPairs([[0, 'A']]);

    const result = computeSteadyState(residues, boundPairs, new Set(), DEFAULT_SIGNAL_CONFIG, () => 0);

    expect(result.state.get(2).on).toBe(true);
  });

  // INPUT: ATR adjacent to active SIG
  // EXPECTED: ATR is on
  // WHY: ATR is an actuator, uses OR logic
  test('ATR activates when adjacent signal is on', () => {
    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0),
      createResidue(2, 'ATR', 2, 0)
    ];
    const boundPairs = createBoundPairs([[0, 'A']]);

    const result = computeSteadyState(residues, boundPairs, new Set(), DEFAULT_SIGNAL_CONFIG, () => 0);

    expect(result.state.get(2).on).toBe(true);
  });

  // INPUT: PSH with no adjacent signal
  // EXPECTED: PSH is off
  // WHY: Actuators need input signal to activate
  test('actuators stay off without signal', () => {
    const residues = [
      createResidue(0, 'BTA', 0, 0),  // Not bound
      createResidue(1, 'PSH', 1, 0),
      createResidue(2, 'ATR', 2, 0)
    ];
    const boundPairs = createBoundPairs([]);

    const result = computeSteadyState(residues, boundPairs, new Set(), DEFAULT_SIGNAL_CONFIG, () => 0);

    expect(result.state.get(1).on).toBe(false);
    expect(result.state.get(2).on).toBe(false);
  });
});

// =============================================================================
// ATP HELPER TESTS
// =============================================================================

describe('Signal Propagation - ATP Helpers', () => {
  // INPUT: Position with ATP at adjacent hex
  // EXPECTED: hasAdjacentAtp returns true
  // WHY: Need to check ATP availability for AND gates
  test('hasAdjacentAtp finds adjacent ATP', () => {
    const atpPositions = createAtpPositions([[1, 0], [5, 5]]);

    expect(hasAdjacentAtp(0, 0, atpPositions)).toBe(true);  // (1,0) is adjacent
    expect(hasAdjacentAtp(3, 3, atpPositions)).toBe(false); // No adjacent ATP
  });

  // INPUT: Position with ATP at adjacent hex
  // EXPECTED: findAdjacentAtp returns the ATP key
  // WHY: Need to know which ATP to consume
  test('findAdjacentAtp returns ATP position key', () => {
    const atpPositions = createAtpPositions([[1, 0]]);

    const key = findAdjacentAtp(0, 0, atpPositions);
    expect(key).toBe('1,0');
  });

  // INPUT: Position with no adjacent ATP
  // EXPECTED: findAdjacentAtp returns null
  // WHY: Indicates no ATP available
  test('findAdjacentAtp returns null when none found', () => {
    const atpPositions = createAtpPositions([[5, 5]]);

    const key = findAdjacentAtp(0, 0, atpPositions);
    expect(key).toBeNull();
  });
});

// =============================================================================
// TICK-BASED PROPAGATION TESTS
// =============================================================================

describe('Signal Propagation - Tick Mode', () => {
  // INPUT: AND with probability < 1.0, deterministic random
  // EXPECTED: AND activates after "successful" random roll
  // WHY: Tick mode uses probability per tick
  test('probabilistic AND activates on successful roll', () => {
    const config = { SIG: 1.0, AND: 0.75, PSH: 1.0, ATR: 1.0 };

    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0),
      createResidue(2, 'AND', 2, 0),
      createResidue(3, 'SIG', 3, 0),
      createResidue(4, 'BTA', 4, 0)
    ];
    const boundPairs = createBoundPairs([[0, 'A'], [4, 'A']]);
    const atpPositions = createAtpPositions([[2, 1]]);

    // Initial state - sources are on
    let state = initializeSignalState(residues, boundPairs);
    expect(state.get(2).on).toBe(false);

    // Step 1: SIG neighbors activate (prob=1.0, always succeed)
    state = computeTickUpdate(residues, state, boundPairs, atpPositions, config, () => 0).state;
    expect(state.get(1).on).toBe(true);  // SIG1 now on
    expect(state.get(3).on).toBe(true);  // SIG3 now on
    expect(state.get(2).on).toBe(false); // AND not yet (neighbors weren't on at step start)

    // Step 2: AND can now try to activate (both neighbors on)
    // Mock random to return 0.5 (< 0.75, success)
    const result = computeTickUpdate(
      residues, state, boundPairs, atpPositions, config, () => 0.5
    );

    expect(result.state.get(2).on).toBe(true);
    expect(result.activatedThisTick).toContain(2);
  });

  // INPUT: AND with probability < 1.0, failed random roll
  // EXPECTED: AND stays off
  // WHY: Failed probability check means no activation this tick
  test('probabilistic AND stays off on failed roll', () => {
    const config = { SIG: 1.0, AND: 0.75, PSH: 1.0, ATR: 1.0 };

    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0),
      createResidue(2, 'AND', 2, 0),
      createResidue(3, 'SIG', 3, 0),
      createResidue(4, 'BTA', 4, 0)
    ];
    const boundPairs = createBoundPairs([[0, 'A'], [4, 'A']]);
    const atpPositions = createAtpPositions([[2, 1]]);

    // Initial state - sources are on
    let state = initializeSignalState(residues, boundPairs);

    // Step 1: SIG neighbors activate (prob=1.0)
    state = computeTickUpdate(residues, state, boundPairs, atpPositions, config, () => 0).state;
    expect(state.get(1).on).toBe(true);
    expect(state.get(3).on).toBe(true);

    // Step 2: AND tries to activate but fails probability check
    // Mock random to return 0.9 (> 0.75, fail)
    const result = computeTickUpdate(
      residues, state, boundPairs, atpPositions, config, () => 0.9
    );

    expect(result.state.get(2).on).toBe(false);
    expect(result.activatedThisTick).not.toContain(2);
  });

  // INPUT: SIG chain in stepped mode with prob=1.0
  // EXPECTED: Only adjacent SIG activates in one step
  // WHY: Stepped mode does one propagation step per call
  test('stepped mode propagates one step at a time', () => {
    const config = { SIG: 1.0, AND: 0.75 };

    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0),
      createResidue(2, 'SIG', 2, 0),
      createResidue(3, 'SIG', 3, 0)
    ];
    const boundPairs = createBoundPairs([[0, 'A']]);

    // Step 0: Only source is on
    let state = initializeSignalState(residues, boundPairs);
    expect(state.get(0).on).toBe(true);   // Source
    expect(state.get(1).on).toBe(false);  // Not yet

    // Step 1: SIG1 sees source, activates
    let result = computeTickUpdate(residues, state, boundPairs, new Set(), config);
    expect(result.state.get(1).on).toBe(true);
    expect(result.state.get(2).on).toBe(false);  // Not yet - neighbor wasn't on
    expect(result.state.get(3).on).toBe(false);

    // Step 2: SIG2 sees SIG1, activates
    result = computeTickUpdate(residues, result.state, boundPairs, new Set(), config);
    expect(result.state.get(2).on).toBe(true);
    expect(result.state.get(3).on).toBe(false);  // Not yet

    // Step 3: SIG3 sees SIG2, activates
    result = computeTickUpdate(residues, result.state, boundPairs, new Set(), config);
    expect(result.state.get(3).on).toBe(true);  // Now all on
  });
});

// =============================================================================
// HIGH-LEVEL API TESTS
// =============================================================================

describe('Signal Propagation - computeSignals API', () => {
  // INPUT: Basic configuration
  // EXPECTED: Returns correct state
  // WHY: High-level API should work for common use cases
  test('computeSignals works for steady state', () => {
    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0)
    ];

    const result = computeSignals(residues, {
      boundPairs: createBoundPairs([[0, 'A']]),
      randomFn: () => 0  // Deterministic for test
    });

    expect(result.state.get(0).on).toBe(true);
    expect(result.state.get(1).on).toBe(true);
  });

  // INPUT: Tick mode with previous state
  // EXPECTED: Uses tick-based propagation
  // WHY: API should support both modes
  test('computeSignals works for tick mode', () => {
    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0)
    ];
    const boundPairs = createBoundPairs([[0, 'A']]);
    const previousState = initializeSignalState(residues, boundPairs);

    const result = computeSignals(residues, {
      boundPairs,
      previousState,
      tickMode: true,
      randomFn: () => 0  // Deterministic for test
    });

    expect(result.state.get(1).on).toBe(true);
  });
});

// =============================================================================
// CONFIGURATION TESTS
// =============================================================================

describe('Signal Propagation - Configuration', () => {
  // INPUT: Default config
  // EXPECTED: Contains expected residue types
  // WHY: Verify default configuration is sensible
  test('default config has expected values', () => {
    // All residue types default to 0.75 probability
    expect(DEFAULT_SIGNAL_CONFIG.SIG).toBe(0.75);
    expect(DEFAULT_SIGNAL_CONFIG.AND).toBe(0.75);
    expect(DEFAULT_SIGNAL_CONFIG.PSH).toBe(0.75);
    expect(DEFAULT_SIGNAL_CONFIG.ATR).toBe(0.75);
  });

  // INPUT: Custom config with slow SIG
  // EXPECTED: SIG respects custom probability
  // WHY: Config should be customizable per residue type
  test('custom config affects propagation', () => {
    const config = { SIG: 0.5, AND: 0.75, PSH: 1.0, ATR: 1.0 };

    const residues = [
      createResidue(0, 'BTA', 0, 0),
      createResidue(1, 'SIG', 1, 0)
    ];
    const boundPairs = createBoundPairs([[0, 'A']]);
    const initialState = initializeSignalState(residues, boundPairs);

    // With 50% chance and mock returning 0.6 (fail)
    const mockRandom = () => 0.6;

    const result = computeTickUpdate(
      residues, initialState, boundPairs, new Set(), config, mockRandom
    );

    // SIG should fail to activate (0.6 > 0.5)
    expect(result.state.get(1).on).toBe(false);
  });
});

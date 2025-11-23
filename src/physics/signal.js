/**
 * Signal Propagation System
 *
 * Computes signal states for residues based on:
 * - Signal sources: BTx residues bound to matching DNA bases
 * - Signal conductors: SIG (OR logic - on if ANY adjacent is on)
 * - Logic gates: AND (on if ALL adjacent signal-capable are on, requires ATP)
 * - Actuators: PSH, ATR (respond to signals like SIG)
 *
 * Two propagation modes:
 * 1. Instant (probability = 1.0): Steady-state computed in single call
 * 2. Tick-based (probability < 1.0): Probabilistic update per tick
 *
 * Each residue type can have its own propagation probability, allowing
 * fine-tuning during game testing.
 */

import { getNeighbors } from '../core/hex-layout.js';
import {
  getSignalingType,
  canSignal,
  getBindingTarget
} from '../data/amino-acids.js';

/**
 * Default propagation probabilities per residue type
 * 1.0 = instant (included in steady-state calculation)
 * <1.0 = probabilistic per tick
 */
export const DEFAULT_SIGNAL_CONFIG = {
  SIG: 1.0,    // Instant by default
  AND: 0.75,   // 75% chance per tick (requires deliberate timing)
  PSH: 1.0,    // Instant
  ATR: 1.0,    // Instant
};

/**
 * Build a position map from residues array
 * @param {Array} residues - [{index, type, q, r}, ...]
 * @returns {Map} Map of "q,r" -> residue
 */
export function buildPositionMap(residues) {
  const map = new Map();
  for (const residue of residues) {
    const key = `${residue.q},${residue.r}`;
    map.set(key, residue);
  }
  return map;
}

/**
 * Get adjacent residues for a given position
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @param {Map} positionMap - Position -> residue map
 * @returns {Array} Array of adjacent residues
 */
export function getAdjacentResidues(q, r, positionMap) {
  const neighbors = getNeighbors(q, r);
  const adjacent = [];

  for (const neighbor of neighbors) {
    const key = `${neighbor.q},${neighbor.r}`;
    const residue = positionMap.get(key);
    if (residue) {
      adjacent.push(residue);
    }
  }

  return adjacent;
}

/**
 * Get signal-capable neighbors for a residue
 * Signal-capable = has signaling property (SIG, AND, PSH, ATR) or is a BTx type
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @param {Map} positionMap - Position -> residue map
 * @returns {Array} Array of signal-capable adjacent residues
 */
export function getSignalCapableNeighbors(q, r, positionMap) {
  const adjacent = getAdjacentResidues(q, r, positionMap);
  return adjacent.filter(res => canSignal(res.type) || isSignalSource(res.type));
}

/**
 * Check if a residue type can be a signal source (BTx types)
 * @param {string} type - Amino acid type code
 * @returns {boolean} True if this type can be a signal source
 */
export function isSignalSource(type) {
  return getBindingTarget(type) !== null;
}

/**
 * Check if a BTx residue is actively bound and producing signal
 * @param {Object} residue - {index, type, q, r}
 * @param {Map} boundPairs - Map of residueIndex -> nucleotide they're bound to
 * @returns {boolean} True if residue is an active signal source
 */
export function isActiveSource(residue, boundPairs) {
  const bindTarget = getBindingTarget(residue.type);
  if (!bindTarget) return false;

  const boundTo = boundPairs.get(residue.index);
  if (!boundTo) return false;

  // BTT binds to both T and U
  if (bindTarget === 'T' && boundTo === 'U') return true;

  return boundTo === bindTarget;
}

/**
 * Initialize signal state for all residues
 * @param {Array} residues - [{index, type, q, r}, ...]
 * @param {Map} boundPairs - Map of residueIndex -> nucleotide
 * @returns {Map} Map of residueIndex -> {on: boolean, source: boolean}
 */
export function initializeSignalState(residues, boundPairs) {
  const state = new Map();

  for (const residue of residues) {
    const isSource = isActiveSource(residue, boundPairs);
    state.set(residue.index, {
      on: isSource,
      source: isSource
    });
  }

  return state;
}

/**
 * Compute steady-state signal propagation (instant mode)
 * Iterates until no changes occur.
 *
 * @param {Array} residues - [{index, type, q, r}, ...]
 * @param {Map} boundPairs - Map of residueIndex -> nucleotide
 * @param {Set} atpPositions - Set of "q,r" strings where ATP is present
 * @param {Object} config - Per-type propagation probabilities (only types with 1.0 are processed)
 * @returns {Map} Map of residueIndex -> {on: boolean, source: boolean, consumedAtp: boolean}
 */
export function computeSteadyState(residues, boundPairs, atpPositions = new Set(), config = DEFAULT_SIGNAL_CONFIG) {
  const positionMap = buildPositionMap(residues);
  const state = initializeSignalState(residues, boundPairs);

  // Track which AND gates consumed ATP this computation
  const consumedAtp = new Set();

  let changed = true;
  let iterations = 0;
  const maxIterations = residues.length * 2; // Safety limit

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const residue of residues) {
      // Skip sources - always on
      if (state.get(residue.index).source) continue;

      // Skip types that aren't instant (probability < 1.0)
      const prob = config[residue.type];
      if (prob !== undefined && prob < 1.0) continue;

      const signalingType = getSignalingType(residue.type);
      if (!signalingType) continue;

      const signalNeighbors = getSignalCapableNeighbors(residue.q, residue.r, positionMap);
      const currentState = state.get(residue.index);
      let shouldBeOn = false;

      if (signalingType === 'conductor' || signalingType === 'actuator') {
        // OR logic: on if ANY neighbor is on
        shouldBeOn = signalNeighbors.some(neighbor => state.get(neighbor.index)?.on);
      } else if (signalingType === 'and_gate') {
        // AND logic: on if ALL signal-capable neighbors are on
        if (signalNeighbors.length === 0) {
          shouldBeOn = false;
        } else {
          const allOn = signalNeighbors.every(neighbor => state.get(neighbor.index)?.on);

          if (allOn) {
            // Need ATP to turn on (not to stay on)
            if (!currentState.on) {
              // Check for adjacent ATP
              const hasAtp = hasAdjacentAtp(residue.q, residue.r, atpPositions);
              if (hasAtp) {
                shouldBeOn = true;
                // Mark position for ATP consumption
                const atpKey = findAdjacentAtp(residue.q, residue.r, atpPositions);
                if (atpKey) {
                  consumedAtp.add(atpKey);
                  atpPositions.delete(atpKey); // Consume it
                }
              } else {
                shouldBeOn = false;
              }
            } else {
              shouldBeOn = true; // Stay on
            }
          } else {
            shouldBeOn = false;
          }
        }
      }

      if (shouldBeOn !== currentState.on) {
        state.set(residue.index, { ...currentState, on: shouldBeOn });
        changed = true;
      }
    }
  }

  // Add consumedAtp info to result
  for (const [index, s] of state) {
    state.set(index, { ...s, consumedAtp: false });
  }

  return { state, consumedAtp: [...consumedAtp], iterations };
}

/**
 * Compute one tick of probabilistic signal propagation
 * Each residue with probability < 1.0 has a chance to update.
 *
 * @param {Array} residues - [{index, type, q, r}, ...]
 * @param {Map} previousState - Previous signal state
 * @param {Map} boundPairs - Map of residueIndex -> nucleotide
 * @param {Set} atpPositions - Set of "q,r" strings where ATP is present
 * @param {Object} config - Per-type propagation probabilities
 * @param {Function} randomFn - Random function (for testing), defaults to Math.random
 * @returns {Object} {state: Map, consumedAtp: string[], activatedThisTick: number[]}
 */
export function computeTickUpdate(
  residues,
  previousState,
  boundPairs,
  atpPositions = new Set(),
  config = DEFAULT_SIGNAL_CONFIG,
  randomFn = Math.random
) {
  const positionMap = buildPositionMap(residues);
  const newState = new Map();
  const consumedAtp = [];
  const activatedThisTick = [];

  // First, run steady-state for instant residues
  const instantResult = computeSteadyState(residues, boundPairs, atpPositions, config);

  // Copy instant results
  for (const [index, s] of instantResult.state) {
    newState.set(index, { ...s });
  }
  consumedAtp.push(...instantResult.consumedAtp);

  // Now handle probabilistic residues
  for (const residue of residues) {
    const prob = config[residue.type];
    if (prob === undefined || prob >= 1.0) continue; // Already handled

    // Skip sources
    if (newState.get(residue.index)?.source) continue;

    const signalingType = getSignalingType(residue.type);
    if (!signalingType) continue;

    const signalNeighbors = getSignalCapableNeighbors(residue.q, residue.r, positionMap);
    const prev = previousState.get(residue.index) || { on: false };
    const current = newState.get(residue.index) || { on: false, source: false };

    let shouldBeOn = current.on;

    if (signalingType === 'conductor' || signalingType === 'actuator') {
      // OR logic with probability
      const anyNeighborOn = signalNeighbors.some(neighbor =>
        newState.get(neighbor.index)?.on || previousState.get(neighbor.index)?.on
      );

      if (anyNeighborOn && !prev.on) {
        // Trying to turn on
        if (randomFn() < prob) {
          shouldBeOn = true;
          activatedThisTick.push(residue.index);
        }
      } else if (anyNeighborOn) {
        shouldBeOn = true; // Stay on
      } else {
        shouldBeOn = false; // Turn off
      }
    } else if (signalingType === 'and_gate') {
      // AND logic with probability
      if (signalNeighbors.length === 0) {
        shouldBeOn = false;
      } else {
        const allOn = signalNeighbors.every(neighbor =>
          newState.get(neighbor.index)?.on || previousState.get(neighbor.index)?.on
        );

        if (allOn && !prev.on) {
          // Trying to turn on
          if (randomFn() < prob) {
            const atpKey = findAdjacentAtp(residue.q, residue.r, atpPositions);
            if (atpKey) {
              shouldBeOn = true;
              consumedAtp.push(atpKey);
              atpPositions.delete(atpKey);
              activatedThisTick.push(residue.index);
            }
          }
        } else if (allOn) {
          shouldBeOn = true;
        } else {
          shouldBeOn = false;
        }
      }
    }

    newState.set(residue.index, { ...current, on: shouldBeOn });
  }

  return { state: newState, consumedAtp, activatedThisTick };
}

/**
 * Check if there's ATP adjacent to a position
 * @param {number} q
 * @param {number} r
 * @param {Set} atpPositions - Set of "q,r" strings
 * @returns {boolean}
 */
export function hasAdjacentAtp(q, r, atpPositions) {
  const neighbors = getNeighbors(q, r);
  return neighbors.some(n => atpPositions.has(`${n.q},${n.r}`));
}

/**
 * Find an adjacent ATP position
 * @param {number} q
 * @param {number} r
 * @param {Set} atpPositions - Set of "q,r" strings
 * @returns {string|null} The position key of found ATP, or null
 */
export function findAdjacentAtp(q, r, atpPositions) {
  const neighbors = getNeighbors(q, r);
  for (const n of neighbors) {
    const key = `${n.q},${n.r}`;
    if (atpPositions.has(key)) {
      return key;
    }
  }
  return null;
}

/**
 * High-level function to compute signals for a game state
 *
 * @param {Array} residues - [{index, type, q, r}, ...]
 * @param {Object} options - Configuration options
 * @param {Map} options.boundPairs - Map of residueIndex -> nucleotide
 * @param {Set} options.atpPositions - Set of "q,r" strings
 * @param {Map} options.previousState - Previous signal state (for tick mode)
 * @param {Object} options.config - Per-type propagation probabilities
 * @param {boolean} options.tickMode - If true, use tick-based propagation
 * @returns {Object} {state: Map, consumedAtp: string[], ...}
 */
export function computeSignals(residues, options = {}) {
  const {
    boundPairs = new Map(),
    atpPositions = new Set(),
    previousState = null,
    config = DEFAULT_SIGNAL_CONFIG,
    tickMode = false,
    randomFn = Math.random
  } = options;

  if (tickMode && previousState) {
    return computeTickUpdate(residues, previousState, boundPairs, atpPositions, config, randomFn);
  } else {
    return computeSteadyState(residues, boundPairs, atpPositions, config);
  }
}

// ES Module exports
export default {
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
};

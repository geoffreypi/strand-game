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
 * 1. Instant (stepped=false): Compute to steady-state in single call
 * 2. Stepped (stepped=true): One propagation step per call
 *
 * In both modes, probability controls chance of activation:
 * - prob=1.0: Always activates when conditions are met
 * - prob=0.75: 75% chance to activate when conditions are met
 */

import { getNeighbors } from '../core/hex-layout.js';
import {
  getSignalingType,
  canSignal,
  getBindingTarget
} from '../data/amino-acids.js';

/**
 * Default propagation probabilities per residue type
 * These apply regardless of stepped/instant mode
 */
export const DEFAULT_SIGNAL_CONFIG = {
  SIG: 0.75,   // 75% chance per step
  AND: 0.75,   // 75% chance per step (also requires ATP)
  PSH: 0.75,   // 75% chance per step
  ATR: 0.75,   // 75% chance per step
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
 * Sources start ON, everything else starts OFF
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
 * Compute ONE step of signal propagation
 * Each OFF residue with ON neighbor(s) has a chance to activate based on probability.
 *
 * @param {Array} residues - [{index, type, q, r}, ...]
 * @param {Map} currentState - Current signal state
 * @param {Map} positionMap - Position -> residue map
 * @param {Set} atpPositions - Set of "q,r" strings where ATP is present
 * @param {Object} config - Per-type propagation probabilities
 * @param {Function} randomFn - Random function (for testing)
 * @returns {Object} {state: Map, consumedAtp: string[], activatedThisTick: number[], changed: boolean}
 */
export function computeOneStep(
  residues,
  currentState,
  positionMap,
  atpPositions = new Set(),
  config = DEFAULT_SIGNAL_CONFIG,
  randomFn = Math.random
) {
  const newState = new Map();
  const consumedAtp = [];
  const activatedThisTick = [];
  let changed = false;

  // Copy current state first
  for (const [index, s] of currentState) {
    newState.set(index, { ...s });
  }

  for (const residue of residues) {
    const current = currentState.get(residue.index) || { on: false, source: false };

    // Sources always stay on
    if (current.source) continue;

    const signalingType = getSignalingType(residue.type);
    if (!signalingType) continue;

    const signalNeighbors = getSignalCapableNeighbors(residue.q, residue.r, positionMap);
    const prob = config[residue.type] ?? 1.0;

    let shouldBeOn = current.on;

    if (signalingType === 'conductor' || signalingType === 'actuator') {
      // OR logic: on if ANY neighbor is on
      const anyNeighborOn = signalNeighbors.some(neighbor => currentState.get(neighbor.index)?.on);

      if (anyNeighborOn && !current.on) {
        // Trying to turn on - roll probability
        if (randomFn() < prob) {
          shouldBeOn = true;
          activatedThisTick.push(residue.index);
        }
      } else if (anyNeighborOn) {
        shouldBeOn = true; // Stay on
      } else {
        shouldBeOn = false; // Turn off (neighbor went off)
      }
    } else if (signalingType === 'and_gate') {
      // AND logic: on if ALL signal-capable neighbors are on
      if (signalNeighbors.length === 0) {
        shouldBeOn = false;
      } else {
        const allOn = signalNeighbors.every(neighbor => currentState.get(neighbor.index)?.on);

        if (allOn && !current.on) {
          // Trying to turn on - need ATP and probability
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
          shouldBeOn = true; // Stay on
        } else {
          shouldBeOn = false; // Turn off
        }
      }
    }

    if (shouldBeOn !== current.on) {
      newState.set(residue.index, { ...current, on: shouldBeOn });
      changed = true;
    }
  }

  return { state: newState, consumedAtp, activatedThisTick, changed };
}

/**
 * Compute steady-state signal propagation (instant mode)
 * Iterates until no changes occur.
 * Uses probability on each step, but keeps iterating until stable.
 *
 * @param {Array} residues - [{index, type, q, r}, ...]
 * @param {Map} boundPairs - Map of residueIndex -> nucleotide
 * @param {Set} atpPositions - Set of "q,r" strings where ATP is present
 * @param {Object} config - Per-type propagation probabilities
 * @param {Function} randomFn - Random function (for testing)
 * @returns {Object} {state: Map, consumedAtp: string[], iterations: number}
 */
export function computeSteadyState(
  residues,
  boundPairs,
  atpPositions = new Set(),
  config = DEFAULT_SIGNAL_CONFIG,
  randomFn = Math.random
) {
  const positionMap = buildPositionMap(residues);
  let state = initializeSignalState(residues, boundPairs);

  const allConsumedAtp = [];
  let iterations = 0;
  const maxIterations = residues.length * 10; // Safety limit (with probability, may need more iterations)

  let changed = true;
  while (changed && iterations < maxIterations) {
    iterations++;
    const result = computeOneStep(residues, state, positionMap, atpPositions, config, randomFn);
    state = result.state;
    changed = result.changed;
    allConsumedAtp.push(...result.consumedAtp);
  }

  return { state, consumedAtp: allConsumedAtp, iterations };
}

/**
 * Compute one step of signal propagation (stepped mode)
 * Requires previous state to continue from.
 *
 * @param {Array} residues - [{index, type, q, r}, ...]
 * @param {Map} previousState - Previous signal state
 * @param {Map} boundPairs - Map of residueIndex -> nucleotide
 * @param {Set} atpPositions - Set of "q,r" strings where ATP is present
 * @param {Object} config - Per-type propagation probabilities
 * @param {Function} randomFn - Random function (for testing)
 * @returns {Object} {state: Map, consumedAtp: string[], activatedThisTick: number[]}
 */
export function computeSteppedUpdate(
  residues,
  previousState,
  boundPairs,
  atpPositions = new Set(),
  config = DEFAULT_SIGNAL_CONFIG,
  randomFn = Math.random
) {
  const positionMap = buildPositionMap(residues);

  // If no previous state, initialize from sources
  let state = previousState;
  if (!state || state.size === 0) {
    state = initializeSignalState(residues, boundPairs);
  }

  return computeOneStep(residues, state, positionMap, atpPositions, config, randomFn);
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
 * @param {Map} options.previousState - Previous signal state (required for stepped mode)
 * @param {Object} options.config - Per-type propagation probabilities
 * @param {boolean} options.stepped - If true, compute one step only; if false, compute to steady-state
 * @param {boolean} options.tickMode - DEPRECATED: Use 'stepped' instead
 * @param {Function} options.randomFn - Random function for testing
 * @returns {Object} {state: Map, consumedAtp: string[], ...}
 */
export function computeSignals(residues, options = {}) {
  const {
    boundPairs = new Map(),
    atpPositions = new Set(),
    previousState = null,
    config = DEFAULT_SIGNAL_CONFIG,
    stepped = false,
    tickMode = false, // Deprecated alias for stepped
    randomFn = Math.random
  } = options;

  // Support deprecated tickMode as alias for stepped
  const useStepped = stepped || tickMode;

  if (useStepped) {
    return computeSteppedUpdate(residues, previousState, boundPairs, atpPositions, config, randomFn);
  } else {
    return computeSteadyState(residues, boundPairs, atpPositions, config, randomFn);
  }
}

// Backwards compatibility alias
export const computeTickUpdate = computeSteppedUpdate;

// ES Module exports
export default {
  DEFAULT_SIGNAL_CONFIG,
  buildPositionMap,
  getAdjacentResidues,
  getSignalCapableNeighbors,
  isSignalSource,
  isActiveSource,
  initializeSignalState,
  computeOneStep,
  computeSteadyState,
  computeSteppedUpdate,
  computeTickUpdate, // Deprecated alias
  computeSignals,
  hasAdjacentAtp,
  findAdjacentAtp
};

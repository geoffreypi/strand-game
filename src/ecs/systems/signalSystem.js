/**
 * ECS Signal System
 *
 * Operates on World components to compute signal propagation.
 * This is an ECS-native version of the signal physics from physics/signal.js
 */

import { getNeighbors } from '../../core/hex-layout.js';
import {
  getSignalingType,
  canSignal,
  getBindingTarget
} from '../../data/amino-acids.js';
import { COMPONENT_TYPES } from '../components.js';
import { DEFAULT_SIGNAL_CONFIG } from '../../physics/signal.js';

/**
 * Build a position map from World components
 * @param {World} world
 * @returns {Map} Map of "q,r" -> {entityId, position, residue}
 */
function buildPositionMapFromWorld(world) {
  const map = new Map();
  const entityIds = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

  for (const entityId of entityIds) {
    const position = world.getComponent(entityId, COMPONENT_TYPES.POSITION);
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

    const key = `${position.q},${position.r}`;
    map.set(key, { entityId, position, residue });
  }

  return map;
}

/**
 * Get adjacent entities for a given position
 * @param {number} q
 * @param {number} r
 * @param {Map} positionMap
 * @returns {Array} Array of {entityId, position, residue}
 */
function getAdjacentEntities(q, r, positionMap) {
  const neighbors = getNeighbors(q, r);
  const adjacent = [];

  for (const neighbor of neighbors) {
    const key = `${neighbor.q},${neighbor.r}`;
    const entity = positionMap.get(key);
    if (entity) {
      adjacent.push(entity);
    }
  }

  return adjacent;
}

/**
 * Get signal-capable neighbors for an entity
 * @param {number} q
 * @param {number} r
 * @param {Map} positionMap
 * @returns {Array} Array of {entityId, position, residue}
 */
function getSignalCapableNeighbors(q, r, positionMap) {
  const adjacent = getAdjacentEntities(q, r, positionMap);
  return adjacent.filter(e =>
    canSignal(e.residue.type) || getBindingTarget(e.residue.type) !== null
  );
}

/**
 * Check if an entity is actively bound and producing signal
 * @param {Object} residue - Residue component
 * @param {Map} boundPairs - Map of residueIndex -> nucleotide
 * @returns {boolean}
 */
function isActiveSource(residue, boundPairs) {
  const bindTarget = getBindingTarget(residue.type);
  if (!bindTarget) return false;

  const boundTo = boundPairs.get(residue.index);
  if (!boundTo) return false;

  // BTT binds to both T and U
  if (bindTarget === 'T' && boundTo === 'U') return true;

  return boundTo === bindTarget;
}

/**
 * Initialize signal state for all entities
 * @param {World} world
 * @param {Map} boundPairs
 * @returns {Map} Map of residueIndex -> {on: boolean, source: boolean}
 */
function initializeSignalState(world, boundPairs) {
  const state = new Map();
  const entityIds = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

  for (const entityId of entityIds) {
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
    const isSource = isActiveSource(residue, boundPairs);

    state.set(residue.index, {
      on: isSource,
      source: isSource
    });
  }

  return state;
}

/**
 * Find connected components of SIG residues
 * @param {World} world
 * @param {Map} positionMap
 * @returns {Array<Set>} Array of Sets, each containing residue indices
 */
function findSigComponents(world, positionMap) {
  const entityIds = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);
  const sigEntities = [];

  for (const entityId of entityIds) {
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
    const position = world.getComponent(entityId, COMPONENT_TYPES.POSITION);

    if (getSignalingType(residue.type) === 'conductor') {
      sigEntities.push({ entityId, residue, position });
    }
  }

  const visited = new Set();
  const components = [];

  for (const sig of sigEntities) {
    if (visited.has(sig.residue.index)) continue;

    // DFS to find all connected SIGs
    const component = new Set();
    const stack = [sig];

    while (stack.length > 0) {
      const current = stack.pop();
      if (visited.has(current.residue.index)) continue;

      visited.add(current.residue.index);
      component.add(current.residue.index);

      // Find adjacent SIG neighbors
      const neighbors = getAdjacentEntities(current.position.q, current.position.r, positionMap);
      for (const neighbor of neighbors) {
        if (getSignalingType(neighbor.residue.type) === 'conductor' &&
            !visited.has(neighbor.residue.index)) {
          const neighborEntity = {
            entityId: neighbor.entityId,
            residue: neighbor.residue,
            position: neighbor.position
          };
          stack.push(neighborEntity);
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Find an adjacent ATP position
 * @param {number} q
 * @param {number} r
 * @param {Set} atpPositions
 * @returns {string|null}
 */
function findAdjacentAtp(q, r, atpPositions) {
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
 * Compute ONE step of signal propagation using World components
 * @param {World} world
 * @param {Map} currentState - Current signal state
 * @param {Map} positionMap - Position map built from world
 * @param {Set} atpPositions - Set of "q,r" strings
 * @param {Object} config - Per-type propagation probabilities
 * @param {Function} randomFn - Random function
 * @returns {Object} {state, consumedAtp, activatedThisTick, changed}
 */
function computeOneStep(
  world,
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

  // Copy current state
  for (const [index, s] of currentState) {
    newState.set(index, { ...s });
  }

  // PHASE 1: Process SIG components (instant propagation)
  const sigComponents = findSigComponents(world, positionMap);

  for (const component of sigComponents) {
    let shouldBeOn = false;

    // Check if ANY SIG in this component has an ON source neighbor
    for (const sigIndex of component) {
      // Find the entity for this SIG
      const entityIds = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);
      let sig = null;

      for (const entityId of entityIds) {
        const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
        const position = world.getComponent(entityId, COMPONENT_TYPES.POSITION);
        if (residue.index === sigIndex) {
          sig = { entityId, residue, position };
          break;
        }
      }

      if (!sig) continue;

      const neighbors = getSignalCapableNeighbors(sig.position.q, sig.position.r, positionMap);

      // Check for ON neighbors that are NOT other SIGs in this component
      for (const neighbor of neighbors) {
        if (component.has(neighbor.residue.index)) continue;

        if (currentState.get(neighbor.residue.index)?.on) {
          shouldBeOn = true;
          break;
        }
      }

      if (shouldBeOn) break;
    }

    // Set entire component to same state
    for (const sigIndex of component) {
      const current = currentState.get(sigIndex) || { on: false, source: false };
      if (shouldBeOn !== current.on) {
        newState.set(sigIndex, { ...current, on: shouldBeOn });
        changed = true;
        if (shouldBeOn) {
          activatedThisTick.push(sigIndex);
        }
      }
    }
  }

  // PHASE 2: Process non-SIG residues (gates, ports, actuators)
  const entityIds = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

  for (const entityId of entityIds) {
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
    const position = world.getComponent(entityId, COMPONENT_TYPES.POSITION);

    const current = currentState.get(residue.index) || { on: false, source: false };

    // Sources always stay on
    if (current.source) continue;

    const signalingType = getSignalingType(residue.type);
    if (!signalingType) continue;

    // Skip SIG (already processed in Phase 1)
    if (signalingType === 'conductor') continue;

    const signalNeighbors = getSignalCapableNeighbors(position.q, position.r, positionMap);
    const prob = config[residue.type] ?? 1.0;

    let shouldBeOn = current.on;

    if (signalingType === 'actuator') {
      // OR logic: on if ANY neighbor is on
      const anyNeighborOn = signalNeighbors.some(n => newState.get(n.residue.index)?.on);

      if (anyNeighborOn && !current.on) {
        if (randomFn() < prob) {
          shouldBeOn = true;
          activatedThisTick.push(residue.index);
        }
      } else if (anyNeighborOn) {
        shouldBeOn = true;
      } else {
        shouldBeOn = false;
      }
    } else if (signalingType === 'input_port') {
      // INP: OR of adjacent sources (SIG, BTx, OUT)
      const sourceNeighbors = signalNeighbors.filter(n => {
        const nType = getSignalingType(n.residue.type);
        return nType === 'conductor' || nType === 'output_port' ||
               getBindingTarget(n.residue.type) !== null;
      });
      const anySourceOn = sourceNeighbors.some(n => newState.get(n.residue.index)?.on);

      if (anySourceOn && !current.on) {
        if (randomFn() < prob) {
          shouldBeOn = true;
          activatedThisTick.push(residue.index);
        }
      } else if (anySourceOn) {
        shouldBeOn = true;
      } else {
        shouldBeOn = false;
      }
    } else if (signalingType === 'output_port') {
      // OUT: OR of adjacent gates (AND, NOT) OR routed from SGX
      const gateNeighbors = signalNeighbors.filter(n => {
        const nType = getSignalingType(n.residue.type);
        return nType === 'and_gate' || nType === 'not_gate';
      });
      const anyGateOn = gateNeighbors.some(n => newState.get(n.residue.index)?.on);

      // Check if routed through SGX crossroads
      const sgxNeighbors = signalNeighbors.filter(n =>
        getSignalingType(n.residue.type) === 'crossroads'
      );
      let routedFromSgx = false;

      for (const sgx of sgxNeighbors) {
        // Calculate diametrically opposite position
        const dq = position.q - sgx.position.q;
        const dr = position.r - sgx.position.r;
        const oppositeQ = sgx.position.q - dq;
        const oppositeR = sgx.position.r - dr;
        const oppositeKey = `${oppositeQ},${oppositeR}`;
        const oppositeEntity = positionMap.get(oppositeKey);

        // Check if opposite is an INP that's ON
        if (oppositeEntity &&
            getSignalingType(oppositeEntity.residue.type) === 'input_port') {
          if (newState.get(oppositeEntity.residue.index)?.on) {
            routedFromSgx = true;
            break;
          }
        }
      }

      const shouldActivate = anyGateOn || routedFromSgx;

      if (shouldActivate && !current.on) {
        if (randomFn() < prob) {
          shouldBeOn = true;
          activatedThisTick.push(residue.index);
        }
      } else if (shouldActivate) {
        shouldBeOn = true;
      } else {
        shouldBeOn = false;
      }
    } else if (signalingType === 'and_gate') {
      // AND logic: on if ALL adjacent INP residues are on + ATP
      const inpNeighbors = signalNeighbors.filter(n =>
        getSignalingType(n.residue.type) === 'input_port'
      );

      if (inpNeighbors.length === 0) {
        shouldBeOn = false;
      } else {
        const allOn = inpNeighbors.every(n => newState.get(n.residue.index)?.on);

        if (allOn && !current.on) {
          if (randomFn() < prob) {
            const atpKey = findAdjacentAtp(position.q, position.r, atpPositions);
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
    } else if (signalingType === 'not_gate') {
      // NOT logic: on if ALL adjacent INP residues are OFF + ATP
      const inpNeighbors = signalNeighbors.filter(n =>
        getSignalingType(n.residue.type) === 'input_port'
      );

      if (inpNeighbors.length === 0) {
        shouldBeOn = false;
      } else {
        const allOff = inpNeighbors.every(n => !newState.get(n.residue.index)?.on);

        if (allOff && !current.on) {
          if (randomFn() < prob) {
            const atpKey = findAdjacentAtp(position.q, position.r, atpPositions);
            if (atpKey) {
              shouldBeOn = true;
              consumedAtp.push(atpKey);
              atpPositions.delete(atpKey);
              activatedThisTick.push(residue.index);
            }
          }
        } else if (allOff) {
          shouldBeOn = true;
        } else {
          shouldBeOn = false;
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
 * Compute steady-state signal propagation
 * @param {World} world
 * @param {Map} boundPairs
 * @param {Set} atpPositions
 * @param {Object} config
 * @param {Function} randomFn
 * @returns {Object} {state, consumedAtp, iterations}
 */
function computeSteadyState(
  world,
  boundPairs,
  atpPositions = new Set(),
  config = DEFAULT_SIGNAL_CONFIG,
  randomFn = Math.random
) {
  const positionMap = buildPositionMapFromWorld(world);
  let state = initializeSignalState(world, boundPairs);

  const allConsumedAtp = [];
  let iterations = 0;
  const maxIterations = world.entityCount * 10;

  let changed = true;
  while (changed && iterations < maxIterations) {
    iterations++;
    const result = computeOneStep(world, state, positionMap, atpPositions, config, randomFn);
    state = result.state;
    changed = result.changed;
    allConsumedAtp.push(...result.consumedAtp);
  }

  return { state, consumedAtp: allConsumedAtp, iterations };
}

/**
 * Compute one step of signal propagation
 * @param {World} world
 * @param {Map} previousState
 * @param {Map} boundPairs
 * @param {Set} atpPositions
 * @param {Object} config
 * @param {Function} randomFn
 * @returns {Object} {state, consumedAtp, activatedThisTick}
 */
function computeSteppedUpdate(
  world,
  previousState,
  boundPairs,
  atpPositions = new Set(),
  config = DEFAULT_SIGNAL_CONFIG,
  randomFn = Math.random
) {
  const positionMap = buildPositionMapFromWorld(world);

  // If no previous state, initialize from sources
  let state = previousState;
  if (!state || state.size === 0) {
    state = initializeSignalState(world, boundPairs);
  }

  return computeOneStep(world, state, positionMap, atpPositions, config, randomFn);
}

/**
 * Main ECS signal system
 * @param {World} world
 * @param {Object} options
 * @returns {Object} {state, consumedAtp, ...}
 */
export function signalSystem(world, options = {}) {
  const {
    boundPairs = new Map(),
    atpPositions = new Set(),
    previousState = null,
    config = DEFAULT_SIGNAL_CONFIG,
    stepped = false,
    randomFn = Math.random
  } = options;

  if (stepped) {
    return computeSteppedUpdate(world, previousState, boundPairs, atpPositions, config, randomFn);
  } else {
    return computeSteadyState(world, boundPairs, atpPositions, config, randomFn);
  }
}

/**
 * Pure ECS Signal System
 *
 * Operates directly on SignalComponent - no external state Maps.
 * Reads and writes signal state to/from components.
 */

import { getNeighbors } from '../../core/hex-layout.js';
import {
  getSignalingType,
  getBindingTarget
} from '../../data/amino-acids.js';
import { COMPONENT_TYPES } from '../components.js';
import { DEFAULT_SIGNAL_CONFIG } from '../../physics/signal.js';

/**
 * Initialize signal states from bindings
 * Sets SignalComponent.source = true for bound BTx residues
 * @param {World} world
 * @param {Map} boundPairs - Map of residueIndex -> nucleotide type
 */
function initializeFromBindings(world, boundPairs) {
  const entityIds = world.query([COMPONENT_TYPES.SIGNAL]);

  for (const entityId of entityIds) {
    const signal = world.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

    // Check if this residue is a bound source
    const bindTarget = getBindingTarget(residue.type);
    if (bindTarget && boundPairs.has(residue.index)) {
      const boundTo = boundPairs.get(residue.index);
      const isSource = boundTo === bindTarget || (bindTarget === 'T' && boundTo === 'U');

      signal.source = isSource;
      signal.on = isSource;
    } else {
      signal.source = false;
      signal.on = false;
    }
  }
}

/**
 * Build position map for spatial queries
 * @param {World} world
 * @returns {Map} "q,r" -> entityId
 */
function buildPositionMap(world) {
  const map = new Map();
  const entityIds = world.query([COMPONENT_TYPES.POSITION]);

  for (const entityId of entityIds) {
    const position = world.getComponent(entityId, COMPONENT_TYPES.POSITION);
    const key = `${position.q},${position.r}`;
    map.set(key, entityId);
  }

  return map;
}

/**
 * Get adjacent entities with Signal component
 * @param {number} q
 * @param {number} r
 * @param {Map} positionMap
 * @param {World} world
 * @returns {Array} Array of entityIds
 */
function getSignalCapableNeighbors(q, r, positionMap, world) {
  const neighbors = getNeighbors(q, r);
  const adjacent = [];

  for (const neighbor of neighbors) {
    const key = `${neighbor.q},${neighbor.r}`;
    const entityId = positionMap.get(key);

    if (entityId !== undefined && world.hasComponent(entityId, COMPONENT_TYPES.SIGNAL)) {
      adjacent.push(entityId);
    }
  }

  return adjacent;
}

/**
 * Find connected components of SIG residues
 * @param {World} world
 * @param {Map} positionMap
 * @returns {Array<Set>} Array of Sets, each containing entityIds
 */
function findSigComponents(world, positionMap) {
  const sigEntities = [];
  const entityIds = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE, COMPONENT_TYPES.SIGNAL]);

  for (const entityId of entityIds) {
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
    if (getSignalingType(residue.type) === 'conductor') {
      sigEntities.push(entityId);
    }
  }

  const visited = new Set();
  const components = [];

  for (const sigEntity of sigEntities) {
    if (visited.has(sigEntity)) continue;

    // DFS to find connected SIGs
    const component = new Set();
    const stack = [sigEntity];

    while (stack.length > 0) {
      const current = stack.pop();
      if (visited.has(current)) continue;

      visited.add(current);
      component.add(current);

      const position = world.getComponent(current, COMPONENT_TYPES.POSITION);
      const neighbors = getNeighbors(position.q, position.r);

      for (const neighbor of neighbors) {
        const key = `${neighbor.q},${neighbor.r}`;
        const neighborId = positionMap.get(key);

        if (neighborId !== undefined && !visited.has(neighborId)) {
          const neighborResidue = world.getComponent(neighborId, COMPONENT_TYPES.RESIDUE);
          if (neighborResidue && getSignalingType(neighborResidue.type) === 'conductor') {
            stack.push(neighborId);
          }
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Find adjacent ATP position
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
 * Compute one step of signal propagation
 * Reads and writes SignalComponent directly
 * @param {World} world
 * @param {Set} atpPositions - Set of "q,r" strings
 * @param {Object} config - Per-type propagation probabilities
 * @param {Function} randomFn - Random function
 * @returns {Object} {consumedAtp: string[], changed: boolean}
 */
export function computeOneStep(
  world,
  atpPositions = new Set(),
  config = DEFAULT_SIGNAL_CONFIG,
  randomFn = Math.random
) {
  const consumedAtp = [];
  let changed = false;

  const positionMap = buildPositionMap(world);

  // Store new states temporarily
  const newStates = new Map(); // entityId -> {on, source}

  // Read current states
  const entityIds = world.query([COMPONENT_TYPES.SIGNAL]);
  for (const entityId of entityIds) {
    const signal = world.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
    newStates.set(entityId, { on: signal.on, source: signal.source });
  }

  // PHASE 1: Process SIG components (instant propagation)
  const sigComponents = findSigComponents(world, positionMap);

  for (const component of sigComponents) {
    let shouldBeOn = false;

    // Check if ANY SIG in this component has an ON source neighbor
    for (const sigEntity of component) {
      const position = world.getComponent(sigEntity, COMPONENT_TYPES.POSITION);
      const neighbors = getSignalCapableNeighbors(position.q, position.r, positionMap, world);

      for (const neighborId of neighbors) {
        if (component.has(neighborId)) continue; // Skip same component

        const currentState = newStates.get(neighborId);
        if (currentState && currentState.on) {
          shouldBeOn = true;
          break;
        }
      }

      if (shouldBeOn) break;
    }

    // Update entire component
    for (const sigEntity of component) {
      const currentState = newStates.get(sigEntity);
      if (shouldBeOn !== currentState.on) {
        newStates.set(sigEntity, { ...currentState, on: shouldBeOn });
        changed = true;
      }
    }
  }

  // PHASE 2: Process non-SIG residues
  const allEntities = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE, COMPONENT_TYPES.SIGNAL]);

  for (const entityId of allEntities) {
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
    const position = world.getComponent(entityId, COMPONENT_TYPES.POSITION);
    const currentState = newStates.get(entityId);

    // Sources stay on
    if (currentState.source) continue;

    const signalingType = getSignalingType(residue.type);
    if (!signalingType || signalingType === 'conductor') continue;

    const signalNeighbors = getSignalCapableNeighbors(position.q, position.r, positionMap, world);
    const prob = config[residue.type] ?? 1.0;

    let shouldBeOn = currentState.on;

    if (signalingType === 'actuator') {
      const anyNeighborOn = signalNeighbors.some(nId => newStates.get(nId)?.on);

      if (anyNeighborOn && !currentState.on) {
        if (randomFn() < prob) {
          shouldBeOn = true;
        }
      } else if (anyNeighborOn) {
        shouldBeOn = true;
      } else {
        shouldBeOn = false;
      }
    } else if (signalingType === 'input_port') {
      const sourceNeighbors = signalNeighbors.filter(nId => {
        const nResidue = world.getComponent(nId, COMPONENT_TYPES.RESIDUE);
        const nType = getSignalingType(nResidue.type);
        return nType === 'conductor' || nType === 'output_port' || getBindingTarget(nResidue.type) !== null;
      });
      const anySourceOn = sourceNeighbors.some(nId => newStates.get(nId)?.on);

      if (anySourceOn && !currentState.on) {
        if (randomFn() < prob) {
          shouldBeOn = true;
        }
      } else if (anySourceOn) {
        shouldBeOn = true;
      } else {
        shouldBeOn = false;
      }
    } else if (signalingType === 'output_port') {
      const gateNeighbors = signalNeighbors.filter(nId => {
        const nResidue = world.getComponent(nId, COMPONENT_TYPES.RESIDUE);
        const nType = getSignalingType(nResidue.type);
        return nType === 'and_gate' || nType === 'not_gate';
      });
      const anyGateOn = gateNeighbors.some(nId => newStates.get(nId)?.on);

      // Check SGX routing
      const sgxNeighbors = signalNeighbors.filter(nId => {
        const nResidue = world.getComponent(nId, COMPONENT_TYPES.RESIDUE);
        return getSignalingType(nResidue.type) === 'crossroads';
      });
      let routedFromSgx = false;

      for (const sgxId of sgxNeighbors) {
        const sgxPos = world.getComponent(sgxId, COMPONENT_TYPES.POSITION);
        const dq = position.q - sgxPos.q;
        const dr = position.r - sgxPos.r;
        const oppositeQ = sgxPos.q - dq;
        const oppositeR = sgxPos.r - dr;
        const oppositeKey = `${oppositeQ},${oppositeR}`;
        const oppositeId = positionMap.get(oppositeKey);

        if (oppositeId !== undefined) {
          const oppResidue = world.getComponent(oppositeId, COMPONENT_TYPES.RESIDUE);
          if (oppResidue && getSignalingType(oppResidue.type) === 'input_port') {
            if (newStates.get(oppositeId)?.on) {
              routedFromSgx = true;
              break;
            }
          }
        }
      }

      const shouldActivate = anyGateOn || routedFromSgx;

      if (shouldActivate && !currentState.on) {
        if (randomFn() < prob) {
          shouldBeOn = true;
        }
      } else if (shouldActivate) {
        shouldBeOn = true;
      } else {
        shouldBeOn = false;
      }
    } else if (signalingType === 'and_gate') {
      const inpNeighbors = signalNeighbors.filter(nId => {
        const nResidue = world.getComponent(nId, COMPONENT_TYPES.RESIDUE);
        return getSignalingType(nResidue.type) === 'input_port';
      });

      if (inpNeighbors.length === 0) {
        shouldBeOn = false;
      } else {
        const allOn = inpNeighbors.every(nId => newStates.get(nId)?.on);

        if (allOn && !currentState.on) {
          if (randomFn() < prob) {
            const atpKey = findAdjacentAtp(position.q, position.r, atpPositions);
            if (atpKey) {
              shouldBeOn = true;
              consumedAtp.push(atpKey);
              atpPositions.delete(atpKey);
            }
          }
        } else if (allOn) {
          shouldBeOn = true;
        } else {
          shouldBeOn = false;
        }
      }
    } else if (signalingType === 'not_gate') {
      const inpNeighbors = signalNeighbors.filter(nId => {
        const nResidue = world.getComponent(nId, COMPONENT_TYPES.RESIDUE);
        return getSignalingType(nResidue.type) === 'input_port';
      });

      if (inpNeighbors.length === 0) {
        shouldBeOn = false;
      } else {
        const allOff = inpNeighbors.every(nId => !newStates.get(nId)?.on);

        if (allOff && !currentState.on) {
          if (randomFn() < prob) {
            const atpKey = findAdjacentAtp(position.q, position.r, atpPositions);
            if (atpKey) {
              shouldBeOn = true;
              consumedAtp.push(atpKey);
              atpPositions.delete(atpKey);
            }
          }
        } else if (allOff) {
          shouldBeOn = true;
        } else {
          shouldBeOn = false;
        }
      }
    }

    if (shouldBeOn !== currentState.on) {
      newStates.set(entityId, { ...currentState, on: shouldBeOn });
      changed = true;
    }
  }

  // Write new states back to components
  for (const [entityId, newState] of newStates) {
    const signal = world.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
    signal.on = newState.on;
    signal.source = newState.source;
  }

  return { consumedAtp, changed };
}

/**
 * Compute steady-state signal propagation
 * @param {World} world
 * @param {Map} boundPairs
 * @param {Set} atpPositions
 * @param {Object} config
 * @param {Function} randomFn
 * @returns {Object} {consumedAtp, iterations}
 */
export function computeSteadyState(
  world,
  boundPairs,
  atpPositions = new Set(),
  config = DEFAULT_SIGNAL_CONFIG,
  randomFn = Math.random
) {
  // Initialize from bindings
  initializeFromBindings(world, boundPairs);

  const allConsumedAtp = [];
  let iterations = 0;
  const maxIterations = world.entityCount * 10;

  let changed = true;
  while (changed && iterations < maxIterations) {
    iterations++;
    const result = computeOneStep(world, atpPositions, config, randomFn);
    changed = result.changed;
    allConsumedAtp.push(...result.consumedAtp);
  }

  return { consumedAtp: allConsumedAtp, iterations };
}

/**
 * Pure ECS signal system entry point
 * @param {World} world
 * @param {Object} options
 * @returns {Object} {consumedAtp, ...}
 */
export function signalSystemPure(world, options = {}) {
  const {
    boundPairs = new Map(),
    atpPositions = new Set(),
    stepped = false,
    config = DEFAULT_SIGNAL_CONFIG,
    randomFn = Math.random
  } = options;

  if (stepped) {
    // For stepped mode, assume signals are already initialized
    // Just compute one step
    return computeOneStep(world, atpPositions, config, randomFn);
  } else {
    return computeSteadyState(world, boundPairs, atpPositions, config, randomFn);
  }
}

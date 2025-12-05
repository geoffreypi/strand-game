/**
 * ECS Energy System
 *
 * Operates on World components to:
 * - Process ATR (Attractor) residues that spawn ATP
 * - Calculate energy (folding, electrostatic, hydrophobic, binding)
 * - Manage ATP molecules
 */

import { getNeighbors } from '../../core/hex-layout.js';
import {
  AMINO_ACID_TYPES,
  ENERGY_CONSTANTS,
  getBindingTarget
} from '../../data/amino-acids.js';
import { COMPONENT_TYPES } from '../components.js';

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
 * Check if a position is occupied
 * @param {number} q
 * @param {number} r
 * @param {Map} positionMap
 * @returns {boolean}
 */
function isOccupied(q, r, positionMap) {
  const key = `${q},${r}`;
  return positionMap.has(key);
}

/**
 * Find an unoccupied hex adjacent to a position
 * @param {number} q
 * @param {number} r
 * @param {Map} positionMap
 * @param {Function} randomFn
 * @returns {Object|null} {q, r} of empty hex, or null if all occupied
 */
function findEmptyAdjacentHex(q, r, positionMap, randomFn = Math.random) {
  const neighbors = getNeighbors(q, r);

  // Collect all empty neighbors
  const emptyNeighbors = neighbors.filter(n => !isOccupied(n.q, n.r, positionMap));

  if (emptyNeighbors.length === 0) {
    return null;
  }

  // Randomly select one
  const index = Math.floor(randomFn() * emptyNeighbors.length);
  const selected = emptyNeighbors[index];
  return { q: selected.q, r: selected.r };
}

/**
 * Process ATR (Attractor) residues
 * When signaled, ATR has a chance to spawn ATP in an adjacent empty hex
 *
 * @param {World} world
 * @param {Object} options
 * @param {Map} options.signalState - Current signal state (residueIndex -> {on, source})
 * @param {Function} options.onSpawnATP - Callback to spawn ATP: (q, r) => {moleculeId}
 * @param {number} options.attractChance - Probability of attraction per tick
 * @param {Function} options.randomFn - Random function for testing
 * @returns {Object} {attracted: [{moleculeId, q, r}, ...], count: number}
 */
export function processATRs(world, options = {}) {
  const {
    signalState = new Map(),
    onSpawnATP = null,
    attractChance = 0.75,
    randomFn = Math.random
  } = options;

  if (!onSpawnATP) {
    throw new Error('processATRs requires onSpawnATP callback');
  }

  const positionMap = buildPositionMapFromWorld(world);
  const attracted = [];

  const entityIds = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

  for (const entityId of entityIds) {
    const position = world.getComponent(entityId, COMPONENT_TYPES.POSITION);
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

    // Only process ATR residues
    if (residue.type !== 'ATR') continue;

    // Must be signaled (activated)
    if (!signalState.get(residue.index)?.on) continue;

    // Roll for attraction
    if (randomFn() >= attractChance) continue;

    // Find an unoccupied adjacent hex
    const emptyHex = findEmptyAdjacentHex(position.q, position.r, positionMap, randomFn);
    if (!emptyHex) continue;

    // Spawn ATP via callback
    const result = onSpawnATP(emptyHex.q, emptyHex.r);

    attracted.push({
      moleculeId: result.moleculeId,
      q: emptyHex.q,
      r: emptyHex.r
    });
  }

  return { attracted, count: attracted.length };
}

/**
 * Get all ATP positions from World
 * @param {World} world
 * @returns {Set} Set of "q,r" strings
 */
export function getATPPositions(world) {
  const positions = new Set();
  const entityIds = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

  for (const entityId of entityIds) {
    const position = world.getComponent(entityId, COMPONENT_TYPES.POSITION);
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

    if (residue.type === 'ATP') {
      positions.add(`${position.q},${position.r}`);
    }
  }

  return positions;
}

/**
 * Calculate total energy of the complex
 * @param {World} world
 * @param {Map} bindings - Map of residueIndex -> nucleotide type
 * @returns {number} Total energy in eV
 */
export function calculateEnergy(world, bindings = new Map()) {
  let energy = 0;

  // Folding preference energy
  energy += calculateFoldingEnergy(world);

  // Electrostatic energy
  energy += calculateElectrostaticEnergy(world);

  // Hydrophobic energy
  energy += calculateHydrophobicEnergy(world);

  // Binding energy
  energy += calculateBindingEnergy(bindings);

  return energy;
}

/**
 * Calculate folding preference energy
 * @param {World} world
 * @returns {number} Energy in eV
 */
function calculateFoldingEnergy(world) {
  let energy = 0;

  // Query all molecule metadata components
  const metaEntityIds = world.query([COMPONENT_TYPES.MOLECULE_META]);

  for (const metaEntityId of metaEntityIds) {
    const meta = world.getComponent(metaEntityId, COMPONENT_TYPES.MOLECULE_META);
    const mol = meta.molecule;

    for (let i = 0; i < mol.length; i++) {
      const type = mol.getTypeAt(i);
      const aa = AMINO_ACID_TYPES[type];
      if (!aa || aa.foldingPreference === null) continue;

      const currentFold = mol.getFoldAt(i);
      const preferredSteps = aa.preferredSteps || 0;
      const distance = Math.abs(currentFold - preferredSteps);

      energy += ENERGY_CONSTANTS.ANGULAR_PENALTY * distance;
    }
  }

  return energy;
}

/**
 * Calculate electrostatic energy
 * @param {World} world
 * @returns {number} Energy in eV
 */
function calculateElectrostaticEnergy(world) {
  let energy = 0;
  const counted = new Set();
  const positionMap = buildPositionMapFromWorld(world);

  const entityIds = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

  for (const entityId of entityIds) {
    const position = world.getComponent(entityId, COMPONENT_TYPES.POSITION);
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

    const aa = AMINO_ACID_TYPES[residue.type];
    if (!aa || aa.charge === 0) continue;

    const neighbors = getAdjacentEntities(position.q, position.r, positionMap);
    for (const neighbor of neighbors) {
      const neighborAa = AMINO_ACID_TYPES[neighbor.residue.type];
      if (!neighborAa || neighborAa.charge === 0) continue;

      // Avoid double-counting pairs
      const pairKey = [
        `${position.moleculeId}:${residue.index}`,
        `${neighbor.position.moleculeId}:${neighbor.residue.index}`
      ].sort().join('|');

      if (counted.has(pairKey)) continue;
      counted.add(pairKey);

      // Coulomb energy: opposite charges attract (negative), same repel (positive)
      energy += ENERGY_CONSTANTS.COULOMB_CONSTANT * aa.charge * neighborAa.charge;
    }
  }

  return energy;
}

/**
 * Calculate hydrophobic energy
 * @param {World} world
 * @returns {number} Energy in eV
 */
function calculateHydrophobicEnergy(world) {
  let energy = 0;
  const positionMap = buildPositionMapFromWorld(world);

  const entityIds = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

  for (const entityId of entityIds) {
    const position = world.getComponent(entityId, COMPONENT_TYPES.POSITION);
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

    const aa = AMINO_ACID_TYPES[residue.type];
    if (!aa) continue;

    const neighbors = getAdjacentEntities(position.q, position.r, positionMap);
    const neighborCount = neighbors.length;
    const isBuried = neighborCount >= 4; // Somewhat arbitrary threshold

    if (aa.hydrophobicity === 'hydrophobic') {
      if (isBuried) {
        energy += ENERGY_CONSTANTS.HYDROPHOBIC_BURIAL;
      } else {
        energy += ENERGY_CONSTANTS.HYDROPHOBIC_EXPOSURE;
      }
    } else if (aa.hydrophobicity === 'hydrophilic') {
      if (isBuried) {
        energy += ENERGY_CONSTANTS.HYDROPHILIC_BURIAL;
      } else {
        energy += ENERGY_CONSTANTS.HYDROPHILIC_EXPOSURE;
      }
    }
  }

  return energy;
}

/**
 * Calculate binding energy (BTx to nucleotide)
 * @param {Map} bindings - Map of residueIndex -> nucleotide type
 * @returns {number} Energy in eV
 */
function calculateBindingEnergy(bindings) {
  // Each successful binding provides favorable energy
  return bindings.size * -1.0; // -1 eV per binding
}

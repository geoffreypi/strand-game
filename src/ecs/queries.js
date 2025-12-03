/**
 * Query helper functions for common ECS patterns
 */

import { COMPONENT_TYPES } from './components.js';

/**
 * Get all residues with their positions
 * @param {World} world
 * @returns {Array<{entity: number, position: object, residue: object}>}
 */
export function queryResiduesWithPositions(world) {
  const entities = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);
  return entities.map(entity => ({
    entity,
    position: world.getComponent(entity, COMPONENT_TYPES.POSITION),
    residue: world.getComponent(entity, COMPONENT_TYPES.RESIDUE),
  }));
}

/**
 * Get all signaling residues with their positions and signal state
 * @param {World} world
 * @returns {Array<{entity: number, position: object, residue: object, signal: object}>}
 */
export function querySignalingResidues(world) {
  const entities = world.query([
    COMPONENT_TYPES.POSITION,
    COMPONENT_TYPES.RESIDUE,
    COMPONENT_TYPES.SIGNAL,
  ]);
  return entities.map(entity => ({
    entity,
    position: world.getComponent(entity, COMPONENT_TYPES.POSITION),
    residue: world.getComponent(entity, COMPONENT_TYPES.RESIDUE),
    signal: world.getComponent(entity, COMPONENT_TYPES.SIGNAL),
  }));
}

/**
 * Get all bonds in the world
 * @param {World} world
 * @returns {Array<{entity: number, bond: object}>}
 */
export function queryBonds(world) {
  const entities = world.query([COMPONENT_TYPES.BOND]);
  return entities.map(entity => ({
    entity,
    bond: world.getComponent(entity, COMPONENT_TYPES.BOND),
  }));
}

/**
 * Get all bonds of a specific type
 * @param {World} world
 * @param {string} bondType - '+' or '-'
 * @returns {Array<{entity: number, bond: object}>}
 */
export function queryBondsByType(world, bondType) {
  const allBonds = queryBonds(world);
  return allBonds.filter(({ bond }) => bond.bondType === bondType);
}

/**
 * Get all bonds involving a specific entity
 * @param {World} world
 * @param {number} targetEntity - Entity ID to find bonds for
 * @returns {Array<{entity: number, bond: object}>}
 */
export function queryBondsToEntity(world, targetEntity) {
  const allBonds = queryBonds(world);
  return allBonds.filter(({ bond }) => bond.targetEntity === targetEntity);
}

/**
 * Get all ATP molecules with their positions
 * @param {World} world
 * @returns {Array<{entity: number, position: object, atp: object}>}
 */
export function queryATP(world) {
  const entities = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.ATP]);
  return entities.map(entity => ({
    entity,
    position: world.getComponent(entity, COMPONENT_TYPES.POSITION),
    atp: world.getComponent(entity, COMPONENT_TYPES.ATP),
  }));
}

/**
 * Get all ADP molecules with their positions
 * @param {World} world
 * @returns {Array<{entity: number, position: object, adp: object}>}
 */
export function queryADP(world) {
  const entities = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.ADP]);
  return entities.map(entity => ({
    entity,
    position: world.getComponent(entity, COMPONENT_TYPES.ADP),
    adp: world.getComponent(entity, COMPONENT_TYPES.ADP),
  }));
}

/**
 * Get all residues of a specific type
 * @param {World} world
 * @param {string} residueType - e.g., 'SIG', 'AND', 'BTx'
 * @returns {Array<{entity: number, position: object, residue: object}>}
 */
export function queryResiduesByType(world, residueType) {
  const all = queryResiduesWithPositions(world);
  return all.filter(({ residue }) => residue.type === residueType);
}

/**
 * Get all residues belonging to a specific molecule
 * @param {World} world
 * @param {string} moleculeId
 * @returns {Array<{entity: number, position: object, residue: object}>}
 */
export function queryResiduesByMolecule(world, moleculeId) {
  const all = queryResiduesWithPositions(world);
  return all.filter(({ position }) => position.moleculeId === moleculeId);
}

/**
 * Build a position map for fast spatial lookups
 * @param {World} world
 * @returns {Map<string, number>} Map of 'q,r' -> entityId
 */
export function buildPositionMap(world) {
  const positionMap = new Map();
  const positions = world.getComponents(COMPONENT_TYPES.POSITION);

  for (const [entityId, position] of positions) {
    const key = `${position.q},${position.r}`;
    positionMap.set(key, entityId);
  }

  return positionMap;
}

/**
 * Get entity at a specific position
 * @param {World} world
 * @param {number} q
 * @param {number} r
 * @returns {number|undefined} Entity ID or undefined if no entity at that position
 */
export function getEntityAtPosition(world, q, r) {
  const positions = world.getComponents(COMPONENT_TYPES.POSITION);

  for (const [entityId, position] of positions) {
    if (position.q === q && position.r === r) {
      return entityId;
    }
  }

  return undefined;
}

/**
 * Get all entities adjacent to a position (hex grid neighbors)
 * @param {World} world
 * @param {number} q
 * @param {number} r
 * @returns {Array<{entity: number, position: object}>}
 */
export function getAdjacentEntities(world, q, r) {
  // Hex grid neighbor offsets (pointy-top)
  const neighborOffsets = [
    { dq: 1, dr: 0 },
    { dq: 1, dr: -1 },
    { dq: 0, dr: -1 },
    { dq: -1, dr: 0 },
    { dq: -1, dr: 1 },
    { dq: 0, dr: 1 },
  ];

  const adjacent = [];
  const positions = world.getComponents(COMPONENT_TYPES.POSITION);

  for (const offset of neighborOffsets) {
    const neighborQ = q + offset.dq;
    const neighborR = r + offset.dr;

    for (const [entityId, position] of positions) {
      if (position.q === neighborQ && position.r === neighborR) {
        adjacent.push({ entity: entityId, position });
        break; // Only one entity per position
      }
    }
  }

  return adjacent;
}

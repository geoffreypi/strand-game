/**
 * Component type definitions for the ECS
 *
 * Components are pure data - no methods, just properties
 * Factory functions create component instances with default values
 */

/**
 * Position in hex grid
 * @typedef {Object} PositionComponent
 * @property {number} q - Axial coordinate q
 * @property {number} r - Axial coordinate r
 * @property {string} moleculeId - ID of the molecule this residue belongs to
 */
export function createPositionComponent(q, r, moleculeId) {
  return { q, r, moleculeId };
}

/**
 * Residue type and state
 * @typedef {Object} ResidueComponent
 * @property {string} type - Amino acid code (e.g., 'SIG', 'AND', 'BTx')
 * @property {number} foldState - Index in molecule's foldStates array
 * @property {number} index - Index within the molecule's sequence
 */
export function createResidueComponent(type, foldState, index) {
  return { type, foldState, index };
}

/**
 * Signal state for signaling residues
 * @typedef {Object} SignalComponent
 * @property {boolean} on - Whether the signal is active
 * @property {boolean} source - Whether this is a signal source (BTx bound to DNA)
 * @property {number} strength - Signal strength (0-1, for future use)
 */
export function createSignalComponent(on = false, source = false, strength = 1.0) {
  return { on, source, strength };
}

/**
 * Bond to another entity
 * @typedef {Object} BondComponent
 * @property {number} targetEntity - Entity ID of the bonded residue
 * @property {string} bondType - Type of bond: '+' (inter-molecular) or '-' (intra-molecular)
 * @property {number} bondStrength - Bond strength (for future use)
 */
export function createBondComponent(targetEntity, bondType, bondStrength = 1.0) {
  return { targetEntity, bondType, bondStrength };
}

/**
 * Energy molecules (ATP/ADP) near this residue
 * @typedef {Object} EnergyComponent
 * @property {Array<{q: number, r: number, type: string}>} molecules - ATP/ADP molecules at positions
 */
export function createEnergyComponent(molecules = []) {
  return { molecules };
}

/**
 * Metadata about a molecule (one per molecule, not per residue)
 * @typedef {Object} MoleculeMetaComponent
 * @property {Molecule} molecule - The molecule reference
 * @property {number} offsetQ - Position offset q coordinate
 * @property {number} offsetR - Position offset r coordinate
 * @property {number} direction - Starting direction (0-5)
 */
export function createMoleculeMetaComponent(molecule, offsetQ, offsetR, direction) {
  return { molecule, offsetQ, offsetR, direction };
}

/**
 * Marks an entity as an ATP molecule
 * @typedef {Object} ATPComponent
 * @property {number} energy - Energy value (typically 1 for ATP)
 */
export function createATPComponent(energy = 1) {
  return { energy };
}

/**
 * Marks an entity as an ADP molecule
 * @typedef {Object} ADPComponent
 * @property {number} energy - Energy value (typically 0 for ADP)
 */
export function createADPComponent(energy = 0) {
  return { energy };
}

/**
 * Component type names (constants for consistency)
 */
export const COMPONENT_TYPES = {
  POSITION: 'Position',
  RESIDUE: 'Residue',
  SIGNAL: 'Signal',
  BOND: 'Bond',
  ENERGY: 'Energy',
  MOLECULE_META: 'MoleculeMeta',
  ATP: 'ATP',
  ADP: 'ADP',
};

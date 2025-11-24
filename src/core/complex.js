/**
 * Complex Class
 *
 * A Complex contains one or more Molecules that are bound together.
 * It handles all spatial calculations and physics:
 * - Position mapping (hex coordinates)
 * - Energy calculations
 * - Signal propagation
 * - Fold state updates
 *
 * Even a single unbound molecule lives in a Complex (simplifies API).
 */

import { Molecule } from './molecule.js';
import {
  moveInDirection,
  applyBend,
  getNeighbors
} from './hex-layout.js';
import { computeSignals, DEFAULT_SIGNAL_CONFIG } from '../physics/signal.js';
import {
  AMINO_ACID_TYPES,
  ENERGY_CONSTANTS,
  getBindingTarget,
  canSignal
} from '../data/amino-acids.js';

/**
 * Entry for a molecule in a complex
 * @typedef {Object} MoleculeEntry
 * @property {Molecule} molecule - The molecule
 * @property {Object} offset - Position offset {q, r}
 * @property {number} direction - Starting direction (0-5)
 */

export class Complex {
  /**
   * Create a new Complex
   * @param {Object} options
   * @param {string} options.id - Optional unique identifier
   */
  constructor(options = {}) {
    this.id = options.id ?? `complex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    /** @type {MoleculeEntry[]} */
    this.entries = [];

    // Cached position data (rebuilt when molecules change)
    this._positionMap = null;      // "q,r" -> {moleculeId, index, type, q, r}
    this._entities = null;         // Array of all positioned entities
    this._dirty = true;            // Flag to rebuild caches

    // Signal state
    this._signalState = null;
    this._signalConfig = { ...DEFAULT_SIGNAL_CONFIG };
  }

  /**
   * Add a molecule to this complex
   * @param {Molecule} molecule
   * @param {Object} options
   * @param {Object} options.offset - Position offset {q, r} (default {q:0, r:0})
   * @param {number} options.direction - Starting direction 0-5 (default 0)
   * @returns {Complex} this (for chaining)
   */
  addMolecule(molecule, options = {}) {
    const entry = {
      molecule,
      offset: options.offset ? { ...options.offset } : { q: 0, r: 0 },
      direction: options.direction ?? 0
    };
    this.entries.push(entry);
    this._dirty = true;
    return this;
  }

  /**
   * Remove a molecule from this complex
   * @param {Molecule|string} moleculeOrId - Molecule instance or id
   * @returns {boolean} True if removed
   */
  removeMolecule(moleculeOrId) {
    const id = typeof moleculeOrId === 'string' ? moleculeOrId : moleculeOrId.id;
    const index = this.entries.findIndex(e => e.molecule.id === id);
    if (index >= 0) {
      this.entries.splice(index, 1);
      this._dirty = true;
      return true;
    }
    return false;
  }

  /**
   * Get a molecule entry by molecule id
   * @param {string} moleculeId
   * @returns {MoleculeEntry|null}
   */
  getEntry(moleculeId) {
    return this.entries.find(e => e.molecule.id === moleculeId) || null;
  }

  /**
   * Set position for a molecule in this complex
   * @param {string} moleculeId
   * @param {number} q
   * @param {number} r
   * @param {number} direction
   */
  setMoleculePosition(moleculeId, q, r, direction = undefined) {
    const entry = this.getEntry(moleculeId);
    if (entry) {
      entry.offset = { q, r };
      if (direction !== undefined) {
        entry.direction = direction;
      }
      this._dirty = true;
    }
  }

  /**
   * Get all molecules in this complex
   * @returns {Molecule[]}
   */
  get molecules() {
    return this.entries.map(e => e.molecule);
  }

  /**
   * Get total number of entities (residues + nucleotides) in complex
   * @returns {number}
   */
  get size() {
    return this.entries.reduce((sum, e) => sum + e.molecule.length, 0);
  }

  // ===========================================================================
  // POSITION MAPPING
  // ===========================================================================

  /**
   * Rebuild position map from all molecules
   * @private
   */
  _rebuildPositions() {
    if (!this._dirty) return;

    this._positionMap = new Map();
    this._entities = [];

    for (const entry of this.entries) {
      const positions = this._computeMoleculePositions(entry);

      for (const entity of positions) {
        const key = `${entity.q},${entity.r}`;

        // Check for collision
        if (this._positionMap.has(key)) {
          const existing = this._positionMap.get(key);
          console.warn(`Position collision at (${entity.q}, ${entity.r}): ` +
            `${existing.moleculeId}[${existing.index}] and ${entity.moleculeId}[${entity.index}]`);
        }

        this._positionMap.set(key, entity);
        this._entities.push(entity);
      }
    }

    this._dirty = false;
  }

  /**
   * Compute hex positions for a single molecule
   * @private
   * @param {MoleculeEntry} entry
   * @returns {Array} Array of positioned entities
   */
  _computeMoleculePositions(entry) {
    const { molecule, offset, direction } = entry;
    const positions = [];

    let currentQ = offset.q;
    let currentR = offset.r;
    let currentDir = direction;

    for (let i = 0; i < molecule.length; i++) {
      positions.push({
        moleculeId: molecule.id,
        moleculeType: molecule.type,
        index: i,
        type: molecule.getTypeAt(i),
        q: currentQ,
        r: currentR
      });

      // Move to next position (apply fold, then step)
      if (i < molecule.length - 1) {
        const foldState = molecule.getFoldAt(i);

        // Apply fold (change direction based on fold state)
        if (foldState !== 0) {
          const angle = Math.abs(foldState) * 60;
          const dir = foldState > 0 ? 'left' : 'right';
          currentDir = applyBend(currentDir, angle, dir);
        }

        // Step forward
        [currentQ, currentR] = moveInDirection(currentQ, currentR, currentDir);
      }
    }

    return positions;
  }

  /**
   * Get the position map (rebuilds if dirty)
   * @returns {Map} "q,r" -> entity
   */
  getPositionMap() {
    this._rebuildPositions();
    return this._positionMap;
  }

  /**
   * Get all entities with positions (rebuilds if dirty)
   * @returns {Array}
   */
  getEntities() {
    this._rebuildPositions();
    return this._entities;
  }

  /**
   * Get entity at a specific position
   * @param {number} q
   * @param {number} r
   * @returns {Object|null}
   */
  getAt(q, r) {
    this._rebuildPositions();
    return this._positionMap.get(`${q},${r}`) || null;
  }

  /**
   * Get all entities adjacent to a position
   * @param {number} q
   * @param {number} r
   * @returns {Array}
   */
  getNeighborsAt(q, r) {
    this._rebuildPositions();
    const neighbors = getNeighbors(q, r);
    const result = [];

    for (const n of neighbors) {
      const entity = this._positionMap.get(`${n.q},${n.r}`);
      if (entity) {
        result.push({ ...entity, direction: n.direction });
      }
    }

    return result;
  }

  /**
   * Check if a position is occupied
   * @param {number} q
   * @param {number} r
   * @returns {boolean}
   */
  isOccupied(q, r) {
    this._rebuildPositions();
    return this._positionMap.has(`${q},${r}`);
  }

  // ===========================================================================
  // BINDING DETECTION
  // ===========================================================================

  /**
   * Find all active bindings (BTx adjacent to matching nucleotide)
   * @returns {Map} residueIndex -> nucleotide
   */
  findBindings() {
    this._rebuildPositions();
    const bindings = new Map();

    for (const entity of this._entities) {
      const bindTarget = getBindingTarget(entity.type);
      if (!bindTarget) continue; // Not a binding residue

      // Check neighbors for matching nucleotide
      const neighbors = this.getNeighborsAt(entity.q, entity.r);
      for (const neighbor of neighbors) {
        // Is neighbor a nucleotide that matches?
        if (neighbor.type === bindTarget) {
          bindings.set(entity.index, neighbor.type);
          break; // One binding per residue
        }
        // BTT also binds U
        if (bindTarget === 'T' && neighbor.type === 'U') {
          bindings.set(entity.index, 'U');
          break;
        }
      }
    }

    return bindings;
  }

  // ===========================================================================
  // SIGNAL PROPAGATION
  // ===========================================================================

  /**
   * Set signal propagation configuration
   * @param {Object} config - Per-type probabilities {SIG: 1.0, AND: 0.75, ...}
   */
  setSignalConfig(config) {
    this._signalConfig = { ...DEFAULT_SIGNAL_CONFIG, ...config };
  }

  /**
   * Compute signal states for all entities
   * @param {Object} options
   * @param {Set} options.atpPositions - Set of "q,r" strings where ATP exists
   * @param {boolean} options.tickMode - Use tick-based (probabilistic) propagation
   * @returns {Object} Signal computation result
   */
  computeSignals(options = {}) {
    this._rebuildPositions();

    const {
      atpPositions = new Set(),
      tickMode = false
    } = options;

    // Build bound pairs from current bindings
    const boundPairs = this.findBindings();

    // Convert entities to format expected by signal.js
    const residues = this._entities
      .filter(e => canSignal(e.type) || getBindingTarget(e.type))
      .map(e => ({
        index: e.index,
        type: e.type,
        q: e.q,
        r: e.r
      }));

    const result = computeSignals(residues, {
      boundPairs,
      atpPositions,
      previousState: this._signalState,
      config: this._signalConfig,
      tickMode
    });

    this._signalState = result.state;
    return result;
  }

  /**
   * Get current signal state for an entity
   * @param {number} index - Entity index
   * @returns {Object|null} {on: boolean, source: boolean}
   */
  getSignalState(index) {
    return this._signalState?.get(index) || null;
  }

  /**
   * Check if an entity is currently signaled (on)
   * @param {number} index
   * @returns {boolean}
   */
  isSignaled(index) {
    return this._signalState?.get(index)?.on ?? false;
  }

  // ===========================================================================
  // ACTUATOR PROCESSING
  // ===========================================================================

  /**
   * Process all ATR (Attractor) residues
   * When signaled, ATR has a chance to spawn ATP in an adjacent empty hex.
   *
   * TODO: Currently ATP supply is infinite. In future, implement finite ATP pools.
   *
   * @param {Object} options
   * @param {number} options.attractChance - Probability of attraction per tick (default 0.75)
   * @param {Function} options.randomFn - Random function for testing (default Math.random)
   * @returns {Object} { attracted: [{moleculeId, q, r}, ...], count: number }
   */
  processATRs(options = {}) {
    this._rebuildPositions();

    const {
      attractChance = 0.75,
      randomFn = Math.random
    } = options;

    const attracted = [];

    for (const entity of this._entities) {
      // Only process ATR residues
      if (entity.type !== 'ATR') continue;

      // Must be signaled (activated)
      if (!this.isSignaled(entity.index)) continue;

      // Roll for attraction
      if (randomFn() >= attractChance) continue;

      // Find an unoccupied adjacent hex
      const emptyHex = this._findEmptyAdjacentHex(entity.q, entity.r);
      if (!emptyHex) continue;

      // Spawn ATP molecule at that position
      const atpMol = Molecule.createATP();
      this.addMolecule(atpMol, { offset: emptyHex });

      attracted.push({
        moleculeId: atpMol.id,
        q: emptyHex.q,
        r: emptyHex.r
      });
    }

    return { attracted, count: attracted.length };
  }

  /**
   * Find an unoccupied hex adjacent to a position
   * @private
   * @param {number} q
   * @param {number} r
   * @returns {Object|null} {q, r} of empty hex, or null if all occupied
   */
  _findEmptyAdjacentHex(q, r) {
    const neighbors = getNeighbors(q, r);

    for (const neighbor of neighbors) {
      if (!this.isOccupied(neighbor.q, neighbor.r)) {
        return { q: neighbor.q, r: neighbor.r };
      }
    }

    return null;
  }

  /**
   * Check if a position contains ATP
   * @param {number} q
   * @param {number} r
   * @returns {boolean}
   */
  hasATPAt(q, r) {
    const entity = this.getAt(q, r);
    return entity?.type === 'ATP';
  }

  /**
   * Get all ATP positions in this complex
   * @returns {Set} Set of "q,r" strings
   */
  getATPPositions() {
    this._rebuildPositions();
    const positions = new Set();

    for (const entity of this._entities) {
      if (entity.type === 'ATP') {
        positions.add(`${entity.q},${entity.r}`);
      }
    }

    return positions;
  }

  /**
   * Remove ATP molecule at a specific position (when consumed)
   * @param {number} q
   * @param {number} r
   * @returns {boolean} True if ATP was removed
   */
  consumeATPAt(q, r) {
    const entity = this.getAt(q, r);
    if (!entity || entity.type !== 'ATP') return false;

    return this.removeMolecule(entity.moleculeId);
  }

  // ===========================================================================
  // ENERGY CALCULATIONS
  // ===========================================================================

  /**
   * Calculate total energy of the complex
   * Includes: folding preference, electrostatic, hydrophobic
   * @returns {number} Total energy in eV
   */
  calculateEnergy() {
    this._rebuildPositions();

    let energy = 0;

    // Folding preference energy
    energy += this._calculateFoldingEnergy();

    // Electrostatic energy
    energy += this._calculateElectrostaticEnergy();

    // Hydrophobic energy
    energy += this._calculateHydrophobicEnergy();

    // Binding energy (favorable when BTx bound to matching nucleotide)
    energy += this._calculateBindingEnergy();

    return energy;
  }

  /**
   * Calculate folding preference energy
   * @private
   */
  _calculateFoldingEnergy() {
    let energy = 0;

    for (const entry of this.entries) {
      const mol = entry.molecule;
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
   * @private
   */
  _calculateElectrostaticEnergy() {
    let energy = 0;
    const counted = new Set();

    for (const entity of this._entities) {
      const aa = AMINO_ACID_TYPES[entity.type];
      if (!aa || aa.charge === 0) continue;

      const neighbors = this.getNeighborsAt(entity.q, entity.r);
      for (const neighbor of neighbors) {
        const neighborAa = AMINO_ACID_TYPES[neighbor.type];
        if (!neighborAa || neighborAa.charge === 0) continue;

        // Avoid double-counting pairs
        const pairKey = [
          `${entity.moleculeId}:${entity.index}`,
          `${neighbor.moleculeId}:${neighbor.index}`
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
   * @private
   */
  _calculateHydrophobicEnergy() {
    let energy = 0;

    for (const entity of this._entities) {
      const aa = AMINO_ACID_TYPES[entity.type];
      if (!aa) continue;

      const neighbors = this.getNeighborsAt(entity.q, entity.r);
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
   * @private
   */
  _calculateBindingEnergy() {
    const bindings = this.findBindings();
    // Each successful binding provides favorable energy
    return bindings.size * -1.0; // -1 eV per binding
  }

  // ===========================================================================
  // FOLD UPDATES
  // ===========================================================================

  /**
   * Get preferred fold for a residue based on energy minimization
   * @param {string} moleculeId
   * @param {number} index
   * @returns {number} Preferred fold state in steps
   */
  getPreferredFold(moleculeId, index) {
    const entry = this.getEntry(moleculeId);
    if (!entry) return 0;

    const type = entry.molecule.getTypeAt(index);
    const aa = AMINO_ACID_TYPES[type];

    if (!aa || aa.foldingPreference === null) {
      return entry.molecule.getFoldAt(index); // Keep current
    }

    return aa.preferredSteps || 0;
  }

  /**
   * Update a fold state for a molecule
   * @param {string} moleculeId
   * @param {number} index
   * @param {number} steps
   */
  setFold(moleculeId, index, steps) {
    const entry = this.getEntry(moleculeId);
    if (entry) {
      entry.molecule.setFoldAt(index, steps);
      this._dirty = true;
    }
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  /**
   * Serialize to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      entries: this.entries.map(e => ({
        molecule: e.molecule.toJSON(),
        offset: e.offset,
        direction: e.direction
      })),
      signalConfig: this._signalConfig
    };
  }

  /**
   * Create Complex from serialized data
   * @param {Object} data
   * @returns {Complex}
   */
  static fromJSON(data) {
    const complex = new Complex({ id: data.id });

    for (const entryData of data.entries) {
      const molecule = Molecule.fromJSON(entryData.molecule);
      complex.addMolecule(molecule, {
        offset: entryData.offset,
        direction: entryData.direction
      });
    }

    if (data.signalConfig) {
      complex.setSignalConfig(data.signalConfig);
    }

    return complex;
  }

  // ===========================================================================
  // FACTORY METHODS
  // ===========================================================================

  /**
   * Create a Complex with a single protein
   * @param {string|string[]} sequence
   * @param {Object} options
   * @returns {Complex}
   */
  static fromProtein(sequence, options = {}) {
    const mol = Molecule.createProtein(sequence, options);
    const complex = new Complex();
    complex.addMolecule(mol, {
      offset: options.offset,
      direction: options.direction
    });
    return complex;
  }

  /**
   * Create a Complex with a single DNA strand
   * @param {string} sequence
   * @param {Object} options
   * @returns {Complex}
   */
  static fromDNA(sequence, options = {}) {
    const mol = Molecule.createDNA(sequence, options);
    const complex = new Complex();
    complex.addMolecule(mol, {
      offset: options.offset,
      direction: options.direction
    });
    return complex;
  }
}

export default Complex;

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
import { DEFAULT_SIGNAL_CONFIG } from '../physics/signal.js';
import { signalSystem } from '../ecs/systems/signalSystem.js';
import {
  processATRs as processATRsECS,
  calculateEnergy as calculateEnergyECS,
  getATPPositions as getATPPositionsECS
} from '../ecs/systems/energySystem.js';
import {
  AMINO_ACID_TYPES,
  getBindingTarget
} from '../data/amino-acids.js';
import { World } from '../ecs/World.js';
import {
  COMPONENT_TYPES,
  createPositionComponent,
  createResidueComponent
} from '../ecs/components.js';

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

    // ECS World stores all entities and components
    this.world = new World();

    // Track molecule entries for serialization and molecule-level operations
    // This is a lightweight index: moleculeId -> {molecule, offset, direction}
    this._moleculeIndex = new Map();

    // Global index counter for assigning unique indices to residues
    this._nextGlobalIndex = 0;

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

    // Store in molecule index
    this._moleculeIndex.set(molecule.id, entry);

    // Create entities in World for this molecule
    this._createMoleculeEntities(entry);

    this._dirty = true;
    return this;
  }

  /**
   * Create entities in World for a molecule
   * @private
   * @param {Object} entry - MoleculeEntry {molecule, offset, direction}
   */
  _createMoleculeEntities(entry) {
    const { molecule, offset, direction } = entry;

    let currentQ = offset.q;
    let currentR = offset.r;
    let currentDir = direction;

    for (let i = 0; i < molecule.length; i++) {
      const entity = this.world.createEntity();

      // Assign globally unique index
      const globalIndex = this._nextGlobalIndex++;

      // Add Position component
      this.world.addComponent(
        entity,
        COMPONENT_TYPES.POSITION,
        createPositionComponent(currentQ, currentR, molecule.id)
      );

      // Add Residue component with global index
      const foldState = molecule.getFoldAt(i);
      this.world.addComponent(
        entity,
        COMPONENT_TYPES.RESIDUE,
        createResidueComponent(molecule.getTypeAt(i), foldState, globalIndex)
      );

      // Move to next position (apply fold, then step)
      if (i < molecule.length - 1) {
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
  }

  /**
   * Remove a molecule from this complex
   * @param {Molecule|string} moleculeOrId - Molecule instance or id
   * @returns {boolean} True if removed
   */
  removeMolecule(moleculeOrId) {
    const id = typeof moleculeOrId === 'string' ? moleculeOrId : moleculeOrId.id;

    if (!this._moleculeIndex.has(id)) {
      return false;
    }

    // Find and destroy all entities belonging to this molecule
    const positions = this.world.getComponents(COMPONENT_TYPES.POSITION);
    const entitiesToDestroy = [];

    for (const [entityId, position] of positions) {
      if (position.moleculeId === id) {
        entitiesToDestroy.push(entityId);
      }
    }

    for (const entityId of entitiesToDestroy) {
      this.world.destroyEntity(entityId);
    }

    // Remove from molecule index
    this._moleculeIndex.delete(id);
    this._dirty = true;
    return true;
  }

  /**
   * Get a molecule entry by molecule id
   * @param {string} moleculeId
   * @returns {MoleculeEntry|null}
   */
  getEntry(moleculeId) {
    return this._moleculeIndex.get(moleculeId) || null;
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
    if (!entry) return;

    // Update entry
    entry.offset = { q, r };
    if (direction !== undefined) {
      entry.direction = direction;
    }

    // Recreate entities for this molecule with new position
    // First, remove old entities
    const positions = this.world.getComponents(COMPONENT_TYPES.POSITION);
    const entitiesToDestroy = [];

    for (const [entityId, position] of positions) {
      if (position.moleculeId === moleculeId) {
        entitiesToDestroy.push(entityId);
      }
    }

    for (const entityId of entitiesToDestroy) {
      this.world.destroyEntity(entityId);
    }

    // Create new entities
    this._createMoleculeEntities(entry);
    this._dirty = true;
  }

  /**
   * Get all molecules in this complex
   * @returns {Molecule[]}
   */
  get molecules() {
    return Array.from(this._moleculeIndex.values()).map(e => e.molecule);
  }

  /**
   * Get total number of entities (residues + nucleotides) in complex
   * @returns {number}
   */
  get size() {
    return this.world.entityCount;
  }

  /**
   * Get entries (for internal use and compatibility)
   * @private
   * @returns {MoleculeEntry[]}
   */
  get entries() {
    return Array.from(this._moleculeIndex.values());
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

    // Query all entities with Position and Residue components
    const entityIds = this.world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

    for (const entityId of entityIds) {
      const position = this.world.getComponent(entityId, COMPONENT_TYPES.POSITION);
      const residue = this.world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

      // Get molecule type from index
      const entry = this._moleculeIndex.get(position.moleculeId);
      const moleculeType = entry ? entry.molecule.type : 'unknown';

      const entity = {
        moleculeId: position.moleculeId,
        moleculeType,
        index: residue.index,
        type: residue.type,
        q: position.q,
        r: position.r
      };

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

    this._dirty = false;
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
   * @param {boolean} options.stepped - If true, compute one step only; if false, compute to steady-state
   * @param {boolean} options.tickMode - DEPRECATED: Use 'stepped' instead
   * @param {Function} options.randomFn - Random function for testing (default Math.random)
   * @returns {Object} Signal computation result
   */
  computeSignals(options = {}) {
    const {
      atpPositions = new Set(),
      stepped = false,
      tickMode = false, // Deprecated alias
      randomFn = Math.random
    } = options;

    // Build bound pairs from current bindings
    const boundPairs = this.findBindings();

    // Call ECS signal system with World
    const result = signalSystem(this.world, {
      boundPairs,
      atpPositions,
      previousState: this._signalState,
      config: this._signalConfig,
      stepped: stepped || tickMode,
      randomFn
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
    const {
      attractChance = 0.75,
      randomFn = Math.random
    } = options;

    // Call ECS energy system with callback to spawn ATP
    return processATRsECS(this.world, {
      signalState: this._signalState,
      attractChance,
      randomFn,
      onSpawnATP: (q, r) => {
        const atpMol = Molecule.createATP();
        this.addMolecule(atpMol, { offset: { q, r } });
        return { moleculeId: atpMol.id };
      }
    });
  }

  /**
   * Find an unoccupied hex adjacent to a position
   * Randomly selects from all available empty neighbors
   * @private
   * @param {number} q
   * @param {number} r
   * @param {Function} randomFn - Random function (default Math.random)
   * @returns {Object|null} {q, r} of empty hex, or null if all occupied
   */
  _findEmptyAdjacentHex(q, r, randomFn = Math.random) {
    const neighbors = getNeighbors(q, r);

    // Collect all empty neighbors
    const emptyNeighbors = neighbors.filter(n => !this.isOccupied(n.q, n.r));

    if (emptyNeighbors.length === 0) {
      return null;
    }

    // Randomly select one
    const index = Math.floor(randomFn() * emptyNeighbors.length);
    const selected = emptyNeighbors[index];
    return { q: selected.q, r: selected.r };
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
    return getATPPositionsECS(this.world);
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
    const bindings = this.findBindings();
    return calculateEnergyECS(this.world, this._moleculeIndex, bindings);
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
    if (!entry) return;

    // Update molecule's fold state
    entry.molecule.setFoldAt(index, steps);

    // Recreate entities for this molecule (positions will change)
    const positions = this.world.getComponents(COMPONENT_TYPES.POSITION);
    const entitiesToDestroy = [];

    for (const [entityId, position] of positions) {
      if (position.moleculeId === moleculeId) {
        entitiesToDestroy.push(entityId);
      }
    }

    for (const entityId of entitiesToDestroy) {
      this.world.destroyEntity(entityId);
    }

    this._createMoleculeEntities(entry);
    this._dirty = true;
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

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
import { signalSystemPure } from '../ecs/systems/signalSystemPure.js';
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
import { SystemScheduler } from '../ecs/SystemScheduler.js';
import {
  COMPONENT_TYPES,
  createPositionComponent,
  createResidueComponent,
  createSignalComponent,
  createMoleculeMetaComponent,
  createConfigComponent,
  createIndexManagerComponent
} from '../ecs/components.js';
import { canSignal } from '../data/amino-acids.js';
import { BasePairingComponent } from '../ecs/components/basePairingComponent.js';

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

    // System scheduler manages system execution
    this.scheduler = new SystemScheduler(this.world);

    // Create singleton entities for global state
    this._createSingletonEntities();

    // Register systems
    this._registerSystems();
  }

  /**
   * Create singleton entities for global state
   * @private
   */
  _createSingletonEntities() {
    // Config entity - holds signal propagation configuration
    this._configEntityId = this.world.createEntity();
    this.world.addComponent(
      this._configEntityId,
      COMPONENT_TYPES.CONFIG,
      createConfigComponent({ ...DEFAULT_SIGNAL_CONFIG })
    );

    // Index manager entity - holds global index counter
    this._indexManagerEntityId = this.world.createEntity();
    this.world.addComponent(
      this._indexManagerEntityId,
      COMPONENT_TYPES.INDEX_MANAGER,
      createIndexManagerComponent(0)
    );
  }

  /**
   * Get signal configuration from ConfigComponent
   * @private
   * @returns {Object}
   */
  _getSignalConfig() {
    const config = this.world.getComponent(this._configEntityId, COMPONENT_TYPES.CONFIG);
    return config.signalConfig;
  }

  /**
   * Set signal configuration in ConfigComponent
   * @private
   * @param {Object} signalConfig
   */
  _setSignalConfig(signalConfig) {
    const config = this.world.getComponent(this._configEntityId, COMPONENT_TYPES.CONFIG);
    config.signalConfig = { ...signalConfig };
  }

  /**
   * Get next global index and increment
   * @private
   * @returns {number}
   */
  _getNextGlobalIndex() {
    const indexManager = this.world.getComponent(
      this._indexManagerEntityId,
      COMPONENT_TYPES.INDEX_MANAGER
    );
    const index = indexManager.nextIndex;
    indexManager.nextIndex++;
    return index;
  }

  /**
   * Register ECS systems with the scheduler
   * @private
   */
  _registerSystems() {
    // Signal propagation system
    this.scheduler.registerSystem('signal', (world, context) => {
      return signalSystemPure(world, {
        boundPairs: context.boundPairs || new Map(),
        atpPositions: context.atpPositions || new Set(),
        config: context.config || this._getSignalConfig(),
        stepped: context.stepped || false,
        randomFn: context.randomFn || Math.random
      });
    }, { phase: 'physics', priority: 1 });

    // Energy calculation system
    this.scheduler.registerSystem('energy', (world, context) => {
      return {
        energy: calculateEnergyECS(world, context.bindings || new Map())
      };
    }, { phase: 'physics', priority: 2 });

    // ATP attractor system (ATR residues)
    this.scheduler.registerSystem('attractors', (world, context) => {
      if (!context.onSpawnATP) {
        return { attracted: [], count: 0 };
      }

      return processATRsECS(world, {
        signalState: context.signalState || new Map(),
        attractChance: context.attractChance || 0.75,
        randomFn: context.randomFn || Math.random,
        onSpawnATP: context.onSpawnATP
      });
    }, { phase: 'physics', priority: 3 });
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
    const offset = options.offset ? { ...options.offset } : { q: 0, r: 0 };
    const direction = options.direction ?? 0;

    // Create a molecule entity to hold metadata
    const moleculeEntity = this.world.createEntity();
    this.world.addComponent(
      moleculeEntity,
      COMPONENT_TYPES.MOLECULE_META,
      createMoleculeMetaComponent(molecule, offset.q, offset.r, direction)
    );

    // Create residue entities for this molecule
    this._createMoleculeEntities(molecule, offset, direction);

    return this;
  }

  /**
   * Create entities in World for a molecule
   * @private
   * @param {Molecule} molecule
   * @param {Object} offset - {q, r}
   * @param {number} direction
   */
  _createMoleculeEntities(molecule, offset, direction) {

    let currentQ = offset.q;
    let currentR = offset.r;
    let currentDir = direction;

    for (let i = 0; i < molecule.length; i++) {
      const entity = this.world.createEntity();

      // Assign globally unique index
      const globalIndex = this._getNextGlobalIndex();

      // Add Position component
      this.world.addComponent(
        entity,
        COMPONENT_TYPES.POSITION,
        createPositionComponent(currentQ, currentR, molecule.id)
      );

      // Add Residue component with global index
      const foldState = molecule.getFoldAt(i);
      const residueType = molecule.getTypeAt(i);
      this.world.addComponent(
        entity,
        COMPONENT_TYPES.RESIDUE,
        createResidueComponent(residueType, foldState, globalIndex)
      );

      // Add Signal component if this residue can signal
      if (canSignal(residueType) || getBindingTarget(residueType)) {
        this.world.addComponent(
          entity,
          COMPONENT_TYPES.SIGNAL,
          createSignalComponent(false, false, 1.0)
        );
      }

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

    // Find the molecule meta entity
    const metaEntities = this.world.query([COMPONENT_TYPES.MOLECULE_META]);
    let moleculeMetaEntity = null;

    for (const entityId of metaEntities) {
      const meta = this.world.getComponent(entityId, COMPONENT_TYPES.MOLECULE_META);
      if (meta.molecule.id === id) {
        moleculeMetaEntity = entityId;
        break;
      }
    }

    if (moleculeMetaEntity === null) {
      return false;
    }

    // Find and destroy all residue entities belonging to this molecule
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

    // Destroy molecule meta entity
    this.world.destroyEntity(moleculeMetaEntity);
    return true;
  }

  /**
   * Get a molecule entry by molecule id
   * @param {string} moleculeId
   * @returns {MoleculeEntry|null}
   */
  getEntry(moleculeId) {
    const metaEntities = this.world.query([COMPONENT_TYPES.MOLECULE_META]);

    for (const entityId of metaEntities) {
      const meta = this.world.getComponent(entityId, COMPONENT_TYPES.MOLECULE_META);
      if (meta.molecule.id === moleculeId) {
        return {
          molecule: meta.molecule,
          offset: { q: meta.offsetQ, r: meta.offsetR },
          direction: meta.direction
        };
      }
    }

    return null;
  }

  /**
   * Set position for a molecule in this complex
   * @param {string} moleculeId
   * @param {number} q
   * @param {number} r
   * @param {number} direction
   */
  setMoleculePosition(moleculeId, q, r, direction = undefined) {
    // Find and update molecule meta
    const metaEntities = this.world.query([COMPONENT_TYPES.MOLECULE_META]);
    let meta = null;

    for (const entityId of metaEntities) {
      const m = this.world.getComponent(entityId, COMPONENT_TYPES.MOLECULE_META);
      if (m.molecule.id === moleculeId) {
        meta = m;
        break;
      }
    }

    if (!meta) return;

    // Update metadata
    meta.offsetQ = q;
    meta.offsetR = r;
    if (direction !== undefined) {
      meta.direction = direction;
    }

    // Recreate residue entities for this molecule with new position
    // First, remove old residue entities
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

    // Create new residue entities
    this._createMoleculeEntities(meta.molecule, { q, r }, meta.direction);
  }

  /**
   * Get all molecules in this complex
   * @returns {Molecule[]}
   */
  get molecules() {
    const metaEntities = this.world.query([COMPONENT_TYPES.MOLECULE_META]);
    const molecules = [];

    for (const entityId of metaEntities) {
      const meta = this.world.getComponent(entityId, COMPONENT_TYPES.MOLECULE_META);
      molecules.push(meta.molecule);
    }

    return molecules;
  }

  /**
   * Get total number of entities (residues + nucleotides) in complex
   * @returns {number}
   */
  get size() {
    // Count only residue entities, not molecule metadata entities
    return this.world.query([COMPONENT_TYPES.RESIDUE]).length;
  }

  /**
   * Get entries (for internal use and compatibility)
   * @private
   * @returns {MoleculeEntry[]}
   */
  get entries() {
    const metaEntities = this.world.query([COMPONENT_TYPES.MOLECULE_META]);
    const entries = [];

    for (const entityId of metaEntities) {
      const meta = this.world.getComponent(entityId, COMPONENT_TYPES.MOLECULE_META);
      entries.push({
        molecule: meta.molecule,
        offset: { q: meta.offsetQ, r: meta.offsetR },
        direction: meta.direction
      });
    }

    return entries;
  }

  // ===========================================================================
  // POSITION MAPPING
  // ===========================================================================

  /**
   * Get molecule metadata by moleculeId
   * @private
   * @param {string} moleculeId
   * @returns {Object|null} Molecule metadata
   */
  _getMoleculeMeta(moleculeId) {
    const metaEntities = this.world.query([COMPONENT_TYPES.MOLECULE_META]);

    for (const entityId of metaEntities) {
      const meta = this.world.getComponent(entityId, COMPONENT_TYPES.MOLECULE_META);
      if (meta.molecule.id === moleculeId) {
        return meta;
      }
    }

    return null;
  }

  /**
   * Get the position map
   * @returns {Map} "q,r" -> entity
   */
  getPositionMap() {
    const map = new Map();
    const entityIds = this.world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

    for (const entityId of entityIds) {
      const position = this.world.getComponent(entityId, COMPONENT_TYPES.POSITION);
      const residue = this.world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

      // Get molecule type from meta component
      const meta = this._getMoleculeMeta(position.moleculeId);
      const moleculeType = meta ? meta.molecule.type : 'unknown';

      const entity = {
        moleculeId: position.moleculeId,
        moleculeType,
        index: residue.index,
        type: residue.type,
        q: position.q,
        r: position.r
      };

      const key = `${entity.q},${entity.r}`;
      map.set(key, entity);
    }

    return map;
  }

  /**
   * Get all entities with positions
   * @returns {Array}
   */
  getEntities() {
    const entities = [];
    const entityIds = this.world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

    for (const entityId of entityIds) {
      const position = this.world.getComponent(entityId, COMPONENT_TYPES.POSITION);
      const residue = this.world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

      // Get molecule type from MoleculeMetaComponent
      const meta = this._getMoleculeMeta(position.moleculeId);
      const moleculeType = meta ? meta.molecule.type : 'unknown';

      entities.push({
        moleculeId: position.moleculeId,
        moleculeType,
        index: residue.index,
        type: residue.type,
        q: position.q,
        r: position.r
      });
    }

    return entities;
  }

  /**
   * Get entity at a specific position
   * @param {number} q
   * @param {number} r
   * @returns {Object|null}
   */
  getAt(q, r) {
    const entityIds = this.world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

    for (const entityId of entityIds) {
      const position = this.world.getComponent(entityId, COMPONENT_TYPES.POSITION);

      if (position.q === q && position.r === r) {
        const residue = this.world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
        const meta = this._getMoleculeMeta(position.moleculeId);
        const moleculeType = meta ? meta.molecule.type : 'unknown';

        return {
          moleculeId: position.moleculeId,
          moleculeType,
          index: residue.index,
          type: residue.type,
          q: position.q,
          r: position.r
        };
      }
    }

    return null;
  }

  /**
   * Get all entities adjacent to a position
   * @param {number} q
   * @param {number} r
   * @returns {Array}
   */
  getNeighborsAt(q, r) {
    const neighbors = getNeighbors(q, r);
    const result = [];

    for (const n of neighbors) {
      const entity = this.getAt(n.q, n.r);
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
    return this.getAt(q, r) !== null;
  }

  // ===========================================================================
  // BINDING DETECTION
  // ===========================================================================

  /**
   * Find all active bindings (BTx adjacent to matching nucleotide)
   * @returns {Map} residueIndex -> nucleotide
   */
  findBindings() {
    const bindings = new Map();
    const entityIds = this.world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

    for (const entityId of entityIds) {
      const position = this.world.getComponent(entityId, COMPONENT_TYPES.POSITION);
      const residue = this.world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

      const bindTarget = getBindingTarget(residue.type);
      if (!bindTarget) continue; // Not a binding residue

      // Check neighbors for matching nucleotide
      const neighbors = this.getNeighborsAt(position.q, position.r);
      for (const neighbor of neighbors) {
        // Is neighbor a nucleotide that matches?
        if (neighbor.type === bindTarget) {
          bindings.set(residue.index, neighbor.type);
          break; // One binding per residue
        }
        // BTT also binds U
        if (bindTarget === 'T' && neighbor.type === 'U') {
          bindings.set(residue.index, 'U');
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
    this._setSignalConfig({ ...DEFAULT_SIGNAL_CONFIG, ...config });
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

    // Run signal system via scheduler
    const result = this.scheduler.runSystem('signal', {
      boundPairs,
      atpPositions,
      config: this._getSignalConfig(),
      stepped: stepped || tickMode,
      randomFn
    });

    // Build backward-compatible state Map for API compatibility
    const state = new Map();
    const entityIds = this.world.query([COMPONENT_TYPES.SIGNAL, COMPONENT_TYPES.RESIDUE]);
    for (const entityId of entityIds) {
      const signal = this.world.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
      const residue = this.world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
      state.set(residue.index, { on: signal.on, source: signal.source });
    }

    return { ...result, state };
  }

  /**
   * Get current signal state for an entity
   * @param {number} index - Entity index
   * @returns {Object|null} {on: boolean, source: boolean}
   */
  getSignalState(index) {
    // Find entity with this residue index
    const entityIds = this.world.query([COMPONENT_TYPES.RESIDUE, COMPONENT_TYPES.SIGNAL]);
    for (const entityId of entityIds) {
      const residue = this.world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
      if (residue.index === index) {
        const signal = this.world.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
        return { on: signal.on, source: signal.source };
      }
    }
    return null;
  }

  /**
   * Check if an entity is currently signaled (on)
   * @param {number} index
   * @returns {boolean}
   */
  isSignaled(index) {
    const state = this.getSignalState(index);
    return state?.on ?? false;
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

    // Build signal state from SignalComponents
    const signalState = new Map();
    const entityIds = this.world.query([COMPONENT_TYPES.SIGNAL, COMPONENT_TYPES.RESIDUE]);
    for (const entityId of entityIds) {
      const signal = this.world.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
      const residue = this.world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
      signalState.set(residue.index, { on: signal.on, source: signal.source });
    }

    // Run attractor system via scheduler
    return this.scheduler.runSystem('attractors', {
      signalState,
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
    const result = this.scheduler.runSystem('energy', { bindings });
    return result.energy;
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

    this._createMoleculeEntities(entry.molecule, entry.offset, entry.direction);
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
      signalConfig: this._getSignalConfig()
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
   * Create a Complex with DNA (single or double-stranded)
   * @param {string} sequence - First DNA strand
   * @param {string|Object} complementOrOptions - Second strand, or options if single-stranded
   * @param {Object} options - Options (if complement is provided)
   * @returns {Complex}
   *
   * Usage:
   * - fromDNA('ACGT') - Single strand, auto-generate complement
   * - fromDNA('ACGT', 'TGCA') - Double strand with explicit complement
   * - fromDNA('ACGT', {bends: [...]}) - Single strand with options
   * - fromDNA('ACGT', 'TGCA', {bends: [...]}) - Double strand with options
   */
  static fromDNA(sequence, complementOrOptions, options = {}) {
    // Determine if we have 1 or 2 sequences
    const isSingleStrand = !complementOrOptions ||
                           (typeof complementOrOptions === 'object' && !Array.isArray(complementOrOptions));
    const complement = isSingleStrand ? Complex._generateComplement(sequence) : complementOrOptions;
    const opts = isSingleStrand ? (complementOrOptions || {}) : options;

    // Create both molecules
    const strand1 = Molecule.createDNA(sequence, opts);
    const strand2 = Molecule.createDNA(complement, opts);

    // Create complex and add both strands
    const complex = new Complex();

    // Add first strand at specified position
    complex.addMolecule(strand1, {
      offset: opts.offset || { q: 0, r: 0 },
      direction: opts.direction || 0
    });

    // Add second strand adjacent (one row below in hex grid)
    complex.addMolecule(strand2, {
      offset: opts.offset ? { q: opts.offset.q, r: opts.offset.r + 1 } : { q: 0, r: 1 },
      direction: opts.direction || 0
    });

    // Add base pairing components to link the strands
    complex._addBasePairing(strand1.id, strand2.id);

    return complex;
  }

  /**
   * Generate complement DNA sequence
   * @private
   * @param {string} sequence - DNA sequence (e.g., "ACGT")
   * @returns {string} Complement sequence (e.g., "TGCA")
   */
  static _generateComplement(sequence) {
    const bases = sequence.includes('-') ? sequence.split('-') : sequence.split('');
    const complement = bases.map(base => BasePairingComponent.getComplement(base));
    return sequence.includes('-') ? complement.join('-') : complement.join('');
  }

  /**
   * Check if all base pairs in the complex are complementary
   * Non-blocking validation - returns result without preventing instantiation
   * @returns {Object} {isComplementary: boolean, errors: Array}
   */
  checkComplementarity() {
    const errors = [];

    // Query all entities with BasePairingComponent
    const entityIds = this.world.query(['BasePairing', COMPONENT_TYPES.RESIDUE]);

    for (const entityId of entityIds) {
      const basePairing = this.world.getComponent(entityId, 'BasePairing');
      const residue1 = this.world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

      // Get paired entity's residue
      const residue2 = this.world.getComponent(basePairing.pairedEntityId, COMPONENT_TYPES.RESIDUE);

      // Check if bases are complementary
      if (!BasePairingComponent.areComplementary(residue1.type, residue2.type)) {
        errors.push({
          entity1: entityId,
          entity2: basePairing.pairedEntityId,
          base1: residue1.type,
          base2: residue2.type,
          expected: BasePairingComponent.getComplement(residue1.type)
        });
      }
    }

    return {
      isComplementary: errors.length === 0,
      errors
    };
  }

  /**
   * Add base pairing components between two DNA strands
   * @private
   * @param {string} strand1Id - First molecule ID
   * @param {string} strand2Id - Second molecule ID
   */
  _addBasePairing(strand1Id, strand2Id) {
    // Query entities for both strands
    const strand1Entities = [];
    const strand2Entities = [];

    const entityIds = this.world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);
    for (const entityId of entityIds) {
      const position = this.world.getComponent(entityId, COMPONENT_TYPES.POSITION);
      if (position.moleculeId === strand1Id) {
        strand1Entities.push({ entityId, ...position });
      } else if (position.moleculeId === strand2Id) {
        strand2Entities.push({ entityId, ...position });
      }
    }

    // Sort by index to ensure correct pairing
    strand1Entities.sort((a, b) => a.index - b.index);
    strand2Entities.sort((a, b) => a.index - b.index);

    // Add BasePairingComponent to each entity
    const minLength = Math.min(strand1Entities.length, strand2Entities.length);
    for (let i = 0; i < minLength; i++) {
      const entity1 = strand1Entities[i];
      const entity2 = strand2Entities[i];

      // Add component to strand 1 (primary)
      this.world.addComponent(entity1.entityId, 'BasePairing',
        new BasePairingComponent(entity2.entityId, true));

      // Add component to strand 2 (complement)
      this.world.addComponent(entity2.entityId, 'BasePairing',
        new BasePairingComponent(entity1.entityId, false));
    }
  }
}

export default Complex;

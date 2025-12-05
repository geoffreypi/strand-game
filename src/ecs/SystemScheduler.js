/**
 * SystemScheduler - Manages execution of ECS systems
 *
 * Systems are pure functions that operate on World and return results.
 * The scheduler manages system registration, ordering, and execution.
 */

export class SystemScheduler {
  /**
   * @param {World} world - The ECS world
   */
  constructor(world) {
    this.world = world;
    this.systems = new Map(); // name -> {fn, phase, priority}
    this.phases = new Map(); // phaseName -> [systemNames...]
    this.systemOrder = []; // Ordered list of system names
  }

  /**
   * Register a system
   * @param {string} name - System name (e.g., 'signal', 'energy')
   * @param {Function} systemFn - System function: (world, context) => result
   * @param {Object} options
   * @param {string} options.phase - Phase name (e.g., 'update', 'physics')
   * @param {number} options.priority - Execution priority within phase (lower = earlier)
   */
  registerSystem(name, systemFn, options = {}) {
    const { phase = 'update', priority = 0 } = options;

    this.systems.set(name, {
      fn: systemFn,
      phase,
      priority
    });

    // Add to phase list
    if (!this.phases.has(phase)) {
      this.phases.set(phase, []);
    }
    this.phases.get(phase).push(name);

    // Rebuild execution order
    this._rebuildSystemOrder();
  }

  /**
   * Unregister a system
   * @param {string} name
   */
  unregisterSystem(name) {
    const system = this.systems.get(name);
    if (!system) return;

    // Remove from systems
    this.systems.delete(name);

    // Remove from phase list
    const phaseList = this.phases.get(system.phase);
    if (phaseList) {
      const index = phaseList.indexOf(name);
      if (index !== -1) {
        phaseList.splice(index, 1);
      }
    }

    // Rebuild execution order
    this._rebuildSystemOrder();
  }

  /**
   * Run a specific system
   * @param {string} name - System name
   * @param {Object} context - Context passed to system
   * @returns {Object} System result
   */
  runSystem(name, context = {}) {
    const system = this.systems.get(name);
    if (!system) {
      throw new Error(`System '${name}' not registered`);
    }

    return system.fn(this.world, context);
  }

  /**
   * Run all systems in a specific phase
   * @param {string} phaseName
   * @param {Object} context
   * @returns {Map} Map of systemName -> result
   */
  runPhase(phaseName, context = {}) {
    const systemNames = this.phases.get(phaseName);
    if (!systemNames) {
      return new Map();
    }

    // Sort by priority within phase
    const sorted = [...systemNames].sort((a, b) => {
      const sysA = this.systems.get(a);
      const sysB = this.systems.get(b);
      return sysA.priority - sysB.priority;
    });

    const results = new Map();

    for (const systemName of sorted) {
      const result = this.runSystem(systemName, context);
      results.set(systemName, result);
    }

    return results;
  }

  /**
   * Run all registered systems in order
   * @param {Object} context - Context passed to all systems
   * @returns {Map} Map of systemName -> result
   */
  tick(context = {}) {
    const results = new Map();

    for (const systemName of this.systemOrder) {
      const result = this.runSystem(systemName, context);
      results.set(systemName, result);

      // If a system returns changed: false, we might want to short-circuit
      // But for now, run all systems every tick
    }

    return results;
  }

  /**
   * Rebuild system execution order based on phases and priorities
   * @private
   */
  _rebuildSystemOrder() {
    const phaseNames = ['init', 'input', 'update', 'physics', 'render', 'cleanup'];
    const ordered = [];

    for (const phaseName of phaseNames) {
      const systemNames = this.phases.get(phaseName);
      if (!systemNames) continue;

      // Sort by priority within phase
      const sorted = [...systemNames].sort((a, b) => {
        const sysA = this.systems.get(a);
        const sysB = this.systems.get(b);
        return sysA.priority - sysB.priority;
      });

      ordered.push(...sorted);
    }

    this.systemOrder = ordered;
  }

  /**
   * Get list of registered systems
   * @returns {Array<string>}
   */
  getSystemNames() {
    return Array.from(this.systems.keys());
  }

  /**
   * Get system execution order
   * @returns {Array<string>}
   */
  getSystemOrder() {
    return [...this.systemOrder];
  }

  /**
   * Check if a system is registered
   * @param {string} name
   * @returns {boolean}
   */
  hasSystem(name) {
    return this.systems.has(name);
  }
}

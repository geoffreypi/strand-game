/**
 * Visual System Debugger
 *
 * Provides step-by-step visualization of signal propagation
 * and other system behaviors for debugging and understanding.
 */

import { COMPONENT_TYPES } from './components.js';
import ASCIIRenderer from '../renderers/ascii-renderer.js';

export class VisualDebugger {
  /**
   * Create a new visual debugger
   * @param {World} world - The ECS World to debug
   */
  constructor(world) {
    this.world = world;
    this.history = []; // History of World states
    this.currentStep = 0;
  }

  /**
   * Take a snapshot of current World state
   * @param {string} label - Label for this snapshot
   * @param {Object} metadata - Optional metadata about this state
   */
  snapshot(label = 'snapshot', metadata = {}) {
    // Capture signal state
    const signalState = new Map();
    const signaledEntities = this.world.query([COMPONENT_TYPES.SIGNAL]);

    for (const entityId of signaledEntities) {
      const signal = this.world.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
      const residue = this.world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);

      if (residue) {
        signalState.set(residue.index, {
          on: signal.on,
          source: signal.source,
          strength: signal.strength
        });
      }
    }

    // Capture position state
    const positionState = new Map();
    const positionedEntities = this.world.query([COMPONENT_TYPES.POSITION]);

    for (const entityId of positionedEntities) {
      const position = this.world.getComponent(entityId, COMPONENT_TYPES.POSITION);
      positionState.set(entityId, {
        q: position.q,
        r: position.r,
        moleculeId: position.moleculeId
      });
    }

    this.history.push({
      step: this.history.length,
      label,
      timestamp: Date.now(),
      metadata,
      signalState,
      positionState,
      entityCount: this.world.entities.size
    });

    this.currentStep = this.history.length - 1;
  }

  /**
   * Visualize signal propagation step-by-step
   * @param {Function} propagationFn - Function that performs one propagation step
   * @param {number} maxSteps - Maximum steps to simulate (default: 10)
   * @returns {Array} History of snapshots
   */
  visualizeSignalPropagation(propagationFn, maxSteps = 10) {
    this.reset();

    // Take initial snapshot
    this.snapshot('Initial State', { step: 0 });

    // Run propagation steps
    for (let i = 1; i <= maxSteps; i++) {
      const result = propagationFn(this.world);

      this.snapshot(`After Step ${i}`, {
        step: i,
        changed: result.changed || false,
        propagated: result.propagated || 0
      });

      // Stop if nothing changed
      if (result.changed === false) {
        break;
      }
    }

    return this.history;
  }

  /**
   * Print current state visualization
   * @param {number} stepIndex - Step index to visualize (default: current)
   */
  printStep(stepIndex = this.currentStep) {
    if (stepIndex < 0 || stepIndex >= this.history.length) {
      console.log('Invalid step index');
      return;
    }

    const snapshot = this.history[stepIndex];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Step ${snapshot.step}: ${snapshot.label}`);
    console.log(`${'='.repeat(60)}`);

    if (snapshot.metadata && Object.keys(snapshot.metadata).length > 0) {
      console.log('\nMetadata:');
      for (const [key, value] of Object.entries(snapshot.metadata)) {
        console.log(`  ${key}: ${value}`);
      }
    }

    console.log(`\nEntities: ${snapshot.entityCount}`);
    console.log(`Signaled Residues: ${snapshot.signalState.size}`);

    if (snapshot.signalState.size > 0) {
      console.log('\nSignal State:');
      const signals = Array.from(snapshot.signalState.entries())
        .sort((a, b) => a[0] - b[0]); // Sort by index

      for (const [index, state] of signals) {
        const status = state.on ? 'ON' : 'off';
        const source = state.source ? ' (SOURCE)' : '';
        console.log(`  Residue ${index}: ${status}${source}`);
      }
    }

    // Try to render ASCII visualization if possible
    try {
      const rendering = ASCIIRenderer.renderWorld(this.world, {
        showBindings: true,
        showSignals: true
      });
      console.log('\nVisualization:');
      console.log(rendering);
    } catch (err) {
      // Rendering might fail if World is not set up properly
      console.log('\nVisualization: (unable to render)');
    }
  }

  /**
   * Print all steps
   */
  printAllSteps() {
    for (let i = 0; i < this.history.length; i++) {
      this.printStep(i);
    }
  }

  /**
   * Print a diff between two steps
   * @param {number} fromStep - Starting step index
   * @param {number} toStep - Ending step index
   */
  printDiff(fromStep, toStep) {
    if (fromStep < 0 || fromStep >= this.history.length ||
        toStep < 0 || toStep >= this.history.length) {
      console.log('Invalid step indices');
      return;
    }

    const from = this.history[fromStep];
    const to = this.history[toStep];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Diff: Step ${fromStep} → Step ${toStep}`);
    console.log(`${'='.repeat(60)}`);

    // Find signal changes
    const turnedOn = [];
    const turnedOff = [];
    const newSignals = [];

    // Check for new or changed signals
    for (const [index, toState] of to.signalState) {
      const fromState = from.signalState.get(index);

      if (!fromState) {
        newSignals.push(index);
      } else if (fromState.on !== toState.on) {
        if (toState.on) {
          turnedOn.push(index);
        } else {
          turnedOff.push(index);
        }
      }
    }

    // Check for removed signals
    const removedSignals = [];
    for (const index of from.signalState.keys()) {
      if (!to.signalState.has(index)) {
        removedSignals.push(index);
      }
    }

    if (turnedOn.length > 0) {
      console.log(`\nSignals Turned ON (${turnedOn.length}):`);
      console.log(`  Residues: ${turnedOn.join(', ')}`);
    }

    if (turnedOff.length > 0) {
      console.log(`\nSignals Turned OFF (${turnedOff.length}):`);
      console.log(`  Residues: ${turnedOff.join(', ')}`);
    }

    if (newSignals.length > 0) {
      console.log(`\nNew Signals (${newSignals.length}):`);
      console.log(`  Residues: ${newSignals.join(', ')}`);
    }

    if (removedSignals.length > 0) {
      console.log(`\nRemoved Signals (${removedSignals.length}):`);
      console.log(`  Residues: ${removedSignals.join(', ')}`);
    }

    if (turnedOn.length === 0 && turnedOff.length === 0 &&
        newSignals.length === 0 && removedSignals.length === 0) {
      console.log('\nNo signal changes detected');
    }
  }

  /**
   * Get signal changes between steps
   * @param {number} fromStep - Starting step
   * @param {number} toStep - Ending step
   * @returns {Object} Changes object
   */
  getSignalChanges(fromStep, toStep) {
    if (fromStep < 0 || fromStep >= this.history.length ||
        toStep < 0 || toStep >= this.history.length) {
      return null;
    }

    const from = this.history[fromStep];
    const to = this.history[toStep];

    const turnedOn = [];
    const turnedOff = [];
    const newSignals = [];
    const removedSignals = [];

    for (const [index, toState] of to.signalState) {
      const fromState = from.signalState.get(index);

      if (!fromState) {
        newSignals.push(index);
      } else if (fromState.on !== toState.on) {
        if (toState.on) {
          turnedOn.push(index);
        } else {
          turnedOff.push(index);
        }
      }
    }

    for (const index of from.signalState.keys()) {
      if (!to.signalState.has(index)) {
        removedSignals.push(index);
      }
    }

    return {
      turnedOn,
      turnedOff,
      newSignals,
      removedSignals,
      hasChanges: turnedOn.length > 0 || turnedOff.length > 0 ||
                  newSignals.length > 0 || removedSignals.length > 0
    };
  }

  /**
   * Reset debugger state
   */
  reset() {
    this.history = [];
    this.currentStep = 0;
  }

  /**
   * Get history
   * @returns {Array} History array
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Export history as JSON
   * @returns {Object} Serializable history
   */
  export() {
    return {
      totalSteps: this.history.length,
      currentStep: this.currentStep,
      history: this.history.map(snapshot => ({
        step: snapshot.step,
        label: snapshot.label,
        timestamp: snapshot.timestamp,
        metadata: snapshot.metadata,
        signalState: Array.from(snapshot.signalState.entries()),
        entityCount: snapshot.entityCount
      }))
    };
  }

  /**
   * Generate an animation showing signal propagation
   * @param {number} delayMs - Delay between frames in milliseconds
   * @returns {Promise} Promise that resolves when animation completes
   */
  async animate(delayMs = 1000) {
    for (let i = 0; i < this.history.length; i++) {
      console.clear();
      this.printStep(i);

      if (i < this.history.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Compare two snapshots and return detailed comparison
   * @param {number} step1 - First step index
   * @param {number} step2 - Second step index
   * @returns {Object} Comparison result
   */
  compare(step1, step2) {
    if (step1 < 0 || step1 >= this.history.length ||
        step2 < 0 || step2 >= this.history.length) {
      return null;
    }

    const s1 = this.history[step1];
    const s2 = this.history[step2];

    return {
      steps: [step1, step2],
      labels: [s1.label, s2.label],
      entityCountDiff: s2.entityCount - s1.entityCount,
      signalChanges: this.getSignalChanges(step1, step2),
      metadata: {
        from: s1.metadata,
        to: s2.metadata
      }
    };
  }
}

/**
 * Visual Debugger Usage Examples
 *
 * Demonstrates how to use the VisualDebugger to understand
 * signal propagation and system behavior.
 */

import { World } from './World.js';
import { VisualDebugger } from './visualDebugger.js';
import {
  COMPONENT_TYPES,
  createPositionComponent,
  createResidueComponent,
  createSignalComponent
} from './components.js';

/**
 * Example 1: Basic Signal Propagation Visualization
 *
 * Shows how to visualize a simple signal propagation scenario
 */
export function example1_basicPropagation() {
  console.log('=== Example 1: Basic Signal Propagation ===\n');

  const world = new World();
  const vdebug = new VisualDebugger(world);

  // Create a simple chain of SIG residues: SIG-SIG-SIG
  const residues = [];
  for (let i = 0; i < 3; i++) {
    const entity = world.createEntity();
    world.addComponent(entity, COMPONENT_TYPES.POSITION,
      createPositionComponent(i, 0, 'mol1'));
    world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
      createResidueComponent('SIG', 0, i));
    world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
      createSignalComponent(i === 0)); // First one is source

    residues.push(entity);
  }

  // Define a simple propagation function
  const propagateOnce = (w) => {
    const signaled = w.query([COMPONENT_TYPES.SIGNAL]);
    let changed = false;

    for (const entityId of signaled) {
      const signal = w.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
      const position = w.getComponent(entityId, COMPONENT_TYPES.POSITION);

      if (signal.on) {
        // Propagate to neighbors (simplified - just check adjacent q positions)
        const allEntities = w.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.SIGNAL]);

        for (const neighborId of allEntities) {
          const neighborPos = w.getComponent(neighborId, COMPONENT_TYPES.POSITION);

          if (Math.abs(neighborPos.q - position.q) === 1 &&
              neighborPos.r === position.r) {
            const neighborSignal = w.getComponent(neighborId, COMPONENT_TYPES.SIGNAL);
            if (!neighborSignal.on) {
              neighborSignal.on = true;
              changed = true;
            }
          }
        }
      }
    }

    return { changed };
  };

  // Visualize propagation
  vdebug.visualizeSignalPropagation(propagateOnce, 5);

  // Print all steps
  vdebug.printAllSteps();

  // Print diff between initial and final state
  console.log('\n\nFinal Change Summary:');
  vdebug.printDiff(0, vdebug.getHistory().length - 1);
}

/**
 * Example 2: Snapshot and Compare
 *
 * Shows how to manually take snapshots and compare them
 */
export function example2_snapshotCompare() {
  console.log('\n\n=== Example 2: Snapshot and Compare ===\n');

  const world = new World();
  const vdebug = new VisualDebugger(world);

  // Create initial entities
  for (let i = 0; i < 5; i++) {
    const entity = world.createEntity();
    world.addComponent(entity, COMPONENT_TYPES.POSITION,
      createPositionComponent(i, 0, 'mol1'));
    world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
      createResidueComponent('SIG', 0, i));
    world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
      createSignalComponent(i === 0 || i === 4)); // Two sources at ends
  }

  // Take initial snapshot
  vdebug.snapshot('Initial: Two Sources');

  // Activate middle signal
  const entities = world.query([COMPONENT_TYPES.SIGNAL, COMPONENT_TYPES.RESIDUE]);
  for (const entityId of entities) {
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
    if (residue.index === 2) {
      const signal = world.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
      signal.on = true;
    }
  }

  vdebug.snapshot('After: Middle Signal Activated');

  // Compare snapshots
  const comparison = vdebug.compare(0, 1);
  console.log('Comparison Result:');
  console.log(JSON.stringify(comparison, null, 2));

  // Print both states
  vdebug.printStep(0);
  vdebug.printStep(1);
}

/**
 * Example 3: Animation
 *
 * Shows how to create an animation of signal propagation
 * (Note: This is async and uses setTimeout)
 */
export async function example3_animation() {
  console.log('\n\n=== Example 3: Animation ===\n');

  const world = new World();
  const vdebug = new VisualDebugger(world);

  // Create a line of signals
  for (let i = 0; i < 7; i++) {
    const entity = world.createEntity();
    world.addComponent(entity, COMPONENT_TYPES.POSITION,
      createPositionComponent(i, 0, 'mol1'));
    world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
      createResidueComponent('SIG', 0, i));
    world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
      createSignalComponent(i === 0)); // Source at start
  }

  // Simple propagation
  const propagate = (w) => {
    const signaled = w.query([COMPONENT_TYPES.SIGNAL, COMPONENT_TYPES.POSITION]);
    let changed = false;

    for (const entityId of signaled) {
      const signal = w.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
      const position = w.getComponent(entityId, COMPONENT_TYPES.POSITION);

      if (signal.on) {
        // Find next residue
        const allEntities = w.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.SIGNAL]);

        for (const neighborId of allEntities) {
          const neighborPos = w.getComponent(neighborId, COMPONENT_TYPES.POSITION);

          if (neighborPos.q === position.q + 1 && neighborPos.r === position.r) {
            const neighborSignal = w.getComponent(neighborId, COMPONENT_TYPES.SIGNAL);
            if (!neighborSignal.on) {
              neighborSignal.on = true;
              changed = true;
            }
          }
        }
      }
    }

    return { changed };
  };

  // Capture propagation steps
  vdebug.visualizeSignalPropagation(propagate, 10);

  console.log('Playing animation (500ms per frame)...\n');

  // Animate with 500ms delay between frames
  await vdebug.animate(500);

  console.log('\nAnimation complete!');
}

/**
 * Example 4: Export and Analysis
 *
 * Shows how to export vdebug data for analysis
 */
export function example4_exportAnalysis() {
  console.log('\n\n=== Example 4: Export and Analysis ===\n');

  const world = new World();
  const vdebug = new VisualDebugger(world);

  // Create test setup
  for (let i = 0; i < 4; i++) {
    const entity = world.createEntity();
    world.addComponent(entity, COMPONENT_TYPES.POSITION,
      createPositionComponent(i, 0, 'mol1'));
    world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
      createResidueComponent('SIG', 0, i));
    world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
      createSignalComponent(i === 0));
  }

  vdebug.snapshot('Initial');

  // Manually change some signals
  const entities = world.query([COMPONENT_TYPES.SIGNAL]);
  let count = 0;
  for (const entityId of entities) {
    if (count < 2) {
      const signal = world.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
      signal.on = true;
      count++;
    }
  }

  vdebug.snapshot('After Manual Changes');

  // Export data
  const exported = vdebug.export();

  console.log('Exported Debug Data:');
  console.log(JSON.stringify(exported, null, 2));

  // Analyze the data
  console.log('\nAnalysis:');
  console.log(`Total Steps: ${exported.totalSteps}`);

  for (const snapshot of exported.history) {
    const activeSignals = snapshot.signalState.filter(([_, state]) => state.on).length;
    console.log(`  ${snapshot.label}: ${activeSignals} active signals`);
  }
}

/**
 * Example 5: Debugging a Complex Scenario
 *
 * Shows how to debug a more complex signal propagation scenario
 * with multiple signal types and interactions
 */
export function example5_complexScenario() {
  console.log('\n\n=== Example 5: Complex Scenario ===\n');

  const world = new World();
  const vdebug = new VisualDebugger(world);

  // Create a branching structure:
  //     1
  //    / \
  //   0   2
  //  /     \
  // S       3
  //
  // Where S is source

  const positions = [
    { q: 0, r: 0 },  // 0 - Source
    { q: 1, r: -1 }, // 1
    { q: 1, r: 0 },  // 2
    { q: 2, r: 0 }   // 3
  ];

  for (let i = 0; i < positions.length; i++) {
    const entity = world.createEntity();
    world.addComponent(entity, COMPONENT_TYPES.POSITION,
      createPositionComponent(positions[i].q, positions[i].r, 'mol1'));
    world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
      createResidueComponent('SIG', 0, i));
    world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
      createSignalComponent(i === 0)); // First one is source
  }

  vdebug.snapshot('Initial: Source at position 0', { activeCount: 1 });

  // Define hex neighbors check
  const areNeighbors = (pos1, pos2) => {
    const dq = Math.abs(pos1.q - pos2.q);
    const dr = Math.abs(pos1.r - pos2.r);
    return (dq === 1 && dr === 0) ||
           (dq === 0 && dr === 1) ||
           (dq === 1 && dr === 1);
  };

  // Propagate function
  const propagate = (w) => {
    const signaled = w.query([COMPONENT_TYPES.SIGNAL, COMPONENT_TYPES.POSITION]);
    let changed = false;
    let propagatedCount = 0;

    for (const entityId of signaled) {
      const signal = w.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
      const position = w.getComponent(entityId, COMPONENT_TYPES.POSITION);

      if (signal.on) {
        // Find neighbors
        const allEntities = w.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.SIGNAL]);

        for (const neighborId of allEntities) {
          if (neighborId === entityId) continue;

          const neighborPos = w.getComponent(neighborId, COMPONENT_TYPES.POSITION);

          if (areNeighbors(position, neighborPos)) {
            const neighborSignal = w.getComponent(neighborId, COMPONENT_TYPES.SIGNAL);
            if (!neighborSignal.on) {
              neighborSignal.on = true;
              changed = true;
              propagatedCount++;
            }
          }
        }
      }
    }

    return { changed, propagated: propagatedCount };
  };

  // Visualize
  vdebug.visualizeSignalPropagation(propagate, 5);

  // Print summary
  console.log('Signal Propagation Through Branching Structure:\n');

  for (let i = 0; i < vdebug.getHistory().length; i++) {
    const snapshot = vdebug.getHistory()[i];
    const activeCount = Array.from(snapshot.signalState.values())
      .filter(s => s.on).length;

    console.log(`Step ${i} (${snapshot.label}): ${activeCount} active signals`);

    if (i > 0) {
      const changes = vdebug.getSignalChanges(i - 1, i);
      if (changes.turnedOn.length > 0) {
        console.log(`  → Turned ON: residues ${changes.turnedOn.join(', ')}`);
      }
    }
  }

  // Print final diff
  console.log('\n');
  vdebug.printDiff(0, vdebug.getHistory().length - 1);
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  example1_basicPropagation();
  example2_snapshotCompare();
  await example3_animation();
  example4_exportAnalysis();
  example5_complexScenario();

  console.log('\n=== All Examples Complete ===\n');
}

// If running directly, run all examples
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}

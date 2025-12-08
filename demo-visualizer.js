#!/usr/bin/env node
/**
 * Quick demo of VisualDebugger
 * Run with: node --experimental-vm-modules demo-visualizer.js
 */

import { World } from './src/ecs/World.js';
import { VisualDebugger } from './src/ecs/visualDebugger.js';
import {
  COMPONENT_TYPES,
  createPositionComponent,
  createResidueComponent,
  createSignalComponent
} from './src/ecs/components.js';

console.log('🧬 Visual Debugger Demo\n');

const world = new World();
const vdebug = new VisualDebugger(world);

// Create a chain of 5 SIG residues
console.log('Creating chain: SIG-SIG-SIG-SIG-SIG\n');
for (let i = 0; i < 5; i++) {
  const entity = world.createEntity();
  world.addComponent(entity, COMPONENT_TYPES.POSITION,
    createPositionComponent(i, 0, 'mol1'));
  world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
    createResidueComponent('SIG', 0, i));
  world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
    createSignalComponent(i === 0)); // First residue is source
}

// Simple propagation logic
const propagate = (w) => {
  const signaled = w.query([COMPONENT_TYPES.SIGNAL, COMPONENT_TYPES.POSITION]);
  let changed = false;
  let propagatedCount = 0; // Track how many signals we propagate

  for (const entityId of signaled) {
    const signal = w.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
    const position = w.getComponent(entityId, COMPONENT_TYPES.POSITION);

    if (signal.on) {
      const allEntities = w.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.SIGNAL]);

      for (const neighborId of allEntities) {
        const neighborPos = w.getComponent(neighborId, COMPONENT_TYPES.POSITION);

        // Propagate to right neighbor
        if (neighborPos.q === position.q + 1 && neighborPos.r === position.r) {
          const neighborSignal = w.getComponent(neighborId, COMPONENT_TYPES.SIGNAL);
          if (!neighborSignal.on) {
            neighborSignal.on = true;
            changed = true;
            propagatedCount++; // Count each propagation
          }
        }
      }
    }
  }

  return { changed, propagated: propagatedCount };
};

// Run visualization
console.log('Running signal propagation...\n');
vdebug.visualizeSignalPropagation(propagate, 10);

// Show all steps
vdebug.printAllSteps();

// Show summary
console.log('\n📊 Summary:');
console.log(`Total steps: ${vdebug.getHistory().length}`);
console.log('\nSignal spread timeline:');
for (let i = 0; i < vdebug.getHistory().length; i++) {
  const snapshot = vdebug.getHistory()[i];
  const activeCount = Array.from(snapshot.signalState.values()).filter(s => s.on).length;
  console.log(`  Step ${i}: ${activeCount} active signals`);
}

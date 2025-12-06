/**
 * SystemProfiler Usage Examples
 *
 * These examples demonstrate how to use the SystemProfiler
 * to track performance and identify bottlenecks.
 */

import { World } from './World.js';
import { SystemScheduler } from './SystemScheduler.js';
import { SystemProfiler } from './profiler.js';
import {
  COMPONENT_TYPES,
  createPositionComponent,
  createResidueComponent,
  createSignalComponent
} from './components.js';

/**
 * Example 1: Basic Profiler Setup
 *
 * Shows how to create a profiler and attach it to a scheduler
 */
export function example1_basicSetup() {
  console.log('=== Example 1: Basic Profiler Setup ===\n');

  // Create World and Profiler
  const world = new World();
  const profiler = new SystemProfiler();

  // Create Scheduler with Profiler
  const scheduler = new SystemScheduler(world, { profiler });

  // Register some test systems
  scheduler.registerSystem('setupSystem', (w) => {
    const entity = w.createEntity();
    w.addComponent(entity, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'test'));
    return { created: 1 };
  }, { phase: 'init' });

  scheduler.registerSystem('querySystem', (w) => {
    const entities = w.query([COMPONENT_TYPES.POSITION]);
    return { count: entities.length };
  }, { phase: 'update' });

  // Run a few ticks
  for (let i = 0; i < 10; i++) {
    scheduler.tick();
  }

  // Print performance report
  profiler.printReport();
}

/**
 * Example 2: Manual Timing
 *
 * Shows how to manually time operations
 */
export function example2_manualTiming() {
  console.log('\n=== Example 2: Manual Timing ===\n');

  const profiler = new SystemProfiler();

  // Time a custom operation
  const stop = profiler.startSystem('customOperation');

  // Simulate some work
  const result = Array.from({ length: 1000 }, (_, i) => i * i);

  stop();

  // Get and display stats
  const stats = profiler.getSystemStats('customOperation');
  console.log('Custom Operation Stats:');
  console.log(`  Time: ${stats.recent.average.toFixed(2)}ms`);
  console.log(`  Executions: ${stats.overall.executions}`);
}

/**
 * Example 3: Finding Bottlenecks
 *
 * Shows how to identify performance bottlenecks
 */
export function example3_findingBottlenecks() {
  console.log('\n=== Example 3: Finding Bottlenecks ===\n');

  const world = new World();
  const profiler = new SystemProfiler();
  const scheduler = new SystemScheduler(world, { profiler });

  // Register systems with varying performance
  scheduler.registerSystem('fastSystem', () => {
    // Very fast - just return
    return { done: true };
  });

  scheduler.registerSystem('slowSystem', () => {
    // Simulate slow work
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Busy wait for 10ms
    }
    return { done: true };
  });

  scheduler.registerSystem('mediumSystem', () => {
    // Simulate medium work
    const arr = Array.from({ length: 10000 }, (_, i) => i);
    arr.sort((a, b) => b - a);
    return { done: true };
  });

  // Run multiple ticks
  for (let i = 0; i < 5; i++) {
    scheduler.tick();
  }

  // Find bottlenecks (systems taking >20% of total time)
  const bottlenecks = profiler.findBottlenecks(20);

  console.log('Performance Bottlenecks (>20% of total time):');
  for (const bottleneck of bottlenecks) {
    console.log(`  ${bottleneck.systemName}: ${bottleneck.averageTime.toFixed(2)}ms (${bottleneck.percentage}%)`);
  }

  console.log('\nFull Performance Report:');
  profiler.printReport();
}

/**
 * Example 4: Comparing Performance
 *
 * Shows how to compare performance between different approaches
 */
export function example4_comparingPerformance() {
  console.log('\n=== Example 4: Comparing Performance ===\n');

  const profiler = new SystemProfiler();

  // Approach 1: Array.filter
  const stop1 = profiler.startSystem('approach1_filter');
  const data1 = Array.from({ length: 10000 }, (_, i) => i);
  const result1 = data1.filter(x => x % 2 === 0);
  stop1();

  // Approach 2: For loop
  const stop2 = profiler.startSystem('approach2_forLoop');
  const data2 = Array.from({ length: 10000 }, (_, i) => i);
  const result2 = [];
  for (let i = 0; i < data2.length; i++) {
    if (data2[i] % 2 === 0) {
      result2.push(data2[i]);
    }
  }
  stop2();

  // Compare
  const stats1 = profiler.getSystemStats('approach1_filter');
  const stats2 = profiler.getSystemStats('approach2_forLoop');

  console.log('Performance Comparison:');
  console.log(`  Array.filter: ${stats1.recent.average.toFixed(2)}ms`);
  console.log(`  For loop:     ${stats2.recent.average.toFixed(2)}ms`);

  const faster = stats1.recent.average < stats2.recent.average ? 'filter' : 'for loop';
  const speedup = Math.max(stats1.recent.average, stats2.recent.average) /
                  Math.min(stats1.recent.average, stats2.recent.average);

  console.log(`  Winner: ${faster} (${speedup.toFixed(2)}x faster)`);
}

/**
 * Example 5: Profiling Real Game Loop
 *
 * Shows how to profile a realistic game scenario
 */
export function example5_gameLoopProfiling() {
  console.log('\n=== Example 5: Game Loop Profiling ===\n');

  const world = new World();
  const profiler = new SystemProfiler({ sampleSize: 60 }); // Track last 60 frames
  const scheduler = new SystemScheduler(world, { profiler });

  // Setup initial entities
  for (let i = 0; i < 100; i++) {
    const entity = world.createEntity();
    world.addComponent(entity, COMPONENT_TYPES.POSITION, createPositionComponent(i % 10, Math.floor(i / 10), 'mol1'));
    world.addComponent(entity, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, i));

    if (i % 3 === 0) {
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL, createSignalComponent());
    }
  }

  // Register game systems
  scheduler.registerSystem('signalSystem', (w) => {
    const signaled = w.query([COMPONENT_TYPES.SIGNAL]);
    let propagated = 0;

    for (const entityId of signaled) {
      const signal = w.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
      if (signal.on) {
        propagated++;
      }
    }

    return { propagated };
  }, { phase: 'physics' });

  scheduler.registerSystem('positionSystem', (w) => {
    const entities = w.query([COMPONENT_TYPES.POSITION]);
    return { count: entities.length };
  }, { phase: 'update' });

  scheduler.registerSystem('renderPrepSystem', (w) => {
    // Simulate preparing render data
    const entities = w.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);
    const renderData = entities.map(id => ({
      pos: w.getComponent(id, COMPONENT_TYPES.POSITION),
      res: w.getComponent(id, COMPONENT_TYPES.RESIDUE)
    }));
    return { entities: renderData.length };
  }, { phase: 'render' });

  // Simulate 60 frames
  console.log('Running 60 game frames...\n');

  for (let frame = 0; frame < 60; frame++) {
    scheduler.tick({ frame });
  }

  // Print performance summary
  profiler.printReport();

  // Get frame stats
  const frameStats = profiler.getFrameStats();
  console.log('\nFrame Timing Analysis:');
  console.log(`  Average FPS: ${frameStats.recent.fps.toFixed(1)}`);
  console.log(`  Frame time: ${frameStats.recent.average.toFixed(2)}ms (min: ${frameStats.recent.min.toFixed(2)}ms, max: ${frameStats.recent.max.toFixed(2)}ms)`);

  if (frameStats.recent.fps < 60) {
    console.log('\n⚠️  Warning: FPS below 60, consider optimizing slow systems');
  } else {
    console.log('\n✓ Performance is good!');
  }
}

/**
 * Example 6: Disabling Profiling in Production
 *
 * Shows how to conditionally enable profiling
 */
export function example6_conditionalProfiling() {
  console.log('\n=== Example 6: Conditional Profiling ===\n');

  const isDevelopment = process.env.NODE_ENV !== 'production';

  const world = new World();
  const profiler = new SystemProfiler({ enabled: isDevelopment });
  const scheduler = new SystemScheduler(world, { profiler });

  scheduler.registerSystem('testSystem', () => ({ done: true }));

  for (let i = 0; i < 10; i++) {
    scheduler.tick();
  }

  if (profiler.enabled) {
    console.log('Profiling is enabled (development mode)');
    profiler.printReport();
  } else {
    console.log('Profiling is disabled (production mode)');
    console.log('No performance overhead!');
  }
}

/**
 * Example 7: Exporting Profile Data
 *
 * Shows how to export profiling data for analysis
 */
export function example7_exportingData() {
  console.log('\n=== Example 7: Exporting Profile Data ===\n');

  const world = new World();
  const profiler = new SystemProfiler();
  const scheduler = new SystemScheduler(world, { profiler });

  scheduler.registerSystem('system1', () => ({}));
  scheduler.registerSystem('system2', () => ({}));

  for (let i = 0; i < 10; i++) {
    scheduler.tick();
  }

  // Export as JSON
  const data = profiler.export();

  console.log('Exported Profile Data:');
  console.log(JSON.stringify(data, null, 2));

  // Could save to file or send to analytics service
  // fs.writeFileSync('profile.json', JSON.stringify(data, null, 2));
}

/**
 * Run all examples
 */
export function runAllExamples() {
  example1_basicSetup();
  example2_manualTiming();
  example3_findingBottlenecks();
  example4_comparingPerformance();
  example5_gameLoopProfiling();
  example6_conditionalProfiling();
  example7_exportingData();

  console.log('\n=== All Examples Complete ===\n');
}

// If running directly, run all examples
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

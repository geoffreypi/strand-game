/**
 * System Performance Profiler
 *
 * Tracks execution times for systems in the ECS scheduler,
 * helping identify performance bottlenecks and optimization opportunities.
 */

export class SystemProfiler {
  /**
   * Create a new profiler
   * @param {Object} options - Configuration options
   * @param {boolean} options.enabled - Whether profiling is enabled (default: true)
   * @param {number} options.sampleSize - Number of samples to keep for averaging (default: 100)
   */
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.sampleSize = options.sampleSize || 100;

    // System execution data: Map<systemName, {samples: [], total: 0, count: 0}>
    this.systems = new Map();

    // Overall frame timing
    this.frameSamples = [];
    this.frameTotal = 0;
    this.frameCount = 0;
  }

  /**
   * Start timing a system execution
   * @param {string} systemName - Name of the system
   * @returns {Function} Stop function to call when system completes
   */
  startSystem(systemName) {
    if (!this.enabled) {
      return () => {}; // No-op
    }

    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.recordSystem(systemName, duration);
    };
  }

  /**
   * Record a system execution time
   * @param {string} systemName - Name of the system
   * @param {number} duration - Execution time in milliseconds
   */
  recordSystem(systemName, duration) {
    if (!this.enabled) return;

    if (!this.systems.has(systemName)) {
      this.systems.set(systemName, {
        samples: [],
        total: 0,
        count: 0
      });
    }

    const data = this.systems.get(systemName);

    // Add sample
    data.samples.push(duration);
    if (data.samples.length > this.sampleSize) {
      data.samples.shift(); // Remove oldest sample
    }

    data.total += duration;
    data.count++;
  }

  /**
   * Start timing a complete frame
   * @returns {Function} Stop function to call when frame completes
   */
  startFrame() {
    if (!this.enabled) {
      return () => {};
    }

    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.recordFrame(duration);
    };
  }

  /**
   * Record a frame execution time
   * @param {number} duration - Frame time in milliseconds
   */
  recordFrame(duration) {
    if (!this.enabled) return;

    this.frameSamples.push(duration);
    if (this.frameSamples.length > this.sampleSize) {
      this.frameSamples.shift();
    }

    this.frameTotal += duration;
    this.frameCount++;
  }

  /**
   * Get statistics for a specific system
   * @param {string} systemName - Name of the system
   * @returns {Object|null} Statistics or null if no data
   */
  getSystemStats(systemName) {
    const data = this.systems.get(systemName);
    if (!data || data.samples.length === 0) {
      return null;
    }

    const samples = data.samples;
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const totalAvg = data.total / data.count;

    return {
      systemName,
      recent: {
        average: avg,
        min,
        max,
        samples: samples.length
      },
      overall: {
        average: totalAvg,
        total: data.total,
        executions: data.count
      }
    };
  }

  /**
   * Get frame timing statistics
   * @returns {Object} Frame statistics
   */
  getFrameStats() {
    if (this.frameSamples.length === 0) {
      return {
        recent: { average: 0, min: 0, max: 0, samples: 0 },
        overall: { average: 0, total: 0, frames: 0 }
      };
    }

    const avg = this.frameSamples.reduce((a, b) => a + b, 0) / this.frameSamples.length;
    const min = Math.min(...this.frameSamples);
    const max = Math.max(...this.frameSamples);
    const totalAvg = this.frameTotal / this.frameCount;

    return {
      recent: {
        average: avg,
        min,
        max,
        samples: this.frameSamples.length,
        fps: 1000 / avg
      },
      overall: {
        average: totalAvg,
        total: this.frameTotal,
        frames: this.frameCount,
        fps: 1000 / totalAvg
      }
    };
  }

  /**
   * Get all system statistics
   * @returns {Array<Object>} Array of system statistics, sorted by average time
   */
  getAllStats() {
    const stats = [];

    for (const systemName of this.systems.keys()) {
      const systemStats = this.getSystemStats(systemName);
      if (systemStats) {
        stats.push(systemStats);
      }
    }

    // Sort by recent average time (descending)
    stats.sort((a, b) => b.recent.average - a.recent.average);

    return stats;
  }

  /**
   * Get performance summary
   * @returns {Object} Summary data
   */
  summary() {
    const systemStats = this.getAllStats();
    const frameStats = this.getFrameStats();

    const systemTotal = systemStats.reduce((sum, s) => sum + s.recent.average, 0);

    return {
      enabled: this.enabled,
      frame: frameStats,
      systems: systemStats,
      systemTotal,
      overhead: frameStats.recent.average - systemTotal,
      systemCount: this.systems.size
    };
  }

  /**
   * Print formatted performance report to console
   */
  printReport() {
    const summary = this.summary();

    console.log('=== System Performance Report ===\n');

    if (!this.enabled) {
      console.log('Profiler is disabled');
      return;
    }

    // Frame timing
    console.log('Frame Timing:');
    console.log(`  Recent: ${summary.frame.recent.average.toFixed(2)}ms avg (${summary.frame.recent.fps.toFixed(1)} FPS)`);
    console.log(`  Range: ${summary.frame.recent.min.toFixed(2)}ms - ${summary.frame.recent.max.toFixed(2)}ms`);
    console.log(`  Overall: ${summary.frame.overall.average.toFixed(2)}ms avg (${summary.frame.overall.frames} frames)`);

    // System breakdown
    console.log('\nSystem Breakdown:');
    console.log(`  Total System Time: ${summary.systemTotal.toFixed(2)}ms`);
    console.log(`  Overhead: ${summary.overhead.toFixed(2)}ms\n`);

    if (summary.systems.length === 0) {
      console.log('  No system data recorded');
      return;
    }

    // Print each system
    const maxNameLength = Math.max(...summary.systems.map(s => s.systemName.length));

    for (const system of summary.systems) {
      const namepad = system.systemName.padEnd(maxNameLength);
      const avgTime = system.recent.average.toFixed(2).padStart(6);
      const percentage = ((system.recent.average / summary.systemTotal) * 100).toFixed(1);

      console.log(`  ${namepad}  ${avgTime}ms  (${percentage}%)`);
      console.log(`    Range: ${system.recent.min.toFixed(2)}ms - ${system.recent.max.toFixed(2)}ms`);
    }
  }

  /**
   * Identify performance bottlenecks
   * @param {number} threshold - Percentage threshold (default: 20)
   * @returns {Array<Object>} Systems exceeding threshold
   */
  findBottlenecks(threshold = 20) {
    const summary = this.summary();
    const bottlenecks = [];

    for (const system of summary.systems) {
      const percentage = (system.recent.average / summary.systemTotal) * 100;

      if (percentage >= threshold) {
        bottlenecks.push({
          systemName: system.systemName,
          averageTime: system.recent.average,
          percentage: percentage.toFixed(1),
          executions: system.overall.executions
        });
      }
    }

    return bottlenecks;
  }

  /**
   * Reset all profiling data
   */
  reset() {
    this.systems.clear();
    this.frameSamples = [];
    this.frameTotal = 0;
    this.frameCount = 0;
  }

  /**
   * Reset data for a specific system
   * @param {string} systemName - Name of the system
   */
  resetSystem(systemName) {
    this.systems.delete(systemName);
  }

  /**
   * Enable or disable profiling
   * @param {boolean} enabled - Whether to enable profiling
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Export profiling data as JSON
   * @returns {Object} Serializable profiling data
   */
  export() {
    return {
      enabled: this.enabled,
      sampleSize: this.sampleSize,
      frame: this.getFrameStats(),
      systems: this.getAllStats(),
      timestamp: Date.now()
    };
  }
}

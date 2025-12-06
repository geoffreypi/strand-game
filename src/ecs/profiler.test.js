/**
 * Tests for SystemProfiler
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SystemProfiler } from './profiler.js';

describe('SystemProfiler', () => {
  let profiler;

  beforeEach(() => {
    profiler = new SystemProfiler();
  });

  describe('constructor', () => {
    it('creates profiler with default options', () => {
      expect(profiler.enabled).toBe(true);
      expect(profiler.sampleSize).toBe(100);
      expect(profiler.systems.size).toBe(0);
    });

    it('respects custom options', () => {
      const custom = new SystemProfiler({
        enabled: false,
        sampleSize: 50
      });

      expect(custom.enabled).toBe(false);
      expect(custom.sampleSize).toBe(50);
    });
  });

  describe('startSystem', () => {
    it('returns a stop function', () => {
      const stop = profiler.startSystem('testSystem');
      expect(typeof stop).toBe('function');
    });

    it('records system timing when stopped', () => {
      const stop = profiler.startSystem('testSystem');
      stop();

      const stats = profiler.getSystemStats('testSystem');
      expect(stats).toBeDefined();
      expect(stats.recent.samples).toBe(1);
    });

    it('does nothing when disabled', () => {
      profiler.setEnabled(false);

      const stop = profiler.startSystem('testSystem');
      stop();

      const stats = profiler.getSystemStats('testSystem');
      expect(stats).toBeNull();
    });
  });

  describe('recordSystem', () => {
    it('records system execution time', () => {
      profiler.recordSystem('testSystem', 10.5);

      const stats = profiler.getSystemStats('testSystem');
      expect(stats.recent.average).toBeCloseTo(10.5, 1);
      expect(stats.overall.executions).toBe(1);
    });

    it('maintains sample size limit', () => {
      const smallProfiler = new SystemProfiler({ sampleSize: 3 });

      for (let i = 0; i < 5; i++) {
        smallProfiler.recordSystem('testSystem', i);
      }

      const stats = smallProfiler.getSystemStats('testSystem');
      expect(stats.recent.samples).toBe(3);
      expect(stats.overall.executions).toBe(5);
    });

    it('calculates min/max/avg correctly', () => {
      profiler.recordSystem('testSystem', 5);
      profiler.recordSystem('testSystem', 10);
      profiler.recordSystem('testSystem', 15);

      const stats = profiler.getSystemStats('testSystem');
      expect(stats.recent.min).toBe(5);
      expect(stats.recent.max).toBe(15);
      expect(stats.recent.average).toBe(10);
    });
  });

  describe('startFrame', () => {
    it('returns a stop function', () => {
      const stop = profiler.startFrame();
      expect(typeof stop).toBe('function');
    });

    it('records frame timing when stopped', () => {
      const stop = profiler.startFrame();
      stop();

      const stats = profiler.getFrameStats();
      expect(stats.overall.frames).toBe(1);
    });

    it('does nothing when disabled', () => {
      profiler.setEnabled(false);

      const stop = profiler.startFrame();
      stop();

      const stats = profiler.getFrameStats();
      expect(stats.overall.frames).toBe(0);
    });
  });

  describe('recordFrame', () => {
    it('records frame time', () => {
      profiler.recordFrame(16.67);

      const stats = profiler.getFrameStats();
      expect(stats.recent.average).toBeCloseTo(16.67, 1);
      expect(stats.overall.frames).toBe(1);
    });

    it('calculates FPS correctly', () => {
      profiler.recordFrame(16.67); // ~60 FPS

      const stats = profiler.getFrameStats();
      expect(stats.recent.fps).toBeCloseTo(60, 0);
    });

    it('maintains sample size limit', () => {
      const smallProfiler = new SystemProfiler({ sampleSize: 3 });

      for (let i = 0; i < 5; i++) {
        smallProfiler.recordFrame(10);
      }

      const stats = smallProfiler.getFrameStats();
      expect(stats.recent.samples).toBe(3);
      expect(stats.overall.frames).toBe(5);
    });
  });

  describe('getSystemStats', () => {
    it('returns null for non-existent system', () => {
      const stats = profiler.getSystemStats('nonexistent');
      expect(stats).toBeNull();
    });

    it('returns stats for recorded system', () => {
      profiler.recordSystem('testSystem', 10);

      const stats = profiler.getSystemStats('testSystem');
      expect(stats).toBeDefined();
      expect(stats.systemName).toBe('testSystem');
      expect(stats.recent).toBeDefined();
      expect(stats.overall).toBeDefined();
    });

    it('differentiates recent vs overall stats', () => {
      const smallProfiler = new SystemProfiler({ sampleSize: 2 });

      // Record 3 samples: 5, 10, 15
      smallProfiler.recordSystem('testSystem', 5);
      smallProfiler.recordSystem('testSystem', 10);
      smallProfiler.recordSystem('testSystem', 15);

      const stats = smallProfiler.getSystemStats('testSystem');

      // Recent should only have last 2 samples (10, 15)
      expect(stats.recent.samples).toBe(2);
      expect(stats.recent.average).toBe(12.5);

      // Overall should have all 3
      expect(stats.overall.executions).toBe(3);
      expect(stats.overall.average).toBe(10);
    });
  });

  describe('getFrameStats', () => {
    it('returns zero stats for no data', () => {
      const stats = profiler.getFrameStats();

      expect(stats.recent.average).toBe(0);
      expect(stats.overall.frames).toBe(0);
    });

    it('returns stats for recorded frames', () => {
      profiler.recordFrame(16);
      profiler.recordFrame(17);

      const stats = profiler.getFrameStats();
      expect(stats.recent.average).toBeCloseTo(16.5, 1);
      expect(stats.overall.frames).toBe(2);
    });
  });

  describe('getAllStats', () => {
    it('returns empty array for no systems', () => {
      const stats = profiler.getAllStats();
      expect(stats).toEqual([]);
    });

    it('returns all system stats', () => {
      profiler.recordSystem('system1', 10);
      profiler.recordSystem('system2', 20);
      profiler.recordSystem('system3', 5);

      const stats = profiler.getAllStats();
      expect(stats.length).toBe(3);
    });

    it('sorts by recent average time descending', () => {
      profiler.recordSystem('slow', 30);
      profiler.recordSystem('fast', 5);
      profiler.recordSystem('medium', 15);

      const stats = profiler.getAllStats();
      expect(stats[0].systemName).toBe('slow');
      expect(stats[1].systemName).toBe('medium');
      expect(stats[2].systemName).toBe('fast');
    });
  });

  describe('summary', () => {
    it('returns complete summary', () => {
      profiler.recordFrame(16);
      profiler.recordSystem('system1', 5);
      profiler.recordSystem('system2', 8);

      const summary = profiler.summary();

      expect(summary.enabled).toBe(true);
      expect(summary.systemCount).toBe(2);
      expect(summary.systemTotal).toBe(13); // 5 + 8
      expect(summary.overhead).toBeCloseTo(3, 0); // 16 - 13
      expect(summary.frame).toBeDefined();
      expect(summary.systems.length).toBe(2);
    });
  });

  describe('findBottlenecks', () => {
    it('identifies systems exceeding threshold', () => {
      profiler.recordSystem('fast', 5);
      profiler.recordSystem('slow', 50);
      profiler.recordSystem('medium', 10);

      const bottlenecks = profiler.findBottlenecks(30); // 30% threshold

      expect(bottlenecks.length).toBe(1);
      expect(bottlenecks[0].systemName).toBe('slow');
      expect(parseFloat(bottlenecks[0].percentage)).toBeGreaterThan(30);
    });

    it('uses default 20% threshold', () => {
      profiler.recordSystem('system1', 25);
      profiler.recordSystem('system2', 75);

      const bottlenecks = profiler.findBottlenecks();

      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks.some(b => b.systemName === 'system2')).toBe(true);
    });
  });

  describe('reset', () => {
    it('clears all profiling data', () => {
      profiler.recordSystem('system1', 10);
      profiler.recordFrame(16);

      profiler.reset();

      expect(profiler.systems.size).toBe(0);
      expect(profiler.frameCount).toBe(0);
      expect(profiler.getAllStats()).toEqual([]);
    });
  });

  describe('resetSystem', () => {
    it('clears specific system data', () => {
      profiler.recordSystem('system1', 10);
      profiler.recordSystem('system2', 20);

      profiler.resetSystem('system1');

      expect(profiler.getSystemStats('system1')).toBeNull();
      expect(profiler.getSystemStats('system2')).toBeDefined();
    });
  });

  describe('setEnabled', () => {
    it('enables profiling', () => {
      profiler.setEnabled(false);
      expect(profiler.enabled).toBe(false);

      profiler.setEnabled(true);
      expect(profiler.enabled).toBe(true);
    });

    it('prevents recording when disabled', () => {
      profiler.setEnabled(false);

      profiler.recordSystem('system1', 10);
      profiler.recordFrame(16);

      expect(profiler.getSystemStats('system1')).toBeNull();
      expect(profiler.getFrameStats().overall.frames).toBe(0);
    });
  });

  describe('export', () => {
    it('exports profiling data as JSON', () => {
      profiler.recordSystem('system1', 10);
      profiler.recordFrame(16);

      const exported = profiler.export();

      expect(exported.enabled).toBe(true);
      expect(exported.sampleSize).toBe(100);
      expect(exported.frame).toBeDefined();
      expect(exported.systems.length).toBe(1);
      expect(exported.timestamp).toBeDefined();
    });

    it('produces valid JSON', () => {
      profiler.recordSystem('system1', 10);

      const exported = profiler.export();
      const json = JSON.stringify(exported);

      expect(json).toBeTruthy();

      const parsed = JSON.parse(json);
      expect(parsed.enabled).toBe(true);
    });
  });

  describe('Integration', () => {
    it('can profile multiple systems over multiple frames', () => {
      // Simulate 3 frames
      for (let frame = 0; frame < 3; frame++) {
        const stopFrame = profiler.startFrame();

        const stop1 = profiler.startSystem('physicsSystem');
        // Simulate work
        stop1();

        const stop2 = profiler.startSystem('renderSystem');
        // Simulate work
        stop2();

        stopFrame();
      }

      const summary = profiler.summary();
      expect(summary.frame.overall.frames).toBe(3);
      expect(summary.systemCount).toBe(2);

      const physics = profiler.getSystemStats('physicsSystem');
      const render = profiler.getSystemStats('renderSystem');

      expect(physics.overall.executions).toBe(3);
      expect(render.overall.executions).toBe(3);
    });

    it('handles real timing measurements', (done) => {
      const stop = profiler.startSystem('delayedSystem');

      // Wait 10ms
      setTimeout(() => {
        stop();

        const stats = profiler.getSystemStats('delayedSystem');
        // Just verify it was recorded, don't assert exact timing
        // (setTimeout is unreliable in test environments)
        expect(stats).toBeDefined();
        expect(stats.overall.executions).toBe(1);
        expect(stats.recent.average).toBeGreaterThan(0);

        done();
      }, 10);
    });
  });
});

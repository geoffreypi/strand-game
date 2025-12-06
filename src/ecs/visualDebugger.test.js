/**
 * Tests for VisualDebugger
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { World } from './World.js';
import { VisualDebugger } from './visualDebugger.js';
import {
  COMPONENT_TYPES,
  createPositionComponent,
  createResidueComponent,
  createSignalComponent
} from './components.js';

describe('VisualDebugger', () => {
  let world;
  let vdebug;

  beforeEach(() => {
    world = new World();
    vdebug = new VisualDebugger(world);
  });

  describe('constructor', () => {
    it('creates vdebug with empty history', () => {
      expect(vdebug.world).toBe(world);
      expect(vdebug.history).toEqual([]);
      expect(vdebug.currentStep).toBe(0);
    });
  });

  describe('snapshot', () => {
    it('captures current World state', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.POSITION,
        createPositionComponent(0, 0, 'mol1'));
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(true));

      vdebug.snapshot('test');

      expect(vdebug.history.length).toBe(1);
      expect(vdebug.history[0].label).toBe('test');
      expect(vdebug.history[0].entityCount).toBe(1);
    });

    it('captures signal state', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(true, false, 0.5));

      vdebug.snapshot('test');

      const snapshot = vdebug.history[0];
      const signalState = snapshot.signalState.get(0);

      expect(signalState).toBeDefined();
      expect(signalState.on).toBe(true);
      expect(signalState.source).toBe(false);
      expect(signalState.strength).toBe(0.5);
    });

    it('captures position state', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.POSITION,
        createPositionComponent(5, 10, 'test-mol'));

      vdebug.snapshot('test');

      const snapshot = vdebug.history[0];
      const posState = snapshot.positionState.get(entity);

      expect(posState).toBeDefined();
      expect(posState.q).toBe(5);
      expect(posState.r).toBe(10);
      expect(posState.moleculeId).toBe('test-mol');
    });

    it('includes metadata', () => {
      vdebug.snapshot('test', { foo: 'bar', count: 42 });

      const snapshot = vdebug.history[0];
      expect(snapshot.metadata.foo).toBe('bar');
      expect(snapshot.metadata.count).toBe(42);
    });

    it('increments currentStep', () => {
      vdebug.snapshot('step1');
      expect(vdebug.currentStep).toBe(0);

      vdebug.snapshot('step2');
      expect(vdebug.currentStep).toBe(1);
    });

    it('captures multiple snapshots', () => {
      vdebug.snapshot('step1');
      vdebug.snapshot('step2');
      vdebug.snapshot('step3');

      expect(vdebug.history.length).toBe(3);
      expect(vdebug.history[0].step).toBe(0);
      expect(vdebug.history[1].step).toBe(1);
      expect(vdebug.history[2].step).toBe(2);
    });
  });

  describe('visualizeSignalPropagation', () => {
    it('captures propagation steps', () => {
      // Create simple test setup
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(true));

      let callCount = 0;
      const propagateFn = (w) => {
        callCount++;
        return { changed: callCount < 3 }; // Stop after 3 steps
      };

      const history = vdebug.visualizeSignalPropagation(propagateFn, 5);

      expect(history.length).toBe(4); // Initial + 3 steps
      expect(callCount).toBe(3);
    });

    it('stops when nothing changes', () => {
      const propagateFn = () => ({ changed: false });

      const history = vdebug.visualizeSignalPropagation(propagateFn, 10);

      expect(history.length).toBe(2); // Initial + 1 step that didn't change
    });

    it('respects maxSteps limit', () => {
      const propagateFn = () => ({ changed: true });

      const history = vdebug.visualizeSignalPropagation(propagateFn, 3);

      expect(history.length).toBe(4); // Initial + 3 steps
    });

    it('includes metadata from propagation function', () => {
      const propagateFn = () => ({
        changed: false,
        propagated: 5
      });

      const history = vdebug.visualizeSignalPropagation(propagateFn, 1);

      expect(history[1].metadata.propagated).toBe(5);
    });
  });

  describe('getSignalChanges', () => {
    it('detects signals turned on', () => {
      // Initial: signal off
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(false));

      vdebug.snapshot('before');

      // Turn signal on
      const signal = world.getComponent(entity, COMPONENT_TYPES.SIGNAL);
      signal.on = true;

      vdebug.snapshot('after');

      const changes = vdebug.getSignalChanges(0, 1);

      expect(changes.turnedOn).toEqual([0]);
      expect(changes.turnedOff).toEqual([]);
      expect(changes.hasChanges).toBe(true);
    });

    it('detects signals turned off', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(true)); // Start on

      vdebug.snapshot('before');

      const signal = world.getComponent(entity, COMPONENT_TYPES.SIGNAL);
      signal.on = false;

      vdebug.snapshot('after');

      const changes = vdebug.getSignalChanges(0, 1);

      expect(changes.turnedOn).toEqual([]);
      expect(changes.turnedOff).toEqual([0]);
      expect(changes.hasChanges).toBe(true);
    });

    it('detects new signals', () => {
      vdebug.snapshot('before');

      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(true));

      vdebug.snapshot('after');

      const changes = vdebug.getSignalChanges(0, 1);

      expect(changes.newSignals).toEqual([0]);
      expect(changes.hasChanges).toBe(true);
    });

    it('detects removed signals', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(true));

      vdebug.snapshot('before');

      world.removeComponent(entity, COMPONENT_TYPES.SIGNAL);

      vdebug.snapshot('after');

      const changes = vdebug.getSignalChanges(0, 1);

      expect(changes.removedSignals).toEqual([0]);
      expect(changes.hasChanges).toBe(true);
    });

    it('reports no changes when nothing changed', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(true));

      vdebug.snapshot('before');
      vdebug.snapshot('after');

      const changes = vdebug.getSignalChanges(0, 1);

      expect(changes.hasChanges).toBe(false);
      expect(changes.turnedOn).toEqual([]);
      expect(changes.turnedOff).toEqual([]);
    });

    it('returns null for invalid step indices', () => {
      vdebug.snapshot('test');

      expect(vdebug.getSignalChanges(-1, 0)).toBeNull();
      expect(vdebug.getSignalChanges(0, 5)).toBeNull();
    });
  });

  describe('compare', () => {
    it('compares two snapshots', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(false));

      vdebug.snapshot('step1', { value: 1 });

      const signal = world.getComponent(entity, COMPONENT_TYPES.SIGNAL);
      signal.on = true;

      vdebug.snapshot('step2', { value: 2 });

      const comparison = vdebug.compare(0, 1);

      expect(comparison.steps).toEqual([0, 1]);
      expect(comparison.labels).toEqual(['step1', 'step2']);
      expect(comparison.signalChanges.turnedOn).toEqual([0]);
      expect(comparison.metadata.from.value).toBe(1);
      expect(comparison.metadata.to.value).toBe(2);
    });

    it('calculates entity count diff', () => {
      vdebug.snapshot('before');

      world.createEntity();
      world.createEntity();

      vdebug.snapshot('after');

      const comparison = vdebug.compare(0, 1);

      expect(comparison.entityCountDiff).toBe(2);
    });

    it('returns null for invalid indices', () => {
      vdebug.snapshot('test');

      expect(vdebug.compare(-1, 0)).toBeNull();
      expect(vdebug.compare(0, 5)).toBeNull();
    });
  });

  describe('reset', () => {
    it('clears history and resets step', () => {
      vdebug.snapshot('step1');
      vdebug.snapshot('step2');

      expect(vdebug.history.length).toBe(2);

      vdebug.reset();

      expect(vdebug.history.length).toBe(0);
      expect(vdebug.currentStep).toBe(0);
    });
  });

  describe('getHistory', () => {
    it('returns copy of history', () => {
      vdebug.snapshot('step1');
      vdebug.snapshot('step2');

      const history = vdebug.getHistory();

      expect(history.length).toBe(2);

      // Modifying returned history shouldn't affect original
      history.push({ label: 'fake' });

      expect(vdebug.history.length).toBe(2);
    });
  });

  describe('export', () => {
    it('exports history as JSON', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(true));

      vdebug.snapshot('test', { foo: 'bar' });

      const exported = vdebug.export();

      expect(exported.totalSteps).toBe(1);
      expect(exported.currentStep).toBe(0);
      expect(exported.history.length).toBe(1);
      expect(exported.history[0].label).toBe('test');
      expect(exported.history[0].metadata.foo).toBe('bar');
    });

    it('produces valid JSON', () => {
      vdebug.snapshot('test');

      const exported = vdebug.export();
      const json = JSON.stringify(exported);

      expect(json).toBeTruthy();

      const parsed = JSON.parse(json);
      expect(parsed.totalSteps).toBe(1);
    });

    it('converts Maps to arrays for serialization', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(true));

      vdebug.snapshot('test');

      const exported = vdebug.export();

      // Signal state should be array of [index, state] tuples
      expect(Array.isArray(exported.history[0].signalState)).toBe(true);
      expect(exported.history[0].signalState.length).toBe(1);
      expect(exported.history[0].signalState[0][0]).toBe(0); // Index
      expect(exported.history[0].signalState[0][1].on).toBe(true); // State
    });
  });

  describe('Integration', () => {
    it('tracks full propagation scenario', () => {
      // Create chain: SIG-SIG-SIG
      const entities = [];
      for (let i = 0; i < 3; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, COMPONENT_TYPES.POSITION,
          createPositionComponent(i, 0, 'mol1'));
        world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
          createResidueComponent('SIG', 0, i));
        world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
          createSignalComponent(i === 0)); // First is source

        entities.push(entity);
      }

      const propagate = (w) => {
        const signaled = w.query([COMPONENT_TYPES.SIGNAL, COMPONENT_TYPES.POSITION]);
        let changed = false;

        for (const entityId of signaled) {
          const signal = w.getComponent(entityId, COMPONENT_TYPES.SIGNAL);
          const position = w.getComponent(entityId, COMPONENT_TYPES.POSITION);

          if (signal.on) {
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

      const history = vdebug.visualizeSignalPropagation(propagate, 5);

      // Should have: Initial (1 on), Step 1 (2 on), Step 2 (3 on), Step 3 (no change)
      expect(history.length).toBeGreaterThanOrEqual(3);

      // Verify final state has all signals on
      const finalSnapshot = history[history.length - 1];
      const activeCount = Array.from(finalSnapshot.signalState.values())
        .filter(s => s.on).length;

      expect(activeCount).toBe(3);
    });
  });
});

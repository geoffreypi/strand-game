/**
 * Tests for SystemScheduler
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { World } from './World.js';
import { SystemScheduler } from './SystemScheduler.js';
import { COMPONENT_TYPES, createPositionComponent, createResidueComponent } from './components.js';

describe('SystemScheduler', () => {
  let world;
  let scheduler;

  beforeEach(() => {
    world = new World();
    scheduler = new SystemScheduler(world);
  });

  describe('Registration', () => {
    it('registers a system', () => {
      const testSystem = () => ({ called: true });

      scheduler.registerSystem('test', testSystem);

      expect(scheduler.hasSystem('test')).toBe(true);
      expect(scheduler.getSystemNames()).toContain('test');
    });

    it('registers multiple systems', () => {
      const system1 = () => ({ id: 1 });
      const system2 = () => ({ id: 2 });

      scheduler.registerSystem('system1', system1);
      scheduler.registerSystem('system2', system2);

      expect(scheduler.getSystemNames().length).toBe(2);
      expect(scheduler.hasSystem('system1')).toBe(true);
      expect(scheduler.hasSystem('system2')).toBe(true);
    });

    it('unregisters a system', () => {
      const testSystem = () => ({ called: true });

      scheduler.registerSystem('test', testSystem);
      expect(scheduler.hasSystem('test')).toBe(true);

      scheduler.unregisterSystem('test');
      expect(scheduler.hasSystem('test')).toBe(false);
    });

    it('handles unregistering non-existent system', () => {
      expect(() => {
        scheduler.unregisterSystem('nonexistent');
      }).not.toThrow();
    });
  });

  describe('Execution', () => {
    it('runs a single system', () => {
      let called = false;
      const testSystem = (world, context) => {
        called = true;
        return { success: true };
      };

      scheduler.registerSystem('test', testSystem);
      const result = scheduler.runSystem('test');

      expect(called).toBe(true);
      expect(result.success).toBe(true);
    });

    it('passes world to system', () => {
      let receivedWorld = null;
      const testSystem = (w) => {
        receivedWorld = w;
        return {};
      };

      scheduler.registerSystem('test', testSystem);
      scheduler.runSystem('test');

      expect(receivedWorld).toBe(world);
    });

    it('passes context to system', () => {
      let receivedContext = null;
      const testSystem = (w, ctx) => {
        receivedContext = ctx;
        return {};
      };

      const testContext = { foo: 'bar', value: 42 };
      scheduler.registerSystem('test', testSystem);
      scheduler.runSystem('test', testContext);

      expect(receivedContext).toEqual(testContext);
    });

    it('throws error for non-existent system', () => {
      expect(() => {
        scheduler.runSystem('nonexistent');
      }).toThrow('System \'nonexistent\' not registered');
    });

    it('systems can read and modify world', () => {
      const setupSystem = (w) => {
        const entity = w.createEntity();
        w.addComponent(entity, COMPONENT_TYPES.POSITION,
          createPositionComponent(0, 0, 'test'));
        return { entityId: entity };
      };

      const readSystem = (w) => {
        const entities = w.query([COMPONENT_TYPES.POSITION]);
        return { count: entities.length };
      };

      scheduler.registerSystem('setup', setupSystem);
      scheduler.registerSystem('read', readSystem);

      scheduler.runSystem('setup');
      const result = scheduler.runSystem('read');

      expect(result.count).toBe(1);
    });
  });

  describe('Phases', () => {
    it('runs systems in a phase', () => {
      const calls = [];

      scheduler.registerSystem('sys1', () => {
        calls.push('sys1');
        return {};
      }, { phase: 'update' });

      scheduler.registerSystem('sys2', () => {
        calls.push('sys2');
        return {};
      }, { phase: 'update' });

      scheduler.runPhase('update');

      expect(calls).toContain('sys1');
      expect(calls).toContain('sys2');
    });

    it('returns results from phase execution', () => {
      scheduler.registerSystem('sys1', () => ({ value: 1 }), { phase: 'update' });
      scheduler.registerSystem('sys2', () => ({ value: 2 }), { phase: 'update' });

      const results = scheduler.runPhase('update');

      expect(results.get('sys1').value).toBe(1);
      expect(results.get('sys2').value).toBe(2);
    });

    it('returns empty map for non-existent phase', () => {
      const results = scheduler.runPhase('nonexistent');

      expect(results.size).toBe(0);
    });

    it('respects priority within phase', () => {
      const calls = [];

      scheduler.registerSystem('low', () => {
        calls.push('low');
        return {};
      }, { phase: 'update', priority: 10 });

      scheduler.registerSystem('high', () => {
        calls.push('high');
        return {};
      }, { phase: 'update', priority: 1 });

      scheduler.registerSystem('medium', () => {
        calls.push('medium');
        return {};
      }, { phase: 'update', priority: 5 });

      scheduler.runPhase('update');

      expect(calls).toEqual(['high', 'medium', 'low']);
    });
  });

  describe('Tick', () => {
    it('runs all systems in order', () => {
      const calls = [];

      scheduler.registerSystem('init', () => {
        calls.push('init');
        return {};
      }, { phase: 'init', priority: 0 });

      scheduler.registerSystem('update', () => {
        calls.push('update');
        return {};
      }, { phase: 'update', priority: 0 });

      scheduler.registerSystem('render', () => {
        calls.push('render');
        return {};
      }, { phase: 'render', priority: 0 });

      scheduler.tick();

      expect(calls).toEqual(['init', 'update', 'render']);
    });

    it('returns results from all systems', () => {
      scheduler.registerSystem('sys1', () => ({ value: 1 }), { phase: 'update' });
      scheduler.registerSystem('sys2', () => ({ value: 2 }), { phase: 'update' });

      const results = scheduler.tick();

      expect(results.get('sys1').value).toBe(1);
      expect(results.get('sys2').value).toBe(2);
    });

    it('passes context to all systems', () => {
      const receivedContexts = [];

      scheduler.registerSystem('sys1', (world, context) => {
        receivedContexts.push(context);
        return {};
      });

      scheduler.registerSystem('sys2', (world, context) => {
        receivedContexts.push(context);
        return {};
      });

      const testContext = { tick: 42 };
      scheduler.tick(testContext);

      expect(receivedContexts).toHaveLength(2);
      expect(receivedContexts[0]).toEqual(testContext);
      expect(receivedContexts[1]).toEqual(testContext);
    });

    it('respects phase order', () => {
      const calls = [];

      scheduler.registerSystem('physics', () => {
        calls.push('physics');
        return {};
      }, { phase: 'physics' });

      scheduler.registerSystem('input', () => {
        calls.push('input');
        return {};
      }, { phase: 'input' });

      scheduler.registerSystem('update', () => {
        calls.push('update');
        return {};
      }, { phase: 'update' });

      scheduler.tick();

      // Expected order: input, update, physics
      expect(calls.indexOf('input')).toBeLessThan(calls.indexOf('update'));
      expect(calls.indexOf('update')).toBeLessThan(calls.indexOf('physics'));
    });
  });

  describe('System Order', () => {
    it('returns correct execution order', () => {
      scheduler.registerSystem('sys1', () => {}, { phase: 'update', priority: 2 });
      scheduler.registerSystem('sys2', () => {}, { phase: 'init', priority: 1 });
      scheduler.registerSystem('sys3', () => {}, { phase: 'update', priority: 1 });

      const order = scheduler.getSystemOrder();

      // Expected order: sys2 (init, pri 1), sys3 (update, pri 1), sys1 (update, pri 2)
      expect(order.indexOf('sys2')).toBeLessThan(order.indexOf('sys3'));
      expect(order.indexOf('sys3')).toBeLessThan(order.indexOf('sys1'));
    });

    it('updates order when systems are added', () => {
      scheduler.registerSystem('sys1', () => {}, { phase: 'update' });

      let order = scheduler.getSystemOrder();
      expect(order).toEqual(['sys1']);

      scheduler.registerSystem('sys2', () => {}, { phase: 'init' });

      order = scheduler.getSystemOrder();
      expect(order).toEqual(['sys2', 'sys1']);
    });

    it('updates order when systems are removed', () => {
      scheduler.registerSystem('sys1', () => {}, { phase: 'init' });
      scheduler.registerSystem('sys2', () => {}, { phase: 'update' });
      scheduler.registerSystem('sys3', () => {}, { phase: 'render' });

      scheduler.unregisterSystem('sys2');

      const order = scheduler.getSystemOrder();
      expect(order).toEqual(['sys1', 'sys3']);
      expect(order).not.toContain('sys2');
    });
  });

  describe('Integration', () => {
    it('systems can communicate via shared context', () => {
      const producerSystem = (w, ctx) => {
        ctx.sharedData = 'hello from producer';
        return {};
      };

      const consumerSystem = (w, ctx) => {
        return { received: ctx.sharedData };
      };

      scheduler.registerSystem('producer', producerSystem, { phase: 'init' });
      scheduler.registerSystem('consumer', consumerSystem, { phase: 'update' });

      const sharedContext = {};
      const results = scheduler.tick(sharedContext);

      expect(results.get('consumer').received).toBe('hello from producer');
    });

    it('systems can query and modify entities', () => {
      // Setup system: creates entities
      const setupSystem = (w) => {
        for (let i = 0; i < 3; i++) {
          const entity = w.createEntity();
          w.addComponent(entity, COMPONENT_TYPES.POSITION,
            createPositionComponent(i, 0, 'mol1'));
          w.addComponent(entity, COMPONENT_TYPES.RESIDUE,
            createResidueComponent('SIG', 0, i));
        }
        return { created: 3 };
      };

      // Process system: queries and counts entities
      const processSystem = (w) => {
        const entities = w.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);
        return { count: entities.length };
      };

      scheduler.registerSystem('setup', setupSystem, { phase: 'init' });
      scheduler.registerSystem('process', processSystem, { phase: 'update' });

      const results = scheduler.tick();

      expect(results.get('setup').created).toBe(3);
      expect(results.get('process').count).toBe(3);
    });
  });
});

/**
 * Tests for World Inspector
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { World } from './World.js';
import { WorldInspector } from './inspector.js';
import {
  COMPONENT_TYPES,
  createPositionComponent,
  createResidueComponent,
  createSignalComponent,
  createConfigComponent,
  createIndexManagerComponent
} from './components.js';

describe('WorldInspector', () => {
  let world;
  let inspector;

  beforeEach(() => {
    world = new World();
    inspector = new WorldInspector(world);
  });

  describe('summary()', () => {
    it('returns summary of empty world', () => {
      const summary = inspector.summary();

      expect(summary.entityCount).toBe(0);
      expect(summary.totalComponents).toBe(0);
      expect(Object.keys(summary.componentTypes).length).toBe(0);
    });

    it('returns summary with entities and components', () => {
      // Create some entities
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();

      world.addComponent(e1, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol1'));
      world.addComponent(e1, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));

      world.addComponent(e2, COMPONENT_TYPES.POSITION, createPositionComponent(1, 0, 'mol1'));
      world.addComponent(e2, COMPONENT_TYPES.RESIDUE, createResidueComponent('AND', 0, 1));
      world.addComponent(e2, COMPONENT_TYPES.SIGNAL, createSignalComponent());

      world.addComponent(e3, COMPONENT_TYPES.CONFIG, createConfigComponent());

      const summary = inspector.summary();

      expect(summary.entityCount).toBe(3);
      expect(summary.componentTypes[COMPONENT_TYPES.POSITION]).toBe(2);
      expect(summary.componentTypes[COMPONENT_TYPES.RESIDUE]).toBe(2);
      expect(summary.componentTypes[COMPONENT_TYPES.SIGNAL]).toBe(1);
      expect(summary.componentTypes[COMPONENT_TYPES.CONFIG]).toBe(1);
      expect(summary.totalComponents).toBe(6);
    });
  });

  describe('find()', () => {
    it('finds entities by component predicate', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();

      world.addComponent(e1, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));
      world.addComponent(e2, COMPONENT_TYPES.RESIDUE, createResidueComponent('AND', 0, 1));
      world.addComponent(e3, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 2));

      // Find all SIG residues
      const sigResidues = inspector.find(COMPONENT_TYPES.RESIDUE, r => r.type === 'SIG');

      expect(sigResidues.length).toBe(2);
      expect(sigResidues[0].entityId).toBe(e1);
      expect(sigResidues[1].entityId).toBe(e3);
    });

    it('returns empty array for non-existent component type', () => {
      const results = inspector.find('NonExistent', () => true);

      expect(results).toEqual([]);
    });

    it('returns empty array when no matches', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));

      const results = inspector.find(COMPONENT_TYPES.RESIDUE, r => r.type === 'XYZ');

      expect(results).toEqual([]);
    });
  });

  describe('inspect()', () => {
    it('inspects entity with multiple components', () => {
      const entityId = world.createEntity();

      world.addComponent(entityId, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol1'));
      world.addComponent(entityId, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));
      world.addComponent(entityId, COMPONENT_TYPES.SIGNAL, createSignalComponent(true, false));

      const data = inspector.inspect(entityId);

      expect(data.entityId).toBe(entityId);
      expect(data.exists).toBe(true);
      expect(Object.keys(data.components).length).toBe(3);
      expect(data.components[COMPONENT_TYPES.POSITION]).toEqual({ q: 0, r: 0, moleculeId: 'mol1' });
      expect(data.components[COMPONENT_TYPES.RESIDUE].type).toBe('SIG');
      expect(data.components[COMPONENT_TYPES.SIGNAL].on).toBe(true);
    });

    it('returns exists:false for non-existent entity', () => {
      const data = inspector.inspect(999);

      expect(data.entityId).toBe(999);
      expect(data.exists).toBe(false);
      expect(data.components).toEqual({});
    });
  });

  describe('validate()', () => {
    it('validates empty world', () => {
      const result = inspector.validate();

      expect(result.valid).toBe(false); // No singletons
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validates world with singletons', () => {
      const config = world.createEntity();
      const indexMgr = world.createEntity();

      world.addComponent(config, COMPONENT_TYPES.CONFIG, createConfigComponent());
      world.addComponent(indexMgr, COMPONENT_TYPES.INDEX_MANAGER, createIndexManagerComponent());

      const result = inspector.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('detects position conflicts', () => {
      const config = world.createEntity();
      const indexMgr = world.createEntity();
      world.addComponent(config, COMPONENT_TYPES.CONFIG, createConfigComponent());
      world.addComponent(indexMgr, COMPONENT_TYPES.INDEX_MANAGER, createIndexManagerComponent());

      const e1 = world.createEntity();
      const e2 = world.createEntity();

      // Both at same position
      world.addComponent(e1, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol1'));
      world.addComponent(e2, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol2'));

      const result = inspector.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Position conflict'))).toBe(true);
    });

    it('detects residue without position', () => {
      const config = world.createEntity();
      const indexMgr = world.createEntity();
      world.addComponent(config, COMPONENT_TYPES.CONFIG, createConfigComponent());
      world.addComponent(indexMgr, COMPONENT_TYPES.INDEX_MANAGER, createIndexManagerComponent());

      const e1 = world.createEntity();
      world.addComponent(e1, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));
      // No position component!

      const result = inspector.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('has no Position'))).toBe(true);
    });

    it('detects multiple config singletons', () => {
      const config1 = world.createEntity();
      const config2 = world.createEntity();
      const indexMgr = world.createEntity();

      world.addComponent(config1, COMPONENT_TYPES.CONFIG, createConfigComponent());
      world.addComponent(config2, COMPONENT_TYPES.CONFIG, createConfigComponent());
      world.addComponent(indexMgr, COMPONENT_TYPES.INDEX_MANAGER, createIndexManagerComponent());

      const result = inspector.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Multiple Config'))).toBe(true);
    });
  });

  describe('export()', () => {
    it('exports world to JSON', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol1'));
      world.addComponent(e1, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));

      const exported = inspector.export();

      expect(exported.entityCount).toBe(1);
      expect(exported.entities).toContain(e1);
      expect(exported.components[COMPONENT_TYPES.POSITION]).toBeDefined();
      expect(exported.components[COMPONENT_TYPES.POSITION].length).toBe(1);
      expect(exported.components[COMPONENT_TYPES.POSITION][0].entityId).toBe(e1);
      expect(exported.components[COMPONENT_TYPES.POSITION][0].data.q).toBe(0);
    });

    it('exports to serializable JSON', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol1'));

      const exported = inspector.export();
      const json = JSON.stringify(exported);

      expect(json).toBeTruthy();

      const parsed = JSON.parse(json);
      expect(parsed.entityCount).toBe(1);
    });
  });

  describe('stats()', () => {
    it('calculates entity statistics', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();

      world.addComponent(e1, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol1'));

      world.addComponent(e2, COMPONENT_TYPES.POSITION, createPositionComponent(1, 0, 'mol1'));
      world.addComponent(e2, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));

      world.addComponent(e3, COMPONENT_TYPES.POSITION, createPositionComponent(2, 0, 'mol1'));
      world.addComponent(e3, COMPONENT_TYPES.RESIDUE, createResidueComponent('AND', 0, 1));
      world.addComponent(e3, COMPONENT_TYPES.SIGNAL, createSignalComponent());

      const stats = inspector.stats();

      expect(stats.entities.total).toBe(3);
      expect(stats.entities.byComponentCount[1]).toBe(1); // e1
      expect(stats.entities.byComponentCount[2]).toBe(1); // e2
      expect(stats.entities.byComponentCount[3]).toBe(1); // e3

      expect(stats.components[COMPONENT_TYPES.POSITION].count).toBe(3);
      expect(stats.components[COMPONENT_TYPES.RESIDUE].count).toBe(2);
      expect(stats.components[COMPONENT_TYPES.SIGNAL].count).toBe(1);
    });
  });

  describe('query()', () => {
    it('queries entities with components', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();

      world.addComponent(e1, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol1'));
      world.addComponent(e1, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));

      world.addComponent(e2, COMPONENT_TYPES.POSITION, createPositionComponent(1, 0, 'mol1'));
      world.addComponent(e2, COMPONENT_TYPES.RESIDUE, createResidueComponent('AND', 0, 1));

      const results = inspector.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

      expect(results.length).toBe(2);
      expect(results[0].entityId).toBe(e1);
      expect(results[0].Position).toBeDefined();
      expect(results[0].Residue).toBeDefined();
      expect(results[1].entityId).toBe(e2);
    });
  });

  describe('Integration', () => {
    it('can inspect and validate complex world', () => {
      // Create a realistic World setup
      const config = world.createEntity();
      const indexMgr = world.createEntity();

      world.addComponent(config, COMPONENT_TYPES.CONFIG, createConfigComponent());
      world.addComponent(indexMgr, COMPONENT_TYPES.INDEX_MANAGER, createIndexManagerComponent());

      // Add some residues
      for (let i = 0; i < 5; i++) {
        const e = world.createEntity();
        world.addComponent(e, COMPONENT_TYPES.POSITION, createPositionComponent(i, 0, 'mol1'));
        world.addComponent(e, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, i));

        if (i % 2 === 0) {
          world.addComponent(e, COMPONENT_TYPES.SIGNAL, createSignalComponent());
        }
      }

      const summary = inspector.summary();
      expect(summary.entityCount).toBe(7); // 2 singletons + 5 residues

      const validation = inspector.validate();
      expect(validation.valid).toBe(true);

      const signaledEntities = inspector.find(COMPONENT_TYPES.SIGNAL, () => true);
      expect(signaledEntities.length).toBe(3);

      const stats = inspector.stats();
      expect(stats.entities.total).toBe(7);
    });
  });
});

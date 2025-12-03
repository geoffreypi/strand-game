/**
 * Tests for the ECS (Entity Component System)
 */

import { World } from './World.js';
import {
  createPositionComponent,
  createResidueComponent,
  createSignalComponent,
  createBondComponent,
  COMPONENT_TYPES,
} from './components.js';
import {
  queryResiduesWithPositions,
  querySignalingResidues,
  queryResiduesByType,
  queryResiduesByMolecule,
  buildPositionMap,
  getEntityAtPosition,
  getAdjacentEntities,
} from './queries.js';

describe('ECS World', () => {
  let world;

  beforeEach(() => {
    world = new World();
  });

  describe('Entity Management', () => {
    test('creates entities with sequential IDs', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();

      expect(e1).toBe(0);
      expect(e2).toBe(1);
      expect(e3).toBe(2);
      expect(world.entityCount).toBe(3);
    });

    test('destroys entities', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();

      world.destroyEntity(e1);

      expect(world.entityCount).toBe(1);
      expect(world.entities.has(e1)).toBe(false);
      expect(world.entities.has(e2)).toBe(true);
    });

    test('recycles entity IDs', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();

      expect(e2).toBe(1);
      expect(e3).toBe(2);

      world.destroyEntity(e1); // Destroy entity 0

      const e4 = world.createEntity(); // Should reuse ID 0

      expect(e4).toBe(0);
      expect(world.entityCount).toBe(3); // e2, e3, e4
    });

    test('handles destroying non-existent entity gracefully', () => {
      expect(() => world.destroyEntity(999)).not.toThrow();
    });
  });

  describe('Component Management', () => {
    test('adds and retrieves components', () => {
      const entity = world.createEntity();
      const position = createPositionComponent(1, 2, 'mol1');

      world.addComponent(entity, COMPONENT_TYPES.POSITION, position);

      const retrieved = world.getComponent(entity, COMPONENT_TYPES.POSITION);
      expect(retrieved).toEqual(position);
    });

    test('checks if entity has component', () => {
      const entity = world.createEntity();
      const position = createPositionComponent(1, 2, 'mol1');

      expect(world.hasComponent(entity, COMPONENT_TYPES.POSITION)).toBe(false);

      world.addComponent(entity, COMPONENT_TYPES.POSITION, position);

      expect(world.hasComponent(entity, COMPONENT_TYPES.POSITION)).toBe(true);
    });

    test('removes components', () => {
      const entity = world.createEntity();
      const position = createPositionComponent(1, 2, 'mol1');

      world.addComponent(entity, COMPONENT_TYPES.POSITION, position);
      world.removeComponent(entity, COMPONENT_TYPES.POSITION);

      expect(world.hasComponent(entity, COMPONENT_TYPES.POSITION)).toBe(false);
    });

    test('auto-registers component types', () => {
      const entity = world.createEntity();
      world.addComponent(entity, 'CustomComponent', { value: 42 });

      expect(world.componentTypes.has('CustomComponent')).toBe(true);
    });

    test('throws when adding component to non-existent entity', () => {
      expect(() => {
        world.addComponent(999, COMPONENT_TYPES.POSITION, {});
      }).toThrow('Entity 999 does not exist');
    });

    test('destroys all components when entity is destroyed', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.POSITION, createPositionComponent(1, 2, 'mol1'));
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));

      world.destroyEntity(entity);

      expect(world.hasComponent(entity, COMPONENT_TYPES.POSITION)).toBe(false);
      expect(world.hasComponent(entity, COMPONENT_TYPES.RESIDUE)).toBe(false);
    });
  });

  describe('Queries', () => {
    test('queries entities with specific components', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();

      world.addComponent(e1, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol1'));
      world.addComponent(e1, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));

      world.addComponent(e2, COMPONENT_TYPES.POSITION, createPositionComponent(1, 0, 'mol1'));
      // e2 has no RESIDUE component

      world.addComponent(e3, COMPONENT_TYPES.POSITION, createPositionComponent(2, 0, 'mol1'));
      world.addComponent(e3, COMPONENT_TYPES.RESIDUE, createResidueComponent('AND', 0, 1));

      const results = world.query([COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE]);

      expect(results).toHaveLength(2);
      expect(results).toContain(e1);
      expect(results).toContain(e3);
      expect(results).not.toContain(e2);
    });

    test('queries with no component types returns all entities', () => {
      world.createEntity();
      world.createEntity();
      world.createEntity();

      const results = world.query([]);

      expect(results).toHaveLength(3);
    });

    test('queries with non-existent component type returns empty array', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol1'));

      const results = world.query(['NonExistentComponent']);

      expect(results).toHaveLength(0);
    });
  });

  describe('Component Counts', () => {
    test('tracks component counts', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();

      world.addComponent(e1, COMPONENT_TYPES.SIGNAL, createSignalComponent());
      world.addComponent(e2, COMPONENT_TYPES.SIGNAL, createSignalComponent());

      expect(world.getComponentCount(COMPONENT_TYPES.SIGNAL)).toBe(2);
      expect(world.getComponentCount(COMPONENT_TYPES.RESIDUE)).toBe(0);
    });
  });

  describe('Clear', () => {
    test('clears all entities and components', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();

      world.addComponent(e1, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol1'));
      world.addComponent(e2, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));

      world.clear();

      expect(world.entityCount).toBe(0);
      expect(world.getComponentCount(COMPONENT_TYPES.POSITION)).toBe(0);
      expect(world.getComponentCount(COMPONENT_TYPES.RESIDUE)).toBe(0);
      expect(world.nextEntityId).toBe(0);
    });
  });
});

describe('ECS Queries', () => {
  let world;

  beforeEach(() => {
    world = new World();

    // Create some test entities
    const e1 = world.createEntity();
    world.addComponent(e1, COMPONENT_TYPES.POSITION, createPositionComponent(0, 0, 'mol1'));
    world.addComponent(e1, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));
    world.addComponent(e1, COMPONENT_TYPES.SIGNAL, createSignalComponent(true, false));

    const e2 = world.createEntity();
    world.addComponent(e2, COMPONENT_TYPES.POSITION, createPositionComponent(1, 0, 'mol1'));
    world.addComponent(e2, COMPONENT_TYPES.RESIDUE, createResidueComponent('AND', 0, 1));
    world.addComponent(e2, COMPONENT_TYPES.SIGNAL, createSignalComponent(false, false));

    const e3 = world.createEntity();
    world.addComponent(e3, COMPONENT_TYPES.POSITION, createPositionComponent(2, 0, 'mol2'));
    world.addComponent(e3, COMPONENT_TYPES.RESIDUE, createResidueComponent('SIG', 0, 0));
  });

  test('queryResiduesWithPositions returns all residues', () => {
    const results = queryResiduesWithPositions(world);

    expect(results).toHaveLength(3);
    expect(results[0]).toHaveProperty('entity');
    expect(results[0]).toHaveProperty('position');
    expect(results[0]).toHaveProperty('residue');
  });

  test('querySignalingResidues returns only residues with signals', () => {
    const results = querySignalingResidues(world);

    expect(results).toHaveLength(2); // e1 and e2 have signals
    expect(results[0]).toHaveProperty('signal');
  });

  test('queryResiduesByType filters by residue type', () => {
    const sigResidues = queryResiduesByType(world, 'SIG');
    const andResidues = queryResiduesByType(world, 'AND');

    expect(sigResidues).toHaveLength(2);
    expect(andResidues).toHaveLength(1);
  });

  test('queryResiduesByMolecule filters by molecule ID', () => {
    const mol1Residues = queryResiduesByMolecule(world, 'mol1');
    const mol2Residues = queryResiduesByMolecule(world, 'mol2');

    expect(mol1Residues).toHaveLength(2);
    expect(mol2Residues).toHaveLength(1);
  });

  test('buildPositionMap creates spatial lookup', () => {
    const posMap = buildPositionMap(world);

    expect(posMap.size).toBe(3);
    expect(posMap.get('0,0')).toBe(0); // entity 0 at (0,0)
    expect(posMap.get('1,0')).toBe(1); // entity 1 at (1,0)
    expect(posMap.get('2,0')).toBe(2); // entity 2 at (2,0)
  });

  test('getEntityAtPosition finds entity by coordinates', () => {
    const entity = getEntityAtPosition(world, 1, 0);

    expect(entity).toBe(1);
  });

  test('getEntityAtPosition returns undefined for empty position', () => {
    const entity = getEntityAtPosition(world, 99, 99);

    expect(entity).toBeUndefined();
  });

  test('getAdjacentEntities finds hex neighbors', () => {
    // Add entity at (1, -1) which is adjacent to (0, 0)
    const e4 = world.createEntity();
    world.addComponent(e4, COMPONENT_TYPES.POSITION, createPositionComponent(1, -1, 'mol1'));

    const adjacent = getAdjacentEntities(world, 0, 0);

    expect(adjacent).toHaveLength(2); // (1, 0) and (1, -1)
    expect(adjacent.map(a => a.entity)).toContain(1);
    expect(adjacent.map(a => a.entity)).toContain(3);
  });
});

describe('Component Factories', () => {
  test('createPositionComponent creates valid component', () => {
    const pos = createPositionComponent(5, 7, 'test-mol');

    expect(pos.q).toBe(5);
    expect(pos.r).toBe(7);
    expect(pos.moleculeId).toBe('test-mol');
  });

  test('createResidueComponent creates valid component', () => {
    const res = createResidueComponent('BTx', 2, 3);

    expect(res.type).toBe('BTx');
    expect(res.foldState).toBe(2);
    expect(res.index).toBe(3);
  });

  test('createSignalComponent uses defaults', () => {
    const sig = createSignalComponent();

    expect(sig.on).toBe(false);
    expect(sig.source).toBe(false);
    expect(sig.strength).toBe(1.0);
  });

  test('createSignalComponent accepts custom values', () => {
    const sig = createSignalComponent(true, true, 0.5);

    expect(sig.on).toBe(true);
    expect(sig.source).toBe(true);
    expect(sig.strength).toBe(0.5);
  });

  test('createBondComponent creates valid component', () => {
    const bond = createBondComponent(42, '+', 0.8);

    expect(bond.targetEntity).toBe(42);
    expect(bond.bondType).toBe('+');
    expect(bond.bondStrength).toBe(0.8);
  });
});

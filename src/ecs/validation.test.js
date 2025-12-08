/**
 * Tests for Validation and Error Utilities
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { World } from './World.js';
import { ECSError, ECSValidator, ErrorMessages } from './validation.js';
import {
  COMPONENT_TYPES,
  createPositionComponent,
  createResidueComponent,
  createSignalComponent,
  createBondComponent
} from './components.js';

describe('ECSError', () => {
  it('creates error with message only', () => {
    const err = new ECSError('Test error');

    expect(err.message).toBe('Test error');
    expect(err.name).toBe('ECSError');
    expect(err.hint).toBeNull();
    expect(err.details).toEqual({});
  });

  it('creates error with hint', () => {
    const err = new ECSError('Test error', 'Try this instead');

    expect(err.message).toBe('Test error');
    expect(err.hint).toBe('Try this instead');
  });

  it('creates error with details', () => {
    const err = new ECSError('Test error', 'Hint', { entityId: 42, count: 5 });

    expect(err.details.entityId).toBe(42);
    expect(err.details.count).toBe(5);
  });

  it('formats toString with all parts', () => {
    const err = new ECSError('Test error', 'Try this', { foo: 'bar' });
    const str = err.toString();

    expect(str).toContain('ECSError: Test error');
    expect(str).toContain('Hint: Try this');
    expect(str).toContain('Details:');
    expect(str).toContain('foo: "bar"');
  });

  it('formats toString without hint or details', () => {
    const err = new ECSError('Simple error');
    const str = err.toString();

    expect(str).toBe('ECSError: Simple error');
  });
});

describe('ECSValidator', () => {
  let world;
  let validator;

  beforeEach(() => {
    world = new World();
    validator = new ECSValidator(world);
  });

  describe('constructor', () => {
    it('stores world reference', () => {
      expect(validator.world).toBe(world);
    });
  });

  describe('requireEntity', () => {
    it('passes when entity exists', () => {
      const entity = world.createEntity();

      expect(() => {
        validator.requireEntity(entity, 'test operation');
      }).not.toThrow();
    });

    it('throws when entity does not exist', () => {
      expect(() => {
        validator.requireEntity(9999, 'test operation');
      }).toThrow(ECSError);
    });

    it('provides helpful error message', () => {
      try {
        validator.requireEntity(9999, 'add component');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('Entity 9999 does not exist');
        expect(err.hint).toContain('add component');
        expect(err.details.entityId).toBe(9999);
      }
    });
  });

  describe('requireComponent', () => {
    it('passes when entity has component', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.POSITION,
        createPositionComponent(0, 0, 'mol1'));

      expect(() => {
        validator.requireComponent(entity, COMPONENT_TYPES.POSITION, 'test');
      }).not.toThrow();
    });

    it('throws when entity does not exist', () => {
      expect(() => {
        validator.requireComponent(9999, COMPONENT_TYPES.POSITION, 'test');
      }).toThrow(ECSError);
    });

    it('throws when entity lacks component', () => {
      const entity = world.createEntity();

      expect(() => {
        validator.requireComponent(entity, COMPONENT_TYPES.SIGNAL, 'get signal');
      }).toThrow(ECSError);
    });

    it('provides helpful error with current components', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.POSITION,
        createPositionComponent(0, 0, 'mol1'));

      try {
        validator.requireComponent(entity, COMPONENT_TYPES.SIGNAL, 'access signal');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('does not have');
        expect(err.message).toContain('component');
        expect(err.hint).toContain('addComponent');
        expect(err.details.currentComponents).toContain(COMPONENT_TYPES.POSITION);
      }
    });
  });

  describe('requireSingletons', () => {
    it('passes when all singletons exist', () => {
      const configEntity = world.createEntity();
      world.addComponent(configEntity, COMPONENT_TYPES.CONFIG, {});

      const indexEntity = world.createEntity();
      world.addComponent(indexEntity, COMPONENT_TYPES.INDEX_MANAGER, {});

      expect(() => {
        validator.requireSingletons([COMPONENT_TYPES.CONFIG, COMPONENT_TYPES.INDEX_MANAGER]);
      }).not.toThrow();
    });

    it('throws when singleton is missing', () => {
      expect(() => {
        validator.requireSingletons([COMPONENT_TYPES.CONFIG]);
      }).toThrow(ECSError);
    });

    it('throws when multiple singletons exist', () => {
      const entity1 = world.createEntity();
      world.addComponent(entity1, COMPONENT_TYPES.CONFIG, {});

      const entity2 = world.createEntity();
      world.addComponent(entity2, COMPONENT_TYPES.CONFIG, {});

      expect(() => {
        validator.requireSingletons([COMPONENT_TYPES.CONFIG]);
      }).toThrow(ECSError);
    });

    it('provides helpful error for missing singletons', () => {
      try {
        validator.requireSingletons([COMPONENT_TYPES.CONFIG, COMPONENT_TYPES.INDEX_MANAGER]);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('Missing required singleton components');
        expect(err.hint).toContain('Initialize singletons');
        expect(err.details.missingSingletons.length).toBe(2);
      }
    });
  });

  describe('validatePositionUniqueness', () => {
    it('passes when all positions are unique', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, COMPONENT_TYPES.POSITION,
        createPositionComponent(0, 0, 'mol1'));

      const e2 = world.createEntity();
      world.addComponent(e2, COMPONENT_TYPES.POSITION,
        createPositionComponent(1, 0, 'mol1'));

      expect(() => {
        validator.validatePositionUniqueness();
      }).not.toThrow();
    });

    it('throws when positions conflict', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, COMPONENT_TYPES.POSITION,
        createPositionComponent(5, 10, 'mol1'));

      const e2 = world.createEntity();
      world.addComponent(e2, COMPONENT_TYPES.POSITION,
        createPositionComponent(5, 10, 'mol1'));

      expect(() => {
        validator.validatePositionUniqueness();
      }).toThrow(ECSError);
    });

    it('provides details about conflicts', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, COMPONENT_TYPES.POSITION,
        createPositionComponent(3, 7, 'mol1'));

      const e2 = world.createEntity();
      world.addComponent(e2, COMPONENT_TYPES.POSITION,
        createPositionComponent(3, 7, 'mol1'));

      try {
        validator.validatePositionUniqueness();
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('Position conflicts detected');
        expect(err.details.conflicts.length).toBe(1);
        expect(err.details.conflicts[0].position).toEqual({ q: 3, r: 7 });
      }
    });
  });

  describe('validateComponentData', () => {
    it('rejects null data', () => {
      expect(() => {
        validator.validateComponentData(COMPONENT_TYPES.POSITION, null);
      }).toThrow(ECSError);
    });

    it('rejects non-object data', () => {
      expect(() => {
        validator.validateComponentData(COMPONENT_TYPES.POSITION, 'not an object');
      }).toThrow(ECSError);
    });

    it('accepts valid position data', () => {
      expect(() => {
        validator.validateComponentData(COMPONENT_TYPES.POSITION,
          createPositionComponent(0, 0, 'mol1'));
      }).not.toThrow();
    });

    it('accepts valid residue data', () => {
      expect(() => {
        validator.validateComponentData(COMPONENT_TYPES.RESIDUE,
          createResidueComponent('SIG', 0, 0));
      }).not.toThrow();
    });

    it('accepts valid signal data', () => {
      expect(() => {
        validator.validateComponentData(COMPONENT_TYPES.SIGNAL,
          createSignalComponent(true, false, 1.0));
      }).not.toThrow();
    });
  });

  describe('validatePosition', () => {
    it('accepts valid position', () => {
      expect(() => {
        validator.validatePosition({ q: 5, r: 10, moleculeId: 'mol1' });
      }).not.toThrow();
    });

    it('rejects missing q', () => {
      expect(() => {
        validator.validatePosition({ r: 10, moleculeId: 'mol1' });
      }).toThrow(ECSError);
    });

    it('rejects missing r', () => {
      expect(() => {
        validator.validatePosition({ q: 5, moleculeId: 'mol1' });
      }).toThrow(ECSError);
    });

    it('rejects missing moleculeId', () => {
      expect(() => {
        validator.validatePosition({ q: 5, r: 10 });
      }).toThrow(ECSError);
    });

    it('rejects non-number coordinates', () => {
      expect(() => {
        validator.validatePosition({ q: 'five', r: 10, moleculeId: 'mol1' });
      }).toThrow(ECSError);
    });

    it('provides helpful error for missing fields', () => {
      try {
        validator.validatePosition({ q: 5 });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('missing required fields');
        expect(err.hint).toContain('createPositionComponent');
        expect(err.details.missingFields).toContain('r');
        expect(err.details.missingFields).toContain('moleculeId');
      }
    });
  });

  describe('validateResidue', () => {
    it('accepts valid residue', () => {
      expect(() => {
        validator.validateResidue({ type: 'SIG', foldState: 0, index: 0 });
      }).not.toThrow();
    });

    it('rejects missing type', () => {
      expect(() => {
        validator.validateResidue({ foldState: 0, index: 0 });
      }).toThrow(ECSError);
    });

    it('rejects empty type', () => {
      expect(() => {
        validator.validateResidue({ type: '', foldState: 0, index: 0 });
      }).toThrow(ECSError);
    });

    it('rejects non-string type', () => {
      expect(() => {
        validator.validateResidue({ type: 123, foldState: 0, index: 0 });
      }).toThrow(ECSError);
    });
  });

  describe('validateSignal', () => {
    it('accepts valid signal', () => {
      expect(() => {
        validator.validateSignal({ on: true, source: false, strength: 1.0 });
      }).not.toThrow();
    });

    it('rejects missing on', () => {
      expect(() => {
        validator.validateSignal({ source: false, strength: 1.0 });
      }).toThrow(ECSError);
    });

    it('rejects non-boolean on', () => {
      expect(() => {
        validator.validateSignal({ on: 'yes', source: false, strength: 1.0 });
      }).toThrow(ECSError);
    });

    it('rejects non-boolean source', () => {
      expect(() => {
        validator.validateSignal({ on: true, source: 1, strength: 1.0 });
      }).toThrow(ECSError);
    });
  });

  describe('validateBond', () => {
    it('accepts valid bond', () => {
      const target = world.createEntity();

      expect(() => {
        validator.validateBond({ targetEntity: target, bondType: '+' });
      }).not.toThrow();
    });

    it('rejects non-existent target', () => {
      expect(() => {
        validator.validateBond({ targetEntity: 9999, bondType: '+' });
      }).toThrow(ECSError);
    });

    it('rejects invalid bond type', () => {
      const target = world.createEntity();

      expect(() => {
        validator.validateBond({ targetEntity: target, bondType: '=' });
      }).toThrow(ECSError);
    });

    it('provides helpful error for invalid bond type', () => {
      const target = world.createEntity();

      try {
        validator.validateBond({ targetEntity: target, bondType: 'invalid' });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('Invalid bond type');
        expect(err.hint).toContain('must be "+" (inter-molecular) or "-" (intra-molecular)');
        expect(err.details.validTypes).toEqual(['+', '-']);
      }
    });
  });

  describe('inspectEntity', () => {
    it('returns exists:false for non-existent entity', () => {
      const info = validator.inspectEntity(9999);

      expect(info.entityId).toBe(9999);
      expect(info.exists).toBe(false);
      expect(info.componentTypes).toEqual([]);
    });

    it('returns component types for existing entity', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.POSITION,
        createPositionComponent(0, 0, 'mol1'));
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));

      const info = validator.inspectEntity(entity);

      expect(info.entityId).toBe(entity);
      expect(info.exists).toBe(true);
      expect(info.componentTypes).toContain(COMPONENT_TYPES.POSITION);
      expect(info.componentTypes).toContain(COMPONENT_TYPES.RESIDUE);
    });
  });

  describe('requireArchetype', () => {
    it('accepts entity matching residue archetype', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.POSITION,
        createPositionComponent(0, 0, 'mol1'));
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));

      expect(() => {
        validator.requireArchetype(entity, 'residue');
      }).not.toThrow();
    });

    it('accepts entity matching signaling_residue archetype', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.POSITION,
        createPositionComponent(0, 0, 'mol1'));
      world.addComponent(entity, COMPONENT_TYPES.RESIDUE,
        createResidueComponent('SIG', 0, 0));
      world.addComponent(entity, COMPONENT_TYPES.SIGNAL,
        createSignalComponent(true));

      expect(() => {
        validator.requireArchetype(entity, 'signaling_residue');
      }).not.toThrow();
    });

    it('throws when entity lacks required components', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.POSITION,
        createPositionComponent(0, 0, 'mol1'));

      expect(() => {
        validator.requireArchetype(entity, 'residue');
      }).toThrow(ECSError);
    });

    it('throws for unknown archetype', () => {
      const entity = world.createEntity();

      expect(() => {
        validator.requireArchetype(entity, 'unknown_type');
      }).toThrow(ECSError);
    });

    it('provides helpful error for missing components', () => {
      const entity = world.createEntity();
      world.addComponent(entity, COMPONENT_TYPES.POSITION,
        createPositionComponent(0, 0, 'mol1'));

      try {
        validator.requireArchetype(entity, 'signaling_residue');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('does not match archetype');
        expect(err.hint).toContain('Add missing components');
        expect(err.details.missingComponents).toContain(COMPONENT_TYPES.RESIDUE);
        expect(err.details.missingComponents).toContain(COMPONENT_TYPES.SIGNAL);
      }
    });
  });
});

describe('ErrorMessages', () => {
  describe('ENTITY_NOT_FOUND', () => {
    it('creates helpful error', () => {
      const err = ErrorMessages.ENTITY_NOT_FOUND(42);

      expect(err.message).toContain('Entity 42 not found');
      expect(err.hint).toContain('createEntity');
      expect(err.details.entityId).toBe(42);
    });
  });

  describe('COMPONENT_NOT_FOUND', () => {
    it('creates helpful error', () => {
      const err = ErrorMessages.COMPONENT_NOT_FOUND(42, 'signal');

      expect(err.message).toContain('Component signal not found on entity 42');
      expect(err.hint).toContain('addComponent');
      expect(err.details.entityId).toBe(42);
      expect(err.details.componentType).toBe('signal');
    });
  });

  describe('DUPLICATE_COMPONENT', () => {
    it('creates helpful error', () => {
      const err = ErrorMessages.DUPLICATE_COMPONENT(42, 'position');

      expect(err.message).toContain('already has component position');
      expect(err.hint).toContain('removeComponent');
      expect(err.details.entityId).toBe(42);
    });
  });

  describe('INVALID_QUERY', () => {
    it('creates helpful error', () => {
      const err = ErrorMessages.INVALID_QUERY(['invalid', 'types']);

      expect(err.message).toContain('Invalid component query');
      expect(err.hint).toContain('COMPONENT_TYPES');
      expect(err.details.providedTypes).toEqual(['invalid', 'types']);
    });
  });

  describe('SYSTEM_FAILED', () => {
    it('creates helpful error', () => {
      const originalError = new Error('Something broke');
      const err = ErrorMessages.SYSTEM_FAILED('TestSystem', originalError);

      expect(err.message).toContain('System "TestSystem" failed');
      expect(err.message).toContain('Something broke');
      expect(err.hint).toContain('Check system implementation');
      expect(err.details.systemName).toBe('TestSystem');
      expect(err.details.originalError).toBe('Something broke');
    });
  });
});

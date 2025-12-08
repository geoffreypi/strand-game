/**
 * Validation and Error Utilities
 *
 * Provides better error messages with helpful hints and
 * validation helpers for common ECS operations.
 */

import { COMPONENT_TYPES } from './components.js';

/**
 * ECS Error class with helpful hints
 */
export class ECSError extends Error {
  constructor(message, hint = null, details = {}) {
    super(message);
    this.name = 'ECSError';
    this.hint = hint;
    this.details = details;
  }

  toString() {
    let msg = `${this.name}: ${this.message}`;

    if (this.hint) {
      msg += `\n\nHint: ${this.hint}`;
    }

    if (Object.keys(this.details).length > 0) {
      msg += '\n\nDetails:';
      for (const [key, value] of Object.entries(this.details)) {
        msg += `\n  ${key}: ${JSON.stringify(value)}`;
      }
    }

    return msg;
  }
}

/**
 * Validation helpers
 */
export class ECSValidator {
  /**
   * @param {World} world - The ECS World to validate
   */
  constructor(world) {
    this.world = world;
  }

  /**
   * Validate that an entity exists
   * @param {number} entityId - Entity ID to check
   * @param {string} operation - Operation being performed (for error message)
   * @throws {ECSError} If entity doesn't exist
   */
  requireEntity(entityId, operation = 'operation') {
    if (!this.world.entities.has(entityId)) {
      throw new ECSError(
        `Entity ${entityId} does not exist`,
        `Before performing ${operation}, ensure the entity exists using world.createEntity()`,
        {
          entityId,
          operation,
          totalEntities: this.world.entities.size
        }
      );
    }
  }

  /**
   * Validate that an entity has a specific component
   * @param {number} entityId - Entity ID
   * @param {string} componentType - Component type to check
   * @param {string} operation - Operation being performed
   * @throws {ECSError} If entity doesn't have the component
   */
  requireComponent(entityId, componentType, operation = 'operation') {
    this.requireEntity(entityId, operation);

    if (!this.world.hasComponent(entityId, componentType)) {
      const entity = this.inspectEntity(entityId);

      throw new ECSError(
        `Entity ${entityId} does not have ${componentType} component`,
        `Add the component first using world.addComponent(${entityId}, COMPONENT_TYPES.${componentType.toUpperCase()}, ...)`,
        {
          entityId,
          requiredComponent: componentType,
          currentComponents: entity.componentTypes,
          operation
        }
      );
    }
  }

  /**
   * Validate that required singletons exist
   * @param {Array<string>} requiredSingletons - List of singleton component types
   * @throws {ECSError} If any singleton is missing
   */
  requireSingletons(requiredSingletons = [COMPONENT_TYPES.CONFIG, COMPONENT_TYPES.INDEX_MANAGER]) {
    const missing = [];

    for (const singletonType of requiredSingletons) {
      const entities = Array.from(this.world.query([singletonType]));

      if (entities.length === 0) {
        missing.push(singletonType);
      } else if (entities.length > 1) {
        throw new ECSError(
          `Multiple ${singletonType} singletons found`,
          'Singleton components should only have one instance. Remove duplicates.',
          {
            singletonType,
            count: entities.length,
            entityIds: entities
          }
        );
      }
    }

    if (missing.length > 0) {
      throw new ECSError(
        `Missing required singleton components: ${missing.join(', ')}`,
        'Initialize singletons by creating entities with these components before using systems.',
        {
          missingSingletons: missing,
          requiredSingletons
        }
      );
    }
  }

  /**
   * Validate position uniqueness
   * @throws {ECSError} If multiple entities occupy the same position
   */
  validatePositionUniqueness() {
    const positions = new Map();
    const conflicts = [];

    const positionedEntities = this.world.query([COMPONENT_TYPES.POSITION]);

    for (const entityId of positionedEntities) {
      const pos = this.world.getComponent(entityId, COMPONENT_TYPES.POSITION);
      const key = `${pos.q},${pos.r}`;

      if (positions.has(key)) {
        conflicts.push({
          position: { q: pos.q, r: pos.r },
          entities: [positions.get(key), entityId]
        });
      }

      positions.set(key, entityId);
    }

    if (conflicts.length > 0) {
      throw new ECSError(
        `Position conflicts detected: ${conflicts.length} location(s) with multiple entities`,
        'Each hex position can only contain one entity. Move or remove conflicting entities.',
        {
          conflicts,
          totalPositioned: positionedEntities.length
        }
      );
    }
  }

  /**
   * Validate component data structure
   * @param {string} componentType - Component type
   * @param {Object} componentData - Component data to validate
   * @throws {ECSError} If component data is invalid
   */
  validateComponentData(componentType, componentData) {
    if (!componentData || typeof componentData !== 'object') {
      throw new ECSError(
        `Invalid component data for ${componentType}`,
        `Component data must be a non-null object. Use the factory function create${componentType}Component().`,
        {
          componentType,
          providedData: componentData,
          expectedType: 'object'
        }
      );
    }

    // Type-specific validation
    const validators = {
      [COMPONENT_TYPES.POSITION]: this.validatePosition.bind(this),
      [COMPONENT_TYPES.RESIDUE]: this.validateResidue.bind(this),
      [COMPONENT_TYPES.SIGNAL]: this.validateSignal.bind(this),
      [COMPONENT_TYPES.BOND]: this.validateBond.bind(this)
    };

    const validator = validators[componentType];
    if (validator) {
      validator(componentData);
    }
  }

  /**
   * Validate Position component data
   * @param {Object} data - Position data
   * @throws {ECSError} If data is invalid
   */
  validatePosition(data) {
    const required = ['q', 'r', 'moleculeId'];
    const missing = required.filter(field => !(field in data));

    if (missing.length > 0) {
      throw new ECSError(
        `Position component missing required fields: ${missing.join(', ')}`,
        'Use createPositionComponent(q, r, moleculeId) to create valid position data.',
        {
          providedFields: Object.keys(data),
          requiredFields: required,
          missingFields: missing
        }
      );
    }

    if (typeof data.q !== 'number' || typeof data.r !== 'number') {
      throw new ECSError(
        'Position coordinates must be numbers',
        'Hex coordinates (q, r) should be integers representing grid positions.',
        {
          q: { value: data.q, type: typeof data.q },
          r: { value: data.r, type: typeof data.r }
        }
      );
    }
  }

  /**
   * Validate Residue component data
   * @param {Object} data - Residue data
   * @throws {ECSError} If data is invalid
   */
  validateResidue(data) {
    const required = ['type', 'foldState', 'index'];
    const missing = required.filter(field => !(field in data));

    if (missing.length > 0) {
      throw new ECSError(
        `Residue component missing required fields: ${missing.join(', ')}`,
        'Use createResidueComponent(type, foldState, index) to create valid residue data.',
        {
          providedFields: Object.keys(data),
          requiredFields: required,
          missingFields: missing
        }
      );
    }

    if (typeof data.type !== 'string' || data.type.length === 0) {
      throw new ECSError(
        'Residue type must be a non-empty string',
        'Valid residue types: SIG, AND, PSH, ATR, BTx (where x is A, C, G, T)',
        {
          providedType: data.type,
          expectedType: 'non-empty string'
        }
      );
    }
  }

  /**
   * Validate Signal component data
   * @param {Object} data - Signal data
   * @throws {ECSError} If data is invalid
   */
  validateSignal(data) {
    const required = ['on', 'source', 'strength'];
    const missing = required.filter(field => !(field in data));

    if (missing.length > 0) {
      throw new ECSError(
        `Signal component missing required fields: ${missing.join(', ')}`,
        'Use createSignalComponent(on, source, strength) to create valid signal data.',
        {
          providedFields: Object.keys(data),
          requiredFields: required,
          missingFields: missing
        }
      );
    }

    if (typeof data.on !== 'boolean' || typeof data.source !== 'boolean') {
      throw new ECSError(
        'Signal on/source fields must be booleans',
        'on: whether signal is active, source: whether this is a signal source (BTx)',
        {
          on: { value: data.on, type: typeof data.on },
          source: { value: data.source, type: typeof data.source }
        }
      );
    }
  }

  /**
   * Validate Bond component data
   * @param {Object} data - Bond data
   * @throws {ECSError} If data is invalid
   */
  validateBond(data) {
    const required = ['targetEntity', 'bondType'];
    const missing = required.filter(field => !(field in data));

    if (missing.length > 0) {
      throw new ECSError(
        `Bond component missing required fields: ${missing.join(', ')}`,
        'Use createBondComponent(targetEntity, bondType) to create valid bond data.',
        {
          providedFields: Object.keys(data),
          requiredFields: required,
          missingFields: missing
        }
      );
    }

    if (!this.world.entities.has(data.targetEntity)) {
      throw new ECSError(
        `Bond target entity ${data.targetEntity} does not exist`,
        'Bonds must reference valid entities. Create the target entity first.',
        {
          targetEntity: data.targetEntity,
          bondType: data.bondType
        }
      );
    }

    if (data.bondType !== '+' && data.bondType !== '-') {
      throw new ECSError(
        `Invalid bond type: ${data.bondType}`,
        'Bond type must be "+" (inter-molecular) or "-" (intra-molecular)',
        {
          providedType: data.bondType,
          validTypes: ['+', '-']
        }
      );
    }
  }

  /**
   * Inspect an entity and return its components
   * @param {number} entityId - Entity to inspect
   * @returns {Object} Entity inspection data
   */
  inspectEntity(entityId) {
    const exists = this.world.entities.has(entityId);

    if (!exists) {
      return {
        entityId,
        exists: false,
        componentTypes: []
      };
    }

    const componentTypes = [];

    for (const type of this.world.componentTypes) {
      if (this.world.hasComponent(entityId, type)) {
        componentTypes.push(type);
      }
    }

    return {
      entityId,
      exists: true,
      componentTypes
    };
  }

  /**
   * Validate common archetype requirements
   * @param {number} entityId - Entity to check
   * @param {string} archetype - Archetype name
   * @throws {ECSError} If entity doesn't match archetype
   */
  requireArchetype(entityId, archetype) {
    const archetypes = {
      'residue': [COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE],
      'signaling_residue': [COMPONENT_TYPES.POSITION, COMPONENT_TYPES.RESIDUE, COMPONENT_TYPES.SIGNAL],
      'positioned': [COMPONENT_TYPES.POSITION],
      'atp': [COMPONENT_TYPES.POSITION, COMPONENT_TYPES.ATP],
      'adp': [COMPONENT_TYPES.POSITION, COMPONENT_TYPES.ADP]
    };

    const requiredComponents = archetypes[archetype];

    if (!requiredComponents) {
      throw new ECSError(
        `Unknown archetype: ${archetype}`,
        `Valid archetypes: ${Object.keys(archetypes).join(', ')}`,
        { archetype, validArchetypes: Object.keys(archetypes) }
      );
    }

    const entity = this.inspectEntity(entityId);

    if (!entity.exists) {
      throw new ECSError(
        `Entity ${entityId} does not exist`,
        'Create the entity before validating its archetype.',
        { entityId, archetype }
      );
    }

    const missing = requiredComponents.filter(
      type => !entity.componentTypes.includes(type)
    );

    if (missing.length > 0) {
      throw new ECSError(
        `Entity ${entityId} does not match archetype "${archetype}"`,
        `Add missing components: ${missing.join(', ')}`,
        {
          entityId,
          archetype,
          requiredComponents,
          currentComponents: entity.componentTypes,
          missingComponents: missing
        }
      );
    }
  }
}

/**
 * Create helpful error messages for common issues
 */
export const ErrorMessages = {
  ENTITY_NOT_FOUND: (entityId) => new ECSError(
    `Entity ${entityId} not found`,
    'Check that the entity was created and not deleted using world.createEntity().',
    { entityId }
  ),

  COMPONENT_NOT_FOUND: (entityId, componentType) => new ECSError(
    `Component ${componentType} not found on entity ${entityId}`,
    `Add the component using world.addComponent(${entityId}, COMPONENT_TYPES.${componentType.toUpperCase()}, ...)`,
    { entityId, componentType }
  ),

  DUPLICATE_COMPONENT: (entityId, componentType) => new ECSError(
    `Entity ${entityId} already has component ${componentType}`,
    'Remove the existing component first using world.removeComponent() or update it directly using world.getComponent().',
    { entityId, componentType }
  ),

  INVALID_QUERY: (componentTypes) => new ECSError(
    'Invalid component query',
    'Ensure all component types are valid strings from COMPONENT_TYPES.',
    { providedTypes: componentTypes }
  ),

  SYSTEM_FAILED: (systemName, error) => new ECSError(
    `System "${systemName}" failed: ${error.message}`,
    'Check system implementation and ensure World state is valid before running.',
    {
      systemName,
      originalError: error.message,
      stack: error.stack
    }
  )
};

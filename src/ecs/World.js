/**
 * ECS World - manages entities and components
 *
 * Entities are just IDs (integers)
 * Components are stored in arrays indexed by entity ID
 * Systems operate on component arrays
 */

export class World {
  constructor() {
    // Entity management
    this.nextEntityId = 0;
    this.entities = new Set(); // Active entity IDs
    this.freeEntityIds = []; // Recycled IDs

    // Component storage: Map<componentType, Map<entityId, componentData>>
    this.components = new Map();

    // Component type registry
    this.componentTypes = new Set();
  }

  /**
   * Register a component type
   * @param {string} typeName - Name of the component type
   */
  registerComponentType(typeName) {
    if (!this.components.has(typeName)) {
      this.components.set(typeName, new Map());
      this.componentTypes.add(typeName);
    }
  }

  /**
   * Create a new entity
   * @returns {number} Entity ID
   */
  createEntity() {
    let entityId;

    if (this.freeEntityIds.length > 0) {
      // Reuse a recycled ID
      entityId = this.freeEntityIds.pop();
    } else {
      // Allocate new ID
      entityId = this.nextEntityId++;
    }

    this.entities.add(entityId);
    return entityId;
  }

  /**
   * Destroy an entity and all its components
   * @param {number} entityId
   */
  destroyEntity(entityId) {
    if (!this.entities.has(entityId)) {
      return;
    }

    // Remove all components for this entity
    for (const componentMap of this.components.values()) {
      componentMap.delete(entityId);
    }

    // Mark entity as destroyed
    this.entities.delete(entityId);
    this.freeEntityIds.push(entityId);
  }

  /**
   * Add a component to an entity
   * @param {number} entityId
   * @param {string} componentType
   * @param {object} componentData
   */
  addComponent(entityId, componentType, componentData) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    if (!this.components.has(componentType)) {
      this.registerComponentType(componentType);
    }

    this.components.get(componentType).set(entityId, componentData);
  }

  /**
   * Get a component from an entity
   * @param {number} entityId
   * @param {string} componentType
   * @returns {object|undefined} Component data or undefined if not present
   */
  getComponent(entityId, componentType) {
    const componentMap = this.components.get(componentType);
    if (!componentMap) {
      return undefined;
    }
    return componentMap.get(entityId);
  }

  /**
   * Check if an entity has a component
   * @param {number} entityId
   * @param {string} componentType
   * @returns {boolean}
   */
  hasComponent(entityId, componentType) {
    const componentMap = this.components.get(componentType);
    if (!componentMap) {
      return false;
    }
    return componentMap.has(entityId);
  }

  /**
   * Remove a component from an entity
   * @param {number} entityId
   * @param {string} componentType
   */
  removeComponent(entityId, componentType) {
    const componentMap = this.components.get(componentType);
    if (componentMap) {
      componentMap.delete(entityId);
    }
  }

  /**
   * Get all components of a specific type
   * @param {string} componentType
   * @returns {Map<number, object>} Map of entityId -> componentData
   */
  getComponents(componentType) {
    return this.components.get(componentType) || new Map();
  }

  /**
   * Query entities that have all specified component types
   * @param {string[]} componentTypes - Array of component type names
   * @returns {number[]} Array of entity IDs that match the query
   */
  query(componentTypes) {
    if (componentTypes.length === 0) {
      return Array.from(this.entities);
    }

    // Start with entities that have the first component type
    const firstComponentMap = this.components.get(componentTypes[0]);
    if (!firstComponentMap) {
      return [];
    }

    const candidates = Array.from(firstComponentMap.keys());

    // Filter to only entities that have ALL required components
    return candidates.filter(entityId => {
      return componentTypes.every(type => this.hasComponent(entityId, type));
    });
  }

  /**
   * Get the count of active entities
   * @returns {number}
   */
  get entityCount() {
    return this.entities.size;
  }

  /**
   * Get the count of components of a specific type
   * @param {string} componentType
   * @returns {number}
   */
  getComponentCount(componentType) {
    const componentMap = this.components.get(componentType);
    return componentMap ? componentMap.size : 0;
  }

  /**
   * Clear all entities and components
   */
  clear() {
    this.entities.clear();
    this.freeEntityIds = [];
    this.nextEntityId = 0;

    for (const componentMap of this.components.values()) {
      componentMap.clear();
    }
  }
}

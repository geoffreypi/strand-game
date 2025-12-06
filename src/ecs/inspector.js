/**
 * World Inspector - Debugging and introspection utility for ECS World
 *
 * Provides tools for inspecting World state, validating integrity,
 * and exporting snapshots for analysis.
 */

import { COMPONENT_TYPES } from './components.js';

export class WorldInspector {
  /**
   * Create a new World Inspector
   * @param {World} world - The ECS World to inspect
   */
  constructor(world) {
    this.world = world;
  }

  /**
   * Print summary of World contents
   * @returns {Object} Summary data
   */
  summary() {
    const summary = {
      entityCount: this.world.entities.size,
      componentTypes: {},
      totalComponents: 0
    };

    for (const type of this.world.componentTypes) {
      const count = this.world.components.get(type)?.size || 0;
      summary.componentTypes[type] = count;
      summary.totalComponents += count;
    }

    return summary;
  }

  /**
   * Print formatted summary to console
   */
  printSummary() {
    const summary = this.summary();

    console.log('=== World Summary ===');
    console.log(`Total Entities: ${summary.entityCount}`);
    console.log(`Component Types: ${Object.keys(summary.componentTypes).length}`);
    console.log(`Total Component Instances: ${summary.totalComponents}`);
    console.log('\nComponents by Type:');

    const sorted = Object.entries(summary.componentTypes)
      .sort((a, b) => b[1] - a[1]); // Sort by count descending

    for (const [type, count] of sorted) {
      console.log(`  ${type}: ${count} entities`);
    }
  }

  /**
   * Find entities by component values
   * @param {string} componentType - Component type to search
   * @param {Function} predicate - Filter function: (componentData) => boolean
   * @returns {Array} Array of {entityId, data}
   */
  find(componentType, predicate) {
    const components = this.world.components.get(componentType);
    if (!components) {
      return [];
    }

    const matches = [];

    for (const [entityId, data] of components) {
      if (predicate(data)) {
        matches.push({ entityId, data });
      }
    }

    return matches;
  }

  /**
   * Inspect a specific entity - show all its components
   * @param {number} entityId - Entity ID to inspect
   * @returns {Object} Entity data { entityId, exists, components: {...} }
   */
  inspect(entityId) {
    const exists = this.world.entities.has(entityId);

    if (!exists) {
      return { entityId, exists: false, components: {} };
    }

    const components = {};

    for (const type of this.world.componentTypes) {
      const component = this.world.getComponent(entityId, type);
      if (component) {
        components[type] = component;
      }
    }

    return { entityId, exists: true, components };
  }

  /**
   * Print formatted entity inspection to console
   * @param {number} entityId - Entity ID to inspect
   */
  printInspect(entityId) {
    const data = this.inspect(entityId);

    console.log(`=== Entity ${entityId} ===`);

    if (!data.exists) {
      console.log('Entity does not exist');
      return;
    }

    const componentCount = Object.keys(data.components).length;
    console.log(`Components: ${componentCount}`);

    for (const [type, component] of Object.entries(data.components)) {
      console.log(`\n  ${type}:`);
      console.log(`    ${JSON.stringify(component, null, 4).replace(/\n/g, '\n    ')}`);
    }
  }

  /**
   * Validate World integrity
   * Checks for common issues like orphaned components, position conflicts, etc.
   * @returns {Object} { valid: boolean, errors: [...], warnings: [...] }
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Check for orphaned components (components with no entity)
    for (const [type, components] of this.world.components) {
      for (const entityId of components.keys()) {
        if (!this.world.entities.has(entityId)) {
          errors.push(`Orphaned ${type} component for entity ${entityId}`);
        }
      }
    }

    // Check for position conflicts (multiple entities at same position)
    const positions = new Map();
    const posComponents = this.world.components.get(COMPONENT_TYPES.POSITION);

    if (posComponents) {
      for (const [entityId, pos] of posComponents) {
        const key = `${pos.q},${pos.r}`;

        if (positions.has(key)) {
          const existingId = positions.get(key);
          errors.push(
            `Position conflict at (${pos.q},${pos.r}): ` +
            `entities ${existingId} and ${entityId}`
          );
        }

        positions.set(key, entityId);
      }
    }

    // Check that all residues have positions
    const residues = this.world.components.get(COMPONENT_TYPES.RESIDUE);
    if (residues) {
      for (const entityId of residues.keys()) {
        const pos = this.world.getComponent(entityId, COMPONENT_TYPES.POSITION);
        if (!pos) {
          errors.push(`Residue entity ${entityId} has no Position component`);
        }
      }
    }

    // Check that Signal components only exist on valid entities
    const signals = this.world.components.get(COMPONENT_TYPES.SIGNAL);
    if (signals) {
      for (const entityId of signals.keys()) {
        const residue = this.world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
        if (!residue) {
          warnings.push(
            `Signal component on entity ${entityId} without Residue component`
          );
        }
      }
    }

    // Check that IndexManager singleton exists
    const indexManagers = this.world.query([COMPONENT_TYPES.INDEX_MANAGER]);
    if (indexManagers.length === 0) {
      errors.push('IndexManager singleton component not found');
    } else if (indexManagers.length > 1) {
      errors.push(`Multiple IndexManager components found: ${indexManagers.length}`);
    }

    // Check that Config singleton exists
    const configs = this.world.query([COMPONENT_TYPES.CONFIG]);
    if (configs.length === 0) {
      errors.push('Config singleton component not found');
    } else if (configs.length > 1) {
      errors.push(`Multiple Config components found: ${configs.length}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Print validation results to console
   */
  printValidation() {
    const result = this.validate();

    console.log('=== World Validation ===');

    if (result.valid) {
      console.log('✓ World is valid');
    } else {
      console.log('✗ World has errors');
    }

    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`);
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log(`\nWarnings (${result.warnings.length}):`);
      for (const warning of result.warnings) {
        console.log(`  - ${warning}`);
      }
    }

    if (result.valid && result.warnings.length === 0) {
      console.log('\nNo issues found!');
    }
  }

  /**
   * Export World state as JSON
   * @returns {Object} Serializable World snapshot
   */
  export() {
    const data = {
      entityCount: this.world.entities.size,
      entities: Array.from(this.world.entities),
      components: {}
    };

    for (const type of this.world.componentTypes) {
      data.components[type] = [];
      const components = this.world.components.get(type);

      if (components) {
        for (const [entityId, componentData] of components) {
          // Deep clone to avoid references
          data.components[type].push({
            entityId,
            data: JSON.parse(JSON.stringify(componentData))
          });
        }
      }
    }

    return data;
  }

  /**
   * Get statistics about component usage
   * @returns {Object} Statistics
   */
  stats() {
    const stats = {
      entities: {
        total: this.world.entities.size,
        byComponentCount: {}
      },
      components: {}
    };

    // Count entities by number of components they have
    for (const entityId of this.world.entities) {
      let componentCount = 0;

      for (const type of this.world.componentTypes) {
        if (this.world.hasComponent(entityId, type)) {
          componentCount++;
        }
      }

      if (!stats.entities.byComponentCount[componentCount]) {
        stats.entities.byComponentCount[componentCount] = 0;
      }
      stats.entities.byComponentCount[componentCount]++;
    }

    // Component statistics
    for (const type of this.world.componentTypes) {
      const components = this.world.components.get(type);
      const count = components?.size || 0;

      stats.components[type] = {
        count,
        percentage: this.world.entities.size > 0
          ? ((count / this.world.entities.size) * 100).toFixed(1) + '%'
          : '0%'
      };
    }

    return stats;
  }

  /**
   * Print detailed statistics to console
   */
  printStats() {
    const stats = this.stats();

    console.log('=== World Statistics ===');
    console.log(`\nEntities: ${stats.entities.total}`);
    console.log('\nEntities by Component Count:');

    const sorted = Object.entries(stats.entities.byComponentCount)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    for (const [count, entityCount] of sorted) {
      console.log(`  ${count} components: ${entityCount} entities`);
    }

    console.log('\nComponent Coverage:');
    for (const [type, data] of Object.entries(stats.components)) {
      console.log(`  ${type}: ${data.count} (${data.percentage} of entities)`);
    }
  }

  /**
   * Query entities and show results
   * @param {Array<string>} componentTypes - Component types to query
   * @returns {Array} Matching entities with their components
   */
  query(componentTypes) {
    const entityIds = this.world.query(componentTypes);
    const results = [];

    for (const entityId of entityIds) {
      const entity = { entityId };

      for (const type of componentTypes) {
        entity[type] = this.world.getComponent(entityId, type);
      }

      results.push(entity);
    }

    return results;
  }

  /**
   * Print query results to console
   * @param {Array<string>} componentTypes - Component types to query
   */
  printQuery(componentTypes) {
    const results = this.query(componentTypes);

    console.log(`=== Query: [${componentTypes.join(', ')}] ===`);
    console.log(`Found ${results.length} entities`);

    if (results.length > 0 && results.length <= 10) {
      for (const entity of results) {
        console.log(`\nEntity ${entity.entityId}:`);
        for (const [key, value] of Object.entries(entity)) {
          if (key !== 'entityId') {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
          }
        }
      }
    } else if (results.length > 10) {
      console.log(`\n(Showing first 10 of ${results.length} results)`);
      for (let i = 0; i < 10; i++) {
        const entity = results[i];
        console.log(`\nEntity ${entity.entityId}:`);
        for (const [key, value] of Object.entries(entity)) {
          if (key !== 'entityId') {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
          }
        }
      }
    }
  }
}

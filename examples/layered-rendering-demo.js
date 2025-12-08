#!/usr/bin/env node
/**
 * Layered Rendering System Demo
 *
 * Demonstrates the flexible layer-based rendering architecture.
 * Shows how to toggle, reorder, and customize rendering layers.
 */

import ASCIIRenderer from '../src/renderers/ascii-renderer.js';
import { Molecule } from '../src/core/molecule.js';
import { Complex } from '../src/core/complex.js';

// Helper function to create a protein complex
function createProteinComplex(sequence, options = {}) {
  return Complex.fromProtein(sequence, options);
}

// ===========================================================================
// Example 1: Basic Layered Rendering (all layers enabled)
// ===========================================================================

console.log('='.repeat(70));
console.log('Example 1: Basic Layered Rendering (All Layers)');
console.log('='.repeat(70));

const protein1 = createProteinComplex('SIG-AND-PSH', { bends: [] });
const rendering1 = ASCIIRenderer.renderComplexLayered(protein1);

console.log(rendering1);
console.log();

// ===========================================================================
// Example 2: Toggle Layers On/Off
// ===========================================================================

console.log('='.repeat(70));
console.log('Example 2: Selective Layer Rendering');
console.log('='.repeat(70));

// Disable backbone layer (no dashes)
const rendering2a = ASCIIRenderer.renderComplexLayered(protein1, {
  layerOptions: {
    enableBackbone: false
  }
});

console.log('Without backbone layer (no dashes):');
console.log(rendering2a);
console.log();

// Only residues (no connectors at all)
const rendering2b = ASCIIRenderer.renderComplexLayered(protein1, {
  layerOptions: {
    enableBackbone: false,
    enableIntraBonds: false,
    enableSignals: false
  }
});

console.log('Only residues layer:');
console.log(rendering2b);
console.log();

// ===========================================================================
// Example 3: Reordering Layers Dynamically
// ===========================================================================

console.log('='.repeat(70));
console.log('Example 3: Dynamic Layer Reordering');
console.log('='.repeat(70));

// Create a layer manager
const layerManager = ASCIIRenderer.createDefaultLayerManager();

// Print initial layer order
console.log('Initial layer configuration:');
layerManager.getLayerInfo().forEach(info => {
  console.log(`  ${info.name}: z=${info.zIndex}, enabled=${info.enabled}, dense=${info.dense}`);
});
console.log();

// Move signals layer to the background (lowest z-index)
layerManager.setLayerZIndex('signals', -1);

console.log('After moving signals to background (z=-1):');
layerManager.getLayerInfo().forEach(info => {
  console.log(`  ${info.name}: z=${info.zIndex}, enabled=${info.enabled}`);
});
console.log();

// ===========================================================================
// Example 4: Custom Layer Manager
// ===========================================================================

console.log('='.repeat(70));
console.log('Example 4: Custom Layer Configuration');
console.log('='.repeat(70));

import { LayerManager, Layer } from '../src/renderers/layered-renderer.js';
import {
  renderResiduesLayer,
  renderSignalsLayer
} from '../src/renderers/layer-renderers.js';

// Create custom layer manager with only 2 layers
const customManager = new LayerManager();

customManager.addLayer(new Layer(
  'residues',
  renderResiduesLayer,
  { zIndex: 0, dense: false }
));

customManager.addLayer(new Layer(
  'signals',
  (entityData, worldState) => renderSignalsLayer(entityData, worldState, { useInversion: true }),
  { zIndex: 1, dense: false }
));

// Activate a signal in the protein
const protein2 = createProteinComplex('SIG-AND-PSH', { bends: [] });

// Find SIG residue and activate it
const sigEntities = protein2.world.query(['Position', 'Residue', 'Signal']);
for (const entityId of sigEntities) {
  const residue = protein2.world.getComponent(entityId, 'Residue');
  if (residue.type === 'SIG') {
    const signal = protein2.world.getComponent(entityId, 'Signal');
    signal.on = true;
    signal.source = true;
  }
}

const rendering4 = ASCIIRenderer.renderComplexLayered(protein2, {
  layerManager: customManager
});

console.log('Custom rendering (residues + inverted signals only):');
console.log(rendering4);
console.log();

// ===========================================================================
// Example 5: Layer Toggling at Runtime
// ===========================================================================

console.log('='.repeat(70));
console.log('Example 5: Runtime Layer Toggling');
console.log('='.repeat(70));

const toggleManager = ASCIIRenderer.createDefaultLayerManager();

// Create a protein with a bend to show intramolecular bonds
const protein3 = createProteinComplex('SIG-AND-PSH-ATR', {
  bends: [{ position: 1, angle: 60, direction: 'right' }]
});

console.log('All layers enabled:');
const rendering5a = ASCIIRenderer.renderComplexLayered(protein3, {
  layerManager: toggleManager
});
console.log(rendering5a);
console.log();

// Toggle off intramolecular bonds
toggleManager.toggleLayer('intramolecular_bonds');

console.log('Intramolecular bonds layer disabled:');
const rendering5b = ASCIIRenderer.renderComplexLayered(protein3, {
  layerManager: toggleManager
});
console.log(rendering5b);
console.log();

// ===========================================================================
// Example 6: Color Output (if terminal supports it)
// ===========================================================================

console.log('='.repeat(70));
console.log('Example 6: Colored Output (ANSI colors)');
console.log('='.repeat(70));

// Activate signals for color demonstration
const protein4 = createProteinComplex('SIG-AND-PSH', { bends: [] });

const sigEntities4 = protein4.world.query(['Position', 'Residue', 'Signal']);
for (const entityId of sigEntities4) {
  const residue = protein4.world.getComponent(entityId, 'Residue');
  if (residue.type === 'SIG') {
    const signal = protein4.world.getComponent(entityId, 'Signal');
    signal.on = true;
  }
}

const coloredRendering = ASCIIRenderer.renderComplexLayered(protein4, {
  useColor: true,
  layerOptions: {
    useSignalInversion: true  // Use inverted colors for signals
  }
});

console.log('Rendering with ANSI colors (SIG residue inverted):');
console.log(coloredRendering);
console.log();

// ===========================================================================
// Example 7: Layer Information and Debugging
// ===========================================================================

console.log('='.repeat(70));
console.log('Example 7: Layer Manager Inspection');
console.log('='.repeat(70));

const inspectManager = ASCIIRenderer.createDefaultLayerManager();

console.log('Available layers:');
console.log('  Names:', inspectManager.getLayerNames());
console.log();

console.log('Detailed layer info:');
const layerInfo = inspectManager.getLayerInfo();
layerInfo.forEach(info => {
  console.log(`  ${info.name}:`);
  console.log(`    z-index: ${info.zIndex}`);
  console.log(`    enabled: ${info.enabled}`);
  console.log(`    dense: ${info.dense}`);
});
console.log();

// Move a layer forward and backward
console.log('Moving backbone layer forward by 2:');
inspectManager.moveLayerForward('backbone', 2);
console.log('  New z-index:', inspectManager.getLayer('backbone').zIndex);
console.log();

console.log('Moving backbone layer backward by 1:');
inspectManager.moveLayerBackward('backbone');
console.log('  New z-index:', inspectManager.getLayer('backbone').zIndex);
console.log();

// ===========================================================================
// Summary
// ===========================================================================

console.log('='.repeat(70));
console.log('Layered Rendering System Features:');
console.log('='.repeat(70));
console.log();
console.log('✓ 6 built-in layers (heatmap, residues, backbone, intramolecular');
console.log('  bonds, intermolecular bonds, signals)');
console.log('✓ Toggle layers on/off independently');
console.log('✓ Reorder layers dynamically (move forward/backward, set z-index)');
console.log('✓ Custom layer managers for fine control');
console.log('✓ ANSI color support (24-bit RGB)');
console.log('✓ Dense and sparse layer composition');
console.log('✓ Backward compatible with existing renderer');
console.log();

console.log('Usage:');
console.log('  ASCIIRenderer.renderComplexLayered(complex, {');
console.log('    useColor: true,');
console.log('    layerOptions: {');
console.log('      enableHeatmap: false,');
console.log('      enableBackbone: true,');
console.log('      useSignalInversion: true');
console.log('    }');
console.log('  });');
console.log();

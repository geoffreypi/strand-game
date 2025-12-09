#!/usr/bin/env node
/**
 * Layered Rendering System Demo
 *
 * Demonstrates the layer-based rendering system by systematically
 * showing what each layer contributes to the final rendering.
 */

import ASCIIRenderer from '../src/renderers/ascii-renderer.js';
import { Molecule } from '../src/core/molecule.js';
import { Complex } from '../src/core/complex.js';

console.log('='.repeat(70));
console.log('LAYERED RENDERING SYSTEM DEMO');
console.log('='.repeat(70));
console.log();

// ===========================================================================
// Main Example: Step Through Each Layer
// ===========================================================================

console.log('='.repeat(70));
console.log('EXAMPLE 1: Systematic Layer Breakdown');
console.log('='.repeat(70));
console.log();

// Create protein with signal-capable and non-signaling residues
// SIG and PSH can signal, STR cannot
const protein = Complex.fromProtein('SIG-PSH-STR-SIG', { bends: [] });

const sigEntities = protein.world.query(['Position', 'Residue', 'Signal']);
let sigCount = 0;
for (const entityId of sigEntities) {
  const residue = protein.world.getComponent(entityId, 'Residue');
  if (residue.type === 'SIG') {
    sigCount++;
    if (sigCount === 2) {  // Activate last SIG only
      const signal = protein.world.getComponent(entityId, 'Signal');
      signal.on = true;
    }
  }
}

console.log('Protein: SIG-PSH-STR-SIG (last SIG activated, STR cannot signal)');
console.log();

console.log('ALL LAYERS:');
console.log(ASCIIRenderer.renderComplexLayered(protein, { useColor: true }));
console.log();

console.log('LAYER 1 - Residues only (the amino acid codes):');
console.log(ASCIIRenderer.renderComplexLayered(protein, {
  useColor: true,
  layerOptions: {
    enableLabels: false,
    enableBackbone: false,
    enableInterBonds: false,
    enableSignals: false
  }
}));
console.log();

console.log('LAYER 2 - Labels only (N-/C directional markers):');
console.log(ASCIIRenderer.renderComplexLayered(protein, {
  useColor: true,
  layerOptions: {
    enableResidues: false,
    enableBackbone: false,
    enableInterBonds: false,
    enableSignals: false
  }
}));
console.log();

console.log('LAYER 3 - Backbone connectors only (-, /, \\):');
console.log(ASCIIRenderer.renderComplexLayered(protein, {
  useColor: true,
  layerOptions: {
    enableResidues: false,
    enableLabels: false,
    enableInterBonds: false,
    enableSignals: false
  }
}));
console.log();

console.log('LAYER 5 - Signals only (all signal-capable residues):');
console.log(ASCIIRenderer.renderComplexLayered(protein, {
  useColor: true,
  layerOptions: {
    enableResidues: false,
    enableLabels: false,
    enableBackbone: false,
    enableInterBonds: false
  }
}));
console.log('(Note: Gap where STR is - it cannot signal. Last SIG inverted as activated)');
console.log();

console.log('LAYERS 1+2+3 - Residues + Labels + Backbone:');
console.log(ASCIIRenderer.renderComplexLayered(protein, {
  useColor: true,
  layerOptions: {
    enableInterBonds: false,
    enableSignals: false
  }
}));
console.log();

console.log('ALL LAYERS - Complete rendering:');
console.log(ASCIIRenderer.renderComplexLayered(protein, { useColor: true }));
console.log('(In plain text, both SIG look the same - see color example below)');
console.log();

// ===========================================================================
// Intermolecular Bonds Example
// ===========================================================================

console.log('='.repeat(70));
console.log('EXAMPLE 2: Intermolecular Bonds');
console.log('='.repeat(70));
console.log();

const complex = new Complex();
const bindProtein = Molecule.createProtein('STR-BTA');
const dna = Molecule.createDNA('A');

// Position from test: BTA at (1,0), DNA A at (1,1) - they are adjacent
complex.addMolecule(bindProtein, { offset: { q: 0, r: 0 } });
complex.addMolecule(dna, { offset: { q: 1, r: 1 } });

console.log('Protein (STR-BTA) with DNA (A) positioned adjacent:');
console.log();

console.log('WITHOUT intermolecular bonds layer:');
console.log(ASCIIRenderer.renderComplexLayered(complex, {
  useColor: true,
  layerOptions: {
    enableInterBonds: false
  }
}));
console.log();

console.log('WITH intermolecular bonds layer (shows + between BTA and <A>):');
console.log(ASCIIRenderer.renderComplexLayered(complex, { useColor: true }));
console.log();

// ===========================================================================
// Backbone with Bends
// ===========================================================================

console.log('='.repeat(70));
console.log('EXAMPLE 3: Backbone Layer with Bends');
console.log('='.repeat(70));
console.log();

const bentProtein = Complex.fromProtein('SIG-AND-PSH-ATR', {
  bends: [{ position: 1, angle: 60, direction: 'right' }]
});

console.log('Protein with bend at position 1:');
console.log();

console.log('WITHOUT backbone (no connectors or bend characters):');
console.log(ASCIIRenderer.renderComplexLayered(bentProtein, {
  useColor: true,
  layerOptions: {
    enableBackbone: false
  }
}));
console.log();

console.log('WITH backbone (shows / or \\ for bends):');
console.log(ASCIIRenderer.renderComplexLayered(bentProtein, { useColor: true }));
console.log();

// ===========================================================================
// Color Example - Shows Signal Contrast
// ===========================================================================

console.log('='.repeat(70));
console.log('EXAMPLE 4: ANSI Color Support - Signal Activation Contrast');
console.log('='.repeat(70));
console.log();

console.log('Plain text (no visual difference between activated/deactivated):');
console.log(ASCIIRenderer.renderComplexLayered(protein, { useColor: false }));
console.log();

console.log('With ANSI colors (second SIG inverted - white bg, black fg):');
console.log(ASCIIRenderer.renderComplexLayered(protein, { useColor: true }));
console.log();

console.log('Notice the contrast between:');
console.log('  - First SIG: Normal (deactivated)');
console.log('  - Second SIG: Inverted colors (activated)');
console.log();
console.log('(Signal visualization requires terminal ANSI color support)');
console.log();

// ===========================================================================
// Summary
// ===========================================================================

console.log('='.repeat(70));
console.log('Summary');
console.log('='.repeat(70));
console.log();
console.log('6 Rendering Layers:');
console.log('  1. Residues - amino acid/nucleotide codes');
console.log('  2. Labels - N-/C and 5\'-/3\' directional markers');
console.log('  3. Backbone - connectors (-, /, \\)');
console.log('  4. Intermolecular bonds - binding indicators (+)');
console.log('  5. Signals - activation state (inverted colors)');
console.log('  6. Heatmap - property visualization (optional)');
console.log();
console.log('Features:');
console.log('  ✓ Toggle layers on/off independently');
console.log('  ✓ Reorder layers by z-index');
console.log('  ✓ ANSI color support (24-bit RGB)');
console.log('  ✓ Custom layer managers');
console.log('  ✓ Backward compatible');
console.log();
console.log('Usage:');
console.log('  // All layers');
console.log('  ASCIIRenderer.renderComplexLayered(complex);');
console.log();
console.log('  // Specific layers');
console.log('  ASCIIRenderer.renderComplexLayered(complex, {');
console.log('    layerOptions: { enableLabels: false, enableBackbone: false }');
console.log('  });');
console.log();
console.log('  // With colors');
console.log('  ASCIIRenderer.renderComplexLayered(complex, {');
console.log('    useColor: true');
console.log('  });');
console.log();

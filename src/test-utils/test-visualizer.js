/* eslint-disable no-console */
/**
 * Test Visualizer - Renders molecules in tests using ASCII renderer
 *
 * Every test is automatically captured in the report with:
 * - Test name and describe block
 * - Pass/fail status
 * - Any visualizations added via vis.*() calls
 *
 * Usage in tests:
 *   import { vis } from '../test-utils/test-visualizer.js';
 *
 *   test('protein binds to DNA', () => {
 *     const protein = createProtein(['BTA', 'BTC', 'BTG']);
 *     const dna = createDNA('ACGT');
 *
 *     vis.protein('Test Protein', protein);
 *     vis.dna('Test DNA', dna);
 *
 *     expect(...)...
 *   });
 *
 * After tests run, view report at: test-report.html
 * For verbose console output: VERBOSE_TESTS=1 npm test
 */

import ASCIIRenderer from '../renderers/ascii-renderer.js';
import fs from 'fs';
import path from 'path';

// File to store visualizations between test runner and reporter
const VIZ_FILE = path.join(process.cwd(), '.test-visualizations.json');

// Store visualizations for current test
let currentTestVisualizations = [];
let currentTest = null;
let currentDescribe = null;

// All visualizations collected during test run
let allVisualizations = [];

// Check if verbose mode is enabled
const isVerbose = process.env.VERBOSE_TESTS === '1';

/**
 * Render a protein to ASCII
 */
function renderProtein(protein) {
  if (!protein || !protein.aminoAcids) {
    return '[Invalid protein]';
  }

  // Build sequence string from amino acids
  const sequence = protein.aminoAcids.map(aa => aa.type).join('-');
  return ASCIIRenderer.renderProtein(sequence);
}

/**
 * Render DNA to ASCII
 */
function renderDNA(dna) {
  if (!dna || !dna.topHexes) {
    return '[Invalid DNA]';
  }

  const topSequence = dna.topHexes.map(h => h.type).join('');
  const bottomSequence = dna.bottomHexes.map(h => h.type).join('');
  return ASCIIRenderer.renderDNA(topSequence, bottomSequence);
}

/**
 * Render a binding configuration
 * Uses proper hex grid binding directions:
 * - SE (\) or SW (/) for protein above DNA
 * - NE (/) or NW (\) for protein below DNA
 */
function renderBinding(protein, dna, config) {
  const lines = [];

  // Protein
  const proteinAscii = renderProtein(protein);

  // Determine binding character based on direction
  // SE and NW use \, SW and NE use /
  let bindChar = '\\';  // Default SE
  if (config && config.bindingDirection) {
    if (config.bindingDirection === 'SW' || config.bindingDirection === 'NE') {
      bindChar = '/';
    }
  }

  // Build binding line - each amino acid gets one binding char
  const bindingStrength = config?.bindingStrength || 1;

  if (config && config.relativePosition === 'above') {
    // Protein above DNA
    const indent = '   ' + '    '.repeat(config.dnaStartIndex || 0);
    lines.push(indent + proteinAscii);
    // Create binding characters aligned under each amino acid
    const bindingLine = ('   ' + bindChar).repeat(bindingStrength);
    lines.push(indent + bindingLine);
  }

  // DNA
  lines.push(renderDNA(dna));

  if (config && config.relativePosition === 'below') {
    // Protein below DNA
    const indent = '   ' + '    '.repeat(config.dnaStartIndex || 0);
    // Create binding characters aligned above each amino acid
    const bindingLine = ('   ' + bindChar).repeat(bindingStrength);
    lines.push(indent + bindingLine);
    lines.push(indent + proteinAscii);
  }

  if (config) {
    lines.push('');
    lines.push(`Strand: ${config.strand}, Position: ${config.dnaStartIndex}, Direction: ${config.bindingDirection || 'SE'}, Strength: ${bindingStrength}`);
  }

  return lines.join('\n');
}

/**
 * Add a visualization to current test
 */
function addVisualization(type, label, content) {
  const entry = {
    type,
    label,
    content,
    test: currentTest,
    describe: currentDescribe,
    timestamp: Date.now()
  };

  currentTestVisualizations.push(entry);
  allVisualizations.push(entry);

  // Save immediately after each visualization is added
  saveVisualizations();

  // Console output if verbose
  if (isVerbose) {
    console.log(`\n--- ${label} (${type}) ---`);
    console.log(content);
    console.log('---\n');
  }
}

/**
 * Save visualizations to file for reporter to read
 */
function saveVisualizations() {
  try {
    // Write all visualizations to file
    fs.writeFileSync(VIZ_FILE, JSON.stringify(allVisualizations, null, 2));
    if (isVerbose) {
      console.log(`[VIS] Saved ${allVisualizations.length} visualizations to ${VIZ_FILE}`);
    }
  } catch (e) {
    console.error('[VIS] Failed to save visualizations:', e.message, e.stack);
  }
}

/**
 * Load visualizations from file (used by reporter)
 */
export function loadVisualizations() {
  try {
    if (fs.existsSync(VIZ_FILE)) {
      const data = fs.readFileSync(VIZ_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // Ignore errors
  }
  return [];
}

/**
 * Clean up visualization file
 */
export function cleanupVisualizations() {
  try {
    if (fs.existsSync(VIZ_FILE)) {
      fs.unlinkSync(VIZ_FILE);
    }
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Visualization API for tests
 */
export const vis = {
  /**
   * Visualize a protein
   */
  protein(label, protein) {
    const ascii = renderProtein(protein);
    addVisualization('protein', label, ascii);
    return ascii;
  },

  /**
   * Visualize DNA
   */
  dna(label, dna) {
    const ascii = renderDNA(dna);
    addVisualization('dna', label, ascii);
    return ascii;
  },

  /**
   * Visualize a binding configuration
   */
  binding(label, protein, dna, config = null) {
    const ascii = renderBinding(protein, dna, config);
    addVisualization('binding', label, ascii);
    return ascii;
  },

  /**
   * Visualize arbitrary ASCII content
   */
  ascii(label, content) {
    addVisualization('custom', label, content);
    return content;
  },

  /**
   * Add a note/comment to the test report
   */
  note(text) {
    addVisualization('note', 'Note', text);
    return text;
  },

  /**
   * Set current test context (called by Jest hooks)
   */
  setTest(testName) {
    currentTest = testName;
    currentTestVisualizations = [];
  },

  /**
   * End current test - save visualizations
   */
  endTest() {
    saveVisualizations();
    currentTest = null;
    currentTestVisualizations = [];
  },

  /**
   * Set current describe context
   */
  setDescribe(describeName) {
    currentDescribe = describeName;
  },

  /**
   * Clear all results
   */
  clear() {
    allVisualizations = [];
    currentTestVisualizations = [];
    currentTest = null;
    currentDescribe = null;
    cleanupVisualizations();
  }
};

export default vis;

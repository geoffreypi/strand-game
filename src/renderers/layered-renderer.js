/**
 * Layered Rendering System
 *
 * Provides a flexible layer-based rendering architecture for ASCII visualization.
 * Supports toggleable, reorderable layers with color and style control.
 */

/**
 * Canvas cell structure
 * @typedef {Object} CanvasCell
 * @property {string} char - The character to display
 * @property {Array<number>} fg - Foreground RGB color [r, g, b] (optional)
 * @property {Array<number>} bg - Background RGB color [r, g, b] (optional)
 * @property {Array<string>} style - ANSI styles like 'bold', 'dim', 'italic' (optional)
 */

/**
 * Layer class - represents a single rendering layer
 */
export class Layer {
  /**
   * Create a new rendering layer
   * @param {string} name - Layer identifier
   * @param {Function} renderFn - Function(entityData, worldState) => Map<string, CanvasCell>
   * @param {Object} options - Layer options
   * @param {number} options.zIndex - Rendering order (lower renders first)
   * @param {boolean} options.dense - If true, layer fills all positions (default: false)
   * @param {boolean} options.enabled - If true, layer is rendered (default: true)
   */
  constructor(name, renderFn, options = {}) {
    this.name = name;
    this.renderFn = renderFn;
    this.zIndex = options.zIndex !== undefined ? options.zIndex : 0;
    this.dense = options.dense || false;
    this.enabled = options.enabled !== undefined ? options.enabled : true;
  }

  /**
   * Render this layer
   * @param {Array} entityData - Entity data array
   * @param {Object} worldState - World state object
   * @returns {Map<string, CanvasCell>} Canvas with rendered content
   */
  render(entityData, worldState) {
    if (!this.enabled) {
      return new Map();
    }
    return this.renderFn(entityData, worldState);
  }

  /**
   * Toggle layer on/off
   */
  toggle() {
    this.enabled = !this.enabled;
  }

  /**
   * Move layer forward (increase z-index)
   * @param {number} amount - Amount to increase (default: 1)
   */
  moveForward(amount = 1) {
    this.zIndex += amount;
  }

  /**
   * Move layer backward (decrease z-index)
   * @param {number} amount - Amount to decrease (default: 1)
   */
  moveBackward(amount = 1) {
    this.zIndex -= amount;
  }
}

/**
 * Layer Manager - manages a collection of layers
 */
export class LayerManager {
  constructor() {
    this.layers = [];
  }

  /**
   * Add a layer
   * @param {Layer} layer - Layer to add
   */
  addLayer(layer) {
    this.layers.push(layer);
  }

  /**
   * Remove a layer by name
   * @param {string} name - Layer name
   * @returns {boolean} True if removed, false if not found
   */
  removeLayer(name) {
    const index = this.layers.findIndex(l => l.name === name);
    if (index !== -1) {
      this.layers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get a layer by name
   * @param {string} name - Layer name
   * @returns {Layer|undefined} The layer, or undefined if not found
   */
  getLayer(name) {
    return this.layers.find(l => l.name === name);
  }

  /**
   * Get all layers sorted by z-index
   * @returns {Array<Layer>} Sorted layers
   */
  getSortedLayers() {
    return [...this.layers]
      .filter(l => l.enabled)
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Toggle a layer by name
   * @param {string} name - Layer name
   * @returns {boolean} True if toggled, false if not found
   */
  toggleLayer(name) {
    const layer = this.getLayer(name);
    if (layer) {
      layer.toggle();
      return true;
    }
    return false;
  }

  /**
   * Move a layer forward (increase z-index)
   * @param {string} name - Layer name
   * @param {number} amount - Amount to move (default: 1)
   * @returns {boolean} True if moved, false if not found
   */
  moveLayerForward(name, amount = 1) {
    const layer = this.getLayer(name);
    if (layer) {
      layer.moveForward(amount);
      return true;
    }
    return false;
  }

  /**
   * Move a layer backward (decrease z-index)
   * @param {string} name - Layer name
   * @param {number} amount - Amount to move (default: 1)
   * @returns {boolean} True if moved, false if not found
   */
  moveLayerBackward(name, amount = 1) {
    const layer = this.getLayer(name);
    if (layer) {
      layer.moveBackward(amount);
      return true;
    }
    return false;
  }

  /**
   * Set layer z-index directly
   * @param {string} name - Layer name
   * @param {number} zIndex - New z-index value
   * @returns {boolean} True if set, false if not found
   */
  setLayerZIndex(name, zIndex) {
    const layer = this.getLayer(name);
    if (layer) {
      layer.zIndex = zIndex;
      return true;
    }
    return false;
  }

  /**
   * Get all layer names
   * @returns {Array<string>} Array of layer names
   */
  getLayerNames() {
    return this.layers.map(l => l.name);
  }

  /**
   * Get layer info for debugging
   * @returns {Array<Object>} Array of layer info objects
   */
  getLayerInfo() {
    return this.layers.map(l => ({
      name: l.name,
      zIndex: l.zIndex,
      enabled: l.enabled,
      dense: l.dense
    }));
  }
}

/**
 * Compose multiple layers into a single canvas
 * @param {Array<Layer>} layers - Layers to compose (will be sorted by z-index)
 * @param {Array} entityData - Entity data
 * @param {Object} worldState - World state
 * @returns {Map<string, CanvasCell>} Composed canvas
 */
export function composeLayers(layers, entityData, worldState) {
  // Sort by z-index (lowest to highest)
  const sorted = [...layers]
    .filter(l => l.enabled)
    .sort((a, b) => a.zIndex - b.zIndex);

  // Render each layer independently
  const layerCanvases = sorted.map(layer => ({
    layer,
    canvas: layer.render(entityData, worldState)
  }));

  // Composite from back to front
  const finalCanvas = new Map();

  for (const { layer, canvas } of layerCanvases) {
    for (const [pos, cell] of canvas) {
      const existing = finalCanvas.get(pos);

      if (layer.dense) {
        // Dense layers always overwrite
        finalCanvas.set(pos, cell);
      } else if (!existing || existing.char === ' ') {
        // Sparse layers write to empty positions
        finalCanvas.set(pos, cell);
      } else {
        // Sparse layer writing to occupied position: overwrite
        finalCanvas.set(pos, cell);
      }
    }
  }

  return finalCanvas;
}

/**
 * Convert a canvas cell to a simple character (no color)
 * @param {CanvasCell} cell - Canvas cell
 * @returns {string} Character
 */
export function cellToChar(cell) {
  if (typeof cell === 'string') {
    return cell;
  }
  return cell.char;
}

/**
 * Convert a canvas cell to ANSI-formatted string
 * @param {CanvasCell} cell - Canvas cell
 * @returns {string} ANSI-formatted character
 */
export function cellToANSI(cell) {
  if (typeof cell === 'string') {
    return cell;
  }

  const codes = [];

  // Add style codes
  if (cell.style) {
    const styleMap = {
      'bold': 1,
      'dim': 2,
      'italic': 3,
      'underline': 4,
      'reverse': 7
    };
    for (const style of cell.style) {
      if (styleMap[style]) {
        codes.push(styleMap[style]);
      }
    }
  }

  // Add foreground color (24-bit RGB)
  if (cell.fg) {
    const [r, g, b] = cell.fg;
    codes.push(`38;2;${r};${g};${b}`);
  }

  // Add background color (24-bit RGB)
  if (cell.bg) {
    const [r, g, b] = cell.bg;
    codes.push(`48;2;${r};${g};${b}`);
  }

  // Build ANSI string
  if (codes.length === 0) {
    return cell.char;
  }

  return `\x1b[${codes.join(';')}m${cell.char}\x1b[0m`;
}

/**
 * Convert canvas to string with optional ANSI colors
 * @param {Map<string, CanvasCell>} canvas - Canvas to convert
 * @param {boolean} useColor - Whether to output ANSI color codes (default: false)
 * @returns {string} ASCII string
 */
export function canvasToString(canvas, useColor = false) {
  if (canvas.size === 0) return '';

  // Find bounds
  let minRow = Infinity, maxRow = -Infinity;
  let minCol = Infinity, maxCol = -Infinity;

  for (const key of canvas.keys()) {
    const [row, col] = key.split(',').map(Number);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  }

  // Apply offset if minCol is negative
  const offset = minCol < 0 ? -minCol : 0;

  // Build output line by line
  const lines = [];
  for (let row = minRow; row <= maxRow; row++) {
    let line = '';
    for (let col = minCol + offset; col <= maxCol + offset; col++) {
      const key = `${row},${col - offset}`;
      const cell = canvas.get(key);

      if (cell) {
        line += useColor ? cellToANSI(cell) : cellToChar(cell);
      } else {
        line += ' ';
      }
    }
    lines.push(line.trimEnd()); // Remove trailing spaces
  }

  return lines.join('\n');
}

/**
 * Helper to create a canvas cell
 * @param {string} char - Character
 * @param {Object} options - Cell options
 * @param {Array<number>} options.fg - Foreground RGB
 * @param {Array<number>} options.bg - Background RGB
 * @param {Array<string>} options.style - ANSI styles
 * @returns {CanvasCell} Canvas cell
 */
export function createCell(char, options = {}) {
  const cell = { char };

  if (options.fg) cell.fg = options.fg;
  if (options.bg) cell.bg = options.bg;
  if (options.style) cell.style = Array.isArray(options.style) ? options.style : [options.style];

  return cell;
}

/**
 * Write text to canvas at specified position
 * @param {Map<string, CanvasCell>} canvas - Canvas to write to
 * @param {number} row - Row position
 * @param {number} col - Column position
 * @param {string} text - Text to write (or array of cells)
 * @param {Object} options - Cell options (fg, bg, style)
 */
export function writeText(canvas, row, col, text, options = {}) {
  if (Array.isArray(text)) {
    // Array of cells
    for (let i = 0; i < text.length; i++) {
      const key = `${row},${col + i}`;
      canvas.set(key, text[i]);
    }
  } else if (typeof text === 'string') {
    // String - convert to cells
    for (let i = 0; i < text.length; i++) {
      const key = `${row},${col + i}`;
      canvas.set(key, createCell(text[i], options));
    }
  }
}

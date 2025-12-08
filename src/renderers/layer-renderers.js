/**
 * Layer Rendering Functions
 *
 * Individual rendering functions for each layer type.
 * Each function takes entityData and worldState and returns a canvas Map.
 */

import { getNeighbors } from '../core/hex-layout.js';
import { createCell, writeText } from './layered-renderer.js';

/**
 * Convert hex coordinates (q, r) to absolute canvas position (row, col)
 * For flat-top hexagons with 3-character elements like <A>
 * @param {number} q - Hex q coordinate
 * @param {number} r - Hex r coordinate
 * @returns {Object} {row, col} - Absolute canvas position
 */
function hexToCanvasCoords(q, r) {
  return {
    row: r * 2,
    col: q * 4 + r * 2
  };
}

/**
 * Get movement based on hex coordinate delta (for connectors)
 * @param {number} dq - Delta q
 * @param {number} dr - Delta r
 * @param {number} prevCenterPos - Previous element center column
 * @param {string} nextElementType - Next element type
 * @returns {Object} Movement information
 */
function getMovementFromHexDelta(dq, dr, prevCenterPos, nextElementType) {
  const nextElementCenter = Math.floor(nextElementType.length / 2);

  // East (straight right) - no connector, just dash
  if (dq === 1 && dr === 0) {
    return { connector: null };
  }

  // Southeast (60° right/down) - backslash
  if (dq === 0 && dr === 1) {
    const bendCharPos = prevCenterPos + 1;
    const currentCenterPos = bendCharPos + 1;
    const elementStartPos = currentCenterPos - nextElementCenter;

    return {
      connector: '\\',
      connectorRow: 1,
      connectorCol: bendCharPos,
      nextRow: 2,
      nextCol: elementStartPos
    };
  }

  // Southwest (120° right/down) - forward slash
  if (dq === -1 && dr === 1) {
    const bendCharPos = prevCenterPos - 1;
    const currentCenterPos = bendCharPos - 1;
    const elementStartPos = currentCenterPos - nextElementCenter;

    return {
      connector: '/',
      connectorRow: 1,
      connectorCol: bendCharPos,
      nextRow: 2,
      nextCol: elementStartPos
    };
  }

  // West (straight left) - going left
  if (dq === -1 && dr === 0) {
    return { connector: null, isWest: true };
  }

  // Northwest (60° up-left) - backslash going up-left
  if (dq === 0 && dr === -1) {
    const bendCharPos = prevCenterPos - 1;
    const currentCenterPos = bendCharPos - 1;
    const elementStartPos = currentCenterPos - nextElementCenter;

    return {
      connector: '\\',
      connectorRow: -1,
      connectorCol: bendCharPos,
      nextRow: -2,
      nextCol: elementStartPos
    };
  }

  // Northeast (120° up-right) - forward slash going up-right
  if (dq === 1 && dr === -1) {
    const bendCharPos = prevCenterPos + 1;
    const currentCenterPos = bendCharPos + 1;
    const elementStartPos = currentCenterPos - nextElementCenter;

    return {
      connector: '/',
      connectorRow: -1,
      connectorCol: bendCharPos,
      nextRow: -2,
      nextCol: elementStartPos
    };
  }

  // Default: no connector
  return { connector: null };
}

/**
 * Format entity type for display
 * @param {string} type - Raw type code
 * @param {string} moleculeType - Type of molecule ('protein', 'dna', 'rna', 'atp')
 * @returns {string} Formatted type for display
 */
function formatEntityType(type, moleculeType) {
  // DNA/RNA nucleotides get wrapped in <>
  if (moleculeType === 'dna' || moleculeType === 'rna') {
    return `<${type}>`;
  }
  // Proteins and ATP stay as-is
  return type;
}

/**
 * LAYER: Heatmap
 * Renders a dense heatmap based on property values
 * @param {Array} entityData - Entity data
 * @param {Object} worldState - World state
 * @param {Object} options - Heatmap options
 * @param {string} options.property - Property to visualize (charge, energy, hydrophobic, hydrophilic)
 * @param {Function} options.valueFunction - Function(entity) => number (value to map to color)
 * @param {Array} options.colorGradient - Color gradient [[r1,g1,b1], [r2,g2,b2], ...]
 * @returns {Map} Canvas
 */
export function renderHeatmapLayer(entityData, worldState, options = {}) {
  const canvas = new Map();

  const {
    property = 'charge',
    valueFunction = () => 0,
    colorGradient = [
      [0, 0, 255],    // Blue (low)
      [0, 255, 0],    // Green (mid)
      [255, 0, 0]     // Red (high)
    ]
  } = options;

  // Find all positions and fill densely
  if (entityData.length === 0) {
    return canvas;
  }

  // Find bounds
  let minRow = Infinity, maxRow = -Infinity;
  let minCol = Infinity, maxCol = -Infinity;

  for (const entity of entityData) {
    const { row, col } = hexToCanvasCoords(entity.q, entity.r);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  }

  // Expand bounds slightly for padding
  minRow -= 1;
  maxRow += 1;
  minCol -= 2;
  maxCol += 2;

  // Get value for interpolation (0 to 1)
  function getColorForValue(value) {
    // Normalize value to [0, 1]
    const normalized = Math.max(0, Math.min(1, value));

    // Simple gradient interpolation
    if (colorGradient.length === 1) {
      return colorGradient[0];
    }

    const segmentSize = 1 / (colorGradient.length - 1);
    const segmentIndex = Math.floor(normalized / segmentSize);
    const segmentProgress = (normalized - segmentIndex * segmentSize) / segmentSize;

    const color1 = colorGradient[Math.min(segmentIndex, colorGradient.length - 1)];
    const color2 = colorGradient[Math.min(segmentIndex + 1, colorGradient.length - 1)];

    return [
      Math.round(color1[0] + (color2[0] - color1[0]) * segmentProgress),
      Math.round(color1[1] + (color2[1] - color1[1]) * segmentProgress),
      Math.round(color1[2] + (color2[2] - color1[2]) * segmentProgress)
    ];
  }

  // Fill all positions with colored blocks
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      // Calculate value based on nearby entities (simple average for now)
      const value = valueFunction({ row, col }, entityData);
      const color = getColorForValue(value);

      const key = `${row},${col}`;
      canvas.set(key, createCell('█', { bg: color, fg: color }));
    }
  }

  return canvas;
}

/**
 * LAYER: Residues
 * Renders just the residue positions (no connectors)
 * @param {Array} entityData - Entity data
 * @param {Object} worldState - World state
 * @param {Object} options - Layer options
 * @returns {Map} Canvas
 */
export function renderResiduesLayer(entityData, worldState, options = {}) {
  const canvas = new Map();
  const { molecules = new Map() } = worldState;

  // Group by molecule to get prefixes/suffixes
  const moleculeEntities = new Map();
  for (const entity of entityData) {
    if (!moleculeEntities.has(entity.moleculeId)) {
      moleculeEntities.set(entity.moleculeId, []);
    }
    moleculeEntities.get(entity.moleculeId).push(entity);
  }

  // Render each molecule's residues
  for (const [moleculeId, molEntities] of moleculeEntities) {
    if (molEntities.length === 0) continue;

    molEntities.sort((a, b) => a.index - b.index);

    const molecule = molecules.get(moleculeId);
    const molType = molecule ? molecule.type : 'protein';

    // Get prefixes/suffixes
    const prefixes = { protein: 'N-', dna: '5\'-', rna: '5\'-', atp: '', other: '' };
    const suffixes = { protein: '-C', dna: '-3\'', rna: '-3\'', atp: '', other: '' };
    const prefix = prefixes[molType] || '';
    const suffix = suffixes[molType] || '';

    // Render each residue
    for (let i = 0; i < molEntities.length; i++) {
      const entity = molEntities[i];
      const isFirst = i === 0;
      const isLast = i === molEntities.length - 1;

      const { row, col } = hexToCanvasCoords(entity.q, entity.r);
      const formattedType = formatEntityType(entity.type, molType);

      // Write prefix if first
      if (isFirst && prefix) {
        writeText(canvas, row, col - prefix.length, prefix);
      }

      // Write residue
      writeText(canvas, row, col, formattedType);

      // Write suffix if last
      if (isLast && suffix) {
        writeText(canvas, row, col + formattedType.length, suffix);
      }
    }
  }

  return canvas;
}

/**
 * LAYER: Backbone
 * Renders primary structure connectors (dashes and bend characters)
 * @param {Array} entityData - Entity data
 * @param {Object} worldState - World state
 * @param {Object} options - Layer options
 * @returns {Map} Canvas
 */
export function renderBackboneLayer(entityData, worldState, options = {}) {
  const canvas = new Map();
  const { molecules = new Map() } = worldState;

  // Group by molecule
  const moleculeEntities = new Map();
  for (const entity of entityData) {
    if (!moleculeEntities.has(entity.moleculeId)) {
      moleculeEntities.set(entity.moleculeId, []);
    }
    moleculeEntities.get(entity.moleculeId).push(entity);
  }

  // Render backbone for each molecule
  for (const [moleculeId, molEntities] of moleculeEntities) {
    if (molEntities.length === 0) continue;

    molEntities.sort((a, b) => a.index - b.index);

    const molecule = molecules.get(moleculeId);
    const molType = molecule ? molecule.type : 'protein';

    // Draw connectors between consecutive residues
    for (let i = 0; i < molEntities.length - 1; i++) {
      const entity = molEntities[i];
      const nextEntity = molEntities[i + 1];

      const { row, col } = hexToCanvasCoords(entity.q, entity.r);
      const nextCanvas = hexToCanvasCoords(nextEntity.q, nextEntity.r);

      const dq = nextEntity.q - entity.q;
      const dr = nextEntity.r - entity.r;

      const formattedType = formatEntityType(entity.type, molType);
      const elementCenter = Math.floor(formattedType.length / 2);
      const elementCenterCol = col + elementCenter;

      const nextFormattedType = formatEntityType(nextEntity.type, molType);
      const movement = getMovementFromHexDelta(dq, dr, elementCenterCol, nextFormattedType);

      if (movement.connector) {
        // Bend connector
        writeText(canvas, row + movement.connectorRow, movement.connectorCol, movement.connector);
      } else if (movement.isWest) {
        // West direction - dash goes between elements
        writeText(canvas, row, nextCanvas.col + nextFormattedType.length, '-');
      } else {
        // East direction - dash goes between elements
        writeText(canvas, row, col + formattedType.length, '-');
      }
    }
  }

  return canvas;
}

/**
 * LAYER: Intramolecular Bonds
 * Renders bend indicators within a single molecule
 * (Currently same as backbone for simplicity - could be enhanced)
 * @param {Array} entityData - Entity data
 * @param {Object} worldState - World state
 * @param {Object} options - Layer options
 * @returns {Map} Canvas
 */
export function renderIntraBondsLayer(entityData, worldState, options = {}) {
  // For now, this is a subset of backbone (just the / and \ characters)
  const canvas = new Map();
  const { molecules = new Map() } = worldState;

  // Group by molecule
  const moleculeEntities = new Map();
  for (const entity of entityData) {
    if (!moleculeEntities.has(entity.moleculeId)) {
      moleculeEntities.set(entity.moleculeId, []);
    }
    moleculeEntities.get(entity.moleculeId).push(entity);
  }

  // Render bend connectors only
  for (const [moleculeId, molEntities] of moleculeEntities) {
    if (molEntities.length === 0) continue;

    molEntities.sort((a, b) => a.index - b.index);

    const molecule = molecules.get(moleculeId);
    const molType = molecule ? molecule.type : 'protein';

    for (let i = 0; i < molEntities.length - 1; i++) {
      const entity = molEntities[i];
      const nextEntity = molEntities[i + 1];

      const { row, col } = hexToCanvasCoords(entity.q, entity.r);

      const dq = nextEntity.q - entity.q;
      const dr = nextEntity.r - entity.r;

      const formattedType = formatEntityType(entity.type, molType);
      const elementCenter = Math.floor(formattedType.length / 2);
      const elementCenterCol = col + elementCenter;

      const nextFormattedType = formatEntityType(nextEntity.type, molType);
      const movement = getMovementFromHexDelta(dq, dr, elementCenterCol, nextFormattedType);

      // Only render bend connectors (/ and \), not dashes
      if (movement.connector) {
        writeText(canvas, row + movement.connectorRow, movement.connectorCol, movement.connector);
      }
    }
  }

  return canvas;
}

/**
 * LAYER: Intermolecular Bonds
 * Renders binding indicators between different molecules
 * @param {Array} entityData - Entity data
 * @param {Object} worldState - World state
 * @param {Object} options - Layer options
 * @returns {Map} Canvas
 */
export function renderInterBondsLayer(entityData, worldState, options = {}) {
  const canvas = new Map();
  const { bindings = new Map() } = worldState;

  if (!bindings || bindings.size === 0) {
    return canvas;
  }

  // Build entity position map
  const entityPositions = new Map();
  for (const entity of entityData) {
    entityPositions.set(`${entity.q},${entity.r}`, entity);
  }

  // Render BTx bindings
  for (const [residueIndex, nucleotideType] of bindings) {
    const btxEntity = entityData.find(e => e.index === residueIndex && e.type.startsWith('BT'));
    if (!btxEntity) continue;

    // Find adjacent nucleotide
    const neighbors = getNeighbors(btxEntity.q, btxEntity.r);
    for (const neighbor of neighbors) {
      const neighborEntity = entityPositions.get(`${neighbor.q},${neighbor.r}`);
      if (!neighborEntity) continue;

      // Check if this neighbor is the bound nucleotide
      if (neighborEntity.type === nucleotideType ||
          (nucleotideType === 'U' && neighborEntity.type === 'T')) {
        // Draw '+' between them
        renderBondBetween(canvas, btxEntity, neighborEntity, '+');
        break;
      }
    }
  }

  // Render ATR-ATP bonds
  const atrEntities = entityData.filter(e => e.type === 'ATR');
  for (const atrEntity of atrEntities) {
    const neighbors = getNeighbors(atrEntity.q, atrEntity.r);
    for (const neighbor of neighbors) {
      const neighborEntity = entityPositions.get(`${neighbor.q},${neighbor.r}`);
      if (!neighborEntity) continue;

      if (neighborEntity.type === 'ATP') {
        renderBondBetween(canvas, atrEntity, neighborEntity, '+');
      }
    }
  }

  return canvas;
}

/**
 * Helper: Render a bond character between two hexes
 * @param {Map} canvas - Canvas
 * @param {Object} hex1 - First hex {q, r}
 * @param {Object} hex2 - Second hex {q, r}
 * @param {string} bondChar - Bond character
 */
function renderBondBetween(canvas, hex1, hex2, bondChar) {
  const pos1 = hexToCanvasCoords(hex1.q, hex1.r);
  const pos2 = hexToCanvasCoords(hex2.q, hex2.r);

  const midRow = Math.round((pos1.row + pos2.row) / 2);
  const midCol = Math.round((pos1.col + pos2.col) / 2);

  const adjustedCol = midCol + 1; // Center of typical 3-char element

  writeText(canvas, midRow, adjustedCol, bondChar);
}

/**
 * LAYER: Signals
 * Renders signal indicators (stars above active residues or inverted colors)
 * @param {Array} entityData - Entity data
 * @param {Object} worldState - World state
 * @param {Object} options - Layer options
 * @param {boolean} options.useInversion - Use inverted colors instead of stars (default: false)
 * @returns {Map} Canvas
 */
export function renderSignalsLayer(entityData, worldState, options = {}) {
  const canvas = new Map();
  const { signals = new Map() } = worldState;
  const { useInversion = false } = options;

  if (!signals || signals.size === 0) {
    return canvas;
  }

  for (const [residueIndex, signalState] of signals) {
    if (!signalState.on) continue;

    const entity = entityData.find(e => e.index === residueIndex);
    if (!entity) continue;

    const { row, col } = hexToCanvasCoords(entity.q, entity.r);

    if (useInversion) {
      // Render with inverted colors (render the whole residue)
      const { molecules = new Map() } = worldState;
      const molecule = molecules.get(entity.moleculeId);
      const molType = molecule ? molecule.type : 'protein';
      const formattedType = formatEntityType(entity.type, molType);

      // Inverted: white background, black text
      for (let i = 0; i < formattedType.length; i++) {
        const key = `${row},${col + i}`;
        canvas.set(key, createCell(formattedType[i], {
          fg: [0, 0, 0],
          bg: [255, 255, 255]
        }));
      }
    } else {
      // Render star above residue
      const centerCol = col + 1; // Center of 3-char element
      const indicatorRow = row - 1;

      writeText(canvas, indicatorRow, centerCol, '*');
    }
  }

  return canvas;
}

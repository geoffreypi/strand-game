// ASCII Renderer - Fast text-based visualization of molecular structures
// Usage: Quick debugging and structure verification
// This version uses the hex layout algorithm for unlimited bend support

import { sequenceToHexGrid, dnaToHexGrid, getNeighbors } from '../core/hex-layout.js';

class ASCIIRenderer {

  // Helper: Wrap RNA bases in <> brackets
  static wrapRNABases(sequence) {
    return sequence.split('').map(b => '<' + b + '>').join('-');
  }

  // Helper: Render a straight sequence (generic for RNA and proteins)
  static renderSequence(sequence, prefix, suffix) {
    return prefix + sequence + suffix;
  }

  /**
   * Convert hex coordinates (q, r) to absolute canvas position (row, col)
   * For flat-top hexagons with 3-character elements like <A>
   * @param {number} q - Hex q coordinate
   * @param {number} r - Hex r coordinate
   * @returns {Object} {row, col} - Absolute canvas position
   */
  static hexToCanvasCoords(q, r) {
    return {
      row: r * 2,
      col: q * 4 + r * 2
    };
  }

  // Helper: Convert hex grid to ASCII with exact original spacing
  static hexGridToASCII(hexes, prefix, suffix) {
    if (!hexes || hexes.length === 0) {
      return prefix + suffix;
    }

    // For straight sequences (all hexes in a line)
    const allStraight = hexes.every((hex, i) => {
      if (i === 0) return true;
      return hex.r === hexes[0].r && hex.q === hexes[0].q + i;
    });

    if (allStraight) {
      const sequence = hexes.map(h => h.type).join('-');
      return prefix + sequence + suffix;
    }

    // For sequences with bends, use canvas-based rendering
    const canvas = new Map();
    let currentRow = 0;
    let currentCol = 0;

    for (let i = 0; i < hexes.length; i++) {
      const hex = hexes[i];
      const isFirst = i === 0;
      const isLast = i === hexes.length - 1;

      // Build the element text
      let elementText = hex.type;
      if (isFirst) elementText = prefix + elementText;
      if (isLast) elementText = elementText + suffix;

      // Write element to canvas at current position
      this.writeText(canvas, currentRow, currentCol, elementText);

      // If not last element, determine connector and next position
      if (i < hexes.length - 1) {
        const nextHex = hexes[i + 1];
        const dq = nextHex.q - hex.q;
        const dr = nextHex.r - hex.r;

        // Calculate using EXACT original algorithm
        const lastElement = hex.type;
        const lastElementCenter = Math.floor(lastElement.length / 2);
        const lastCharIndex = currentCol + elementText.length - 1;
        const prevCenterPos = lastCharIndex - lastElement.length + 1 + lastElementCenter;

        // Determine connector character and movement based on hex direction
        const movement = this.getMovementFromHexDelta(dq, dr, prevCenterPos, nextHex.type);

        if (movement.connector) {
          // Write connector (relative to current row)
          this.writeText(canvas, currentRow + movement.connectorRow, movement.connectorCol, movement.connector);

          // Move to next element position (relative to current row)
          currentRow = currentRow + movement.nextRow;
          currentCol = movement.nextCol;
        } else if (movement.isWest) {
          // West (straight left) - next element goes to the LEFT
          const nextElementWidth = nextHex.type.length;
          // Place next element to the left with a dash between
          currentCol = currentCol - 1 - nextElementWidth; // Move left (dash + element width)
          this.writeText(canvas, currentRow, currentCol + nextElementWidth, '-');
        } else {
          // East (straight right) - add dash to the RIGHT
          this.writeText(canvas, currentRow, currentCol + elementText.length, '-');
          currentCol += elementText.length + 1; // +1 for the dash
        }
      }
    }

    // Convert canvas to string
    return this.canvasToString(canvas);
  }

  // Get movement based on hex coordinate delta (matching original algorithm)
  static getMovementFromHexDelta(dq, dr, prevCenterPos, nextElementType) {
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
        connectorRow: 1,  // Relative to current row
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
        connectorRow: 1,  // Relative to current row
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

  // Write text to canvas at specified position
  static writeText(canvas, row, col, text) {
    for (let i = 0; i < text.length; i++) {
      const key = `${row},${col + i}`;
      canvas.set(key, text[i]);
    }
  }

  // Convert canvas map to string
  static canvasToString(canvas) {
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
        line += canvas.get(key) || ' ';
      }
      lines.push(line.trimEnd()); // Remove trailing spaces
    }

    return lines.join('\n');
  }

  /**
   * Render multiple sequences on the same canvas
   * @param {Array} sequences - Array of sequence objects:
   *   [{
   *     hexes: [{q, r, type}, ...],
   *     prefix: '5\'-',
   *     suffix: '-3\'',
   *     startOffset: {q: 0, r: 0}  // optional offset for positioning
   *   }, ...]
   * @returns {string} Combined ASCII rendering
   */
  static renderMultipleSequences(sequences) {
    const canvas = new Map();
    const occupiedPositions = new Map(); // Track overlaps

    for (let seqIndex = 0; seqIndex < sequences.length; seqIndex++) {
      const sequence = sequences[seqIndex];
      const { hexes, prefix = '', suffix = '', startOffset = { q: 0, r: 0 } } = sequence;

      if (!hexes || hexes.length === 0) continue;

      // For each sequence, we need to:
      // 1. Place elements at absolute positions (with startOffset)
      // 2. Draw connectors between consecutive hexes in the same sequence

      for (let i = 0; i < hexes.length; i++) {
        const hex = hexes[i];
        const isFirst = i === 0;
        const isLast = i === hexes.length - 1;

        // Apply start offset to get absolute hex coordinates
        const absoluteQ = hex.q + startOffset.q;
        const absoluteR = hex.r + startOffset.r;

        // Check for overlap
        const posKey = `${absoluteQ},${absoluteR}`;
        if (occupiedPositions.has(posKey)) {
          const prevSeq = occupiedPositions.get(posKey);
          throw new Error(`Sequence overlap detected: sequence ${seqIndex} overlaps with sequence ${prevSeq.seqIndex} at position (${absoluteQ}, ${absoluteR})`);
        }
        occupiedPositions.set(posKey, { seqIndex, hexIndex: i });

        // Convert to canvas coordinates (this is where the hex element starts, not prefix)
        const { row, col } = this.hexToCanvasCoords(absoluteQ, absoluteR);

        // Write prefix if first element (goes before the hex position)
        if (isFirst && prefix) {
          this.writeText(canvas, row, col - prefix.length, prefix);
        }

        // Write the hex element at its absolute position
        this.writeText(canvas, row, col, hex.type);

        // Write suffix if last element (goes after the hex)
        if (isLast && suffix) {
          this.writeText(canvas, row, col + hex.type.length, suffix);
        }

        // Draw connector to next hex in this sequence (if not last)
        if (i < hexes.length - 1) {
          const nextHex = hexes[i + 1];
          const nextAbsoluteQ = nextHex.q + startOffset.q;
          const nextAbsoluteR = nextHex.r + startOffset.r;

          const dq = nextAbsoluteQ - absoluteQ;
          const dr = nextAbsoluteR - absoluteR;

          // Get next hex canvas position
          const nextCanvas = this.hexToCanvasCoords(nextAbsoluteQ, nextAbsoluteR);

          // Calculate center column of current element
          const elementCenter = Math.floor(hex.type.length / 2);
          const elementCenterCol = col + elementCenter;

          const movement = this.getMovementFromHexDelta(dq, dr, elementCenterCol, nextHex.type);

          if (movement.connector) {
            // Write connector
            this.writeText(canvas, row + movement.connectorRow, movement.connectorCol, movement.connector);
          } else if (movement.isWest) {
            // West direction - dash goes between elements
            this.writeText(canvas, row, nextCanvas.col + nextHex.type.length, '-');
          } else {
            // East direction - dash goes between elements
            this.writeText(canvas, row, col + hex.type.length, '-');
          }
        }
      }
    }

    return this.canvasToString(canvas);
  }

  // Render DNA structure
  static renderDNA(topSequence, bottomSequence) {
    // Delegate to renderDNAWithBends with no bends for consistent hex grid rendering
    return this.renderDNAWithBends(topSequence, bottomSequence, []);
  }

  /**
   * Render DNA with bends using hex grid layout
   * @param {string} topStrand - Top strand sequence (e.g., "ACGT")
   * @param {string} bottomStrand - Bottom strand sequence (e.g., "TGCA")
   * @param {Array} bends - Array of bend objects [{position, angle, direction}, ...]
   * @returns {string} ASCII rendering of DNA with bends
   */
  static renderDNAWithBends(topStrand, bottomStrand, bends = []) {
    try {
      // Convert DNA strands to hex grid (includes validation and stretch tracking)
      const { topHexes, bottomHexes, topStretches, bottomStretches } = dnaToHexGrid(topStrand, bottomStrand, bends);

      // Wrap bases in <> brackets
      const wrappedTopHexes = topHexes.map(h => ({ ...h, type: '<' + h.type + '>' }));
      const wrappedBottomHexes = bottomHexes.map(h => ({ ...h, type: '<' + h.type + '>' }));

      // Render using specialized DNA renderer with stretches and cross-links
      return this.renderDNAWithVisualization(
        wrappedTopHexes,
        wrappedBottomHexes,
        topStretches,
        bottomStretches,
        topHexes,  // Original (unwrapped) for cross-link pairing
        bottomHexes
      );
    } catch (error) {
      if (error.message.includes('complementary') || error.message.includes('Invalid base')) {
        return 'ERROR: ' + error.message;
      }
      throw error;
    }
  }

  /**
   * Render DNA with visualization of stretches and cross-links
   * @param {Array} topHexes - Wrapped top strand hexes
   * @param {Array} bottomHexes - Wrapped bottom strand hexes
   * @param {Array} topStretches - Stretch positions for top strand
   * @param {Array} bottomStretches - Stretch positions for bottom strand
   * @param {Array} topOriginal - Original (unwrapped) top hexes for pairing
   * @param {Array} bottomOriginal - Original (unwrapped) bottom hexes for pairing
   * @returns {string} ASCII rendering
   */
  static renderDNAWithVisualization(topHexes, bottomHexes, topStretches, bottomStretches, topOriginal, bottomOriginal) {
    const canvas = new Map();

    // Render the two DNA strands
    this.renderStrandOnCanvas(canvas, topHexes, '5\'-', '-3\'', { q: 0, r: 0 });
    this.renderStrandOnCanvas(canvas, bottomHexes, '3\'-', '-5\'', { q: 0, r: 0 });

    // Render stretch indicators
    this.renderStretchesOnCanvas(canvas, topStretches);
    this.renderStretchesOnCanvas(canvas, bottomStretches);

    // Render cross-links between base pairs
    this.renderCrossLinksOnCanvas(canvas, topOriginal, bottomOriginal);

    return this.canvasToString(canvas);
  }

  /**
   * Render a single strand on canvas
   */
  static renderStrandOnCanvas(canvas, hexes, prefix, suffix, startOffset) {
    for (let i = 0; i < hexes.length; i++) {
      const hex = hexes[i];
      const isFirst = i === 0;
      const isLast = i === hexes.length - 1;

      const absoluteQ = hex.q + startOffset.q;
      const absoluteR = hex.r + startOffset.r;

      const { row, col } = this.hexToCanvasCoords(absoluteQ, absoluteR);

      // Write prefix if first element
      if (isFirst && prefix) {
        this.writeText(canvas, row, col - prefix.length, prefix);
      }

      // Write the hex element
      this.writeText(canvas, row, col, hex.type);

      // Write suffix if last element
      if (isLast && suffix) {
        this.writeText(canvas, row, col + hex.type.length, suffix);
      }

      // Draw connector to next hex (if not last)
      if (i < hexes.length - 1) {
        const nextHex = hexes[i + 1];
        const nextAbsoluteQ = nextHex.q + startOffset.q;
        const nextAbsoluteR = nextHex.r + startOffset.r;

        const dq = nextAbsoluteQ - absoluteQ;
        const dr = nextAbsoluteR - absoluteR;

        const elementCenter = Math.floor(hex.type.length / 2);
        const elementCenterCol = col + elementCenter;

        const movement = this.getMovementFromHexDelta(dq, dr, elementCenterCol, nextHex.type);

        if (movement.connector) {
          this.writeText(canvas, row + movement.connectorRow, movement.connectorCol, movement.connector);
        } else if (movement.isWest) {
          const nextCanvas = this.hexToCanvasCoords(nextAbsoluteQ, nextAbsoluteR);
          this.writeText(canvas, row, nextCanvas.col + nextHex.type.length, '-');
        } else {
          this.writeText(canvas, row, col + hex.type.length, '-');
        }
      }
    }
  }

  /**
   * Render stretch indicators on canvas
   */
  static renderStretchesOnCanvas(canvas, stretches) {
    for (const stretch of stretches) {
      const { row, col } = this.hexToCanvasCoords(stretch.q, stretch.r);
      // Place '~' at the center of the stretch hex position
      // Only write if the position is empty or has a space
      const targetCol = col + 1;
      const key = `${row},${targetCol}`;
      if (!canvas.has(key) || canvas.get(key) === ' ' || canvas.get(key) === '-') {
        this.writeText(canvas, row, targetCol, '~');
      }
    }
  }

  /**
   * Render cross-links between base pairs
   */
  static renderCrossLinksOnCanvas(canvas, topHexes, bottomHexes) {
    // For each base pair, draw ':' characters between them
    for (let i = 0; i < topHexes.length; i++) {
      const topHex = topHexes[i];
      const bottomHex = bottomHexes[i];

      const topCanvas = this.hexToCanvasCoords(topHex.q, topHex.r);
      const bottomCanvas = this.hexToCanvasCoords(bottomHex.q, bottomHex.r);

      // Draw ':' characters between the base pairs
      // The center column of each base (for single-character bases)
      const topCenterCol = topCanvas.col + 1;  // Center of <X>
      const bottomCenterCol = bottomCanvas.col + 1;  // Center of <X>

      // Determine which base is higher (smaller row number) and which is lower
      const minRow = Math.min(topCanvas.row, bottomCanvas.row);
      const maxRow = Math.max(topCanvas.row, bottomCanvas.row);
      const upperCenterCol = topCanvas.row < bottomCanvas.row ? topCenterCol : bottomCenterCol;
      const lowerCenterCol = topCanvas.row < bottomCanvas.row ? bottomCenterCol : topCenterCol;

      // If they're in the same column, draw vertical line
      if (topCenterCol === bottomCenterCol) {
        for (let r = minRow + 1; r < maxRow; r++) {
          const key = `${r},${topCenterCol}`;
          if (!canvas.has(key) || canvas.get(key) === ' ') {
            this.writeText(canvas, r, topCenterCol, ':');
          }
        }
      } else {
        // Draw diagonal or staggered line
        const rowDiff = maxRow - minRow;
        const colDiff = lowerCenterCol - upperCenterCol;

        for (let step = 1; step < rowDiff; step++) {
          const r = minRow + step;
          const c = Math.round(upperCenterCol + (colDiff * step / rowDiff));
          const key = `${r},${c}`;
          if (!canvas.has(key) || canvas.get(key) === ' ') {
            this.writeText(canvas, r, c, ':');
          }
        }
      }
    }
  }

  // Render RNA structure (straight)
  static renderRNA(sequence) {
    const wrappedSequence = this.wrapRNABases(sequence);
    return this.renderSequence(wrappedSequence, '5\'-', '-3\'');
  }

  // Render RNA with 60° bend
  static renderRNAWithBend(sequence, bendPosition) {
    const wrappedSequence = this.wrapRNABases(sequence);
    const elements = wrappedSequence.split('-');

    if (bendPosition < 0 || bendPosition >= elements.length - 1) {
      return 'ERROR: Invalid bend position';
    }

    try {
      // Convert to hex grid with single 60° bend
      const plainSequence = sequence; // Keep original for hex conversion
      const bends = [{ position: bendPosition, angle: 60, direction: 'right' }];
      const hexGrid = sequenceToHexGrid(plainSequence, bends);

      // Map hex types back to wrapped format
      const wrappedHexes = hexGrid.map((hex, i) => ({
        ...hex,
        type: elements[i]
      }));

      return this.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
    } catch (error) {
      if (error.message.includes('Overlap detected')) {
        return 'ERROR: Sequence overlap detected';
      }
      throw error;
    }
  }

  // Render protein structure (straight, unfolded)
  static renderProtein(aminoAcidSequence) {
    // aminoAcidSequence is like "S-E60-BA-RPF-C60"
    return this.renderSequence(aminoAcidSequence, 'N-', '-C');
  }

  // Render protein with bends
  static renderProteinWithBend(aminoAcidSequence, bendPosition, bendAngle) {
    const elements = aminoAcidSequence.split('-');

    if (bendPosition < 0 || bendPosition >= elements.length - 1) {
      return 'ERROR: Invalid bend position';
    }

    try {
      // Convert to hex grid with single bend
      const bends = [{ position: bendPosition, angle: bendAngle, direction: 'right' }];
      const hexGrid = sequenceToHexGrid(aminoAcidSequence, bends);

      return this.hexGridToASCII(hexGrid, 'N-', '-C');
    } catch (error) {
      if (error.message.includes('Overlap detected')) {
        return 'ERROR: Sequence overlap detected';
      }
      throw error;
    }
  }

  // ===========================================================================
  // COMPLEX RENDERING
  // ===========================================================================

  /**
   * Render a Complex with all its molecules and inter-molecular bindings
   * @param {Complex} complex - The Complex to render
   * @param {Object} options - Rendering options
   * @param {boolean} options.showBindings - Whether to show binding indicators (default true)
   * @param {Object} options.prefixes - Custom prefixes per molecule type {protein: 'N-', dna: '5\'-', ...}
   * @param {Object} options.suffixes - Custom suffixes per molecule type {protein: '-C', dna: '-3\'', ...}
   * @returns {string} ASCII rendering
   */
  static renderComplex(complex, options = {}) {
    const {
      showBindings = true,
      prefixes = {
        protein: 'N-',
        dna: '5\'-',
        rna: '5\'-',
        atp: '',
        other: ''
      },
      suffixes = {
        protein: '-C',
        dna: '-3\'',
        rna: '-3\'',
        atp: '',
        other: ''
      }
    } = options;

    const canvas = new Map();
    const entityPositions = new Map(); // Track {q,r} -> entity for binding lookup

    // Get all entities from complex
    const entities = complex.getEntities();

    // Group entities by molecule
    const moleculeEntities = new Map();
    for (const entity of entities) {
      if (!moleculeEntities.has(entity.moleculeId)) {
        moleculeEntities.set(entity.moleculeId, []);
      }
      moleculeEntities.get(entity.moleculeId).push(entity);

      // Track position for binding lookup
      entityPositions.set(`${entity.q},${entity.r}`, entity);
    }

    // Render each molecule
    for (const entry of complex.entries) {
      const mol = entry.molecule;
      const molEntities = moleculeEntities.get(mol.id) || [];

      if (molEntities.length === 0) continue;

      // Sort by index to ensure correct order
      molEntities.sort((a, b) => a.index - b.index);

      // Get prefix/suffix for this molecule type
      const prefix = prefixes[mol.type] || '';
      const suffix = suffixes[mol.type] || '';

      // Format entities for rendering
      const formattedEntities = molEntities.map(e => ({
        q: e.q,
        r: e.r,
        type: this.formatEntityType(e.type, mol.type)
      }));

      // Render this molecule's strand
      this.renderStrandOnCanvas(canvas, formattedEntities, prefix, suffix, { q: 0, r: 0 });
    }

    // Render bindings if requested
    if (showBindings) {
      const bindings = complex.findBindings();
      this.renderBindingsOnCanvas(canvas, bindings, entities, entityPositions);
    }

    return this.canvasToString(canvas);
  }

  /**
   * Format entity type for display
   * @param {string} type - Raw type code
   * @param {string} moleculeType - Type of molecule ('protein', 'dna', 'rna', 'atp')
   * @returns {string} Formatted type for display
   */
  static formatEntityType(type, moleculeType) {
    // DNA/RNA nucleotides get wrapped in <>
    if (moleculeType === 'dna' || moleculeType === 'rna') {
      return `<${type}>`;
    }
    // ATP stays as 3-char code (consistent with other residues)
    // Proteins and ATP stay as-is
    return type;
  }

  /**
   * Render binding indicators between bound pairs
   * Uses '+' character at the midpoint between:
   * - BTx residues and nucleotides
   * - ATR residues and adjacent ATP
   * @param {Map} canvas - The rendering canvas
   * @param {Map} bindings - Map of residueIndex -> nucleotide type
   * @param {Array} entities - All entities in the complex
   * @param {Map} entityPositions - Map of "q,r" -> entity
   */
  static renderBindingsOnCanvas(canvas, bindings, entities, entityPositions) {
    // For each BTx binding, find the BTx residue and its bound nucleotide neighbor
    for (const [residueIndex, nucleotideType] of bindings) {
      // Find the BTx entity
      const btxEntity = entities.find(e => e.index === residueIndex && e.type.startsWith('BT'));
      if (!btxEntity) continue;

      // Find the adjacent nucleotide
      const neighbors = getNeighbors(btxEntity.q, btxEntity.r);
      for (const neighbor of neighbors) {
        const neighborEntity = entityPositions.get(`${neighbor.q},${neighbor.r}`);
        if (!neighborEntity) continue;

        // Check if this neighbor is the bound nucleotide
        if (neighborEntity.type === nucleotideType ||
            (nucleotideType === 'U' && neighborEntity.type === 'T')) {
          // Draw '+' between them
          this.renderBondBetweenHexes(canvas, btxEntity, neighborEntity, '+');
          break;
        }
      }
    }

    // Also render ATR-ATP bonds
    const atrEntities = entities.filter(e => e.type === 'ATR');
    for (const atrEntity of atrEntities) {
      const neighbors = getNeighbors(atrEntity.q, atrEntity.r);
      for (const neighbor of neighbors) {
        const neighborEntity = entityPositions.get(`${neighbor.q},${neighbor.r}`);
        if (!neighborEntity) continue;

        // Check if this neighbor is ATP
        if (neighborEntity.type === 'ATP') {
          // Draw '+' between ATR and ATP
          this.renderBondBetweenHexes(canvas, atrEntity, neighborEntity, '+');
        }
      }
    }
  }

  /**
   * Render a bond character between two adjacent hexes
   * @param {Map} canvas - The rendering canvas
   * @param {Object} hex1 - First hex {q, r}
   * @param {Object} hex2 - Second hex {q, r}
   * @param {string} bondChar - Character to use for the bond
   */
  static renderBondBetweenHexes(canvas, hex1, hex2, bondChar) {
    const pos1 = this.hexToCanvasCoords(hex1.q, hex1.r);
    const pos2 = this.hexToCanvasCoords(hex2.q, hex2.r);

    // Calculate midpoint
    const midRow = Math.round((pos1.row + pos2.row) / 2);
    const midCol = Math.round((pos1.col + pos2.col) / 2);

    // Adjust col based on element widths (assume center of 3-char element)
    const adjustedCol = midCol + 1; // Center of typical 3-char element

    // Write bond character if position is empty or has space
    const key = `${midRow},${adjustedCol}`;
    if (!canvas.has(key) || canvas.get(key) === ' ') {
      this.writeText(canvas, midRow, adjustedCol, bondChar);
    }
  }

}

// ES Module export
export default ASCIIRenderer;

// CommonJS export for compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ASCIIRenderer;
}

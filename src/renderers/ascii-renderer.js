// ASCII Renderer - Fast text-based visualization of molecular structures
// Usage: Quick debugging and structure verification
// This version uses the hex layout algorithm for unlimited bend support

import { sequenceToHexGrid } from '../core/hex-layout.js';

class ASCIIRenderer {

  // Helper: Wrap RNA bases in <> brackets
  static wrapRNABases(sequence) {
    return sequence.split('').map(b => '<' + b + '>').join('-');
  }

  // Helper: Render a straight sequence (generic for RNA and proteins)
  static renderSequence(sequence, prefix, suffix) {
    return prefix + sequence + suffix;
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

  // Render DNA structure
  static renderDNA(topSequence, bottomSequence) {
    if (topSequence.length !== bottomSequence.length) {
      return 'ERROR: Top and bottom sequences must be same length';
    }

    const length = topSequence.length;

    // Build top line with directional markers and <> around bases
    let topLine = '3\'-' + topSequence.split('').map(b => '<' + b + '>').join('-') + '-5\'';

    // Build middle line with hydrogen bonds
    // G-C pairs have 3 hydrogen bonds (|||), A-T pairs have 2 hydrogen bonds (| |)
    let middleLine = '   ';  // Offset for alignment
    for (let i = 0; i < length; i++) {
      const topBase = topSequence[i];
      const bottomBase = bottomSequence[i];

      // Determine hydrogen bond representation
      let bond;
      if ((topBase === 'G' && bottomBase === 'C') || (topBase === 'C' && bottomBase === 'G')) {
        bond = '|||';  // 3 hydrogen bonds
      } else {
        bond = '| |';  // 2 hydrogen bonds (A-T or other pairs)
      }

      middleLine += bond;
      if (i < length - 1) {
        middleLine += ' ';
      }
    }

    // Build bottom line with directional markers and <> around bases
    let bottomLine = '5\'-' + bottomSequence.split('').map(b => '<' + b + '>').join('-') + '-3\'';

    return topLine + '\n' + middleLine + '\n' + bottomLine;
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

}

// ES Module export
export default ASCIIRenderer;

// CommonJS export for compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ASCIIRenderer;
}

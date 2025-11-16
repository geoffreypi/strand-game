// Hex to ASCII - Visualize hex grids as ASCII art
// Usage: Debug visualization and testing
// This module renders hex grids using the original ASCII renderer's visual style

/**
 * Render a hex grid as ASCII art (matching original renderer style)
 * @param {Array} hexes - [{q, r, type}, ...]
 * @param {Object} options - {prefix: 'N-', suffix: '-C'}
 * @returns {string} ASCII representation
 */
function hexGridToASCII(hexes, options = {}) {
  if (!hexes || hexes.length === 0) {
    return 'Empty grid';
  }

  const { prefix = '', suffix = '' } = options;

  // Build a 2D canvas to render into
  const canvas = new Map(); // key: "row,col" -> character

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
    writeText(canvas, currentRow, currentCol, elementText);

    // If not last element, determine connector and next position
    if (i < hexes.length - 1) {
      const nextHex = hexes[i + 1];
      const dq = nextHex.q - hex.q;
      const dr = nextHex.r - hex.r;

      // Determine connector character and movement
      const { connector, rowDelta, colDelta } = getConnectorAndMovement(
        dq, dr, elementText.length
      );

      if (connector) {
        // Calculate center position of current element
        const elementCenter = Math.floor(elementText.length / 2);
        const connectorCol = currentCol + elementCenter + 1;
        const connectorRow = currentRow + 1;

        // Write connector
        writeText(canvas, connectorRow, connectorCol, connector);

        // Move to next element position
        currentRow += rowDelta;
        currentCol += colDelta;
      } else {
        // Horizontal continuation (no bend) - add dash
        writeText(canvas, currentRow, currentCol + elementText.length, '-');
        currentCol += elementText.length + 1; // +1 for the dash
      }
    }
  }

  // Convert canvas to string
  return canvasToString(canvas);
}

/**
 * Get connector character and movement delta based on hex direction
 * @param {number} dq
 * @param {number} dr
 * @param {number} currentElementWidth
 * @returns {Object} {connector, rowDelta, colDelta}
 */
function getConnectorAndMovement(dq, dr, currentElementWidth) {
  const elementCenter = Math.floor(currentElementWidth / 2);

  // East (straight right) - no connector, just dash
  if (dq === 1 && dr === 0) {
    return { connector: null, rowDelta: 0, colDelta: 0 };
  }

  // Southeast (60° right/down) - backslash
  if (dq === 0 && dr === 1) {
    return {
      connector: '\\',
      rowDelta: 2,
      colDelta: elementCenter + 2
    };
  }

  // Southwest (120° right/down) - forward slash
  if (dq === -1 && dr === 1) {
    return {
      connector: '/',
      rowDelta: 2,
      colDelta: -(elementCenter + 2)  // Move LEFT in ASCII space
    };
  }

  // West (straight left) - dash (unusual in sequences)
  if (dq === -1 && dr === 0) {
    return { connector: null, rowDelta: 0, colDelta: -currentElementWidth - 1 };
  }

  // Northwest (60° left/up) - forward slash
  if (dq === 0 && dr === -1) {
    return {
      connector: '/',
      rowDelta: -2,  // Moving UP
      colDelta: -(elementCenter + 2)  // Move LEFT in ASCII space
    };
  }

  // Northeast (120° left/up) - backslash
  if (dq === 1 && dr === -1) {
    return {
      connector: '\\',
      rowDelta: -2,  // Moving UP
      colDelta: elementCenter + 2
    };
  }

  // Default: no connector
  return { connector: null, rowDelta: 0, colDelta: 0 };
}

/**
 * Write text to canvas at specified position
 * @param {Map} canvas
 * @param {number} row
 * @param {number} col
 * @param {string} text
 */
function writeText(canvas, row, col, text) {
  for (let i = 0; i < text.length; i++) {
    const key = `${row},${col + i}`;
    canvas.set(key, text[i]);
  }
}

/**
 * Convert canvas map to string
 * @param {Map} canvas - Map of "row,col" -> character
 * @returns {string}
 */
function canvasToString(canvas) {
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

  // Build output line by line
  const lines = [];
  for (let row = minRow; row <= maxRow; row++) {
    let line = '';
    for (let col = minCol; col <= maxCol; col++) {
      const key = `${row},${col}`;
      line += canvas.get(key) || ' ';
    }
    lines.push(line.trimEnd()); // Remove trailing spaces
  }

  return lines.join('\n');
}

/**
 * Simple grid visualization (for debugging)
 * @param {Array} hexes - [{q, r, type}, ...]
 * @returns {string} Simple grid representation
 */
function hexGridToSimpleGrid(hexes) {
  if (!hexes || hexes.length === 0) {
    return 'Empty grid';
  }

  // Find bounds
  const minQ = Math.min(...hexes.map(h => h.q));
  const maxQ = Math.max(...hexes.map(h => h.q));
  const minR = Math.min(...hexes.map(h => h.r));
  const maxR = Math.max(...hexes.map(h => h.r));

  // Build grid
  const hexMap = new Map();
  hexes.forEach((h, idx) => {
    hexMap.set(`${h.q},${h.r}`, `${idx}:${h.type}`);
  });

  const lines = [];
  for (let r = minR; r <= maxR; r++) {
    let line = r % 2 === 1 ? '  ' : '';  // Offset odd rows

    for (let q = minQ; q <= maxQ; q++) {
      const hex = hexMap.get(`${q},${r}`);
      line += hex ? `[${hex}]` : ' . ';
      line += '  ';
    }

    lines.push(line);
  }

  return lines.join('\n');
}

// ES Module export
export {
  hexGridToASCII,
  hexGridToSimpleGrid
};

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    hexGridToASCII,
    hexGridToSimpleGrid
  };
}

// Hex to ASCII - Visualize hex grids as ASCII art
// Usage: Debug visualization and testing
// This module converts hex grids back to sequences and uses the original ASCII renderer

import ASCIIRenderer from '../renderers/ascii-renderer.js';

/**
 * Convert hex grid back to sequence and bends, then render with ASCII renderer
 * @param {Array} hexes - [{q, r, type}, ...]
 * @param {Object} options - {prefix: 'N-', suffix: '-C'}
 * @returns {string} ASCII representation
 */
function hexGridToASCII(hexes, options = {}) {
  if (!hexes || hexes.length === 0) {
    return 'Empty grid';
  }

  const { prefix = '', suffix = '' } = options;

  // Extract sequence from hex grid
  const sequence = hexes.map(h => h.type).join('-');

  // Detect bends by analyzing direction changes
  const bends = detectBends(hexes);

  // If no bends, render straight
  if (bends.length === 0) {
    return ASCIIRenderer.renderSequence(sequence, prefix, suffix);
  }

  // If only one bend, use the ASCII renderer's renderSequenceWithBend
  if (bends.length === 1) {
    const bend = bends[0];
    return ASCIIRenderer.renderSequenceWithBend(
      sequence,
      bend.position,
      bend.angle,
      prefix,
      suffix
    );
  }

  // Multiple bends: render each segment separately and combine
  // This is a more complex case - for now, render the first bend only
  // TODO: Support multiple bends properly
  const firstBend = bends[0];
  return ASCIIRenderer.renderSequenceWithBend(
    sequence,
    firstBend.position,
    firstBend.angle,
    prefix,
    suffix
  );
}

/**
 * Detect bends from hex grid by analyzing direction changes
 * @param {Array} hexes - [{q, r, type}, ...]
 * @returns {Array} [{position, angle, direction}, ...]
 */
function detectBends(hexes) {
  if (hexes.length < 3) return [];

  const bends = [];
  let prevDirection = null;

  for (let i = 0; i < hexes.length - 1; i++) {
    const current = hexes[i];
    const next = hexes[i + 1];

    const dq = next.q - current.q;
    const dr = next.r - current.r;

    // Convert delta to direction (0-5)
    const direction = deltaToDirection(dq, dr);

    if (prevDirection !== null && direction !== prevDirection) {
      // Direction changed - we have a bend
      const turnAmount = (direction - prevDirection + 6) % 6;

      // Determine angle (1 step = 60°, 2 steps = 120°)
      let angle;
      if (turnAmount === 1 || turnAmount === 5) {
        angle = 60;
      } else if (turnAmount === 2 || turnAmount === 4) {
        angle = 120;
      } else {
        // 180° turn or more - skip for now
        prevDirection = direction;
        continue;
      }

      bends.push({
        position: i - 1,  // Bend occurs after previous element
        angle: angle,
        direction: turnAmount <= 3 ? 'right' : 'left'
      });
    }

    prevDirection = direction;
  }

  return bends;
}

/**
 * Convert hex delta to direction (0-5)
 * @param {number} dq
 * @param {number} dr
 * @returns {number} Direction 0-5
 */
function deltaToDirection(dq, dr) {
  if (dq === 1 && dr === 0) return 0;   // East
  if (dq === 0 && dr === 1) return 1;   // Southeast
  if (dq === -1 && dr === 1) return 2;  // Southwest
  if (dq === -1 && dr === 0) return 3;  // West
  if (dq === 0 && dr === -1) return 4;  // Northwest
  if (dq === 1 && dr === -1) return 5;  // Northeast
  return 0; // Default to east
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

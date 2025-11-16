// Hex Layout - Convert sequences with bends to hex grid coordinates
// Usage: Core algorithm for molecular structure

/**
 * Convert a sequence with bends into hex grid coordinates
 * @param {string} sequence - e.g., "STR-EX6-BTA-RPF-CP6" or "ACGU"
 * @param {Array} bends - [{position: 2, angle: 60, direction: 'right'}, ...]
 * @returns {Array} [{q, r, type}, ...]
 */
function sequenceToHexGrid(sequence, bends = []) {
  const elements = sequence.includes('-') ? sequence.split('-') : sequence.split('');
  const hexes = [];

  // Track current position and direction
  let currentQ = 0;
  let currentR = 0;
  let currentDirection = 0;  // 0-5 (hex directions, 0 = right/east)

  for (let i = 0; i < elements.length; i++) {
    // Place current element
    hexes.push({
      q: currentQ,
      r: currentR,
      type: elements[i]
    });

    // Check if there's a bend after this position
    const bend = bends.find(b => b.position === i);

    if (bend && i < elements.length - 1) {
      // Apply the bend (change direction)
      currentDirection = applyBend(currentDirection, bend.angle, bend.direction);
    }

    // Move to next position (if not last element)
    if (i < elements.length - 1) {
      [currentQ, currentR] = moveInDirection(currentQ, currentR, currentDirection);
    }
  }

  return hexes;
}

/**
 * Apply a bend to the current direction
 * @param {number} currentDir - Current direction (0-5)
 * @param {number} angle - Bend angle (60 or 120)
 * @param {string} direction - 'right' or 'left'
 * @returns {number} New direction (0-5)
 */
function applyBend(currentDir, angle, direction) {
  // In hex grid:
  // - 60° turn = +1 or -1 direction
  // - 120° turn = +2 or -2 directions

  const turnAmount = angle === 60 ? 1 : 2;
  const sign = direction === 'right' ? 1 : -1;

  // Wrap around (0-5)
  return (currentDir + sign * turnAmount + 6) % 6;
}

/**
 * Move one hex in a given direction
 * @param {number} q - Current q coordinate
 * @param {number} r - Current r coordinate
 * @param {number} direction - Direction (0-5)
 * @returns {Array} [newQ, newR]
 */
function moveInDirection(q, r, direction) {
  // Axial coordinate directions for flat-top hexes
  // Direction 0 = East (right)
  // Direction 1 = Southeast (down-right, 60° clockwise)
  // Direction 2 = Southwest (down-left, 120° clockwise)
  // Direction 3 = West (left, 180°)
  // Direction 4 = Northwest (up-left, 240° clockwise)
  // Direction 5 = Northeast (up-right, 300° clockwise)

  const directions = [
    [+1,  0],  // 0: East
    [ 0, +1],  // 1: Southeast
    [-1, +1],  // 2: Southwest
    [-1,  0],  // 3: West
    [ 0, -1],  // 4: Northwest
    [+1, -1],  // 5: Northeast
  ];

  const [dq, dr] = directions[direction];
  return [q + dq, r + dr];
}

/**
 * Get all neighbor positions for a hex
 * @param {number} q
 * @param {number} r
 * @returns {Array} Array of {q, r, direction}
 */
function getNeighbors(q, r) {
  const neighbors = [];
  for (let dir = 0; dir < 6; dir++) {
    const [nq, nr] = moveInDirection(q, r, dir);
    neighbors.push({ q: nq, r: nr, direction: dir });
  }
  return neighbors;
}

/**
 * Calculate distance between two hexes
 * @param {Object} hex1 - {q, r}
 * @param {Object} hex2 - {q, r}
 * @returns {number} Distance
 */
function hexDistance(hex1, hex2) {
  // Convert to cube coordinates for easier distance calculation
  const s1 = -hex1.q - hex1.r;
  const s2 = -hex2.q - hex2.r;

  return (Math.abs(hex1.q - hex2.q) +
          Math.abs(hex1.r - hex2.r) +
          Math.abs(s1 - s2)) / 2;
}

// ES Module export
export {
  sequenceToHexGrid,
  applyBend,
  moveInDirection,
  getNeighbors,
  hexDistance
};

// CommonJS export for compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sequenceToHexGrid,
    applyBend,
    moveInDirection,
    getNeighbors,
    hexDistance
  };
}

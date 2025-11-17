// Hex Layout - Convert sequences with bends to hex grid coordinates
// Usage: Core algorithm for molecular structure

/**
 * Convert a sequence with bends into hex grid coordinates
 * @param {string} sequence - e.g., "STR-EX6-BTA-RPF-CP6" or "ACGU"
 * @param {Array} bends - [{position: 2, angle: 60, direction: 'right'}, ...]
 * @returns {Array} [{q, r, type}, ...] or throws error if overlap detected
 */
function sequenceToHexGrid(sequence, bends = []) {
  const elements = sequence.includes('-') ? sequence.split('-') : sequence.split('');
  const hexes = [];
  const occupiedPositions = new Map();  // Track occupied positions

  // Track current position and direction
  let currentQ = 0;
  let currentR = 0;
  let currentDirection = 0;  // 0-5 (hex directions, 0 = right/east)

  for (let i = 0; i < elements.length; i++) {
    // Check for overlap
    const posKey = `${currentQ},${currentR}`;
    if (occupiedPositions.has(posKey)) {
      const prevElement = occupiedPositions.get(posKey);
      throw new Error(`Overlap detected: element ${i} (${elements[i]}) overlaps with element ${prevElement.index} (${prevElement.type}) at position (${currentQ}, ${currentR})`);
    }

    // Mark position as occupied
    occupiedPositions.set(posKey, { index: i, type: elements[i] });

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
 * Convert DNA double helix with bends into hex grid coordinates
 * DNA bends with outer strand stretching (skipping 2 positions) and inner strand making normal turns
 * @param {string} topStrand - Top strand sequence (e.g., "ACGT")
 * @param {string} bottomStrand - Bottom strand sequence (e.g., "TGCA")
 * @param {Array} bends - [{position: 2, angle: 60, direction: 'right'}, ...]
 * @returns {Object} {topHexes: [{q, r, type}, ...], bottomHexes: [{q, r, type}, ...], topStretches: [{q, r}...], bottomStretches: [{q, r}...]}
 */
function dnaToHexGrid(topStrand, bottomStrand, bends = []) {
  const topElements = topStrand.split('');
  const bottomElements = bottomStrand.split('');

  if (topElements.length !== bottomElements.length) {
    throw new Error('Top and bottom strands must be same length');
  }

  // Validate base pairing (A-T and G-C complementarity)
  const complementMap = {
    'A': 'T',
    'T': 'A',
    'G': 'C',
    'C': 'G'
  };

  for (let i = 0; i < topElements.length; i++) {
    const topBase = topElements[i];
    const bottomBase = bottomElements[i];
    const expectedComplement = complementMap[topBase];

    if (!expectedComplement) {
      throw new Error(`Invalid base '${topBase}' at position ${i} in top strand`);
    }
    if (!complementMap[bottomBase]) {
      throw new Error(`Invalid base '${bottomBase}' at position ${i} in bottom strand`);
    }
    if (bottomBase !== expectedComplement) {
      throw new Error(`Non-complementary base pair at position ${i}: ${topBase}-${bottomBase} (expected ${topBase}-${expectedComplement})`);
    }
  }

  const topHexes = [];
  const bottomHexes = [];
  const topStretches = [];  // Track stretched bond positions for top strand
  const bottomStretches = [];  // Track stretched bond positions for bottom strand

  // Top strand starts at (-1, 0)
  // Bottom strand starts at (-2, 2) - offset by going Southeast then Southwest from top strand start
  let topQ = -1;
  let topR = 0;
  let bottomQ = -2;
  let bottomR = 2;

  let currentDirection = 0; // Both strands move in same direction (0 = East)
  let outerStrandNeedsSkip = null; // Track if we need to skip on next move ('top' or 'bottom' or null)

  for (let i = 0; i < topElements.length; i++) {
    // Place current elements
    topHexes.push({
      q: topQ,
      r: topR,
      type: topElements[i]
    });

    bottomHexes.push({
      q: bottomQ,
      r: bottomR,
      type: bottomElements[i]
    });

    // Check if there's a bend after this position
    const bend = bends.find(b => b.position === i);

    if (bend && i < topElements.length - 1) {
      // Determine which strand is outer vs inner based on bend direction
      const isRightBend = bend.direction === 'right';
      const is120Bend = bend.angle === 120;

      if (isRightBend) {
        // Right bend: top strand stretches (outer), bottom strand is inner

        if (is120Bend) {
          // 120° right bend - complex skip pattern to maintain gap
          // Skip 2 horizontally (current direction) - track these as stretch positions
          const stretch1Q = topQ;
          const stretch1R = topR;
          [topQ, topR] = moveInDirection(topQ, topR, currentDirection);
          topStretches.push({ q: topQ, r: topR, direction: currentDirection });

          [topQ, topR] = moveInDirection(topQ, topR, currentDirection);
          topStretches.push({ q: topQ, r: topR, direction: currentDirection });

          // Skip 1 "down/right" (Southeast, which is current direction + 1)
          const intermediateDir = (currentDirection + 1) % 6;
          [topQ, topR] = moveInDirection(topQ, topR, intermediateDir);
          topStretches.push({ q: topQ, r: topR, direction: intermediateDir });
          // This is where the corner base will be placed on the next iteration

          // Bottom strand (inner): Take 1 normal step
          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);

          // Apply the bend - change direction for both strands
          currentDirection = applyBend(currentDirection, bend.angle, bend.direction);

          // Mark that next move needs complex skip:
          // Move 1 Southeast, then 2 Southwest before placing next base
          outerStrandNeedsSkip = {
            strand: 'top',
            pattern: '120-right',
            intermediateDir: intermediateDir
          };
        } else {
          // 60° bend - simple skip pattern (skip 1 hex on each side)
          [topQ, topR] = moveInDirection(topQ, topR, currentDirection);
          topStretches.push({ q: topQ, r: topR, direction: currentDirection });

          [topQ, topR] = moveInDirection(topQ, topR, currentDirection);
          topStretches.push({ q: topQ, r: topR, direction: currentDirection });

          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);

          currentDirection = applyBend(currentDirection, bend.angle, bend.direction);
          outerStrandNeedsSkip = { strand: 'top', skips: 2 };
        }
      } else {
        // Left bend: bottom strand stretches (outer), top strand is inner

        if (is120Bend) {
          // 120° left bend - complex skip pattern to maintain gap
          // Skip 2 horizontally (current direction)
          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);
          bottomStretches.push({ q: bottomQ, r: bottomR, direction: currentDirection });

          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);
          bottomStretches.push({ q: bottomQ, r: bottomR, direction: currentDirection });

          // Skip 1 "down/left" (counterclockwise from current, which is current direction - 1)
          const intermediateDir = (currentDirection - 1 + 6) % 6;
          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, intermediateDir);
          bottomStretches.push({ q: bottomQ, r: bottomR, direction: intermediateDir });

          [topQ, topR] = moveInDirection(topQ, topR, currentDirection);

          currentDirection = applyBend(currentDirection, bend.angle, bend.direction);

          outerStrandNeedsSkip = {
            strand: 'bottom',
            pattern: '120-left',
            intermediateDir: intermediateDir
          };
        } else {
          // 60° bend - simple skip pattern
          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);
          bottomStretches.push({ q: bottomQ, r: bottomR, direction: currentDirection });

          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);
          bottomStretches.push({ q: bottomQ, r: bottomR, direction: currentDirection });

          [topQ, topR] = moveInDirection(topQ, topR, currentDirection);

          currentDirection = applyBend(currentDirection, bend.angle, bend.direction);
          outerStrandNeedsSkip = { strand: 'bottom', skips: 2 };
        }
      }
    } else if (i < topElements.length - 1) {
      // No bend - move normally, but check if outer strand needs to skip
      if (outerStrandNeedsSkip && outerStrandNeedsSkip.strand === 'top') {
        if (outerStrandNeedsSkip.pattern === '120-right') {
          // Complex pattern for 120° right bend
          // Move 1 in intermediate direction (Southeast)
          [topQ, topR] = moveInDirection(topQ, topR, outerStrandNeedsSkip.intermediateDir);
          topStretches.push({ q: topQ, r: topR, direction: outerStrandNeedsSkip.intermediateDir });

          // Move 2 in new direction (Southwest)
          [topQ, topR] = moveInDirection(topQ, topR, currentDirection);
          topStretches.push({ q: topQ, r: topR, direction: currentDirection });

          [topQ, topR] = moveInDirection(topQ, topR, currentDirection);
          topStretches.push({ q: topQ, r: topR, direction: currentDirection });

          // Bottom strand moves normally
          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);
          outerStrandNeedsSkip = null;
        } else {
          // Simple skip pattern (60° bends)
          for (let s = 0; s < outerStrandNeedsSkip.skips; s++) {
            [topQ, topR] = moveInDirection(topQ, topR, currentDirection);
            topStretches.push({ q: topQ, r: topR, direction: currentDirection });
          }
          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);
          outerStrandNeedsSkip = null;
        }
      } else if (outerStrandNeedsSkip && outerStrandNeedsSkip.strand === 'bottom') {
        if (outerStrandNeedsSkip.pattern === '120-left') {
          // Complex pattern for 120° left bend
          // Move 1 in intermediate direction
          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, outerStrandNeedsSkip.intermediateDir);
          bottomStretches.push({ q: bottomQ, r: bottomR, direction: outerStrandNeedsSkip.intermediateDir });

          // Move 2 in new direction
          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);
          bottomStretches.push({ q: bottomQ, r: bottomR, direction: currentDirection });

          [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);
          bottomStretches.push({ q: bottomQ, r: bottomR, direction: currentDirection });

          // Top strand moves normally
          [topQ, topR] = moveInDirection(topQ, topR, currentDirection);
          outerStrandNeedsSkip = null;
        } else {
          // Simple skip pattern (60° bends)
          for (let s = 0; s < outerStrandNeedsSkip.skips; s++) {
            [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);
            bottomStretches.push({ q: bottomQ, r: bottomR, direction: currentDirection });
          }
          [topQ, topR] = moveInDirection(topQ, topR, currentDirection);
          outerStrandNeedsSkip = null;
        }
      } else {
        // Both strands move normally
        [topQ, topR] = moveInDirection(topQ, topR, currentDirection);
        [bottomQ, bottomR] = moveInDirection(bottomQ, bottomR, currentDirection);
      }
    }
  }

  return {
    topHexes,
    bottomHexes,
    topStretches,
    bottomStretches
  };
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
  dnaToHexGrid,
  applyBend,
  moveInDirection,
  getNeighbors,
  hexDistance
};

// CommonJS export for compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sequenceToHexGrid,
    dnaToHexGrid,
    applyBend,
    moveInDirection,
    getNeighbors,
    hexDistance
  };
}

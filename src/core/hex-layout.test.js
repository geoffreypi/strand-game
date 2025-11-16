// Test: Hex Layout - Sequence to Hex Grid Conversion
// Usage: Verify that sequences with bends correctly map to hex coordinates

import {
  sequenceToHexGrid,
  applyBend,
  moveInDirection,
  getNeighbors,
  hexDistance
} from './hex-layout.js';

describe('sequenceToHexGrid', () => {
  describe('Straight sequences', () => {
    test('should place protein sequence in a straight line', () => {
      const result = sequenceToHexGrid('STR-EX6-BTA-RPF', []);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'STR' },
        { q: 1, r: 0, type: 'EX6' },
        { q: 2, r: 0, type: 'BTA' },
        { q: 3, r: 0, type: 'RPF' }
      ]);
    });

    test('should handle RNA sequences (no dashes)', () => {
      const result = sequenceToHexGrid('ACGUA', []);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 2, r: 0, type: 'G' },
        { q: 3, r: 0, type: 'U' },
        { q: 4, r: 0, type: 'A' }
      ]);
    });

    test('should handle single element', () => {
      const result = sequenceToHexGrid('A', []);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'A' }
      ]);
    });
  });

  describe('60° bends', () => {
    test('should handle single 60° right bend', () => {
      const result = sequenceToHexGrid('STR-EX6-BTA-RPF', [
        { position: 1, angle: 60, direction: 'right' }
      ]);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'STR' },
        { q: 1, r: 0, type: 'EX6' },
        { q: 1, r: 1, type: 'BTA' },  // Southeast after 60° right
        { q: 1, r: 2, type: 'RPF' }   // Continue southeast
      ]);
    });

    test('should handle single 60° left bend', () => {
      const result = sequenceToHexGrid('A-B-C-D', [
        { position: 1, angle: 60, direction: 'left' }
      ]);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 2, r: -1, type: 'C' },  // Northeast after 60° left
        { q: 3, r: -2, type: 'D' }   // Continue northeast
      ]);
    });

    test('should handle RNA with 60° bend', () => {
      const result = sequenceToHexGrid('ACGUA', [
        { position: 2, angle: 60, direction: 'right' }
      ]);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 2, r: 0, type: 'G' },
        { q: 2, r: 1, type: 'U' },  // Southeast after 60° right
        { q: 2, r: 2, type: 'A' }   // Continue southeast
      ]);
    });
  });

  describe('120° bends', () => {
    test('should handle single 120° right bend', () => {
      const result = sequenceToHexGrid('STR-EX6-BTA-RPF', [
        { position: 1, angle: 120, direction: 'right' }
      ]);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'STR' },
        { q: 1, r: 0, type: 'EX6' },
        { q: 0, r: 1, type: 'BTA' },  // Southwest after 120° right
        { q: -1, r: 2, type: 'RPF' }  // Continue southwest
      ]);
    });

    test('should handle single 120° left bend', () => {
      const result = sequenceToHexGrid('A-B-C-D', [
        { position: 1, angle: 120, direction: 'left' }
      ]);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 1, r: -1, type: 'C' },  // Northeast after 120° left
        { q: 1, r: -2, type: 'D' }   // Continue northeast
      ]);
    });
  });

  describe('Multiple bends', () => {
    test('should handle S-shape (right then left)', () => {
      const result = sequenceToHexGrid('A-B-C-D-E-F', [
        { position: 1, angle: 60, direction: 'right' },
        { position: 3, angle: 60, direction: 'left' }
      ]);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 1, r: 1, type: 'C' },  // 60° right → southeast
        { q: 1, r: 2, type: 'D' },  // Continue southeast
        { q: 2, r: 2, type: 'E' },  // 60° left → east
        { q: 3, r: 2, type: 'F' }   // Continue east
      ]);
    });

    test('should handle zigzag pattern', () => {
      const result = sequenceToHexGrid('A-B-C-D-E', [
        { position: 1, angle: 60, direction: 'right' },
        { position: 2, angle: 60, direction: 'left' },
        { position: 3, angle: 60, direction: 'right' }
      ]);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 1, r: 1, type: 'C' },  // 60° right → southeast
        { q: 2, r: 1, type: 'D' },  // 60° left → east
        { q: 2, r: 2, type: 'E' }   // 60° right → southeast
      ]);
    });

    test('should handle complex folding pattern', () => {
      const result = sequenceToHexGrid('A-B-C-D-E-F-G', [
        { position: 1, angle: 60, direction: 'right' },
        { position: 3, angle: 60, direction: 'right' },
        { position: 5, angle: 120, direction: 'left' }
      ]);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 1, r: 1, type: 'C' },  // 60° right → southeast
        { q: 1, r: 2, type: 'D' },  // Continue southeast
        { q: 0, r: 3, type: 'E' },  // 60° right → southwest
        { q: -1, r: 4, type: 'F' }, // Continue southwest
        { q: 0, r: 4, type: 'G' }   // 120° left → east
      ]);
    });
  });

  describe('Edge cases', () => {
    test('should handle empty sequence', () => {
      const result = sequenceToHexGrid('', []);
      expect(result).toEqual([]);
    });

    test('should ignore bend at last position', () => {
      const result = sequenceToHexGrid('A-B-C', [
        { position: 2, angle: 60, direction: 'right' }
      ]);

      // Bend at position 2 (element C) should be ignored since it's the last element
      expect(result).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 2, r: 0, type: 'C' }
      ]);
    });

    test('should ignore bend at invalid position', () => {
      const result = sequenceToHexGrid('A-B-C', [
        { position: 5, angle: 60, direction: 'right' }
      ]);

      expect(result).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 2, r: 0, type: 'C' }
      ]);
    });
  });
});

describe('applyBend', () => {
  test('should apply 60° right bend from east', () => {
    const newDir = applyBend(0, 60, 'right');  // 0 = east
    expect(newDir).toBe(1);  // 1 = southeast
  });

  test('should apply 60° left bend from east', () => {
    const newDir = applyBend(0, 60, 'left');  // 0 = east
    expect(newDir).toBe(5);  // 5 = northeast
  });

  test('should apply 120° right bend from east', () => {
    const newDir = applyBend(0, 120, 'right');  // 0 = east
    expect(newDir).toBe(2);  // 2 = southwest
  });

  test('should apply 120° left bend from east', () => {
    const newDir = applyBend(0, 120, 'left');  // 0 = east
    expect(newDir).toBe(4);  // 4 = northwest
  });

  test('should wrap around when going past 5', () => {
    const newDir = applyBend(5, 60, 'right');  // 5 = northeast
    expect(newDir).toBe(0);  // Should wrap to 0 = east
  });

  test('should wrap around when going below 0', () => {
    const newDir = applyBend(0, 60, 'left');  // 0 = east
    expect(newDir).toBe(5);  // Should wrap to 5 = northeast
  });
});

describe('moveInDirection', () => {
  test('should move east (direction 0)', () => {
    const [q, r] = moveInDirection(0, 0, 0);
    expect([q, r]).toEqual([1, 0]);
  });

  test('should move southeast (direction 1)', () => {
    const [q, r] = moveInDirection(0, 0, 1);
    expect([q, r]).toEqual([0, 1]);
  });

  test('should move southwest (direction 2)', () => {
    const [q, r] = moveInDirection(0, 0, 2);
    expect([q, r]).toEqual([-1, 1]);
  });

  test('should move west (direction 3)', () => {
    const [q, r] = moveInDirection(0, 0, 3);
    expect([q, r]).toEqual([-1, 0]);
  });

  test('should move northwest (direction 4)', () => {
    const [q, r] = moveInDirection(0, 0, 4);
    expect([q, r]).toEqual([0, -1]);
  });

  test('should move northeast (direction 5)', () => {
    const [q, r] = moveInDirection(0, 0, 5);
    expect([q, r]).toEqual([1, -1]);
  });

  test('should work from non-origin positions', () => {
    const [q, r] = moveInDirection(5, 3, 0);  // East from (5, 3)
    expect([q, r]).toEqual([6, 3]);
  });
});

describe('getNeighbors', () => {
  test('should return all 6 neighbors from origin', () => {
    const neighbors = getNeighbors(0, 0);

    expect(neighbors).toEqual([
      { q: 1, r: 0, direction: 0 },   // East
      { q: 0, r: 1, direction: 1 },   // Southeast
      { q: -1, r: 1, direction: 2 },  // Southwest
      { q: -1, r: 0, direction: 3 },  // West
      { q: 0, r: -1, direction: 4 },  // Northwest
      { q: 1, r: -1, direction: 5 }   // Northeast
    ]);
  });

  test('should return all 6 neighbors from non-origin position', () => {
    const neighbors = getNeighbors(2, 3);

    expect(neighbors).toEqual([
      { q: 3, r: 3, direction: 0 },   // East
      { q: 2, r: 4, direction: 1 },   // Southeast
      { q: 1, r: 4, direction: 2 },   // Southwest
      { q: 1, r: 3, direction: 3 },   // West
      { q: 2, r: 2, direction: 4 },   // Northwest
      { q: 3, r: 2, direction: 5 }    // Northeast
    ]);
  });
});

describe('hexDistance', () => {
  test('should return 0 for same hex', () => {
    const dist = hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 });
    expect(dist).toBe(0);
  });

  test('should return 1 for adjacent hexes', () => {
    const dist = hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 });
    expect(dist).toBe(1);
  });

  test('should return 2 for hexes two steps apart', () => {
    const dist = hexDistance({ q: 0, r: 0 }, { q: 2, r: 0 });
    expect(dist).toBe(2);
  });

  test('should calculate diagonal distance correctly', () => {
    const dist = hexDistance({ q: 0, r: 0 }, { q: 1, r: 1 });
    expect(dist).toBe(2);
  });

  test('should handle negative coordinates', () => {
    const dist = hexDistance({ q: -2, r: 3 }, { q: 1, r: -1 });
    // Distance calculation: dq=3, dr=4, ds=1 → (3+4+1)/2 = 4
    expect(dist).toBe(4);
  });

  test('should be symmetric', () => {
    const dist1 = hexDistance({ q: 0, r: 0 }, { q: 3, r: 2 });
    const dist2 = hexDistance({ q: 3, r: 2 }, { q: 0, r: 0 });
    expect(dist1).toBe(dist2);
  });
});

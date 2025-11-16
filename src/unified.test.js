import { describe, test, expect } from '@jest/globals';
import { sequenceToHexGrid, applyBend, moveInDirection, getNeighbors, hexDistance } from './core/hex-layout.js';
import ASCIIRenderer from './renderers/ascii-renderer.js';

describe('Unified Molecular Rendering Tests', () => {

  // ===========================================================================
  // DNA RENDERING (3 tests) - Unique to original tests
  // ===========================================================================

  describe('DNA rendering', () => {
    test('renders simple DNA structure with hydrogen bonds', () => {
      const result = ASCIIRenderer.renderDNA('ACGT', 'TGCA');
      const expected = '3\'-<A>-<C>-<G>-<T>-5\'\n' +
                       '   | | ||| ||| | |\n' +
                       '5\'-<T>-<G>-<C>-<A>-3\'';
      expect(result).toBe(expected);
    });

    test('returns error for mismatched DNA lengths', () => {
      const result = ASCIIRenderer.renderDNA('ACG', 'TGCA');
      expect(result).toBe('ERROR: Top and bottom sequences must be same length');
    });

    test('renders single DNA base pair', () => {
      const result = ASCIIRenderer.renderDNA('A', 'T');
      const expected = '3\'-<A>-5\'\n' +
                       '   | |\n' +
                       '5\'-<T>-3\'';
      expect(result).toBe(expected);
    });
  });

  // ===========================================================================
  // STRAIGHT SEQUENCES - Both hex positions and ASCII
  // ===========================================================================

  describe('Straight sequences (no bends)', () => {
    test('renders straight protein sequence', () => {
      const sequence = 'A-B-C-D';
      const bends = [];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 2, r: 0, type: 'C' },
        { q: 3, r: 0, type: 'D' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      expect(ascii).toBe('A-B-C-D');
    });

    test('renders multi-amino acid protein', () => {
      const result = ASCIIRenderer.renderProtein('STR-EX6-BTA-RPF');
      expect(result).toBe('N-STR-EX6-BTA-RPF-C');
    });

    test('renders single amino acid protein', () => {
      const result = ASCIIRenderer.renderProtein('STR');
      expect(result).toBe('N-STR-C');
    });

    test('renders straight RNA sequence', () => {
      const sequence = 'ACGU';
      const bends = [];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 2, r: 0, type: 'G' },
        { q: 3, r: 0, type: 'U' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '5\'-', '-3\'');
      expect(ascii).toBe('5\'-A-C-G-U-3\'');
    });

    test('renders RNA with 5 bases', () => {
      const result = ASCIIRenderer.renderRNA('ACGUA');
      expect(result).toBe('5\'-<A>-<C>-<G>-<U>-<A>-3\'');
    });

    test('renders single RNA nucleotide', () => {
      const result = ASCIIRenderer.renderRNA('A');
      expect(result).toBe('5\'-<A>-3\'');
    });

    test('handles empty RNA sequence', () => {
      const result = ASCIIRenderer.renderRNA('');
      expect(result).toBe('5\'--3\'');
    });

    test('renders single element', () => {
      const sequence = 'A';
      const bends = [];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      expect(ascii).toBe('A');
    });
  });

  // ===========================================================================
  // SINGLE 60° RIGHT BEND (Southeast)
  // ===========================================================================

  describe('Single 60° right bend (Southeast)', () => {
    test('renders protein with 60° right bend', () => {
      const sequence = 'STR-EX6-BTA-RPF';
      const bends = [{ position: 1, angle: 60, direction: 'right' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'STR' },
        { q: 1, r: 0, type: 'EX6' },
        { q: 1, r: 1, type: 'BTA' },
        { q: 1, r: 2, type: 'RPF' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, 'N-', '-C');
      const expected = 'N-STR-EX6\n' +
                       '        \\\n' +
                       '        BTA\n' +
                       '          \\\n' +
                       '          RPF-C';
      expect(ascii).toBe(expected);
    });

    test('renders simple sequence with 60° right bend', () => {
      const sequence = 'A-B-C-D';
      const bends = [{ position: 1, angle: 60, direction: 'right' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 1, r: 1, type: 'C' },
        { q: 1, r: 2, type: 'D' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = 'A-B\n' +
                       '   \\\n' +
                       '    C\n' +
                       '     \\\n' +
                       '      D';
      expect(ascii).toBe(expected);
    });
  });

  // ===========================================================================
  // SINGLE 120° RIGHT BEND (Southwest)
  // ===========================================================================

  describe('Single 120° right bend (Southwest)', () => {
    test('renders protein with 120° right bend', () => {
      const sequence = 'STR-EX6-BTA-RPF';
      const bends = [{ position: 1, angle: 120, direction: 'right' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'STR' },
        { q: 1, r: 0, type: 'EX6' },
        { q: 0, r: 1, type: 'BTA' },
        { q: -1, r: 2, type: 'RPF' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, 'N-', '-C');
      const expected = 'N-STR-EX6\n' +
                       '      /\n' +
                       '    BTA\n' +
                       '    /\n' +
                       '  RPF-C';
      expect(ascii).toBe(expected);
    });

    test('renders simple sequence with 120° right bend', () => {
      const sequence = 'A-B-C-D';
      const bends = [{ position: 1, angle: 120, direction: 'right' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 0, r: 1, type: 'C' },
        { q: -1, r: 2, type: 'D' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = '  A-B\n' +
                       '   /\n' +
                       '  C\n' +
                       ' /\n' +
                       'D';
      expect(ascii).toBe(expected);
    });

    test('renders long protein with 120° bend and west movement', () => {
      const sequence = 'STR-EX6-BTA-BTA-BTA-BTA-BTA-BTA';
      const bends = [{ position: 1, angle: 120, direction: 'right' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'STR' },
        { q: 1, r: 0, type: 'EX6' },
        { q: 0, r: 1, type: 'BTA' },
        { q: -1, r: 2, type: 'BTA' },
        { q: -2, r: 3, type: 'BTA' },
        { q: -3, r: 4, type: 'BTA' },
        { q: -4, r: 5, type: 'BTA' },
        { q: -5, r: 6, type: 'BTA' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, 'N-', '-C');
      const expected = '      N-STR-EX6\n' +
                       '            /\n' +
                       '          BTA\n' +
                       '          /\n' +
                       '        BTA\n' +
                       '        /\n' +
                       '      BTA\n' +
                       '      /\n' +
                       '    BTA\n' +
                       '    /\n' +
                       '  BTA\n' +
                       '  /\n' +
                       'BTA-C';
      expect(ascii).toBe(expected);
    });
  });

  // ===========================================================================
  // SINGLE 60° LEFT BEND (Northeast)
  // ===========================================================================

  describe('Single 60° left bend (Northeast)', () => {
    test('renders sequence with 60° left bend', () => {
      const sequence = 'A-B-C-D';
      const bends = [{ position: 1, angle: 60, direction: 'left' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 2, r: -1, type: 'C' },
        { q: 3, r: -2, type: 'D' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = '      D\n' +
                       '     /\n' +
                       '    C\n' +
                       '   /\n' +
                       'A-B';
      expect(ascii).toBe(expected);
    });
  });

  // ===========================================================================
  // SINGLE 120° LEFT BEND (Northwest)
  // ===========================================================================

  describe('Single 120° left bend (Northwest)', () => {
    test('renders sequence with 120° left bend', () => {
      const sequence = 'A-B-C-D';
      const bends = [{ position: 1, angle: 120, direction: 'left' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 1, r: -1, type: 'C' },
        { q: 1, r: -2, type: 'D' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = 'D\n' +
                       ' \\\n' +
                       '  C\n' +
                       '   \\\n' +
                       '  A-B';
      expect(ascii).toBe(expected);
    });
  });

  // ===========================================================================
  // MULTIPLE BENDS
  // ===========================================================================

  describe('Multiple bends', () => {
    test('renders sequence with two 60° right bends', () => {
      const sequence = 'A-B-C-D-E-F';
      const bends = [
        { position: 1, angle: 60, direction: 'right' },
        { position: 3, angle: 60, direction: 'right' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 1, r: 1, type: 'C' },
        { q: 1, r: 2, type: 'D' },
        { q: 0, r: 3, type: 'E' },
        { q: -1, r: 4, type: 'F' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = 'A-B\n' +
                       '   \\\n' +
                       '    C\n' +
                       '     \\\n' +
                       '      D\n' +
                       '     /\n' +
                       '    E\n' +
                       '   /\n' +
                       '  F';
      expect(ascii).toBe(expected);
    });

    test('renders sequence with two 120° right bends', () => {
      const sequence = 'A-B-C-D-E-F';
      const bends = [
        { position: 1, angle: 120, direction: 'right' },
        { position: 3, angle: 120, direction: 'right' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 0, r: 1, type: 'C' },
        { q: -1, r: 2, type: 'D' },
        { q: -1, r: 1, type: 'E' },
        { q: -1, r: 0, type: 'F' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = 'F     A-B\n' +
                       ' \\     /\n' +
                       '  E   C\n' +
                       '   \\ /\n' +
                       '    D';
      expect(ascii).toBe(expected);
    });

    test('renders sequence with mixed 60° and 120° bends', () => {
      const sequence = 'A-B-C-D-E-F';
      const bends = [
        { position: 1, angle: 60, direction: 'right' },
        { position: 3, angle: 120, direction: 'right' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 1, r: 1, type: 'C' },
        { q: 1, r: 2, type: 'D' },
        { q: 0, r: 2, type: 'E' },
        { q: -1, r: 2, type: 'F' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = 'A-B\n' +
                       '   \\\n' +
                       '    C\n' +
                       '     \\\n' +
                       '  F-E-D';
      expect(ascii).toBe(expected);
    });

    test('renders sequence with right and left bends', () => {
      const sequence = 'A-B-C-D-E-F';
      const bends = [
        { position: 1, angle: 60, direction: 'right' },
        { position: 3, angle: 60, direction: 'left' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 1, r: 1, type: 'C' },
        { q: 1, r: 2, type: 'D' },
        { q: 2, r: 2, type: 'E' },
        { q: 3, r: 2, type: 'F' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = 'A-B\n' +
                       '   \\\n' +
                       '    C\n' +
                       '     \\\n' +
                       '      D-E-F';
      expect(ascii).toBe(expected);
    });
  });

  // ===========================================================================
  // COMPLEX MULTI-BEND PATTERNS
  // ===========================================================================

  describe('Complex multi-bend patterns', () => {
    test('renders zigzag pattern with alternating bends', () => {
      const sequence = 'A-B-C-D-E-F-G-H';
      const bends = [
        { position: 1, angle: 60, direction: 'right' },
        { position: 2, angle: 60, direction: 'left' },
        { position: 3, angle: 60, direction: 'right' },
        { position: 4, angle: 60, direction: 'left' },
        { position: 5, angle: 60, direction: 'right' },
        { position: 6, angle: 60, direction: 'left' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 1, r: 1, type: 'C' },
        { q: 2, r: 1, type: 'D' },
        { q: 2, r: 2, type: 'E' },
        { q: 3, r: 2, type: 'F' },
        { q: 3, r: 3, type: 'G' },
        { q: 4, r: 3, type: 'H' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = 'A-B\n' +
                       '   \\\n' +
                       '    C-D\n' +
                       '       \\\n' +
                       '        E-F\n' +
                       '           \\\n' +
                       '            G-H';
      expect(ascii).toBe(expected);
    });

    test('renders U-turn pattern with three 60° bends', () => {
      const sequence = 'A-B-C-D-E';
      const bends = [
        { position: 1, angle: 60, direction: 'right' },
        { position: 2, angle: 60, direction: 'right' },
        { position: 3, angle: 60, direction: 'right' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 1, r: 1, type: 'C' },
        { q: 0, r: 2, type: 'D' },
        { q: -1, r: 2, type: 'E' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = 'A-B\n' +
                       '   \\\n' +
                       '    C\n' +
                       '   /\n' +
                       'E-D';
      expect(ascii).toBe(expected);
    });

    test('renders long sequence with multiple complex bends', () => {
      const sequence = 'A-B-C-D-E-F-G-H-I-J';
      const bends = [
        { position: 2, angle: 60, direction: 'right' },
        { position: 5, angle: 120, direction: 'left' },
        { position: 7, angle: 60, direction: 'right' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 2, r: 0, type: 'C' },
        { q: 2, r: 1, type: 'D' },
        { q: 2, r: 2, type: 'E' },
        { q: 2, r: 3, type: 'F' },
        { q: 3, r: 2, type: 'G' },
        { q: 4, r: 1, type: 'H' },
        { q: 5, r: 1, type: 'I' },
        { q: 6, r: 1, type: 'J' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = 'A-B-C\n' +
                       '     \\\n' +
                       '      D       H-I-J\n' +
                       '       \\     /\n' +
                       '        E   G\n' +
                       '         \\ /\n' +
                       '          F';
      expect(ascii).toBe(expected);
    });

    test('renders sharp turns with alternating 120° bends', () => {
      const sequence = 'A-B-C-D-E-F';
      const bends = [
        { position: 1, angle: 120, direction: 'right' },
        { position: 3, angle: 120, direction: 'left' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'B' },
        { q: 0, r: 1, type: 'C' },
        { q: -1, r: 2, type: 'D' },
        { q: 0, r: 2, type: 'E' },
        { q: 1, r: 2, type: 'F' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, '', '');
      const expected = '  A-B\n' +
                       '   /\n' +
                       '  C\n' +
                       ' /\n' +
                       'D-E-F';
      expect(ascii).toBe(expected);
    });
  });

  // ===========================================================================
  // OVERLAP DETECTION
  // ===========================================================================

  describe('Overlap detection', () => {
    test('detects overlap in right spiral (5 consecutive 60° right bends)', () => {
      const sequence = 'A-B-C-D-E-F-G';
      const bends = [
        { position: 1, angle: 60, direction: 'right' },
        { position: 2, angle: 60, direction: 'right' },
        { position: 3, angle: 60, direction: 'right' },
        { position: 4, angle: 60, direction: 'right' },
        { position: 5, angle: 60, direction: 'right' }
      ];

      expect(() => {
        sequenceToHexGrid(sequence, bends);
      }).toThrow('Overlap detected: element 6 (G) overlaps with element 0 (A) at position (0, 0)');
    });

    test('detects overlap in complete hexagon (6 consecutive 60° right bends)', () => {
      const sequence = 'A-B-C-D-E-F-G';
      const bends = [
        { position: 0, angle: 60, direction: 'right' },
        { position: 1, angle: 60, direction: 'right' },
        { position: 2, angle: 60, direction: 'right' },
        { position: 3, angle: 60, direction: 'right' },
        { position: 4, angle: 60, direction: 'right' },
        { position: 5, angle: 60, direction: 'right' }
      ];

      expect(() => {
        sequenceToHexGrid(sequence, bends);
      }).toThrow('Overlap detected: element 6 (G) overlaps with element 0 (A) at position (0, 0)');
    });

    test('detects overlap in left spiral (5 consecutive 60° left bends)', () => {
      const sequence = 'A-B-C-D-E-F-G';
      const bends = [
        { position: 1, angle: 60, direction: 'left' },
        { position: 2, angle: 60, direction: 'left' },
        { position: 3, angle: 60, direction: 'left' },
        { position: 4, angle: 60, direction: 'left' },
        { position: 5, angle: 60, direction: 'left' }
      ];

      expect(() => {
        sequenceToHexGrid(sequence, bends);
      }).toThrow('Overlap detected: element 6 (G) overlaps with element 0 (A) at position (0, 0)');
    });
  });

  // ===========================================================================
  // RNA WITH BENDS
  // ===========================================================================

  describe('RNA with bends', () => {
    test('renders RNA with bend at valid position', () => {
      const result = ASCIIRenderer.renderRNAWithBend('ACGUA', 2);
      const expected = '5\'-<A>-<C>-<G>\n' +
                       '             \\\n' +
                       '             <U>\n' +
                       '               \\\n' +
                       '               <A>-3\'';
      expect(result).toBe(expected);
    });

    test('returns error for invalid bend position (negative)', () => {
      const result = ASCIIRenderer.renderRNAWithBend('ACGUA', -1);
      expect(result).toBe('ERROR: Invalid bend position');
    });

    test('returns error for invalid bend position (too large)', () => {
      const result = ASCIIRenderer.renderRNAWithBend('ACGUA', 5);
      expect(result).toBe('ERROR: Invalid bend position');
    });

    test('renders RNA with bend using wrapped base notation', () => {
      const sequence = 'ACGU';
      const bends = [{ position: 1, angle: 60, direction: 'right' }];

      // Validate hex positions (unwrapped)
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 1, r: 1, type: 'G' },
        { q: 1, r: 2, type: 'U' }
      ]);

      // Map to wrapped bases
      const wrappedHexes = hexGrid.map((hex) => ({
        ...hex,
        type: '<' + hex.type + '>'
      }));

      // Validate ASCII output with wrapped bases
      const ascii = ASCIIRenderer.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
      const expected = '5\'-<A>-<C>\n' +
                       '         \\\n' +
                       '         <G>\n' +
                       '           \\\n' +
                       '           <U>-3\'';
      expect(ascii).toBe(expected);
    });
  });

  // ===========================================================================
  // RNA COMPLEX GEOMETRIES
  // ===========================================================================

  describe('RNA complex geometries', () => {
    test('renders RNA with 60° right bend (A-C-G-U)', () => {
      const sequence = 'ACGU';
      const bends = [{ position: 1, angle: 60, direction: 'right' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 1, r: 1, type: 'G' },
        { q: 1, r: 2, type: 'U' }
      ]);

      // Map to wrapped bases
      const wrappedHexes = hexGrid.map((hex) => ({
        ...hex,
        type: '<' + hex.type + '>'
      }));

      // Validate ASCII output with wrapped bases
      const ascii = ASCIIRenderer.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
      const expected = '5\'-<A>-<C>\n' +
                       '         \\\n' +
                       '         <G>\n' +
                       '           \\\n' +
                       '           <U>-3\'';
      expect(ascii).toBe(expected);
    });

    test('renders RNA with 120° right bend (A-C-G-U)', () => {
      const sequence = 'ACGU';
      const bends = [{ position: 1, angle: 120, direction: 'right' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 0, r: 1, type: 'G' },
        { q: -1, r: 2, type: 'U' }
      ]);

      // Map to wrapped bases
      const wrappedHexes = hexGrid.map((hex) => ({
        ...hex,
        type: '<' + hex.type + '>'
      }));

      // Validate ASCII output with wrapped bases
      const ascii = ASCIIRenderer.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
      const expected = '5\'-<A>-<C>\n' +
                       '       /\n' +
                       '     <G>\n' +
                       '     /\n' +
                       '   <U>-3\'';
      expect(ascii).toBe(expected);
    });

    test('renders RNA with 60° left bend (A-C-G-U)', () => {
      const sequence = 'ACGU';
      const bends = [{ position: 1, angle: 60, direction: 'left' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 2, r: -1, type: 'G' },
        { q: 3, r: -2, type: 'U' }
      ]);

      // Map to wrapped bases
      const wrappedHexes = hexGrid.map((hex) => ({
        ...hex,
        type: '<' + hex.type + '>'
      }));

      // Validate ASCII output with wrapped bases
      const ascii = ASCIIRenderer.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
      const expected = '           <U>-3\'\n' +
                       '           /\n' +
                       '         <G>\n' +
                       '         /\n' +
                       '5\'-<A>-<C>';
      expect(ascii).toBe(expected);
    });

    test('renders RNA with 120° left bend (A-C-G-U)', () => {
      const sequence = 'ACGU';
      const bends = [{ position: 1, angle: 120, direction: 'left' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 1, r: -1, type: 'G' },
        { q: 1, r: -2, type: 'U' }
      ]);

      // Map to wrapped bases
      const wrappedHexes = hexGrid.map((hex) => ({
        ...hex,
        type: '<' + hex.type + '>'
      }));

      // Validate ASCII output with wrapped bases
      const ascii = ASCIIRenderer.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
      const expected = '   <U>-3\'\n' +
                       '     \\\n' +
                       '     <G>\n' +
                       '       \\\n' +
                       '5\'-<A>-<C>';
      expect(ascii).toBe(expected);
    });

    test('renders RNA with two 60° right bends (A-C-G-U-A-C)', () => {
      const sequence = 'ACGUAC';
      const bends = [
        { position: 1, angle: 60, direction: 'right' },
        { position: 3, angle: 60, direction: 'right' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 1, r: 1, type: 'G' },
        { q: 1, r: 2, type: 'U' },
        { q: 0, r: 3, type: 'A' },
        { q: -1, r: 4, type: 'C' }
      ]);

      // Map to wrapped bases
      const wrappedHexes = hexGrid.map((hex) => ({
        ...hex,
        type: '<' + hex.type + '>'
      }));

      // Validate ASCII output with wrapped bases
      const ascii = ASCIIRenderer.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
      const expected = '5\'-<A>-<C>\n' +
                       '         \\\n' +
                       '         <G>\n' +
                       '           \\\n' +
                       '           <U>\n' +
                       '           /\n' +
                       '         <A>\n' +
                       '         /\n' +
                       '       <C>-3\'';
      expect(ascii).toBe(expected);
    });

    test('renders RNA with two 120° right bends (A-C-G-U-A-C)', () => {
      const sequence = 'ACGUAC';
      const bends = [
        { position: 1, angle: 120, direction: 'right' },
        { position: 3, angle: 120, direction: 'right' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 0, r: 1, type: 'G' },
        { q: -1, r: 2, type: 'U' },
        { q: -1, r: 1, type: 'A' },
        { q: -1, r: 0, type: 'C' }
      ]);

      // Map to wrapped bases
      const wrappedHexes = hexGrid.map((hex) => ({
        ...hex,
        type: '<' + hex.type + '>'
      }));

      // Validate ASCII output with wrapped bases
      const ascii = ASCIIRenderer.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
      const expected = '<C>-3\'>-<C>\n' +
                       '  \\     /\n' +
                       '  <A> <G>\n' +
                       '    \\ /\n' +
                       '    <U>';
      expect(ascii).toBe(expected);
    });

    test('renders RNA zigzag pattern (A-C-G-U-A-C-G-U)', () => {
      const sequence = 'ACGUACGU';
      const bends = [
        { position: 1, angle: 60, direction: 'right' },
        { position: 2, angle: 60, direction: 'left' },
        { position: 3, angle: 60, direction: 'right' },
        { position: 4, angle: 60, direction: 'left' },
        { position: 5, angle: 60, direction: 'right' },
        { position: 6, angle: 60, direction: 'left' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 1, r: 1, type: 'G' },
        { q: 2, r: 1, type: 'U' },
        { q: 2, r: 2, type: 'A' },
        { q: 3, r: 2, type: 'C' },
        { q: 3, r: 3, type: 'G' },
        { q: 4, r: 3, type: 'U' }
      ]);

      // Map to wrapped bases
      const wrappedHexes = hexGrid.map((hex) => ({
        ...hex,
        type: '<' + hex.type + '>'
      }));

      // Validate ASCII output with wrapped bases
      const ascii = ASCIIRenderer.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
      const expected = '5\'-<A>-<C>\n' +
                       '         \\\n' +
                       '         <G>-<U>\n' +
                       '               \\\n' +
                       '               <A>-<C>\n' +
                       '                     \\\n' +
                       '                     <G>-<U>-3\'';
      expect(ascii).toBe(expected);
    });

    test('renders RNA U-turn pattern (A-C-G-U-A)', () => {
      const sequence = 'ACGUA';
      const bends = [
        { position: 1, angle: 60, direction: 'right' },
        { position: 2, angle: 60, direction: 'right' },
        { position: 3, angle: 60, direction: 'right' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 1, r: 1, type: 'G' },
        { q: 0, r: 2, type: 'U' },
        { q: -1, r: 2, type: 'A' }
      ]);

      // Map to wrapped bases
      const wrappedHexes = hexGrid.map((hex) => ({
        ...hex,
        type: '<' + hex.type + '>'
      }));

      // Validate ASCII output with wrapped bases
      const ascii = ASCIIRenderer.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
      const expected = '5\'-<A>-<C>\n' +
                       '         \\\n' +
                       '         <G>\n' +
                       '         /\n' +
                       '   <A>-3\'>';
      expect(ascii).toBe(expected);
    });

    test('renders long RNA with multiple complex bends', () => {
      const sequence = 'ACGUACGUAC';
      const bends = [
        { position: 2, angle: 60, direction: 'right' },
        { position: 4, angle: 120, direction: 'right' },
        { position: 6, angle: 60, direction: 'left' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 2, r: 0, type: 'G' },
        { q: 2, r: 1, type: 'U' },
        { q: 2, r: 2, type: 'A' },
        { q: 1, r: 2, type: 'C' },
        { q: 0, r: 2, type: 'G' },
        { q: -1, r: 3, type: 'U' },
        { q: -2, r: 4, type: 'A' },
        { q: -3, r: 5, type: 'C' }
      ]);

      // Map to wrapped bases
      const wrappedHexes = hexGrid.map((hex) => ({
        ...hex,
        type: '<' + hex.type + '>'
      }));

      // Validate ASCII output with wrapped bases
      const ascii = ASCIIRenderer.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
      const expected = '5\'-<A>-<C>-<G>\n' +
                       '             \\\n' +
                       '             <U>\n' +
                       '               \\\n' +
                       '       <G>-<C>-<A>\n' +
                       '       /\n' +
                       '     <U>\n' +
                       '     /\n' +
                       '   <A>\n' +
                       '   /\n' +
                       ' <C>-3\'';
      expect(ascii).toBe(expected);
    });

    test('detects overlap in RNA right spiral (5 consecutive 60° right bends)', () => {
      const sequence = 'ACGUACG';
      const bends = [
        { position: 1, angle: 60, direction: 'right' },
        { position: 2, angle: 60, direction: 'right' },
        { position: 3, angle: 60, direction: 'right' },
        { position: 4, angle: 60, direction: 'right' },
        { position: 5, angle: 60, direction: 'right' }
      ];

      expect(() => {
        sequenceToHexGrid(sequence, bends);
      }).toThrow('Overlap detected: element 6 (G) overlaps with element 0 (A) at position (0, 0)');
    });

    test('renders RNA with mixed 60° and 120° bends (A-C-G-U-A-C)', () => {
      const sequence = 'ACGUAC';
      const bends = [
        { position: 1, angle: 60, direction: 'right' },
        { position: 3, angle: 120, direction: 'right' }
      ];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'A' },
        { q: 1, r: 0, type: 'C' },
        { q: 1, r: 1, type: 'G' },
        { q: 1, r: 2, type: 'U' },
        { q: 0, r: 2, type: 'A' },
        { q: -1, r: 2, type: 'C' }
      ]);

      // Map to wrapped bases
      const wrappedHexes = hexGrid.map((hex) => ({
        ...hex,
        type: '<' + hex.type + '>'
      }));

      // Validate ASCII output with wrapped bases
      const ascii = ASCIIRenderer.hexGridToASCII(wrappedHexes, '5\'-', '-3\'');
      const expected = '5\'-<A>-<C>\n' +
                       '         \\\n' +
                       '         <G>\n' +
                       '           \\\n' +
                       '   <C>-3\'>-<U>';
      expect(ascii).toBe(expected);
    });
  });

  // ===========================================================================
  // PROTEIN ERROR HANDLING
  // ===========================================================================

  describe('Protein error handling', () => {
    test('returns error for invalid protein bend position', () => {
      const result = ASCIIRenderer.renderProteinWithBend('STR-EX6', -1, 60);
      expect(result).toBe('ERROR: Invalid bend position');
    });
  });

  // ===========================================================================
  // HELPER FUNCTION UNIT TESTS
  // ===========================================================================

  describe('applyBend helper function', () => {
    test('applies 60° right bend from East (0)', () => {
      expect(applyBend(0, 60, 'right')).toBe(1); // Southeast
    });

    test('applies 120° right bend from East (0)', () => {
      expect(applyBend(0, 120, 'right')).toBe(2); // Southwest
    });

    test('applies 60° left bend from East (0)', () => {
      expect(applyBend(0, 60, 'left')).toBe(5); // Northeast
    });

    test('applies 120° left bend from East (0)', () => {
      expect(applyBend(0, 120, 'left')).toBe(4); // Northwest
    });

    test('wraps around correctly (60° right from Northeast)', () => {
      expect(applyBend(5, 60, 'right')).toBe(0); // Back to East
    });
  });

  describe('moveInDirection helper function', () => {
    test('moves in all 6 directions from origin', () => {
      expect(moveInDirection(0, 0, 0)).toEqual([1, 0]);   // East
      expect(moveInDirection(0, 0, 1)).toEqual([0, 1]);   // Southeast
      expect(moveInDirection(0, 0, 2)).toEqual([-1, 1]);  // Southwest
      expect(moveInDirection(0, 0, 3)).toEqual([-1, 0]);  // West
      expect(moveInDirection(0, 0, 4)).toEqual([0, -1]);  // Northwest
      expect(moveInDirection(0, 0, 5)).toEqual([1, -1]);  // Northeast
    });

    test('moves from non-origin position', () => {
      expect(moveInDirection(5, 3, 0)).toEqual([6, 3]);   // East
      expect(moveInDirection(5, 3, 1)).toEqual([5, 4]);   // Southeast
      expect(moveInDirection(5, 3, 2)).toEqual([4, 4]);   // Southwest
      expect(moveInDirection(5, 3, 3)).toEqual([4, 3]);   // West
      expect(moveInDirection(5, 3, 4)).toEqual([5, 2]);   // Northwest
      expect(moveInDirection(5, 3, 5)).toEqual([6, 2]);   // Northeast
    });
  });

  describe('getNeighbors helper function', () => {
    test('gets neighbors of origin', () => {
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

    test('gets neighbors of non-origin position', () => {
      const neighbors = getNeighbors(3, -2);
      expect(neighbors).toEqual([
        { q: 4, r: -2, direction: 0 },  // East
        { q: 3, r: -1, direction: 1 },  // Southeast
        { q: 2, r: -1, direction: 2 },  // Southwest
        { q: 2, r: -2, direction: 3 },  // West
        { q: 3, r: -3, direction: 4 },  // Northwest
        { q: 4, r: -3, direction: 5 }   // Northeast
      ]);
    });
  });

  describe('hexDistance helper function', () => {
    test('calculates distance for same hex', () => {
      expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    });

    test('calculates distance for adjacent hexes', () => {
      expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    });

    test('calculates distance for diagonal', () => {
      expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 2 })).toBe(4);
    });

    test('calculates distance with negative coordinates', () => {
      expect(hexDistance({ q: -3, r: -2 }, { q: 1, r: 4 })).toBe(10);
    });

    test('is symmetric', () => {
      const dist1 = hexDistance({ q: 1, r: 2 }, { q: 5, r: 7 });
      const dist2 = hexDistance({ q: 5, r: 7 }, { q: 1, r: 2 });
      expect(dist1).toBe(dist2);
    });
  });

});

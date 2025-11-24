import { describe, test, expect } from '@jest/globals';
import { sequenceToHexGrid, dnaToHexGrid, applyBend, moveInDirection, getNeighbors, hexManhattanDistance, hexEuclideanDistance } from './core/hex-layout.js';
import ASCIIRenderer from './renderers/ascii-renderer.js';

describe('Unified Molecular Rendering Tests', () => {

  // ===========================================================================
  // DNA RENDERING (3 tests) - Unique to original tests
  // ===========================================================================

  describe('DNA rendering', () => {
    // INPUT: DNA top strand 'ACGT', bottom strand 'TGCA'
    // EXPECTED: ASCII output with 5'/3' markers and colon spacing between strands
    // WHY: Validates basic DNA rendering with proper directional markers
    test('renders simple DNA structure with hex grid layout', () => {
      const result = ASCIIRenderer.renderDNA('ACGT', 'TGCA');
      // Uses hex grid rendering with vertical colon spacing between strands
      expect(result).toContain('5\'-<A>-<C>-<G>-<T>-3\'');
      expect(result).toContain('3\'-<T>-<G>-<C>-<A>-5\'');
      expect(result).toContain(':');  // Vertical spacing between strands
    });

    // INPUT: DNA strands of different lengths (3 vs 4)
    // EXPECTED: Throws error mentioning 'same length'
    // WHY: DNA strands must be equal length for valid double helix
    test('throws error for mismatched DNA lengths', () => {
      expect(() => {
        ASCIIRenderer.renderDNA('ACG', 'TGCA');
      }).toThrow('same length');
    });

    // INPUT: Single base pair A-T
    // EXPECTED: Renders with 5'/3' markers and colon spacing
    // WHY: Edge case - minimal valid DNA structure
    test('renders single DNA base pair', () => {
      const result = ASCIIRenderer.renderDNA('A', 'T');
      // Single base pair with hex grid layout
      expect(result).toContain('5\'-<A>-3\'');
      expect(result).toContain('3\'-<T>-5\'');
      expect(result).toContain(':');  // Vertical spacing
    });
  });

  // ===========================================================================
  // DNA WITH BENDS - Hex positioning tests
  // ===========================================================================

  describe('DNA with bends (hex positioning)', () => {
    // INPUT: Valid ACGT/TGCA and invalid ACGT/ACGT pairs
    // EXPECTED: Valid pairs pass, non-complementary throws error
    // WHY: DNA requires Watson-Crick base pairing (A-T, C-G)
    test('validates complementary base pairs', () => {
      // Valid pairs should work
      expect(() => {
        dnaToHexGrid('ACGT', 'TGCA', []);
      }).not.toThrow();

      // Non-complementary should throw
      expect(() => {
        dnaToHexGrid('ACGT', 'ACGT', []);
      }).toThrow('Non-complementary base pair at position 0: A-A (expected A-T)');
    });

    // INPUT: DNA with invalid base 'X'
    // EXPECTED: Throws error identifying invalid base and position
    // WHY: Only A, C, G, T are valid DNA bases
    test('rejects invalid bases', () => {
      expect(() => {
        dnaToHexGrid('ACXGT', 'TGXCA', []);
      }).toThrow('Invalid base \'X\' at position 2 in top strand');
    });

    // INPUT: DNA 'ACGT'/'TGCA' with no bends
    // EXPECTED: Top strand at r=0, bottom at r=2, both going East
    // WHY: Straight DNA baseline for hex grid positioning
    test('positions straight DNA correctly', () => {
      const result = dnaToHexGrid('ACGT', 'TGCA', []);

      // Top strand starts at (-1, 0) and moves East
      expect(result.topHexes).toEqual([
        { q: -1, r: 0, type: 'A' },
        { q: 0, r: 0, type: 'C' },
        { q: 1, r: 0, type: 'G' },
        { q: 2, r: 0, type: 'T' }
      ]);

      // Bottom strand starts at (-2, 2) and moves East
      expect(result.bottomHexes).toEqual([
        { q: -2, r: 2, type: 'T' },
        { q: -1, r: 2, type: 'G' },
        { q: 0, r: 2, type: 'C' },
        { q: 1, r: 2, type: 'A' }
      ]);
    });

    // INPUT: DNA with 60° right bend at position 2
    // EXPECTED: Top strand skips hexes around bend, bottom follows normal path
    // WHY: Outer strand stretches on right bends; geometry must be consistent
    test('positions DNA with 60° right bend correctly', () => {
      const result = dnaToHexGrid('ACGTACG', 'TGCATGC', [{ position: 2, angle: 60, direction: 'right' }]);

      // Top strand (outer): stretches with 2 skips around bend
      expect(result.topHexes).toEqual([
        { q: -1, r: 0, type: 'A' },
        { q: 0, r: 0, type: 'C' },
        { q: 1, r: 0, type: 'G' },
        { q: 3, r: 0, type: 'T' },  // Skip (2,0)
        { q: 3, r: 2, type: 'A' },  // Skip (3,1)
        { q: 3, r: 3, type: 'C' },
        { q: 3, r: 4, type: 'G' }
      ]);

      // Bottom strand (inner): normal 60° bend
      expect(result.bottomHexes).toEqual([
        { q: -2, r: 2, type: 'T' },
        { q: -1, r: 2, type: 'G' },
        { q: 0, r: 2, type: 'C' },
        { q: 1, r: 2, type: 'A' },  // Apex of bend
        { q: 1, r: 3, type: 'T' },
        { q: 1, r: 4, type: 'G' },
        { q: 1, r: 5, type: 'C' }
      ]);
    });

    // INPUT: DNA with 60° left bend at position 2
    // EXPECTED: Top strand follows normal path, bottom strand stretches
    // WHY: Inner strand compresses on left bends; outer stretches
    test('positions DNA with 60° left bend correctly', () => {
      const result = dnaToHexGrid('ACGTACG', 'TGCATGC', [{ position: 2, angle: 60, direction: 'left' }]);

      // Top strand (inner): normal 60° bend
      expect(result.topHexes).toEqual([
        { q: -1, r: 0, type: 'A' },
        { q: 0, r: 0, type: 'C' },
        { q: 1, r: 0, type: 'G' },
        { q: 2, r: 0, type: 'T' },  // Apex of bend
        { q: 3, r: -1, type: 'A' },
        { q: 4, r: -2, type: 'C' },
        { q: 5, r: -3, type: 'G' }
      ]);

      // Bottom strand (outer): stretches with 2 skips around bend
      expect(result.bottomHexes).toEqual([
        { q: -2, r: 2, type: 'T' },
        { q: -1, r: 2, type: 'G' },
        { q: 0, r: 2, type: 'C' },
        { q: 2, r: 2, type: 'A' },  // Skip (1,2)
        { q: 4, r: 0, type: 'T' },  // Skip (3,1)
        { q: 5, r: -1, type: 'G' },
        { q: 6, r: -2, type: 'C' }
      ]);
    });

    // INPUT: DNA with 120° right bend at position 2
    // EXPECTED: Top strand has complex skip pattern at sharp bend
    // WHY: 120° bends require more strand stretching than 60° bends
    test('positions DNA with 120° right bend correctly', () => {
      const result = dnaToHexGrid('ACGTACG', 'TGCATGC', [{ position: 2, angle: 120, direction: 'right' }]);

      // Top strand (outer): complex skip pattern (2 horizontal, 1 SE, then 1 SE + 2 SW)
      expect(result.topHexes).toEqual([
        { q: -1, r: 0, type: 'A' },
        { q: 0, r: 0, type: 'C' },
        { q: 1, r: 0, type: 'G' },
        { q: 3, r: 1, type: 'T' },  // Corner base - only one at the bend
        { q: 1, r: 4, type: 'A' },  // After skip: 1 SE + 2 SW
        { q: 0, r: 5, type: 'C' },
        { q: -1, r: 6, type: 'G' }
      ]);

      // Bottom strand (inner): normal 120° bend
      expect(result.bottomHexes).toEqual([
        { q: -2, r: 2, type: 'T' },
        { q: -1, r: 2, type: 'G' },
        { q: 0, r: 2, type: 'C' },
        { q: 1, r: 2, type: 'A' },  // Apex of bend
        { q: 0, r: 3, type: 'T' },
        { q: -1, r: 4, type: 'G' },
        { q: -2, r: 5, type: 'C' }
      ]);
    });

    test('positions DNA with 120° left bend correctly', () => {
      const result = dnaToHexGrid('ACGTACG', 'TGCATGC', [{ position: 2, angle: 120, direction: 'left' }]);

      // Top strand (inner): normal 120° bend
      expect(result.topHexes).toEqual([
        { q: -1, r: 0, type: 'A' },
        { q: 0, r: 0, type: 'C' },
        { q: 1, r: 0, type: 'G' },
        { q: 2, r: 0, type: 'T' },  // Apex of bend
        { q: 2, r: -1, type: 'A' },
        { q: 2, r: -2, type: 'C' },
        { q: 2, r: -3, type: 'G' }
      ]);

      // Bottom strand (outer): complex skip pattern (2 horizontal, 1 NE, then 1 NE + 2 NW)
      expect(result.bottomHexes).toEqual([
        { q: -2, r: 2, type: 'T' },
        { q: -1, r: 2, type: 'G' },
        { q: 0, r: 2, type: 'C' },
        { q: 3, r: 1, type: 'A' },  // Corner base - only one at the bend
        { q: 4, r: -2, type: 'T' },  // After skip: 1 NE + 2 NW
        { q: 4, r: -3, type: 'G' },
        { q: 4, r: -4, type: 'C' }
      ]);
    });

    test('positions DNA with 60° zigzag pattern (right-left-right)', () => {
      const result = dnaToHexGrid('ACGTACGTAC', 'TGCATGCATG', [
        { position: 2, angle: 60, direction: 'right' },
        { position: 4, angle: 60, direction: 'left' },
        { position: 6, angle: 60, direction: 'right' }
      ]);

      // Verify we have all 10 bases
      expect(result.topHexes.length).toBe(10);
      expect(result.bottomHexes.length).toBe(10);

      // Verify first few bases to ensure zigzag pattern
      expect(result.topHexes[0]).toEqual({ q: -1, r: 0, type: 'A' });
      expect(result.topHexes[1]).toEqual({ q: 0, r: 0, type: 'C' });
      expect(result.topHexes[2]).toEqual({ q: 1, r: 0, type: 'G' });

      expect(result.bottomHexes[0]).toEqual({ q: -2, r: 2, type: 'T' });
      expect(result.bottomHexes[1]).toEqual({ q: -1, r: 2, type: 'G' });
      expect(result.bottomHexes[2]).toEqual({ q: 0, r: 2, type: 'C' });
    });

    test('positions DNA with 120° zigzag pattern (right-left)', () => {
      const result = dnaToHexGrid('ACGTACGTAC', 'TGCATGCATG', [
        { position: 2, angle: 120, direction: 'right' },
        { position: 5, angle: 120, direction: 'left' }
      ]);

      // Verify we have all 10 bases
      expect(result.topHexes.length).toBe(10);
      expect(result.bottomHexes.length).toBe(10);

      // Verify first few bases to ensure zigzag pattern
      expect(result.topHexes[0]).toEqual({ q: -1, r: 0, type: 'A' });
      expect(result.topHexes[1]).toEqual({ q: 0, r: 0, type: 'C' });
      expect(result.topHexes[2]).toEqual({ q: 1, r: 0, type: 'G' });

      expect(result.bottomHexes[0]).toEqual({ q: -2, r: 2, type: 'T' });
      expect(result.bottomHexes[1]).toEqual({ q: -1, r: 2, type: 'G' });
      expect(result.bottomHexes[2]).toEqual({ q: 0, r: 2, type: 'C' });
    });

    test('positions DNA with multiple bends correctly', () => {
      const result = dnaToHexGrid('ACGTACGTAC', 'TGCATGCATG', [
        { position: 2, angle: 60, direction: 'right' },
        { position: 5, angle: 60, direction: 'left' }
      ]);

      expect(result.topHexes.length).toBe(10);
      expect(result.bottomHexes.length).toBe(10);

      // First bases should be in expected positions
      expect(result.topHexes[0]).toEqual({ q: -1, r: 0, type: 'A' });
      expect(result.bottomHexes[0]).toEqual({ q: -2, r: 2, type: 'T' });
    });
  });

  // ===========================================================================
  // DNA WITH BENDS - ASCII RENDERING
  // ===========================================================================

  describe('DNA with bends (ASCII rendering)', () => {
    test('renders straight DNA with both strands', () => {
      const ascii = ASCIIRenderer.renderDNAWithBends('AT', 'TA', []);

      // Should have both strands with gap between them
      expect(ascii).toContain('5\'-<A>-<T>-3\'');
      expect(ascii).toContain('3\'-<T>-<A>-5\'');
    });

    test('renders DNA with 60° right bend', () => {
      const ascii = ASCIIRenderer.renderDNAWithBends('ACGTACG', 'TGCATGC', [
        { position: 2, angle: 60, direction: 'right' }
      ]);

      // Should have both strands
      expect(ascii).toContain('5\'-');
      expect(ascii).toContain('3\'-');
      expect(ascii).toContain('-3\'');
      expect(ascii).toContain('-5\'');

      // Should contain backslashes for southeast bends
      expect(ascii).toContain('\\');
    });

    test('renders DNA with 60° left bend', () => {
      const ascii = ASCIIRenderer.renderDNAWithBends('ACGTACG', 'TGCATGC', [
        { position: 2, angle: 60, direction: 'left' }
      ]);

      // Should have both strands
      expect(ascii).toContain('5\'-');
      expect(ascii).toContain('3\'-');

      // Should contain forward slashes for northeast bends
      expect(ascii).toContain('/');
    });

    test('returns error for non-complementary bases', () => {
      const ascii = ASCIIRenderer.renderDNAWithBends('ACGT', 'ACGT', []);
      expect(ascii).toContain('ERROR');
      expect(ascii).toContain('complementary');
    });

    test('returns error for invalid bases', () => {
      const ascii = ASCIIRenderer.renderDNAWithBends('ACXGT', 'TGXCA', []);
      expect(ascii).toContain('ERROR');
      expect(ascii).toContain('Invalid base');
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
      const result = ASCIIRenderer.renderProtein('STR-L60-FLX-R60');
      expect(result).toBe('N-STR-L60-FLX-R60-C');
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
      const sequence = 'STR-L60-FLX-R60';
      const bends = [{ position: 1, angle: 60, direction: 'right' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'STR' },
        { q: 1, r: 0, type: 'L60' },
        { q: 1, r: 1, type: 'FLX' },
        { q: 1, r: 2, type: 'R60' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, 'N-', '-C');
      const expected = 'N-STR-L60\n' +
                       '        \\\n' +
                       '        FLX\n' +
                       '          \\\n' +
                       '          R60-C';
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
      const sequence = 'STR-L60-FLX-STR';
      const bends = [{ position: 1, angle: 120, direction: 'right' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'STR' },
        { q: 1, r: 0, type: 'L60' },
        { q: 0, r: 1, type: 'FLX' },
        { q: -1, r: 2, type: 'STR' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, 'N-', '-C');
      const expected = 'N-STR-L60\n' +
                       '      /\n' +
                       '    FLX\n' +
                       '    /\n' +
                       '  STR-C';
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
      const sequence = 'STR-L60-FLX-FLX-FLX-FLX-FLX-FLX';
      const bends = [{ position: 1, angle: 120, direction: 'right' }];

      // Validate hex positions
      const hexGrid = sequenceToHexGrid(sequence, bends);
      expect(hexGrid).toEqual([
        { q: 0, r: 0, type: 'STR' },
        { q: 1, r: 0, type: 'L60' },
        { q: 0, r: 1, type: 'FLX' },
        { q: -1, r: 2, type: 'FLX' },
        { q: -2, r: 3, type: 'FLX' },
        { q: -3, r: 4, type: 'FLX' },
        { q: -4, r: 5, type: 'FLX' },
        { q: -5, r: 6, type: 'FLX' }
      ]);

      // Validate ASCII output
      const ascii = ASCIIRenderer.hexGridToASCII(hexGrid, 'N-', '-C');
      const expected = '      N-STR-L60\n' +
                       '            /\n' +
                       '          FLX\n' +
                       '          /\n' +
                       '        FLX\n' +
                       '        /\n' +
                       '      FLX\n' +
                       '      /\n' +
                       '    FLX\n' +
                       '    /\n' +
                       '  FLX\n' +
                       '  /\n' +
                       'FLX-C';
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
      const result = ASCIIRenderer.renderProteinWithBend('STR-L60', -1, 60);
      expect(result).toBe('ERROR: Invalid bend position');
    });
  });

  // ===========================================================================
  // HELPER FUNCTION UNIT TESTS
  // ===========================================================================

  describe('applyBend helper function', () => {
    // INPUT: Direction 0 (East), 60° right bend
    // EXPECTED: Returns direction 1 (Southeast)
    // WHY: Core bend logic - 60° right from E goes SE
    test('applies 60° right bend from East (0)', () => {
      expect(applyBend(0, 60, 'right')).toBe(1); // Southeast
    });

    // INPUT: Direction 0 (East), 120° right bend
    // EXPECTED: Returns direction 2 (Southwest)
    // WHY: Sharp 120° right from E goes SW
    test('applies 120° right bend from East (0)', () => {
      expect(applyBend(0, 120, 'right')).toBe(2); // Southwest
    });

    // INPUT: Direction 0 (East), 60° left bend
    // EXPECTED: Returns direction 5 (Northeast)
    // WHY: 60° left from E goes NE
    test('applies 60° left bend from East (0)', () => {
      expect(applyBend(0, 60, 'left')).toBe(5); // Northeast
    });

    // INPUT: Direction 0 (East), 120° left bend
    // EXPECTED: Returns direction 4 (Northwest)
    // WHY: Sharp 120° left from E goes NW
    test('applies 120° left bend from East (0)', () => {
      expect(applyBend(0, 120, 'left')).toBe(4); // Northwest
    });

    // INPUT: Direction 5 (Northeast), 60° right bend
    // EXPECTED: Returns direction 0 (East) - wraps around
    // WHY: Validates modular arithmetic for direction wrapping
    test('wraps around correctly (60° right from Northeast)', () => {
      expect(applyBend(5, 60, 'right')).toBe(0); // Back to East
    });
  });

  describe('moveInDirection helper function', () => {
    // INPUT: Origin (0,0) and all 6 directions
    // EXPECTED: Correct neighbor coordinates for each direction
    // WHY: Core movement function for hex grid traversal
    test('moves in all 6 directions from origin', () => {
      expect(moveInDirection(0, 0, 0)).toEqual([1, 0]);   // East
      expect(moveInDirection(0, 0, 1)).toEqual([0, 1]);   // Southeast
      expect(moveInDirection(0, 0, 2)).toEqual([-1, 1]);  // Southwest
      expect(moveInDirection(0, 0, 3)).toEqual([-1, 0]);  // West
      expect(moveInDirection(0, 0, 4)).toEqual([0, -1]);  // Northwest
      expect(moveInDirection(0, 0, 5)).toEqual([1, -1]);  // Northeast
    });

    // INPUT: Non-origin position (5,3) and all 6 directions
    // EXPECTED: Neighbors offset correctly from that position
    // WHY: Verifies movement works from any hex, not just origin
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
    // INPUT: Origin hex (0,0)
    // EXPECTED: Array of 6 neighbors with correct coords and directions
    // WHY: Used for adjacency checks and pathfinding
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

  describe('hexManhattanDistance helper function', () => {
    // INPUT: Same hex (0,0) to (0,0)
    // EXPECTED: Returns 0
    // WHY: Distance to self is always zero
    test('calculates distance for same hex', () => {
      expect(hexManhattanDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    });

    // INPUT: Adjacent hexes (0,0) to (1,0)
    // EXPECTED: Returns 1
    // WHY: Adjacent hexes are 1 step apart
    test('calculates distance for adjacent hexes', () => {
      expect(hexManhattanDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    });

    test('calculates distance for diagonal', () => {
      // Manhattan distance: (0,0) to (2,2) = 4 hex steps
      expect(hexManhattanDistance({ q: 0, r: 0 }, { q: 2, r: 2 })).toBe(4);
    });

    test('calculates distance with negative coordinates', () => {
      // (-3,-2) to (1,4) = 10 hex steps
      expect(hexManhattanDistance({ q: -3, r: -2 }, { q: 1, r: 4 })).toBe(10);
    });

    test('is symmetric', () => {
      const dist1 = hexManhattanDistance({ q: 1, r: 2 }, { q: 5, r: 7 });
      const dist2 = hexManhattanDistance({ q: 5, r: 7 }, { q: 1, r: 2 });
      expect(dist1).toBe(dist2);
    });
  });

  describe('hexEuclideanDistance helper function', () => {
    test('calculates distance for same hex', () => {
      expect(hexEuclideanDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    });

    test('calculates distance for adjacent hexes', () => {
      expect(hexEuclideanDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    });

    test('calculates distance for diagonal', () => {
      // Euclidean distance: x = q + r*0.5, y = r * sqrt(3)/2
      // (0,0) -> x=0, y=0; (2,2) -> x=3, y=sqrt(3) ≈ 1.732
      // dist = sqrt(9 + 3) = sqrt(12) ≈ 3.464
      expect(hexEuclideanDistance({ q: 0, r: 0 }, { q: 2, r: 2 })).toBeCloseTo(3.464, 2);
    });

    test('calculates distance with negative coordinates', () => {
      // (-3,-2) -> x=-4, y=-sqrt(3); (1,4) -> x=3, y=2*sqrt(3)
      // dx=7, dy=3*sqrt(3) ≈ 5.196
      // dist = sqrt(49 + 27) = sqrt(76) ≈ 8.718
      expect(hexEuclideanDistance({ q: -3, r: -2 }, { q: 1, r: 4 })).toBeCloseTo(8.718, 2);
    });

    test('is symmetric', () => {
      const dist1 = hexEuclideanDistance({ q: 1, r: 2 }, { q: 5, r: 7 });
      const dist2 = hexEuclideanDistance({ q: 5, r: 7 }, { q: 1, r: 2 });
      expect(dist1).toBe(dist2);
    });
  });

  // ===========================================================================
  // COMPLEX RENDERING
  // ===========================================================================

  describe('Complex rendering', () => {
    // Need to import Complex and Molecule for these tests
    let Complex, Molecule;

    beforeAll(async () => {
      const complexModule = await import('./core/complex.js');
      const moleculeModule = await import('./core/molecule.js');
      Complex = complexModule.Complex;
      Molecule = moleculeModule.Molecule;
    });

    // INPUT: Complex with single protein
    // EXPECTED: Renders protein with N- and -C terminators
    // WHY: Basic complex rendering
    test('renders single protein complex', () => {
      const complex = Complex.fromProtein('STR-SIG-BTA');
      const result = ASCIIRenderer.renderComplex(complex);

      expect(result).toContain('N-');
      expect(result).toContain('-C');
      expect(result).toContain('STR');
      expect(result).toContain('SIG');
      expect(result).toContain('BTA');
    });

    // INPUT: Complex with protein and DNA
    // EXPECTED: Renders both molecules
    // WHY: Complex can contain multiple molecules
    test('renders complex with protein and DNA', () => {
      const complex = new Complex();
      complex.addMolecule(Molecule.createProtein('STR-BTA'), { offset: { q: 0, r: 0 } });
      complex.addMolecule(Molecule.createDNA('AT'), { offset: { q: 0, r: 2 } });

      const result = ASCIIRenderer.renderComplex(complex);

      // Should have protein markers
      expect(result).toContain('N-');
      expect(result).toContain('-C');
      // Should have DNA markers
      expect(result).toContain('5\'-');
      expect(result).toContain('-3\'');
      // Should have DNA bases wrapped in <>
      expect(result).toContain('<A>');
      expect(result).toContain('<T>');
    });

    // INPUT: Complex with bound BTA adjacent to A nucleotide
    // EXPECTED: Shows '+' between the bound pair
    // WHY: Inter-molecular bindings shown with '+'
    test('renders binding indicator between BTx and nucleotide', () => {
      const complex = new Complex();
      const protein = Molecule.createProtein('STR-BTA');
      const dna = Molecule.createDNA('A');

      // Position DNA so A is adjacent to BTA
      // Protein: STR at (0,0), BTA at (1,0)
      // DNA: A at (1,1) - Southeast neighbor of BTA
      complex.addMolecule(protein, { offset: { q: 0, r: 0 } });
      complex.addMolecule(dna, { offset: { q: 1, r: 1 } });

      const result = ASCIIRenderer.renderComplex(complex);

      // Should contain binding indicator
      expect(result).toContain('+');
    });

    // INPUT: Complex with BTA not adjacent to matching nucleotide
    // EXPECTED: No '+' binding indicator
    // WHY: No binding = no indicator
    test('no binding indicator when not adjacent', () => {
      const complex = new Complex();
      const protein = Molecule.createProtein('STR-BTA');
      const dna = Molecule.createDNA('A');

      // Position DNA far away
      complex.addMolecule(protein, { offset: { q: 0, r: 0 } });
      complex.addMolecule(dna, { offset: { q: 10, r: 10 } });

      const result = ASCIIRenderer.renderComplex(complex);

      // Should NOT contain binding indicator
      expect(result).not.toContain('+');
    });

    // INPUT: Complex with ATP molecule
    // EXPECTED: ATP rendered as 3-char code
    // WHY: ATP follows same 3-char convention as other residues
    test('renders ATP as 3-char code', () => {
      const complex = Complex.fromProtein('STR-SIG');
      complex.addMolecule(Molecule.createATP(), { offset: { q: 5, r: 0 } });

      const result = ASCIIRenderer.renderComplex(complex);

      expect(result).toContain('ATP');
      expect(result).not.toContain('[ATP]'); // No brackets
    });

    // INPUT: ATR with adjacent ATP
    // EXPECTED: '+' shown between ATR and ATP
    // WHY: ATR "summons" ATP, bond should be visible
    test('renders ATR-ATP bond with +', () => {
      const complex = Complex.fromProtein('STR-ATR');
      // Place ATP adjacent to ATR (ATR is at position 1, so q=1, r=0)
      // Adjacent hex SE is at (1, 1)
      complex.addMolecule(Molecule.createATP(), { offset: { q: 1, r: 1 } });

      const result = ASCIIRenderer.renderComplex(complex);

      expect(result).toContain('ATR');
      expect(result).toContain('ATP');
      expect(result).toContain('+');
    });

    // INPUT: Complex with showBindings=false
    // EXPECTED: No '+' even with valid binding
    // WHY: Option to disable binding indicators
    test('respects showBindings option', () => {
      const complex = new Complex();
      const protein = Molecule.createProtein('STR-BTA');
      const dna = Molecule.createDNA('A');

      complex.addMolecule(protein, { offset: { q: 0, r: 0 } });
      complex.addMolecule(dna, { offset: { q: 1, r: 1 } });

      const result = ASCIIRenderer.renderComplex(complex, { showBindings: false });

      expect(result).not.toContain('+');
    });
  });

});

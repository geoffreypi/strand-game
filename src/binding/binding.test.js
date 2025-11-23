/**
 * Tests for Binding System
 *
 * Tests protein-DNA binding including:
 * - Pattern extraction from proteins
 * - DNA sequence extraction
 * - Sequence matching
 * - Hex geometry validation
 * - Binding manager functionality
 */

import {
  extractBindingPattern,
  extractDNASequence,
  findSequenceMatches,
  isContiguousBindingPattern,
  getHexNeighbors,
  hexEquals,
  getNeighborDirection,
  isHexLineStraight,
  getProteinDirection,
  getExpectedBindingDirection,
  checkHexGeometry,
  findBindingConfigurations,
  BoundComplex,
  BindingManager
} from './binding.js';

import { vis } from '../test-utils/test-visualizer.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a protein with amino acids at specified hex positions
 * Default: straight line going East from (0, r)
 */
function createProtein(aminoAcidTypes, startQ = 0, startR = -1) {
  const aminoAcids = aminoAcidTypes.map((type, i) => ({
    type,
    position: { q: startQ + i, r: startR }
  }));
  return { aminoAcids };
}

/**
 * Create a DNA molecule with nucleotides at specified hex positions
 * Default: straight line going East from (0, 0) for top strand
 */
function createDNA(topSequence, topStartQ = 0, topR = 0, bottomR = 3) {
  const complement = { 'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C' };

  const topHexes = topSequence.split('').map((type, i) => ({
    type,
    q: topStartQ + i,
    r: topR
  }));

  const bottomSeq = topSequence.split('').map(n => complement[n]).join('');
  const bottomHexes = bottomSeq.split('').map((type, i) => ({
    type,
    q: topStartQ + i,
    r: bottomR
  }));

  return { topHexes, bottomHexes };
}

// ============================================================================
// Hex Utility Tests
// ============================================================================

describe('Hex Utilities', () => {
  describe('getHexNeighbors', () => {
    test('returns 6 neighbors in axial coordinates', () => {
      const neighbors = getHexNeighbors(0, 0);

      expect(neighbors.E).toEqual({ q: 1, r: 0 });
      expect(neighbors.W).toEqual({ q: -1, r: 0 });
      expect(neighbors.NE).toEqual({ q: 1, r: -1 });
      expect(neighbors.NW).toEqual({ q: 0, r: -1 });
      expect(neighbors.SE).toEqual({ q: 0, r: 1 });
      expect(neighbors.SW).toEqual({ q: -1, r: 1 });
    });

    test('works for non-origin positions', () => {
      const neighbors = getHexNeighbors(3, 2);

      expect(neighbors.E).toEqual({ q: 4, r: 2 });
      expect(neighbors.W).toEqual({ q: 2, r: 2 });
      expect(neighbors.NE).toEqual({ q: 4, r: 1 });
      expect(neighbors.NW).toEqual({ q: 3, r: 1 });
      expect(neighbors.SE).toEqual({ q: 3, r: 3 });
      expect(neighbors.SW).toEqual({ q: 2, r: 3 });
    });
  });

  describe('hexEquals', () => {
    test('returns true for equal positions', () => {
      expect(hexEquals({ q: 1, r: 2 }, { q: 1, r: 2 })).toBe(true);
    });

    test('returns false for different positions', () => {
      expect(hexEquals({ q: 1, r: 2 }, { q: 1, r: 3 })).toBe(false);
      expect(hexEquals({ q: 1, r: 2 }, { q: 2, r: 2 })).toBe(false);
    });
  });

  describe('getNeighborDirection', () => {
    test('returns correct direction for each neighbor', () => {
      const from = { q: 0, r: 0 };

      expect(getNeighborDirection(from, { q: 1, r: 0 })).toBe('E');
      expect(getNeighborDirection(from, { q: -1, r: 0 })).toBe('W');
      expect(getNeighborDirection(from, { q: 1, r: -1 })).toBe('NE');
      expect(getNeighborDirection(from, { q: 0, r: -1 })).toBe('NW');
      expect(getNeighborDirection(from, { q: 0, r: 1 })).toBe('SE');
      expect(getNeighborDirection(from, { q: -1, r: 1 })).toBe('SW');
    });

    test('returns null for non-neighbors', () => {
      const from = { q: 0, r: 0 };

      expect(getNeighborDirection(from, { q: 2, r: 0 })).toBeNull();
      expect(getNeighborDirection(from, { q: 0, r: 2 })).toBeNull();
      expect(getNeighborDirection(from, { q: 1, r: 1 })).toBeNull();
    });
  });

  describe('isHexLineStraight', () => {
    test('single position is straight', () => {
      const result = isHexLineStraight([{ q: 0, r: 0 }]);
      expect(result.straight).toBe(true);
    });

    test('two adjacent positions are straight', () => {
      const result = isHexLineStraight([
        { q: 0, r: 0 },
        { q: 1, r: 0 }
      ]);
      expect(result.straight).toBe(true);
      expect(result.direction).toBe('E');
    });

    test('horizontal line going East is straight', () => {
      const result = isHexLineStraight([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
        { q: 3, r: 0 }
      ]);
      expect(result.straight).toBe(true);
      expect(result.direction).toBe('E');
    });

    test('horizontal line going West is straight', () => {
      const result = isHexLineStraight([
        { q: 3, r: 0 },
        { q: 2, r: 0 },
        { q: 1, r: 0 }
      ]);
      expect(result.straight).toBe(true);
      expect(result.direction).toBe('W');
    });

    test('bent line is not straight', () => {
      const result = isHexLineStraight([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 1, r: 1 }  // Turns SE
      ]);
      expect(result.straight).toBe(false);
    });

    test('non-adjacent hexes are not straight', () => {
      const result = isHexLineStraight([
        { q: 0, r: 0 },
        { q: 2, r: 0 }  // Gap
      ]);
      expect(result.straight).toBe(false);
    });
  });

  describe('getProteinDirection', () => {
    test('returns E for eastward protein', () => {
      const positions = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 }
      ];
      expect(getProteinDirection(positions)).toBe('E');
    });

    test('returns W for westward protein', () => {
      const positions = [
        { q: 2, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 0 }
      ];
      expect(getProteinDirection(positions)).toBe('W');
    });

    test('returns null for non-horizontal protein', () => {
      const positions = [
        { q: 0, r: 0 },
        { q: 0, r: 1 }  // Going SE
      ];
      expect(getProteinDirection(positions)).toBeNull();
    });

    test('returns null for single amino acid', () => {
      expect(getProteinDirection([{ q: 0, r: 0 }])).toBeNull();
    });
  });

  describe('getExpectedBindingDirection', () => {
    test('above DNA, going East -> SE', () => {
      expect(getExpectedBindingDirection('E', 'above')).toBe('SE');
    });

    test('above DNA, going West -> SW', () => {
      expect(getExpectedBindingDirection('W', 'above')).toBe('SW');
    });

    test('below DNA, going East -> NE', () => {
      expect(getExpectedBindingDirection('E', 'below')).toBe('NE');
    });

    test('below DNA, going West -> NW', () => {
      expect(getExpectedBindingDirection('W', 'below')).toBe('NW');
    });
  });
});

// ============================================================================
// Pattern Extraction Tests
// ============================================================================

describe('extractBindingPattern', () => {
  test('extracts BTA binding sites', () => {
    const protein = createProtein(['BTA', 'STR', 'BTA']);
    vis.protein('Protein with BTA sites', protein);

    const pattern = extractBindingPattern(protein);

    expect(pattern).toHaveLength(2);
    expect(pattern[0]).toMatchObject({
      position: 0,
      aminoAcid: 'BTA',
      bindsTo: 'A'
    });
    expect(pattern[1]).toMatchObject({
      position: 2,
      aminoAcid: 'BTA',
      bindsTo: 'A'
    });
  });

  test('extracts all BT* types correctly', () => {
    const protein = createProtein(['BTA', 'BTC', 'BTG', 'BTT']);
    vis.protein('All binding types: BTA-BTC-BTG-BTT', protein);

    const pattern = extractBindingPattern(protein);

    expect(pattern).toHaveLength(4);
    expect(pattern.map(p => p.bindsTo)).toEqual(['A', 'C', 'G', 'T']);
  });

  test('returns empty array for protein with no binding amino acids', () => {
    const protein = createProtein(['STR', 'L60', 'FLX']);
    const pattern = extractBindingPattern(protein);

    expect(pattern).toEqual([]);
  });

  test('includes hex positions in pattern', () => {
    const protein = createProtein(['BTA', 'BTC'], 5, 2);
    const pattern = extractBindingPattern(protein);

    expect(pattern[0].hexPosition).toEqual({ q: 5, r: 2 });
    expect(pattern[1].hexPosition).toEqual({ q: 6, r: 2 });
  });
});

// ============================================================================
// DNA Sequence Extraction Tests
// ============================================================================

describe('extractDNASequence', () => {
  test('extracts top strand sequence', () => {
    const dna = createDNA('ACGT');
    vis.dna('DNA: ACGT', dna);

    const sequence = extractDNASequence(dna, 'top');

    expect(sequence).toHaveLength(4);
    expect(sequence.map(s => s.nucleotide)).toEqual(['A', 'C', 'G', 'T']);
  });

  test('extracts bottom strand sequence', () => {
    const dna = createDNA('ACGT');
    const sequence = extractDNASequence(dna, 'bottom');

    expect(sequence).toHaveLength(4);
    expect(sequence.map(s => s.nucleotide)).toEqual(['T', 'G', 'C', 'A']);
  });

  test('includes hex positions', () => {
    const dna = createDNA('ACG', 2, 5);
    const sequence = extractDNASequence(dna, 'top');

    expect(sequence[0].hexPosition).toEqual({ q: 2, r: 5 });
    expect(sequence[1].hexPosition).toEqual({ q: 3, r: 5 });
    expect(sequence[2].hexPosition).toEqual({ q: 4, r: 5 });
  });
});

// ============================================================================
// Sequence Matching Tests
// ============================================================================

describe('findSequenceMatches', () => {
  test('finds exact match at start', () => {
    const protein = createProtein(['BTA', 'BTC', 'BTG']);
    const dna = createDNA('ACGTTT');
    vis.protein('Protein seeking ACG', protein);
    vis.dna('DNA with ACG at start', dna);

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');
    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toHaveLength(1);
    expect(matches[0].dnaStartIndex).toBe(0);
  });

  test('finds match in middle of sequence', () => {
    const protein = createProtein(['BTC', 'BTG', 'BTT']);
    const dna = createDNA('AACGTA');
    vis.protein('Protein seeking CGT', protein);
    vis.dna('DNA with CGT in middle', dna);

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');
    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toHaveLength(1);
    expect(matches[0].dnaStartIndex).toBe(2);
  });

  test('finds multiple matches', () => {
    const protein = createProtein(['BTA', 'BTC']);
    const dna = createDNA('ACACAC');
    vis.protein('Protein seeking AC', protein);
    vis.dna('DNA with repeating AC pattern', dna);

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');
    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toHaveLength(3);
    expect(matches.map(m => m.dnaStartIndex)).toEqual([0, 2, 4]);
  });

  test('returns empty array when no match', () => {
    const protein = createProtein(['BTA', 'BTA', 'BTA']);
    const dna = createDNA('CCCCCC');

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');
    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toEqual([]);
  });

  test('BTT matches both T and U', () => {
    const protein = createProtein(['BTT']);
    const pattern = extractBindingPattern(protein);

    const rna = {
      topHexes: [{ type: 'U', q: 0, r: 0 }],
      bottomHexes: []
    };
    const sequence = extractDNASequence(rna, 'top');
    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toHaveLength(1);
  });
});

// ============================================================================
// Contiguous Pattern Tests
// ============================================================================

describe('isContiguousBindingPattern', () => {
  test('returns true for contiguous binding sites', () => {
    const protein = createProtein(['BTA', 'BTC', 'BTG']);
    const pattern = extractBindingPattern(protein);

    expect(isContiguousBindingPattern(pattern)).toBe(true);
  });

  test('returns false for non-contiguous binding sites', () => {
    const protein = createProtein(['BTA', 'STR', 'BTC']);
    const pattern = extractBindingPattern(protein);

    expect(isContiguousBindingPattern(pattern)).toBe(false);
  });

  test('returns true for single binding site', () => {
    const protein = createProtein(['STR', 'BTA', 'STR']);
    const pattern = extractBindingPattern(protein);

    expect(isContiguousBindingPattern(pattern)).toBe(true);
  });

  test('returns true for empty pattern', () => {
    expect(isContiguousBindingPattern([])).toBe(true);
  });
});

// ============================================================================
// Hex Geometry Tests
// ============================================================================

describe('checkHexGeometry', () => {
  test('valid binding: protein above DNA, going East, SE connections', () => {
    // Protein at r=-1, DNA at r=0
    // Protein: BTA at (0,-1), BTC at (1,-1), BTG at (2,-1)
    // DNA:     A at (0,0),    C at (1,0),    G at (2,0)
    // From (0,-1) to (0,0) is SE
    const protein = createProtein(['BTA', 'BTC', 'BTG'], 0, -1);
    const dna = createDNA('ACG', 0, 0);

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');

    const result = checkHexGeometry(pattern, sequence, 0);

    expect(result.valid).toBe(true);
    expect(result.bindingDirection).toBe('SE');
    expect(result.relativePosition).toBe('above');
    expect(result.proteinDirection).toBe('E');
  });

  test('valid binding: protein above DNA, going West, SW connections', () => {
    // Protein going West: at (2,-1), (1,-1), (0,-1)
    // DNA: A at (1,0), C at (0,0), ... but we need SW connection
    // From (2,-1) SW neighbor is (1,0)
    const protein = {
      aminoAcids: [
        { type: 'BTA', position: { q: 2, r: -1 } },
        { type: 'BTC', position: { q: 1, r: -1 } }
      ]
    };
    const dna = {
      topHexes: [
        { type: 'A', q: 1, r: 0 },
        { type: 'C', q: 0, r: 0 }
      ],
      bottomHexes: []
    };

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');

    const result = checkHexGeometry(pattern, sequence, 0);

    expect(result.valid).toBe(true);
    expect(result.bindingDirection).toBe('SW');
    expect(result.relativePosition).toBe('above');
    expect(result.proteinDirection).toBe('W');
  });

  test('invalid: protein not adjacent to DNA', () => {
    // Protein at r=-2, DNA at r=0 (gap of 1 row)
    const protein = createProtein(['BTA', 'BTC'], 0, -2);
    const dna = createDNA('AC', 0, 0);

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');

    const result = checkHexGeometry(pattern, sequence, 0);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not adjacent');
  });

  test('invalid: non-contiguous binding sites', () => {
    const protein = createProtein(['BTA', 'STR', 'BTC'], 0, -1);
    const dna = createDNA('AC', 0, 0);

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');

    const result = checkHexGeometry(pattern, sequence, 0);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not contiguous');
  });

  test('invalid: wrong binding direction for protein orientation', () => {
    // Protein going East but positioned for SW binding
    // This creates a mismatch
    const protein = {
      aminoAcids: [
        { type: 'BTA', position: { q: 1, r: -1 } },  // Going East
        { type: 'BTC', position: { q: 2, r: -1 } }
      ]
    };
    const dna = {
      topHexes: [
        { type: 'A', q: 0, r: 0 },  // SW of (1,-1)
        { type: 'C', q: 1, r: 0 }   // SE of (2,-1) - inconsistent!
      ],
      bottomHexes: []
    };

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');

    const result = checkHexGeometry(pattern, sequence, 0);

    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Full Binding Configuration Tests
// ============================================================================

describe('findBindingConfigurations', () => {
  test('finds valid configuration with correct geometry', () => {
    const protein = createProtein(['BTA', 'BTC', 'BTG'], 0, -1);
    const dna = createDNA('ACGTTT', 0, 0);

    vis.protein('Protein at r=-1 seeking ACG', protein);
    vis.dna('DNA at r=0', dna);

    const configs = findBindingConfigurations(protein, dna);

    expect(configs).toHaveLength(1);
    expect(configs[0].strand).toBe('top');
    expect(configs[0].dnaStartIndex).toBe(0);
    expect(configs[0].bindingDirection).toBe('SE');
    expect(configs[0].bindingStrength).toBe(3);
  });

  test('returns empty for sequence match but wrong geometry', () => {
    // Protein matches sequence but is not adjacent
    const protein = createProtein(['BTA', 'BTC'], 0, -5);  // Far from DNA
    const dna = createDNA('AC', 0, 0);

    const configs = findBindingConfigurations(protein, dna);

    expect(configs).toEqual([]);
  });

  test('returns empty for non-contiguous binding sites', () => {
    const protein = createProtein(['BTA', 'STR', 'BTC'], 0, -1);
    const dna = createDNA('AC', 0, 0);

    const configs = findBindingConfigurations(protein, dna);

    expect(configs).toEqual([]);
  });

  test('returns empty for protein without binding amino acids', () => {
    const protein = createProtein(['STR', 'L60', 'FLX'], 0, -1);
    const dna = createDNA('ACGT', 0, 0);

    const configs = findBindingConfigurations(protein, dna);

    expect(configs).toEqual([]);
  });
});

// ============================================================================
// BoundComplex Tests
// ============================================================================

describe('BoundComplex', () => {
  test('stores protein, DNA, and configuration', () => {
    const protein = createProtein(['BTA']);
    const dna = createDNA('A');
    const config = {
      strand: 'top',
      dnaStartIndex: 0,
      bindingStrength: 1,
      bindingDirection: 'SE',
      relativePosition: 'above'
    };

    const complex = new BoundComplex(protein, dna, config);

    expect(complex.protein).toBe(protein);
    expect(complex.dna).toBe(dna);
    expect(complex.configuration).toBe(config);
  });

  test('provides accessors', () => {
    const config = {
      bindingStrength: 5,
      strand: 'bottom',
      dnaStartIndex: 3,
      bindingDirection: 'NE',
      relativePosition: 'below'
    };
    const complex = new BoundComplex({}, {}, config);

    expect(complex.strength).toBe(5);
    expect(complex.strand).toBe('bottom');
    expect(complex.dnaPosition).toBe(3);
    expect(complex.bindingDirection).toBe('NE');
    expect(complex.relativePosition).toBe('below');
  });

  test('records binding timestamp', () => {
    const before = Date.now();
    const complex = new BoundComplex({}, {}, {});
    const after = Date.now();

    expect(complex.boundAt).toBeGreaterThanOrEqual(before);
    expect(complex.boundAt).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// BindingManager Tests
// ============================================================================

describe('BindingManager', () => {
  let manager;

  beforeEach(() => {
    manager = new BindingManager();
  });

  describe('registration', () => {
    test('addProtein returns unique id', () => {
      const protein1 = createProtein(['BTA']);
      const protein2 = createProtein(['BTC']);

      const id1 = manager.addProtein(protein1);
      const id2 = manager.addProtein(protein2);

      expect(id1).not.toBe(id2);
    });

    test('addDNA returns unique id', () => {
      const dna1 = createDNA('ACGT');
      const dna2 = createDNA('AAAA');

      const id1 = manager.addDNA(dna1);
      const id2 = manager.addDNA(dna2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('checkForBindings', () => {
    test('creates binding when geometry is correct', () => {
      const protein = createProtein(['BTA', 'BTC'], 0, -1);
      const dna = createDNA('ACGT', 0, 0);

      manager.addProtein(protein);
      manager.addDNA(dna);

      const newBindings = manager.checkForBindings();

      expect(newBindings).toHaveLength(1);
      expect(newBindings[0].configuration.bindingDirection).toBe('SE');
    });

    test('returns empty when geometry is wrong', () => {
      const protein = createProtein(['BTA', 'BTC'], 0, -5);  // Too far
      const dna = createDNA('AC', 0, 0);

      manager.addProtein(protein);
      manager.addDNA(dna);

      const newBindings = manager.checkForBindings();

      expect(newBindings).toEqual([]);
    });

    test('does not rebind already bound protein', () => {
      const protein = createProtein(['BTA', 'BTC'], 0, -1);
      const dna = createDNA('ACAC', 0, 0);

      manager.addProtein(protein);
      manager.addDNA(dna);

      manager.checkForBindings();
      const secondCheck = manager.checkForBindings();

      expect(secondCheck).toEqual([]);
    });
  });

  describe('isProteinBound', () => {
    test('returns false for unbound protein', () => {
      const protein = createProtein(['BTA']);
      const id = manager.addProtein(protein);

      expect(manager.isProteinBound(id)).toBe(false);
    });

    test('returns true for bound protein', () => {
      // Need at least 2 amino acids to determine protein direction
      const protein = createProtein(['BTA', 'BTC'], 0, -1);
      const dna = createDNA('AC', 0, 0);

      const proteinId = manager.addProtein(protein);
      manager.addDNA(dna);
      manager.checkForBindings();

      expect(manager.isProteinBound(proteinId)).toBe(true);
    });
  });

  describe('unbind', () => {
    test('unbinds a bound protein', () => {
      // Need at least 2 amino acids to determine protein direction
      const protein = createProtein(['BTA', 'BTC'], 0, -1);
      const dna = createDNA('AC', 0, 0);

      const proteinId = manager.addProtein(protein);
      manager.addDNA(dna);
      manager.checkForBindings();

      expect(manager.isProteinBound(proteinId)).toBe(true);

      manager.unbind(proteinId);

      expect(manager.isProteinBound(proteinId)).toBe(false);
    });

    test('removes from bound complexes', () => {
      // Need at least 2 amino acids to determine protein direction
      const protein = createProtein(['BTA', 'BTC'], 0, -1);
      const dna = createDNA('AC', 0, 0);

      const proteinId = manager.addProtein(protein);
      manager.addDNA(dna);
      manager.checkForBindings();

      expect(manager.getBoundComplexes()).toHaveLength(1);

      manager.unbind(proteinId);

      expect(manager.getBoundComplexes()).toHaveLength(0);
    });
  });

  describe('getBoundComplexes', () => {
    test('returns empty array initially', () => {
      expect(manager.getBoundComplexes()).toEqual([]);
    });

    test('returns bound complex after successful binding', () => {
      // Need at least 2 amino acids to determine protein direction
      const protein = createProtein(['BTA', 'BTC'], 0, -1);
      const dna = createDNA('ACGT', 0, 0);

      manager.addProtein(protein);
      manager.addDNA(dna);
      manager.checkForBindings();

      const complexes = manager.getBoundComplexes();
      expect(complexes).toHaveLength(1);
      expect(complexes[0].bindingDirection).toBe('SE');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Binding System Integration', () => {
  test('full workflow: protein binds with correct SE direction', () => {
    // Protein above DNA, going East
    const protein = createProtein(['BTA', 'BTC', 'BTG', 'BTT'], 2, -1);
    const dna = createDNA('AAACGTTT', 0, 0);

    vis.protein('Binding protein at r=-1', protein);
    vis.dna('Target DNA at r=0', dna);

    const manager = new BindingManager();
    manager.addProtein(protein);
    manager.addDNA(dna);

    const newBindings = manager.checkForBindings();

    expect(newBindings).toHaveLength(1);
    expect(newBindings[0].configuration.dnaStartIndex).toBe(2);
    expect(newBindings[0].configuration.bindingDirection).toBe('SE');
    expect(newBindings[0].configuration.relativePosition).toBe('above');

    vis.note(`Bound with direction: ${newBindings[0].configuration.bindingDirection}`);
  });

  test('visualization shows correct binding character', () => {
    const protein = createProtein(['BTA', 'BTC'], 0, -1);
    const dna = createDNA('AC', 0, 0);

    const configs = findBindingConfigurations(protein, dna);

    expect(configs[0].bindingDirection).toBe('SE');

    // SE binding should be visualized with \
    vis.ascii('Binding visualization',
      'N-BTA-BTC-C\n' +
      '   \\   \\\n' +
      '5\'-<A>-<C>-3\''
    );
  });
});

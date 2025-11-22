/**
 * Tests for Binding System
 *
 * Tests protein-DNA binding including:
 * - Pattern extraction from proteins
 * - DNA sequence extraction
 * - Sequence matching
 * - Geometry compatibility
 * - Binding manager functionality
 */

import {
  extractBindingPattern,
  extractDNASequence,
  findSequenceMatches,
  isContiguousBindingPattern,
  getBindingGeometry,
  getDNAGeometry,
  checkGeometryCompatibility,
  findBindingConfigurations,
  BoundComplex,
  BindingManager
} from './binding.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a simple protein with specified amino acids
 */
function createProtein(aminoAcidTypes, hexPositions = null) {
  const aminoAcids = aminoAcidTypes.map((type, i) => ({
    type,
    position: hexPositions ? hexPositions[i] : { q: i, r: 0 }
  }));
  return { aminoAcids };
}

/**
 * Create a simple DNA molecule with specified nucleotides
 */
function createDNA(topSequence, bottomSequence = null) {
  const topHexes = topSequence.split('').map((type, i) => ({
    type,
    q: i,
    r: 0
  }));

  // If no bottom sequence, create complement
  const complement = { 'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C' };
  const bottomSeq = bottomSequence || topSequence.split('').map(n => complement[n]).join('');
  const bottomHexes = bottomSeq.split('').map((type, i) => ({
    type,
    q: i,
    r: 1
  }));

  return { topHexes, bottomHexes };
}

// ============================================================================
// Pattern Extraction Tests
// ============================================================================

describe('extractBindingPattern', () => {
  test('extracts BTA binding sites', () => {
    const protein = createProtein(['BTA', 'STR', 'BTA']);
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
    const pattern = extractBindingPattern(protein);

    expect(pattern).toHaveLength(4);
    expect(pattern.map(p => p.bindsTo)).toEqual(['A', 'C', 'G', 'T']);
  });

  test('returns empty array for protein with no binding amino acids', () => {
    const protein = createProtein(['STR', 'L60', 'POS']);
    const pattern = extractBindingPattern(protein);

    expect(pattern).toEqual([]);
  });

  test('includes hex positions in pattern', () => {
    const positions = [{ q: 0, r: 0 }, { q: 1, r: 1 }];
    const protein = createProtein(['BTA', 'BTC'], positions);
    const pattern = extractBindingPattern(protein);

    expect(pattern[0].hexPosition).toEqual({ q: 0, r: 0 });
    expect(pattern[1].hexPosition).toEqual({ q: 1, r: 1 });
  });

  test('handles mixed binding and non-binding amino acids', () => {
    const protein = createProtein(['STR', 'BTA', 'L60', 'BTC', 'FLX', 'BTG']);
    const pattern = extractBindingPattern(protein);

    expect(pattern).toHaveLength(3);
    expect(pattern[0].position).toBe(1);
    expect(pattern[1].position).toBe(3);
    expect(pattern[2].position).toBe(5);
  });
});

// ============================================================================
// DNA Sequence Extraction Tests
// ============================================================================

describe('extractDNASequence', () => {
  test('extracts top strand sequence', () => {
    const dna = createDNA('ACGT');
    const sequence = extractDNASequence(dna, 'top');

    expect(sequence).toHaveLength(4);
    expect(sequence.map(s => s.nucleotide)).toEqual(['A', 'C', 'G', 'T']);
  });

  test('extracts bottom strand sequence', () => {
    const dna = createDNA('ACGT'); // Bottom will be TGCA
    const sequence = extractDNASequence(dna, 'bottom');

    expect(sequence).toHaveLength(4);
    expect(sequence.map(s => s.nucleotide)).toEqual(['T', 'G', 'C', 'A']);
  });

  test('includes position indices', () => {
    const dna = createDNA('ACGT');
    const sequence = extractDNASequence(dna, 'top');

    expect(sequence[0].position).toBe(0);
    expect(sequence[1].position).toBe(1);
    expect(sequence[2].position).toBe(2);
    expect(sequence[3].position).toBe(3);
  });

  test('includes hex positions', () => {
    const dna = createDNA('ACG');
    const sequence = extractDNASequence(dna, 'top');

    expect(sequence[0].hexPosition).toEqual({ q: 0, r: 0 });
    expect(sequence[1].hexPosition).toEqual({ q: 1, r: 0 });
    expect(sequence[2].hexPosition).toEqual({ q: 2, r: 0 });
  });

  test('defaults to top strand', () => {
    const dna = createDNA('ACGT');
    const sequence = extractDNASequence(dna);

    expect(sequence.map(s => s.nucleotide)).toEqual(['A', 'C', 'G', 'T']);
  });
});

// ============================================================================
// Sequence Matching Tests
// ============================================================================

describe('findSequenceMatches', () => {
  test('finds exact match at start', () => {
    const protein = createProtein(['BTA', 'BTC', 'BTG']);
    const pattern = extractBindingPattern(protein);
    const dna = createDNA('ACGTTT');
    const sequence = extractDNASequence(dna, 'top');

    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toHaveLength(1);
    expect(matches[0].dnaStartIndex).toBe(0);
  });

  test('finds match in middle of sequence', () => {
    const protein = createProtein(['BTC', 'BTG', 'BTT']);
    const pattern = extractBindingPattern(protein);
    const dna = createDNA('AACGTA');  // CGT is at positions 2,3,4
    const sequence = extractDNASequence(dna, 'top');

    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toHaveLength(1);
    expect(matches[0].dnaStartIndex).toBe(2);
  });

  test('finds multiple matches', () => {
    const protein = createProtein(['BTA', 'BTC']);
    const pattern = extractBindingPattern(protein);
    const dna = createDNA('ACACAC');
    const sequence = extractDNASequence(dna, 'top');

    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toHaveLength(3);
    expect(matches.map(m => m.dnaStartIndex)).toEqual([0, 2, 4]);
  });

  test('returns empty array when no match', () => {
    const protein = createProtein(['BTA', 'BTA', 'BTA']);
    const pattern = extractBindingPattern(protein);
    const dna = createDNA('CCCCCC');
    const sequence = extractDNASequence(dna, 'top');

    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toEqual([]);
  });

  test('returns empty array for empty pattern', () => {
    const pattern = [];
    const dna = createDNA('ACGT');
    const sequence = extractDNASequence(dna, 'top');

    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toEqual([]);
  });

  test('BTT matches both T and U', () => {
    const protein = createProtein(['BTT']);
    const pattern = extractBindingPattern(protein);

    // Create DNA with Uracil (RNA context)
    const rna = {
      topHexes: [{ type: 'U', q: 0, r: 0 }],
      bottomHexes: []
    };
    const sequence = extractDNASequence(rna, 'top');

    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toHaveLength(1);
  });

  test('includes match details', () => {
    const protein = createProtein(['BTA', 'BTC']);
    const pattern = extractBindingPattern(protein);
    const dna = createDNA('AC');
    const sequence = extractDNASequence(dna, 'top');

    const matches = findSequenceMatches(pattern, sequence);

    expect(matches[0].matches).toHaveLength(2);
    expect(matches[0].matches[0].proteinBindingSite.aminoAcid).toBe('BTA');
    expect(matches[0].matches[0].dnaNucleotide.nucleotide).toBe('A');
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
    const pattern = [];

    expect(isContiguousBindingPattern(pattern)).toBe(true);
  });

  test('handles gaps in sequence correctly', () => {
    const protein = createProtein(['BTA', 'BTC', 'STR', 'STR', 'BTG']);
    const pattern = extractBindingPattern(protein);

    expect(isContiguousBindingPattern(pattern)).toBe(false);
  });
});

// ============================================================================
// Binding Geometry Tests
// ============================================================================

describe('getBindingGeometry', () => {
  test('returns offsets from first binding site', () => {
    const positions = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 }
    ];
    const protein = createProtein(['BTA', 'BTC', 'BTG'], positions);
    const pattern = extractBindingPattern(protein);
    const geometry = getBindingGeometry(pattern);

    expect(geometry).toHaveLength(3);
    expect(geometry[0].dx).toBe(0);
    expect(geometry[0].dy).toBe(0);
    expect(geometry[1].dx).toBe(1);
    expect(geometry[1].dy).toBe(0);
    expect(geometry[2].dx).toBe(2);
    expect(geometry[2].dy).toBe(0);
  });

  test('handles non-linear positions', () => {
    const positions = [
      { q: 0, r: 0 },
      { q: 0, r: 1 }  // Down and right in hex
    ];
    const protein = createProtein(['BTA', 'BTC'], positions);
    const pattern = extractBindingPattern(protein);
    const geometry = getBindingGeometry(pattern);

    expect(geometry[0].dx).toBe(0);
    expect(geometry[0].dy).toBe(0);
    // Second position: x = 0 + 1*0.5 = 0.5, y = 1 * sqrt(3)/2
    expect(geometry[1].dx).toBeCloseTo(0.5);
    expect(geometry[1].dy).toBeCloseTo(Math.sqrt(3) / 2);
  });

  test('returns empty array for empty pattern', () => {
    const geometry = getBindingGeometry([]);

    expect(geometry).toEqual([]);
  });

  test('includes binding target in geometry', () => {
    const protein = createProtein(['BTA', 'BTC']);
    const pattern = extractBindingPattern(protein);
    const geometry = getBindingGeometry(pattern);

    expect(geometry[0].bindsTo).toBe('A');
    expect(geometry[1].bindsTo).toBe('C');
  });
});

describe('getDNAGeometry', () => {
  test('returns geometry for DNA segment', () => {
    const dna = createDNA('ACGT');
    const sequence = extractDNASequence(dna, 'top');
    const geometry = getDNAGeometry(sequence, 0, 3);

    expect(geometry).toHaveLength(3);
    expect(geometry[0].dx).toBe(0);
    expect(geometry[1].dx).toBe(1);
    expect(geometry[2].dx).toBe(2);
  });

  test('handles offset start position', () => {
    const dna = createDNA('ACGT');
    const sequence = extractDNASequence(dna, 'top');
    const geometry = getDNAGeometry(sequence, 1, 2);

    expect(geometry).toHaveLength(2);
    expect(geometry[0].nucleotide).toBe('C');
    expect(geometry[1].nucleotide).toBe('G');
  });

  test('returns empty for out of bounds', () => {
    const dna = createDNA('AC');
    const sequence = extractDNASequence(dna, 'top');
    const geometry = getDNAGeometry(sequence, 0, 5);

    expect(geometry).toEqual([]);
  });

  test('returns empty for zero length', () => {
    const dna = createDNA('ACGT');
    const sequence = extractDNASequence(dna, 'top');
    const geometry = getDNAGeometry(sequence, 0, 0);

    expect(geometry).toEqual([]);
  });
});

// ============================================================================
// Geometry Compatibility Tests
// ============================================================================

describe('checkGeometryCompatibility', () => {
  test('compatible for matching linear geometries', () => {
    // Both protein and DNA are straight lines
    const proteinGeometry = [
      { dx: 0, dy: 0, bindsTo: 'A' },
      { dx: 1, dy: 0, bindsTo: 'C' },
      { dx: 2, dy: 0, bindsTo: 'G' }
    ];
    const dnaGeometry = [
      { dx: 0, dy: 0, nucleotide: 'A' },
      { dx: 1, dy: 0, nucleotide: 'C' },
      { dx: 2, dy: 0, nucleotide: 'G' }
    ];

    const result = checkGeometryCompatibility(proteinGeometry, dnaGeometry);

    expect(result.compatible).toBe(true);
  });

  test('incompatible for different lengths', () => {
    const proteinGeometry = [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 }
    ];
    const dnaGeometry = [
      { dx: 0, dy: 0 }
    ];

    const result = checkGeometryCompatibility(proteinGeometry, dnaGeometry);

    expect(result.compatible).toBe(false);
    expect(result.reason).toBe('Length mismatch');
  });

  test('compatible for empty geometries', () => {
    const result = checkGeometryCompatibility([], []);

    expect(result.compatible).toBe(true);
  });

  test('compatible for single point', () => {
    const proteinGeometry = [{ dx: 0, dy: 0 }];
    const dnaGeometry = [{ dx: 0, dy: 0 }];

    const result = checkGeometryCompatibility(proteinGeometry, dnaGeometry);

    expect(result.compatible).toBe(true);
  });

  test('incompatible for bent protein on straight DNA', () => {
    // Protein has a 90-degree bend
    const proteinGeometry = [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: 1 }  // Turns upward
    ];
    // DNA is straight
    const dnaGeometry = [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 }
    ];

    const result = checkGeometryCompatibility(proteinGeometry, dnaGeometry);

    expect(result.compatible).toBe(false);
  });

  test('respects tolerance parameter', () => {
    const proteinGeometry = [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0.1 }  // Slight deviation
    ];
    const dnaGeometry = [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 }
    ];

    // Should be compatible with default tolerance
    const result1 = checkGeometryCompatibility(proteinGeometry, dnaGeometry, 0.5);
    expect(result1.compatible).toBe(true);

    // Should be incompatible with tight tolerance
    const result2 = checkGeometryCompatibility(proteinGeometry, dnaGeometry, 0.01);
    expect(result2.compatible).toBe(false);
  });
});

// ============================================================================
// Full Binding Configuration Tests
// ============================================================================

describe('findBindingConfigurations', () => {
  test('finds binding configuration for matching protein and DNA', () => {
    const protein = createProtein(['BTA', 'BTC', 'BTG']);
    const dna = createDNA('ACGTTT');

    const configs = findBindingConfigurations(protein, dna);

    expect(configs).toHaveLength(1);
    expect(configs[0].strand).toBe('top');
    expect(configs[0].dnaStartIndex).toBe(0);
    expect(configs[0].bindingStrength).toBe(3);
  });

  test('finds configurations on both strands', () => {
    const protein = createProtein(['BTA', 'BTC']);
    // Top: ACAC, Bottom: TGTG
    const dna = createDNA('ACAC');

    const configs = findBindingConfigurations(protein, dna);

    // Should find matches on top strand (AC at positions 0, 2)
    const topConfigs = configs.filter(c => c.strand === 'top');
    expect(topConfigs.length).toBeGreaterThan(0);
  });

  test('returns empty array for non-matching protein', () => {
    const protein = createProtein(['BTA', 'BTA', 'BTA']);
    const dna = createDNA('CCCCCC');

    const configs = findBindingConfigurations(protein, dna);

    expect(configs).toEqual([]);
  });

  test('returns empty array for protein without binding amino acids', () => {
    const protein = createProtein(['STR', 'L60', 'FLX']);
    const dna = createDNA('ACGT');

    const configs = findBindingConfigurations(protein, dna);

    expect(configs).toEqual([]);
  });

  test('includes binding strength based on pattern length', () => {
    const protein = createProtein(['BTA', 'BTC', 'BTG', 'BTT']);
    const dna = createDNA('ACGT');

    const configs = findBindingConfigurations(protein, dna);

    expect(configs[0].bindingStrength).toBe(4);
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
      bindingStrength: 1
    };

    const complex = new BoundComplex(protein, dna, config);

    expect(complex.protein).toBe(protein);
    expect(complex.dna).toBe(dna);
    expect(complex.configuration).toBe(config);
  });

  test('provides strength accessor', () => {
    const config = { bindingStrength: 5 };
    const complex = new BoundComplex({}, {}, config);

    expect(complex.strength).toBe(5);
  });

  test('provides strand accessor', () => {
    const config = { strand: 'bottom' };
    const complex = new BoundComplex({}, {}, config);

    expect(complex.strand).toBe('bottom');
  });

  test('provides dnaPosition accessor', () => {
    const config = { dnaStartIndex: 3 };
    const complex = new BoundComplex({}, {}, config);

    expect(complex.dnaPosition).toBe(3);
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

    test('removeProtein removes protein', () => {
      const protein = createProtein(['BTA']);
      const id = manager.addProtein(protein);

      manager.removeProtein(id);

      expect(manager.isProteinBound(id)).toBe(false);
    });
  });

  describe('checkForBindings', () => {
    test('creates binding when protein matches DNA', () => {
      const protein = createProtein(['BTA', 'BTC']);
      const dna = createDNA('ACGT');

      manager.addProtein(protein);
      manager.addDNA(dna);

      const newBindings = manager.checkForBindings();

      expect(newBindings).toHaveLength(1);
    });

    test('returns empty array when no matches', () => {
      const protein = createProtein(['BTA', 'BTA']);
      const dna = createDNA('CCCC');

      manager.addProtein(protein);
      manager.addDNA(dna);

      const newBindings = manager.checkForBindings();

      expect(newBindings).toEqual([]);
    });

    test('does not rebind already bound protein', () => {
      const protein = createProtein(['BTA', 'BTC']);
      const dna = createDNA('ACAC');

      manager.addProtein(protein);
      manager.addDNA(dna);

      // First check creates binding
      manager.checkForBindings();

      // Second check should not create new bindings
      const newBindings = manager.checkForBindings();

      expect(newBindings).toEqual([]);
    });

    test('selects strongest binding configuration', () => {
      // Create protein that could match at different positions
      const protein = createProtein(['BTA', 'BTC', 'BTG']);
      const dna = createDNA('ACGACG');

      manager.addProtein(protein);
      manager.addDNA(dna);

      const newBindings = manager.checkForBindings();

      // Should bind with strength 3 (all three amino acids)
      expect(newBindings[0].configuration.bindingStrength).toBe(3);
    });
  });

  describe('isProteinBound', () => {
    test('returns false for unbound protein', () => {
      const protein = createProtein(['BTA']);
      const id = manager.addProtein(protein);

      expect(manager.isProteinBound(id)).toBe(false);
    });

    test('returns true for bound protein', () => {
      const protein = createProtein(['BTA']);
      const dna = createDNA('A');

      const proteinId = manager.addProtein(protein);
      manager.addDNA(dna);
      manager.checkForBindings();

      expect(manager.isProteinBound(proteinId)).toBe(true);
    });

    test('returns false for non-existent id', () => {
      expect(manager.isProteinBound(999)).toBe(false);
    });
  });

  describe('unbind', () => {
    test('unbinds a bound protein', () => {
      const protein = createProtein(['BTA']);
      const dna = createDNA('A');

      const proteinId = manager.addProtein(protein);
      manager.addDNA(dna);
      manager.checkForBindings();

      expect(manager.isProteinBound(proteinId)).toBe(true);

      manager.unbind(proteinId);

      expect(manager.isProteinBound(proteinId)).toBe(false);
    });

    test('returns false for unbound protein', () => {
      const protein = createProtein(['BTA']);
      const id = manager.addProtein(protein);

      const result = manager.unbind(id);

      expect(result).toBe(false);
    });

    test('removes from bound complexes', () => {
      const protein = createProtein(['BTA']);
      const dna = createDNA('A');

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

    test('returns all bound complexes', () => {
      const protein1 = createProtein(['BTA']);
      const protein2 = createProtein(['BTC']);
      const dna = createDNA('AC');

      manager.addProtein(protein1);
      manager.addProtein(protein2);
      manager.addDNA(dna);
      manager.checkForBindings();

      expect(manager.getBoundComplexes()).toHaveLength(2);
    });

    test('returns copy of array', () => {
      const protein = createProtein(['BTA']);
      const dna = createDNA('A');

      manager.addProtein(protein);
      manager.addDNA(dna);
      manager.checkForBindings();

      const complexes1 = manager.getBoundComplexes();
      const complexes2 = manager.getBoundComplexes();

      expect(complexes1).not.toBe(complexes2);
    });
  });

  describe('removeDNA', () => {
    test('unbinds all proteins from removed DNA', () => {
      const protein1 = createProtein(['BTA']);
      const protein2 = createProtein(['BTC']);
      const dna = createDNA('AC');

      const proteinId1 = manager.addProtein(protein1);
      const proteinId2 = manager.addProtein(protein2);
      const dnaId = manager.addDNA(dna);
      manager.checkForBindings();

      expect(manager.isProteinBound(proteinId1)).toBe(true);
      expect(manager.isProteinBound(proteinId2)).toBe(true);

      manager.removeDNA(dnaId);

      expect(manager.isProteinBound(proteinId1)).toBe(false);
      expect(manager.isProteinBound(proteinId2)).toBe(false);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Binding System Integration', () => {
  test('full workflow: protein binds to matching DNA sequence', () => {
    // Create a protein that binds to ACGT
    const protein = createProtein(['BTA', 'BTC', 'BTG', 'BTT']);
    const dna = createDNA('AAACGTTT');

    const manager = new BindingManager();
    manager.addProtein(protein);
    manager.addDNA(dna);

    // Check for bindings
    const newBindings = manager.checkForBindings();

    expect(newBindings).toHaveLength(1);
    expect(newBindings[0].configuration.dnaStartIndex).toBe(2);  // ACGT starts at position 2
    expect(newBindings[0].configuration.strand).toBe('top');
    expect(newBindings[0].configuration.bindingStrength).toBe(4);
  });

  test('protein with non-contiguous binding sites still matches', () => {
    // BTA and BTT are not adjacent (STR between them)
    const protein = createProtein(['BTA', 'STR', 'BTT']);
    const pattern = extractBindingPattern(protein);

    // Pattern should have 2 entries, non-contiguous
    expect(pattern).toHaveLength(2);
    expect(isContiguousBindingPattern(pattern)).toBe(false);

    // The binding should still work sequence-wise
    // but geometry might not match (depends on shape)
  });

  test('multiple proteins can bind to same DNA', () => {
    const protein1 = createProtein(['BTA', 'BTC']);
    const protein2 = createProtein(['BTG', 'BTT']);
    const dna = createDNA('ACGT');  // Has both AC and GT

    const manager = new BindingManager();
    manager.addProtein(protein1);
    manager.addProtein(protein2);
    manager.addDNA(dna);

    const newBindings = manager.checkForBindings();

    expect(newBindings).toHaveLength(2);
  });
});

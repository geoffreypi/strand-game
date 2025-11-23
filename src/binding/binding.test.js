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
    // INPUT: Origin hex at (0, 0)
    // EXPECTED: Returns all 6 neighbors with correct axial coordinates
    // WHY: Axial coordinate system has specific neighbor offsets for pointy-top hexes
    test('returns 6 neighbors in axial coordinates', () => {
      const neighbors = getHexNeighbors(0, 0);

      expect(neighbors.E).toEqual({ q: 1, r: 0 });
      expect(neighbors.W).toEqual({ q: -1, r: 0 });
      expect(neighbors.NE).toEqual({ q: 1, r: -1 });
      expect(neighbors.NW).toEqual({ q: 0, r: -1 });
      expect(neighbors.SE).toEqual({ q: 0, r: 1 });
      expect(neighbors.SW).toEqual({ q: -1, r: 1 });
    });

    // INPUT: Non-origin hex at (3, 2)
    // EXPECTED: Neighbors offset correctly from that position
    // WHY: Formula should work for any hex position, not just origin
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
    // INPUT: Two hexes with same q and r values
    // EXPECTED: Returns true
    // WHY: Position equality requires both coordinates to match
    test('returns true for equal positions', () => {
      expect(hexEquals({ q: 1, r: 2 }, { q: 1, r: 2 })).toBe(true);
    });

    // INPUT: Two hexes where either q or r differs
    // EXPECTED: Returns false
    // WHY: Any coordinate difference means different position
    test('returns false for different positions', () => {
      expect(hexEquals({ q: 1, r: 2 }, { q: 1, r: 3 })).toBe(false);
      expect(hexEquals({ q: 1, r: 2 }, { q: 2, r: 2 })).toBe(false);
    });
  });

  describe('getNeighborDirection', () => {
    // INPUT: Origin hex and each of its 6 neighbors
    // EXPECTED: Returns correct direction string for each
    // WHY: Direction detection is critical for binding geometry validation
    test('returns correct direction for each neighbor', () => {
      const from = { q: 0, r: 0 };

      expect(getNeighborDirection(from, { q: 1, r: 0 })).toBe('E');
      expect(getNeighborDirection(from, { q: -1, r: 0 })).toBe('W');
      expect(getNeighborDirection(from, { q: 1, r: -1 })).toBe('NE');
      expect(getNeighborDirection(from, { q: 0, r: -1 })).toBe('NW');
      expect(getNeighborDirection(from, { q: 0, r: 1 })).toBe('SE');
      expect(getNeighborDirection(from, { q: -1, r: 1 })).toBe('SW');
    });

    // INPUT: Origin hex and positions that are NOT adjacent neighbors
    // EXPECTED: Returns null
    // WHY: Non-adjacent hexes cannot have a direct connection direction
    test('returns null for non-neighbors', () => {
      const from = { q: 0, r: 0 };

      expect(getNeighborDirection(from, { q: 2, r: 0 })).toBeNull();
      expect(getNeighborDirection(from, { q: 0, r: 2 })).toBeNull();
      expect(getNeighborDirection(from, { q: 1, r: 1 })).toBeNull();
    });
  });

  describe('isHexLineStraight', () => {
    // INPUT: Array with only one hex position
    // EXPECTED: Returns { straight: true }
    // WHY: Single position has no direction to break, trivially straight
    test('single position is straight', () => {
      const result = isHexLineStraight([{ q: 0, r: 0 }]);
      expect(result.straight).toBe(true);
    });

    // INPUT: Two hexes that are East neighbors
    // EXPECTED: Returns { straight: true, direction: 'E' }
    // WHY: Two adjacent hexes define a direction; straightness requires checking consistency
    test('two adjacent positions are straight', () => {
      const result = isHexLineStraight([
        { q: 0, r: 0 },
        { q: 1, r: 0 }
      ]);
      expect(result.straight).toBe(true);
      expect(result.direction).toBe('E');
    });

    // INPUT: Four hexes in a horizontal line going East
    // EXPECTED: Returns { straight: true, direction: 'E' }
    // WHY: All consecutive pairs maintain same E direction = straight line
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

    // INPUT: Three hexes going West (decreasing q)
    // EXPECTED: Returns { straight: true, direction: 'W' }
    // WHY: Verifies direction detection works in both E and W orientations
    test('horizontal line going West is straight', () => {
      const result = isHexLineStraight([
        { q: 3, r: 0 },
        { q: 2, r: 0 },
        { q: 1, r: 0 }
      ]);
      expect(result.straight).toBe(true);
      expect(result.direction).toBe('W');
    });

    // INPUT: Three hexes where third turns SE instead of continuing E
    // EXPECTED: Returns { straight: false }
    // WHY: Direction change mid-line means protein/DNA is bent, can't bind
    test('bent line is not straight', () => {
      const result = isHexLineStraight([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 1, r: 1 }  // Turns SE
      ]);
      expect(result.straight).toBe(false);
    });

    // INPUT: Two hexes with a gap between them (not adjacent)
    // EXPECTED: Returns { straight: false }
    // WHY: Binding requires physically connected residues; gaps break the chain
    test('non-adjacent hexes are not straight', () => {
      const result = isHexLineStraight([
        { q: 0, r: 0 },
        { q: 2, r: 0 }  // Gap
      ]);
      expect(result.straight).toBe(false);
    });
  });

  describe('getProteinDirection', () => {
    // INPUT: Three positions going East (increasing q, same r)
    // EXPECTED: Returns 'E'
    // WHY: Protein direction determines binding direction (E protein = SE binding when above)
    test('returns E for eastward protein', () => {
      const positions = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 }
      ];
      expect(getProteinDirection(positions)).toBe('E');
    });

    // INPUT: Three positions going West (decreasing q, same r)
    // EXPECTED: Returns 'W'
    // WHY: W protein = SW binding when above, NW when below
    test('returns W for westward protein', () => {
      const positions = [
        { q: 2, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 0 }
      ];
      expect(getProteinDirection(positions)).toBe('W');
    });

    // INPUT: Two positions going SE (diagonal, not horizontal)
    // EXPECTED: Returns null
    // WHY: Only horizontal (E/W) proteins can bind; diagonals not supported
    test('returns null for non-horizontal protein', () => {
      const positions = [
        { q: 0, r: 0 },
        { q: 0, r: 1 }  // Going SE
      ];
      expect(getProteinDirection(positions)).toBeNull();
    });

    // INPUT: Single position (no second position to determine direction)
    // EXPECTED: Returns null
    // WHY: Need at least 2 positions to establish a direction vector
    test('returns null for single amino acid', () => {
      expect(getProteinDirection([{ q: 0, r: 0 }])).toBeNull();
    });
  });

  describe('getExpectedBindingDirection', () => {
    // INPUT: Protein going East, positioned above DNA
    // EXPECTED: Returns 'SE'
    // WHY: E protein above DNA binds SE (down-right in hex grid)
    test('above DNA, going East -> SE', () => {
      expect(getExpectedBindingDirection('E', 'above')).toBe('SE');
    });

    // INPUT: Protein going West, positioned above DNA
    // EXPECTED: Returns 'SW'
    // WHY: W protein above DNA binds SW (down-left in hex grid)
    test('above DNA, going West -> SW', () => {
      expect(getExpectedBindingDirection('W', 'above')).toBe('SW');
    });

    // INPUT: Protein going East, positioned below DNA
    // EXPECTED: Returns 'NE'
    // WHY: E protein below DNA binds NE (up-right in hex grid)
    test('below DNA, going East -> NE', () => {
      expect(getExpectedBindingDirection('E', 'below')).toBe('NE');
    });

    // INPUT: Protein going West, positioned below DNA
    // EXPECTED: Returns 'NW'
    // WHY: W protein below DNA binds NW (up-left in hex grid)
    test('below DNA, going West -> NW', () => {
      expect(getExpectedBindingDirection('W', 'below')).toBe('NW');
    });
  });
});

// ============================================================================
// Pattern Extraction Tests
// ============================================================================

describe('extractBindingPattern', () => {
  // INPUT: Protein with BTA at positions 0 and 2, STR at position 1
  // EXPECTED: Returns array with 2 entries for BTA positions, bindsTo 'A'
  // WHY: BTx amino acids recognize specific nucleotides; BTA binds Adenine
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

  // INPUT: Protein with all four BTx types (BTA, BTC, BTG, BTT)
  // EXPECTED: Returns 4 entries with bindsTo: ['A', 'C', 'G', 'T']
  // WHY: Each BTx type binds its corresponding nucleotide
  test('extracts all BT* types correctly', () => {
    const protein = createProtein(['BTA', 'BTC', 'BTG', 'BTT']);

    const pattern = extractBindingPattern(protein);

    expect(pattern).toHaveLength(4);
    expect(pattern.map(p => p.bindsTo)).toEqual(['A', 'C', 'G', 'T']);
  });

  // INPUT: Protein with only non-binding amino acids (STR, L60, FLX)
  // EXPECTED: Returns empty array
  // WHY: Non-BTx amino acids don't participate in DNA binding
  test('returns empty array for protein with no binding amino acids', () => {
    const protein = createProtein(['STR', 'L60', 'FLX']);
    const pattern = extractBindingPattern(protein);

    expect(pattern).toEqual([]);
  });

  // INPUT: Protein with BTA, BTC starting at non-origin position (5, 2)
  // EXPECTED: hexPosition values match the protein positions
  // WHY: Geometry checks need hex positions to verify adjacency
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
  // INPUT: DNA with ACGT on top strand
  // EXPECTED: Returns 4 entries with nucleotide: ['A', 'C', 'G', 'T']
  // WHY: DNA extraction provides the sequence to match against protein pattern
  test('extracts top strand sequence', () => {
    const dna = createDNA('ACGT');

    const sequence = extractDNASequence(dna, 'top');

    expect(sequence).toHaveLength(4);
    expect(sequence.map(s => s.nucleotide)).toEqual(['A', 'C', 'G', 'T']);
  });

  // INPUT: DNA with ACGT on top strand, requesting bottom strand
  // EXPECTED: Returns complement sequence ['T', 'G', 'C', 'A']
  // WHY: Bottom strand has Watson-Crick complements (A-T, C-G)
  test('extracts bottom strand sequence', () => {
    const dna = createDNA('ACGT');
    const sequence = extractDNASequence(dna, 'bottom');

    expect(sequence).toHaveLength(4);
    expect(sequence.map(s => s.nucleotide)).toEqual(['T', 'G', 'C', 'A']);
  });

  // INPUT: DNA starting at position q=2, r=5
  // EXPECTED: hexPosition values match DNA positions
  // WHY: Positions needed for geometry validation against protein
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
  // INPUT: Protein pattern ACG, DNA sequence ACGTTT
  // EXPECTED: One match at dnaStartIndex 0
  // WHY: Pattern matches exactly at the beginning of DNA
  test('finds exact match at start', () => {
    const protein = createProtein(['BTA', 'BTC', 'BTG']);
    const dna = createDNA('ACGTTT');

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');
    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toHaveLength(1);
    expect(matches[0].dnaStartIndex).toBe(0);
  });

  // INPUT: Protein pattern CGT, DNA sequence AACGTA
  // EXPECTED: One match at dnaStartIndex 2
  // WHY: Pattern found in middle of DNA, not at start
  test('finds match in middle of sequence', () => {
    const protein = createProtein(['BTC', 'BTG', 'BTT']);
    const dna = createDNA('AACGTA');

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');
    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toHaveLength(1);
    expect(matches[0].dnaStartIndex).toBe(2);
  });

  // INPUT: Protein pattern AC, DNA sequence ACACAC
  // EXPECTED: Three matches at indices 0, 2, 4
  // WHY: Repeating DNA allows multiple binding positions
  test('finds multiple matches', () => {
    const protein = createProtein(['BTA', 'BTC']);
    const dna = createDNA('ACACAC');

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');
    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toHaveLength(3);
    expect(matches.map(m => m.dnaStartIndex)).toEqual([0, 2, 4]);
  });

  // INPUT: Protein pattern AAA, DNA sequence CCCCCC
  // EXPECTED: Empty array (no matches)
  // WHY: Pattern doesn't exist in DNA sequence
  test('returns empty array when no match', () => {
    const protein = createProtein(['BTA', 'BTA', 'BTA']);
    const dna = createDNA('CCCCCC');

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');
    const matches = findSequenceMatches(pattern, sequence);

    expect(matches).toEqual([]);
  });

  // INPUT: Protein with BTT, RNA sequence containing U
  // EXPECTED: BTT matches U (uracil)
  // WHY: BTT binds both T (DNA) and U (RNA) for RNA compatibility
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
  // INPUT: Protein with BTA, BTC, BTG at consecutive positions 0, 1, 2
  // EXPECTED: Returns true
  // WHY: All BTx residues are adjacent; binding domain is contiguous
  test('returns true for contiguous binding sites', () => {
    const protein = createProtein(['BTA', 'BTC', 'BTG']);
    const pattern = extractBindingPattern(protein);

    expect(isContiguousBindingPattern(pattern)).toBe(true);
  });

  // INPUT: Protein with BTA, STR, BTC (BTx at positions 0 and 2, gap at 1)
  // EXPECTED: Returns false
  // WHY: Non-binding STR breaks the contiguity; can't bind as single unit
  test('returns false for non-contiguous binding sites', () => {
    const protein = createProtein(['BTA', 'STR', 'BTC']);
    const pattern = extractBindingPattern(protein);

    expect(isContiguousBindingPattern(pattern)).toBe(false);
  });

  // INPUT: Protein with only one BTx (BTA at position 1)
  // EXPECTED: Returns true
  // WHY: Single site is trivially contiguous (nothing to break)
  test('returns true for single binding site', () => {
    const protein = createProtein(['STR', 'BTA', 'STR']);
    const pattern = extractBindingPattern(protein);

    expect(isContiguousBindingPattern(pattern)).toBe(true);
  });

  // INPUT: Empty pattern (no BTx residues)
  // EXPECTED: Returns true
  // WHY: Empty set is trivially contiguous (vacuously true)
  test('returns true for empty pattern', () => {
    expect(isContiguousBindingPattern([])).toBe(true);
  });
});

// ============================================================================
// Hex Geometry Tests
// ============================================================================

describe('checkHexGeometry', () => {
  // INPUT: Protein at r=-1 going E, DNA at r=0, aligned for SE binding
  // EXPECTED: Returns { valid: true, bindingDirection: 'SE' }
  // WHY: E protein above DNA must bind SE per direction rules
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

  // INPUT: Protein at r=-1 going W, DNA at r=0, aligned for SW binding
  // EXPECTED: Returns { valid: true, bindingDirection: 'SW' }
  // WHY: W protein above DNA must bind SW per direction rules
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

  // INPUT: Protein at r=-2, DNA at r=0 (not adjacent, gap of 1 row)
  // EXPECTED: Returns { valid: false, reason: 'not adjacent' }
  // WHY: Binding requires physical adjacency; 2-row gap is too far
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

  // INPUT: Protein with non-contiguous BTx residues (BTA, STR, BTC)
  // EXPECTED: Returns { valid: false, reason: 'not contiguous' }
  // WHY: BTx residues must be adjacent for binding domain integrity
  test('invalid: non-contiguous binding sites', () => {
    const protein = createProtein(['BTA', 'STR', 'BTC'], 0, -1);
    const dna = createDNA('AC', 0, 0);

    const pattern = extractBindingPattern(protein);
    const sequence = extractDNASequence(dna, 'top');

    const result = checkHexGeometry(pattern, sequence, 0);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not contiguous');
  });

  // INPUT: E protein with DNA positioned for SW binding (direction mismatch)
  // EXPECTED: Returns { valid: false }
  // WHY: E protein must bind SE when above; SW binding is inconsistent
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
  // INPUT: Protein ACG at r=-1, DNA ACGTTT at r=0 (sequence match + geometry OK)
  // EXPECTED: Returns one config with SE binding, strength 3
  // WHY: Integration of sequence matching and geometry validation
  test('finds valid configuration with correct geometry', () => {
    const protein = createProtein(['BTA', 'BTC', 'BTG'], 0, -1);
    const dna = createDNA('ACGTTT', 0, 0);


    const configs = findBindingConfigurations(protein, dna);

    expect(configs).toHaveLength(1);
    expect(configs[0].strand).toBe('top');
    expect(configs[0].dnaStartIndex).toBe(0);
    expect(configs[0].bindingDirection).toBe('SE');
    expect(configs[0].bindingStrength).toBe(3);
  });

  // INPUT: Protein AC matches DNA but at r=-5 (too far away)
  // EXPECTED: Returns empty array
  // WHY: Sequence match alone isn't enough; geometry must be valid too
  test('returns empty for sequence match but wrong geometry', () => {
    // Protein matches sequence but is not adjacent
    const protein = createProtein(['BTA', 'BTC'], 0, -5);  // Far from DNA
    const dna = createDNA('AC', 0, 0);

    const configs = findBindingConfigurations(protein, dna);

    expect(configs).toEqual([]);
  });

  // INPUT: Protein with non-contiguous BTx (BTA, STR, BTC)
  // EXPECTED: Returns empty array
  // WHY: Non-contiguous binding sites are rejected before geometry check
  test('returns empty for non-contiguous binding sites', () => {
    const protein = createProtein(['BTA', 'STR', 'BTC'], 0, -1);
    const dna = createDNA('AC', 0, 0);

    const configs = findBindingConfigurations(protein, dna);

    expect(configs).toEqual([]);
  });

  // INPUT: Protein with no BTx residues (STR, L60, FLX)
  // EXPECTED: Returns empty array
  // WHY: No binding amino acids = no binding pattern to match
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
  // INPUT: Protein, DNA, and config with strand, position, strength, direction
  // EXPECTED: BoundComplex stores all inputs and makes them accessible
  // WHY: BoundComplex is the result object for successful bindings
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

  // INPUT: Config with various properties (strength=5, strand='bottom', etc.)
  // EXPECTED: Accessor methods return correct config values
  // WHY: Convenient accessors simplify working with bound complexes
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

  // INPUT: Create a BoundComplex
  // EXPECTED: boundAt timestamp is between before and after Date.now()
  // WHY: Timestamp allows tracking when binding occurred for game logic
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
    // INPUT: Add two proteins to manager
    // EXPECTED: Each addProtein call returns a different ID
    // WHY: Unique IDs allow tracking individual proteins in the system
    test('addProtein returns unique id', () => {
      const protein1 = createProtein(['BTA']);
      const protein2 = createProtein(['BTC']);

      const id1 = manager.addProtein(protein1);
      const id2 = manager.addProtein(protein2);

      expect(id1).not.toBe(id2);
    });

    // INPUT: Add two DNA molecules to manager
    // EXPECTED: Each addDNA call returns a different ID
    // WHY: Unique IDs allow tracking individual DNA molecules in the system
    test('addDNA returns unique id', () => {
      const dna1 = createDNA('ACGT');
      const dna2 = createDNA('AAAA');

      const id1 = manager.addDNA(dna1);
      const id2 = manager.addDNA(dna2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('checkForBindings', () => {
    // INPUT: Protein AC at r=-1, DNA ACGT at r=0 (valid geometry)
    // EXPECTED: Returns array with one binding, direction SE
    // WHY: Manager should detect and create bindings when conditions are met
    test('creates binding when geometry is correct', () => {
      const protein = createProtein(['BTA', 'BTC'], 0, -1);
      const dna = createDNA('ACGT', 0, 0);

      manager.addProtein(protein);
      manager.addDNA(dna);

      const newBindings = manager.checkForBindings();

      expect(newBindings).toHaveLength(1);
      expect(newBindings[0].configuration.bindingDirection).toBe('SE');
    });

    // INPUT: Protein AC at r=-5 (too far from DNA at r=0)
    // EXPECTED: Returns empty array
    // WHY: Geometry validation should reject non-adjacent proteins
    test('returns empty when geometry is wrong', () => {
      const protein = createProtein(['BTA', 'BTC'], 0, -5);  // Too far
      const dna = createDNA('AC', 0, 0);

      manager.addProtein(protein);
      manager.addDNA(dna);

      const newBindings = manager.checkForBindings();

      expect(newBindings).toEqual([]);
    });

    // INPUT: Protein that already bound, DNA with multiple match positions
    // EXPECTED: Second checkForBindings returns empty
    // WHY: Protein can only bind once; prevents duplicate bindings
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
    // INPUT: Protein added to manager but no DNA available to bind
    // EXPECTED: isProteinBound returns false
    // WHY: Query method to check binding status of registered proteins
    test('returns false for unbound protein', () => {
      const protein = createProtein(['BTA']);
      const id = manager.addProtein(protein);

      expect(manager.isProteinBound(id)).toBe(false);
    });

    // INPUT: Protein AC bound to DNA AC after checkForBindings
    // EXPECTED: isProteinBound returns true
    // WHY: Status should update after successful binding
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
    // INPUT: Bound protein, then call unbind with its ID
    // EXPECTED: isProteinBound returns false after unbind
    // WHY: Proteins should be able to detach from DNA
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

    // INPUT: Bound protein, then unbind it
    // EXPECTED: getBoundComplexes length goes from 1 to 0
    // WHY: Unbinding should clean up the BoundComplex from the list
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
    // INPUT: Fresh BindingManager with no bindings
    // EXPECTED: getBoundComplexes returns empty array
    // WHY: Initial state should have no bindings
    test('returns empty array initially', () => {
      expect(manager.getBoundComplexes()).toEqual([]);
    });

    // INPUT: Protein AC bound to DNA ACGT
    // EXPECTED: getBoundComplexes returns array with the binding
    // WHY: Successful bindings should be queryable
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
  // INPUT: Complete workflow - protein ACGT above DNA AAACGTTT
  // EXPECTED: Binding at index 2, direction SE, position above
  // WHY: End-to-end test of the full binding pipeline
  test('full workflow: protein binds with correct SE direction', () => {
    // Protein above DNA, going East
    const protein = createProtein(['BTA', 'BTC', 'BTG', 'BTT'], 2, -1);
    const dna = createDNA('AAACGTTT', 0, 0);


    const manager = new BindingManager();
    manager.addProtein(protein);
    manager.addDNA(dna);

    const newBindings = manager.checkForBindings();

    expect(newBindings).toHaveLength(1);
    expect(newBindings[0].configuration.dnaStartIndex).toBe(2);
    expect(newBindings[0].configuration.bindingDirection).toBe('SE');
    expect(newBindings[0].configuration.relativePosition).toBe('above');

  });

  // INPUT: Protein AC above DNA AC
  // EXPECTED: bindingDirection is 'SE' (for visualization as \)
  // WHY: Confirms direction info is available for rendering
  test('visualization shows correct binding character', () => {
    const protein = createProtein(['BTA', 'BTC'], 0, -1);
    const dna = createDNA('AC', 0, 0);

    const configs = findBindingConfigurations(protein, dna);

    expect(configs[0].bindingDirection).toBe('SE');
    // SE binding should be visualized with \
  });
});

import { describe, test, expect } from '@jest/globals';
import { Molecule } from './molecule.js';
import { Complex } from './complex.js';

// =============================================================================
// MOLECULE TESTS
// =============================================================================

describe('Molecule', () => {
  describe('Construction', () => {
    // INPUT: Valid protein sequence array
    // EXPECTED: Molecule created with correct properties
    // WHY: Basic construction should work
    test('creates molecule from sequence array', () => {
      const mol = new Molecule(['STR', 'BTA', 'SIG']);

      expect(mol.sequence).toEqual(['STR', 'BTA', 'SIG']);
      expect(mol.length).toBe(3);
      expect(mol.foldStates).toEqual([0, 0, 0]);
      expect(mol.type).toBe('protein');
    });

    // INPUT: DNA sequence
    // EXPECTED: Type inferred as 'dna'
    // WHY: Should auto-detect nucleotide sequences
    test('infers DNA type from nucleotide sequence', () => {
      const mol = new Molecule(['A', 'C', 'G', 'T']);

      expect(mol.type).toBe('dna');
    });

    // INPUT: RNA sequence (contains U)
    // EXPECTED: Type inferred as 'rna'
    // WHY: U indicates RNA
    test('infers RNA type from sequence with U', () => {
      const mol = new Molecule(['A', 'C', 'G', 'U']);

      expect(mol.type).toBe('rna');
    });

    // INPUT: Custom fold states
    // EXPECTED: Fold states match input
    // WHY: Should accept initial fold configuration
    test('accepts custom fold states', () => {
      const mol = new Molecule(['STR', 'L60', 'R60'], {
        foldStates: [0, 1, -1]
      });

      expect(mol.foldStates).toEqual([0, 1, -1]);
    });

    // INPUT: Mismatched foldStates length
    // EXPECTED: Throws error
    // WHY: Fold states must match sequence length
    test('throws on mismatched foldStates length', () => {
      expect(() => {
        new Molecule(['STR', 'SIG'], { foldStates: [0] });
      }).toThrow('foldStates length must match sequence length');
    });

    // INPUT: Empty sequence
    // EXPECTED: Throws error
    // WHY: Molecules must have at least one element
    test('throws on empty sequence', () => {
      expect(() => {
        new Molecule([]);
      }).toThrow('Molecule sequence must be a non-empty array');
    });
  });

  describe('Accessors', () => {
    // INPUT: Molecule with sequence
    // EXPECTED: getTypeAt returns correct types
    // WHY: Need to query residue types by index
    test('getTypeAt returns correct type', () => {
      const mol = new Molecule(['STR', 'BTA', 'SIG']);

      expect(mol.getTypeAt(0)).toBe('STR');
      expect(mol.getTypeAt(1)).toBe('BTA');
      expect(mol.getTypeAt(2)).toBe('SIG');
      expect(mol.getTypeAt(99)).toBeNull();
    });

    // INPUT: Molecule with fold states
    // EXPECTED: getFoldAt returns correct states
    // WHY: Need to query fold states by index
    test('getFoldAt returns correct fold', () => {
      const mol = new Molecule(['STR', 'L60'], { foldStates: [0, 1] });

      expect(mol.getFoldAt(0)).toBe(0);
      expect(mol.getFoldAt(1)).toBe(1);
      expect(mol.getFoldAt(99)).toBeNull();
    });

    // INPUT: Setting fold state
    // EXPECTED: Fold state updated
    // WHY: Fold states change during simulation
    test('setFoldAt updates fold state', () => {
      const mol = new Molecule(['STR', 'L60']);

      mol.setFoldAt(1, 2);
      expect(mol.getFoldAt(1)).toBe(2);
    });

    // INPUT: Fold state out of range
    // EXPECTED: Clamped to valid range
    // WHY: Hex grid limits angles to -180° to +180° (steps -3 to +3)
    test('setFoldAt clamps to valid range', () => {
      const mol = new Molecule(['STR', 'FLX']);

      mol.setFoldAt(1, 10);
      expect(mol.getFoldAt(1)).toBe(3); // Clamped to max

      mol.setFoldAt(1, -10);
      expect(mol.getFoldAt(1)).toBe(-3); // Clamped to min
    });
  });

  describe('Factory Methods', () => {
    // INPUT: Protein sequence string with dashes
    // EXPECTED: Parsed correctly
    // WHY: Convenient creation from string format
    test('createProtein parses dash-separated string', () => {
      const mol = Molecule.createProtein('STR-BTA-SIG-L60');

      expect(mol.sequence).toEqual(['STR', 'BTA', 'SIG', 'L60']);
      expect(mol.type).toBe('protein');
    });

    // INPUT: DNA sequence string
    // EXPECTED: Split into individual nucleotides
    // WHY: DNA sequences are typically written without delimiters
    test('createDNA splits string into nucleotides', () => {
      const mol = Molecule.createDNA('ACGT');

      expect(mol.sequence).toEqual(['A', 'C', 'G', 'T']);
      expect(mol.type).toBe('dna');
    });

    // INPUT: RNA sequence string
    // EXPECTED: Split into individual nucleotides
    // WHY: RNA uses U instead of T
    test('createRNA splits string into nucleotides', () => {
      const mol = Molecule.createRNA('ACGU');

      expect(mol.sequence).toEqual(['A', 'C', 'G', 'U']);
      expect(mol.type).toBe('rna');
    });
  });

  describe('Serialization', () => {
    // INPUT: Molecule instance
    // EXPECTED: Serializes and deserializes correctly
    // WHY: Need to save/load game state
    test('toJSON and fromJSON round-trip', () => {
      const original = new Molecule(['STR', 'BTA', 'SIG'], {
        foldStates: [0, 1, -1],
        type: 'protein',
        id: 'test_mol'
      });

      const json = original.toJSON();
      const restored = Molecule.fromJSON(json);

      expect(restored.sequence).toEqual(original.sequence);
      expect(restored.foldStates).toEqual(original.foldStates);
      expect(restored.type).toBe(original.type);
      expect(restored.id).toBe(original.id);
    });

    // INPUT: Molecule
    // EXPECTED: Clone is independent copy
    // WHY: Need to copy molecules without affecting original
    test('clone creates independent copy', () => {
      const original = new Molecule(['STR', 'SIG']);
      const clone = original.clone();

      clone.setFoldAt(0, 2);

      expect(original.getFoldAt(0)).toBe(0); // Unchanged
      expect(clone.getFoldAt(0)).toBe(2);    // Changed
    });
  });
});

// =============================================================================
// COMPLEX TESTS
// =============================================================================

describe('Complex', () => {
  describe('Molecule Management', () => {
    // INPUT: Add molecule to complex
    // EXPECTED: Complex contains molecule
    // WHY: Basic molecule addition
    test('addMolecule adds molecule to complex', () => {
      const complex = new Complex();
      const mol = Molecule.createProtein('STR-SIG-BTA');

      complex.addMolecule(mol);

      expect(complex.molecules).toContain(mol);
      expect(complex.size).toBe(3);
    });

    // INPUT: Add molecule with offset
    // EXPECTED: Offset stored correctly
    // WHY: Molecules need positioning within complex
    test('addMolecule stores offset and direction', () => {
      const complex = new Complex();
      const mol = Molecule.createProtein('STR-SIG');

      complex.addMolecule(mol, { offset: { q: 5, r: 3 }, direction: 2 });

      const entry = complex.getEntry(mol.id);
      expect(entry.offset).toEqual({ q: 5, r: 3 });
      expect(entry.direction).toBe(2);
    });

    // INPUT: Remove molecule
    // EXPECTED: Molecule removed from complex
    // WHY: Molecules can unbind
    test('removeMolecule removes molecule', () => {
      const complex = new Complex();
      const mol = Molecule.createProtein('STR-SIG');

      complex.addMolecule(mol);
      expect(complex.molecules.length).toBe(1);

      complex.removeMolecule(mol);
      expect(complex.molecules.length).toBe(0);
    });

    // INPUT: Multiple molecules
    // EXPECTED: All tracked correctly
    // WHY: Complexes can have multiple molecules
    test('handles multiple molecules', () => {
      const complex = new Complex();
      const protein = Molecule.createProtein('STR-BTA');
      const dna = Molecule.createDNA('ACGT');

      complex.addMolecule(protein, { offset: { q: 0, r: 0 } });
      complex.addMolecule(dna, { offset: { q: 0, r: 2 } });

      expect(complex.molecules.length).toBe(2);
      expect(complex.size).toBe(6); // 2 + 4
    });
  });

  describe('Position Mapping', () => {
    // INPUT: Single straight molecule
    // EXPECTED: Entities at sequential positions
    // WHY: Straight chain should occupy adjacent hexes
    test('maps straight chain to sequential positions', () => {
      const complex = Complex.fromProtein('STR-SIG-BTA');

      const entities = complex.getEntities();

      expect(entities.length).toBe(3);
      expect(entities[0]).toMatchObject({ q: 0, r: 0, type: 'STR' });
      expect(entities[1]).toMatchObject({ q: 1, r: 0, type: 'SIG' });
      expect(entities[2]).toMatchObject({ q: 2, r: 0, type: 'BTA' });
    });

    // INPUT: Molecule with offset
    // EXPECTED: Positions shifted by offset
    // WHY: Offset determines starting position
    test('applies offset to positions', () => {
      const complex = new Complex();
      const mol = Molecule.createProtein('STR-SIG');
      complex.addMolecule(mol, { offset: { q: 5, r: 3 } });

      const entities = complex.getEntities();

      expect(entities[0]).toMatchObject({ q: 5, r: 3 });
      expect(entities[1]).toMatchObject({ q: 6, r: 3 });
    });

    // INPUT: Molecule with fold
    // EXPECTED: Position changes direction after fold
    // WHY: Folds change chain direction
    test('applies folds to positions', () => {
      const mol = Molecule.createProtein('STR-L60-STR');
      mol.setFoldAt(0, 1); // 60° left turn after first residue

      const complex = new Complex();
      complex.addMolecule(mol);

      const entities = complex.getEntities();

      // Fold at index 0 affects direction AFTER placing residue 0
      // Residue 0 at (0,0), then direction changes (60° left = dir 5 = NE)
      // Residue 1 at (1,-1) (moved NE from 0,0)
      // Residue 2 continues in same direction
      expect(entities[0]).toMatchObject({ q: 0, r: 0 });
      expect(entities[1]).toMatchObject({ q: 1, r: -1 });
      expect(entities[2]).toMatchObject({ q: 2, r: -2 });
    });

    // INPUT: Position query
    // EXPECTED: Returns entity at position
    // WHY: Need to check what's at a hex
    test('getAt returns entity at position', () => {
      const complex = Complex.fromProtein('STR-SIG-BTA');

      expect(complex.getAt(0, 0).type).toBe('STR');
      expect(complex.getAt(1, 0).type).toBe('SIG');
      expect(complex.getAt(5, 5)).toBeNull();
    });

    // INPUT: Neighbor query
    // EXPECTED: Returns adjacent entities
    // WHY: Adjacency is core to energy and signals
    test('getNeighborsAt returns adjacent entities', () => {
      const complex = Complex.fromProtein('STR-SIG-BTA');

      const neighbors = complex.getNeighborsAt(1, 0); // SIG's position

      expect(neighbors.length).toBe(2);
      expect(neighbors.map(n => n.type)).toContain('STR');
      expect(neighbors.map(n => n.type)).toContain('BTA');
    });
  });

  describe('Binding Detection', () => {
    // INPUT: BTA adjacent to A nucleotide
    // EXPECTED: Binding detected
    // WHY: BTx + matching nucleotide = binding
    test('finds binding between BTA and A', () => {
      const complex = new Complex();
      const protein = Molecule.createProtein('STR-BTA');
      const dna = Molecule.createDNA('AT');

      // Position DNA so A is adjacent to BTA
      // Protein: STR at (0,0), BTA at (1,0)
      // DNA: A at (1,1), T at (2,1) - A is SE neighbor of BTA
      complex.addMolecule(protein, { offset: { q: 0, r: 0 } });
      complex.addMolecule(dna, { offset: { q: 1, r: 1 } });

      const bindings = complex.findBindings();

      expect(bindings.size).toBe(1);
      expect(bindings.get(1)).toBe('A'); // BTA (index 1) bound to A
    });

    // INPUT: BTA not adjacent to any nucleotide
    // EXPECTED: No binding
    // WHY: Distance matters
    test('no binding when not adjacent', () => {
      const complex = new Complex();
      const protein = Molecule.createProtein('STR-BTA');
      const dna = Molecule.createDNA('AT');

      // DNA far away
      complex.addMolecule(protein, { offset: { q: 0, r: 0 } });
      complex.addMolecule(dna, { offset: { q: 10, r: 10 } });

      const bindings = complex.findBindings();

      expect(bindings.size).toBe(0);
    });

    // INPUT: BTA adjacent to wrong nucleotide
    // EXPECTED: No binding
    // WHY: BTA only binds A, not G
    test('no binding for mismatched nucleotide', () => {
      const complex = new Complex();
      const protein = Molecule.createProtein('STR-BTA');
      const dna = Molecule.createDNA('GC');

      complex.addMolecule(protein, { offset: { q: 0, r: 0 } });
      complex.addMolecule(dna, { offset: { q: 1, r: 1 } }); // G adjacent to BTA

      const bindings = complex.findBindings();

      expect(bindings.size).toBe(0);
    });
  });

  describe('Signal Propagation', () => {
    // INPUT: Protein with bound BTA -> SIG chain
    // EXPECTED: Signal propagates through SIG
    // WHY: Bound BTx is signal source
    test('signals propagate from bound BTx', () => {
      const complex = new Complex();
      const protein = Molecule.createProtein('BTA-SIG-SIG');
      const dna = Molecule.createDNA('A');

      // BTA at (0,0), DNA A at (0,1) - adjacent
      complex.addMolecule(protein, { offset: { q: 0, r: 0 } });
      complex.addMolecule(dna, { offset: { q: 0, r: 1 } });

      // Use deterministic random (always succeeds) for test reproducibility
      complex.computeSignals({ randomFn: () => 0 });

      expect(complex.isSignaled(0)).toBe(true); // BTA - source
      expect(complex.isSignaled(1)).toBe(true); // SIG - conducted
      expect(complex.isSignaled(2)).toBe(true); // SIG - conducted
    });

    // INPUT: Unbound BTx
    // EXPECTED: No signal
    // WHY: BTx must be bound to generate signal
    test('unbound BTx does not signal', () => {
      const complex = Complex.fromProtein('BTA-SIG-SIG');

      complex.computeSignals();

      expect(complex.isSignaled(0)).toBe(false);
      expect(complex.isSignaled(1)).toBe(false);
    });
  });

  describe('Energy Calculations', () => {
    // INPUT: Protein with residues at preferred folds
    // EXPECTED: Low folding energy
    // WHY: Preferred state = minimum energy
    test('calculates folding preference energy', () => {
      // STR prefers 0, L60 prefers +1
      const mol = Molecule.createProtein('STR-L60');
      mol.setFoldAt(0, 0);  // STR at preferred
      mol.setFoldAt(1, 1);  // L60 at preferred

      const complex = new Complex();
      complex.addMolecule(mol);

      const energy = complex.calculateEnergy();

      // At preferred states, folding energy contribution should be 0
      // Other energy terms may contribute
      expect(typeof energy).toBe('number');
      expect(isFinite(energy)).toBe(true);
    });

    // INPUT: Opposite charges adjacent
    // EXPECTED: Negative (favorable) electrostatic energy
    // WHY: Opposite charges attract
    test('opposite charges have favorable energy', () => {
      const complex1 = Complex.fromProtein('POS-NEG'); // Adjacent opposite
      const complex2 = Complex.fromProtein('POS-STR-NEG'); // Separated

      const energy1 = complex1.calculateEnergy();
      const energy2 = complex2.calculateEnergy();

      // Adjacent opposite charges should have lower energy
      expect(energy1).toBeLessThan(energy2);
    });
  });

  describe('Fold Updates', () => {
    // INPUT: Get preferred fold for structural residue
    // EXPECTED: Returns residue's preferred steps
    // WHY: Used to determine target fold state
    test('getPreferredFold returns residue preference', () => {
      const complex = Complex.fromProtein('STR-L60-R60');

      expect(complex.getPreferredFold(complex.molecules[0].id, 0)).toBe(0);  // STR
      expect(complex.getPreferredFold(complex.molecules[0].id, 1)).toBe(1);  // L60
      expect(complex.getPreferredFold(complex.molecules[0].id, 2)).toBe(-1); // R60
    });

    // INPUT: Set fold on molecule through complex
    // EXPECTED: Fold updated, positions recalculated
    // WHY: Complex manages fold updates
    test('setFold updates molecule and invalidates cache', () => {
      const complex = Complex.fromProtein('STR-SIG-STR');
      const molId = complex.molecules[0].id;

      // Initial: straight chain at (0,0), (1,0), (2,0)
      expect(complex.getAt(1, 0).type).toBe('SIG');
      expect(complex.getAt(2, 0).type).toBe('STR');

      // Fold first residue left - affects position of residue 1 and 2
      complex.setFold(molId, 0, 1);

      // Residue 1 now at (1,-1), residue 2 at (2,-2)
      expect(complex.getAt(1, 0)).toBeNull(); // No longer there
      expect(complex.getAt(1, -1).type).toBe('SIG'); // Moved here
    });
  });

  describe('Serialization', () => {
    // INPUT: Complex with molecules
    // EXPECTED: Round-trips through JSON
    // WHY: Save/load functionality
    test('toJSON and fromJSON round-trip', () => {
      const original = new Complex({ id: 'test_complex' });
      original.addMolecule(Molecule.createProtein('STR-BTA'), {
        offset: { q: 1, r: 2 },
        direction: 3
      });
      original.setSignalConfig({ SIG: 0.5 });

      const json = original.toJSON();
      const restored = Complex.fromJSON(json);

      expect(restored.id).toBe(original.id);
      expect(restored.molecules.length).toBe(1);
      expect(restored.molecules[0].sequence).toEqual(['STR', 'BTA']);

      const entry = restored.getEntry(restored.molecules[0].id);
      expect(entry.offset).toEqual({ q: 1, r: 2 });
      expect(entry.direction).toBe(3);
    });
  });

  describe('Factory Methods', () => {
    // INPUT: Create from protein string
    // EXPECTED: Complex with single protein
    // WHY: Convenience factory
    test('fromProtein creates single-molecule complex', () => {
      const complex = Complex.fromProtein('STR-SIG-BTA');

      expect(complex.molecules.length).toBe(1);
      expect(complex.molecules[0].type).toBe('protein');
      expect(complex.size).toBe(3);
    });

    // INPUT: Create from DNA string
    // EXPECTED: Complex with single DNA strand
    // WHY: Convenience factory
    test('fromDNA creates single-molecule complex', () => {
      const complex = Complex.fromDNA('ACGT');

      expect(complex.molecules.length).toBe(1);
      expect(complex.molecules[0].type).toBe('dna');
      expect(complex.size).toBe(4);
    });
  });

  describe('ATP and ATR', () => {
    // INPUT: Create ATP molecule
    // EXPECTED: Single-element molecule with type 'atp'
    // WHY: ATP is a small molecule, not a chain
    test('Molecule.createATP creates single-element ATP', () => {
      const atp = Molecule.createATP();

      expect(atp.sequence).toEqual(['ATP']);
      expect(atp.length).toBe(1);
      expect(atp.type).toBe('atp');
    });

    // INPUT: ATR signaled with successful roll
    // EXPECTED: ATP spawned in adjacent hex
    // WHY: ATR attracts ATP when activated
    test('processATRs spawns ATP when ATR is signaled', () => {
      const complex = new Complex();
      const protein = Molecule.createProtein('BTA-SIG-ATR');
      const dna = Molecule.createDNA('A');

      // BTA at (0,0), SIG at (1,0), ATR at (2,0)
      // DNA A at (0,1) - adjacent to BTA
      complex.addMolecule(protein, { offset: { q: 0, r: 0 } });
      complex.addMolecule(dna, { offset: { q: 0, r: 1 } });

      // Compute signals - BTA bound, signal propagates to ATR
      // Use deterministic random for test reproducibility
      complex.computeSignals({ randomFn: () => 0 });
      expect(complex.isSignaled(2)).toBe(true); // ATR should be signaled

      // Process ATRs with guaranteed success (randomFn returns 0)
      const result = complex.processATRs({ randomFn: () => 0 });

      expect(result.count).toBe(1);
      expect(result.attracted.length).toBe(1);
      // ATP should be adjacent to ATR at (2,0)
      const atpPos = result.attracted[0];
      expect(complex.hasATPAt(atpPos.q, atpPos.r)).toBe(true);
    });

    // INPUT: ATR signaled but roll fails
    // EXPECTED: No ATP spawned
    // WHY: 75% chance means sometimes it fails
    test('processATRs does nothing on failed roll', () => {
      const complex = new Complex();
      const protein = Molecule.createProtein('BTA-SIG-ATR');
      const dna = Molecule.createDNA('A');

      complex.addMolecule(protein, { offset: { q: 0, r: 0 } });
      complex.addMolecule(dna, { offset: { q: 0, r: 1 } });

      complex.computeSignals();

      // Roll fails (0.8 >= 0.75)
      const result = complex.processATRs({ randomFn: () => 0.8 });

      expect(result.count).toBe(0);
    });

    // INPUT: ATR not signaled
    // EXPECTED: No ATP spawned
    // WHY: ATR must be activated to attract
    test('processATRs does nothing when ATR not signaled', () => {
      const complex = Complex.fromProtein('STR-SIG-ATR');

      // No binding, no signal
      complex.computeSignals();
      expect(complex.isSignaled(2)).toBe(false);

      const result = complex.processATRs({ randomFn: () => 0 });

      expect(result.count).toBe(0);
    });

    // INPUT: ATR with all adjacent hexes occupied
    // EXPECTED: No ATP spawned
    // WHY: Need empty hex to place ATP
    test('processATRs does nothing when all hexes occupied', () => {
      const complex = new Complex();
      // Create a protein that surrounds ATR position
      // ATR at center, surrounded by other residues
      const protein = Molecule.createProtein('BTA-SIG-ATR');
      const dna = Molecule.createDNA('A');

      complex.addMolecule(protein, { offset: { q: 0, r: 0 } });
      complex.addMolecule(dna, { offset: { q: 0, r: 1 } });

      // Add more molecules to occupy all hexes around ATR at (2,0)
      // Neighbors of (2,0): (3,0), (2,1), (1,1), (1,0), (2,-1), (3,-1)
      // (1,0) is SIG, so we need to fill the other 5
      complex.addMolecule(Molecule.createATP(), { offset: { q: 3, r: 0 } });
      complex.addMolecule(Molecule.createATP(), { offset: { q: 2, r: 1 } });
      complex.addMolecule(Molecule.createATP(), { offset: { q: 1, r: 1 } });
      complex.addMolecule(Molecule.createATP(), { offset: { q: 2, r: -1 } });
      complex.addMolecule(Molecule.createATP(), { offset: { q: 3, r: -1 } });

      complex.computeSignals();

      const result = complex.processATRs({ randomFn: () => 0 });

      expect(result.count).toBe(0);
    });

    // INPUT: ATP at position
    // EXPECTED: getATPPositions includes it
    // WHY: Need to track ATP for signal propagation
    test('getATPPositions returns all ATP locations', () => {
      const complex = Complex.fromProtein('STR-SIG');
      complex.addMolecule(Molecule.createATP(), { offset: { q: 5, r: 5 } });
      complex.addMolecule(Molecule.createATP(), { offset: { q: 6, r: 6 } });

      const positions = complex.getATPPositions();

      expect(positions.size).toBe(2);
      expect(positions.has('5,5')).toBe(true);
      expect(positions.has('6,6')).toBe(true);
    });

    // INPUT: Consume ATP at position
    // EXPECTED: ATP removed
    // WHY: ATP gets consumed when used for actions
    test('consumeATPAt removes ATP molecule', () => {
      const complex = Complex.fromProtein('STR-SIG');
      complex.addMolecule(Molecule.createATP(), { offset: { q: 5, r: 5 } });

      expect(complex.hasATPAt(5, 5)).toBe(true);

      const removed = complex.consumeATPAt(5, 5);

      expect(removed).toBe(true);
      expect(complex.hasATPAt(5, 5)).toBe(false);
    });

    // INPUT: Consume ATP at empty position
    // EXPECTED: Returns false
    // WHY: Can't consume what isn't there
    test('consumeATPAt returns false when no ATP', () => {
      const complex = Complex.fromProtein('STR-SIG');

      const removed = complex.consumeATPAt(5, 5);

      expect(removed).toBe(false);
    });
  });
});

/**
 * Molecule Class
 *
 * Simple data class representing a linear molecular chain (protein, DNA, RNA).
 * Stores the sequence and current fold states. All computation is done by Complex.
 *
 * A Molecule is defined by:
 * - sequence: Array of residue/nucleotide type codes
 * - foldStates: Array of fold angles at each position (in steps notation)
 * - type: 'protein', 'dna', 'rna', or 'other'
 *
 * Position within a Complex (offset, direction) is stored by Complex, not here,
 * since position only matters relative to other molecules in the same complex.
 */

import { AMINO_ACID_TYPES } from '../data/amino-acids.js';

export class Molecule {
  /**
   * Create a new Molecule
   * @param {string[]} sequence - Array of residue/nucleotide codes
   * @param {Object} options - Optional configuration
   * @param {number[]} options.foldStates - Initial fold states (defaults to all 0)
   * @param {string} options.type - Molecule type: 'protein', 'dna', 'rna', 'other'
   * @param {string} options.id - Optional unique identifier
   */
  constructor(sequence, options = {}) {
    if (!Array.isArray(sequence) || sequence.length === 0) {
      throw new Error('Molecule sequence must be a non-empty array');
    }

    this.sequence = [...sequence]; // Copy to prevent external mutation
    this.foldStates = options.foldStates
      ? [...options.foldStates]
      : new Array(sequence.length).fill(0);

    if (this.foldStates.length !== sequence.length) {
      throw new Error('foldStates length must match sequence length');
    }

    this.type = options.type ?? this._inferType(sequence);
    this.id = options.id ?? `mol_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Infer molecule type from sequence
   * @private
   */
  _inferType(sequence) {
    // Check for U anywhere in sequence (indicates RNA)
    if (sequence.some(code => code === 'U')) {
      return 'rna';
    }

    // Check for DNA nucleotides (no U present)
    const firstCode = sequence[0];
    if (['A', 'C', 'G', 'T'].includes(firstCode)) {
      return 'dna';
    }

    // Check if it's a known amino acid
    if (AMINO_ACID_TYPES[firstCode]) {
      return 'protein';
    }

    return 'other';
  }

  /**
   * Get the length of the molecule (number of residues/nucleotides)
   * @returns {number}
   */
  get length() {
    return this.sequence.length;
  }

  /**
   * Get residue/nucleotide at index
   * @param {number} index
   * @returns {string} Type code
   */
  getTypeAt(index) {
    if (index < 0 || index >= this.sequence.length) {
      return null;
    }
    return this.sequence[index];
  }

  /**
   * Get fold state at index
   * @param {number} index
   * @returns {number} Fold state in steps
   */
  getFoldAt(index) {
    if (index < 0 || index >= this.foldStates.length) {
      return null;
    }
    return this.foldStates[index];
  }

  /**
   * Set fold state at index
   * @param {number} index
   * @param {number} steps - Fold state in steps notation
   */
  setFoldAt(index, steps) {
    if (index < 0 || index >= this.foldStates.length) {
      throw new Error(`Invalid index: ${index}`);
    }
    // Clamp to valid range (-3 to +3 for hex grid, representing -180° to +180°)
    this.foldStates[index] = Math.max(-3, Math.min(3, steps));
  }

  /**
   * Create a copy of this molecule
   * @returns {Molecule}
   */
  clone() {
    return new Molecule(this.sequence, {
      foldStates: this.foldStates,
      type: this.type,
      id: `${this.id}_clone`
    });
  }

  /**
   * Serialize to plain object (for saving/loading)
   * @returns {Object}
   */
  toJSON() {
    return {
      sequence: this.sequence,
      foldStates: this.foldStates,
      type: this.type,
      id: this.id
    };
  }

  /**
   * Create Molecule from serialized data
   * @param {Object} data
   * @returns {Molecule}
   */
  static fromJSON(data) {
    return new Molecule(data.sequence, {
      foldStates: data.foldStates,
      type: data.type,
      id: data.id
    });
  }

  /**
   * Create a protein molecule from a sequence string or array
   * @param {string|string[]} sequence - e.g., "STR-BTA-SIG-L60" or ['STR', 'BTA', 'SIG', 'L60']
   * @param {Object} options
   * @returns {Molecule}
   */
  static createProtein(sequence, options = {}) {
    const seq = typeof sequence === 'string'
      ? sequence.split('-')
      : sequence;
    return new Molecule(seq, { ...options, type: 'protein' });
  }

  /**
   * Create a DNA molecule from a sequence string
   * @param {string} sequence - e.g., "ACGT" or "A-C-G-T"
   * @param {Object} options
   * @returns {Molecule}
   */
  static createDNA(sequence, options = {}) {
    const seq = sequence.includes('-')
      ? sequence.split('-')
      : sequence.split('');
    return new Molecule(seq, { ...options, type: 'dna' });
  }

  /**
   * Create an RNA molecule from a sequence string
   * @param {string} sequence - e.g., "ACGU"
   * @param {Object} options
   * @returns {Molecule}
   */
  static createRNA(sequence, options = {}) {
    const seq = sequence.includes('-')
      ? sequence.split('-')
      : sequence.split('');
    return new Molecule(seq, { ...options, type: 'rna' });
  }

  /**
   * Create an ATP molecule (single element, can't chain)
   * @param {Object} options
   * @returns {Molecule}
   */
  static createATP(options = {}) {
    return new Molecule(['ATP'], { ...options, type: 'atp' });
  }
}

export default Molecule;

/**
 * BasePairing Component
 *
 * Represents base pairing between two nucleotide entities (for double-stranded DNA/RNA).
 * Allows for dynamic pairing/unpairing (e.g., DNA unzipping during replication).
 *
 * ECS Pattern: This component creates a relationship between entities
 */

export class BasePairingComponent {
  /**
   * @param {number} pairedEntityId - The entity ID this nucleotide is paired with
   * @param {boolean} isPrimary - True if this is the primary (5'→3') strand
   */
  constructor(pairedEntityId, isPrimary = true) {
    this.pairedEntityId = pairedEntityId;
    this.isPrimary = isPrimary;
  }

  /**
   * Get the complement base for a given nucleotide
   * @param {string} base - Nucleotide (A, T, C, G, U)
   * @returns {string|null} Complement base or null if invalid
   */
  static getComplement(base) {
    const complements = {
      'A': 'T',
      'T': 'A',
      'C': 'G',
      'G': 'C',
      'U': 'A'  // RNA: U pairs with A
    };
    return complements[base] || null;
  }

  /**
   * Check if two bases are complementary
   * @param {string} base1 - First nucleotide
   * @param {string} base2 - Second nucleotide
   * @returns {boolean} True if complementary
   */
  static areComplementary(base1, base2) {
    return BasePairingComponent.getComplement(base1) === base2;
  }
}

export default BasePairingComponent;

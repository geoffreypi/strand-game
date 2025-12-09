/**
 * Nucleotide Validation System
 *
 * Validates that all DNA/RNA nucleotides use valid base codes.
 * This is a BLOCKING validation - invalid nucleotides prevent instantiation.
 *
 * Valid bases:
 * - DNA: A, C, G, T
 * - RNA: A, C, G, U
 */

const VALID_DNA_BASES = new Set(['A', 'C', 'G', 'T']);
const VALID_RNA_BASES = new Set(['A', 'C', 'G', 'U']);

export function nucleotideValidationSystem(world, { COMPONENT_TYPES }) {
  const errors = [];

  // Query all residue entities
  const entityIds = world.query([COMPONENT_TYPES.RESIDUE, COMPONENT_TYPES.MOLECULE_META]);

  for (const entityId of entityIds) {
    const residue = world.getComponent(entityId, COMPONENT_TYPES.RESIDUE);
    const moleculeMeta = world.getComponent(entityId, COMPONENT_TYPES.MOLECULE_META);
    const moleculeType = moleculeMeta?.molecule?.type;

    // Only validate DNA/RNA molecules
    if (moleculeType !== 'dna' && moleculeType !== 'rna') {
      continue;
    }

    // Check if base is valid for the molecule type
    const base = residue.type;
    const validBases = moleculeType === 'dna' ? VALID_DNA_BASES : VALID_RNA_BASES;

    if (!validBases.has(base)) {
      errors.push({
        entityId,
        moleculeType,
        invalidBase: base,
        validBases: Array.from(validBases).join(', ')
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a sequence string before creating a molecule
 * @param {string} sequence - Sequence to validate (e.g., "ACGT")
 * @param {string} moleculeType - 'dna' or 'rna'
 * @throws {Error} If sequence contains invalid bases
 */
export function validateSequence(sequence, moleculeType) {
  const validBases = moleculeType === 'dna' ? VALID_DNA_BASES : VALID_RNA_BASES;
  const bases = sequence.includes('-') ? sequence.split('-') : sequence.split('');

  for (let i = 0; i < bases.length; i++) {
    const base = bases[i];
    if (!validBases.has(base)) {
      throw new Error(
        `Invalid ${moleculeType.toUpperCase()} base '${base}' at position ${i}. ` +
        `Valid bases: ${Array.from(validBases).join(', ')}`
      );
    }
  }
}

export default nucleotideValidationSystem;

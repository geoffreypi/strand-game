/**
 * Amino Acid Properties for Protein Folding Game
 *
 * Energy scale: eV (electron volts)
 * - Angular penalty: 0.1 eV per 60° step from preferred angle
 * - Electrostatic: Adjacent opposite charges = -1.0 eV
 * - Hydrophobic: Burying a hydrophobic residue ≈ -1.5 eV
 * - Kinetic barrier (rotational): ~0.025 eV for small folds
 *
 * Masses are in Daltons (Da), based on real amino acid masses.
 *
 * Amino Acid Categories:
 * - STRUCTURAL (6): STR, L60, R60, L12, R12, FLX - Control folding geometry
 * - CHARGED (2): POS, NEG - Electrostatic interactions
 * - HYDROPHOBIC (2): PHO, PHI - Burial/exposure preferences
 * - DNA/RNA BINDING (4): BTA, BTC, BTG, BTT - Sequence recognition
 * - MECHANICAL (1): CRL - DNA/RNA manipulation
 * - CATALYTIC (2): RPF, PBF - Transcription & translation
 *
 * Total: 17 amino acid types
 */

/**
 * Amino acid properties:
 * - foldingPreference: Preferred bend angle and direction (null = no preference)
 * - preferredSteps: Preferred fold state in steps notation
 * - charge: Electrostatic charge (+1, -1, 0)
 * - hydrophobicity: 'hydrophobic', 'hydrophilic', or 'neutral'
 * - mass: Mass in Daltons (affects moment of inertia)
 * - bindsTo: Nucleotide this amino acid binds to (for BT* types)
 * - mechanical: Mechanical function (for CRL)
 * - catalytic: Catalytic function (for RPF, PBF)
 */

export const AMINO_ACID_TYPES = {
  // ========================================================================
  // STRUCTURAL - Control folding geometry
  // ========================================================================

  STR: {
    name: 'Straight',
    code: 'STR',
    foldingPreference: { angle: 0, direction: null },  // Prefers no bend
    preferredSteps: 0,  // 0 = straight
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 89,  // Da, like Alanine
    description: 'Prefers straight/no bend'
  },

  L60: {
    name: 'Left-60',
    code: 'L60',
    foldingPreference: { angle: 60, direction: 'left' },
    preferredSteps: 1,  // +1 = 60° left
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 115,  // Da, like Proline
    description: 'Prefers 60° left bend'
  },

  R60: {
    name: 'Right-60',
    code: 'R60',
    foldingPreference: { angle: 60, direction: 'right' },
    preferredSteps: -1,  // -1 = 60° right
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 115,  // Da, like Proline
    description: 'Prefers 60° right bend'
  },

  L12: {
    name: 'Left-120',
    code: 'L12',
    foldingPreference: { angle: 120, direction: 'left' },
    preferredSteps: 2,  // +2 = 120° left
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 131,  // Da, like Leucine
    description: 'Prefers 120° left bend (sharp turn)'
  },

  R12: {
    name: 'Right-120',
    code: 'R12',
    foldingPreference: { angle: 120, direction: 'right' },
    preferredSteps: -2,  // -2 = 120° right
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 131,  // Da, like Leucine
    description: 'Prefers 120° right bend (sharp turn)'
  },

  FLX: {
    name: 'Flexible',
    code: 'FLX',
    foldingPreference: null,  // No preference at all
    preferredSteps: 0,
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 75,  // Da, like Glycine (smallest, most flexible)
    description: 'Flexible, no preference, low energy barriers'
  },

  // ========================================================================
  // CHARGED - Electrostatic interactions
  // ========================================================================

  POS: {
    name: 'Positive',
    code: 'POS',
    foldingPreference: null,
    preferredSteps: 0,
    charge: +1,  // +1 elementary charge
    hydrophobicity: 'neutral',  // Neutral for cleaner electrostatic effects
    mass: 146,  // Da, like Lysine
    description: 'Positively charged, attracts negative charges'
  },

  NEG: {
    name: 'Negative',
    code: 'NEG',
    foldingPreference: null,
    preferredSteps: 0,
    charge: -1,  // -1 elementary charge
    hydrophobicity: 'neutral',  // Neutral for cleaner electrostatic effects
    mass: 133,  // Da, like Aspartic acid
    description: 'Negatively charged, attracts positive charges'
  },

  // ========================================================================
  // HYDROPHOBIC/HYDROPHILIC
  // ========================================================================

  PHO: {
    name: 'Hydrophobic',
    code: 'PHO',
    foldingPreference: null,
    preferredSteps: 0,
    charge: 0,
    hydrophobicity: 'hydrophobic',  // Wants to be buried
    mass: 149,  // Da, like Methionine
    description: 'Hydrophobic, wants to be buried in protein core'
  },

  PHI: {
    name: 'Hydrophilic',
    code: 'PHI',
    foldingPreference: null,
    preferredSteps: 0,
    charge: 0,
    hydrophobicity: 'hydrophilic',  // Wants to be on surface
    mass: 132,  // Da, like Asparagine
    description: 'Hydrophilic, wants to be on protein surface'
  },

  // ========================================================================
  // DNA/RNA BINDING - Sequence recognition
  // ========================================================================

  BTA: {
    name: 'Bind-Adenine',
    code: 'BTA',
    foldingPreference: null,
    preferredSteps: 0,
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 120,
    bindsTo: 'A',  // Binds to Adenine in DNA/RNA
    description: 'Binds to Adenine (A) nucleotide'
  },

  BTC: {
    name: 'Bind-Cytosine',
    code: 'BTC',
    foldingPreference: null,
    preferredSteps: 0,
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 120,
    bindsTo: 'C',  // Binds to Cytosine in DNA/RNA
    description: 'Binds to Cytosine (C) nucleotide'
  },

  BTG: {
    name: 'Bind-Guanine',
    code: 'BTG',
    foldingPreference: null,
    preferredSteps: 0,
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 120,
    bindsTo: 'G',  // Binds to Guanine in DNA/RNA
    description: 'Binds to Guanine (G) nucleotide'
  },

  BTT: {
    name: 'Bind-Thymine',
    code: 'BTT',
    foldingPreference: null,
    preferredSteps: 0,
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 120,
    bindsTo: 'T',  // Binds to Thymine in DNA (or Uracil in RNA)
    description: 'Binds to Thymine (T) in DNA or Uracil (U) in RNA'
  },

  // ========================================================================
  // MECHANICAL - DNA/RNA manipulation
  // ========================================================================

  CRL: {
    name: 'Curl',
    code: 'CRL',
    foldingPreference: null,
    preferredSteps: 0,
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 110,
    mechanical: 'curl',  // Causes bound DNA/RNA to bend toward protein
    description: 'Causes bound DNA/RNA to curl/bend toward it'
  },

  // ========================================================================
  // CATALYTIC - Transcription & Translation
  // ========================================================================

  RPF: {
    name: 'RNA-Polymerase-Function',
    code: 'RPF',
    foldingPreference: null,
    preferredSteps: 0,
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 180,
    catalytic: 'transcription',  // Catalyzes DNA -> RNA
    description: 'Catalyzes RNA synthesis (transcription). Reads DNA, produces complementary RNA.'
  },

  PBF: {
    name: 'Peptide-Bond-Former',
    code: 'PBF',
    foldingPreference: null,
    preferredSteps: 0,
    charge: 0,
    hydrophobicity: 'neutral',
    mass: 200,
    catalytic: 'translation',  // Catalyzes RNA -> Protein
    description: 'Catalyzes protein synthesis (translation). Reads mRNA codons, adds amino acids.'
  }
};

/**
 * Energy constants (all in eV)
 */
export const ENERGY_CONSTANTS = {
  // Angular/folding preference
  // Energy = ANGULAR_PENALTY × |currentSteps - preferredSteps|
  ANGULAR_PENALTY: 0.1,  // eV per 60° step from preferred angle

  // Kinetic barrier (rotational)
  // E_a = 0.5 × ROTATIONAL_SCALE × I × ω²
  // With realistic masses (~100 Da) and ROTATIONAL_SCALE = 1e-4,
  // a 60° fold of a 4-AA chain has E_a ≈ 0.025 eV ≈ 1 kT
  ROTATIONAL_SCALE: 1e-4,  // Converts Da·hex²·(rad/time)² to eV

  // Electrostatic
  COULOMB_CONSTANT: 1.0,  // eV·hex (adjacent opposite charges = -1 eV)
  DIELECTRIC: 1.0,        // Vacuum-like (1.0), water-like would be ~80

  // Hydrophobic
  HYDROPHOBIC_BURIAL: -1.5,    // eV per buried hydrophobic residue
  HYDROPHOBIC_EXPOSURE: +1.5,  // eV penalty per exposed hydrophobic residue
  HYDROPHILIC_BURIAL: +0.5,    // eV penalty per buried hydrophilic residue
  HYDROPHILIC_EXPOSURE: -0.5,  // eV bonus per exposed hydrophilic residue

  // Temperature
  BOLTZMANN_CONSTANT: 8.617e-5,  // eV/K
  ROOM_TEMPERATURE: 300,          // K (gives kT ≈ 0.026 eV)
};

/**
 * Helper function to get amino acid properties
 */
export function getAminoAcidProperties(code) {
  return AMINO_ACID_TYPES[code] || null;
}

/**
 * Helper function to check if amino acid has folding preference
 */
export function hasFoldingPreference(code) {
  const aa = AMINO_ACID_TYPES[code];
  return aa && aa.foldingPreference !== null;
}

/**
 * Calculate energy for a fold based on angular distance from preferred
 *
 * @param {string} aminoAcidCode - The amino acid type code
 * @param {number} currentSteps - Current fold state in steps (0=straight, +1=L60, -1=R60, +2=L12, -2=R12)
 * @returns {number} Energy in eV (0 at preferred, increases with distance)
 */
export function calculateFoldEnergy(aminoAcidCode, currentSteps) {
  const aa = AMINO_ACID_TYPES[aminoAcidCode];
  if (!aa) return 0;

  // FLX has no preference - all states equal energy
  if (aa.foldingPreference === null) {
    return 0;
  }

  const distance = Math.abs(currentSteps - aa.preferredSteps);
  return ENERGY_CONSTANTS.ANGULAR_PENALTY * distance;
}

/**
 * Calculate transition rate between fold states
 *
 * @param {string} aminoAcidCode - The amino acid type code
 * @param {number} fromSteps - Starting fold state
 * @param {number} toSteps - Target fold state
 * @param {number} E_a_base - Base kinetic barrier (from moment of inertia)
 * @returns {number} Transition rate (probability per time unit)
 */
export function calculateTransitionRate(aminoAcidCode, fromSteps, toSteps, E_a_base = 0.025) {
  const kT = ENERGY_CONSTANTS.BOLTZMANN_CONSTANT * ENERGY_CONSTANTS.ROOM_TEMPERATURE;

  const fromEnergy = calculateFoldEnergy(aminoAcidCode, fromSteps);
  const toEnergy = calculateFoldEnergy(aminoAcidCode, toSteps);
  const deltaE = toEnergy - fromEnergy;

  // Total barrier = kinetic barrier + thermodynamic hill (if uphill)
  const barrier = E_a_base + Math.max(0, deltaE);

  return Math.exp(-barrier / kT);
}

/**
 * Check if amino acid can bind to a nucleotide
 * @param {string} aminoAcidCode - The amino acid type code
 * @returns {string|null} The nucleotide it binds to, or null
 */
export function getBindingTarget(aminoAcidCode) {
  const aa = AMINO_ACID_TYPES[aminoAcidCode];
  return aa?.bindsTo || null;
}

/**
 * Check if amino acid has catalytic function
 * @param {string} aminoAcidCode - The amino acid type code
 * @returns {string|null} The catalytic function ('transcription' or 'translation'), or null
 */
export function getCatalyticFunction(aminoAcidCode) {
  const aa = AMINO_ACID_TYPES[aminoAcidCode];
  return aa?.catalytic || null;
}

/**
 * Check if amino acid has mechanical function
 * @param {string} aminoAcidCode - The amino acid type code
 * @returns {string|null} The mechanical function ('curl'), or null
 */
export function getMechanicalFunction(aminoAcidCode) {
  const aa = AMINO_ACID_TYPES[aminoAcidCode];
  return aa?.mechanical || null;
}

/**
 * Check if amino acid can bind to a specific nucleotide
 * @param {string} aminoAcidCode - The amino acid type code
 * @param {string} nucleotide - The nucleotide to check ('A', 'C', 'G', 'T', 'U')
 * @returns {boolean} True if the amino acid binds to this nucleotide
 */
export function canBindToNucleotide(aminoAcidCode, nucleotide) {
  const bindTarget = getBindingTarget(aminoAcidCode);
  if (!bindTarget) return false;

  // BTT binds to both T and U
  if (bindTarget === 'T' && nucleotide === 'U') return true;

  return bindTarget === nucleotide;
}

/**
 * Get all amino acids that can bind to nucleotides
 * @returns {string[]} Array of amino acid codes
 */
export function getNucleotideBindingAminoAcids() {
  return Object.keys(AMINO_ACID_TYPES).filter(code =>
    AMINO_ACID_TYPES[code].bindsTo !== undefined
  );
}

/**
 * Get all amino acids with catalytic function
 * @returns {string[]} Array of amino acid codes
 */
export function getCatalyticAminoAcids() {
  return Object.keys(AMINO_ACID_TYPES).filter(code =>
    AMINO_ACID_TYPES[code].catalytic !== undefined
  );
}

// ES Module export
export default AMINO_ACID_TYPES;

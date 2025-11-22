/**
 * Energy Calculations for Protein Folding
 * All energies in eV (electron volts)
 *
 * Energy model:
 * - Angular penalty: 0.1 eV per 60° step from preferred angle
 * - Electrostatic: 1/r Coulomb potential, adjacent opposite charges = -1 eV
 * - Hydrophobic: burial/exposure bonuses/penalties
 * - Kinetic barrier: rotational energy E_a = 0.5 × ROTATIONAL_SCALE × I × ω²
 */

import { AMINO_ACID_TYPES, ENERGY_CONSTANTS, calculateFoldEnergy } from '../data/amino-acids.js';
import { hexDistance, sequenceToHexGrid } from '../core/hex-layout.js';

/**
 * Calculate total energy of a protein in its current state
 * @param {Object} protein - Protein object with amino acids and positions
 * @returns {number} Total energy in eV
 */
export function calculateProteinEnergy(protein) {
  let E_total = 0;

  E_total += calculateElectrostaticEnergy(protein);
  E_total += calculateHydrophobicEnergy(protein);
  E_total += calculateFoldingPreferenceEnergy(protein);
  E_total += calculateStericEnergy(protein);

  return E_total;
}

/**
 * Electrostatic energy from charged amino acids
 * 2D Coulomb potential: E = k * q1 * q2 * ln(r)
 * (In 2D, the solution to Poisson's equation gives logarithmic potential)
 *
 * For opposite charges (q1*q2 = -1):
 *   E = k * (-1) * ln(r) = -k * ln(r)
 *   r=1: E = 0
 *   r<1: E > 0 (closer = more negative = more attractive)
 *   r>1: E < 0 (farther = less attractive)
 *
 * We scale k so that meaningful energy differences occur over our distance range.
 */
export function calculateElectrostaticEnergy(protein) {
  let E = 0;
  const { COULOMB_CONSTANT } = ENERGY_CONSTANTS;

  for (let i = 0; i < protein.aminoAcids.length; i++) {
    for (let j = i + 1; j < protein.aminoAcids.length; j++) {
      const aa1 = protein.aminoAcids[i];
      const aa2 = protein.aminoAcids[j];

      const q1 = AMINO_ACID_TYPES[aa1.type]?.charge || 0;
      const q2 = AMINO_ACID_TYPES[aa2.type]?.charge || 0;

      if (q1 === 0 || q2 === 0) continue;

      const r = hexDistance(aa1.position, aa2.position);

      if (r > 0) {
        // 2D Coulomb potential: E = -k * q1 * q2 * ln(r)
        // Opposite charges (q1*q2 < 0): E decreases as r decreases (attractive)
        // Like charges (q1*q2 > 0): E increases as r decreases (repulsive)
        E += -COULOMB_CONSTANT * q1 * q2 * Math.log(r);
      }
    }
  }

  return E;
}

/**
 * Hydrophobic effect energy
 * Hydrophobic residues want to be buried, hydrophilic want to be exposed
 */
export function calculateHydrophobicEnergy(protein) {
  let E = 0;
  const { HYDROPHOBIC_BURIAL, HYDROPHOBIC_EXPOSURE, HYDROPHILIC_BURIAL, HYDROPHILIC_EXPOSURE } = ENERGY_CONSTANTS;

  for (let i = 0; i < protein.aminoAcids.length; i++) {
    const aa = protein.aminoAcids[i];
    const props = AMINO_ACID_TYPES[aa.type];
    if (!props) continue;

    const exposure = calculateSolventExposure(protein, i);

    if (props.hydrophobicity === 'hydrophobic') {
      // Hydrophobic: wants to be buried (low exposure)
      // Fully buried (exposure=0): E = BURIAL (negative, favorable)
      // Fully exposed (exposure=1): E = EXPOSURE (positive, unfavorable)
      E += HYDROPHOBIC_EXPOSURE * exposure + HYDROPHOBIC_BURIAL * (1 - exposure);
    } else if (props.hydrophobicity === 'hydrophilic') {
      // Hydrophilic: wants to be exposed (high exposure)
      // Fully buried: penalty
      // Fully exposed: bonus
      E += HYDROPHILIC_BURIAL * (1 - exposure) + HYDROPHILIC_EXPOSURE * exposure;
    }
    // Neutral hydrophobicity contributes 0
  }

  return E;
}

/**
 * Calculate solvent exposure for an amino acid
 * 0 = fully buried, 1 = fully exposed
 */
function calculateSolventExposure(protein, index) {
  const aa = protein.aminoAcids[index];
  let neighbors = 0;

  for (let j = 0; j < protein.aminoAcids.length; j++) {
    if (j === index) continue;

    const other = protein.aminoAcids[j];
    const dist = hexDistance(aa.position, other.position);

    // Count neighbors within contact distance
    if (dist <= 1.5) {  // Adjacent or very close
      neighbors++;
    }
  }

  // Maximum possible neighbors in hex grid ≈ 6
  // More neighbors = more buried
  const maxNeighbors = 6;
  const burial = Math.min(neighbors / maxNeighbors, 1.0);
  return 1.0 - burial;  // exposure = 1 - burial
}

/**
 * Energy from folding preferences using angular distance model
 *
 * Each amino acid has a preferred fold state (in steps: 0=straight, ±1=60°, ±2=120°)
 * Energy = ANGULAR_PENALTY × |currentSteps - preferredSteps|
 */
export function calculateFoldingPreferenceEnergy(protein) {
  let E = 0;

  // For each amino acid (except first and last which can't bend)
  for (let i = 1; i < protein.aminoAcids.length - 1; i++) {
    const aa = protein.aminoAcids[i];

    // Find if there's a fold at this position
    const fold = protein.folds.find(f => f.position === i);

    // Get current steps (0 if no fold = straight)
    const currentSteps = fold ? angleToSteps(fold.angle, fold.direction) : 0;

    // Calculate energy based on angular distance from preferred
    E += calculateFoldEnergy(aa.type, currentSteps);
  }

  return E;
}

/**
 * Convert angle and direction to step notation
 * Steps: 0=straight, +1=L60, -1=R60, +2=L12, -2=R12
 */
export function angleToSteps(angle, direction) {
  if (angle === 0) return 0;

  const steps = Math.round(angle / 60);

  if (direction === 'left') {
    return steps;
  } else if (direction === 'right') {
    return -steps;
  }

  return 0;
}

/**
 * Convert steps back to angle and direction
 */
export function stepsToAngle(steps) {
  if (steps === 0) {
    return { angle: 0, direction: null };
  }

  const angle = Math.abs(steps) * 60;
  const direction = steps > 0 ? 'left' : 'right';

  return { angle, direction };
}

/**
 * Steric clash energy (repulsion when too close)
 * Prevents overlaps
 */
export function calculateStericEnergy(protein) {
  let E = 0;
  const CLASH_DISTANCE = 0.5;  // Hexes
  const CLASH_PENALTY = 100.0;  // eV (very high to prevent overlaps)

  for (let i = 0; i < protein.aminoAcids.length; i++) {
    for (let j = i + 2; j < protein.aminoAcids.length; j++) {
      // Skip adjacent amino acids (they're bonded)
      const aa1 = protein.aminoAcids[i];
      const aa2 = protein.aminoAcids[j];

      const r = hexDistance(aa1.position, aa2.position);

      if (r < CLASH_DISTANCE) {
        // Severe steric clash - Lennard-Jones-like repulsion
        // E ∝ 1/r^12 (simplified to exponential)
        E += CLASH_PENALTY * Math.exp(-r / 0.1);
      }
    }
  }

  return E;
}

/**
 * Calculate reduced moment of inertia for a fold at the given position.
 *
 * When a fold occurs, both portions of the chain rotate in opposite directions
 * (in the center-of-mass frame) to conserve angular momentum. The kinetic energy is:
 *
 *   E = ½ I_left ω_left² + ½ I_right ω_right²
 *
 * With angular momentum conservation and a relative rotation Δθ:
 *
 *   E = ½ Δθ² × (I_left × I_right) / (I_left + I_right)
 *
 * The reduced moment of inertia I_reduced = (I_left × I_right) / (I_left + I_right)
 * is the rotational analog of reduced mass in two-body problems.
 *
 * @param {Object} protein - Protein with aminoAcids and their positions
 * @param {number} bendPosition - Position where the bend occurs (pivot point)
 * @returns {number} Reduced moment of inertia in Da·hex²
 */
export function calculateMomentOfInertia(protein, bendPosition = null) {
  // If no bend position specified, use old behavior (whole chain about CoM)
  if (bendPosition === null) {
    return calculateMomentOfInertiaAboutCoM(protein);
  }

  const pivot = protein.aminoAcids[bendPosition];
  if (!pivot) return 0;

  const pivotPos = hexToCartesian(pivot.position);

  // Calculate I_left: moment of inertia of residues 0 to bendPosition about pivot
  let I_left = 0;
  for (let i = 0; i <= bendPosition; i++) {
    const aa = protein.aminoAcids[i];
    const mass = AMINO_ACID_TYPES[aa.type]?.mass || 100;
    const pos = hexToCartesian(aa.position);
    const dx = pos.x - pivotPos.x;
    const dy = pos.y - pivotPos.y;
    I_left += mass * (dx * dx + dy * dy);
  }

  // Calculate I_right: moment of inertia of residues bendPosition+1 to end about pivot
  let I_right = 0;
  for (let i = bendPosition + 1; i < protein.aminoAcids.length; i++) {
    const aa = protein.aminoAcids[i];
    const mass = AMINO_ACID_TYPES[aa.type]?.mass || 100;
    const pos = hexToCartesian(aa.position);
    const dx = pos.x - pivotPos.x;
    const dy = pos.y - pivotPos.y;
    I_right += mass * (dx * dx + dy * dy);
  }

  // Reduced moment of inertia
  if (I_left + I_right === 0) return 0;
  return (I_left * I_right) / (I_left + I_right);
}

/**
 * Calculate moment of inertia about center of mass for the whole chain
 * (Legacy function, kept for compatibility)
 */
function calculateMomentOfInertiaAboutCoM(protein) {
  let totalMass = 0;
  let cx = 0, cy = 0;

  for (const aa of protein.aminoAcids) {
    const mass = AMINO_ACID_TYPES[aa.type]?.mass || 100;
    const pos = hexToCartesian(aa.position);
    cx += mass * pos.x;
    cy += mass * pos.y;
    totalMass += mass;
  }

  const comX = cx / totalMass;
  const comY = cy / totalMass;

  let I = 0;
  for (const aa of protein.aminoAcids) {
    const mass = AMINO_ACID_TYPES[aa.type]?.mass || 100;
    const pos = hexToCartesian(aa.position);
    const dx = pos.x - comX;
    const dy = pos.y - comY;
    I += mass * (dx * dx + dy * dy);
  }

  return I;
}

/**
 * Convert hex coordinates to cartesian
 */
function hexToCartesian(pos) {
  const x = pos.q + pos.r * 0.5;
  const y = pos.r * Math.sqrt(3) / 2;
  return { x, y };
}

/**
 * Calculate kinetic (rotational) barrier for a fold transition
 * E_a = 0.5 × ROTATIONAL_SCALE × I × ω²
 *
 * Uses local rotation model: only the portion of the chain after the bend
 * position contributes to the moment of inertia.
 *
 * @param {Object} protein - Current protein state
 * @param {number} angleChange - Angle change in degrees
 * @param {number} bendPosition - Position where the bend occurs
 * @returns {number} Activation energy in eV
 */
export function calculateKineticBarrier(protein, angleChange, bendPosition = null) {
  const I = calculateMomentOfInertia(protein, bendPosition);
  const { ROTATIONAL_SCALE } = ENERGY_CONSTANTS;

  const angle_rad = angleChange * Math.PI / 180;
  // ω = angle / time, with time = 1 unit
  const omega = angle_rad;

  return 0.5 * ROTATIONAL_SCALE * I * omega * omega;
}

/**
 * Calculate transition rate from current state to target state
 *
 * Rate = exp(-(E_a + max(0, ΔE)) / kT)
 *
 * Where:
 * - E_a is the kinetic barrier (from moment of inertia)
 * - ΔE is the thermodynamic energy change
 *
 * This ensures detailed balance: k_forward / k_reverse = exp(-ΔE/kT)
 *
 * @param {number} E_a_kinetic - Kinetic barrier in eV
 * @param {number} deltaE - Energy change (E_final - E_initial) in eV
 * @param {number} temperature - Temperature in K (default 300K)
 * @returns {number} Transition rate (probability per time unit)
 */
export function calculateTransitionRate(E_a_kinetic, deltaE, temperature = ENERGY_CONSTANTS.ROOM_TEMPERATURE) {
  const kT = ENERGY_CONSTANTS.BOLTZMANN_CONSTANT * temperature;

  // Total barrier = kinetic barrier + thermodynamic hill (if uphill)
  const totalBarrier = E_a_kinetic + Math.max(0, deltaE);

  return Math.exp(-totalBarrier / kT);
}

/**
 * Build a protein object with real hex positions from sequence and fold states
 * @param {string[]} sequence - Array of amino acid type codes
 * @param {number[]} foldStates - Array of fold states in steps notation
 * @returns {Object} Protein object with aminoAcids (including positions) and folds
 */
export function buildProteinWithPositions(sequence, foldStates) {
  const sequenceStr = sequence.join('-');
  const bends = [];

  for (let i = 1; i < foldStates.length - 1; i++) {
    const steps = foldStates[i];
    if (steps !== 0) {
      bends.push({
        position: i,
        angle: Math.abs(steps) * 60,
        direction: steps > 0 ? 'left' : 'right'
      });
    }
  }

  // Get hex positions (may throw on overlap)
  const hexGrid = sequenceToHexGrid(sequenceStr, bends);

  const aminoAcids = sequence.map((type, i) => ({
    type,
    position: { q: hexGrid[i].q, r: hexGrid[i].r }
  }));

  const folds = bends.map(b => ({
    position: b.position,
    angle: b.angle,
    direction: b.direction
  }));

  return { aminoAcids, folds };
}

/**
 * Calculate full protein energy including electrostatics
 * @param {string[]} sequence - Array of amino acid type codes
 * @param {number[]} foldStates - Array of fold states in steps notation
 * @returns {number} Total energy in eV, or Infinity if configuration is invalid
 */
export function calculateFullEnergy(sequence, foldStates) {
  try {
    const protein = buildProteinWithPositions(sequence, foldStates);
    return calculateProteinEnergy(protein);
  } catch (error) {
    if (error.message.includes('Overlap')) {
      return Infinity;  // Invalid configuration
    }
    throw error;
  }
}

/**
 * Build transition matrix for all possible single-bend transitions from current state
 * Now includes full energy calculation with electrostatics
 *
 * @param {Object} protein - Current protein state
 * @param {number} temperature - Temperature in K
 * @param {string[]} sequence - Optional: amino acid sequence for full energy calc
 * @param {number[]} currentFoldStates - Optional: current fold states for full energy calc
 * @returns {Array} Array of possible transitions with rates
 */
export function buildTransitionMatrix(protein, temperature = ENERGY_CONSTANTS.ROOM_TEMPERATURE, sequence = null, currentFoldStates = null) {
  const transitions = [];

  // Calculate current full energy if sequence provided
  const useFullEnergy = sequence !== null && currentFoldStates !== null;
  let currentFullEnergy = 0;
  if (useFullEnergy) {
    currentFullEnergy = calculateFullEnergy(sequence, currentFoldStates);
  }

  // For each bend position (between amino acids, not at ends)
  for (let pos = 1; pos < protein.aminoAcids.length - 1; pos++) {
    const currentFold = protein.folds.find(f => f.position === pos);
    const currentSteps = currentFold ? angleToSteps(currentFold.angle, currentFold.direction) : 0;

    // Try each possible target state (5 states: STR, L60, R60, L12, R12)
    for (let targetSteps = -2; targetSteps <= 2; targetSteps++) {
      if (targetSteps === currentSteps) continue;  // No change

      // Only allow transitions of ±1 or ±2 steps (max 120°)
      const stepChange = Math.abs(targetSteps - currentSteps);
      if (stepChange > 2) continue;

      const angleChange = stepChange * 60;
      const E_a_kinetic = calculateKineticBarrier(protein, angleChange, pos);

      let deltaE;
      if (useFullEnergy) {
        // Calculate full energy of target state including electrostatics
        const targetFoldStates = [...currentFoldStates];
        targetFoldStates[pos] = targetSteps;
        const targetFullEnergy = calculateFullEnergy(sequence, targetFoldStates);
        deltaE = targetFullEnergy - currentFullEnergy;
      } else {
        // Fallback: use only the amino acid's fold energy
        const aa = protein.aminoAcids[pos];
        const currentFoldEnergy = calculateFoldEnergy(aa.type, currentSteps);
        const targetFoldEnergy = calculateFoldEnergy(aa.type, targetSteps);
        deltaE = targetFoldEnergy - currentFoldEnergy;
      }

      const rate = calculateTransitionRate(E_a_kinetic, deltaE, temperature);

      const { angle, direction } = stepsToAngle(targetSteps);

      transitions.push({
        position: pos,
        fromSteps: currentSteps,
        toSteps: targetSteps,
        angle,
        direction,
        angleChange,
        E_a_kinetic,
        deltaE,
        rate,
      });
    }
  }

  // Also include "no transition" (stay in current state)
  const totalRate = transitions.reduce((sum, t) => sum + t.rate, 0);
  const stayRate = Math.max(0, 1 - totalRate);

  return {
    transitions,
    totalRate,
    stayRate,
  };
}

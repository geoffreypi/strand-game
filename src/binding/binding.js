/**
 * Binding System for Protein-DNA Interactions
 *
 * Handles automatic detection and binding of proteins to DNA based on:
 * - Binding amino acids (BTA, BTC, BTG, BTT) in proteins
 * - Complementary nucleotide sequences in DNA
 * - Physical shape compatibility (protein must fit along DNA without overlap)
 */

import { getBindingTarget } from '../data/amino-acids.js';

/**
 * Extract binding pattern from a protein
 * Returns array of { position, aminoAcid, bindsTo } for each BT* residue
 *
 * @param {Object} protein - Protein with aminoAcids array
 * @returns {Array} Binding sites in the protein
 */
export function extractBindingPattern(protein) {
  const pattern = [];

  for (let i = 0; i < protein.aminoAcids.length; i++) {
    const aa = protein.aminoAcids[i];
    const bindsTo = getBindingTarget(aa.type);

    if (bindsTo) {
      pattern.push({
        position: i,
        aminoAcid: aa.type,
        bindsTo: bindsTo,
        hexPosition: aa.position  // {q, r} in hex coordinates
      });
    }
  }

  return pattern;
}

/**
 * Extract nucleotide sequence from DNA strand
 *
 * @param {Object} dna - DNA object with topHexes or bottomHexes
 * @param {string} strand - 'top' or 'bottom'
 * @returns {Array} Array of { position, nucleotide, hexPosition }
 */
export function extractDNASequence(dna, strand = 'top') {
  const hexes = strand === 'top' ? dna.topHexes : dna.bottomHexes;

  return hexes.map((hex, i) => ({
    position: i,
    nucleotide: hex.type,
    hexPosition: { q: hex.q, r: hex.r }
  }));
}

/**
 * Find all positions where a binding pattern matches a DNA sequence
 *
 * @param {Array} bindingPattern - From extractBindingPattern()
 * @param {Array} dnaSequence - From extractDNASequence()
 * @returns {Array} Array of { dnaStartIndex, matches } for each valid match
 */
export function findSequenceMatches(bindingPattern, dnaSequence) {
  if (bindingPattern.length === 0) return [];

  const matches = [];

  // Slide along DNA looking for matches
  for (let dnaStart = 0; dnaStart <= dnaSequence.length - bindingPattern.length; dnaStart++) {
    let isMatch = true;
    const matchDetails = [];

    for (let i = 0; i < bindingPattern.length; i++) {
      const dnaPos = dnaStart + i;
      const nucleotide = dnaSequence[dnaPos].nucleotide;
      const bindTarget = bindingPattern[i].bindsTo;

      // Check if this binding AA can bind to this nucleotide
      // (BTT can bind to both T and U)
      const canBind = bindTarget === nucleotide ||
                      (bindTarget === 'T' && nucleotide === 'U');

      if (!canBind) {
        isMatch = false;
        break;
      }

      matchDetails.push({
        proteinBindingSite: bindingPattern[i],
        dnaNucleotide: dnaSequence[dnaPos]
      });
    }

    if (isMatch) {
      matches.push({
        dnaStartIndex: dnaStart,
        matches: matchDetails
      });
    }
  }

  return matches;
}

/**
 * Check if binding sites in protein are contiguous (adjacent in sequence)
 * Non-contiguous binding sites may still work but need different geometry checks
 *
 * @param {Array} bindingPattern - From extractBindingPattern()
 * @returns {boolean} True if all binding AAs are adjacent in sequence
 */
export function isContiguousBindingPattern(bindingPattern) {
  if (bindingPattern.length <= 1) return true;

  for (let i = 1; i < bindingPattern.length; i++) {
    if (bindingPattern[i].position !== bindingPattern[i-1].position + 1) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate the relative positions of binding sites in the protein
 * Returns vectors from first binding site to each subsequent one
 *
 * @param {Array} bindingPattern - From extractBindingPattern()
 * @returns {Array} Array of {dx, dy} offsets from first binding site
 */
export function getBindingGeometry(bindingPattern) {
  if (bindingPattern.length === 0) return [];

  const first = bindingPattern[0].hexPosition;

  // Convert hex to cartesian for geometry
  const toCartesian = (hex) => ({
    x: hex.q + hex.r * 0.5,
    y: hex.r * Math.sqrt(3) / 2
  });

  const firstCart = toCartesian(first);

  return bindingPattern.map(bp => {
    const cart = toCartesian(bp.hexPosition);
    return {
      dx: cart.x - firstCart.x,
      dy: cart.y - firstCart.y,
      position: bp.position,
      bindsTo: bp.bindsTo
    };
  });
}

/**
 * Calculate the relative positions of nucleotides in DNA
 *
 * @param {Array} dnaSequence - From extractDNASequence()
 * @param {number} startIndex - Starting position in DNA
 * @param {number} length - Number of nucleotides
 * @returns {Array} Array of {dx, dy} offsets from first nucleotide
 */
export function getDNAGeometry(dnaSequence, startIndex, length) {
  if (length === 0 || startIndex + length > dnaSequence.length) return [];

  const toCartesian = (hex) => ({
    x: hex.q + hex.r * 0.5,
    y: hex.r * Math.sqrt(3) / 2
  });

  const first = dnaSequence[startIndex].hexPosition;
  const firstCart = toCartesian(first);

  const geometry = [];
  for (let i = 0; i < length; i++) {
    const nuc = dnaSequence[startIndex + i];
    const cart = toCartesian(nuc.hexPosition);
    geometry.push({
      dx: cart.x - firstCart.x,
      dy: cart.y - firstCart.y,
      position: nuc.position,
      nucleotide: nuc.nucleotide
    });
  }

  return geometry;
}

/**
 * Check if protein binding geometry matches DNA geometry
 * The protein's binding sites must be able to align with DNA nucleotides
 *
 * For a straight protein binding to straight DNA, the binding sites
 * should form a line parallel to the DNA strand.
 *
 * @param {Array} proteinGeometry - From getBindingGeometry()
 * @param {Array} dnaGeometry - From getDNAGeometry()
 * @param {number} tolerance - Maximum allowed distance mismatch (default 0.5)
 * @returns {Object} { compatible: boolean, offset: {x, y}, rotation: number }
 */
export function checkGeometryCompatibility(proteinGeometry, dnaGeometry, tolerance = 0.5) {
  if (proteinGeometry.length !== dnaGeometry.length) {
    return { compatible: false, reason: 'Length mismatch' };
  }

  if (proteinGeometry.length === 0) {
    return { compatible: true, offset: { x: 0, y: 0 }, rotation: 0 };
  }

  if (proteinGeometry.length === 1) {
    // Single binding site always compatible (just needs to be adjacent)
    return { compatible: true, offset: { x: 0, y: 0 }, rotation: 0 };
  }

  // For multiple binding sites, check if the pattern of offsets matches
  // We need to find if there's a rotation that aligns protein geometry to DNA geometry

  // Calculate vectors between consecutive points
  const proteinVectors = [];
  const dnaVectors = [];

  for (let i = 1; i < proteinGeometry.length; i++) {
    proteinVectors.push({
      dx: proteinGeometry[i].dx - proteinGeometry[i-1].dx,
      dy: proteinGeometry[i].dy - proteinGeometry[i-1].dy
    });
    dnaVectors.push({
      dx: dnaGeometry[i].dx - dnaGeometry[i-1].dx,
      dy: dnaGeometry[i].dy - dnaGeometry[i-1].dy
    });
  }

  // Check if vectors match (allowing for some tolerance)
  // The protein may need to be offset perpendicular to the DNA
  let totalMismatch = 0;

  for (let i = 0; i < proteinVectors.length; i++) {
    const pv = proteinVectors[i];
    const dv = dnaVectors[i];

    // Calculate distance between vectors
    const dist = Math.sqrt(
      Math.pow(pv.dx - dv.dx, 2) +
      Math.pow(pv.dy - dv.dy, 2)
    );

    totalMismatch += dist;
  }

  const avgMismatch = totalMismatch / proteinVectors.length;

  if (avgMismatch <= tolerance) {
    return {
      compatible: true,
      offset: { x: 0, y: 0 },  // TODO: calculate actual offset needed
      avgMismatch
    };
  }

  return {
    compatible: false,
    reason: 'Geometry mismatch',
    avgMismatch
  };
}

/**
 * Find all valid binding configurations between a protein and DNA
 *
 * @param {Object} protein - Protein with aminoAcids array (with positions)
 * @param {Object} dna - DNA with topHexes and bottomHexes
 * @returns {Array} Array of valid binding configurations
 */
export function findBindingConfigurations(protein, dna) {
  const bindingPattern = extractBindingPattern(protein);

  if (bindingPattern.length === 0) {
    return [];  // No binding amino acids in protein
  }

  const configurations = [];

  // Check both strands
  for (const strand of ['top', 'bottom']) {
    const dnaSequence = extractDNASequence(dna, strand);
    const sequenceMatches = findSequenceMatches(bindingPattern, dnaSequence);

    for (const match of sequenceMatches) {
      const proteinGeometry = getBindingGeometry(bindingPattern);
      const dnaGeometry = getDNAGeometry(dnaSequence, match.dnaStartIndex, bindingPattern.length);
      const geometryCheck = checkGeometryCompatibility(proteinGeometry, dnaGeometry);

      if (geometryCheck.compatible) {
        configurations.push({
          strand,
          dnaStartIndex: match.dnaStartIndex,
          matches: match.matches,
          geometryCheck,
          bindingStrength: bindingPattern.length  // More binding sites = stronger
        });
      }
    }
  }

  return configurations;
}

/**
 * Represents a bound complex (protein bound to DNA)
 */
export class BoundComplex {
  constructor(protein, dna, configuration) {
    this.protein = protein;
    this.dna = dna;
    this.configuration = configuration;
    this.boundAt = Date.now();
  }

  /**
   * Get the binding strength (number of binding sites)
   */
  get strength() {
    return this.configuration.bindingStrength;
  }

  /**
   * Get which strand the protein is bound to
   */
  get strand() {
    return this.configuration.strand;
  }

  /**
   * Get the DNA position where binding starts
   */
  get dnaPosition() {
    return this.configuration.dnaStartIndex;
  }
}

/**
 * Binding Manager - tracks all molecules and manages automatic binding
 */
export class BindingManager {
  constructor() {
    this.proteins = new Map();  // id -> protein
    this.dnas = new Map();      // id -> dna
    this.boundComplexes = [];   // Active bound complexes
    this.nextId = 1;
  }

  /**
   * Register a protein for binding detection
   */
  addProtein(protein) {
    const id = this.nextId++;
    this.proteins.set(id, { id, protein, boundTo: null });
    return id;
  }

  /**
   * Register a DNA molecule for binding detection
   */
  addDNA(dna) {
    const id = this.nextId++;
    this.dnas.set(id, { id, dna, boundProteins: [] });
    return id;
  }

  /**
   * Remove a protein
   */
  removeProtein(id) {
    const entry = this.proteins.get(id);
    if (entry && entry.boundTo) {
      this.unbind(id);
    }
    this.proteins.delete(id);
  }

  /**
   * Remove a DNA molecule
   */
  removeDNA(id) {
    const entry = this.dnas.get(id);
    if (entry) {
      // Unbind all proteins from this DNA
      for (const proteinId of entry.boundProteins) {
        const proteinEntry = this.proteins.get(proteinId);
        if (proteinEntry) {
          proteinEntry.boundTo = null;
        }
      }
    }
    this.dnas.delete(id);
  }

  /**
   * Check for and create new bindings
   * This is the "background function" that runs periodically
   *
   * @returns {Array} New bindings created this tick
   */
  checkForBindings() {
    const newBindings = [];

    // Check each unbound protein against each DNA
    for (const [proteinId, proteinEntry] of this.proteins) {
      if (proteinEntry.boundTo) continue;  // Already bound

      for (const [dnaId, dnaEntry] of this.dnas) {
        const configurations = findBindingConfigurations(
          proteinEntry.protein,
          dnaEntry.dna
        );

        if (configurations.length > 0) {
          // Use the strongest binding configuration
          const bestConfig = configurations.reduce((a, b) =>
            a.bindingStrength > b.bindingStrength ? a : b
          );

          // Create the binding
          const complex = new BoundComplex(
            proteinEntry.protein,
            dnaEntry.dna,
            bestConfig
          );

          this.boundComplexes.push(complex);
          proteinEntry.boundTo = dnaId;
          dnaEntry.boundProteins.push(proteinId);

          newBindings.push({
            proteinId,
            dnaId,
            complex,
            configuration: bestConfig
          });

          break;  // Protein can only bind to one DNA at a time
        }
      }
    }

    return newBindings;
  }

  /**
   * Unbind a protein from its DNA
   */
  unbind(proteinId) {
    const proteinEntry = this.proteins.get(proteinId);
    if (!proteinEntry || !proteinEntry.boundTo) return false;

    const dnaEntry = this.dnas.get(proteinEntry.boundTo);
    if (dnaEntry) {
      dnaEntry.boundProteins = dnaEntry.boundProteins.filter(id => id !== proteinId);
    }

    // Remove from bound complexes
    this.boundComplexes = this.boundComplexes.filter(c =>
      c.protein !== proteinEntry.protein
    );

    proteinEntry.boundTo = null;
    return true;
  }

  /**
   * Get all current bound complexes
   */
  getBoundComplexes() {
    return [...this.boundComplexes];
  }

  /**
   * Check if a protein is bound
   */
  isProteinBound(proteinId) {
    const entry = this.proteins.get(proteinId);
    return entry ? entry.boundTo !== null : false;
  }
}

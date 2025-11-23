/**
 * Binding System for Protein-DNA Interactions
 *
 * Handles detection and binding of proteins to DNA based on:
 * - Binding amino acids (BTA, BTC, BTG, BTT) in proteins
 * - Complementary nucleotide sequences in DNA
 * - Hex grid geometry (proper neighbor directions)
 *
 * Binding Rules:
 * 1. BTx residues must be contiguous in the protein
 * 2. Matching DNA segment must be straight (no bends in binding region)
 * 3. Protein and DNA are immediately adjacent (direct hex neighbors)
 * 4. Binding direction follows protein's N→C orientation:
 *    - Above DNA, going East: SE connections
 *    - Above DNA, going West: SW connections
 *    - Below DNA, going East: NE connections
 *    - Below DNA, going West: NW connections
 */

import { getBindingTarget } from '../data/amino-acids.js';

// =============================================================================
// Hex Grid Utilities
// =============================================================================

/**
 * Get the 6 neighbors of a hex in axial coordinates
 * Returns { E, W, NE, NW, SE, SW } with their {q, r} positions
 */
export function getHexNeighbors(q, r) {
  return {
    E:  { q: q + 1, r: r },
    W:  { q: q - 1, r: r },
    NE: { q: q + 1, r: r - 1 },
    NW: { q: q,     r: r - 1 },
    SE: { q: q,     r: r + 1 },
    SW: { q: q - 1, r: r + 1 }
  };
}

/**
 * Check if two hex positions are equal
 */
export function hexEquals(a, b) {
  return a.q === b.q && a.r === b.r;
}

/**
 * Check if two hexes are neighbors and return the direction
 * @returns {string|null} Direction from a to b ('E', 'W', 'NE', 'NW', 'SE', 'SW') or null
 */
export function getNeighborDirection(from, to) {
  const neighbors = getHexNeighbors(from.q, from.r);
  for (const [dir, pos] of Object.entries(neighbors)) {
    if (hexEquals(pos, to)) {
      return dir;
    }
  }
  return null;
}

/**
 * Check if a sequence of hex positions forms a straight line
 * @param {Array} positions - Array of {q, r} positions
 * @returns {Object} { straight: boolean, direction: string|null }
 */
export function isHexLineStraight(positions) {
  if (positions.length <= 1) {
    return { straight: true, direction: null };
  }

  // Get direction from first to second position
  const firstDir = getNeighborDirection(positions[0], positions[1]);
  if (!firstDir) {
    return { straight: false, direction: null, reason: 'Non-adjacent hexes' };
  }

  // Check all subsequent positions use same direction
  for (let i = 2; i < positions.length; i++) {
    const dir = getNeighborDirection(positions[i - 1], positions[i]);
    if (dir !== firstDir) {
      return { straight: false, direction: null, reason: 'Direction change' };
    }
  }

  return { straight: true, direction: firstDir };
}

// =============================================================================
// Pattern Extraction (kept from original)
// =============================================================================

/**
 * Extract binding pattern from a protein
 * Returns array of { position, aminoAcid, bindsTo, hexPosition } for each BT* residue
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
 */
export function findSequenceMatches(bindingPattern, dnaSequence) {
  if (bindingPattern.length === 0) return [];

  const matches = [];

  for (let dnaStart = 0; dnaStart <= dnaSequence.length - bindingPattern.length; dnaStart++) {
    let isMatch = true;
    const matchDetails = [];

    for (let i = 0; i < bindingPattern.length; i++) {
      const dnaPos = dnaStart + i;
      const nucleotide = dnaSequence[dnaPos].nucleotide;
      const bindTarget = bindingPattern[i].bindsTo;

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
 */
export function isContiguousBindingPattern(bindingPattern) {
  if (bindingPattern.length <= 1) return true;

  for (let i = 1; i < bindingPattern.length; i++) {
    if (bindingPattern[i].position !== bindingPattern[i - 1].position + 1) {
      return false;
    }
  }

  return true;
}

// =============================================================================
// New Hex-Aware Geometry
// =============================================================================

/**
 * Determine protein direction (N→C) from hex positions
 * @param {Array} positions - Array of {q, r} for contiguous amino acids
 * @returns {string|null} 'E' or 'W' for horizontal proteins, null if not straight/horizontal
 */
export function getProteinDirection(positions) {
  if (positions.length <= 1) return null;

  const lineInfo = isHexLineStraight(positions);
  if (!lineInfo.straight) return null;

  // For binding, we care about E/W direction
  if (lineInfo.direction === 'E') return 'E';
  if (lineInfo.direction === 'W') return 'W';

  // Protein is not horizontal - can't bind in current model
  return null;
}

/**
 * Determine the expected binding direction based on:
 * - Protein position relative to DNA (above/below)
 * - Protein N→C direction (E/W)
 *
 * @param {string} proteinDirection - 'E' or 'W'
 * @param {string} relativePosition - 'above' or 'below'
 * @returns {string} Expected binding direction ('SE', 'SW', 'NE', 'NW')
 */
export function getExpectedBindingDirection(proteinDirection, relativePosition) {
  if (relativePosition === 'above') {
    return proteinDirection === 'E' ? 'SE' : 'SW';
  } else {
    return proteinDirection === 'E' ? 'NE' : 'NW';
  }
}

/**
 * Check if protein binding sites are properly adjacent to DNA nucleotides
 * with correct binding direction based on N→C orientation.
 *
 * @param {Array} bindingPattern - From extractBindingPattern()
 * @param {Array} dnaSequence - From extractDNASequence()
 * @param {number} dnaStartIndex - Where in DNA the match starts
 * @returns {Object} { valid, bindingDirection, relativePosition, reason }
 */
export function checkHexGeometry(bindingPattern, dnaSequence, dnaStartIndex) {
  if (bindingPattern.length === 0) {
    return { valid: false, reason: 'Empty binding pattern' };
  }

  // Check binding pattern is contiguous in protein sequence
  if (!isContiguousBindingPattern(bindingPattern)) {
    return { valid: false, reason: 'Binding sites not contiguous in protein' };
  }

  // Get protein hex positions for binding sites
  const proteinPositions = bindingPattern.map(bp => bp.hexPosition);

  // Check protein binding region is straight
  const proteinLineInfo = isHexLineStraight(proteinPositions);
  if (!proteinLineInfo.straight) {
    return { valid: false, reason: 'Protein binding region not straight' };
  }

  // Get DNA hex positions for binding region
  const dnaPositions = [];
  for (let i = 0; i < bindingPattern.length; i++) {
    dnaPositions.push(dnaSequence[dnaStartIndex + i].hexPosition);
  }

  // Check DNA binding region is straight
  const dnaLineInfo = isHexLineStraight(dnaPositions);
  if (!dnaLineInfo.straight) {
    return { valid: false, reason: 'DNA binding region not straight' };
  }

  // Both must be horizontal (E or W)
  const proteinDir = getProteinDirection(proteinPositions);
  if (!proteinDir) {
    return { valid: false, reason: 'Protein not horizontal' };
  }

  // Check each binding site is adjacent to its target nucleotide
  const firstProteinPos = proteinPositions[0];
  const firstDnaPos = dnaPositions[0];
  const bindingDir = getNeighborDirection(firstProteinPos, firstDnaPos);

  if (!bindingDir) {
    return { valid: false, reason: 'Protein not adjacent to DNA' };
  }

  // Determine relative position from binding direction
  let relativePosition;
  if (bindingDir === 'SE' || bindingDir === 'SW') {
    relativePosition = 'above';
  } else if (bindingDir === 'NE' || bindingDir === 'NW') {
    relativePosition = 'below';
  } else {
    return { valid: false, reason: `Invalid binding direction: ${bindingDir}` };
  }

  // Check expected direction matches actual
  const expectedDir = getExpectedBindingDirection(proteinDir, relativePosition);
  if (bindingDir !== expectedDir) {
    return {
      valid: false,
      reason: `Binding direction ${bindingDir} doesn't match N→C direction (expected ${expectedDir})`
    };
  }

  // Verify all binding sites use the same direction
  for (let i = 1; i < bindingPattern.length; i++) {
    const dir = getNeighborDirection(proteinPositions[i], dnaPositions[i]);
    if (dir !== bindingDir) {
      return { valid: false, reason: `Inconsistent binding directions at position ${i}` };
    }
  }

  return {
    valid: true,
    bindingDirection: bindingDir,
    relativePosition: relativePosition,
    proteinDirection: proteinDir
  };
}

/**
 * Find all valid binding configurations between a protein and DNA
 */
export function findBindingConfigurations(protein, dna) {
  const bindingPattern = extractBindingPattern(protein);

  if (bindingPattern.length === 0) {
    return [];
  }

  // Must have contiguous binding sites
  if (!isContiguousBindingPattern(bindingPattern)) {
    return [];
  }

  const configurations = [];

  for (const strand of ['top', 'bottom']) {
    const dnaSequence = extractDNASequence(dna, strand);
    const sequenceMatches = findSequenceMatches(bindingPattern, dnaSequence);

    for (const match of sequenceMatches) {
      const geometryCheck = checkHexGeometry(
        bindingPattern,
        dnaSequence,
        match.dnaStartIndex
      );

      if (geometryCheck.valid) {
        configurations.push({
          strand,
          dnaStartIndex: match.dnaStartIndex,
          matches: match.matches,
          bindingDirection: geometryCheck.bindingDirection,
          relativePosition: geometryCheck.relativePosition,
          proteinDirection: geometryCheck.proteinDirection,
          bindingStrength: bindingPattern.length
        });
      }
    }
  }

  return configurations;
}

// =============================================================================
// Bound Complex and Manager
// =============================================================================

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

  get strength() {
    return this.configuration.bindingStrength;
  }

  get strand() {
    return this.configuration.strand;
  }

  get dnaPosition() {
    return this.configuration.dnaStartIndex;
  }

  get bindingDirection() {
    return this.configuration.bindingDirection;
  }

  get relativePosition() {
    return this.configuration.relativePosition;
  }
}

/**
 * Binding Manager - tracks molecules and manages binding
 */
export class BindingManager {
  constructor() {
    this.proteins = new Map();
    this.dnas = new Map();
    this.boundComplexes = [];
    this.nextId = 1;
  }

  addProtein(protein) {
    const id = this.nextId++;
    this.proteins.set(id, { id, protein, boundTo: null });
    return id;
  }

  addDNA(dna) {
    const id = this.nextId++;
    this.dnas.set(id, { id, dna, boundProteins: [] });
    return id;
  }

  removeProtein(id) {
    const entry = this.proteins.get(id);
    if (entry && entry.boundTo) {
      this.unbind(id);
    }
    this.proteins.delete(id);
  }

  removeDNA(id) {
    const entry = this.dnas.get(id);
    if (entry) {
      for (const proteinId of entry.boundProteins) {
        const proteinEntry = this.proteins.get(proteinId);
        if (proteinEntry) {
          proteinEntry.boundTo = null;
        }
      }
    }
    this.dnas.delete(id);
  }

  checkForBindings() {
    const newBindings = [];

    for (const [proteinId, proteinEntry] of this.proteins) {
      if (proteinEntry.boundTo) continue;

      for (const [dnaId, dnaEntry] of this.dnas) {
        const configurations = findBindingConfigurations(
          proteinEntry.protein,
          dnaEntry.dna
        );

        if (configurations.length > 0) {
          const bestConfig = configurations.reduce((a, b) =>
            a.bindingStrength > b.bindingStrength ? a : b
          );

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

          break;
        }
      }
    }

    return newBindings;
  }

  unbind(proteinId) {
    const proteinEntry = this.proteins.get(proteinId);
    if (!proteinEntry || !proteinEntry.boundTo) return false;

    const dnaEntry = this.dnas.get(proteinEntry.boundTo);
    if (dnaEntry) {
      dnaEntry.boundProteins = dnaEntry.boundProteins.filter(id => id !== proteinId);
    }

    this.boundComplexes = this.boundComplexes.filter(c =>
      c.protein !== proteinEntry.protein
    );

    proteinEntry.boundTo = null;
    return true;
  }

  getBoundComplexes() {
    return [...this.boundComplexes];
  }

  isProteinBound(proteinId) {
    const entry = this.proteins.get(proteinId);
    return entry ? entry.boundTo !== null : false;
  }
}

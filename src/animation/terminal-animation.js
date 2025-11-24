/* eslint-disable no-console */
/**
 * Terminal Animation Module for Protein Folding Game
 *
 * Provides utilities for animated terminal output including:
 * - Progress bars
 * - Spinners
 * - Live-updating ASCII protein renders using the actual renderer
 */

import ASCIIRenderer from '../renderers/ascii-renderer.js';
import { calculateFoldEnergy } from '../data/amino-acids.js';
import { sequenceToHexGrid } from '../core/hex-layout.js';
import { buildTransitionMatrix, stepsToAngle, calculateFullEnergy } from '../physics/energy.js';
import { Complex } from '../core/complex.js';
import { Molecule } from '../core/molecule.js';

/**
 * ANSI escape codes for terminal control
 */
export const ANSI = {
  // Cursor control
  HIDE_CURSOR: '\x1b[?25l',
  SHOW_CURSOR: '\x1b[?25h',
  MOVE_UP: (n) => `\x1b[${n}A`,
  MOVE_DOWN: (n) => `\x1b[${n}B`,
  MOVE_TO_COL: (n) => `\x1b[${n}G`,
  MOVE_TO: (row, col) => `\x1b[${row};${col}H`,

  // Line control
  CLEAR_LINE: '\x1b[2K',
  CLEAR_TO_END: '\x1b[0K',
  CLEAR_SCREEN: '\x1b[2J',

  // Colors
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',

  // Foreground colors
  FG_RED: '\x1b[31m',
  FG_GREEN: '\x1b[32m',
  FG_YELLOW: '\x1b[33m',
  FG_BLUE: '\x1b[34m',
  FG_MAGENTA: '\x1b[35m',
  FG_CYAN: '\x1b[36m',
  FG_WHITE: '\x1b[37m',

  // Background colors
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
};

/**
 * Progress bar renderer
 */
export class ProgressBar {
  constructor(options = {}) {
    this.width = options.width || 30;
    this.complete = options.complete || '█';
    this.incomplete = options.incomplete || '░';
    this.label = options.label || 'Progress';
  }

  render(progress) {
    const filled = Math.round(progress * this.width);
    const empty = this.width - filled;
    const percent = Math.round(progress * 100);

    const bar = this.complete.repeat(filled) + this.incomplete.repeat(empty);
    return `${this.label}: [${bar}] ${percent}%`;
  }

  async animate(duration = 2000, onFrame = null) {
    const frames = 30;
    const delay = duration / frames;

    process.stdout.write(ANSI.HIDE_CURSOR);

    try {
      for (let i = 0; i <= frames; i++) {
        const progress = i / frames;
        process.stdout.write('\r' + ANSI.CLEAR_LINE + this.render(progress));
        if (onFrame) onFrame(progress);
        await sleep(delay);
      }
      process.stdout.write('\n');
    } finally {
      process.stdout.write(ANSI.SHOW_CURSOR);
    }
  }
}

/**
 * Spinner animation
 */
export class Spinner {
  constructor(options = {}) {
    // Use ASCII characters for better terminal compatibility
    this.frames = options.frames || ['|', '/', '-', '\\'];
    this.interval = options.interval || 80;
    this.label = options.label || 'Loading';
    this.running = false;
    this.frameIndex = 0;
  }

  start() {
    this.running = true;
    process.stdout.write(ANSI.HIDE_CURSOR);

    this.timer = setInterval(() => {
      const frame = this.frames[this.frameIndex % this.frames.length];
      process.stdout.write(`\r${ANSI.CLEAR_LINE}${ANSI.FG_CYAN}${frame}${ANSI.RESET} ${this.label}`);
      this.frameIndex++;
    }, this.interval);
  }

  stop(finalMessage = 'Done!') {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    process.stdout.write(`\r${ANSI.CLEAR_LINE}${ANSI.FG_GREEN}✓${ANSI.RESET} ${finalMessage}\n`);
    process.stdout.write(ANSI.SHOW_CURSOR);
  }

  fail(message = 'Failed') {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    process.stdout.write(`\r${ANSI.CLEAR_LINE}${ANSI.FG_RED}✗${ANSI.RESET} ${message}\n`);
    process.stdout.write(ANSI.SHOW_CURSOR);
  }
}

/**
 * Multi-line animation renderer
 * Allows updating multiple lines in place
 */
export class MultiLineRenderer {
  constructor() {
    this.lines = [];
    this.rendered = false;
    this.lastLineCount = 0;
  }

  setLines(lines) {
    this.lines = lines;
  }

  render() {
    if (this.rendered) {
      // Move cursor up to overwrite previous output
      process.stdout.write(ANSI.MOVE_UP(this.lastLineCount));
    }

    for (const line of this.lines) {
      process.stdout.write(ANSI.CLEAR_LINE + line + '\n');
    }

    this.lastLineCount = this.lines.length;
    this.rendered = true;
  }

  clear() {
    if (this.rendered) {
      process.stdout.write(ANSI.MOVE_UP(this.lastLineCount));
      for (let i = 0; i < this.lastLineCount; i++) {
        process.stdout.write(ANSI.CLEAR_LINE + '\n');
      }
      process.stdout.write(ANSI.MOVE_UP(this.lastLineCount));
    }
    this.rendered = false;
    this.lastLineCount = 0;
  }
}

/**
 * Convert fold steps notation to angle/direction for ASCII renderer
 */
function stepsToFoldSpec(steps) {
  if (steps === 0) return null;
  return {
    angle: Math.abs(steps) * 60,
    direction: steps > 0 ? 'left' : 'right'
  };
}

/**
 * Calculate total energy of a protein state
 */
function calculateProteinEnergy(sequence, foldStates) {
  let energy = 0;
  for (let i = 0; i < sequence.length; i++) {
    const aaCode = sequence[i];
    const foldState = foldStates[i] || 0;
    energy += calculateFoldEnergy(aaCode, foldState);
  }
  return energy;
}

/**
 * Protein folding animation using the real ASCII renderer
 */
export class ProteinFoldingAnimation {
  constructor(options = {}) {
    this.renderer = new MultiLineRenderer();
    this.frameDelay = options.frameDelay || 500;
    this.showEnergy = options.showEnergy !== false;
  }

  /**
   * Generate frames for a folding animation
   * @param {Array} sequence - Array of amino acid codes like ['STR', 'L12', 'L12', 'STR']
   * @param {Array} targetFoldStates - Array of target fold states (in steps) for each position
   *   e.g., [0, 2, 1, 0] means: straight, L120, L60, straight
   */
  generateFoldingFrames(sequence, targetFoldStates) {
    const frames = [];
    const currentFoldStates = new Array(sequence.length).fill(0);

    // Frame 0: Straight chain (all zeros)
    frames.push(this.renderState(sequence, [...currentFoldStates], 'Initial: Straight chain'));

    // Generate intermediate frames by folding one step at a time
    // For each position that needs to change, step toward target
    let changed = true;
    let stepCount = 0;
    const maxSteps = 20; // Safety limit

    while (changed && stepCount < maxSteps) {
      changed = false;
      stepCount++;

      // Find a position that needs to fold
      for (let i = 1; i < sequence.length - 1; i++) {
        if (currentFoldStates[i] !== targetFoldStates[i]) {
          const target = targetFoldStates[i];
          const current = currentFoldStates[i];

          // Step toward target (one 60° step at a time)
          if (target > current) {
            currentFoldStates[i]++;
          } else {
            currentFoldStates[i]--;
          }

          const foldSpec = stepsToFoldSpec(currentFoldStates[i]);
          const label = foldSpec
            ? `Folding position ${i}: ${foldSpec.angle}° ${foldSpec.direction}`
            : `Position ${i} returning to straight`;

          frames.push(this.renderState(sequence, [...currentFoldStates], label));
          changed = true;
          break; // One change per frame
        }
      }
    }

    // Final frame
    frames.push(this.renderState(sequence, targetFoldStates, 'Folding complete!', true));

    return frames;
  }

  /**
   * Render a single state using the real ASCII renderer
   */
  renderState(sequence, foldStates, label, isFinal = false) {
    const lines = [];

    // Header with color
    const color = isFinal ? ANSI.FG_GREEN : ANSI.FG_CYAN;
    lines.push(`${color}${ANSI.BOLD}${label}${ANSI.RESET}`);
    lines.push('');

    // Build the amino acid sequence string and bends array for the renderer
    const sequenceStr = sequence.join('-');
    const bends = [];

    for (let i = 1; i < sequence.length - 1; i++) {
      const steps = foldStates[i];
      if (steps !== 0) {
        bends.push({
          position: i, // Bend happens AFTER this amino acid
          angle: Math.abs(steps) * 60,
          direction: steps > 0 ? 'left' : 'right'
        });
      }
    }

    // Use the real ASCII renderer
    let ascii;
    try {
      if (bends.length === 0) {
        ascii = ASCIIRenderer.renderProtein(sequenceStr);
      } else {
        // For multiple bends, we need to use hexGridToASCII
        const hexGrid = sequenceToHexGrid(sequenceStr, bends);
        ascii = ASCIIRenderer.hexGridToASCII(hexGrid, 'N-', '-C');
      }
    } catch (error) {
      ascii = `Error rendering: ${error.message}`;
    }

    // Add ASCII render lines
    const asciiLines = ascii.split('\n');
    lines.push(...asciiLines);

    // Energy display
    if (this.showEnergy) {
      lines.push('');
      const energy = calculateProteinEnergy(sequence, foldStates);
      const energyColor = energy <= 0 ? ANSI.FG_GREEN : ANSI.FG_YELLOW;
      lines.push(`${energyColor}Energy: ${energy.toFixed(2)} eV${ANSI.RESET}`);

      // Show fold states
      const stateStr = foldStates.map((s, i) => {
        if (i === 0 || i === sequence.length - 1) return '-';
        if (s === 0) return '0';
        return s > 0 ? `+${s}` : `${s}`;
      }).join(' ');
      lines.push(`${ANSI.DIM}Fold states: [${stateStr}]${ANSI.RESET}`);
    }

    // Pad to consistent height
    while (lines.length < 15) {
      lines.push('');
    }

    return lines;
  }

  /**
   * Run the folding animation
   */
  async animate(sequence, targetFoldStates) {
    const frames = this.generateFoldingFrames(sequence, targetFoldStates);

    process.stdout.write(ANSI.HIDE_CURSOR);

    try {
      for (let i = 0; i < frames.length; i++) {
        this.renderer.setLines(frames[i]);
        this.renderer.render();

        // Longer pause on first and last frame
        const delay = (i === 0 || i === frames.length - 1)
          ? this.frameDelay * 2
          : this.frameDelay;

        await sleep(delay);
      }
    } finally {
      process.stdout.write(ANSI.SHOW_CURSOR);
    }
  }
}

/**
 * Synchronous version that pre-renders all frames
 * (avoids async import issues)
 */
export class ProteinFoldingAnimationSync {
  constructor(options = {}) {
    this.renderer = new MultiLineRenderer();
    this.frameDelay = options.frameDelay || 500;
    this.showEnergy = options.showEnergy !== false;
  }

  /**
   * Render a single state using the real ASCII renderer
   */
  renderState(sequence, foldStates, label, isFinal = false) {
    const lines = [];

    // Header with color
    const color = isFinal ? ANSI.FG_GREEN : ANSI.FG_CYAN;
    lines.push(`${color}${ANSI.BOLD}${label}${ANSI.RESET}`);
    lines.push('');

    // Build the amino acid sequence string and bends array for the renderer
    const sequenceStr = sequence.join('-');
    const bends = [];

    for (let i = 1; i < sequence.length - 1; i++) {
      const steps = foldStates[i];
      if (steps !== 0) {
        bends.push({
          position: i, // Bend happens AFTER this amino acid
          angle: Math.abs(steps) * 60,
          direction: steps > 0 ? 'left' : 'right'
        });
      }
    }

    // Use the real ASCII renderer
    let ascii;
    try {
      if (bends.length === 0) {
        ascii = ASCIIRenderer.renderProtein(sequenceStr);
      } else {
        const hexGrid = sequenceToHexGrid(sequenceStr, bends);
        ascii = ASCIIRenderer.hexGridToASCII(hexGrid, 'N-', '-C');
      }
    } catch (error) {
      ascii = `Error rendering: ${error.message}`;
    }

    // Add ASCII render lines
    const asciiLines = ascii.split('\n');
    lines.push(...asciiLines);

    // Energy display
    if (this.showEnergy) {
      lines.push('');
      // Use full energy calculation including electrostatics
      const energy = calculateFullEnergy(sequence, foldStates);
      const energyColor = energy <= 0 ? ANSI.FG_GREEN : ANSI.FG_YELLOW;
      lines.push(`${energyColor}Energy: ${energy.toFixed(2)} eV${ANSI.RESET}`);

      // Show fold states as bend names
      const bendNames = foldStates.slice(1, -1).map(s => {
        if (s === 0) return 'STR';
        if (s === 1) return 'L60';
        if (s === -1) return 'R60';
        if (s === 2) return 'L12';
        if (s === -2) return 'R12';
        return `${s}`;
      });
      lines.push(`${ANSI.DIM}Bends: ${bendNames.join(', ')}${ANSI.RESET}`);
    }

    // Pad to consistent height
    while (lines.length < 15) {
      lines.push('');
    }

    return lines;
  }

  /**
   * [DEPRECATED] Simple render without ASCII renderer - kept for reference
   */
  renderStateSimple(sequence, foldStates, label, isFinal = false) {
    const lines = [];

    // Header
    const color = isFinal ? ANSI.FG_GREEN : ANSI.FG_CYAN;
    lines.push(`${color}${ANSI.BOLD}${label}${ANSI.RESET}`);
    lines.push('');

    // Build ASCII representation
    // Direction: 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
    const directions = [
      { dx: 4, dy: 0, connector: '-' },   // East
      { dx: 2, dy: -1, connector: '/' },  // Northeast
      { dx: -2, dy: -1, connector: '\\' }, // Northwest
      { dx: -4, dy: 0, connector: '-' },  // West
      { dx: -2, dy: 1, connector: '/' },  // Southwest
      { dx: 2, dy: 1, connector: '\\' },  // Southeast
    ];

    // Build positions and connectors
    const elements = [];
    let x = 0, y = 0;
    let dir = 0; // Start heading East

    for (let i = 0; i < sequence.length; i++) {
      elements.push({ x, y, text: sequence[i], isAA: true });

      if (i < sequence.length - 1) {
        // Get fold at this position (foldStates[i+1] determines bend after AA[i])
        const bendSteps = foldStates[i + 1] || 0;

        // Apply bend: positive = left (counterclockwise), negative = right (clockwise)
        dir = ((dir - bendSteps) % 6 + 6) % 6;

        // Add connector
        const d = directions[dir];
        const connX = x + Math.sign(d.dx) * 2;
        const connY = y + (d.dy !== 0 ? d.dy : 0);

        // Determine connector character based on direction
        let conn = d.connector;
        if (dir === 1 || dir === 4) conn = '/';
        if (dir === 2 || dir === 5) conn = '\\';
        if (dir === 0 || dir === 3) conn = '-';

        elements.push({ x: connX, y: connY, text: conn, isAA: false });

        // Move to next position
        x += d.dx;
        y += d.dy;
      }
    }

    // Find bounds
    const minX = Math.min(...elements.map(e => e.x));
    const maxX = Math.max(...elements.map(e => e.x + e.text.length));
    const minY = Math.min(...elements.map(e => e.y));
    const maxY = Math.max(...elements.map(e => e.y));

    // Create grid
    const width = maxX - minX + 10;
    const height = maxY - minY + 1;
    const grid = Array(height).fill(null).map(() => Array(width).fill(' '));

    // Place elements
    for (const el of elements) {
      const gx = el.x - minX + 3;
      const gy = el.y - minY;

      if (gy >= 0 && gy < height) {
        for (let c = 0; c < el.text.length; c++) {
          if (gx + c >= 0 && gx + c < width) {
            if (el.isAA) {
              grid[gy][gx + c] = el.text[c];
            } else {
              grid[gy][gx + c] = el.text[c];
            }
          }
        }
      }
    }

    // Add N- prefix and -C suffix
    // Find first and last AA
    const firstAA = elements.find(e => e.isAA);
    const lastAA = [...elements].reverse().find(e => e.isAA);

    if (firstAA) {
      const gy = firstAA.y - minY;
      const gx = firstAA.x - minX + 3;
      if (gx >= 2) {
        grid[gy][gx - 2] = 'N';
        grid[gy][gx - 1] = '-';
      }
    }

    if (lastAA) {
      const gy = lastAA.y - minY;
      const gx = lastAA.x - minX + 3 + lastAA.text.length;
      if (gx + 1 < width) {
        grid[gy][gx] = '-';
        grid[gy][gx + 1] = 'C';
      }
    }

    // Convert to lines with colors
    for (let row = 0; row < height; row++) {
      let line = '  ';
      for (let col = 0; col < width; col++) {
        const char = grid[row][col];
        // Color amino acids
        if (char !== ' ' && char !== '-' && char !== '/' && char !== '\\' && char !== 'N' && char !== 'C') {
          line += `${ANSI.FG_YELLOW}${char}${ANSI.RESET}`;
        } else if (char === '-' || char === '/' || char === '\\') {
          line += `${ANSI.DIM}${char}${ANSI.RESET}`;
        } else {
          line += char;
        }
      }
      lines.push(line.trimEnd());
    }

    // Energy display
    if (this.showEnergy) {
      lines.push('');
      const energy = calculateProteinEnergy(sequence, foldStates);
      const energyColor = energy <= 0 ? ANSI.FG_GREEN : ANSI.FG_YELLOW;
      lines.push(`${energyColor}Energy: ${energy.toFixed(2)} eV${ANSI.RESET}`);

      // Show fold states in readable format
      const stateLabels = foldStates.map((s, i) => {
        if (i === 0 || i === sequence.length - 1) return '';
        if (s === 0) return 'STR';
        if (s === 1) return 'L60';
        if (s === -1) return 'R60';
        if (s === 2) return 'L12';
        if (s === -2) return 'R12';
        return `${s}`;
      }).filter(s => s).join(', ');
      lines.push(`${ANSI.DIM}Bends: ${stateLabels || 'none'}${ANSI.RESET}`);
    }

    // Pad to consistent height
    while (lines.length < 15) {
      lines.push('');
    }

    return lines;
  }

  /**
   * Check if a fold state configuration is valid (no overlaps)
   */
  isValidConfig(sequence, foldStates) {
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

    try {
      sequenceToHexGrid(sequenceStr, bends);
      return true;
    } catch (error) {
      if (error.message.includes('Overlap')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Convert sequence array and fold states to protein object for physics engine
   */
  toProteinObject(sequence, foldStates) {
    const aminoAcids = sequence.map((type, i) => ({
      type,
      position: { q: i, r: 0 }  // Placeholder positions, recalculated by hex grid
    }));

    const folds = [];
    for (let i = 1; i < foldStates.length - 1; i++) {
      const steps = foldStates[i];
      if (steps !== 0) {
        const { angle, direction } = stepsToAngle(steps);
        folds.push({ position: i, angle, direction });
      }
    }

    return { aminoAcids, folds };
  }

  /**
   * Generate frames using thermodynamic simulation
   * Uses the physics engine to calculate transition probabilities at each step
   * Now includes electrostatic interactions in energy calculations
   */
  generateFrames(sequence, maxSteps = 50) {
    const frames = [];
    const currentFoldStates = new Array(sequence.length).fill(0);

    // Frame 0: Straight chain
    frames.push(this.renderState(sequence, [...currentFoldStates], 'Step 0: Straight chain'));

    // Simulate folding using thermodynamic transition rates
    for (let step = 1; step <= maxSteps; step++) {
      const protein = this.toProteinObject(sequence, currentFoldStates);
      // Pass sequence and foldStates for full energy calculation including electrostatics
      const { transitions, stayRate } = buildTransitionMatrix(protein, undefined, sequence, currentFoldStates);

      // Filter out transitions that would cause overlaps
      const validTransitions = transitions.filter(t => {
        const testFoldStates = [...currentFoldStates];
        testFoldStates[t.position] = t.toSteps;
        return this.isValidConfig(sequence, testFoldStates);
      });

      // Recalculate total rate for valid transitions only
      const validTotalRate = validTransitions.reduce((sum, t) => sum + t.rate, 0);

      // If no valid transitions at all, show no change
      if (validTransitions.length === 0) {
        frames.push(this.renderState(sequence, [...currentFoldStates], `Step ${step}: No change`));
        continue;
      }

      // Sample a transition based on rates (weighted random selection)
      const rand = Math.random() * (validTotalRate + stayRate);

      if (rand < stayRate) {
        // Stay in current state - show frame anyway to represent time passing
        frames.push(this.renderState(sequence, [...currentFoldStates], `Step ${step}: No change`));
        continue;
      }

      // Select which transition occurs
      let cumulative = stayRate;
      let selectedTransition = null;

      for (const t of validTransitions) {
        cumulative += t.rate;
        if (rand < cumulative) {
          selectedTransition = t;
          break;
        }
      }

      if (selectedTransition) {
        // Apply the transition
        currentFoldStates[selectedTransition.position] = selectedTransition.toSteps;

        // Create label
        const pos = selectedTransition.position;
        const toSteps = selectedTransition.toSteps;
        let foldName;
        if (toSteps === 0) foldName = 'straight';
        else if (toSteps === 1) foldName = '60° left';
        else if (toSteps === -1) foldName = '60° right';
        else if (toSteps === 2) foldName = '120° left';
        else if (toSteps === -2) foldName = '120° right';
        else foldName = `${Math.abs(toSteps) * 60}° ${toSteps > 0 ? 'left' : 'right'}`;

        const label = `Step ${step}: Position ${pos} → ${foldName}`;
        frames.push(this.renderState(sequence, [...currentFoldStates], label));
      }
    }

    // Final frame
    frames.push(this.renderState(sequence, [...currentFoldStates], 'Simulation complete', true));

    return frames;
  }

  /**
   * Run the animation with thermodynamic simulation
   * @param {string[]} sequence - Array of amino acid codes
   * @param {number} maxSteps - Maximum simulation steps (default 50)
   */
  async animate(sequence, maxSteps = 50) {
    const frames = this.generateFrames(sequence, maxSteps);

    process.stdout.write(ANSI.HIDE_CURSOR);

    try {
      for (let i = 0; i < frames.length; i++) {
        this.renderer.setLines(frames[i]);
        this.renderer.render();

        const delay = (i === 0 || i === frames.length - 1)
          ? this.frameDelay * 2
          : this.frameDelay;

        await sleep(delay);
      }
    } finally {
      process.stdout.write(ANSI.SHOW_CURSOR);
    }
  }
}

/**
 * Utility: sleep for ms milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random protein sequence
 * @param {number} length - Number of amino acids (2-12)
 * @returns {string[]} Random sequence of amino acid codes
 */
export function generateRandomSequence(length) {
  const aminoAcids = ['STR', 'L60', 'R60', 'L12', 'R12', 'FLX', 'POS', 'NEG', 'PHO', 'PHI'];
  const sequence = [];
  for (let i = 0; i < length; i++) {
    sequence.push(aminoAcids[Math.floor(Math.random() * aminoAcids.length)]);
  }
  return sequence;
}

/**
 * Curated demo sequences that showcase different physics properties
 */
const DEMO_SEQUENCES = [
  {
    name: 'Simple helix',
    description: 'All L60 - forms a left-handed helix',
    sequence: ['STR', 'L60', 'L60', 'L60', 'L60', 'STR'],
  },
  {
    name: 'Zigzag',
    description: 'Alternating L60/R60 - forms a zigzag pattern',
    sequence: ['STR', 'L60', 'R60', 'L60', 'R60', 'STR'],
  },
  {
    name: 'Tight turn',
    description: 'L12-L12 wants sharp fold but collides - frustrated system',
    sequence: ['STR', 'L12', 'L12', 'STR'],
  },
  {
    name: 'Flexible linker',
    description: 'FLX has no preference - explores all conformations equally',
    sequence: ['STR', 'FLX', 'FLX', 'STR'],
  },
  {
    name: 'Salt bridge',
    description: 'POS-NEG attract - charged residues want to be close',
    sequence: ['POS', 'FLX', 'FLX', 'NEG'],
  },
  {
    name: 'Charge repulsion',
    description: 'POS-POS repel - like charges push apart',
    sequence: ['POS', 'FLX', 'FLX', 'POS'],
  },
  {
    name: 'Hydrophobic collapse',
    description: 'PHO residues want to be buried in the core',
    sequence: ['PHI', 'PHO', 'PHO', 'PHO', 'PHI'],
  },
  {
    name: 'Mixed structural',
    description: 'Different fold preferences compete',
    sequence: ['STR', 'L60', 'R12', 'L12', 'R60', 'STR'],
  },
  {
    name: 'Longer chain',
    description: 'More complex folding with multiple bend points',
    sequence: ['STR', 'L60', 'FLX', 'R60', 'L60', 'FLX', 'R60', 'STR'],
  },
  {
    name: 'Electrostatic zipper',
    description: 'Alternating charges - may form compact structure',
    sequence: ['POS', 'L60', 'NEG', 'L60', 'POS', 'L60', 'NEG'],
  },
];

/**
 * Demo function to showcase thermodynamic protein folding simulation
 */
export async function runDemo() {
  console.log(`${ANSI.BOLD}${ANSI.FG_CYAN}=== STRAND Demo ===${ANSI.RESET}\n`);

  // Progress bar demo (commented out - working)
  // console.log('1. Progress Bar:');
  // const progress = new ProgressBar({ label: 'Calculating energy' });
  // await progress.animate(1500);
  // console.log('');

  // Spinner demo (commented out - working)
  // console.log('2. Spinner:');
  // const spinner = new Spinner({ label: 'Initializing simulation...' });
  // spinner.start();
  // await sleep(2000);
  // spinner.stop('Simulation ready!');
  // console.log('');

  // Complex rendering demos - show off new features
  console.log(`${ANSI.BOLD}1. Molecular Complex Rendering:${ANSI.RESET}\n`);
  await runComplexDemos();
  console.log('');

  // Thermodynamic protein folding simulations
  console.log(`${ANSI.BOLD}2. Thermodynamic Folding Simulation (10 curated proteins):${ANSI.RESET}`);
  console.log(`${ANSI.DIM}   Each protein folds according to transition probabilities from the physics engine${ANSI.RESET}\n`);

  for (let i = 0; i < DEMO_SEQUENCES.length; i++) {
    const { name, description, sequence } = DEMO_SEQUENCES[i];

    console.log(`${ANSI.FG_CYAN}--- ${i + 1}. ${name} ---${ANSI.RESET}`);
    console.log(`${ANSI.DIM}${description}${ANSI.RESET}`);
    console.log(`${ANSI.DIM}Sequence: ${sequence.join('-')}${ANSI.RESET}`);
    await sleep(500);

    // Create a fresh animation instance for each sequence to reset the renderer
    const anim = new ProteinFoldingAnimationSync({ frameDelay: 300 });

    // Run thermodynamic simulation (30 steps)
    await anim.animate(sequence, 30);

    console.log('');
    await sleep(800);
  }

  console.log(`${ANSI.FG_GREEN}Demo complete!${ANSI.RESET}`);
}

/**
 * Demo Complex rendering features
 */
async function runComplexDemos() {
  const demos = [
    {
      name: 'Simple Protein',
      description: 'A basic protein chain',
      build: () => Complex.fromProtein('STR-SIG-FLX-NEG')
    },
    {
      name: 'Protein + DNA Binding',
      description: 'BTA residue binds to adenine nucleotide',
      build: () => {
        const complex = new Complex();
        complex.addMolecule(Molecule.createProtein('STR-BTA-SIG'), { offset: { q: 0, r: 0 } });
        complex.addMolecule(Molecule.createDNA('A'), { offset: { q: 1, r: 1 } });
        return complex;
      }
    },
    {
      name: 'ATR + ATP',
      description: 'ATR residue has attracted an ATP molecule',
      build: () => {
        const complex = Complex.fromProtein('STR-ATR-SIG');
        complex.addMolecule(Molecule.createATP(), { offset: { q: 1, r: 1 } });
        return complex;
      }
    },
    {
      name: 'Signal Chain',
      description: 'BTx source -> SIG conductor -> AND gate',
      build: () => Complex.fromProtein('BTA-SIG-SIG-AND-ATR')
    },
    {
      name: 'Multi-molecule Complex',
      description: 'Protein bound to longer DNA strand',
      build: () => {
        const complex = new Complex();
        complex.addMolecule(Molecule.createProtein('STR-BTA-BTG-SIG'), { offset: { q: 0, r: 0 } });
        complex.addMolecule(Molecule.createDNA('AG'), { offset: { q: 1, r: 1 } });
        return complex;
      }
    },
    {
      name: 'DNA Double Strand Preview',
      description: 'DNA rendered with the DNA renderer',
      build: () => {
        // This one uses the DNA renderer directly, not Complex
        return null;
      },
      customRender: () => ASCIIRenderer.renderDNA('ACGT', 'TGCA')
    },
  ];

  for (const demo of demos) {
    console.log(`${ANSI.FG_CYAN}--- ${demo.name} ---${ANSI.RESET}`);
    console.log(`${ANSI.DIM}${demo.description}${ANSI.RESET}\n`);

    let output;
    if (demo.customRender) {
      output = demo.customRender();
    } else {
      const complex = demo.build();
      output = ASCIIRenderer.renderComplex(complex);
    }

    console.log(output);
    console.log('');
    await sleep(1500);
  }
}

// Run demo if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo().catch(console.error);
}

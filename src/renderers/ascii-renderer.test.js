import { describe, test, expect } from '@jest/globals';

// Import the ASCIIRenderer class
const ASCIIRenderer = (await import('./ascii-renderer.js')).default || (await import('./ascii-renderer.js'));

describe('ASCIIRenderer', () => {
  describe('renderDNA', () => {
    test('renders simple DNA structure correctly', () => {
      const result = ASCIIRenderer.renderDNA('ACGT', 'TGCA');
      expect(result).toContain('<A>');
      expect(result).toContain('<T>');
      expect(result).toContain('|');
    });

    test('returns error for mismatched lengths', () => {
      const result = ASCIIRenderer.renderDNA('ACG', 'TGCA');
      expect(result).toBe('ERROR: Top and bottom sequences must be same length');
    });

    test('renders single base pair', () => {
      const result = ASCIIRenderer.renderDNA('A', 'T');
      expect(result).toContain('<A>');
      expect(result).toContain('<T>');
      expect(result).toContain('|');
    });
  });

  describe('renderRNA', () => {
    test('renders simple RNA structure', () => {
      const result = ASCIIRenderer.renderRNA('ACGUA');
      expect(result).toBe('5\'-<A>-<C>-<G>-<U>-<A>-3\'');
    });

    test('renders single nucleotide', () => {
      const result = ASCIIRenderer.renderRNA('A');
      expect(result).toBe('5\'-<A>-3\'');
    });

    test('handles empty sequence', () => {
      const result = ASCIIRenderer.renderRNA('');
      expect(result).toBe('5\'--3\'');  // Empty string split and joined produces a dash
    });
  });

  describe('renderRNAWithBend', () => {
    test('renders RNA with bend at valid position', () => {
      const result = ASCIIRenderer.renderRNAWithBend('ACGUA', 2);
      expect(result).toContain('<A>');
      expect(result).toContain('<G>');
      expect(result).toContain('\\');
      expect(result).toContain('<U>');
      expect(result).toContain('<A>-3\'');
    });

    test('returns error for invalid bend position (negative)', () => {
      const result = ASCIIRenderer.renderRNAWithBend('ACGUA', -1);
      expect(result).toBe('ERROR: Invalid bend position');
    });

    test('returns error for invalid bend position (too large)', () => {
      const result = ASCIIRenderer.renderRNAWithBend('ACGUA', 5);
      expect(result).toBe('ERROR: Invalid bend position');
    });
  });

  describe('renderProtein', () => {
    test('renders simple protein structure', () => {
      const result = ASCIIRenderer.renderProtein('STR-EX6-BTA-RPF');
      expect(result).toBe('N-STR-EX6-BTA-RPF-C');
    });

    test('handles single amino acid', () => {
      const result = ASCIIRenderer.renderProtein('STR');
      expect(result).toBe('N-STR-C');
    });
  });

  describe('renderProteinWithBend', () => {
    test('renders protein with 60° bend', () => {
      const result = ASCIIRenderer.renderProteinWithBend('STR-EX6-BTA-RPF', 1, 60);
      expect(result).toContain('N-STR-EX6');
      expect(result).toContain('\\');
      expect(result).toContain('BTA');
      expect(result).toContain('RPF-C');
    });

    test('renders protein with 120° bend', () => {
      const result = ASCIIRenderer.renderProteinWithBend('STR-EX6-BTA-RPF', 1, 120);
      expect(result).toContain('N-STR-EX6');
      expect(result).toContain('/');
      expect(result).toContain('BTA');
      expect(result).toContain('RPF-C');
    });

    test('returns error for invalid bend position', () => {
      const result = ASCIIRenderer.renderProteinWithBend('STR-EX6', -1, 60);
      expect(result).toBe('ERROR: Invalid bend position');
    });

    test('renders long protein with 120° bend and proper spacing', () => {
      const result = ASCIIRenderer.renderProteinWithBend('STR-EX6-BTA-BTA-BTA-BTA-BTA-BTA', 1, 120);
      expect(result).toContain('N-STR-EX6');
      expect(result).toContain('/');
      expect(result).toContain('BTA');
      expect(result).toContain('BTA-C');
      // Verify the structure is properly indented (first line should have leading spaces)
      const lines = result.split('\n');
      expect(lines[0].startsWith(' ')).toBe(true);
    });
  });

});

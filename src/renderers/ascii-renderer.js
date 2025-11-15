// ASCII Renderer - Fast text-based visualization of molecular structures
// Usage: Quick debugging and structure verification

class ASCIIRenderer {

  // Helper: Wrap RNA bases in <> brackets
  static wrapRNABases(sequence) {
    return sequence.split('').map(b => '<' + b + '>').join('-');
  }

  // Helper: Render a straight sequence (generic for RNA and proteins)
  static renderSequence(sequence, prefix, suffix) {
    return prefix + sequence + suffix;
  }

  // Helper: Render a sequence with a bend (generic for RNA and proteins)
  static renderSequenceWithBend(sequence, bendPosition, bendAngle, prefix, suffix) {
    const elements = sequence.split('-');

    if (bendPosition < 0 || bendPosition >= elements.length - 1) {
      return 'ERROR: Invalid bend position';
    }

    let lines = [];

    // Before bend
    let beforeBend = elements.slice(0, bendPosition + 1);
    let firstLine = prefix + beforeBend.join('-');
    lines.push(firstLine);

    // Determine bend character
    let bendChar = bendAngle === 60 ? '\\' : '/';

    // Calculate starting column: last character is at index (length - 1)
    let lastCharIndex = firstLine.length - 1;

    // After bend - position bend chars to point to centers of elements
    let afterBend = elements.slice(bendPosition + 1);

    // Find center position of last element before bend
    let lastElement = elements[bendPosition];
    let lastElementCenter = Math.floor(lastElement.length / 2);
    let prevCenterPos = lastCharIndex - lastElement.length + 1 + lastElementCenter;

    // First pass: calculate all positions to find minimum
    let positions = [];
    let tempPrevCenterPos = prevCenterPos;

    for (let i = 0; i < afterBend.length; i++) {
      let currentElement = afterBend[i];
      let elementCenter = Math.floor(currentElement.length / 2);

      let bendCharPos, currentCenterPos, elementStartPos;

      if (bendAngle === 60) {
        bendCharPos = tempPrevCenterPos + 1;
        currentCenterPos = bendCharPos + 1;
        elementStartPos = currentCenterPos - elementCenter;
      } else {
        bendCharPos = tempPrevCenterPos - 1;
        currentCenterPos = bendCharPos - 1;
        elementStartPos = currentCenterPos - elementCenter;
      }

      positions.push({ bendCharPos, elementStartPos, element: currentElement, isLast: i === afterBend.length - 1 });
      tempPrevCenterPos = currentCenterPos;
    }

    // Find minimum position
    let minPos = 0;
    for (let pos of positions) {
      minPos = Math.min(minPos, pos.bendCharPos, pos.elementStartPos);
    }

    // Apply offset if needed (if minPos is negative, shift everything right)
    let offset = minPos < 0 ? -minPos : 0;

    // If we need to shift, also shift the first line
    if (offset > 0) {
      lines[0] = ' '.repeat(offset) + lines[0];
    }

    // Second pass: render with offset
    for (let pos of positions) {
      let bendIndent = ' '.repeat(pos.bendCharPos + offset);
      let elementIndent = ' '.repeat(pos.elementStartPos + offset);

      lines.push(bendIndent + bendChar);

      if (pos.isLast) {
        lines.push(elementIndent + pos.element + suffix);
      } else {
        lines.push(elementIndent + pos.element);
      }
    }

    return lines.join('\n');
  }

  // Render DNA structure
  static renderDNA(topSequence, bottomSequence) {
    if (topSequence.length !== bottomSequence.length) {
      return 'ERROR: Top and bottom sequences must be same length';
    }

    const length = topSequence.length;

    // Build top line with directional markers and <> around bases
    let topLine = '3\'-' + topSequence.split('').map(b => '<' + b + '>').join('-') + '-5\'';

    // Build middle line with hydrogen bonds
    // G-C pairs have 3 hydrogen bonds (|||), A-T pairs have 2 hydrogen bonds (| |)
    let middleLine = '   ';  // Offset for alignment
    for (let i = 0; i < length; i++) {
      const topBase = topSequence[i];
      const bottomBase = bottomSequence[i];

      // Determine hydrogen bond representation
      let bond;
      if ((topBase === 'G' && bottomBase === 'C') || (topBase === 'C' && bottomBase === 'G')) {
        bond = '|||';  // 3 hydrogen bonds
      } else {
        bond = '| |';  // 2 hydrogen bonds (A-T or other pairs)
      }

      middleLine += bond;
      if (i < length - 1) {
        middleLine += ' ';
      }
    }

    // Build bottom line with directional markers and <> around bases
    let bottomLine = '5\'-' + bottomSequence.split('').map(b => '<' + b + '>').join('-') + '-3\'';

    return topLine + '\n' + middleLine + '\n' + bottomLine;
  }
    
  // Render RNA structure (straight)
  static renderRNA(sequence) {
    const wrappedSequence = this.wrapRNABases(sequence);
    return this.renderSequence(wrappedSequence, '5\'-', '-3\'');
  }
    
  // Render RNA with 60° bend
  static renderRNAWithBend(sequence, bendPosition) {
    const wrappedSequence = this.wrapRNABases(sequence);
    return this.renderSequenceWithBend(wrappedSequence, bendPosition, 60, '5\'-', '-3\'');
  }
    
  // Render protein structure (straight, unfolded)
  static renderProtein(aminoAcidSequence) {
    // aminoAcidSequence is like "S-E60-BA-RPF-C60"
    return this.renderSequence(aminoAcidSequence, 'N-', '-C');
  }
    
  // Render protein with bends
  static renderProteinWithBend(aminoAcidSequence, bendPosition, bendAngle) {
    return this.renderSequenceWithBend(aminoAcidSequence, bendPosition, bendAngle, 'N-', '-C');
  }
    
}

// ES Module export
export default ASCIIRenderer;

// CommonJS export for compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ASCIIRenderer;
}

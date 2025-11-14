// ASCII Renderer - Fast text-based visualization of molecular structures
// Usage: Quick debugging and structure verification

class ASCIIRenderer {
    
    // Render DNA structure
    static renderDNA(topSequence, bottomSequence) {
        if (topSequence.length !== bottomSequence.length) {
            return "ERROR: Top and bottom sequences must be same length";
        }
        
        const length = topSequence.length;
        
        // Build top line with directional markers
        let topLine = "3'-" + topSequence.split('').join('-') + "-5'";
        
        // Build middle line with X linkages (n-1 linkages for n bases)
        let middleLine = "   ";  // Offset for alignment
        for (let i = 0; i < length - 1; i++) {
            middleLine += " ╳ ";
        }
        
        // Build bottom line with directional markers
        let bottomLine = "5'-" + bottomSequence.split('').join('-') + "-3'";
        
        return topLine + '\n' + middleLine + '\n' + bottomLine;
    }
    
    // Render RNA structure (straight)
    static renderRNA(sequence) {
        return "5'-" + sequence.split('').join('-') + "-3'";
    }
    
    // Render RNA with 60° bend
    static renderRNAWithBend(sequence, bendPosition) {
        if (bendPosition < 0 || bendPosition >= sequence.length - 1) {
            return "ERROR: Invalid bend position";
        }
        
        let lines = [];
        
        // Before bend
        let beforeBend = sequence.substring(0, bendPosition + 1);
        lines.push("5'-" + beforeBend.split('').join('-'));
        
        // Bend indicators
        let indent = "   " + " ".repeat(beforeBend.length * 2);
        lines.push(indent + "\\");
        
        // After bend (each base on its own indented line)
        let afterBend = sequence.substring(bendPosition + 1);
        for (let i = 0; i < afterBend.length; i++) {
            if (i === afterBend.length - 1) {
                lines.push(indent + " " + afterBend[i] + "-3'");
            } else {
                lines.push(indent + " " + afterBend[i]);
                if (i < afterBend.length - 1) {
                    lines.push(indent + "  \\");
                }
            }
        }
        
        return lines.join('\n');
    }
    
    // Render protein structure (straight, unfolded)
    static renderProtein(aminoAcidSequence) {
        // aminoAcidSequence is like "S-E60-BA-RPF-C60"
        return "N-" + aminoAcidSequence + "-C";
    }
    
    // Render protein with bends
    static renderProteinWithBend(aminoAcidSequence, bendPosition, bendAngle) {
        const aminoAcids = aminoAcidSequence.split('-');
        
        if (bendPosition < 0 || bendPosition >= aminoAcids.length - 1) {
            return "ERROR: Invalid bend position";
        }
        
        let lines = [];
        
        // Before bend
        let beforeBend = aminoAcids.slice(0, bendPosition + 1);
        lines.push("N-" + beforeBend.join('-'));
        
        // Bend indicator
        let indent = "  " + " ".repeat(beforeBend.join('-').length + 1);
        if (bendAngle === 60) {
            lines.push(indent + "\\");
        } else if (bendAngle === 120) {
            lines.push(indent + "/");
        }
        
        // After bend
        let afterBend = aminoAcids.slice(bendPosition + 1);
        for (let i = 0; i < afterBend.length; i++) {
            if (i === afterBend.length - 1) {
                lines.push(indent + " " + afterBend[i] + "-C");
            } else {
                lines.push(indent + " " + afterBend[i]);
                if (i < afterBend.length - 1) {
                    if (bendAngle === 60) {
                        lines.push(indent + "  \\");
                    } else {
                        lines.push(indent + "  /");
                    }
                }
            }
        }
        
        return lines.join('\n');
    }
    
    // Render hex grid structure (show q,r coordinates)
    static renderHexGrid(hexStructure) {
        // Find bounds
        let minQ = Infinity, maxQ = -Infinity;
        let minR = Infinity, maxR = -Infinity;
        
        for (const hex of hexStructure.hexes) {
            minQ = Math.min(minQ, hex.q);
            maxQ = Math.max(maxQ, hex.q);
            minR = Math.min(minR, hex.r);
            maxR = Math.max(maxR, hex.r);
        }
        
        let lines = [];
        
        // Build grid row by row
        for (let r = minR; r <= maxR; r++) {
            let line = "";
            
            // Offset for hex grid
            if (r % 2 === 1) {
                line += "  ";
            }
            
            for (let q = minQ; q <= maxQ; q++) {
                const hex = hexStructure.hexes.find(h => h.q === q && h.r === r);
                if (hex) {
                    line += hex.type + "   ";
                } else {
                    line += ".   ";
                }
            }
            
            lines.push(line);
        }
        
        return lines.join('\n');
    }
}

// Example usage and tests
function testASCIIRenderer() {
    console.log("=== DNA Structure ===");
    console.log(ASCIIRenderer.renderDNA("ACGT", "TGCA"));
    console.log();
    
    console.log("=== RNA Structure (straight) ===");
    console.log(ASCIIRenderer.renderRNA("ACGUA"));
    console.log();
    
    console.log("=== RNA Structure (with bend at position 2) ===");
    console.log(ASCIIRenderer.renderRNAWithBend("ACGUA", 2));
    console.log();
    
    console.log("=== Protein Structure (straight) ===");
    console.log(ASCIIRenderer.renderProtein("S-E60-BA-RPF-C60"));
    console.log();
    
    console.log("=== Protein Structure (with 60° bend at position 2) ===");
    console.log(ASCIIRenderer.renderProteinWithBend("S-E60-BA-RPF-C60", 2, 60));
    console.log();
    
    console.log("=== Hex Grid (DNA) ===");
    const dnaHexes = {
        hexes: [
            { q: 0, r: 0, type: 'A' },
            { q: 1, r: 0, type: 'C' },
            { q: 2, r: 0, type: 'G' },
            { q: 3, r: 0, type: 'T' },
            { q: 0, r: 1, type: '╳' },
            { q: 1, r: 1, type: '╳' },
            { q: 2, r: 1, type: '╳' },
            { q: 0, r: 2, type: 'T' },
            { q: 1, r: 2, type: 'G' },
            { q: 2, r: 2, type: 'C' },
            { q: 3, r: 2, type: 'A' }
        ]
    };
    console.log(ASCIIRenderer.renderHexGrid(dnaHexes));
}

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ASCIIRenderer;
}

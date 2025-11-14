# Design Notes

## Inspirations
- **Opus Magnum**: Spatial programming, optimization metrics (cost/cycles/area), elegant geometric visuals
- **Codex of Alchemical Engineering**: Pipeline-based puzzle solving

## Core Game Loop (Planned)
1. Player receives a puzzle: "Produce protein X from this DNA sequence"
2. Player places molecular machines in workspace (ribosomes, spliceosomes, chaperones, etc.)
3. Player configures/programs the machines
4. Simulation runs, showing molecules flowing through the system
5. Success measured by: correctness, efficiency (cycles), space used, machines placed

## Biological Process Stages
1. **DNA → Transcription → RNA**: RNA polymerase reads DNA, produces pre-mRNA
2. **RNA → Post-Transcriptional Modifications**: Splicing (remove introns), 5' cap, poly-A tail
3. **RNA → Translation → Protein**: Ribosome reads mRNA, produces amino acid chain
4. **Protein → Post-Translational Modifications**: Folding, phosphorylation, glycosylation, etc.

## Open Questions
- How abstract should the molecular representations be?
- Should we simulate real codon tables or simplified versions?
- How do we make splicing/modifications interesting puzzles?
- Real-time vs turn-based execution?


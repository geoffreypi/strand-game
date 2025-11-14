# Prototype v1 - Transcription Mechanic

## Overview
This is the first playable prototype focusing on the DNA → RNA transcription step. It demonstrates the core spatial puzzle mechanics inspired by Opus Magnum.

## Features Implemented
- ✅ Grid-based workspace (Opus Magnum style)
- ✅ RNA Polymerase machine placement
- ✅ DNA sequence input
- ✅ Visual molecule flow (RNA nucleotides)
- ✅ Target matching system
- ✅ Stats tracking (Cycles, Machines, Area)
- ✅ Play/Pause/Reset controls

## How to Play
1. **Select Tool**: Click "RNA Polymerase" in the left panel
2. **Place Machine**: Click on the grid to place your RNA polymerase
3. **Run**: Click the "Run" button to start transcription
4. **Observe**: Watch as the DNA sequence is transcribed into RNA
5. **Win**: Match the target RNA sequence to solve the puzzle

## Game Mechanics
- **DNA → RNA Transcription**: The RNA polymerase reads the DNA sequence and produces complementary RNA bases
  - A → U
  - T → A
  - G → C
  - C → G

## Optimization Metrics (Opus Magnum style)
- **Cycles**: How many steps it takes to complete
- **Machines**: Number of machines placed
- **Area**: Bounding box of your machine layout

## Next Steps for Development
- [ ] Add more machine types (spliceosomes, modifiers)
- [ ] Implement rotation for directional machines
- [ ] Add conveyor/track system for molecule transport
- [ ] Multiple puzzle levels with increasing complexity
- [ ] Better animations and visual feedback
- [ ] Post-transcriptional modification mechanics
- [ ] Leaderboards for optimization challenges

## Technical Notes
- Built with React and HTML5 Canvas
- Self-contained single-file component
- Uses lucide-react for icons
- Tailwind CSS for styling

# Molecular Logic System

## Overview

Proteins in STRAND can function as molecular computers. By arranging functional amino acids, players build logic circuits that respond to environmental conditions (DNA binding, ATP availability) and trigger actions (attract ATP, push molecules, eject bonds).

## Signal Flow Model

### Current Implementation

Signals propagate through SIG residues, which act as conductors:
- **BTx** residues become signal SOURCES when bound to matching DNA
- **SIG** residues conduct signal (OR logic - on if ANY neighbor is on)
- **AND** residues require ALL signal-capable neighbors to be ON, plus adjacent ATP
- **Actuators** (ATR, PSH, etc.) activate when they receive signal

```
Example chain:

N-[BTx]-[SIG]-[SIG]-[ATR]-C

1. BTx binds DNA → becomes SOURCE
2. Signal propagates through SIGs (75% chance per tick)
3. ATR receives signal → activates
```

### The Feedback Loop Problem

Without directionality, circuits can latch ON permanently:

```
Problem scenario:

    BTx → SIG → AND → SIG → ATR
              ↑     ↓
              └──←──┘   (AND stays on forever once triggered)
```

Once AND turns ON, it signals its SIG neighbor, which keeps AND's input ON.

### PROPOSED: Directional Signal Flow (N → C)

One solution is to enforce directionality along the protein backbone:

| Residue | Input From | Output To | Notes |
|---------|------------|-----------|-------|
| BTx     | Binding site | ALL directions | Source when bound to matching DNA |
| SIG     | ALL neighbors | Toward C only | Conducts signal forward |
| AND     | ALL neighbors | Toward C only | ON when all inputs ON + ATP |
| NOT     | Toward N | Toward C | Inverts signal |
| ATR     | Toward N | None | Actuator - attracts ATP when signaled |
| PSH     | Toward N | None | Actuator - pushes bound molecule |
| EJT     | Toward N | None | Actuator - ejects/unbinds adjacent molecule |
| RPF     | Toward N | None | Actuator - creates RNA base |

**Pros:**
- Prevents feedback loops
- Uses natural protein polarity

**Cons:**
- More restrictive
- May limit interesting circuit designs

### DECIDED: Explicit INP/OUT Ports for Gates

Gates (AND, NOT) use explicit input and output residues to define signal flow:

#### INP (Input Port)
```
INP behavior:
- Receives signal from adjacent SIG or other signal source
- Passes signal state to adjacent gate (AND, NOT)
- Does NOT output to other SIG residues
- Acts as a one-way valve into gates
```

#### OUT (Output Port)
```
OUT behavior:
- Receives signal from adjacent gate (AND, NOT)
- Outputs to adjacent SIG residues
- Acts as a one-way valve out of gates
```

#### Gate Wiring Example

```
Without INP/OUT (feedback problem):

N-SIG-AND-SIG-C
      ↑   ↓
      └───┘  (loops forever)


With INP/OUT (clean flow):

N-SIG-INP-AND-OUT-SIG-C
      →   →   →   →

INP blocks signal from flowing back into SIG
OUT only emits forward to SIG
```

#### Multi-Input AND Gate

```
        SIG─INP
             \
              AND─OUT─SIG─ATR
             /
        SIG─INP

AND checks: Are both INPs receiving signal? Is ATP adjacent?
If yes: OUT emits signal → flows to ATR
```

#### NOT Gate with INP/OUT

```
SIG─INP─NOT─OUT─SIG

- If INP is ON → NOT is OFF → OUT emits nothing
- If INP is OFF → NOT is ON → OUT emits signal
```

**Advantages:**
- Clear signal flow direction
- No feedback loops
- Gates can have multiple inputs (multiple INPs)
- Matches digital circuit design intuition

## Residue Specifications

### Signal Sources

#### BTx (Bind-Thymine, Bind-Adenine, etc.)
- **BTA**: Binds Adenine, source when bound
- **BTT**: Binds Thymine/Uracil, source when bound
- **BTG**: Binds Guanine, source when bound
- **BTC**: Binds Cytosine, source when bound

```
Behavior:
- When adjacent DNA/RNA base matches: becomes signal SOURCE
- Emits signal in ALL directions
- Does NOT consume ATP
```

### Signal Conductors

#### SIG (Signal)
```
Behavior:
- Input: ANY adjacent signal-capable residue that is ON
- Output: Toward C-terminus only
- Logic: OR gate (on if ANY input is on)
- Probability: 75% chance to activate per tick
```

### Gate Ports

#### INP (Input Port)
```
Behavior:
- Receives signal from adjacent SIG, BTx, or other source
- ON when ANY adjacent source is ON (OR of inputs)
- Passes state to ALL adjacent gates (AND, NOT)
- Does NOT propagate signal to other SIG residues
- One-way valve INTO gates
- Does NOT consume ATP (just a wire)
```

**Fan-in and fan-out:**
```
Multiple sources → INP (OR):
    SIG─┐
        INP─AND       (INP is ON if EITHER SIG is ON)
    SIG─┘

INP → Multiple gates:
        ┌─AND─OUT
    INP─┤
        └─NOT─OUT     (both gates receive INP's state)
```

#### OUT (Output Port)
```
Behavior:
- Connected to gate(s) (AND, NOT)
- ON when ANY adjacent gate outputs signal (OR of gates)
- Propagates signal to adjacent SIG residues
- One-way valve OUT OF gates
- Does NOT consume ATP (just a wire)
```

**Fan-in and fan-out:**
```
Multiple gates → OUT (OR):
    AND─┐
        OUT─SIG       (OUT is ON if EITHER gate is ON)
    NOT─┘

Gate → Multiple OUTs:
       ┌─OUT─SIG
    AND─OUT─SIG       (all OUTs mirror gate's state)
       └─OUT─SIG
```

### Logic Gates

#### AND (And Gate)
```
Behavior:
- Checks ALL adjacent INP residues
- ON when ALL adjacent INPs are ON (even if only one INP)
- Requires: Adjacent ATP (consumed on activation)
- Outputs through adjacent OUT residue(s)
- Probability: 75% chance when conditions met
```

**Wiring examples:**
```
Single input:
    INP─AND─OUT       (AND is ON when INP is ON + ATP)

Multiple inputs:
    INP─┐
        AND─OUT       (AND is ON when BOTH INPs are ON + ATP)
    INP─┘
```

#### NOT (Inverter / NOR)
```
Behavior:
- Checks ALL adjacent INP residues
- ON when ALL adjacent INPs are OFF
- OFF when ANY adjacent INP is ON
- Outputs through adjacent OUT residue
- Requires: Adjacent ATP (consumed on activation)
- Probability: 75% chance when conditions met
```

**Wiring examples:**
```
Single input (inverter):
    INP─NOT─OUT       (NOT outputs ON when INP is OFF)

Multiple inputs (NOR gate):
    INP─┐
        NOT─OUT       (NOT outputs ON only when BOTH INPs are OFF)
    INP─┘
```

**Use case**: Detect when something is NOT bound or NOT signaled.

### Actuators

#### ATR (Attract ATP)
```
Behavior:
- When signaled (input from N-side is ON):
  - Attracts free ATP to adjacent empty hex
  - 75% chance per tick
- Does NOT consume ATP (just attracts it)
```

#### PSH (Push) - PROPOSED
```
Behavior:
- When signaled + adjacent ATP:
  - Consumes 1 ATP
  - Translates bound molecule 1 hex in a direction
  - Direction determined by residue orientation
- Use case: Walking along DNA during transcription
```

#### EJT (Eject) - PROPOSED
```
Behavior:
- When signaled + adjacent ATP:
  - Consumes 1 ATP
  - Unbinds molecule adjacent to EJT
  - Ejected molecule becomes free-floating
- Use case: Releasing from promoter, termination
```

#### RPF (Replicate Forward) - NEEDS REVISION
```
Behavior:
- When signaled + adjacent ATP:
  - Reads DNA base in "up" direction (toward bound strand)
  - Creates complementary RNA base in "down" direction
  - Consumes 1 ATP
- Use case: Transcription - creating mRNA from DNA template
```

## Spatial Adjacency

### Hex Grid Neighbors

Each hex has 6 neighbors. For a residue at position (q, r):
```
        (q+1, r-1)  (q, r-1)
              \      /
    (q+1, r) -- (q,r) -- (q-1, r)
              /      \
        (q, r+1)  (q-1, r+1)
```

### Sources of Spatial Adjacency

1. **Backbone neighbors**: Always adjacent (toward N and toward C)
2. **Folding**: Protein bends bring distant residues spatially close
3. **Binding**: Other molecules occupy adjacent hexes

### AND Gate Example with Folding

```
Unfolded (AND has only 2 neighbors):

N-BTA-SIG-AND-SIG-ATR-C
       ↑   ↓
     (only backbone neighbors)


Folded (AND gains spatial neighbor via INP):

N-BTA-SIG-INP
           \
            AND-OUT-SIG-ATR-C
           /
    BTG-INP  ← (folding brought BTG's INP adjacent to AND)
```

Now AND has 2 INP inputs: one from BTA's chain, one from BTG via folding.

## Example Circuits

### Simple Signal Chain (no gates)
```
N-BTA-SIG-SIG-ATR-C

When DNA-A binds to BTA:
1. BTA becomes SOURCE
2. Signal propagates through SIGs (75% per step)
3. ATR activates, attracts ATP
```

### AND Gate Circuit
```
N-BTA-SIG-INP
           \
            AND-OUT-SIG-ATR-C
           /    +
    BTG-INP    ATP

Requirements for ATR to activate:
1. DNA-A bound to BTA → signal to first INP
2. DNA-G bound to BTG → signal to second INP
3. ATP adjacent to AND (consumed)
4. AND fires → OUT propagates → ATR activates
```

### NOT Gate for Conditional Logic
```
        BTx-INP-NOT-OUT
                    \
SIG-INP--------------AND-OUT-PSH-C
                    /
                  ATP

PSH only fires when:
- BTx is NOT bound (NOT→OUT is ON)
- Other SIG pathway is ON (via its INP)
- Both INPs into AND are ON
- ATP available (consumed by AND)
```

## Transcription Mechanism

### The Two-Protein Model

```
Hex grid layout:

row 0   5'-<A>-<T>-<G>-<C>-<T>-<A>-3'        Sense (5'→3')
row 1       :   :   :   :   :   :
row 2       :   :   :   :   :   :
row 3       :   :   :   :   :   :
row 4     3'-<T>-<A>-<C>-<G>-<A>-<T>-5'      Antisense (3'→5')
row 5                       +   +
row 6                      BTx-RPF-RPF-PSH   Protein 2
row 7                          +   +
row 8                        <U>-<A>         mRNA (5'→3')
```

### Protein 1: Initiation Factor
- Binds promoter region on antisense strand
- Recruits Protein 2 via protein-protein binding
- Detaches once Protein 2 begins transcription

### Protein 2: RNA Polymerase
- **BTx**: Anchors to antisense strand
- **RPF-RPF**: Two adjacent RPFs read template, create mRNA below
- **PSH**: Walks protein rightward (5' direction on antisense)

### Signal Logic for Transcription

```
Protein 2 circuit (using INP/OUT):

BTx (bound to DNA) → SOURCE
        |
       SIG
        |
       INP──────────┐
                    │
Prot1-binding-INP───NOT──OUT──INP──AND──OUT──SIG──PSH
                              /     +
                 (from BTx) ─┘    ATP

PSH fires when:
1. BTx bound to DNA → first INP to AND is ON
2. NOT bound to Protein 1 → NOT inverts → second INP to AND is ON
3. ATP adjacent to AND (consumed)
4. AND fires → OUT → SIG → PSH activates
```

### Termination

When BTx encounters terminator sequence:
- Different BTx or sequence recognition triggers STOP signal
- EJT residue fires, releasing protein from DNA
- Transcription ends

## Open Questions

### 1. PSH Direction
- How is push direction encoded?
- Along backbone direction? Specific hex direction?

### 2. EJT Targeting
- Does EJT eject a specific neighbor or any bound molecule?
- Can a protein eject itself from DNA?

### 3. Signal Timing
- Current: 75% probability per tick
- Should logic gates be deterministic (100%)?
- How many ticks for full propagation?

### 4. Protein-Protein Binding
- What residue type binds proteins together?
- How does binding block/enable signal flow?

## Implementation Status

| Residue | Specified | Implemented | Tested |
|---------|-----------|-------------|--------|
| BTA/T/G/C | Yes | Yes | Yes |
| SIG | Yes | Yes | Yes |
| AND | Yes | Yes (needs INP/OUT update) | Yes |
| ATR | Yes | Yes | Yes |
| INP | Yes | No | No |
| OUT | Yes | No | No |
| NOT | Yes | No | No |
| PSH | Partial | No | No |
| EJT | Partial | No | No |
| RPF | Partial | Partial | No |

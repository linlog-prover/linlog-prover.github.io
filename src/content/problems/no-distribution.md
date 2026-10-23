---
title: "With does not distribute"
sequent: "A & (B + C) |- (A & B) + (A & C)"
mode: "classical"
verdict: "unprovable"
level: 3
categories: [additives, classical]
fragment: "ALL"
lesson: 3
order: 131
---
`&` on the right is proved twice from the same hypothesis, once for `A` and once for `B` (or `C`); the hypothesis gives `B ⊕ C` for the second, whose two cases cannot both give `B`, and the choice between `A & B` and `A & C` must be made before the case is known.

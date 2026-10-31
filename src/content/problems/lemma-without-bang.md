---
title: "A lemma used twice, without !"
sequent: "A, A -o B |- B * B"
mode: "intuitionistic"
verdict: "unprovable"
level: 2
categories: [multiplicatives, intuitionistic]
fragment: "IMLL"
lesson: 9
order: 199
---
No proof: the goal asks for two `B` and the hypotheses give one. A cut on `B` proves `B` once, and the premise that uses it, `B ⊢ B ⊗ B`, has a `B` too few; linlog counts the atoms and says so. A lemma can be used twice only under `!`.

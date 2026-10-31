---
title: "A lemma in a chain"
sequent: "A, A -o B, B -o C, C -o D |- D"
mode: "intuitionistic"
verdict: "provable"
level: 2
categories: [multiplicatives, intuitionistic]
fragment: "IMLL"
lesson: 9
order: 198
---
A cut on `C` proves the lemma `A, A ⊸ B, B ⊸ C ⊢ C` and uses it in `C ⊸ D, C ⊢ D`: nine inferences. The cut-free proof, three `⊸L` and four axioms, has seven. The lemma is used once, so the cut only adds its own inference and an axiom on `C`.

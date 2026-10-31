---
title: "One lemma, two uses"
sequent: "!(A -o B), !(B -o C), !A |- C * C"
mode: "intuitionistic"
verdict: "provable"
level: 4
categories: [multiplicatives, exponentials, intuitionistic]
fragment: "IMELL"
lesson: 9
order: 200
---
Prove the lemma `!C` once from the three hypotheses, by `!R` since all three are under `!`, then cut on it: `!c` copies `!C`, and each copy gives a `C`. Sixteen inferences with the cut; the cut-free proof derives `C` twice, twenty inferences.

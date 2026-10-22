---
title: Of course carries a chain
sequent: "!(A -o B), !(B -o C) |- !A -o !C"
mode: intuitionistic
difficulty: 3
verdict: provable
lesson: 6
order: 162
---
`⊸R` puts `!A` on the left; now every hypothesis is under `!`, so `!C` may be promoted, and `A`, `A ⊸ B` and `B ⊸ C`, each taken out of its `!` once, give `C`.

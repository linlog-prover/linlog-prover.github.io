---
title: Currying
sequent: "A -o (B -o C) |- (A * B) -o C"
mode: intuitionistic
difficulty: 2
verdict: provable
order: 5
---
`⊸R` moves `A ⊗ B` to the left, `⊗L` takes it apart, and two `⊸L` use up the
hypothesis one argument at a time.

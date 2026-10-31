---
title: "Some x is not this x"
sequent: "exists x. p(x) |- p(a)"
mode: "intuitionistic"
verdict: "unprovable"
level: 2
categories: [quantifiers, intuitionistic]
fragment: "IMLL1"
lesson: 10
order: 205
---
No proof: `∃L` opens `∃x. p(x)` with a fresh eigenvariable, `p(b)`, never with the constant `a` the goal names, and `p(b) ⊢ p(a)` is no axiom. Knowing that something has `p` says nothing of `a`.

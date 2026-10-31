---
title: "For all, through an implication"
sequent: "forall x. (p(x) -o q(x)) |- (forall x. p(x)) -o forall x. q(x)"
mode: "intuitionistic"
verdict: "provable"
level: 2
categories: [multiplicatives, quantifiers, intuitionistic]
fragment: "IMLL1"
lesson: 10
order: 207
---
`⊸R` takes `∀x. p(x)` as a hypothesis, `∀R` makes the eigenvariable `a` for the goal `q(a)`, and both `∀` hypotheses take `a` as their witness: `p(a) ⊸ q(a)` and `p(a)`, joined by `⊸L`.

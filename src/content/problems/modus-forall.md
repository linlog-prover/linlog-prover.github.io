---
title: "For every x, and this one"
sequent: "forall x. (p(x) -o q(x)), p(a) |- exists y. q(y)"
mode: "intuitionistic"
verdict: "provable"
level: 1
categories: [multiplicatives, quantifiers, intuitionistic]
fragment: "IMLL1"
lesson: 10
order: 204
---
The witness is the constant `a` both times: `∃R` with `a` asks for `q(a)`, and `∀L` with `a` takes the instance `p(a) ⊸ q(a)`, which `⊸L` applies to the hypothesis `p(a)`.

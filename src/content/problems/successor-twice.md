---
title: "Two steps of a successor"
sequent: "!(forall x. p(x) -o p(f(x))), p(a) |- p(f(f(a)))"
mode: "intuitionistic"
verdict: "provable"
level: 3
categories: [multiplicatives, exponentials, quantifiers, intuitionistic]
fragment: "IMELL1"
lesson: 10
order: 213
---
The rule is needed twice, so `!c` copies it; the witnesses are terms: `a` for the step from `p(a)` to `p(f(a))`, and `f(a)` for the step on to `p(f(f(a)))`.

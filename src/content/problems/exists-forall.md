---
title: "Exists for all, then for all exists"
sequent: "exists y. forall x. r(x, y) |- forall x. exists y. r(x, y)"
mode: "intuitionistic"
verdict: "provable"
level: 2
categories: [quantifiers, intuitionistic]
fragment: "IMLL1"
lesson: 10
order: 206
---
Make the eigenvariables first: `∀R` gives `a`, `∃L` gives `b`. Then the witnesses can name them: `∃R` takes `b`, `∀L` takes `a`, and `r(a, b) ⊢ r(a, b)` is the axiom.

---
title: "For all, used twice"
sequent: "forall x. p(x) |- p(a) * p(b)"
mode: "intuitionistic"
verdict: "unprovable"
level: 2
categories: [multiplicatives, quantifiers, intuitionistic]
fragment: "IMLL1"
lesson: 10
order: 208
---
No proof: `∀L` takes one instance, `p(a)` or `p(b)`, and uses the hypothesis up. The goal needs two, so `p` occurs once too often on the right, as linlog's count says. Under `!` the hypothesis could be copied first.

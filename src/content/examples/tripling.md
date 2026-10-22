---
title: A tripling machine
sequent: "!(a -o a * a * a), !(a -o a), a |- a * (a + 0)"
mode: intuitionistic
difficulty: 3
verdict: unprovable
lesson: 7
order: 46
---
Each use of `a ⊸ a ⊗ a ⊗ a` adds two `a`, so their number stays odd and never reaches two. The inverse method derives every sequent that can stand in a proof of this goal, and the goal is not among them: a saturation, which linlog checks.

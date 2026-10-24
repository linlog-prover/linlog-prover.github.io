---
title: "One formula too many"
sequent: "|- ~A, A, B"
mode: "classical"
verdict: "unprovable"
level: 1
categories: [classical]
fragment: "MLL"
lesson: 1
order: 101
---
The axiom needs `A⊥` and `A` alone: `B` would be left over, and only `⊤` (which closes a goal it is in) or `?w` (which drops a formula under `?`) disposes of a formula; the goal has neither.

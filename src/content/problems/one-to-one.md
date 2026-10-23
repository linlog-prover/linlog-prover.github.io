---
title: "One token, one token"
sequent: "!(a -o b), !(b -o c), a |- c * c"
mode: "intuitionistic"
verdict: "unprovable"
level: 3
categories: [multiplicatives, exponentials, intuitionistic]
fragment: "IMELL"
lesson: 7
order: 173
---
Every rule turns one token into one, so one `a` gives one `c` at most, and the goal wants two; the Horn engine's search tries every firing and finds none that reaches it.

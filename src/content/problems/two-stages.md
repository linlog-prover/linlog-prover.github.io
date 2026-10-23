---
title: "A machine of two stages"
sequent: "!(a -o b * b), !(b * b -o c), a |- c"
mode: "intuitionistic"
verdict: "provable"
level: 3
categories: [multiplicatives, exponentials, intuitionistic]
fragment: "IMELL"
lesson: 7
order: 172
---
The first rule turns `a` into two `b`, the second two `b` into `c`: each used once, though `!` would allow more, and the search finds that once is enough.

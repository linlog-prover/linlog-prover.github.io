---
title: "A lemma that cannot be promoted"
sequent: "!A, A -o B |- B * B"
mode: "intuitionistic"
verdict: "unprovable"
level: 3
categories: [multiplicatives, exponentials, intuitionistic]
fragment: "IMELL"
lesson: 9
order: 201
---
No proof. The lemma `!B` would need `!R`, which takes only hypotheses under `!`, and `A ⊸ B` is not; without it, `A ⊸ B` gives one `B` and the goal needs two, which linlog's count of `B` shows.

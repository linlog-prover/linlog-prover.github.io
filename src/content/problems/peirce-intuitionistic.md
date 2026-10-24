---
title: "Peirce's law, translated intuitionistically"
sequent: "|- !(!(!A -o B) -o A) -o A"
mode: "intuitionistic"
verdict: "unprovable"
level: 3
categories: [multiplicatives, exponentials, intuitionistic]
fragment: "IMELL"
lesson: 9
order: 193
---
The image of Peirce's law, `((A → B) → A) → A`, under Girard's call-by-name translation, as `linlog seq print --logic intuitionistic` prints it. The law does not hold intuitionistically, and its image has no proof: to use the hypothesis one must prove `!A ⊸ B`, and nothing gives `B`.

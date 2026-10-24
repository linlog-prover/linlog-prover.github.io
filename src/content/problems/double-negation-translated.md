---
title: "Double negation, translated intuitionistically"
sequent: "|- !(!(!A -o 0) -o 0) -o A"
mode: "intuitionistic"
verdict: "unprovable"
level: 2
categories: [multiplicatives, units, exponentials, intuitionistic]
fragment: "ILL"
lesson: 9
order: 196
---
The image of `¬¬A → A` under Girard's call-by-name translation, `¬A` written `A → ⊥` and `⊥` as `0`. Intuitionistically the law fails, and the image has no proof: using the hypothesis needs a proof of `!A ⊸ 0`, which asks for `0` from `!A`, and only the hypothesis itself gives `0`, which asks for the same again.

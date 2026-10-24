---
title: "The S combinator, translated"
sequent: "|- !(!A -o (!B -o C)) -o (!(!A -o B) -o (!A -o C))"
mode: "intuitionistic"
verdict: "provable"
level: 4
categories: [multiplicatives, exponentials, intuitionistic, literature]
fragment: "IMELL"
source: "Derived here from Wikipedia, “Linear logic”, read 2026-10-23, Extending classical/intuitionistic logic, whose encoding of intuitionistic implication as !A ⊸ B is applied to the type of the S combinator, (A ⇒ B ⇒ C) ⇒ (A ⇒ B) ⇒ A ⇒ C"
url: "https://en.wikipedia.org/wiki/Linear_logic"
lesson: 9
order: 197
---
Both translated hypotheses need the argument `!A`: `!c` copies it, and each copy goes into its application by `!R`.

---
title: "The W combinator, translated"
sequent: "|- !(!A -o (!A -o B)) -o (!A -o B)"
mode: "intuitionistic"
verdict: "provable"
level: 4
categories: [multiplicatives, exponentials, intuitionistic, literature]
fragment: "IMELL"
source: "Derived here from Wikipedia, “Linear logic”, read 2026-10-23, Extending classical/intuitionistic logic, whose encoding of intuitionistic implication as !A ⊸ B is applied to the type of the W combinator, (A ⇒ A ⇒ B) ⇒ A ⇒ B"
url: "https://en.wikipedia.org/wiki/Linear_logic"
lesson: 11
order: 195
---
The argument `!A` is used twice: `!c` copies it, and each copy goes into one application by `!R`.

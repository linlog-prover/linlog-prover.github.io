---
title: "The K combinator, translated"
sequent: "|- !A -o (!B -o A)"
mode: "intuitionistic"
verdict: "provable"
level: 2
categories: [multiplicatives, exponentials, intuitionistic, literature]
fragment: "IMELL"
source: "Derived here from Wikipedia, “Linear logic”, read 2026-10-23, Extending classical/intuitionistic logic, whose encoding of intuitionistic implication as !A ⊸ B is applied to the type of the K combinator, A ⇒ (B ⇒ A)"
url: "https://en.wikipedia.org/wiki/Linear_logic"
lesson: 9
order: 192
---
`!B` is never used: a hypothesis under `!` may be dropped (`!w`), which the K combinator needs.

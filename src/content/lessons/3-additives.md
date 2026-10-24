---
lesson: 3
title: "The additives"
worked: "distributivity"
choices: ["⅋", "&", "⊕₁", "⊕₂", "⊗", "ax"]
steps:
  - rule: "⅋"
    reason: "`⅋` first, since it never loses a proof: the hypothesis's parts `A⊥` and `B⊥ & C⊥` stand side by side."
  - rule: "&"
    reason: "`&` makes two premises, `B⊥` in one and `C⊥` in the other, each with the whole rest of the goal: the two cases of the hypothesis `B ⊕ C`."
  - rule: "⊕₁"
    reason: "In the case of `B`, the left side `A ⊗ B` is the one this premise can prove."
  - rule: "⊕₂"
    reason: "In the case of `C`, the right side `A ⊗ C`."
  - rule: "⊗"
    reason: "`A` takes `A⊥`, `B` takes `B⊥`."
  - rule: "⊗"
    reason: "`A` takes `A⊥`, `C` takes `C⊥`."
  - rule: "ax"
    reason: "`A⊥` and `A` alone."
  - rule: "ax"
    reason: "`B⊥` and `B` alone."
  - rule: "ax"
    reason: "`A⊥` and `A` alone, in the second case."
  - rule: "ax"
    reason: "`C⊥` and `C` alone: both cases are proved."
faded: 2
explain:
  after: 1
  prompt: "Why does each premise of `&` keep `A⊥` and the whole `(A ⊗ B) ⊕ (A ⊗ C)`, when `⊗` had to share its formulas?"
  answer: "Only one of the two premises is ever used: the hypothesis `B ⊕ C` is one case or the other, and each premise proves the goal in one case. Each needs the whole context, because in its case it is the whole proof. `⊗` holds both its parts at once, so its formulas are shared out."
hinge:
  question: "`&` acts on `B & C` in `⊢ (A ⊗ B⊥) ⊕ (A ⊗ C⊥), A⊥, B & C`. What are its premises?"
  options:
    - text: "`⊢ (A ⊗ B⊥) ⊕ (A ⊗ C⊥), A⊥, B` and `⊢ (A ⊗ B⊥) ⊕ (A ⊗ C⊥), A⊥, C`"
      why: "Each premise has the whole context, one with `B` and one with `C`."
    - text: "`⊢ (A ⊗ B⊥) ⊕ (A ⊗ C⊥), B` and `⊢ A⊥, C`"
      misconception: "`&` splits its context, as `⊗` does."
      why: "`&` copies the context into both premises; only `⊗` splits it."
    - text: "`⊢ (A ⊗ B⊥) ⊕ (A ⊗ C⊥), A⊥, B` alone"
      misconception: "`&` chooses a side, as `⊕` does."
      why: "`&` must prove both sides; choosing one is `⊕`."
    - text: "`⊢ (A ⊗ B⊥) ⊕ (A ⊗ C⊥), A⊥, B, C` alone"
      misconception: "`&` puts its parts side by side, as `⅋` does."
      why: "`&` gives two premises, `B` in one and `C` in the other, never both in one."
---
`&` gives both premises the whole context, the same formulas copied rather than split,
and never loses a proof. `⊕` chooses one side, `⊕₁` the left and `⊕₂` the right, and
the choice can be the wrong one. Read as a hypothesis, `A & B` is one resource you take
either part of, and `A ⊕ B` is two cases you must answer.

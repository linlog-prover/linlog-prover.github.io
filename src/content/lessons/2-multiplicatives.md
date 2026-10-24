---
lesson: 2
title: "The multiplicatives"
worked: "commute"
choices: ["⅋", "⊗", "ax"]
steps:
  - rule: "⅋"
    reason: "`⅋` puts `A⊥` and `B⊥` side by side in one premise. It never loses a proof, so it goes first."
  - rule: "⊗"
    reason: "`⊗` splits the goal: `B` takes `B⊥` with it, `A` takes `A⊥`, so that each atom meets its dual."
  - rule: "ax"
    reason: "`B⊥` and `B` alone: the axiom."
  - rule: "ax"
    reason: "`A⊥` and `A` alone: the axiom again, and the proof is finished."
detour:
  before: 1
  left: [0]
  text: "First a split that is legal and leads nowhere: `A⊥` goes with `B`, and `B⊥` with `A`. Neither premise holds an atom with its own dual, so neither can be closed. The next step takes it back and plays the right split."
faded: 1
explain:
  after: 1
  prompt: "Where do the left premise's formulas come from, and why must `B⊥` be among them?"
  answer: "From the goal: every formula beside `B ⊗ A` goes to exactly one premise, and the left one proves `B`. `B` closes only with `B⊥`, so `B⊥` must go there; `A⊥` is needed by `A` on the right."
hinge:
  question: "In `⊢ A⊥, B⊥, C⊥, (A ⊗ B) ⊗ C`, which split of the `⊗` can pass?"
  options:
    - text: "`A⊥, B⊥` with `A ⊗ B`; `C⊥` with `C`"
      why: "Each atom goes where its dual is: `A ⊗ B` needs `A⊥` and `B⊥`, and `C` needs `C⊥`."
    - text: "`A⊥` with `A ⊗ B`; `B⊥, C⊥` with `C`"
      misconception: "A factor of `⊗` needs one formula beside it, however many atoms it has: the split counts formulas instead of matching atoms."
      why: "`A ⊗ B` needs both `A⊥` and `B⊥`; `C` cannot use `B⊥`."
    - text: "`A⊥, B⊥, C⊥` with `A ⊗ B`; nothing with `C`"
      misconception: "A premise can do without the duals of its atoms."
      why: "`⊢ C` alone has no proof, and `C⊥` is left over beside `A ⊗ B`."
---
`⅋` puts its two parts side by side in the same goal, and never loses a proof: apply it
first. `⊗` splits the goal into two premises, its left part with some of the other
formulas and its right part with the rest, each formula in exactly one premise. The
split is where a proof is won or lost. `A -o B` is typed for `A⊥ ⅋ B`.

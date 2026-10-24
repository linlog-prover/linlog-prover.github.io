---
lesson: 5
title: "The exponentials"
worked: "copy-drop"
choices: ["?d", "?c", "?w", "!", "⊗", "ax"]
steps:
  - rule: "?w"
    reason: "`?B⊥`, the hypothesis `!B`, is not needed: `?w` drops it."
  - rule: "?c"
    reason: "`A` is needed twice, once for `!A` and once for `A`: `?c` copies `?A⊥`."
  - rule: "⊗"
    reason: "One copy of `?A⊥` goes with `!A`, the other with `A`."
  - rule: "!"
    reason: "`!A` may be promoted: the only other formula of its goal, `?A⊥`, is under `?`."
  - rule: "?d"
    reason: "`?d` takes one `A⊥` out of `?A⊥`, for the `A` on the right of the split."
  - rule: "?d"
    reason: "The same above the promotion: one `A⊥` out of `?A⊥`."
  - rule: "ax"
    reason: "`A⊥` and `A` alone."
  - rule: "ax"
    reason: "`A⊥` and `A` alone: the proof is finished."
faded: 3
explain:
  after: 3
  prompt: "Why may `!` act on `!A` here, and why does it need every other formula of the goal under `?`?"
  answer: "`!A` promises as many `A` as anyone asks for. The proof of it is used again for each copy, so everything it uses must be reusable too: formulas under `?`, hypotheses under `!`. Here that is `?A⊥` alone, so `!` may act."
hinge:
  question: "Which of these has a proof?"
  options:
    - text: "`!A ⊢ A ⊗ !A`"
      problem: "copy"
      why: "`?c` copies `?A⊥`: one copy gives `A`, the other stays under `?` beside `!A`, which can then be promoted."
    - text: "`A ⊢ !A`"
      problem: "promotion"
      misconception: "`!` can be put on any formula one has."
      why: "Promotion needs every other formula under `?`, and `A⊥` is not."
    - text: "`?A ⊢ A`"
      problem: "why-not"
      misconception: "`?` on a hypothesis gives copies, as `!` does."
      why: "A hypothesis `?A` is `!A⊥` on the right, whose promotion needs the `A` beside it under `?`."
    - text: "`A ⊢ A ⊗ A`"
      problem: "no-copy"
      misconception: "Any hypothesis may be copied."
      why: "Only a formula under `?` (a hypothesis under `!`) may be copied; `A⊥` once is one `A`."
---
A hypothesis `!A` is `?A⊥` on the right, and may be used any number of times: `?d` takes
one `A⊥` out of it, `?c` copies it, `?w` drops it. `!` (promotion) acts on `!A` only when
every other formula of the goal is under `?`: what `!A` is built from must be reusable.

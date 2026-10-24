---
lesson: 4
title: "The units"
worked: "units-together"
choices: ["⊕₁", "⊕₂", "⅋", "⊥", "⊗", "ax", "1", "⊤"]
steps:
  - rule: "⊕₁"
    reason: "The hypothesis `(A ⊗ 1) & (1 ⊗ A)` lets you take either part; either works, and the page takes the first, `A⊥ ⅋ ⊥`."
  - rule: "⅋"
    reason: "`⅋` first: `A⊥` and `⊥` side by side."
  - rule: "⊥"
    reason: "`⊥` disappears and leaves the rest of the goal."
  - rule: "⊗"
    reason: "`A` takes `A⊥`, and `1 ⊕ 0` takes nothing: `1` will need to stand alone."
  - rule: "ax"
    reason: "`A⊥` and `A` alone."
  - rule: "⊕₁"
    reason: "Choose `1`: nothing acts on `0`."
  - rule: "1"
    reason: "`1` alone: the rule `1` closes it."
faded: 3
explain:
  after: 3
  prompt: "Why must the premise of `1 ⊕ 0` hold nothing else?"
  answer: "The rule `1` has the conclusion `⊢ 1`, with nothing beside it: `1` is the unit of `⊗`, a proof made of nothing, which consumes no formula. A formula beside it would need a rule of its own to go: `⊤` closes a goal it is in, `?w` drops a formula under `?`, and here there is neither."
hinge:
  question: "Which of these goals has a proof?"
  options:
    - text: "`⊢ ⊤, A`"
      problem: "top"
      why: "`⊤` closes any goal it is in, whatever else is there."
    - text: "`⊢ 1, A, A⊥`"
      problem: "one-not-alone"
      misconception: "`1` is \"true\": it closes a goal beside an axiom."
      why: "`1` must stand alone, and nothing takes `A` and `A⊥` away from it."
    - text: "`⊢ A, A⊥, 0`"
      problem: "zero"
      misconception: "`0` is nothing, so it can be left over."
      why: "No rule acts on `0`, and nothing removes it from the goal."
    - text: "`⊢ ⊥`"
      problem: "bottom"
      misconception: "Once `⊥` disappears, the empty goal is proved."
      why: "The empty goal `⊢` has no proof: no rule closes it."
---
`1` closes a goal that holds `1` alone. `⊥` disappears and leaves the rest of the goal.
`⊤` closes any goal it is in, whatever else is there. Nothing acts on `0`. They are
each other's duals: `1⊥ = ⊥` and `⊤⊥ = 0`, so a hypothesis `1` reads `⊥` on the right.

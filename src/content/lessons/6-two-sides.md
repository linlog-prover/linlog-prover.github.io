---
lesson: 6
title: "Two sides"
worked: "composition"
choices: ["⊸R", "⊸L", "⊗R", "ax"]
steps:
  - rule: "⊸R"
    reason: "The goal `A ⊸ C` is an implication on the right: `⊸R` takes `A` as a hypothesis and leaves `C` to prove. It never loses a proof, so it goes first."
  - rule: "⊸L"
    reason: "To use the hypothesis `A ⊸ B`, prove its `A` and go on with `B` in its place. The other hypotheses are split: `A` goes to the left premise, `A ⊢ A`; `B ⊸ C` stays with the goal."
  - rule: "ax"
    reason: "`A ⊢ A`: the hypothesis proves itself."
  - rule: "⊸L"
    reason: "Now `B ⊸ C`: its `B` comes from the hypothesis `B`, and `C` takes its place beside the goal `C`."
  - rule: "ax"
    reason: "`B ⊢ B`: the axiom."
  - rule: "ax"
    reason: "`C ⊢ C`: the axiom, and the proof is finished. Each implication was used once, in a chain from `A` to `C`."
faded: 1
explain:
  after: 1
  prompt: "`⊸L` is a one-sided rule read from the other side. Which one, and why does its split work the same way?"
  answer: "One-sided, the hypothesis `A ⊸ B` is its dual `A ⊗ B⊥` on the right, and `⊸L` is `⊗` on it. The left premise proves `A` with some of the formulas; the right one keeps `B⊥`, which two-sided is `B` on the left, with the rest. Each formula goes to exactly one premise, as in `⊗`'s split."
hinge:
  question: "In `A ⊸ B, A, C ⊢ B ⊗ C`, `⊸L` acts on `A ⊸ B`. Which of the other hypotheses go to its left premise, the one that proves `A`?"
  options:
    - text: "`A` alone: `A ⊢ A`, and `B, C ⊢ B ⊗ C`"
      why: "The left premise proves `A` from the hypothesis `A`, and `C` is needed beside `B` to prove `B ⊗ C`."
    - text: "`A` and `C`: `A, C ⊢ A`, and `B ⊢ B ⊗ C`"
      misconception: "The left premise of `⊸L` takes every other hypothesis, and only `B` goes on."
      why: "`C` beside `A ⊢ A` is never used up there, and `B ⊢ B ⊗ C` has no `C`: neither premise has a proof."
    - text: "None: `⊢ A`, and `B, A, C ⊢ B ⊗ C`"
      misconception: "Using `A ⊸ B` leaves `A` in place, as modus ponens does in ordinary logic."
      why: "`⊢ A` has no proof: `⊸L` consumes the `A` it needs, and then `B, A, C ⊢ B ⊗ C` has an `A` too many."
---
In intuitionistic mode, chosen with the calculus's switch on the tab, a sequent has its
hypotheses on the left of `⊢` and exactly one formula on the right: `A ⊸ B, B ⊸ C ⊢
A ⊸ C` reads "from `A ⊸ B` and `B ⊸ C`, `A ⊸ C`". It is typed with `-o` for `⊸` and
has no `⊥`, `⅋` or `?`.

The rules come in pairs: a right rule proves the goal, a left rule uses a hypothesis,
and the stage names them so (`⊸R`, `⊸L`, `⊗L`, `⊗R`, …). Each is a one-sided rule read
from the other side, so nothing new is allowed, but something is forbidden: a rule that
would leave two formulas on the right does not exist. `⊸L` splits the hypotheses as
`⊗` splits a goal, and the split is again where a proof is won or lost.

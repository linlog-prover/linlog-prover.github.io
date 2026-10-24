---
lesson: 7
title: "When there is no proof"
worked: "wrong-choice"
choices: ["⅋", "⊕₁", "⊕₂", "⊗", "ax"]
attempt:
  text: "Someone tried `(A & B) ⊗ C ⊢ C ⊗ (B ⊕ D)`, which has a proof, and got stuck. Play the attempt, each step with its author's reason beside it, then find the step that went wrong."
  steps:
    - rule: "⅋"
      reason: "`⅋` first: it never loses a proof."
      misconception: "The first step is to blame, since every later step builds on it."
      why: "`⅋` never loses a proof: after it the goal still has one."
    - rule: "⊕₁"
      reason: "`A⊥ ⊕ B⊥` is `A & B` on the left, and I may choose its half: `A`, the first."
      why: "After this `⊕₁` the goal is `⊢ A⊥, C⊥, C ⊗ (B ⊕ D)`: `A⊥` has no `A` left to meet, so no step after it could close the goal. `⊕₂`, choosing `B⊥`, keeps a proof."
    - rule: "⊗"
      reason: "`C` takes `C⊥`, and `B ⊕ D` takes `A⊥`, the rest."
      misconception: "A split is to blame whenever an attempt gets stuck after one."
      why: "It was the only split that could pass, since `C` needs `C⊥`. The goal had no proof before it already."
    - rule: "ax"
      reason: "`⊢ C⊥, C`: the axiom."
      misconception: "A branch that closes can be where the attempt went wrong."
      why: "`⊢ C⊥, C` is closed by the axiom: that branch is finished and correct."
    - rule: "⊕₁"
      reason: "`B ⊕ D` gives `B`, since `B` was in `A & B`."
      misconception: "The wrong step is the one where the attempt got stuck."
      why: "`⊕₂` would leave `⊢ A⊥, D`, no better: with `A⊥` and no `A` in the goal, no choice here closes it. The mistake came earlier."
steps:
  - rule: "⅋"
    reason: "`⅋` puts `A⊥ ⊕ B⊥` and `C⊥` side by side. It never loses a proof."
  - rule: "⊕₂"
    reason: "`A⊥ ⊕ B⊥` is `A & B` on the left, and the half is the prover's choice: `B⊥`, because `B ⊕ D` can give the `B` it meets."
  - rule: "⊗"
    reason: "`C` takes `C⊥`; `B ⊕ D` takes `B⊥`."
  - rule: "ax"
    reason: "`⊢ C⊥, C`: the axiom."
  - rule: "⊕₁"
    reason: "`B ⊕ D` gives `B`, the dual of `B⊥`."
  - rule: "ax"
    reason: "`⊢ B⊥, B`: the axiom, and the proof is finished."
faded: 1
explain:
  after: 1
  prompt: "Count the atoms of the goal after the attempt's `⊕₁` and after this `⊕₂`. Why could the attempt never be closed, whatever came after?"
  answer: "After `⊕₁` the goal is `⊢ A⊥, C⊥, C ⊗ (B ⊕ D)`: `A⊥` occurs and `A` does not. The goal has no `⊤` and no `?`, nothing that can drop a formula, so every derivation of it ends in axioms, each pairing an atom with its dual: an atom without its dual is never used up. After `⊕₂`, `B⊥` can meet the `B` of `B ⊕ D` and `C⊥` meets `C`; `D`, inside `⊕`, need not be chosen."
gallery:
  title: "No proof, and why"
  act: "ask"
  items:
    - problem: "balance"
      text: "linlog counts each atom against its dual: here one is left over, so no proof can pair them all."
    - problem: "countermodel"
      text: "linlog reads the sequent as ordinary logic and finds truth values that make it false; every provable sequent reads as true."
    - problem: "no-certificate"
      text: "Every atom has its dual, and read as ordinary logic it is true; the search tries every way and finds none. That answer has no certificate to check."
unknown:
  sequent: "(A + B) * (A + B) |- (A * A) + (A * B) + (B * A) + (B * B)"
  mode: "classical"
  budget: 20
  text: "This sequent has a proof: whichever halves the two `A ⊕ B` give, one of the four cases on the right fits. With a budget of 20 units of work the search stops before it finds it and answers Unknown, which says nothing either way. Press Try beside the answer to double the budget: at 160 units linlog proves it. Where `!` lets a formula be copied, a search can also stop at its bound on the copies."
hinge:
  question: "Why has `A ⊗ B ⊢ A` no proof?"
  options:
    - text: "`B` is never used, and with no `⊤` and no `?` nothing can drop it: every proof pairs each atom with its dual in an axiom"
      why: "One-sided the sequent is `⊢ A⊥ ⅋ B⊥, A`: `B⊥` occurs and `B` does not. linlog's answer is the atom balance."
    - text: "Read as ordinary logic, it is false"
      misconception: "A sequent with no proof is false when read as ordinary logic."
      why: "Read so it is true: `A` and `B` give `A`. No truth values make it false; the atoms' count is what rules it out."
    - text: "The search ran out of budget"
      misconception: "When no proof is found, the search gave up."
      why: "The count decides it before any search, and linlog answers Unprovable, not Unknown: no budget would change that."
    - text: "Its first step was the wrong one"
      misconception: "A sequent has no proof when an attempt at it takes a wrong step."
      why: "A wrong step loses one attempt. Here the only step, `⅋`, never loses a proof, and `B⊥` has no `B` whatever comes after."
---
linlog gives one of three answers. Provable: it found a proof, and its checker accepted
it. Unprovable: no proof exists, and linlog says why. Unknown: the search stopped at a
bound, its budget of work or of copies, before it decided, which says nothing either
way.

An attempt that gets stuck proves nothing about the sequent: a wrong step loses one
attempt, and another may succeed. "No proof" is a claim about every attempt, so it needs
a reason that holds for all of them. linlog's reasons: an atom whose duals do not pair
off (where no `⊤` and no `?` can drop a formula, every proof ends in axioms, each
pairing an atom with its dual); a classical
countermodel (read as ordinary logic the sequent is false, and every provable sequent
reads as true); and an exhausted search, which tried every way and found none.

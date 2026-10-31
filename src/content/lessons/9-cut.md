---
lesson: 9
title: "Cut and its elimination"
worked: "lemma-twice"
choices: ["cut", "!R", "!L", "!c", "⊸L", "⊗R", "ax"]
steps:
  - rule: "cut"
    reason: "Cut on the lemma `!C`: the left premise proves it from all three hypotheses, the right one uses it to prove `C ⊗ C`. `C` is needed twice, so the lemma is `!C`, which can be copied."
  - rule: "!R"
    reason: "The lemma's goal is `!C`. Every hypothesis is under `!`, so `!R` may take the `!` off: prove `C` once, and it holds as often as needed."
  - rule: "!L"
    reason: "Use the rule `B ⊸ C` once: `!L` takes one copy out of `!(B ⊸ C)`."
  - rule: "⊸L"
    reason: "`B ⊸ C` needs a `B`: the left premise proves `B` from `!(A ⊸ B)` and `!A`, the right one goes on with `C`."
  - rule: "ax"
    reason: "`C ⊢ C`: the axiom."
  - rule: "!L"
    reason: "Now `B`: one copy of the rule `A ⊸ B` out of `!(A ⊸ B)`."
  - rule: "⊸L"
    reason: "`A ⊸ B` needs an `A`, which `!A` gives; `B` takes its place."
  - rule: "ax"
    reason: "`B ⊢ B`: the axiom."
  - rule: "!L"
    reason: "One copy of `A` out of `!A`."
  - rule: "ax"
    reason: "`A ⊢ A`: the lemma `!C` is proved, in nine inferences, once."
  - rule: "!c"
    reason: "The other premise uses the lemma. The goal needs `C` twice, so `!c` makes two copies of `!C`: what the lemma's `!` was for."
  - rule: "⊗R"
    reason: "Split: one copy of `!C` for each `C`."
  - rule: "!L"
    reason: "Take the `C` out of the first copy."
  - rule: "ax"
    reason: "`C ⊢ C`: the axiom."
  - rule: "!L"
    reason: "And the `C` out of the second copy."
  - rule: "ax"
    reason: "`C ⊢ C`, and the proof is finished: sixteen inferences, the lemma's nine written once."
faded: 0
explain:
  after: 10
  prompt: "Why is the lemma `!C` and not `C`? And why may its proof end with `!R`?"
  answer: "The goal needs `C` twice, and a lemma `C` could be used once; `!C` can be copied by `!c`, once per use. `!R` takes the `!` off a goal only when every hypothesis is under `!` (lesson 5): here all three are, so one proof of `C` holds as often as needed."
eliminate:
  text: "The proof is finished with its cut. Now eliminate it: in the cluster at the stage's top left, press Eliminate the cuts, then Next step, one step at a time. Each step names its case, and the reason stands beside it; Before shows the drawing the step was taken on, its cut marked. Then turn the stage to the net and do the same."
  cases:
    contraction: "Contraction: the `!c` that copied `!C` meets the lemma's `!R`. The lemma's proof (on the net, its box) is copied, one copy for each use, each with a cut of its own. This is the step that makes the cut-free proof longer."
    dereliction: "Dereliction: a `!L` that took `C` out of `!C` meets a copy of the lemma's `!R`. Both go, and the cut is on `C` itself: the lemma's proof of `C` against its use."
    axiom: "The axiom case: one side of the cut is the axiom `C ⊢ C`, which only passes `C` on, so the cut and the axiom both go."
counts:
  - problem: "lemma-twice"
    formula: "!C"
    with: 16
    without: 20
  - problem: "lemma-thrice-short"
    formula: "!B"
    with: 17
    without: 21
  - problem: "lemma-thrice"
    formula: "!C"
    with: 20
    without: 32
hinge:
  question: "Which of these can a cut do?"
  options:
    - text: "Shorten the proof of `!(A ⊸ B), !(B ⊸ C), !A ⊢ C ⊗ C ⊗ C`, by proving `!C` once and copying it"
      problem: "lemma-thrice"
      why: "Twenty inferences with the cut, thirty-two without: the cut-free proof derives `C` from the hypotheses three times over."
    - text: "Prove `A, A ⊸ B ⊢ B ⊗ B`, by proving `B` once and using it twice"
      problem: "lemma-without-bang"
      misconception: "A lemma, once proved, may be used as often as needed."
      why: "A lemma is a formula like any other, used once unless it is under `!`. `A, A ⊸ B ⊢ B ⊗ B` has no proof, with cuts or without."
    - text: "Prove `A ⊗ B ⊢ A` in linear logic, by cutting on a well-chosen formula"
      misconception: "A cut can prove a sequent that has no proof without one."
      why: "Every proof with cuts has one without, which elimination finds: a sequent with no cut-free proof has no proof at all, and `A ⊗ B ⊢ A` leaves `B` unused."
    - text: "Shorten the proof of `A ⊗ B ⊢ B ⊗ A`, by cutting on `B ⊗ A`"
      misconception: "A cut always makes a proof shorter."
      why: "Proving the lemma `B ⊗ A` takes the four inferences of the whole proof, and using it four more and the cut: nine against four. A cut pays when its lemma is used several times."
---
A cut proves a lemma once and uses it. Of a goal `Γ, Δ ⊢ C` it leaves two premises:
`Γ ⊢ A` proves the lemma `A` from some of the hypotheses, and `Δ, A ⊢ C` uses it
beside the rest. One-sided, the lemma is `A` in one premise and its dual `A⊥` in the
other. On the stage, a goal's Cut asks for the lemma and for the hypotheses that prove
it.

linlog's search never cuts, and needs none: every proof with cuts has one without
(cut elimination), so a cut never proves what has no proof. It can make a proof
shorter, though rarely without `!`, since each formula is used once. A lemma under `!`
is proved once and copied for each use, where the cut-free proof derives it again
every time. Eliminating the cut shows that price: the lemma's proof is copied once per
use.

---
lesson: 10
title: "The quantifiers"
worked: "exists-forall"
choices: ["∀R", "∀L", "∃R", "∃L", "ax"]
steps:
  - rule: "∀R"
    reason: "The goal `∀x. ∃y. r(x, y)` must hold for every `x`: `∀R` proves it for a fresh eigenvariable `a`, a name about which nothing is known. It never loses a proof, so it goes first."
  - rule: "∃L"
    reason: "The hypothesis says that some `y` has `∀x. r(x, y)`: `∃L` names that something with a fresh eigenvariable `b`. It never loses a proof either."
  - rule: "∃R"
    reason: "Now a witness for the goal's `∃y`: `b`, the eigenvariable `∃L` made below. The goal becomes `r(a, b)`."
  - rule: "∀L"
    reason: "The hypothesis `∀x. r(x, b)` holds for every `x`: take its instance at the witness `a`."
  - rule: "ax"
    reason: "`r(a, b) ⊢ r(a, b)`: the axiom, the same predicate of the same terms on both sides."
faded: 0
explain:
  after: 2
  prompt: "Why can `∃R` take `b` here, and why could it not have come first, before `∃L`?"
  answer: "`b` is the eigenvariable `∃L` made below this goal, so the goal may name it. Before `∃L` there was no `b`: left open, the witness would have to become `b` later, and an open witness never takes an eigenvariable made after it, the eigenvariable condition. Eigenvariables first, witnesses after."
refusal:
  problem: "forall-swap"
  text: "The other way round: from `∀x. ∃y. r(x, y)`, prove `∃y. ∀x. r(x, y)`. Here is an attempt, each step with its author's reason, and then its last step, which linlog refuses."
  steps:
    - rule: "∃R"
      reason: "A witness for `y` is needed, and no term fits yet: leave it open as `$1`, for the axiom to fill."
    - rule: "∀R"
      reason: "`∀x. r(x, $1)` for every `x`: the eigenvariable `a`."
    - rule: "∀L"
      reason: "The hypothesis at the witness `a`: `∃y. r(a, y)`."
    - rule: "∃L"
      reason: "Name its something with the eigenvariable `b`: the goal is `r(a, b) ⊢ r(a, $1)`."
  refused:
    rule: "ax"
    position: 0
    reason: "Close `r(a, b) ⊢ r(a, $1)` by the axiom, filling `$1` with `b`."
  why: "linlog refuses the axiom: `$1` was opened before `b` was made, and an open witness never takes an eigenvariable made after it. The `y` of the goal would depend on the `x` chosen, which `∃y. ∀x` forbids. No other order helps: linlog's search on the sequent is exhaustive."
hinge:
  question: "Which of these has a proof?"
  options:
    - text: "`!(∀x. p(x)) ⊢ p(a) ⊗ p(b)`"
      problem: "bang-forall"
      why: "`!c` copies the hypothesis, and each copy's `∀L` takes its own witness, `a` and `b`."
    - text: "`∀x. p(x) ⊢ p(a) ⊗ p(b)`"
      problem: "forall-once"
      misconception: "A hypothesis `∀x. A` gives every instance, as often as needed."
      why: "`∀L` takes one instance and uses the hypothesis up, as every rule of linear logic does: one `p` is missing. Under `!` it could be copied first."
    - text: "`∃x. p(x) ⊢ p(a)`"
      problem: "exists-named"
      misconception: "`∃L` lets you name the witness you need."
      why: "`∃L` makes a fresh eigenvariable, `p(b)`, never the constant `a`: knowing that something has `p` says nothing of `a`."
    - text: "`∀x. ∃y. r(x, y) ⊢ ∃y. ∀x. r(x, y)`"
      problem: "forall-swap"
      misconception: "Quantifiers may change places, a witness taking an eigenvariable made after it."
      why: "The `y` the hypothesis gives depends on `x`; the goal's `y` must be chosen first, and an open witness never takes an eigenvariable made after it."
---
With quantifiers, atoms take arguments: `p(a)`, `r(x, y)`, `p(f(a))`. `∀x. A` is typed
`forall x. A` and `∃x. A` `exists x. A`; a quantifier reaches as far right as it can.

The four rules come in two kinds. `∀R` and `∃L` open the formula with an
eigenvariable, a fresh name `a`, `b`, … about which nothing is known, so proving `A`
for it proves it for every `x`. `∃R` and `∀L` take a witness, a term you choose in the
witness chooser, or leave open as `$1` for an axiom to fill. A witness names only
eigenvariables made below it, and an open witness never takes one made after it: the
eigenvariable condition. So make the eigenvariables first; those steps never lose a
proof.

`∀` is like `&` over every term, `∃` like `⊕` choosing one. And as everywhere in linear
logic, a hypothesis `∀x. A` gives one instance, once; under `!` it gives as many as
needed.

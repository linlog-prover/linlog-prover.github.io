---
lesson: 1
title: "Reading a sequent"
worked: "identity"
choices: ["ax", "⅋", "⊗"]
steps:
  - rule: "ax"
    reason: "The goal holds the atom `A` and its dual `A⊥`, and nothing else: the axiom closes it."
faded: 0
explain:
  after: 0
  prompt: "Why does the axiom close `⊢ A⊥, A` and not `⊢ A, A`? Say what `A⊥` stands for here."
  answer: "`A⊥` is the hypothesis `A` moved across `⊢`: the goal says \"from `A`, give `A`\", and the axiom passes the hypothesis on. `⊢ A, A` asks for two `A` from no hypothesis at all, and the axiom only joins an atom with its own dual."
hinge:
  question: "Which goal does the axiom close by itself?"
  options:
    - text: "`⊢ A⊥, A`"
      problem: "identity"
      why: "An atom and its dual, and nothing else."
    - text: "`⊢ A, A`"
      problem: "same-atom"
      misconception: "The axiom pairs a formula with itself."
      why: "It pairs `A` with its dual `A⊥`: two copies of `A` are no pair."
    - text: "`⊢ A⊥, A, B`"
      problem: "extra"
      misconception: "A formula nobody uses can be left over, as in classical logic."
      why: "Linear logic drops nothing that is not under `?`: `B` would be left unproved."
    - text: "`⊢ A⊥, B`"
      problem: "strangers"
      misconception: "Any atom closes with any negated atom."
      why: "The axiom needs the dual of the same atom: `B` goes with `B⊥`, not with `A⊥`."
---
A sequent `⊢ Γ` asks for a proof of the formulas `Γ` together, separated by commas.
`A⊥` is the dual of `A`, its negation. Typed in classical mode, `Γ |- Δ` moves each
hypothesis to the right as its dual: `A |- A` is `⊢ A⊥, A`. The dual of a compound
formula follows De Morgan's laws, `(A ⊗ B)⊥ = A⊥ ⅋ B⊥`, and `A⊥⊥` is `A` again.

The axiom closes a goal that holds an atom and its dual, and nothing else.

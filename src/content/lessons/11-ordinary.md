---
lesson: 11
title: "Ordinary logic through the translations"
worked: "girard-modus"
choices: ["!L", "!R", "⊸L", "ax"]
steps:
  - rule: "!L"
    reason: "The hypothesis `!(!A ⊸ B)` is the translated `A → B`. `!L` uses it once, as `!A ⊸ B`."
  - rule: "⊸L"
    reason: "Apply it: the hypothesis `!A` proves its argument `!A` on the left, and the right premise goes on with `B`."
  - rule: "!R"
    reason: "`!A ⊢ !A` by promotion: every hypothesis is under `!`, so `!A` may be proved from them."
  - rule: "ax"
    reason: "`B ⊢ B`: the axiom."
  - rule: "!L"
    reason: "`!A ⊢ A`: the hypothesis `!A` used once, as `A`."
  - rule: "ax"
    reason: "`A ⊢ A`: the axiom, and the translated modus ponens is proved."
faded: 1
explain:
  after: 1
  prompt: "The translation wrote `A → B` as `!(!A ⊸ B)`. Why does it need both `!`?"
  answer: "The outer `!` lets the hypothesis be used as often as ordinary logic allows, any number of times or not at all. The inner `!A` lets the implication use its argument as often too, so `⊸L` had to give it `!A`, not just `A`, and `!R` proved that from the hypothesis `!A`."
hinge:
  question: "linlog proves the classical image of Peirce's law, `((A → B) → A) → A`, and refutes its intuitionistic image. Why?"
  options:
    - text: "The law holds classically but not intuitionistically, and each image is provable exactly when the formula holds in its logic"
      why: "Each translation keeps exactly what its logic proves: Peirce's law is classical and not intuitionistic, and so are its images."
    - text: "One of the two answers is wrong, since a formula is valid or not"
      misconception: "A formula of ordinary logic is valid or not, whatever the logic."
      why: "Validity depends on the logic: intuitionistic logic proves fewer formulas than classical logic, and Peirce's law is one it does not prove."
    - text: "Linear logic proves fewer formulas, so the image of a valid formula may fail"
      misconception: "Translating into linear logic loses some valid formulas."
      why: "The translations are made so that no valid formula is lost: `!`, and in the classical translation `&` and weakening, give back the copies and the drops that ordinary logic allows."
    - text: "The search gave up on the intuitionistic image"
      misconception: "When no proof is found, the search gave up."
      why: "The search on the intuitionistic image was exhaustive: linlog answers Unprovable, not Unknown."
---
Ordinary propositional logic, with `→`, `∧`, `∨` and `¬`, is decided by translating it
into linear logic and proving the image. Girard's call-by-name translation takes
intuitionistic logic into intuitionistic linear logic: `A → B` becomes `!A ⊸ B`, and
every hypothesis goes under `!`, because an ordinary hypothesis may be used any number
of times or not at all. Classical logic goes into affine linear logic, `∧` as `&` and
`∨` as `⅋`, where weakening drops what is not needed.

The page has no ordinary mode yet, so this lesson proves the images, as `linlog seq
print --logic intuitionistic` and `--logic classical` print them: modus ponens, `A → B,
A ⊢ B`, becomes `!(!A ⊸ B), !A ⊢ B`.

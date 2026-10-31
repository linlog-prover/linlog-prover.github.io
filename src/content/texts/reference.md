---
title: Reference
---
The connectives, as you type them and as linlog prints them. One-sided, every
formula is on the right of `⊢` and `A⊥` is the dual of `A`; two-sided
(intuitionistic, or classical with the Two-sided switch), the hypotheses are on the left.

| sign | typed | name | reading |
|---|---|---|---|
| `A ⊗ B` | `A * B` | tensor | both, side by side |
| `A ⅋ B` | `A \| B`, `A par B` | par | the dual of tensor |
| `A ⊸ B` | `A -o B` | linear implication | consumes `A`, gives `B`; `A⊥ ⅋ B` |
| `A & B` | `A & B` | with | either one, the other's choice |
| `A ⊕ B` | `A + B` | plus | one of them, the prover's choice |
| `!A` | `!A` | of course | as many `A` as needed |
| `?A` | `?A` | why not | the dual of of course |
| `A⊥` | `~A`, `A^` | negation | the dual |
| `1`, `⊥` | `1`, `bot` | the units of `⊗` and `⅋` | |
| `⊤`, `0` | `top`, `0` | the units of `&` and `⊕` | |
| `∀x. A` | `forall x. A` | for all | `A` for every `x`; the dual of exists |
| `∃x. A` | `exists x. A` | exists | `A` for some `x`, a witness chosen |

`⊢` is typed `|-`. With quantifiers, atoms take arguments: `p(x, f(a))` is the
predicate `p` of the variable `x` and the term `f(a)`. A name a quantifier binds is
its variable; any other name in an argument is a constant or, with arguments, a function
symbol; a name has one arity throughout. A quantifier reaches as far right as it can, so
`forall x. p(x) * q(x)` is `∀x. (p(x) ⊗ q(x))`, and `forall x y. A` binds both.
Proving, `∀R` and `∃L` make an eigenvariable, a fresh constant written `a`, `b`, …;
`∃R` and `∀L` take a witness, a term of the sequent's constants and function symbols
and of the eigenvariables made below the goal, or leave it open as `$1` for an axiom or
the search to fill. An open witness never takes an eigenvariable made after it: the
eigenvariable condition.

## The rules

Each rule as a schema: its premises above the bar, its conclusion below, its name
beside it, as the stage writes it. `Γ` and `Δ` stand for any formulas, `?Γ` for
formulas each under `?`. No rule acts on `0`. With Learn on, a rule in the stage's
popover shows its schema on hover, and a formula its connective's reading.

<div data-rules></div>

These are the rules of the one-sided calculus as the LLHandbook project's <a
href="https://ll-handbook.pages.math.cnrs.fr/book/ll-handbook-public.pdf">Handbook
of linear logic</a> states them (draft of 6 March 2026, section 1.3.5, Table 1.4,
p. 22), with its cut and its first-order quantifiers, there `(∀₁)` and `(∃₁)`. There the
axiom takes any formula; section 1.3.2 (p. 14) shows that atoms suffice, and linlog's
axiom takes an atom. `A[t/x]` is `A` with the term `t` in place of `x`. The two-sided names are linlog's names for
the same rule in a two-sided derivation: the principal formula on the right, or its
dual on the left.

## The two-sided rules

In intuitionistic mode a sequent has its hypotheses on the left of `⊢` and exactly
one formula on the right, and the stage names each rule two-sided: a left rule uses
a hypothesis, a right rule proves the goal. Each is a one-sided rule above read from
the other side: `⊸L` is `⊗` on the hypothesis `A ⊸ B`, whose dual is `A ⊗ B⊥`. With
Learn on, a rule in an intuitionistic proof's popover shows its two-sided schema.

<div data-rules-two></div>

These are the rules of intuitionistic linear logic as the <a
href="https://ll-handbook.pages.math.cnrs.fr/book/ll-handbook-public.pdf">Handbook
of linear logic</a> states them (section 1.7.2.1, Table 1.5, p. 48), with the cut and
the first-order quantifiers and without the exchange, in linlog's names: there `(wL)`,
`(cL)`, `(∀₁L)` and the like, here `!w`, `!c`, `∀L`. As above, linlog's axiom takes an
atom.

## The engines

Every search on this page is linlog's: it picks an engine by the sequent's
fragment and mode (Settings can force one), and the page names the engine
beside what it did. Each engine and where it comes from:

<dl>
<dt id="engine-focus">Focused search</dt>
<dd>Searches backward from the goal: the invertible rules first, then one
formula in focus at a time. Classical mode; the <em>two-sided focused
search</em> is the same on intuitionistic sequents. Jean-Marc Andreoli,
<a href="https://doi.org/10.1093/logcom/2.3.297">Logic programming with
focusing proofs in linear logic</a>, Journal of Logic and Computation 2(3),
297–347, 1992.</dd>
<dt id="engine-two-sided">Two-sided focused search</dt>
<dd>The focused search on an intuitionistic sequent, one formula right of
<code>⊢</code>. Andreoli 1992, as above.</dd>
<dt id="engine-net">Proof-net search</dt>
<dd>For MLL without units: links each atom with a dual until the net passes
Danos and Regnier's switching criterion (every switching leaves the graph a
tree). Proof nets: Jean-Yves Girard, <a
href="https://doi.org/10.1016/0304-3975(87)90045-4">Linear logic</a>,
Theoretical Computer Science 50(1), 1–102, 1987. The criterion, stated and
proved: Jean Gallier, <a
href="https://www.cis.upenn.edu/~cis5150/conslog2.pdf">Constructive logics.
Part II: linear logic and proof nets</a>, University of Pennsylvania,
section 7 (Definition 7.6, Theorem 7.9).</dd>
<dt id="engine-essential">Essential-net search</dt>
<dd>For intuitionistic MLL without units: Lamarche's essential net, directed
from the hypotheses toward the goal, correct when it has no cycle and its
paths pass where the criterion says. Stated, with Lamarche's theorem that a
sequent is provable exactly when its essential net is correct: Richard Moot,
<a href="https://arxiv.org/abs/0805.2303">Graph algorithms for improving
type-logical proof search</a>, arXiv:0805.2303, 2008, section 2.3.</dd>
<dt id="engine-planar">Planar nets of the ordered modes</dt>
<dd>linlog's cyclic mode and Lambek calculus keep the order of the formulas,
and their nets are linked without crossings. François Lamarche and Christian
Retoré, <a href="https://www.lirmm.fr/~retore/ARTICLES/LaReRoma96.pdf">Proof
nets for the Lambek calculus: an overview</a>, Proofs and Linguistic
Categories (3rd Roma Workshop), 1996; the planar linkings: Moot 2008, as
above. This page offers neither mode yet.</dd>
<dt id="engine-horn">Horn engine</dt>
<dd>A goal of atoms, implications and implications under <code>!</code> is a
Petri net with a marking to reach: the engine searches its markings, and in
affine mode, where tokens may be left over, whether a marking covering the
goal is reachable, backward from the goal. Petri nets and linear logic: Uffe
Engberg and Glynn Winskel, <a
href="https://doi.org/10.7146/dpb.v19i301.6682">Petri nets as models of
linear logic</a>, DAIMI Report PB-301, Aarhus University, 1990; the backward
search: Parosh Aziz Abdulla, Kārlis Čerāns, Bengt Jonsson and Yih-Kuen Tsay,
<a href="https://lics.siglog.org/1996/AbdullaCeransJonsso-Generaldecidability.html">General
decidability theorems for infinite-state systems</a>, LICS 1996,
313–321.</dd>
<dt id="engine-inverse">Inverse method</dt>
<dd>Searches forward: derives sequents from the axioms upward, whole focused
phases at a time, until it reaches the goal or nothing new comes; then the
set it derived, which linlog checks, is the refutation. Kaustuv Chaudhuri and
Frank Pfenning, <a href="https://doi.org/10.1007/11538363_15">Focusing the
inverse method for linear logic</a>, CSL 2005, LNCS 3634, 200–215.</dd>
<dt id="engine-additive">Additive path</dt>
<dd>For two formulas built of <code>&amp;</code>, <code>⊕</code>, their units
and atoms: decides each pair of their subformulas by linear logic's additive
rules, <code>&amp;</code>, <code>⊕</code> and <code>⊤</code>, with the axiom,
remembering each answer. The rules: the LLHandbook project, <a
href="https://ll-handbook.pages.math.cnrs.fr/book/ll-handbook-public.pdf">Handbook
of linear logic</a>, section 1.3.5, Table 1.4. Related: the word problem for
lattices, which Whitman solved; Alan Day, <a
href="https://doi.org/10.4153/cmb-1970-051-0">A simple solution to the word
problem for lattices</a>, Canadian Mathematical Bulletin 13(2), 253–254,
1970.</dd>
<dt id="engine-classical">Classical refuter</dt>
<dd>Reads the sequent as ordinary logic (<code>⊗</code> and <code>&amp;</code>
as and, <code>⅋</code> and <code>⊕</code> as or, <code>!</code> and
<code>?</code> erased) and looks for an assignment that makes it false: read
so, every rule of linear logic is a rule of ordinary logic, so a sequent
false under one assignment has no proof. "Mapping ⊗ and &amp; to ∧ and ⅋ and
⊕ to ∨ turns linear provable formulas into valid classical formulas": the
LLHandbook project, <a
href="https://ll-handbook.pages.math.cnrs.fr/book/ll-handbook-public.pdf">Handbook
of linear logic</a>, section 1.1, proved in section 1.8 (Theorem 1.8.1, the
skeleton). The refuter's ground is that statement read backward: a formula
false under one assignment is no valid classical formula, so no provable
linear one.</dd>
</dl>

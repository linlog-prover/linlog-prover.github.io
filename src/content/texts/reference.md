---
title: Reference
---
The connectives, as you type them and as linlog prints them. One-sided, every
formula is on the right of `⊢` and `A⊥` is the dual of `A`; two-sided
(intuitionistic), the hypotheses are on the left.

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

`⊢` is typed `|-`. The rules' schemas come with the lessons.

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
and atoms: decides each pair of subformulas once, by the conditions with
which Whitman solved the word problem for lattices, as Alan Day gives them:
<a href="https://doi.org/10.4153/cmb-1970-051-0">A simple solution to the word
problem for lattices</a>, Canadian Mathematical Bulletin 13(2), 253–254,
1970.</dd>
<dt id="engine-classical">Classical refuter</dt>
<dd>Reads the sequent as ordinary logic (<code>⊗</code> and <code>&amp;</code>
as and, <code>⅋</code> and <code>⊕</code> as or, <code>!</code> and
<code>?</code> erased) and looks for an assignment that makes it false: read
so, every rule of linear logic is a rule of ordinary logic, so a sequent
false under one assignment has no proof. The forgetful map, which makes every
rule of intuitionistic linear logic derivable in intuitionistic logic: Gilda
Ferreira, Paulo Oliva and Clarence Lewis Protin, <a
href="https://arxiv.org/abs/2409.02249">On the various translations between
classical, intuitionistic and linear logic</a>, arXiv:2409.02249, proof of
Proposition 1.</dd>
</dl>

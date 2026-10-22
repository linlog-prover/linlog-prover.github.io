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
the switching criterion (every switching leaves the graph connected and
acyclic). Jean-Yves Girard, <a
href="https://doi.org/10.1016/0304-3975(87)90045-4">Linear logic</a>,
Theoretical Computer Science 50(1), 1–102, 1987; the criterion: Vincent Danos
and Laurent Regnier, <a href="https://doi.org/10.1007/BF01622878">The
structure of multiplicatives</a>, Archive for Mathematical Logic 28(3),
181–203, 1989.</dd>
<dt id="engine-essential">Essential-net search</dt>
<dd>For intuitionistic MLL without units: the net directed from the
hypotheses toward the goal, correct when it has no cycle and every
implication on the goal's side dominates its antecedent. François Lamarche,
Proof nets for intuitionistic linear logic I: essential nets, preliminary
report, Imperial College, 1994; checked in linear time by dominator trees:
Andrzej S. Murawski and C.-H. Luke Ong, <a
href="https://doi.org/10.1109/LICS.2000.855768">Dominator trees and fast
verification of proof nets</a>, LICS 2000, 181–191.</dd>
<dt id="engine-planar">Planar nets of the ordered modes</dt>
<dd>linlog's cyclic mode and Lambek calculus keep the order of the formulas,
and their nets are drawn without crossings. Joachim Lambek, <a
href="https://doi.org/10.1080/00029890.1958.11989160">The mathematics of
sentence structure</a>, American Mathematical Monthly 65(3), 154–170, 1958;
François Lamarche and Christian Retoré, <a
href="https://www.lirmm.fr/~retore/ARTICLES/LaReRoma96.pdf">Proof nets for
the Lambek calculus: an overview</a>, Proofs and Linguistic Categories (3rd
Roma Workshop), CLUEB, 241–262, 1996; cyclic linear logic: David N. Yetter,
<a href="https://doi.org/10.2307/2274953">Quantales and (noncommutative)
linear logic</a>, Journal of Symbolic Logic 55(1), 41–64, 1990. This page
offers neither mode yet.</dd>
<dt id="engine-horn">Horn engine</dt>
<dd>A goal of atoms, implications and implications under <code>!</code> is a
Petri net with a marking to reach: the engine searches its markings, and in
affine mode, where tokens may be left over, whether a marking covering the
goal is reachable, backward from the goal. Max I. Kanovich, <a
href="https://doi.org/10.1016/0168-0072(94)00060-G">Petri nets, Horn
programs, linear logic and vector games</a>, Annals of Pure and Applied Logic
75(1–2), 107–135, 1995; the backward search: Parosh Aziz Abdulla, Kārlis
Čerāns, Bengt Jonsson and Yih-Kuen Tsay, <a
href="https://lics.siglog.org/1996/AbdullaCeransJonsso-Generaldecidability.html">General
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
and atoms: decides each pair of subformulas once. The same question as the
order of a free lattice, which Philip M. Whitman decided by such a recursion:
<a href="https://doi.org/10.2307/1969001">Free lattices</a>, Annals of
Mathematics 42(1), 325–330, 1941.</dd>
<dt id="engine-classical">Classical refuter</dt>
<dd>Reads the sequent as ordinary logic (<code>⊗</code> and <code>&amp;</code>
as and, <code>⅋</code> and <code>⊕</code> as or) and looks for an assignment
that makes it false: every rule of linear logic is sound read so, so a
sequent false under one assignment has no proof. Girard 1987, as above.</dd>
</dl>

// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The written content, under CC BY 4.0, in src/content/:
 *   problems  problems/<id>.md, the one store of problems Practice and Learn
 *             draw from: a sequent, its mode, linlog's verdict, its level of
 *             difficulty, the categories it is found under and the fragment
 *             linlog detects; a provable one has its proof beside it as
 *             problems/<id>.session.json, linlog's session document as
 *             `linlog interact` saved it. A problem with a `lesson` is that
 *             lesson's practice in Learn, in its `order` (provable and not
 *             mixed); every unprovable problem is Learn's, and Practice
 *             offers the provable ones. One from the literature names its
 *             `source` and `url`. src/content/problems.test.ts holds every
 *             entry to linlog's verdict and every session to its sequent,
 *             and the flake's `problems` check holds them to linlog's command.
 *   tour      tour/<n>-<name>.md, the tour's stops in order: what each stop
 *             shows (`target`) and the real step it performs on the stage
 *             (`act`).
 *   texts     texts/<name>.md: About, Practice's opening, and the openings of
 *             Learn's tutorial and reference.
 *   lessons   lessons/<n>-<name>.md, Learn's written lessons: the opening as
 *             the body, the worked proof (a problem of the store, played
 *             step by step from its session, a rule and a reason per step,
 *             the rules to predict among), how many of its steps the faded
 *             proof plays before the student takes over, the
 *             self-explanation prompt after one step, the hinge question
 *             whose wrong answers each name a misconception, and for a lesson
 *             that shows one, a legal split that leads nowhere.
 *   rules     rules/<nn>-<name>.md, the one-sided rules the reference draws
 *             as schemas and the stage's popover shows on hover: linlog's name,
 *             the premises over the conclusion, the two-sided names of the
 *             same rule, the lesson that teaches it, what it does.
 * pages/index.astro renders each into a template the island shows.
 */

import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/** The modes linlog's `start` takes. */
export const MODES = [
  "classical",
  "affine",
  "mix",
  "affine-mix",
  "intuitionistic",
  "intuitionistic-affine",
] as const;

/** The levels of difficulty, from 1, easy, to 4, very hard. */
export const LEVELS = [1, 2, 3, 4] as const;

/**
 * The categories a problem is found under: the connectives it uses, its
 * logic (classical, intuitionistic, and with weakening or Mix), and whether
 * it comes from the literature.
 */
export const CATEGORIES = [
  "multiplicatives",
  "additives",
  "units",
  "exponentials",
  "classical",
  "intuitionistic",
  "structural",
  "literature",
] as const;

const problems = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/problems" }),
  schema: z
    .object({
      /** A name, for the problems Learn shows and those from the literature. */
      title: z.string().optional(),
      /** As it is typed in the field. */
      sequent: z.string(),
      mode: z.enum(MODES),
      verdict: z.enum(["provable", "unprovable"]),
      level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      categories: z.array(z.enum(CATEGORIES)).min(1),
      /** The fragment linlog detects, as `seq fragment` names it in the mode. */
      fragment: z.string(),
      /** The lesson of the progression whose practice it is, from 1, and its place there. */
      lesson: z.number().int().min(1).optional(),
      order: z.number().int().optional(),
      /** The work that states it, with the place in it, and where to read it. */
      source: z.string().optional(),
      url: z.url().optional(),
    })
    .refine((p) => (p.lesson === undefined) === (p.order === undefined), "a lesson needs its order")
    .refine(
      (p) => p.verdict === "provable" || p.lesson !== undefined,
      "an unprovable problem is Learn's",
    )
    .refine((p) => (p.source === undefined) === (p.url === undefined), "a source needs its url"),
});

/** What a stop of the tour points at, and the step it performs. */
export const TARGETS = ["tab", "stage", "formula", "goal", "status", "bottom"] as const;
export const ACTS = ["none", "start", "par", "split", "close"] as const;

const tour = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/tour" }),
  schema: z.object({
    title: z.string(),
    target: z.enum(TARGETS),
    act: z.enum(ACTS),
  }),
});

const texts = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/texts" }),
  schema: z.object({ title: z.string() }),
});

/** Text of the lessons and the rules: plain words, formulas between backticks. */
const words = z.string().min(1);

const lessons = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/lessons" }),
  schema: z.object({
    lesson: z.number().int().min(1),
    title: words,
    /** The store problem whose session is the worked proof. */
    worked: z.string(),
    /** The rules the student predicts among, as linlog names them. */
    choices: z.array(z.string()).min(2),
    /** One per step of the worked proof's session, in its order. */
    steps: z.array(z.object({ rule: z.string(), reason: words })).min(1),
    /** A legal split that leads nowhere, shown before the step `before`: its left premise's formulas. */
    detour: z
      .object({ before: z.number().int().min(0), left: z.array(z.number().int()), text: words })
      .optional(),
    /** The steps the faded proof plays before the student takes over. */
    faded: z.number().int().min(0),
    /** The self-explanation prompt, after the step `after` (from 0), and a model answer. */
    explain: z.object({ after: z.number().int().min(0), prompt: words, answer: words }),
    hinge: z.object({
      question: words,
      /** The right answer has no misconception; each wrong one names the one it reveals. */
      options: z
        .array(
          z.object({
            text: words,
            problem: z.string().optional(),
            misconception: words.optional(),
            why: words,
          }),
        )
        .min(3),
    }),
  }),
});

const rules = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/rules" }),
  schema: z.object({
    /** As linlog names the rule on the stage. */
    name: z.string(),
    title: words,
    lesson: z.number().int().min(1),
    premises: z.array(z.string()),
    conclusion: z.string(),
    /** The two-sided names of the same rule, as linlog's two-sided drawings write them. */
    twoSided: z.array(z.string()).min(1),
    says: words,
  }),
});

export const collections = { problems, tour, texts, lessons, rules };

// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The written content, under CC BY 4.0, in src/content/:
 *   examples  examples/<id>.md, a sequent to prove, with its mode, how hard
 *             it is, whether it has a proof and the lesson whose practice it
 *             is (the order within a lesson mixes provable and not); a provable one has its proof
 *             beside it as examples/<id>.session.json, linlog's session
 *             document as `linlog interact` saved it, which the page replays.
 *             src/content/examples.test.ts holds every entry to linlog's
 *             verdict and every session to its sequent.
 *   tour      tour/<n>-<name>.md, the tour's stops in order: what each stop
 *             shows (`target`) and the real step it performs on the stage
 *             (`act`).
 *   texts     texts/<name>.md: About, and the openings of Learn's tutorial,
 *             practice and reference.
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

const examples = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/examples" }),
  schema: z.object({
    title: z.string(),
    /** As it is typed in the field. */
    sequent: z.string(),
    mode: z.enum(MODES),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    verdict: z.enum(["provable", "unprovable"]),
    /** The lesson of the progression whose practice it is, from 1. */
    lesson: z.number().int().min(1),
    order: z.number().int(),
  }),
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

export const collections = { examples, tour, texts };

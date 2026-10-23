---
paths:
  - "src/**"
  - "astro.config.ts"
  - "tsconfig.json"
  - "biome.json"
  - "vitest.config.ts"
  - "playwright.config.ts"
  - "tests/**"
---

# The site's code

Versions are newer than most training data: Astro 7.3, Vite 8, TypeScript 6, Tailwind 4.3,
Solid 1.9, Vitest 5, Playwright 1.63, Biome 2.5 (package-lock.json and linlog's nixpkgs,
2026-10-19). Check an API in `node_modules/<pkg>/**/*.d.ts` before using it from memory.
linlog's own calls are in `.cache/linlog-web/linlog_web.d.ts`, and their documents in
linlog's `plan/web/README.md` ("The bindings' API"); `src/lib/linlog.ts` types the parts
the page reads.

## The worker and the protocol (`src/lib/protocol.ts`, `src/worker/linlog.worker.ts`)

- **linlog's module runs in one module worker**, created as `new Worker(new URL(…,
  import.meta.url), { type: "module" })` in `src/lib/api.ts` (Vite bundles it from that
  pattern alone). The module reads no clock and a call cannot be interrupted, so the one
  cancel is `terminate()` and a fresh worker (`Client.cancel`): every pending call
  rejects with `Cancelled`, and nothing is lost, because the module keeps nothing between
  calls and the page sends every document with every call. A worker starts with a call,
  never on its own: one that fails as it loads (a chunk gone after a redeploy) would
  otherwise be restarted in a loop; the island makes one call on mount, so the module
  loads after the first paint.
- **Requests carry ids**; answers may come in any order. A call rejects with what it
  threw: linlog's error JSON as a string, which `failure()` reads. The page branches on
  `code`, `kind` and `details.kind` and words the message itself (`src/lib/words.ts`);
  never show `message` raw where a wording exists.
- **A replay is one request** (`replay`, `play` in the worker, over `src/lib/steps.ts`), so
  one `terminate()` stops it.

## The step tree (`src/lib/steps.ts`)

- **The tree is read off the session document**, never kept beside it: `inferences` (a
  goal is the index of its inference, the root 0) and `history` (the goals expanded, in
  order). A link, a file or the browser's storage gives the same tree as a proof made on
  the page.
- **Goals are named by path** (the premise taken at each inference), never by number:
  linlog numbers inferences in the order they are made, so a replay that leaves a step out
  renumbers every later one. Everything stored across a replay (the active goal, a note,
  the hint ladder's key, the redo stack) is a path.
- **Undo per branch** retracts the step that opened the active goal and every step since
  in that step's premises (`retract`), then replays the rest from the sequent. A history
  entry whose premise was expanded without being in the history is a search's graft; it
  replays by `close` again (deterministic: one thread, bounded by work), and a graft that
  no longer closes leaves its goal open and says so. The search's inferences are drawn
  apart (`searchMade`, the class `search` on the drawing's `g#i<n>`, whose rule label is
  the next sibling text: linlog's SVG writes it right after the conclusion). A graft the
  search no longer closes within the settings (it closed under a larger budget, "Try N
  units") replays from its own inferences as steps (the action's `graft`), so an undo
  elsewhere never reopens it; only its marking as the search's is lost.
- **With the invertible rules applied by themselves** (`Settings.invertible`), undo takes
  back the nearest step on the branch that is not one of them (`retract`'s `invertible`,
  the view's list of the inferences an invertible rule closed), with every step since: the
  visitor's last choice and the invertible steps that followed it. Taking one of those back
  alone would only see it applied again at the next step. The session does not record who
  took a step, so an invertible step the visitor took by hand is passed over too; where
  every step on the branch is invertible there is nothing to undo.
- **A replay runs without the invertible rules** (`replaying()` in `state.tsx`, for every
  `replay` and `play`, and for a start that only reads the sequent): they are in the
  session as the steps they were, and applied again after each replayed step they would
  close the goals the recorded ones expand.
- **Every replayed step must make the premises it made** (the action's `made`); one that
  does not is taken back with linlog's `undo` and its goal reported, never kept as a
  different proof.
- **`stepOf` rebuilds a step from its inference**: the principal's position; for two
  premises that split the context, the positions in the left premise, found by aligning
  the goal with both premises (`leftOf`): a contraction gives copies one occurrence, so a
  context formula may carry the principal's subformula's occurrence and no count tells
  them apart. Premises that hold the context twice over (`&`) take no split, which linlog
  refuses. The fast-check property in `steps.test.ts` replays random proof
  attempts against the real module; extend its sequents when a rule is added.

## The drawing and the stage (`src/islands/Stage.tsx`)

- linlog's SVG goes in by `innerHTML`; it stays a picture (`role="img"`, its `<desc>`),
  and every formula of an open goal gets an HTML button over it, placed from the
  element `#i<n>-<p>`'s box (`view.inferences[n]` is the goal `i<n>` draws). The drawing
  is asked with `styles.svg.font_size` 30, so a formula is a 24-pixel target at 100 %.
- **Colours that carry a meaning** (the verdicts, the selection and active goal, Learn's
  frame, the nets) stay apart from the colours seen with them under simulated protanopia,
  deuteranopia and tritanopia: `src/styles/colours.test.ts` holds the tokens to it, with
  Machado, Oliveira and Fernandes's matrices (severity 1.0, the authors' own table; their
  paper does not claim tritanopia, the matrix is used as published) on linear RGB and the
  distance in OKLab, 8 under a deficiency and 15 in full colour, by groups of colours seen
  together: a net's colours with each other and with the bands' state and selection colours
  around them. Each meaning has a word, a sign or a shape beside it: a tab's state is a shape
  (`STATE_MARKS`, a check, a cross, a question mark, a dotted circle, a dashed one), a
  hint's rungs a bar or a hairline. A new colour of meaning joins a group of the test.
- **The logo's colour is fixed** (`--color-logo`, the violet of `src/logo/`'s files): a token
  of its own, never `var(--color-accent)`, so a change of the accent never moves the logo.
  A new colour of meaning keeps clear of it: `colours.test.ts` puts the logo in the bands'
  group and pairs it with each colour seen with the band (ink, Learn's frame, the nets), and
  a self-check shows a colour moved next to it fails. The one exemption is the pair logo and
  accent, by name, and only while the two are equal (one violet by choice today); an accent
  moved near the logo but not onto it fails like any other colour.
- Colours come from CSS over the SVG's attributes (`.drawing svg text { fill: … }`), so a
  theme change needs no redraw; the exports keep linlog's own colours. The colours that
  mean something in a net are exempt from the ink, matched by the value linlog writes
  for its default `Style` (`#0072b2` the `⅋` edges, `#009e73` the essential net's input
  side, `#cc79a7` its dominator lines, `#d55e00` a witness's edges) and repainted with
  `--color-net-*` at 4.5:1 on the field: a change of linlog's defaults fails the
  essential net's colour test rather than turning them to ink. The page's net colours are
  hues of Okabe and Ito's palette (blue for `⅋` and for the input side, which never share
  a drawing, reddish purple, vermilion), each darkened or lightened for contrast; `⅋` is also dashed, a dominator line
  dotted and the input side's edges point up, so no net colour is all that tells its kind.
  A witness is drawn only for a structure that is no proof net, which the page never
  draws (its nets are of finished proofs).
- The net is drawn as Settings' "Net drawing" says (`styles.svg.net`: `formulas`, every
  occurrence written, or `compact`), in the view and the net's exports alike. The stage
  fits the drawing afresh whenever what it draws changes (another proof, the tree or the
  net, the net's drawing), since the net with its formulas is far larger than the tree.
- **The net's look** is `Settings.netLook` (`styles.svg.net_look`, linlog's `NetLook`, sent
  as its three fields by `lookJson`), stored with the other settings, each field read back as
  linlog's default where the stored value is not one of its own (`storedLook`). Settings' "Net
  drawing" shows it as a row "Look" (linlog, Textbook: `LINLOG_LOOK`, `TEXTBOOK_LOOK`, each
  pressed only while all three fields are its own) and a row per field (`LookRow`), each
  button with its tip and a line under them for a touch. The stage and the exports draw with
  it, and the stage refits when it changes (a look can add rows).
- The split chooser sits under the goal's row, never beside a formula of it (the
  formulas are what it is clicked on); on a stage under 640 px both popovers are a sheet
  at its bottom.
- **Zoom is the stage's on the stage and the browser's everywhere else.** The stage keeps
  `touch-action: none`, so the browser makes no gesture there and the stage's pointers do:
  one on the field pans, a second finger (wherever it lands, a formula's button too) makes
  a pinch about the two fingers' midpoint (`pinch`), and ctrl with the wheel (a trackpad's
  pinch in Chromium and Firefox) zooms about the pointer; Safari's trackpad pinch arrives as
  `gesturestart`/`gesturechange`, taken only while no touch pointer is down (on iOS the
  pointers make the pinch). Nothing else on the page sets a `touch-action` or cancels ctrl
  with the wheel or ctrl with plus or minus, and the viewport allows zoom (WCAG 1.4.4):
  `tests/zoom.spec.ts` checks every element outside the stage. Chromium's own pinch needs
  the fingers to spread past its slop: the test's page pinch goes from 20 to 100 pixels
  either side (20 to 60 zoomed nothing), and CDP's `Input.synthesizePinchGesture` zooms
  nothing in this Chromium at all.
- Solid's narrowed accessor in `<Show>{(x) => …}` goes stale once its condition is false:
  read it before the handler changes what the condition reads (the restart warning).

## The state (`src/islands/state.tsx`)

- **A goal's formula is shown as it reads** (`shown` in `src/lib/words.ts`): in
  intuitionistic mode linlog's `reading` (a hypothesis `A ⊸ B`), else the one-sided `text` in
  signs. The formulas' buttons are named so (`A ⊸ B, formula 2 of goal 1`), and the rules
  popover and the split chooser's lists write them so; a step still names a formula by its
  position.
- **A tab shows its sequent as typed, in signs** (`displayed` in `src/lib/words.ts`, in
  Euler Math): `A⊥` for `~A` and `A^`, which linlog's parser does not read, so the link
  keeps `pretty`'s text, which it does.

- **Light dismiss** (`App.tsx`, one capture `pointerdown` on the document): a press outside
  what is open closes it as Escape does: the menu or pane (`ui.menu`, inside: `.menu`, the
  bands' popovers `.status-pop`/`.calc-pop`, and any `[aria-expanded=true]` toggle but a
  formula's), the restart warning (inside: it and the calculus's switches), and the rule
  popover or split chooser (inside: the stage's `.pop` and every formula's button, by which
  a rule or a side is chosen); the tour's caption is inside everything. A press on the stage
  that closes something does nothing else: its `pointerdown` stops there (no pan) and its
  `click` is swallowed (no formula picked, no stage button pressed); a press on a band's
  button closes and acts. A toggle must carry `aria-expanded`, or its own press would close
  its menu before its click opens it again. On a phone some sheets (About) cover the whole
  stage, so outside is the bands; `tests/dismiss.spec.ts` presses there then.
- **The invertible rules' switch** is Settings' "Apply invertible rules by themselves",
  after Budget (the proving behaviours), off by default, stored with the other settings;
  `json()` adds `interactive.invertible` while it is on, so `start` and `apply` apply them.
  Turning it on applies them at once to every open goal of every proof (`setInvertible`,
  linlog's `invert_all`). Its tip (`INVERTIBLE_TIP`) says what an invertible rule is and why
  applying one loses no proof; tips never follow a touch, so the line under it says what the
  page does. The hint ladder's first rung reads linlog's judgement of the hinted rule
  (`Hint.invertible`), not a list of names, and with the switch on says that the invertible
  rules are done.
- **One action that changes a proof at a time** (`guard`): each reads the session, waits on
  the worker and shows the answer, so a second begun meanwhile would build on a session
  the first replaces. An action asked for while one runs does nothing; the bottom band's
  buttons wait on `busy`, and the dock shows "Stop the search" instead of the close.

## What holds the work

- **The link** (`src/lib/link.ts`): `#v=1&m=<mode>&s=<sequent>&d=<session>` in the fragment,
  the session deflate-raw and base64url, dropped past 2000 characters (the export menu
  says so). A link whose session linlog refuses loads the sequent and the mode, with
  "Proof not restored"; one past `UNPACKED_LIMIT` (512 KiB, read through a capped
  inflate) says so, and one whose sequent does not parse puts it in the field with the
  parse error marked, as if typed. The sequent is the field's text with the ASCII connectives as their signs (`pretty`, which `words.test.ts` holds to read as the same sequent).
- **Autosave** (`src/lib/shelf.ts`): every visit (tab) saves its open proofs under
  `linlog-proofs:<visit>`, each with the time, so two tabs never overwrite each other; at a
  visit's start the other visits' are gathered into `linlog-proofs-previous` for the restore
  bar, the copy of a proof saved last winning, and work begun before the visitor answers
  overwrites nothing. A proof open already (a link's) is taken out of the bar (`prune`). Settings are `linlog-settings`,
  the theme `linlog-theme` (read before the first paint by `Base.astro`).

## The Content-Security-Policy

- **A `<meta>` element, Astro's** (`security.csp` in `astro.config.ts`): Pages sets no
  header. Astro writes it at the end of `<head>` with the hashes of the inline code it
  makes (the island's runtime and its `astro-island` style), and a `<meta>` policy covers
  only what follows it: so nothing inline goes into `<head>`. The pre-paint theme script
  is the body's first element, its text `PREPAINT` (`src/lib/theme.ts`), whose hash the
  config adds, since Astro hashes no `is:inline` script.
- **What a `<meta>` policy cannot do**: `frame-ancestors`, `report-uri` and `sandbox` are
  ignored there, so the page can be framed; the worker that runs linlog's module gets no
  policy at all (a worker's comes from its own response's headers).
- **The check reads a policy as a browser does**: the first copy of a directive wins, and
  `script-src-elem`/`style-src-elem` govern the elements where present (`governing`).
- **Checked twice**: the `csp` flake check (`modules/_checks/csp.py`) recomputes every
  inline script's and style's hash from the built HTML and fails on one the policy lacks,
  on a policy after any script or stylesheet, on a loose source or a missing
  `'wasm-unsafe-eval'`; `tests/fixtures.ts` fails any Playwright test during which the
  browser reported a violation, so every interaction runs under the policy. Import
  `test` from `./fixtures`, never from `@playwright/test`.
- **No Shiki** (`markdown.syntaxHighlight: false`): it colours code with style attributes.

## The licences served (`src/integrations/licences.ts`, the `licences` check)

- `/licenses/bundle.txt` is Vite's `build.license` (the npm packages in the bundle), plus
  Astro's notice, whose island runtime is inline in the pages where no bundle sees it;
  `/licenses/THIRD-PARTY-NOTICES.txt` the Rust crates' (linlog-web's), `LICENSE.txt` the
  EUPL. The upload to Pages drops dot-files, so nothing is under `.vite/`.
- **Fonts live under `/fonts/`** beside `<Family>-OFL.txt`: `assetFileNames` sends them
  there, but only for what the server build emits (the stylesheet's fonts, and linlog's
  five math fonts because `index.astro` imports their URLs and passes them to the island
  as `fonts`); Astro's client build names its own assets, so a font imported from the
  island would land in `/_astro/` and fail the build. A new family is a line of `FONTS`
  and of the check (`families` and the served licences compared with linlog's). A licence
  that is not the OFL is served as `<Family>-LICENSE.txt` (`ofl: false`): New Computer
  Modern Math's, the GUST Font License's, with the LPPL's clause 6 notice linlog wrote.
- **The formulas' font** is `Settings.stageFont` (a `MathFont` name, Settings' "Font of the
  formulas", default Euler Math): the stage's drawing asks linlog for it
  (`styles.svg.font`, `drawSettings`), and `App.tsx` sets `:root[data-math-font]`, which
  `app.css` turns into `--font-math` (one token per font in `tokens.css`), so every formula
  of the page, the tabs' sequents too, follows. `font(name)` fetches a font's bytes once and
  adds them to the document under the family its file names (`MATH_FONTS[].family`, which
  linlog's drawing asks for): Euler Math at the start, another font when it is chosen for
  the stage or an export, never before. **The exports' font** is `Settings.font`, null for
  the stage's (`exportFont`); the export menu's `menuitemradio`s set it, the stage's font
  setting it back to null; `render` gets that font's file and no other.
- **The service worker caches the four other math fonts when first fetched** (`LATER` in
  `sw.js`, filled by `offline.ts` by their file names, and the build fails unless there
  are four), not at install: a visitor who never chooses one never downloads it (0.4 to 1.3
  MB each), and one chosen once works offline. Every other file is cached at install.

## The written content (`src/content/`, CC BY 4.0)

- **Markdown in content collections** (`src/content.config.ts`): `problems/` (the one store
  Practice and Learn draw from: a sequent, its mode, linlog's verdict, a `level` 1 to 4, its
  `categories`, the `fragment` linlog detects; `lesson`/`order` for a lesson's practice,
  `source`/`url` for one from the literature; a provable one's proof beside it as
  `<id>.session.json`), `tour/` (the stops in order, each with the element it points at
  and the step it performs), `texts/` (About, Practice's opening and Learn's two openings).
- **Rendered by `index.astro` into `<template data-written data-content="…">`** and cloned
  by the island (`Written` in `Learn.tsx`), never set from strings: the content is in the
  built HTML, where `no-style-attributes`, `csp` and `licences` read it. Only Learn's
  problems (those with a `lesson`, with their sessions) and the tour's data are the
  island's props; Practice's problems are `/problems.json` (`src/pages/problems.json.ts`,
  `offered` in `src/lib/practice.ts`: the provable ones alone), fetched when Practice first
  opens, so the first load carries none of the 400. The `licence` template is the CC BY
  line, shown with the content (Learn's frame, Practice); every page with a `data-written`
  element must link CC BY 4.0 (the `licences` check).
- **Every problem is decided by the command, and checked twice**: `src/content/problems.test.ts`
  (each verdict and fragment by the module, each session to its sequent, mode and a
  finished proof, the categories to the sequent's connectives and mode, no sequent twice in
  one calculus, the lessons' mix) and the flake's `problems` check
  (`modules/_checks/problems.py`), which runs linlog's command at the pinned input over the
  whole store in one deterministic batch and `interact --state … proof` on each session: a
  problem without that evidence, or whose verdict a later linlog changes, fails it. A
  session is written by `linlog interact` from the steps linlog's own hints give (`apply`
  per step, then `save` and `proof`, exit 0), so that Watch plays it step by step.
- **A problem's level is measured on its checked proof** (the hints' proof), never the
  search's effort: score = steps + 2 × the bits of choice a count of atoms does not settle +
  ½ × the bits it does, summed over the goals where no invertible rule applies (bits:
  log2 of the moves there over the moves after which the goal stays provable); levels Easy
  under 6, Moderate under 14, Hard under 30, Very hard from 30. The generators, the measure
  and its validation by agents of two strengths live outside the repository (linlog's
  `plan/reports/43-learn-lessons.md` says where); an unprovable problem keeps the level set
  by hand, and a variant built from a measured problem (an unused hypothesis for weakening, two
  proofs side by side under Mix) takes its source's score plus one step. A new problem is
  measured the same way before it is filed.
- **Categories** are the connectives' families the sequent uses (`multiplicatives`,
  `additives`, `units`, `exponentials`), its logic (`classical`, `intuitionistic`, and
  `structural` for weakening or Mix) and `literature` for a classic with its source read in
  the work. Practice filters by groups (`GROUPS`): any chosen within a group, every group at
  once, and the levels.
- **Learn's practice is a lesson's**: the problems with a `lesson`, under the tutorial's
  lesson, easiest first, provable and unprovable mixed, never three alike in a row
  (`problems.test.ts`); a card keeps its verdict and explanation under "Answer". Every
  lesson from the second has at least two provable problems at level 3 or above. Every
  unprovable problem has a lesson (the schema refuses one without): Practice never offers
  it.
- **Practice** (`Practice.tsx`, `ui.menu === "practice"`, the band's Practice at every
  width, key P) is a sheet over the stage, outside Learn's frame, so light dismiss and
  Escape close it as any menu. A problem opens through `prover.example`, a proof of its
  own, replacing only the page's empty tab. `createPractice` lives as long as the island:
  the tab a problem opened on marks it proved when it finishes the proof of the problem's
  sequent with no goal closed by the search (`engines` empty: Close and Close all are not
  the visitor's proof), kept with the filters under `linlog-practice` (the privacy page
  lists it).
- **A goal opens in a new tab** (`openGoal`, the dock's arrow): its formulas as the field
  reads them (`sequentText`, two-sided where they have sides, each formula as its reading,
  linlog's `reading`, the dual of its one-sided `text` only where there is none), in the same
  calculus, the new
  proof's `origin` the tab and the goal's path (kept in the shelf). **A goal is filled from
  a tab** (`fill`, the dock's "Fill from <its sequent>") when that tab's proof is finished and its
  sequent has the goal's formulas in any order (`fillable`: `keyOf` of each, the other
  tab's from a `start` of its sequent, cached by mode and sequent); linlog's `fill` carries
  the proof over and checks it in the goal's calculus, and a refusal is the goal's note
  (`fillRefusal`). The graft is named like a search's, `engines[path] = "tab:<sequent>"` (the
  drawing's label, the step list), and replays from its own inferences, never by the search
  (`own` on its action, set by `actionsFor` from that name), so undo elsewhere keeps it. A
  tab is named by its sequent as the tab shows it, cut to `SHORT` characters (`short`),
  never by its place in the row, which changes as tabs close.
- **Watch** opens an example's proof taken back to the sequent with each step alone on the
  redo stack, so Redo plays it; an example opens as a proof of its own, in place of the
  page's empty one only, so it replaces no work and needs no warning.

## The engines (`src/lib/engines.ts`)

- An outcome names its engine (`engine`), but a classical refutation is the classical
  refuter's work (`engineOf`). The chip beside a note or a hint, the label beside a graft's
  rule (`text.engine` after the rule label, from `Proof.engines`, a goal's path to the
  engine, kept in the shelf), and the step list name it; the hover gives the source, a
  press opens Learn's reference at `#engine-<key>` (`ui.spot`). Every reference in
  `texts/reference.md` was read in the work itself (2026-10-22), an open copy where the
  original is paywalled being replaced by an open work that states it; change one only from
  the work itself.
- **Settings' engine** is `search.engine` in every search's settings. Which engines take a
  sequent is asked of linlog with the bindings as they are: `prove` forced to each engine
  with a budget of one unit refuses before it searches (`engine_refused`, with `because`)
  where the engine does not take it, the same test a search does before it starts. A forced
  engine lasts for the visit: `setSettings` stores every setting but it, and the page starts
  on Automatic (`tests/engines.spec.ts` reloads to check).

## Learn, the tour, About

- **Learn** (`Learn.tsx`) is `ui.learn`, the place shown or null (the tutorial or the reference): a frame of `--color-learn`
  around the window (`.app[data-learn]`, the window is `.win`) with the panel beside it,
  under it on a phone; with it on every action shows its label. Off, nothing of it is on
  the page. The tutorial's lessons are places (`LESSONS`), each holding its practice, until they are written. With Learn on, the band packs tighter (`.app[data-learn] .act`) to keep one row at 1280 pixels (`learn.spec.ts`).
- **The tour** (`Tour.tsx`) runs on `ui.tour`: each stop's `act` is performed once, on the
  way forward, through the state's own actions; the caption takes the focus, says each
  stop in the live region, and marks what it points at with `data-tour-spot`.
- **About** is a menu of the bottom band: its text, linlog's version from `about`, every
  licence the site serves (linked, `tests/learn.spec.ts` fetches each) and the line that
  GitHub logs visitors' addresses, which links the privacy page.
- **The privacy page** (`src/pages/privacy.astro`, at `/privacy/`) is a page of its own,
  linked from About, from the bottom band's end (More's sheet on a phone) and from the 404
  page. Each statement cites one of its numbered sources (`SOURCES`), every one cited and
  read in itself (Fedlex, the FDPIC, EUR-Lex, GitHub's documents, the Data Privacy
  Framework list); `tests/page.spec.ts` holds the citations to the list. A change of what
  the browser keeps, of the hosting or of the policy changes the page, from the sources
  read again. Astro's HTML compression drops a line break before an inline element: a
  line that ends in a word before a link ends in `{" "}`.

## Offline and installable (`src/offline/sw.js`, `src/integrations/offline.ts`)

- **The service worker is written by hand**: `@vite-pwa/astro` supports Astro up to 5, and
  the plugin alone never sees Astro's pages. The build fills `FILES` (every file of the
  site, the page as `/`) and `VERSION` (a hash of their contents) into `/sw.js`.
- **Its scope is the origin, its reach is the site's own files**: a worker at `/sw.js`
  cannot be scoped narrower than `/`, where the page is, and `/linlog/` (linlog's rustdoc,
  another Pages site on the origin) lies under it. So the fetch handler answers only the
  paths in `FILES` and navigations to `/`, and returns without `respondWith` for anything
  else; under `/linlog` it returns first, and the Static Routing API (`addRoutes`, where
  the browser has it) sends those requests to the network before the worker wakes.
  Never cache by pattern, never add a fallback page for other navigations, never cache
  a path under `/linlog`.
- **Every file is fetched past the HTTP cache when the worker installs** (`cache:
  "reload"`): Pages lets a browser keep a file ten minutes, and a new worker installed
  right after a deployment would otherwise cache the old page beside the new files
  (the reviewer's probe: unstyled, unhydrated, until the next deployment).
  `tests/serve.ts` sends Pages' `max-age=600` and a fresh `x-github-request-id` per
  response, by which `tests/offline.spec.ts` tells the two apart.
- **No `skipWaiting`**: a new worker waits until no page of the old one is open, so a page
  and the files it loads later (the module, its worker, Euler Math) come from one
  deployment; the old caches are deleted on activation, the `linlog-site-` ones only.
- **The manifest and its icons** are written by the same integration, the icons taken
  from the logo's rasters (below); `tests/offline.spec.ts` asks Chromium's installability
  over CDP, and fetches every icon the page and the manifest name, at its size.

## The logo (`src/logo/`, CC BY 4.0)

- **The six SVGs are the one source**: the word mark and the square form, each light, dark
  and one-colour (`currentColor`), the word Figtree Bold outlined. Every raster (the
  favicon's PNG, the Apple touch icon, the manifest's icons, the maskable one with its figure
  scaled into the safe circle, the link preview's `og.png`, GitHub's avatar and social
  preview) is drawn from them by `modules/_logo/derive.py` with nixpkgs' resvg
  (`modules/logo.nix`, `nix build .#logo`), linked at `.cache/linlog-logo`; never draw or
  edit one by hand. The build copies `src/logo/` and the site's rasters to `/logo/`
  (`offline.ts`), where linlog's README and rustdoc fetch them by URL: keep the paths
  `/logo/wordmark-*.svg`, `/logo/square-dark.svg` and `/logo/favicon-32.png` stable.
- **On the page the word mark is inline** (`Logo.tsx`, the 404 page's `set:html`), so the
  theme's tokens paint it: the letters `--color-ink`, the ring `--color-logo` (`.logo` in
  `app.css`); the drawing names itself "linlog". The band's mark is 30 pixels high
  (`--size-wordmark`, the author's choice; at the band's 18 the ring was a dot) and is
  hidden on a phone as the plain word was.
- **Its licence**: `src/logo/LICENSE.txt` (served at `/logo/LICENSE.txt`, listed in About)
  puts every file of the logo under CC BY 4.0 and says the name and mark may not suggest the
  project's endorsement; About repeats that line. The `licences` check holds every image
  the site serves to `logo/`, beside that notice, and every logo SVG to outlined text.
  Figtree's OFL 1.1 asks nothing for an outlined logo (its condition 5 exempts a document
  created with the font) and no font file goes with the SVGs; the notice names it anyway.
- **`tests/serve.ts` serves `tests/linlog-docs/` at `/linlog/`**, as Pages serves the
  rustdoc beside the site, so the tests see the worker leave it alone.

## Styling

- **Every colour, font and size is a token** in `src/styles/tokens.css` (`@theme static`,
  `light-dark()` pairs; Tailwind's palette, fonts and type scale off); `app.css` holds the
  page's one grammar (cluster, label, keyword, hover tip). Never a raw colour outside
  `tokens.css`, never a `style` attribute in markup (the `no-style-attributes` check):
  placement goes through the CSSOM (`el.style.left = …`) in a ref or an effect.
- No `!important` (Biome's rule): reduced motion zeroes the duration tokens instead.
- **No raw value outside the tokens** (`src/styles/tokens.test.ts`): every length, colour,
  duration, weight, opacity and layer in `app.css` is a `var(--…)`; allowed bare are 0, 1,
  `1fr`, `50%`/`100%`, `100vw`/`100vh`, and integers inside `calc()` as arithmetic over
  tokens. The island sizes no icon (`size={…}` is refused: `button svg.lucide` takes
  `--size-icon`) and writes no length in a string; a placement in TypeScript reads its
  offsets with `token("--spacing-…")` (`ui.tsx`). One breakpoint, 640 px, in every media
  query and in `phone()`; the test holds them equal.
- **Every control is one of two heights**, `--size-control` and `--size-control-small`,
  both 44 px under the phone's media query in `tokens.css`, and shares the states of the
  grammar's one rule in `app.css` (hover, `:active`, focus ring, disabled).
  `tests/targets.spec.ts` measures every visible control in every state at both widths
  (44 on a phone, 24 on a desktop): a new control, popover or state gets a step in its
  walk. A formula's button covers half the gap to its neighbours and is at least a
  control's height on screen, and `fitView` never zooms out below the size at which the
  active goal's formulas are a control wide (`floor`); a step that leaves them narrower
  zooms in to the floor unless the visitor zoomed by hand since the last fit (`byHand`).
  The test measures the stage in every math font too: Garamond-Math's narrower `B⊥` fell
  to 43 pixels on a phone before a step re-applied the floor.
- **A tab's calculus mark** stands apart from the sequent (`.pt-mark`: 12 pixels before it,
  8 between the calculus and the fragment); `tests/chip.spec.ts` measures the gaps on the
  text itself and that the phone's tab and `+` fit the row.
- **On a phone** the bottom band keeps undo, redo, close all, hint, Practice and Learn;
  `wide-only` actions move to More's sheet. Tips follow a mouse or a keyboard, never a
  touch (`App.tsx`).
- **The calculus is each tab's** (`Proof.mode`, kept in the shelf; a new empty tab starts in
  `lastMode`, the calculus last chosen in this visit, classical at a visit's start). A tab's
  calculus mark opens its switches (`Calculus` in the "Logic" popover) at every width, by a
  key too (the switches take the focus, Escape gives it back to the mark); that is their
  only place, the stage has none (`tests/modes.spec.ts`), and the restart warning
  (`ui.pendingMode`) is inside the popover. Tests set a calculus through `calculus()` and
  `switches()` in `tests/prover.ts`. The status writes the mode in the switches' words
  (`modeWords`). The band's popovers (Status, Logic) are `position: fixed` under the active tab
  (`underTab`): the row of tabs scrolls (`overflow: auto`) and clipped them while they were
  absolute, which no test saw until one asked what is drawn at the popover's middle.

## Tests

- **Vitest** for the logic, beside it as `*.test.ts`; `src/lib/testing.ts` loads linlog's
  real module in Node for the step tree's tests.
- **Playwright**, one test per interaction of the island (`tests/prover.spec.ts`, and
  `tests/phone.spec.ts` at a phone's width), against the built site served as Pages
  serves it (`tests/serve.ts`). Name elements by role and accessible name; a formula's
  button is named `<formula>, formula <p> of goal <g>`.
- In the dev shell, `e2e` drops the host's `LD_LIBRARY_PATH`, which breaks nixpkgs'
  Chromium; a scratch script that launches Chromium needs `env -u LD_LIBRARY_PATH` too.

---
paths:
  - "src/**/*.tsx"
---

# The island: Solid 1.9

The prover is one Solid island (`solid-js` 1.9.17, `@astrojs/solid-js` 7.0.2), the only JSX
framework. This rule is the author's learning sites' (website-learn's
`.claude/rules/islands.md`, written from docs.solidjs.com 1.x and Astro's
framework-components docs, checked 2026-10-11), kept as it is but for what differs here:
the island is placed with `client:only="solid-js"` (it renders nothing without its worker,
and the page has no other content to hydrate), and it is the whole app, so it reads the
browser's storage and the URL in `onMount` without a hydration mismatch to fear. Check a
signature in `node_modules/solid-js/types/` before using it from memory. Solid 2.0
(v2.solidjs.com) is a different API: none of its names (`Loading`, `Errored`, `onSettled`,
`merge`, `omit`, `@solidjs/web`) until the port, which the author's stack specification
(`~/Projects/own/website/docs/stack-spec.md` §3.4, "Moving to Solid 2.0") schedules.

**No React, ever.**

## The model

- **A component runs once**, to set up. After that only reactive reads re-run: JSX
  expressions, memos and effects, each when a signal it read changes. There is no re-render
  to wait for, and nothing in the body runs a second time.
- **A read counts only inside a tracking scope.** `count()` in the body is read once; the
  same call in JSX, `createMemo` or `createEffect` stays current.
- **Setters are synchronous in 1.x:** `count()` returns the new value right after
  `setCount(…)`, and `batch` groups several writes into one update.

## React habits that break it

Each habit → the Solid way, and why.

- **Destructured props**, in the parameter or the body (`const { x } = props`, `const x =
  props.x`) → read `props.x` where it is used, or wrap it: `() => props.x`. Props are
  getters, and a copy is read once. Defaults → `mergeProps({ size: 3 }, props)`, not default
  parameters. Groups to pass on → `splitProps(props, ["a"], ["b"])`.
- **A signal read into a `const`** (`const n = count()`) → call `count()` in the JSX, or
  derive `const double = () => count() * 2`. The `const` never changes.
- **An early return** (`if (!x) return null`) → `<Show when={x()} fallback={…}>`. The body
  ran once, so the branch is never taken again. In JSX, `<Show>` and `<Switch>`/`<Match>`
  read better than `&&` chains; a ternary inside JSX does work.
- **`.map` and `key`** → `<For each={…}>` for items whose order or length changes (the item is
  a value, the index a signal), `<Index each={…}>` for primitives and inputs at fixed
  positions (the item is a signal). `.map` in JSX recreates every node on any change, and
  there is no `key`.
- **`useState`** → `createSignal`, and the getter is a call: `count()`, never `count`.
  - A function passed to a setter is an updater, so storing a function is
    `setFn(() => fn)`.
  - Signals compare with `===`. A mutated object or array set again notifies nobody: set a
    new one, or use a store.
- **Dependency arrays** → none. `createEffect` tracks what it reads.
  - `on(dep, fn, { defer: true })` when the dependency must be explicit, or the first run
    skipped.
  - `untrack(() => …)` for a read that must not subscribe.
- **An effect that copies one signal into another** → a function, or `createMemo` when it is
  costly or read often. Effects are for work outside Solid (the DOM, timers, storage), and
  setting a signal in one invites loops and extra runs.
- **`useEffect(…, [])`** → `onMount`: once, untracked, after the refs are set.
- **A cleanup returned from an effect or `onMount`** → `onCleanup(…)` inside it, since a
  returned function is ignored. In an effect it also runs before each re-run.
- **`useRef`** → `let el!: HTMLDivElement` and `ref={el}`.
  - It is assigned during render, before the element is in the document. Use it in
    `onMount`, effects and handlers.
  - A value that persists without rendering is a plain `let`: the body runs once.
- **`useMemo` and `useCallback`** → `createMemo` for a cached derivation. A function needs no
  wrapper, since nothing re-creates it.
- **Copying nested state to change it** (`{ ...s, a: { ...s.a, b } }`) → `createStore` from
  `solid-js/store`.
  - Change it with path setters: `setStore("cards", 0, "due", d)`.
  - `produce` for several edits; `reconcile` to merge new data.
  - Store properties are read directly (`store.cards`). Destructuring a store breaks
    reactivity, as it does for props.
- **`props.children` read more than once** → `const resolved = children(() =>
  props.children)`, then `resolved()`. Each raw read creates the children again.
- **Context for a page's state** → context ends at the island: each one hydrates as its own
  root. To share state between islands, export a signal or store from a `.tsx` module
  (Astro's recipe for Solid). Within one island, context works with signals or a store as
  its value.
- **Attribute names** → HTML's: `class`, `for`, and `onInput` for each keystroke. `onChange`
  fires on commit, as in the DOM. Style keys are dash-case, though the CSP rules out `style`
  anyway (below).
- **Handlers that re-bind** → handlers are not reactive: call the current prop inside one
  (`() => props.onPick?.(x)`). `onClick` and the other delegated events listen on the
  document, so `stopPropagation()` needs the native form, `on:click`.
- **Work after `await` or in `setTimeout`** → tracking and the owner end there.
  - A signal read after it subscribes nothing.
  - An effect or `onCleanup` created there is never disposed.
  - Read before awaiting, or capture `getOwner()` and use `runWithOwner`.

## Inside the island

- **It renders in the browser alone** (`client:only`): no server render, no hydration.
  Browser APIs may be used in the body, but storage, the URL and the worker are touched in
  `onMount` and effects, so the first paint does not wait on them.
- **No `style` prop.** Astro would write it as a `style` attribute in any server-rendered
  markup, and the `no-style-attributes` check fails the build on one. Live values (the
  camera's transform, a popover's place) go through the CSSOM in an effect or a handler:
  `el.style.setProperty(...)`, `el.style.transform = ...`. State goes into `data-*` and
  `aria-*` attributes, for CSS to draw and tests to read.
- **linlog's SVG goes in with `innerHTML`** into a host element: it is the library's own
  output, and the drawing stays a picture (`role="img"`); the clickable formulas are HTML
  buttons over it (WCAG: an interactive SVG must not sit inside `role="img"`).
- **Animation** is `element.animate()` or a CSS transition, after checking
  `prefers-reduced-motion`; never Motion.
- **Every interaction gets a Playwright test that drives it**: these bugs only show at
  runtime.

## Types

- **Components:** `Component<P>`, `ParentComponent<P>` (adds `children`), `VoidComponent<P>`,
  `JSX.Element`.
- **Signals and handlers:** `Accessor<T>`, `Setter<T>`, and
  `JSX.EventHandler<HTMLInputElement, InputEvent>`, or an inline handler for inference.
- **Narrowing:** `<Show when={user()}>{(u) => u().name}</Show>` narrows a nullable signal,
  which `user() && user().name` does not.

## What Biome catches, and what it misses

- **It fails a `.tsx` on:**
  - a destructured props *parameter*;
  - a bare `.map` in JSX children;
  - `className` and `htmlFor`;
  - the same identifier spread twice.
- **It misses:** destructuring in the body, `.map(…).filter(…)`, a signal read into a
  `const`, early returns and every effect habit. The list above covers those.
- **`.ts` and `.astro` files may not import `solid-js`:** Solid code lives in `.tsx`, where
  this rule loads.

## Easing the 2.0 port

Where 1.x offers an equal choice, take the one 2.0 keeps (stack-spec §3.4): a `ref` callback
over a `use:` directive, a store over `createMutable`, `data-*` state over `classList`, and a
local variable over reading a signal right after setting it (2.0 defers the write).

---
paths:
  - ".github/**"
---

# CI

- **`ci.yml` runs `nix flake check`** on every push to `main`, every pull request and by
  hand, with nothing installed but Nix, then builds `ci-cache` (`modules/ci.nix`), which
  roots everything the checks need.
- **Two caches, for two kinds of path.** The public Cachix cache `linlog-prover` is the
  organization's and must receive only its projects' own outputs, never third-party files:
  so the run reads it (linlog's CI pushes `linlog-web` there, and this CI never builds
  Rust) and pushes to it only the built site (`nix build .#default | cachix push`, a
  closure of itself alone), only from `main` and only while the secret
  `CACHIX_AUTH_TOKEN` exists. node_modules, Chromium, the formatters and the checks'
  results are third-party or worthless to others: they are kept between runs in GitHub's
  Actions cache, private to the repository, by cache-nix-action as the author's sites do
  (restore the newest `nix-Linux-` store, save under the hash of `ci-cache`'s store path
  when it changed, only on `main`; `prune-caches` deletes the older ones). Never give the
  `cachix-action` step an auth token or a `pushFilter`: it would push everything the run
  built or fetched.
- **Actions are pinned to full commit SHAs**, with the version in a trailing comment. A
  new SHA is looked up fresh, never remembered (`gh api repos/<owner>/<repo>/releases/latest`,
  then `.../git/ref/tags/<tag>`, following an annotated tag once more), and every `gh`
  call asks first.
- **`actionlint`** (a flake check) validates the workflow and its shell steps.
- **The deployment** to GitHub Pages (`upload-pages-artifact`, `deploy-pages`) joins this
  workflow when the site is published.

---
paths:
  - ".github/**"
---

# CI

- **`ci.yml` runs `nix flake check`** on every push to `main`, every pull request and by
  hand, with nothing installed but Nix, then builds `ci-cache` (`modules/ci.nix`), which
  roots the checks' build-time inputs.
- **Cachix `linlog-prover`**: every run pulls from it (linlog's CI pushes the package
  `linlog-web` there, so the site's CI never builds Rust). A run pushes only from `main` and
  only while the repository has the secret `CACHIX_AUTH_TOKEN` (the author adds it);
  without it the step only downloads. Nothing third-party but the checks' own inputs is
  pushed: this flake builds no other prover and no problem library.
- **Actions are pinned to full commit SHAs**, with the version in a trailing comment. A
  new SHA is looked up fresh, never remembered (`gh api repos/<owner>/<repo>/releases/latest`,
  then `.../git/ref/tags/<tag>`, following an annotated tag once more), and every `gh`
  call asks first.
- **`actionlint`** (a flake check) validates the workflow and its shell steps.
- **The deployment** to GitHub Pages (`upload-pages-artifact`, `deploy-pages`) joins this
  workflow when the site is published.

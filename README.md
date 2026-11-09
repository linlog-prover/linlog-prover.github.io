# linlog-prover.github.io: linlog has moved

linlog, its web page, its manual and its Rocq library moved on 2026-11-08
from the GitHub organisation `linlog-prover` to
[`deduxit`](https://github.com/deduxit) (named `sequentium` for its
first day), whose repository `deduxit` is a collection of logic suites;
linlog is its linear suite and keeps its name, its crates and its
command.

| was | is now |
|---|---|
| github.com/linlog-prover/linlog | [github.com/deduxit/deduxit](https://github.com/deduxit/deduxit) |
| github.com/linlog-prover/rocq-linlog | [github.com/deduxit/rocq-linlog](https://github.com/deduxit/rocq-linlog) |
| github.com/linlog-prover/linlog-prover.github.io | [github.com/deduxit/deduxit.github.io](https://github.com/deduxit/deduxit.github.io) |
| linlog-prover.github.io (the web page) | [deduxit.github.io](https://deduxit.github.io/) |
| linlog-prover.github.io/linlog/manual/ | [deduxit.github.io/deduxit/manual/](https://deduxit.github.io/deduxit/manual/) |
| linlog-prover.github.io/linlog/ (the library's API) | [deduxit.github.io/deduxit/](https://deduxit.github.io/deduxit/) |
| linlog-prover.github.io/rocq-linlog/ | [deduxit.github.io/rocq-linlog/](https://deduxit.github.io/rocq-linlog/) |
| linlog-prover.github.io/logo/ | [deduxit.github.io/logo/](https://deduxit.github.io/logo/) |

GitHub redirects a moved repository's web and git addresses, but not its
Pages site, so this repository is the organisation site that answers the
old addresses (`site/`, published by `.github/workflows/pages.yml`):

- `index.html` sends the web page's address to the new one with its query
  and fragment, which carry a shared proof.
- `404.html`, which Pages serves for every path that holds no file, sends
  `/linlog/…` to `/deduxit/…`, `/rocq-linlog/…` to `/rocq-linlog/…` and
  every other path to the same path, all on deduxit.github.io.
- `logo/` keeps the logo's files, which the documentation of every
  published version of the crate embeds from here: an image does not
  follow a redirect. They are under CC BY 4.0 (`logo/LICENSE.txt`).
- `llms.txt`, `linlog/llms.txt`, `linlog/llms-full.txt` and
  `linlog/reference.md` (which the guide links beside itself) are copies
  of the guides for AI models as of the move, each naming its new address
  in its first line, since a client that reads text runs no redirect.
- `sw.js` replaces the service worker the web page installed in its
  visitors' browsers, which would otherwise keep showing the old page: it
  unregisters itself and reloads the page, which then follows the
  redirect.

The organisation `linlog-prover` stays, so that its name and these
addresses cannot be taken by someone else. The code here is under the EUPL
(`LICENSE`).

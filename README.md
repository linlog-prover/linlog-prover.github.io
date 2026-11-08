# linlog-prover.github.io: linlog has moved

linlog, its web page, its manual and its Rocq library moved on 2026-11-08
from the GitHub organisation `linlog-prover` to
[`sequentium`](https://github.com/sequentium), whose repository
`sequentium` is a collection of logic suites; linlog is its linear suite
and keeps its name, its crates and its command.

| was | is now |
|---|---|
| github.com/linlog-prover/linlog | [github.com/sequentium/sequentium](https://github.com/sequentium/sequentium) |
| github.com/linlog-prover/rocq-linlog | [github.com/sequentium/rocq-linlog](https://github.com/sequentium/rocq-linlog) |
| github.com/linlog-prover/linlog-prover.github.io | [github.com/sequentium/sequentium.github.io](https://github.com/sequentium/sequentium.github.io) |
| linlog-prover.github.io (the web page) | [sequentium.github.io](https://sequentium.github.io/) |
| linlog-prover.github.io/linlog/manual/ | [sequentium.github.io/sequentium/manual/](https://sequentium.github.io/sequentium/manual/) |
| linlog-prover.github.io/linlog/ (the library's API) | [sequentium.github.io/sequentium/](https://sequentium.github.io/sequentium/) |
| linlog-prover.github.io/rocq-linlog/ | [sequentium.github.io/rocq-linlog/](https://sequentium.github.io/rocq-linlog/) |
| linlog-prover.github.io/logo/ | [sequentium.github.io/logo/](https://sequentium.github.io/logo/) |

GitHub redirects a moved repository's web and git addresses, but not its
Pages site, so this repository is the organisation site that answers the
old addresses (`site/`, published by `.github/workflows/pages.yml`):

- `index.html` sends the web page's address to the new one with its query
  and fragment, which carry a shared proof.
- `404.html`, which Pages serves for every path that holds no file, sends
  `/linlog/…` to `/sequentium/…`, `/rocq-linlog/…` to `/rocq-linlog/…` and
  every other path to the same path, all on sequentium.github.io.
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

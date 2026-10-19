# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# linlog's web front end, served at https://linlog-prover.github.io/, as a
# flake in the dendritic pattern (flake-parts + import-tree): every .nix file
# under modules/ is discovered automatically and configures one aspect of the
# flake (a path segment starting with `_' is skipped), so this file declares
# the inputs and nothing else.
{
  description = "linlog in the browser: linear logic proved by clicking";

  inputs = {
    # The prover. Its flake builds the package `linlog-web' (the library
    # compiled to WebAssembly with its JavaScript glue, LICENSE and the Rust
    # crates' notices), which the site serves; nothing here builds Rust.
    # Pinned by flake.lock to a commit on linlog's main; while a change of
    # linlog is under way, `--override-input linlog path:../linlog-…' points
    # a build at a local workspace without touching the lock.
    linlog.url = "github:linlog-prover/linlog";

    # linlog's own nixpkgs, so that the bindings and the site share one
    # package set (and one store and one binary cache), and an update of
    # linlog moves both. Its Node.js 24 and playwright-driver are the site's.
    nixpkgs.follows = "linlog/nixpkgs";

    # The flake machinery follows linlog's too: one set of versions for both
    # repositories, all of them past the fourteen days an update waits.
    flake-parts.follows = "linlog/flake-parts";
    import-tree.follows = "linlog/import-tree";
    devshell.follows = "linlog/devshell";
    treefmt-nix.follows = "linlog/treefmt-nix";
  };

  outputs = inputs: inputs.flake-parts.lib.mkFlake { inherit inputs; } (inputs.import-tree ./modules);
}

# linlog © Fabian Lukas Grubmüller 2026
# Licensed under the EUPL

# Playwright's browsers come from nixpkgs (`playwright-driver'): its own
# download does not run on NixOS. One set, defined here, for the dev shell
# (`e2e') and the e2e check alike: Chromium and its headless shell, the build
# headless Playwright launches. Taken from the author's learning sites
# (website-learn's modules/playwright.nix).
#
# The npm @playwright/test version must equal nixpkgs' playwright-driver
# version, or Playwright looks for a browser revision that is not there and
# fails at launch with an error that does not say why. `playwright-version'
# fails at evaluation instead, with the fix spelled out, when a lock or
# nixpkgs update moves one without the other.
{ lib, ... }:
{
  perSystem =
    { config, pkgs, ... }:
    let
      lock = lib.importJSON ../package-lock.json;
      playwrightNpm = lock.packages."node_modules/@playwright/test".version;
      playwrightNix = pkgs.playwright-driver.version;
    in
    {
      options.playwrightBrowsers = lib.mkOption {
        type = lib.types.package;
        default = pkgs.playwright-driver.selectBrowsers {
          withChromium = true;
          withFirefox = false;
          withWebkit = false;
          withFfmpeg = false;
        };
        defaultText = lib.literalExpression "Chromium and its headless shell from pkgs.playwright-driver";
        description = "The browsers Playwright runs, as PLAYWRIGHT_BROWSERS_PATH.";
      };

      config = {
        devshells.default.env = [
          {
            name = "PLAYWRIGHT_BROWSERS_PATH";
            value = config.playwrightBrowsers;
          }
          {
            name = "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD";
            value = "1";
          }
          {
            name = "PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS";
            value = "true";
          }
        ];

        checks.playwright-version =
          pkgs.runCommand "check-playwright-version"
            {
              inherit playwrightNpm playwrightNix;
            }
            ''
              if [ "$playwrightNpm" != "$playwrightNix" ]; then
                echo "@playwright/test is $playwrightNpm in package-lock.json, but nixpkgs'" >&2
                echo "playwright-driver (whose browsers the dev shell and e2e use) is $playwrightNix." >&2
                echo "Fix: npm install --save-dev @playwright/test@$playwrightNix --min-release-age=0" >&2
                exit 1
              fi
              touch $out
            '';
      };
    };
}

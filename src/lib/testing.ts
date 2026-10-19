// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * linlog's real module in Node, for the unit tests: the bindings the site
 * loads (.cache/linlog-web), instantiated from their bytes.
 */

import { readFileSync } from "node:fs";
import * as linlog from "linlog-web/linlog_web.js";

linlog.initSync({
  module: readFileSync(new URL("../../.cache/linlog-web/linlog_web_bg.wasm", import.meta.url)),
});

export { linlog };

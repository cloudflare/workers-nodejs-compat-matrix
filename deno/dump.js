import fs from "node:fs/promises";
import path from "node:path";

import { visit } from "../dump-utils.mjs";
import baseline from "../data/baseline.json" with { type: "json" };

const outputFilePath = path.join(
  import.meta.dirname,
  "..",
  "data",
  "deno.json"
);
await fs.rm(outputFilePath, { force: true });

const denoGlobals = {};
const importedModules = {};
for (const name of Object.keys(baseline)) {
  if (name === "*globals*") {
    for (const globalProp of Object.keys(baseline["*globals*"])) {
      if (globalProp in globalThis) {
        denoGlobals[globalProp] = globalThis[globalProp];
      }
    }
    continue;
  }

  try {
    const moduleName = name.startsWith("node:") ? name : `node:${name}`;
    const module = await import(moduleName);
    importedModules[name] = module;
  } catch {
    continue;
  }
}

const result = visit(baseline, {
  "*globals*": denoGlobals,
  ...importedModules,
});

await fs.writeFile(outputFilePath, JSON.stringify(result, null, 2));

import fs from "node:fs/promises";
import path from "node:path";

import { visit } from "../dump-utils.mjs";
import baseline from "../data/baseline.json" with { type: "json" };

const outputFilePath = path.join(__dirname, "..", "data", "bun.json");
await fs.rm(outputFilePath, { force: true });

const bunGlobals = {};
const importedModules = {};
for (const name of Object.keys(baseline)) {
  if (name === "*globals*") {
    for (const globalProp of Object.keys(baseline[name])) {
      if (globalProp in globalThis) {
        bunGlobals[globalProp] = globalThis[globalProp];
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

const result = visit(baseline, { "*globals*": bunGlobals, ...importedModules });

// reset process.env so that it doesn't contain user specific info
if (result["*globals*"].process?.env) {
  result["*globals*"].process.env = { "*self*": "object" };
}
if (result["process"].env) {
  result["process"].env = { "*self*": "object" };
}
if (result["process"].default?.env) {
  result["process"].default.env = { "*self*": "object" };
}
if (result["module"]._cache) {
  result["module"]._cache = "object";
}
if (result["module"]._pathCache) {
  result["module"]._pathCache = "object";
}
if (result["module"].default._cache) {
  result["module"].default._cache = "object";
}
if (result["module"].default._pathCache) {
  result["module"].default._pathCache = "object";
}

await fs.writeFile(outputFilePath, JSON.stringify(result, null, 2));

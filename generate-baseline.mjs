import shell from "shelljs";
import deepmerge from "deepmerge";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { objectSort } from "./dump-utils.mjs";
import { ignoredModules } from "./report/src/ignored-modules.js";

shell.set("-e");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!shell.env.VOLTA_HOME) {
  console.error(
    "You must have volta installed to continue. Refer to README.md for instructions."
  );
  process.exit(1);
}

// shelljs doesn't read from .bashrc or .zshrc which normally inject VOLTA_HOME
// into your PATH variable, so a lookup is needed.
// Trailing space is intentional, for DX
const volta = `${shell.env.VOLTA_HOME}/bin/volta `;

// Node
const nodeVersions = [18, 20, 22];
for (const version of nodeVersions) {
  shell.echo(`Generate node v${version} apis...`);
  shell.exec(volta + `run --node ${version} node node/dump.mjs`);
  shell.echo("=== Done ====================================\n\n");
}

shell.echo("Generating baseline.json");

// Create a merged baseline that will be used in the report
// as well as when generating bun and deno
const node18 = JSON.parse(shell.cat("data/node-18.json"));
const node20 = JSON.parse(shell.cat("data/node-20.json"));
const node22 = JSON.parse(shell.cat("data/node-22.json"));

// Sort the baseline by key name
const baseline = objectSort(deepmerge.all([node18, node20, node22]));

for (const module of ignoredModules) {
  delete baseline[module];
}

// We remove everything that starts with an underscore since they're internal APIs
// that we are not targeting at the moment.
for (const mod of Object.keys(baseline)) {
  if (typeof baseline[mod] === 'object') {
    for (const key of Object.keys(baseline[mod])) {
      if (key.startsWith('_')) {
        delete baseline[mod][key];
        delete baseline[mod].default[key];
      }
    }
  }
}

// Retain a copy of the baseline in the `node` folder for bun and deno
await fs.writeFile(
  path.join(__dirname, "data", "baseline.json"),
  JSON.stringify(baseline, null, 2)
);

shell.echo("=== Done ====================================\n\n");

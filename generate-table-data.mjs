import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import baseline from "./data/baseline.json" with { type: "json" };
import node24 from "./data/node-24.json" with { type: "json" };
import bun from "./data/bun.json" with { type: "json" };
import deno from "./data/deno.json" with { type: "json" };
import workerd from "./data/workerd.json" with { type: "json" };
import versionMap from "./report/src/data/versionMap.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This MUST match the ordering of `targetTitles` in `report/src/App.tsx`
const targets = {
  node24,
  workerd,
  bun,
  deno,
};

/* == COLUMNS ==================================
  [ keyPath, leafCount, baselineSupport, target1, target2, ..., targetN ]
*/

// Gets the value of a node at a provided path. Recurses into objects as needed.
const get = (node, path) => {
  if (path.length === 0) return node;
  const [head, ...tail] = path;
  const value = node[head];
  if (value == null) return value;
  return get(value, tail);
};

const isObject = (node) => {
  return typeof node === "object" && Object.keys(node).length > 0;
};

// For a set of rows, tally up how many rows contain non-falsy values for the provided index
// This trades off performance for the readability of the visit function. This is a good tradeoff
// since it's done as a build time generation step (and still only takes a few seconds).
const tallyColumnValues = (rows, columnIndex) => {
  let counts = {
    supported: 0,
    mismatch: 0,
    unsupported: 0,
  };

  for (const row of rows) {
    const columnValue = row[columnIndex];

    // Skip the aggregate rows of objects so that only leaf values are tallied
    if (columnValue.includes("/")) {
      continue;
    }

    counts[columnValue]++;
  }

  return Object.values(counts).join("/");
};

const isPartOfStubModule = (target, keyPath) => {
  const moduleName = keyPath[0];
  const moduleInfo = target[moduleName];

  // Stub module can be identified as a module that has only one key - the default,
  // which in turn has only one key, the synthetic "*default*" key
  return (
    moduleInfo &&
    Object.keys(moduleInfo).length === 1 &&
    moduleInfo.default?.["*default*"] &&
    Object.keys(moduleInfo.default).length === 1
  );
};

const visit = (node, path) => {
  const rows = [];

  let leafTotal = 0;
  for (const [key, childNode] of Object.entries(node)) {
    const keyPath = [...path, key];

    const rowKey = keyPath.join(".");
    if (isObject(childNode)) {
      // render an aggregate of children, plus the children
      const [children, count] = visit(childNode, keyPath);

      const row = [
        rowKey,
        count,
        // This should always match `count`, since everything is `true` for baseline
        count,
      ];
      for (let i = 0; i < Object.keys(targets).length; i++) {
        // The column number is offset by 3 since we have 3 columns dedicated to
        // keypath, leafCount, and baseline support
        row.push(tallyColumnValues(children, i + 3));
      }
      rows.push(row, ...children);

      leafTotal += count;
    } else {
      // render a leaf node
      const row = [rowKey, 0, "supported"];

      for (const target of Object.values(targets)) {
        const targetValue = get(target, keyPath);
        if (isPartOfStubModule(target, keyPath)) {
          row.push("unsupported");
        } else if (targetValue === "missing" && childNode !== "missing") {
          row.push("unsupported");
        } else if (targetValue && targetValue !== childNode) {
          // Don't detect mismatches between functions and classes
          if (
            (targetValue === "function" && childNode === "class") ||
            (childNode === "function" && targetValue === "class")
          ) {
            row.push("supported");
          } else {
            row.push("mismatch");
          }
        } else if (targetValue) {
          row.push("supported");
        } else {
          row.push("unsupported");
        }
      }

      rows.push(row);
      leafTotal += 1;
    }
  }

  return [rows, leafTotal];
};

const buildTable = () => {
  const [rows, leafCount] = visit(baseline, []);

  const totalsRow = ["Totals", leafCount, leafCount];
  for (let i = 0; i < Object.keys(targets).length; i++) {
    totalsRow.push(tallyColumnValues(rows, i + 3));
  }

  return [totalsRow, ...rows];
};

console.log("Generating table data...");

const tableData = buildTable();

await fs.writeFile(
  path.join(__dirname, "report", "src", "data", "table-data.json"),
  JSON.stringify(tableData, null, 2)
);

// Write a .csv file for download
const csvData = tableData
  // filter out aggregate rows. Only display leaf nodes
  .filter((row) => row[1] === 0)
  // Store the module name separately from the remaining keyPath for better sorting
  .map((row) => {
    const keyPath = row[0].split(".");
    const [module, ...remPath] = keyPath;
    return [
      module,
      remPath.join("."),
      // only add the columns containing target support
      ...row.slice(2),
    ];
  });

// Add version row
csvData.unshift([
  "",
  "",
  "",
  ...Object.keys(targets).map((targetKey) => versionMap[targetKey]),
]);

// Add a header row
csvData.unshift(["Module", "Path", "baseline", ...Object.keys(targets)]);

const csvString = csvData
  // Make each row a comma separated string
  .map((row) => row.join(","))
  .join("\n");

await fs.writeFile(
  path.join(__dirname, "report", "public", "runtime-support.csv"),
  csvString
);

console.log("=== Done ====================================\n");

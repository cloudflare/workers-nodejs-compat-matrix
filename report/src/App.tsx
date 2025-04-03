import React, { useState } from "react";
import "./App.css";

import tableData from "./data/table-data.json";
import versionMap from "./data/versionMap.json";
import timestamp from "./data/timestamp.json";
import { mismatch, mock, matching, missing } from "./constants";
import { Legend } from "./Legend";
import { TableCell, TableHeaderCell, TableRow } from "./Table";
import { formatPct, getDocsLink, getPolyfillSearchLink, pct } from "./utils";
import { z } from "zod";
import { ignoredModules } from './ignored-modules.js'

// The thresholds beyond which we render support percentages as red or green
const RED_THRESHOLD = 20;
const GREEN_THRESHOLD = 80;

const versionSubtitles = {
  workerd: "nodejs_compat",
  wranglerV3: "(legacy) node_compat = true",
  wranglerUnenv: "nodejs_compat",
};

// This MUST match the ordering of `targets` in `generate-table-data.mjs`
const targetTitles = {
  node22: "node",
  node20: "node",
  node18: "node",
  bun: "bun",
  deno: "deno",
  workerd: "workerd",
  wranglerUnenv: "wrangler",
};

const rowSchema = z.tuple([
  z.string(), // key
  z.number(), // leaf count
  z.number().or(z.string()), // basline
  // targets
  ...Object.keys(targetTitles).map(() => z.number().or(z.string())),
]);

type RowData = z.infer<typeof rowSchema>;

const App = () => {
  const [expanded, setExpanded] = useState<string[]>([]);

  const expand = (key: string) => {
    if (expanded.some((k) => k.startsWith(key))) {
      setExpanded(expanded.filter((k) => !k.startsWith(key)));
    } else {
      setExpanded([...expanded, key]);
    }
  };

  const renderRow = (row: RowData) => {
    const [path, leafCount, baselineSupport, ...targets] = row;

    const pathParts = path.split(".");
    const key = pathParts[pathParts.length - 1];
    const parentPath = pathParts.slice(0, pathParts.length - 1).join(".");

    const isExpanded = expanded.includes(parentPath);
    const isTopLevel = pathParts.length === 1;

    if (pathParts.length > 1 && !isExpanded) {
      return null;
    }

    const renderSupportValue = (value: string) => {
      console.log(value);
      switch (value) {
        case "supported":
          return matching;
        case "unsupported":
          return mismatch;
        case "stub":
          return mock;
        case "missing":
        default:
          return missing;
      }
    };

    const renderLeafCell = (value: string, targetIndex: number) => {
      const targetName = Object.keys(targetTitles)[targetIndex];
      const githubSearchLink = getPolyfillSearchLink(targetName, key);

      return (
        <TableCell>
          <div className="flex items-center gap-2 justify-center">
            <a href={githubSearchLink} target="_blank" rel="noreferrer">
              {renderSupportValue(value)}
            </a>
          </div>
        </TableCell>
      );
    };

    const renderLeafCells = () => {
      return (
        <>
          <TableCell>{matching}</TableCell>
          {targets.map((targetValue, targetIndex) =>
            renderLeafCell(targetValue as string, targetIndex)
          )}
        </>
      );
    };

    const renderAggregates = () => {
      return (
        <>
          <TableCell color="green">
            <span className="text-xs" title={"APIs count: " + baselineSupport}>
              {baselineSupport}
            </span>
          </TableCell>
          {targets.map((target) => {
            const [matching, mismatch, mock, missing] = (target as string)
              .split("/")
              .map((i) => parseInt(i as string));

            const totalPresent = matching + mismatch + mock;
            const total = totalPresent + missing;
            const presentPct = pct(totalPresent, baselineSupport as number);

            const missingPct = pct(missing, total);
            const mismatchPct = pct(mismatch, total);
            const mockPct = pct(mock, total);

            let bgColor = "red";
            if (presentPct > RED_THRESHOLD) {
              bgColor = "yellow";
            }
            if (presentPct > GREEN_THRESHOLD) {
              bgColor = "green";
            }

            const tooltip = `Missing: ${missing}\nMismatch: ${mismatch}\nMocked: ${mock}\nMatching: ${matching}`;

            return (
              <TableCell color={bgColor}>
                <div
                  title={tooltip}
                  className={`flex gap-3 justify-center items-center`}
                >
                  <span className="text-sm">{formatPct(presentPct)}</span>
                  <div className="text-xs">
                    <span>
                      {formatPct(missingPct)}/{formatPct(mismatchPct)}/
                      {formatPct(mockPct)}
                    </span>
                  </div>
                </div>
              </TableCell>
            );
          })}
        </>
      );
    };

    const renderKeyValue = () => {
      const content = (
        <>
          <span className="opacity-0">{"_".repeat(pathParts.length * 2)}</span>
          {key}
        </>
      );

      // Certain builtins like _http_agent don't have docs pages
      if (key.startsWith("_")) {
        return content;
      }

      if (!isTopLevel) return content;

      return (
        <>
          <span className="opacity-0">{"_".repeat(pathParts.length * 2)}</span>
          <a
            className="text-blue-900 hover:text-blue-500"
            href={getDocsLink(key)}
            target="_blank"
            rel="noreferrer"
          >
            {key}
          </a>
        </>
      );
    };

    return (
      <TableRow
        onClick={(e) => {
          // Don't expand/unexpand on link navigations
          if ((e.target as HTMLAnchorElement).nodeName === "A") {
            return;
          }
          expand(path);
        }}
        key={path}
      >
        <TableCell>
          <div className="flex justify-start items-center gap-2 text-sm">
            {renderKeyValue()}
            {leafCount > 0 && (
              <span className="text-xs">
                {expanded.includes(path) ? "▼" : "▶"}
              </span>
            )}
          </div>
        </TableCell>
        {leafCount === 0 ? renderLeafCells() : renderAggregates()}
      </TableRow>
    );
  };

  const renderTotalsRow = (totalsRow: any[]) => {
    const [baselineCount, ...targetTotals] = totalsRow.slice(2);

    return (
      <TableRow>
        <TableCell>
          <span className="font-semibold flex justify-start ml-4">Totals</span>
          <span className="text-xs font-light flex justify-start ml-4">
            missing / mismatched / mocked
          </span>
        </TableCell>
        <TableCell>
          <div>
            <span className="font-semibold text-sm">100%</span>
            <div className="text-xs">{baselineCount}</div>
          </div>
        </TableCell>
        {targetTotals.map((targetTotal) => {
          const [matching, mismatch, mock, missing] = (targetTotal as string)
            .split("/")
            .map((i) => parseInt(i as string, 10));

          const totalPresent = matching + mismatch + mock;
          const total = totalPresent + missing;
          const presentPct = pct(totalPresent, baselineCount as number);
          const missingPct = pct(missing, total);
          const mismatchPct = pct(mismatch, total);
          const mockPct = pct(mock, total);

          const tooltip = `Matching: ${matching}\nMissing: ${missing}\nMismatch: ${mismatch}\nMocked: ${mock}`;

          return (
            <TableCell>
              <div title={tooltip}>
                <span className="text-sm font-semibold">
                  {formatPct(presentPct)}
                </span>
                <div className="text-xs">
                  <span>
                    {formatPct(missingPct)}/{formatPct(mismatchPct)}/
                    {formatPct(mockPct)}
                  </span>
                </div>
              </div>
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

  const [totalsRow, ...rows] = tableData as RowData[];
  const allKeys = rows.map((row) => row[0] as string);

  return (
    <div className="App">
      <div className="container mx-auto py-10">
        <div className="my-5 flex justify-between items-center">
          <div className="flex gap-2">
            <a
              className="hover:bg-blue-500 bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-md flex items-center"
              href={`${process.env.PUBLIC_URL}/runtime-support.csv`}
              download="workerd-nodejs-support.csv"
            >
              Download (.csv)
            </a>
            <button
              className="hover:bg-slate-100 border border-blue-400 text-blue-700 text-sm font-semibold px-3 py-2 rounded-md"
              onClick={() => setExpanded([...allKeys])}
            >
              Expand All
            </button>
            <button
              className="hover:bg-slate-100 border border-blue-400 text-blue-700 text-sm font-semibold px-3 py-2 rounded-md"
              onClick={() => setExpanded([])}
            >
              Collapse All
            </button>
          </div>
          <div className="text-sm">
            <span className="font-semibold mr-1">Generated:</span>
            {new Date(timestamp.timestamp).toLocaleString()}
          </div>
          <Legend />
        </div>
        <div className="text-left mb-5 text-sm">
          <h3 className="font-semibold text-lg mb-1">Notes</h3>
          <ul className="list-disc list-inside">
            <li className="mb-1">
              All percentages in the table represent whether the
              shape of the API matches against the baseline.
              <span className="font-bold">They are not a
              calculation of implementation compliance.</span>
            </li>
            <li className="mb-1">
              The percentages represent the API surface area that is matching,{" "}
              mocked, <span className="font-semibold">or</span> mismatched.
            </li>
            <li className="mb-1">
              The <span className="font-semibold">baseline</span> column
              represents a union of Node.js v18, v20, and v22 API surfaces that
              we use as the ideal Node.js API compatibility target.
            </li>
            <li className="mb-1">
              <span className="font-semibold">Mock</span> means that the API can
              still be imported but it is not implemented. It will throw an
              error or return an dummy value if called.
            </li>
            <li className="mb-1">
              These values have been autogenerated and may not be 100% accurate.
            </li>
            <li className="mb-1">
              The following modules do not fit in a serverless context, are deprecated, or are experimental, and removed from the report: {Array.from(ignoredModules).join(', ')}
            </li>
          </ul>
        </div>
        <table className="table-fixed border border-slate-200 p-5 border-collapse">
          <thead>
            <tr className="sticky top-0 bg-white">
              <TableHeaderCell width="min-w-[25ch]">API</TableHeaderCell>
              <TableHeaderCell width="min-w-[8ch]">
                <div>baseline</div>
                <div className="text-xs font-light">22+20+18</div>
              </TableHeaderCell>
              {Object.entries(targetTitles).map(([targetKey, title]) => {
                const versionSubtitle =
                  versionSubtitles[targetKey as keyof typeof versionSubtitles];
                const versionName =
                  versionMap[targetKey as keyof typeof versionMap];

                return (
                  <TableHeaderCell width="w-[15ch]">
                    <div>{title}</div>
                    <div className="text-xs font-light mt-1">{versionName}</div>
                    <div className="text-xs font-light mt-1">
                      {versionSubtitle}
                    </div>
                  </TableHeaderCell>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {renderTotalsRow(totalsRow)}
            {rows.map((row) => renderRow(row))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default App;

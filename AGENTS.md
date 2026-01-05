# Agent Guidelines for Workers Node.js Compat Matrix

This document provides guidelines for AI coding agents working in this repository.

## Project Overview

This project audits Node.js API compatibility across different runtimes (Node.js, Bun, Deno, Cloudflare Workers/workerd). It generates JSON dumps of runtime APIs and displays compatibility in a React-based report at https://workers-nodejs-compat-matrix.pages.dev

## Build & Development Commands

### Prerequisites

- Node.js v22 (required for generation scripts)
- fnm (for Node version management) - set `FNM_DIR` env var to fnm binary location
- Deno and Bun installed
- pnpm 10.0.0

### Main Commands

```bash
# Install dependencies
pnpm install

# Generate full compatibility report (requires Node 18, 20, 22 via fnm)
pnpm run generate

# Scan APIs for specific runtimes only
node ./scan-apis.mjs --only workerd
node ./scan-apis.mjs --only bun,deno

# Generate table data for UI (after scanning)
pnpm run generate:table

# Generate historical trend data (scans multiple workerd versions)
pnpm run generate:historical

# Serve React report locally
pnpm run report:dev

# Build report for production
pnpm run --filter report build

# Deploy to Cloudflare Pages
pnpm run report:deploy
```

### Working with Individual Runtimes

```bash
# Workerd (with compatibility date)
node workerd/dump.mjs 2025-01-01

# Bun
bun run bun/dump.js

# Deno
deno run --allow-all deno/dump.js

# Node.js (requires fnm)
fnm exec --using=22 node node/dump.mjs --compare-to-baseline
```

## Project Structure

- `/data/` - Generated JSON dumps (baseline.json, workerd.json, bun.json, deno.json, node-\*.json)
- `/node/`, `/bun/`, `/deno/`, `/workerd/` - Runtime-specific dump scripts
- `/report/` - React app for visualizing compatibility
- `/report/src/data/` - Data files consumed by React app (table-data.json, historical-support.json)
- `dump-utils.mjs` - Shared utilities for traversing and comparing APIs
- `generate-*.mjs` - Scripts for generating various data files
- `scan-apis.mjs` - Orchestrates scanning across all runtimes

## Code Style Guidelines

### Formatting

- Use Prettier with project config (`.prettierrc`)
- Semicolons: required
- Quotes: double quotes
- Print width: 80
- Trailing commas: ES5 style

### Imports

Node built-ins first (with `node:` protocol), then third-party, then local:

```javascript
import fs from "node:fs/promises";
import path from "node:path";

import shell from "shelljs";

import { visit } from "../dump-utils.mjs";
```

### TypeScript (React App)

- Strict mode enabled
- Use `type` for simple types, interfaces for React props
- Use Zod for runtime validation
- JSON imports: `import data from "./file.json" with { type: "json" };`

### Naming Conventions

- Variables/functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- React components: PascalCase
- Files: kebab-case for scripts, PascalCase for React components

### Error Handling

- Use `try/catch` for expected errors
- Use `shell.set("-e")` in shell scripts for fail-fast
- Check for required tools at script start

## Data Flow

1. **Baseline generation**: Merges Node 18/20/22 APIs into `baseline.json`
2. **API scanning**: Dumps APIs from each runtime, comparing to baseline
3. **Table generation**: Creates `table-data.json` from JSON dumps
4. **Historical tracking**: `generate-historical-data.mjs` tracks workerd support over time
5. **React app**: Renders interactive table and trend chart

## Key Constants

- **Support states**: `supported`, `unsupported`, `mismatch` (no stubs counted)
- **Display icons**: ✅ (matching), ❌ (missing), 🩹 (mismatch)
- **Target runtimes**: Order in `generate-table-data.mjs` MUST match `App.tsx`

## Important Notes

- **No unenv/stubs**: Stubs are treated as missing/unsupported, not counted toward support
- **Workerd data only**: The Cloudflare Workers column uses raw workerd data
- **Historical data**: Uses workerd directly with different compatibility dates
- API dumps are committed to git (not gitignored)
- Node v22 features required for generation scripts

## Common Tasks

### Regenerate all data (if you have fnm with Node 18/20/22)

```bash
pnpm run generate
```

### Update only workerd data

```bash
node ./scan-apis.mjs --only workerd
pnpm run generate:table
```

### Update historical chart

```bash
pnpm run generate:historical
```

### Modifying ignored modules

Edit `report/src/ignored-modules.js`, then:

```bash
pnpm run generate:baseline && pnpm run generate:table
```

## CI/CD

GitHub Actions (`.github/workflows/deploy-report.yml`):

- Triggers: push to main, daily at 1:15am, manual dispatch
- Builds and deploys report to Cloudflare Pages
- Does NOT regenerate API dumps (uses committed data)

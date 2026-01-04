import shell from "shelljs";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

shell.set("-e");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supportedEnvironments = ["node", "bun", "deno", "workerd"];

// args check
if (
  !(
    process.argv.length === 2 ||
    (process.argv.length === 4 &&
      process.argv[2] === "--only" &&
      process.argv[3]
        .split(",")
        .every((env) => supportedEnvironments.includes(env)))
  )
) {
  console.error(`
  Error: Incorrect arguments!

  ${process.argv.length} ${process.argv[2]} ${process.argv[3]}

  This script can be called with --only option followed by comma separated list of environments to scan.

  Examples:
    --only workerd
    --only node,workerd

  Supported environments: node, bun, deno, workerd
  `);
  process.exit(1);
}

const regenerateEnvs =
  process.argv.length === 4
    ? process.argv[3].split(",")
    : supportedEnvironments;

if (!shell.env.FNM_DIR) {
  console.error(
    "You must have fnm installed to continue. Refer to README.md for instructions."
  );
  process.exit(1);
}

if (!shell.which("bun")) {
  console.error(
    "You must have bun installed to continue. Refer to README.md for instructions."
  );
  process.exit(1);
}

if (!shell.which("deno")) {
  console.error(
    "You must have deno installed to continue. Refer to README.md for instructions."
  );
  process.exit(1);
}

// shelljs doesn't read from .bashrc or .zshrc which normally inject FNM_DIR
// into your PATH variable, so a lookup is needed.
// Trailing space is intentional, for DX
const fnm = `${shell.env.FNM_DIR}/fnm `;
const versionMap = {};

// Compare node versions to the baseline
if (regenerateEnvs.includes("node")) {
  const nodeVersions = [18, 20, 22];
  for (const version of nodeVersions) {
    shell.echo(`Generate node v${version} apis...`);
    shell.exec(
      fnm + `exec --using=${version} node node/dump.mjs --compare-to-baseline`
    );
    shell.echo("=== Done ====================================\n\n");
    const versionOutput = shell
      .exec(fnm + `exec --using=${version} node --version`, { silent: true })
      .stdout.match(/v(?<version>\S+)/).groups.version;
    versionMap[`node${version}`] = versionOutput;
  }
}

// bun
if (regenerateEnvs.includes("bun")) {
  shell.echo("Generate bun apis...");
  shell.exec("bun run bun/dump.js");
  shell.echo("=== Done ====================================\n\n");
  versionMap["bun"] = shell
    .exec(`bun --version`, { silent: true })
    .stdout.match(/(?<version>\S+)/).groups.version;
}

// deno
if (regenerateEnvs.includes("deno")) {
  shell.echo("Generate deno apis...");
  shell.exec(
    "deno run --allow-write=./data/deno.json --allow-read --allow-env deno/dump.js"
  );
  shell.echo("=== Done ====================================\n\n");
  versionMap["deno"] = shell
    .exec(`deno --version`, { silent: true })
    .stdout.match(/deno (?<version>\S+)/).groups.version;
}

// workerd
if (regenerateEnvs.includes("workerd")) {
  shell.echo(
    'Generate `workerd --compatibility-flags="nodejs_compat"` apis...'
  );
  const compatibilityDate = getWorkerdDate("workerd");
  shell.exec(`node workerd/dump.mjs ${compatibilityDate}`);
  shell.echo("=== Done ====================================\n\n");
  versionMap["workerd"] = extractNpmVersion("workerd", "workerd");
}

await fs.writeFile(
  path.join(__dirname, "report", "src", "data", "versionMap.json"),
  JSON.stringify(versionMap, null, 2)
);

const now = Date.now();
shell
  .echo(JSON.stringify({ timestamp: now }))
  .to("report/src/data/timestamp.json");

/** return YYYY-MM-DD */
function getWorkerdDate(projectName) {
  const version = extractNpmVersion(projectName, "workerd");
  const m = version.match(/(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})/);
  if (m === null) {
    throw new Error(`Invalid version ${version}`);
  }
  return `${m.groups?.year}-${m.groups?.month}-${m.groups?.day}`;
}

function extractNpmVersion(projectName, packageName) {
  return (
    shell
      .exec(`pnpm --dir ./${projectName}/ list ${packageName} --depth=2`, {
        silent: true,
      })
      .stdout.match(`${packageName} (?<version>[\\w.-]+)`)?.groups.version ??
    `${packageName}@???`
  );
}

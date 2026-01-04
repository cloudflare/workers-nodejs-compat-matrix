import shell from "shelljs";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

shell.set("-e");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchAvailableWorkerdVersions() {
  console.log("Fetching available workerd versions from npm...");

  try {
    const result = shell.exec(`npm view workerd versions --json`, {
      silent: true,
    });
    if (result.code !== 0) {
      throw new Error(`Failed to fetch npm versions: ${result.stderr}`);
    }

    const versions = JSON.parse(result.stdout);

    // Filter for 2024+ versions that match the workerd pattern (1.YYYYMMDD.patch)
    const workerdVersions = versions.filter((version) => {
      const match = version.match(/^1\.(\d{4})(\d{2})(\d{2})\.\d+$/);
      if (!match) return false;

      const year = parseInt(match[1]);
      return year >= 2024;
    });

    console.log(`Found ${workerdVersions.length} workerd versions from 2024+`);
    return workerdVersions;
  } catch (error) {
    console.error(
      "Failed to fetch npm versions, falling back to GitHub releases"
    );
    return await fetchWorkerdReleasesFromGitHub();
  }
}

async function fetchWorkerdReleasesFromGitHub() {
  console.log("Fetching workerd release history from GitHub...");

  const releases = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `https://api.github.com/repos/cloudflare/workerd/releases?page=${page}&per_page=${perPage}`
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const pageReleases = await response.json();

    if (pageReleases.length === 0) {
      break;
    }

    releases.push(...pageReleases);
    page++;

    // Stop when we reach 2023 releases
    if (
      pageReleases.some(
        (release) => new Date(release.published_at).getFullYear() < 2024
      )
    ) {
      break;
    }
  }

  return releases
    .filter((release) => new Date(release.published_at).getFullYear() >= 2024)
    .map((release) => release.tag_name);
}

function selectMonthlySnapshots(versions) {
  const monthlyReleases = new Map();

  for (const version of versions) {
    // Extract date from version string (1.YYYYMMDD.patch)
    const match = version.match(/^1\.(\d{4})(\d{2})(\d{2})\.\d+$/);
    if (!match) continue;

    const [, year, month, day] = match;
    const monthKey = `${year}-${month}`;
    const versionDate = new Date(`${year}-${month}-${day}`);

    // Take the first version of each month, or the earliest if multiple exist
    if (
      !monthlyReleases.has(monthKey) ||
      versionDate < new Date(monthlyReleases.get(monthKey).versionDate)
    ) {
      monthlyReleases.set(monthKey, {
        date: monthKey,
        version: version,
        versionDate: `${year}-${month}-${day}`,
        publishedAt: versionDate.toISOString(),
      });
    }
  }

  return Array.from(monthlyReleases.values()).sort(
    (a, b) => new Date(a.versionDate) - new Date(b.versionDate)
  ); // oldest first
}

function getCompatibilityDateForVersion(version) {
  // Extract date from version string (format: 1.YYYYMMDD.patch)
  const match = version.match(/^1\.(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    return "2024-01-01"; // fallback
  }

  const [, year, month, day] = match;
  // Use the version date itself as the compatibility date
  // This ensures the workerd binary supports this date
  return `${year}-${month}-${day}`;
}

async function findMaxSupportedCompatibilityDate(workerdVersion) {
  // Try the version's own date first
  const versionDate = getCompatibilityDateForVersion(workerdVersion);

  try {
    // Test if workerd supports this compatibility date
    console.log(`Testing compatibility date: ${versionDate}`);
    const testResult = shell.exec(`node workerd/dump.mjs ${versionDate}`, {
      silent: true,
    });
    console.log(`Test result code: ${testResult.code}`);
    if (testResult.stderr)
      console.log(`Test stderr: ${testResult.stderr.substring(0, 200)}...`);

    if (testResult.code === 0) {
      console.log(`✓ Using compatibility date: ${versionDate}`);
      return versionDate;
    }
  } catch (error) {
    console.log(`Error testing version date: ${error.message}`);
  }

  // If the version date doesn't work, try progressively earlier dates
  const versionMatch = workerdVersion.match(/^1\.(\d{4})(\d{2})(\d{2})/);
  if (!versionMatch) {
    return "2024-01-01";
  }

  const [, year, month, day] = versionMatch;
  const versionDateObj = new Date(`${year}-${month}-${day}`);

  // Try dates going backwards from the version date
  for (let daysBack = 0; daysBack <= 30; daysBack++) {
    const testDate = new Date(versionDateObj);
    testDate.setDate(testDate.getDate() - daysBack);

    const compatDate = testDate.toISOString().split("T")[0];

    try {
      console.log(`  Trying fallback date: ${compatDate}`);
      const testResult = shell.exec(`node workerd/dump.mjs ${compatDate}`, {
        silent: true,
      });
      if (testResult.code === 0) {
        console.log(`✓ Found working compatibility date: ${compatDate}`);
        return compatDate;
      }
    } catch (error) {
      console.log(`  Failed: ${error.message}`);
      continue;
    }
  }

  // Final fallback - use a very early 2024 date
  return "2024-01-01";
}

async function calculateSupportPercentage() {
  // Read the generated workerd data
  const workerdData = JSON.parse(
    await fs.readFile(path.join(__dirname, "data", "workerd.json"), "utf8")
  );

  const baseline = JSON.parse(
    await fs.readFile(path.join(__dirname, "data", "baseline.json"), "utf8")
  );

  // Use the same logic as generate-table-data.mjs
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

  const isPartOfMockModule = (target, keyPath) => {
    const moduleName = keyPath[0];
    const moduleInfo = target[moduleName];

    // mock module can be identified as a module that has only one key - the default,
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

      if (isObject(childNode)) {
        // render an aggregate of children, plus the children
        const [children, count] = visit(childNode, keyPath);
        leafTotal += count;
        rows.push(...children);
      } else {
        // render a leaf node
        const targetValue = get(workerdData, keyPath);
        let supportStatus;

        if (isPartOfMockModule(workerdData, keyPath)) {
          supportStatus = "unsupported";
        } else if (targetValue === "missing" && childNode !== "missing") {
          supportStatus = "unsupported";
        } else if (targetValue && targetValue !== childNode) {
          // Don't detect mismatches between functions and classes
          if (
            (targetValue === "function" && childNode === "class") ||
            (childNode === "function" && targetValue === "class")
          ) {
            supportStatus = "supported";
          } else {
            supportStatus = "mismatch";
          }
        } else if (targetValue) {
          supportStatus = "supported";
        } else {
          supportStatus = "unsupported";
        }

        rows.push(supportStatus);
        leafTotal += 1;
      }
    }

    return [rows, leafTotal];
  };

  const [rows, totalApis] = visit(baseline, []);

  // Count supported APIs (supported + mismatch count as "present")
  let supportedApis = 0;
  for (const status of rows) {
    if (status === "supported" || status === "mismatch") {
      supportedApis += 1;
    }
  }

  const supportPercentage = (supportedApis / totalApis) * 100;

  return {
    totalApis,
    supportedApis,
    supportPercentage: Math.round(supportPercentage * 10) / 10,
  };
}

async function collectHistoricalData(monthlySnapshots) {
  const historicalData = [];
  const originalPackageJson = await fs.readFile(
    path.join(__dirname, "workerd", "package.json"),
    "utf8"
  );

  console.log(
    `Collecting data for ${monthlySnapshots.length} monthly snapshots...`
  );

  for (const [index, snapshot] of monthlySnapshots.entries()) {
    console.log(
      `\n[${index + 1}/${monthlySnapshots.length}] Processing ${snapshot.date} (${snapshot.version})`
    );

    try {
      // Version is already verified to exist in npm since we fetched from npm

      // Update workerd package.json to use specific version
      const packageJson = JSON.parse(originalPackageJson);
      packageJson.devDependencies.workerd = snapshot.version;

      await fs.writeFile(
        path.join(__dirname, "workerd", "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      // Install the specific workerd version
      console.log(`Installing workerd ${snapshot.version}...`);
      const installResult = shell.exec("pnpm install --dir ./workerd/", {
        silent: false,
      });
      if (installResult.code !== 0) {
        console.error(`Installation failed with code ${installResult.code}`);
        console.error(`stdout: ${installResult.stdout}`);
        console.error(`stderr: ${installResult.stderr}`);
        throw new Error(`Failed to install workerd ${snapshot.version}`);
      }

      // Verify workerd binary exists and is accessible
      const workerdPathResult = shell.exec(
        "pnpm --dir ./workerd/ bin workerd",
        { silent: true }
      );
      console.log(
        `Workerd binary path result: ${workerdPathResult.stdout.trim()}`
      );

      if (workerdPathResult.code !== 0) {
        console.log(`Error getting workerd path: ${workerdPathResult.stderr}`);
        throw new Error(`Failed to locate workerd binary`);
      }

      const workerdBinaryPath = workerdPathResult.stdout.trim();
      console.log(`Checking if workerd binary exists at: ${workerdBinaryPath}`);

      if (!shell.test("-f", workerdBinaryPath)) {
        console.log(
          `Binary not found at ${workerdBinaryPath}, trying direct approach...`
        );
        // Try to find workerd binary directly
        const directPath = path.join(
          __dirname,
          "workerd",
          "node_modules",
          ".bin",
          "workerd"
        );
        if (shell.test("-f", directPath)) {
          console.log(`Found workerd at: ${directPath}`);
        } else {
          throw new Error(`Workerd binary not found at expected locations`);
        }
      }

      // Find the maximum supported compatibility date for this workerd version
      console.log("Finding supported compatibility date...");
      const compatDate = await findMaxSupportedCompatibilityDate(
        snapshot.version
      );
      console.log(`Scanning APIs with compatibility date ${compatDate}...`);

      // Run API scanning without timeout for now (macOS doesn't have timeout by default)
      console.log(`Running: node workerd/dump.mjs ${compatDate}`);
      const result = shell.exec(`node workerd/dump.mjs ${compatDate}`, {
        silent: false,
      });
      console.log(`API scan exit code: ${result.code}`);
      if (result.stdout)
        console.log(`stdout: ${result.stdout.substring(0, 200)}...`);
      if (result.stderr)
        console.log(`stderr: ${result.stderr.substring(0, 200)}...`);

      if (result.code !== 0) {
        console.log(
          `⚠️  Failed to scan APIs for ${snapshot.version} - SKIPPING`
        );
        continue; // Skip this version instead of failing entirely
      }
      console.log("✓ API scanning completed");

      // Calculate support percentage
      let supportData;
      try {
        supportData = await calculateSupportPercentage();
      } catch (error) {
        console.error(
          `Failed to calculate support percentage: ${error.message}`
        );
        continue;
      }
      const { totalApis, supportedApis, supportPercentage } = supportData;

      historicalData.push({
        date: snapshot.date,
        workerdVersion: snapshot.version,
        supportPercentage,
        totalApis,
        supportedApis,
        publishedAt: snapshot.publishedAt,
      });

      console.log(
        `${snapshot.date}: ${supportPercentage}% (${supportedApis}/${totalApis})`
      );
    } catch (error) {
      console.error(`Error processing ${snapshot.date}:`, error.message);
      // Continue with next version
    }
  }

  // Restore original package.json
  await fs.writeFile(
    path.join(__dirname, "workerd", "package.json"),
    originalPackageJson
  );

  // Reinstall current version
  console.log("\nRestoring current workerd version...");
  shell.exec("pnpm install --dir ./workerd/", { silent: true });

  return historicalData;
}

async function main() {
  try {
    console.log(
      "Starting historical data collection for workerd Node.js API support...\n"
    );

    // Fetch available versions from npm
    const availableVersions = await fetchAvailableWorkerdVersions();
    console.log(
      `Found ${availableVersions.length} versions available in npm since 2024`
    );

    // Select monthly snapshots
    const monthlySnapshots = selectMonthlySnapshots(availableVersions);
    console.log(`Selected ${monthlySnapshots.length} monthly snapshots`);

    // Collect historical data
    const historicalData = await collectHistoricalData(monthlySnapshots);

    // Save results
    await fs.writeFile(
      path.join(__dirname, "report", "src", "data", "historical-support.json"),
      JSON.stringify(historicalData, null, 2)
    );

    console.log(`\n✅ Historical data collection complete!`);
    console.log(`📊 Collected ${historicalData.length} data points`);
    console.log(
      `📈 Support improved from ${historicalData[0]?.supportPercentage}% to ${historicalData[historicalData.length - 1]?.supportPercentage}%`
    );
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();

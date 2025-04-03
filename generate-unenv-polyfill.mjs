import fs from "node:fs/promises";
import path from "node:path";
import baseline from "./data/baseline.json" with { type: "json" };

const args = process.argv.slice(2);

const workerdSupportedModules = [
  "_stream_duplex",
	"_stream_passthrough",
	"_stream_readable",
	"_stream_transform",
	"_stream_writable",
	"assert",
	"assert/strict",
	"buffer",
	"diagnostics_channel",
	"dns",
	"dns/promises",
	"events",
	"net",
	"path",
	"path/posix",
	"path/win32",
	"querystring",
	"stream",
	"stream/consumers",
	"stream/promises",
	"stream/web",
	"string_decoder",
	"timers",
	"timers/promises",
	"url",
	"util",
	"util/types",
	"zlib",
];

if (args.length < 1) {
  console.log("ERROR: Must specify a module to generate a polyfill for");
  process.exit(1);
}

const moduleName = args[0];
const dest = args[1];

if (workerdSupportedModules.includes(moduleName)) {
  console.log(
    `STOP!!!! ${moduleName} is already supported by workerd, don't create a polyfill for this.`
  );
  process.exit(1);
}

if (!dest.includes("src/unenv/src/runtime/node")) {
  console.log(dest);
  console.log("WARNING: Double check filename.");
  process.exit(1);
}

const moduleInfo = baseline[moduleName];

const escapeIdentifier = (identifier) => identifier.replace("/", "_");

const exports = Object.keys(moduleInfo)
  .sort()
  .filter((key) => !["*self*", "default"].includes(key));

const encountered = {
  function: false,
  class: false,
  object: false,
};

const generateCode = (symbolName) => {
  let type = baseline[moduleName][symbolName];
  if (typeof type === "object") {
    type = "object";
  }

  const fullName = `${escapeIdentifier(moduleName)}.${symbolName}`;
  switch (type) {
    case "function":
      encountered.function = true;
      return `export const ${symbolName}: typeof ${fullName} = noop;\n`;
    case "string":
      return `export const ${symbolName}: typeof ${fullName} = "";\n`;
    case "number":
      return `export const ${symbolName}: typeof ${fullName} = 0;\n`;
    case "class":
      encountered.class = true;
      return `export const ${symbolName}: typeof ${fullName} =  mock.__createMock__("${fullName}");\n`;
    case "object":
      encountered.object = true;
      return `export const ${symbolName}: typeof ${fullName} =  mock.__createMock__("${fullName}");\n`;
    default:
      return `// export const ${symbolName}: typeof ${fullName} = TODO: implement\n`;
  }
};

const generateImports = () => {
  let mockImports = [];

  if (encountered.function) {
    mockImports.push(`import noop from "../../mock/noop";`);
  }
  if (encountered.object || encountered.class) {
    mockImports.push(`import mock from "../../mock/proxy";`);
  }

  return `
${mockImports.join("\n")}
import type ${escapeIdentifier(moduleName)} from "node:${moduleName}";
  `.trim();
};

let body = ``;

for (const symbol of exports) {
  body += generateCode(symbol);
}

body += `
export default <typeof ${escapeIdentifier(moduleName)}>{
  ${exports.join(",\n")}
}
`;

const code = `
${generateImports()}

${body}
`;

if (dest) {
  await fs.writeFile(path.resolve(dest), code);
} else {
  console.log(code);
}

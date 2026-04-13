import { visit } from "./dump-utils.mjs";

export default {
  async fetch(request, env, ctx) {
    const workerdGlobals = {};
    const importedModules = {};

    for (const name of Object.keys(env.baseline)) {
      if (name === "*globals*") {
        for (const globalProp of Object.keys(env.baseline["*globals*"])) {
          if (globalProp in globalThis) {
            workerdGlobals[globalProp] = globalThis[globalProp];
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

    const result = visit(env.baseline, {
      "*globals*": workerdGlobals,
      ...importedModules,
    });

    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

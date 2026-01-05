export const sortFn = (a, b) => {
  if (a === "*self*") return -2;
  if (a === "default") return -1;
  return a < b ? -1 : 1;
};

export function visit(traversalNode, targetNode = traversalNode, depth = 0) {
  // create a unique object to mark keys that errored during inspection
  const INSPECTION_ERROR = {};

  const props = collectObjectProps(traversalNode);
  const entries = [];

  for (const prop of props) {
    let value;
    try {
      value = traversalNode[prop];
    } catch (e) {
      value = INSPECTION_ERROR;
    }
    entries.push([prop, value]);
  }

  entries.sort(([a], [b]) => (a === "default" ? -1 : a < b ? -1 : 1));

  const visitResult = {};
  for (const [key, traversalValue] of entries) {
    // If targetNode doesn't exist OR
    // a key doesn't exist on the target node AND it's undefined, we mark it as missing.
    // For stubs, the key will not exist in the targetNode (since targetNode) but the value
    // will be `function`, since it's a proxy.
    let targetValue;

    if (key === "*self*") {
      // skip synthetic *self* nodes as they'll be set later when we recursively call `visit`
      // initialize the key with a temporary value so that we don't *self* naturally sorts at the top
      visitResult[key] = "<TODO>";
      continue;
    }

    if (
      targetNode == null ||
      (!(key in targetNode) && typeof targetNode[key] === "undefined")
    ) {
      targetValue = "missing";
    } else {
      try {
        targetValue = targetNode[key];
      } catch {
        targetValue = INSPECTION_ERROR;
      }
    }

    if (targetValue === INSPECTION_ERROR) {
      visitResult[key] = "<INSPECTION ERROR>";
      continue;
    }

    const isObject =
      typeof traversalValue === "object" &&
      traversalValue !== null &&
      !Array.isArray(traversalValue);

    if (isObject || key === "default") {
      // don't worry drilling into exported objects beyond listing its top properties
      if (depth === 3) {
        visitResult[key] = "object";
      } else {
        const partialResult = visit(
          traversalValue,
          targetValue === "missing" ? {} : targetValue || {},
          depth + 1
        );

        partialResult["*self*"] =
          targetValue === null
            ? "null"
            : targetValue === "missing"
              ? "missing"
              : typeof targetValue;

        visitResult[key] = partialResult;
      }
    } else {
      // Detect unenv stubs - treat as missing (not implemented)
      if (targetValue && targetValue.__unenv__ === true) {
        visitResult[key] = "missing";
        continue;
      }

      if (typeof targetValue === "function") {
        const code = targetValue.toString();

        // Detect unimplemented stubs - treat as missing
        if (
          // deno https://github.com/denoland/deno/blob/8eb1f11112c3ced0ff4a35f3487a4da507db05c2/ext/node/polyfills/_utils.ts#L25
          code.includes("notImplemented(")
        ) {
          visitResult[key] = "missing";
          continue;
        }
      }

      if (targetValue === "missing") {
        visitResult[key] = "missing";
      } else if (targetValue === null) {
        visitResult[key] = "null";
      } else if (isClass(targetValue)) {
        visitResult[key] = "class";
      } else {
        visitResult[key] = typeof targetValue;
      }
    }
  }

  return Object.keys(visitResult)
    .sort(sortFn)
    .reduce((acc, key) => ({ ...acc, [key]: visitResult[key] }), {});
}

const isClass = (node) =>
  typeof node === "function" && /^\s*class\s+/.test(node.toString());

export const objectSort = (obj) => {
  return Object.keys(obj)
    .sort(sortFn)
    .reduce(
      (acc, key) => ({
        ...acc,
        [key]: typeof obj[key] === "object" ? objectSort(obj[key]) : obj[key],
      }),
      {}
    );
};

/**
 * Collects all properties of an object including inherited ones and non-enumerable ones.
 * This is done by combining all property descriptors of the object and its prototypes.
 */
export function collectObjectProps(obj, props = []) {
  props = [...Object.keys(Object.getOwnPropertyDescriptors(obj)), ...props];

  const proto = Object.getPrototypeOf(obj);

  return proto !== null &&
    proto !== Function.prototype &&
    proto !== Object.prototype
    ? collectObjectProps(proto, props)
    : props.sort();
}

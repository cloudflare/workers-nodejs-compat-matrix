export const sortFn = (a, b) => {
  if (a === "*self*") return -2;
  if (a === "default") return -1;
  return a < b ? -1 : 1;
};

export function visit(traversalNode, targetNode = traversalNode, options = {}) {
  return visitNode(traversalNode, targetNode, 0, [], options);
}

function visitNode(traversalNode, targetNode, depth, path, options) {
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
        const partialResult = visitNode(
          traversalValue,
          targetValue === "missing" ? {} : targetValue || {},
          depth + 1,
          [...path, key],
          options
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
      if (isStubValue(targetValue, [...path, key], options)) {
        visitResult[key] = "missing";
        continue;
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

function isStubValue(targetValue, keyPath, options) {
  // Detect unenv stubs.
  if (targetValue && targetValue.__unenv__ === true) {
    return true;
  }

  if (typeof targetValue === "function") {
    let code = "";
    try {
      code = targetValue.toString();
    } catch {}

    if (isStubFunctionSource(code)) {
      return true;
    }
  }

  return options.detectWorkerdStubs === true &&
    typeof targetValue === "function"
    ? isWorkerdStubValue(targetValue, keyPath)
    : false;
}

function isStubFunctionSource(code) {
  const source = stripJsComments(code);

  // deno https://github.com/denoland/deno/blob/8eb1f11112c3ced0ff4a35f3487a4da507db05c2/ext/node/polyfills/_utils.ts#L25
  if (source.includes("notImplemented(")) {
    return true;
  }

  const hasNotImplementedThrow =
    /throw\s+new\s+ERR_METHOD_NOT_IMPLEMENTED\b/.test(source) ||
    /throw\s+new\s+\w*Error\s*\([\s\S]*?not implemented/i.test(source);

  // Avoid false positives for functions that have a not-implemented fallback
  // branch but return a real implementation when the relevant compat flag is on.
  return hasNotImplementedThrow && !/\breturn\b/.test(source);
}

function stripJsComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function isWorkerdStubValue(targetValue, keyPath) {
  const pathParts = keyPath
    .filter((part) => part !== "default")
    .map((part, index) => (index === 0 ? part.replace(/^node:/, "") : part));
  const normalizedPath = pathParts.join(".");
  const tailPath = pathParts.slice(-2).join(".");

  if (
    WORKERD_CALL_STUB_PROBES.has(normalizedPath) ||
    WORKERD_CALL_STUB_PROBES.has(tailPath)
  ) {
    return throwsWorkerdStubError(() => targetValue());
  }

  if (
    WORKERD_CONSTRUCTOR_STUB_PROBES.has(normalizedPath) ||
    WORKERD_CONSTRUCTOR_STUB_PROBES.has(tailPath)
  ) {
    return throwsWorkerdStubError(() => new targetValue());
  }

  const behaviorProbe =
    WORKERD_BEHAVIOR_STUB_PROBES[normalizedPath] ||
    WORKERD_BEHAVIOR_STUB_PROBES[tailPath];
  return behaviorProbe ? behaviorProbe(targetValue) : false;
}

const WORKERD_CALL_STUB_PROBES = new Set([
  "console.Console",
  "console.context",
  "console.createTask",
  "perf_hooks.createHistogram",
  "perf_hooks.monitorEventLoopDelay",
  "sqlite.backup",
  "timers.enroll",
]);

const WORKERD_CONSTRUCTOR_STUB_PROBES = new Set([
  "sqlite.DatabaseSync",
  "sqlite.Session",
  "sqlite.StatementSync",
]);

const WORKERD_BEHAVIOR_STUB_PROBES = {
  "async_hooks.createHook": isCreateHookStub,
  "async_hooks.executionAsyncId": isZeroReturnStub,
  "async_hooks.triggerAsyncId": isZeroReturnStub,
  "async_hooks.executionAsyncResource": isEmptyObjectStub,
  "dgram.Socket": isDgramSocketConstructorStub,
  "dgram.createSocket": isDgramCreateSocketStub,
  "perf_hooks.eventLoopUtilization": isEventLoopUtilizationStub,
  "perf_hooks.timerify": isTimerifyStub,
  "trace_events.createTracing": isTraceEventsCreateTracingStub,
  "trace_events.getEnabledCategories": isUndefinedReturnStub,
};

function throwsWorkerdStubError(fn) {
  try {
    fn();
    return false;
  } catch (error) {
    return isWorkerdStubError(error);
  }
}

function isWorkerdStubError(error) {
  return (
    error?.code === "ERR_METHOD_NOT_IMPLEMENTED" ||
    /\b(not implemented|not yet implemented|illegal constructor)\b/i.test(
      error?.message ?? ""
    )
  );
}

function isCreateHookStub(createHook) {
  try {
    const hook = createHook({});
    return (
      hook &&
      typeof hook.enable === "function" &&
      typeof hook.disable === "function" &&
      hook.enable() === hook &&
      hook.disable() === hook
    );
  } catch {
    return false;
  }
}

function isZeroReturnStub(fn) {
  try {
    return fn() === 0;
  } catch {
    return false;
  }
}

function isEmptyObjectStub(fn) {
  try {
    const result = fn();
    return (
      result != null &&
      typeof result === "object" &&
      Object.getPrototypeOf(result) === null &&
      Object.keys(result).length === 0
    );
  } catch {
    return false;
  }
}

function isUndefinedReturnStub(fn) {
  try {
    return /\{\s*return\s+undefined;?\s*\}$/s.test(
      stripJsComments(fn.toString())
    );
  } catch {
    return false;
  }
}

function isDgramCreateSocketStub(createSocket) {
  try {
    return isDgramSocketInstanceStub(createSocket("udp4"));
  } catch {
    return false;
  }
}

function isDgramSocketConstructorStub(Socket) {
  try {
    return isDgramSocketInstanceStub(new Socket("udp4"));
  } catch {
    try {
      return isDgramSocketInstanceStub(Socket("udp4"));
    } catch {
      return false;
    }
  }
}

function isDgramSocketInstanceStub(socket) {
  return ["connect", "disconnect", "send"].every((method) => {
    const value = socket?.[method];
    return typeof value === "function" && /\bno-op\b/i.test(value.toString());
  });
}

function isTraceEventsCreateTracingStub(createTracing) {
  try {
    const tracing = createTracing({ categories: ["node"] });
    return ["enable", "disable"].every((method) => {
      const value = tracing?.[method];
      return (
        typeof value === "function" && /\bnon-op\b/i.test(value.toString())
      );
    });
  } catch {
    return false;
  }
}

function isEventLoopUtilizationStub(fn) {
  try {
    const result = fn();
    return (
      result?.idle === 0 && result?.active === 0 && result?.utilization === 0
    );
  } catch {
    return false;
  }
}

function isTimerifyStub(fn) {
  try {
    const input = () => {};
    return fn(input) === input;
  } catch {
    return false;
  }
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

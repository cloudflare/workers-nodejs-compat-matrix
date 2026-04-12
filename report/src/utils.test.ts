import { getPolyfillSearchLink, getDocsLink, pct, formatPct } from "./utils";

describe("getPolyfillSearchLink", () => {
  it("returns correct URL for node20 target", () => {
    const result = getPolyfillSearchLink("node20", "fs");
    expect(result).toContain("github.com/search");
    expect(result).toContain("repo:nodejs/node");
    expect(result).toContain("fs");
  });

  it("returns correct URL for node22 target", () => {
    const result = getPolyfillSearchLink("node22", "path");
    expect(result).toContain("repo:nodejs/node");
    expect(result).toContain("path");
  });

  it("returns correct URL for node24 target", () => {
    const result = getPolyfillSearchLink("node24", "http");
    expect(result).toContain("repo:nodejs/node");
    expect(result).toContain("http");
  });

  it("returns correct URL for bun target", () => {
    const result = getPolyfillSearchLink("bun", "crypto");
    expect(result).toContain("repo:oven-sh/bun");
    expect(result).toContain("crypto");
  });

  it("returns correct URL for deno target", () => {
    const result = getPolyfillSearchLink("deno", "url");
    expect(result).toContain("repo:denoland/deno");
    expect(result).toContain("url");
  });

  it("returns correct URL for workerd target", () => {
    const result = getPolyfillSearchLink("workerd", "buffer");
    expect(result).toContain("repo:cloudflare/workerd");
    expect(result).toContain("buffer");
  });

  it("returns encoded URL for special characters", () => {
    const result = getPolyfillSearchLink("workerd", "createReadStream");
    expect(result).not.toContain(" ");
  });

  it("returns base URL for unknown target", () => {
    const result = getPolyfillSearchLink("unknown", "fs");
    expect(result).toContain("github.com/search");
  });
});

describe("getDocsLink", () => {
  it("returns correct URL for simple module", () => {
    const result = getDocsLink("fs");
    expect(result).toBe("https://nodejs.org/docs/latest/api/fs.html");
  });

  it("removes trailing sub-paths", () => {
    const result = getDocsLink("fs/promises");
    expect(result).toBe("https://nodejs.org/docs/latest/api/fs.html");
  });

  it("replaces trace_events with tracing", () => {
    const result = getDocsLink("trace_events");
    expect(result).toBe("https://nodejs.org/docs/latest/api/tracing.html");
  });

  it("replaces constants with all", () => {
    const result = getDocsLink("constants");
    expect(result).toBe("https://nodejs.org/docs/latest/api/all.html");
  });

  it("replaces sys with util", () => {
    const result = getDocsLink("sys");
    expect(result).toBe("https://nodejs.org/docs/latest/api/util.html");
  });

  it("removes asterisks from path", () => {
    const result = getDocsLink("fs*");
    expect(result).toBe("https://nodejs.org/docs/latest/api/fs.html");
  });

  it("handles nested paths with trailing segment", () => {
    const result = getDocsLink("path/win32");
    expect(result).toBe("https://nodejs.org/docs/latest/api/path.html");
  });
});

describe("pct", () => {
  it("calculates percentage correctly", () => {
    expect(pct(50, 100)).toBe(50);
  });

  it("calculates zero correctly", () => {
    expect(pct(0, 100)).toBe(0);
  });

  it("calculates full percentage correctly", () => {
    expect(pct(100, 100)).toBe(100);
  });

  it("handles fractional results", () => {
    expect(pct(1, 3)).toBeCloseTo(33.333, 3);
  });
});

describe("formatPct", () => {
  it("formats zero without decimal places", () => {
    expect(formatPct(0)).toBe("0%");
  });

  it("formats 100 without decimal places", () => {
    expect(formatPct(100)).toBe("100%");
  });

  it("formats values between 0 and 100 with 1 decimal place", () => {
    expect(formatPct(50)).toBe("50.0%");
  });

  it("formats fractional values correctly", () => {
    expect(formatPct(33.333)).toBe("33.3%");
  });

  it("rounds values correctly", () => {
    expect(formatPct(66.666)).toBe("66.7%");
  });
});

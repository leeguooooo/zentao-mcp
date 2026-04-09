import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { decodeEscapedNewlines, extractCommand, parseCliArgs } from "../src/cli/args.js";
import { printRootHelp } from "../src/cli/help.js";
import { createClientFromCli, ZentaoClient } from "../src/zentao/client.js";
import { listProducts } from "../src/zentao/products.js";
import { getConfigPath, loadConfig, saveConfig } from "../src/config/store.js";
import { formatProductsSimple } from "../src/commands/products.js";
import { formatBugsMineSimple, formatBugsSimple, formatStatsSimple } from "../src/commands/bugs.js";
import { bugsStats } from "../src/zentao/bugs.js";
import { formatBugSimple } from "../src/commands/bug.js";
import { readFileSync } from "node:fs";

test("extractCommand skips flag values", () => {
  const argv = [
    "--zentao-url",
    "https://example.com/zentao",
    "products",
    "list",
    "--page",
    "2",
  ];

  const first = extractCommand(argv);
  assert.equal(first.command, "products");
  assert.equal(first.argv.includes("products"), false);
  assert.equal(first.argv.includes("https://example.com/zentao"), true);

  const second = extractCommand(first.argv);
  assert.equal(second.command, "list");
  assert.equal(second.argv.includes("list"), false);
  assert.equal(second.argv.includes("2"), true);
});

test("parseCliArgs supports --flag value and --flag=value", () => {
  const args = parseCliArgs([
    "--zentao-url",
    "https://example.com/zentao",
    "--page=2",
    "--include-details",
  ]);

  assert.equal(args["zentao-url"], "https://example.com/zentao");
  assert.equal(args.page, "2");
  assert.equal(args["include-details"], true);
});

test("decodeEscapedNewlines converts escaped newlines into real line breaks", () => {
  assert.equal(decodeEscapedNewlines("line1\\n\\nline2"), "line1\n\nline2");
  assert.equal(decodeEscapedNewlines("line1\\r\\nline2"), "line1\nline2");
  assert.equal(decodeEscapedNewlines("plain text"), "plain text");
});

test("createClientFromCli throws on missing auth", () => {
  const env = { XDG_CONFIG_HOME: `/tmp/zentao-cli-test-empty-${process.pid}` };
  assert.throws(
    () => createClientFromCli({ argv: [], env }),
    /Missing ZENTAO_URL/
  );
});

test("config store save/load roundtrip", () => {
  const env = { XDG_CONFIG_HOME: "/tmp/zentao-cli-test" };
  const filePath = getConfigPath({ env });
  saveConfig({ zentaoUrl: "u", zentaoAccount: "a", zentaoPassword: "p" }, { env });
  const loaded = loadConfig({ env });
  assert.equal(loaded.zentaoUrl, "u");
  assert.equal(filePath.includes("zentao/config.toml"), true);
});

test("ZentaoClient listProducts uses token then GET products", async () => {
  const calls = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });

    if (String(url).endsWith("/api.php/v1/tokens")) {
      return {
        text: async () => JSON.stringify({ token: "t_abc" }),
      };
    }

    if (String(url).includes("/api.php/v1/products")) {
      return {
        text: async () =>
          JSON.stringify({
            products: [{ id: 1, name: "P1" }],
            total: 1,
            limit: 1000,
          }),
      };
    }

    return {
      text: async () => JSON.stringify({ error: "unexpected" }),
    };
  };

  try {
    const client = new ZentaoClient({
      baseUrl: "https://example.com/zentao",
      account: "leo",
      password: "pw",
    });

    const result = await listProducts(client, { page: 1, limit: 1000 });
    assert.equal(result.status, 1);
    assert.equal(result.result?.products?.[0]?.name, "P1");

    assert.equal(calls.length, 2);
    assert.ok(calls[0].url.endsWith("/api.php/v1/tokens"));
    assert.ok(calls[1].url.includes("/api.php/v1/products"));
    assert.equal(calls[1].options?.headers?.Token, "t_abc");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("formatProductsSimple prints TSV", () => {
  const out = formatProductsSimple([
    { id: 1, name: "P1", totalBugs: 10, status: "normal" },
    { id: 2, name: "P2", totalBugs: 0, productStatus: "closed" },
  ]);
  assert.ok(out.includes("id\tname\ttotalBugs\tstatus"));
  assert.ok(out.includes("1\tP1\t10\tnormal"));
  assert.ok(out.includes("2\tP2\t0\tclosed"));
});

test("formatBugsSimple prints TSV", () => {
  const out = formatBugsSimple([
    { id: 1, title: "T1", status: "active", pri: 2, severity: 3, assignedTo: { account: "leo" } },
  ]);
  assert.ok(out.includes("id\ttitle\tstatus\tpri\tseverity\tassignedTo"));
  assert.ok(out.includes("1\tT1\tactive\t2\t3\tleo"));
});

test("formatBugSimple prints one-row TSV", () => {
  const out = formatBugSimple({
    id: 9,
    title: "Hello",
    status: "resolved",
    pri: 3,
    severity: 2,
    assignedTo: { account: "a" },
    openedBy: { account: "b" },
    resolvedBy: { account: "c" },
  });
  assert.ok(out.includes("id\ttitle\tstatus\tpri\tseverity\tassignedTo\topenedBy\tresolvedBy"));
  assert.ok(out.includes("9\tHello\tresolved\t3\t2\ta\tb\tc"));
});

test("formatBugsMineSimple prints summary", () => {
  const out = formatBugsMineSimple({
    total: 2,
    products: [{ id: 1, name: "P1", myBugs: 2, totalBugs: 10 }],
    bugs: [],
  });
  assert.ok(out.includes("total\t2"));
  assert.ok(out.includes("1\tP1\t2\t10"));
});

test("formatStatsSimple prints product rates", () => {
  const out = formatStatsSimple({
    groupBy: "product",
    hasTimeFilter: false,
    from: null,
    to: null,
    totalBugs: 150,
    totalResolved: 120,
    totalClosed: 110,
    totalFixed: 100,
    totalActive: 30,
    closeRate: 110 / 150,
    fixRate: 100 / 130,
    groups: [
      { productId: 3, productName: "ProductA", total: 100, resolved: 85, closed: 78, fixed: 70, active: 15, closeRate: 0.78, fixRate: 0.8 },
      { productId: 5, productName: "ProductB", total: 50, resolved: 35, closed: 32, fixed: 30, active: 15, closeRate: 0.64, fixRate: 0.75 },
    ],
  });
  assert.ok(out.includes("productId\tproductName\ttotal\tresolved\tclosed\tfixed\tactive\tcloseRate\tfixRate"));
  assert.ok(out.includes("3\tProductA\t100\t85\t78\t70\t15\t78.0%\t80.0%"));
  assert.ok(out.includes("closeRate"));
  assert.ok(out.includes("fixRate"));
  assert.ok(!out.includes("period"));
});

test("formatStatsSimple prints product count with time filter", () => {
  const out = formatStatsSimple({
    groupBy: "product",
    hasTimeFilter: true,
    from: "2026-01-01",
    to: "2026-04-09",
    totalBugs: 100,
    totalResolvedInPeriod: 15,
    totalClosedInPeriod: 12,
    totalFixedInPeriod: 10,
    groups: [
      { productId: 3, productName: "ProductA", total: 100, resolvedInPeriod: 15, closedInPeriod: 12, fixedInPeriod: 10 },
    ],
  });
  assert.ok(out.includes("period\t2026-01-01 ~ 2026-04-09"));
  assert.ok(out.includes("resolvedInPeriod\tclosedInPeriod\tfixedInPeriod"));
  assert.ok(out.includes("3\tProductA\t15\t12\t10\t100"));
  assert.ok(out.includes("total\t-\t15\t12\t10\t100"));
});

test("formatStatsSimple prints person rates", () => {
  const out = formatStatsSimple({
    groupBy: "person",
    hasTimeFilter: false,
    from: null,
    to: null,
    totalBugs: 100,
    totalResolved: 70,
    totalClosed: 65,
    totalFixed: 60,
    totalActive: 30,
    closeRate: 0.65,
    fixRate: 0.6,
    groups: [
      { person: "john", resolved: 40, closed: 38, fixed: 35 },
      { person: "alice", resolved: 30, closed: 27, fixed: 25 },
    ],
  });
  assert.ok(out.includes("person\tresolved\tclosed\tfixed"));
  assert.ok(out.includes("john\t40\t38\t35"));
  assert.ok(out.includes("alice\t30\t27\t25"));
  assert.ok(out.includes("(unresolved)\t30\t-\t-"));
  assert.ok(out.includes("closeRate:65.0%"));
  assert.ok(out.includes("fixRate:60.0%"));
});

test("formatStatsSimple prints person count with time filter", () => {
  const out = formatStatsSimple({
    groupBy: "person",
    hasTimeFilter: true,
    from: "2026-03-01",
    to: null,
    totalBugs: 100,
    totalResolvedInPeriod: 25,
    totalClosedInPeriod: 22,
    totalFixedInPeriod: 20,
    totalActive: 30,
    groups: [
      { person: "john", resolved: 15, closed: 13, fixed: 12 },
      { person: "alice", resolved: 10, closed: 9, fixed: 8 },
    ],
  });
  assert.ok(out.includes("period\t2026-03-01"));
  assert.ok(out.includes("person\tresolvedInPeriod\tclosedInPeriod\tfixedInPeriod"));
  assert.ok(out.includes("john\t15\t13\t12"));
  assert.ok(out.includes("total\t25\t22\t20"));
});

function mockFetchForStats(productsPayload, bugsPayload) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/api.php/v1/tokens")) {
      return { text: async () => JSON.stringify({ token: "t_abc" }) };
    }
    if (String(url).includes("/api.php/v1/products")) {
      return { text: async () => JSON.stringify(productsPayload) };
    }
    if (String(url).includes("/api.php/v1/bugs")) {
      const u = new URL(url);
      const productId = Number(u.searchParams.get("product"));
      const payload = typeof bugsPayload === "function" ? bugsPayload(productId) : bugsPayload;
      return { text: async () => JSON.stringify(payload) };
    }
    return { text: async () => JSON.stringify({ error: "unexpected" }) };
  };
  return originalFetch;
}

test("bugsStats groups by product", async () => {
  const originalFetch = mockFetchForStats(
    { products: [{ id: 1, name: "P1", totalBugs: 4 }], total: 1, limit: 1000 },
    { bugs: [
      { id: 101, status: "closed", resolution: "fixed", resolvedBy: { account: "john" }, resolvedDate: "2026-03-15T10:00:00Z" },
      { id: 102, status: "active", resolution: "", resolvedBy: null, resolvedDate: null },
      { id: 103, status: "closed", resolution: "fixed", resolvedBy: { account: "alice" }, resolvedDate: "2026-02-10T10:00:00Z" },
      { id: 104, status: "closed", resolution: "willnotfix", resolvedBy: { account: "bob" }, resolvedDate: "2026-02-15T10:00:00Z" },
    ], total: 4, limit: 100 },
  );
  try {
    const client = new ZentaoClient({ baseUrl: "https://example.com/zentao", account: "leo", password: "pw" });
    const result = await bugsStats(client, { productIds: [1], groupBy: "product" });
    assert.equal(result.status, 1);
    assert.equal(result.result.totalBugs, 4);
    assert.equal(result.result.totalResolved, 3, "resolved = all with non-empty resolution");
    assert.equal(result.result.totalClosed, 3, "closed = status closed");
    assert.equal(result.result.totalFixed, 2, "fixed = closed + fixed only");
    assert.equal(result.result.totalActive, 1);
    assert.ok(result.result.closeRate > 0);
    assert.ok(result.result.fixRate > 0);
    assert.equal(result.result.groups[0].resolved, 3);
    assert.equal(result.result.groups[0].closed, 3);
    assert.equal(result.result.groups[0].fixed, 2);
    assert.equal(result.result.groups[0].active, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bugsStats groups by person", async () => {
  const originalFetch = mockFetchForStats(
    { products: [{ id: 1, name: "P1", totalBugs: 4 }], total: 1, limit: 1000 },
    { bugs: [
      { id: 101, status: "closed", resolution: "fixed", resolvedBy: { account: "john" }, resolvedDate: "2026-03-15T10:00:00Z" },
      { id: 102, status: "closed", resolution: "fixed", resolvedBy: { account: "john" }, resolvedDate: "2026-03-20T10:00:00Z" },
      { id: 103, status: "closed", resolution: "willnotfix", resolvedBy: { account: "alice" }, resolvedDate: "2026-02-10T10:00:00Z" },
      { id: 104, status: "active", resolution: "", resolvedBy: null, resolvedDate: null },
    ], total: 4, limit: 100 },
  );
  try {
    const client = new ZentaoClient({ baseUrl: "https://example.com/zentao", account: "leo", password: "pw" });
    const result = await bugsStats(client, { productIds: [1], groupBy: "person" });
    assert.equal(result.status, 1);
    assert.equal(result.result.totalBugs, 4);
    assert.equal(result.result.totalResolved, 3);
    assert.equal(result.result.totalClosed, 3);
    assert.equal(result.result.totalFixed, 2);
    assert.equal(result.result.totalActive, 1);
    assert.ok(result.result.closeRate > 0);
    assert.ok(result.result.fixRate > 0);
    assert.equal(result.result.groups.length, 2);
    assert.equal(result.result.groups[0].person, "john");
    assert.equal(result.result.groups[0].resolved, 2);
    assert.equal(result.result.groups[0].closed, 2);
    assert.equal(result.result.groups[0].fixed, 2);
    assert.equal(result.result.groups[1].person, "alice");
    assert.equal(result.result.groups[1].resolved, 1);
    assert.equal(result.result.groups[1].closed, 1);
    assert.equal(result.result.groups[1].fixed, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bugsStats filters by time range", async () => {
  const originalFetch = mockFetchForStats(
    { products: [{ id: 1, name: "P1", totalBugs: 3 }], total: 1, limit: 1000 },
    { bugs: [
      { id: 101, status: "closed", resolution: "fixed", resolvedBy: { account: "john" }, resolvedDate: "2026-03-15T10:00:00Z" },
      { id: 102, status: "closed", resolution: "fixed", resolvedBy: { account: "alice" }, resolvedDate: "2026-01-10T10:00:00Z" },
      { id: 103, status: "active", resolution: "", resolvedBy: null, resolvedDate: null },
    ], total: 3, limit: 100 },
  );
  try {
    const client = new ZentaoClient({ baseUrl: "https://example.com/zentao", account: "leo", password: "pw" });

    const result = await bugsStats(client, { productIds: [1], groupBy: "product", from: "2026-03-01", to: "2026-03-31" });
    assert.equal(result.status, 1);
    assert.equal(result.result.hasTimeFilter, true);
    assert.equal(result.result.fixRate, undefined, "no fixRate with time filter");
    assert.equal(result.result.groups[0].resolvedInPeriod, 1);
    assert.equal(result.result.groups[0].closedInPeriod, 1);
    assert.equal(result.result.groups[0].fixedInPeriod, 1);
    assert.equal(result.result.groups[0].total, 3);

    const result2 = await bugsStats(client, { productIds: [1], groupBy: "person", from: "2026-03-01", to: "2026-03-31" });
    assert.equal(result2.status, 1);
    assert.equal(result2.result.fixRate, undefined);
    assert.equal(result2.result.groups.length, 1);
    assert.equal(result2.result.groups[0].person, "john");
    assert.equal(result2.result.groups[0].resolved, 1);
    assert.equal(result2.result.groups[0].closed, 1);
    assert.equal(result2.result.groups[0].fixed, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bugsStats returns error for invalid product-ids", async () => {
  const originalFetch = mockFetchForStats(
    { products: [{ id: 1, name: "P1" }], total: 1, limit: 1000 },
    { bugs: [], total: 0, limit: 100 },
  );
  try {
    const client = new ZentaoClient({ baseUrl: "https://example.com/zentao", account: "leo", password: "pw" });
    const result = await bugsStats(client, { productIds: [999], groupBy: "product" });
    assert.equal(result.status, 0);
    assert.ok(result.msg.includes("No matching products"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bugsStats multi-product cross stats", async () => {
  const originalFetch = mockFetchForStats(
    { products: [{ id: 1, name: "P1" }, { id: 2, name: "P2" }], total: 2, limit: 1000 },
    (productId) => productId === 1
      ? { bugs: [
          { id: 101, status: "closed", resolution: "fixed", resolvedBy: { account: "john" }, resolvedDate: "2026-03-01T00:00:00Z" },
          { id: 102, status: "active", resolution: "", resolvedBy: null, resolvedDate: null },
        ], total: 2, limit: 100 }
      : { bugs: [
          { id: 201, status: "closed", resolution: "fixed", resolvedBy: { account: "john" }, resolvedDate: "2026-03-05T00:00:00Z" },
        ], total: 1, limit: 100 },
  );
  try {
    const client = new ZentaoClient({ baseUrl: "https://example.com/zentao", account: "leo", password: "pw" });
    const result = await bugsStats(client, { productIds: [1, 2], groupBy: "product" });
    assert.equal(result.result.groups.length, 2);
    assert.equal(result.result.totalBugs, 3);
    assert.equal(result.result.totalResolved, 2);
    assert.equal(result.result.totalClosed, 2);
    assert.equal(result.result.totalFixed, 2);

    const result2 = await bugsStats(client, { productIds: [1, 2], groupBy: "person" });
    assert.equal(result2.result.groups.length, 1);
    assert.equal(result2.result.groups[0].person, "john");
    assert.equal(result2.result.groups[0].resolved, 2);
    assert.equal(result2.result.groups[0].closed, 2);
    assert.equal(result2.result.groups[0].fixed, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bugsStats returns error for invalid groupBy", async () => {
  const originalFetch = mockFetchForStats(
    { products: [{ id: 1, name: "P1" }], total: 1, limit: 1000 },
    { bugs: [{ id: 101, status: "active", resolvedBy: null, resolvedDate: null }], total: 1, limit: 100 },
  );
  try {
    const client = new ZentaoClient({ baseUrl: "https://example.com/zentao", account: "leo", password: "pw" });
    const result = await bugsStats(client, { productIds: [1], groupBy: "invalid" });
    assert.equal(result.status, 0);
    assert.ok(result.msg.includes("Unknown group-by"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bugsStats handles empty bug list", async () => {
  const originalFetch = mockFetchForStats(
    { products: [{ id: 1, name: "P1" }], total: 1, limit: 1000 },
    { bugs: [], total: 0, limit: 100 },
  );
  try {
    const client = new ZentaoClient({ baseUrl: "https://example.com/zentao", account: "leo", password: "pw" });
    const result = await bugsStats(client, { productIds: [1], groupBy: "product" });
    assert.equal(result.status, 1);
    assert.equal(result.result.totalBugs, 0);
    assert.equal(result.result.totalClosed, 0);
    assert.equal(result.result.totalFixed, 0);
    assert.equal(result.result.groups[0].total, 0);

    const result2 = await bugsStats(client, { productIds: [1], groupBy: "person" });
    assert.equal(result2.status, 1);
    assert.equal(result2.result.totalBugs, 0);
    assert.equal(result2.result.groups.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bugsStats excludes duplicate but keeps other resolutions", async () => {
  const originalFetch = mockFetchForStats(
    { products: [{ id: 1, name: "P1" }], total: 1, limit: 1000 },
    { bugs: [
      { id: 101, status: "closed", resolution: "fixed", resolvedBy: { account: "john" }, resolvedDate: "2026-03-01T00:00:00Z" },
      { id: 102, status: "closed", resolution: "willnotfix", resolvedBy: { account: "john" }, resolvedDate: "2026-03-02T00:00:00Z" },
      { id: 103, status: "closed", resolution: "duplicate", resolvedBy: { account: "john" }, resolvedDate: "2026-03-03T00:00:00Z" },
      { id: 104, status: "active", resolution: "", resolvedBy: null, resolvedDate: null },
    ], total: 4, limit: 100 },
  );
  try {
    const client = new ZentaoClient({ baseUrl: "https://example.com/zentao", account: "leo", password: "pw" });
    const result = await bugsStats(client, { productIds: [1], groupBy: "product" });
    assert.equal(result.result.totalBugs, 3, "duplicate excluded, 3 valid bugs");
    assert.equal(result.result.totalResolved, 2, "fixed + willnotfix both count as resolved");
    assert.equal(result.result.totalClosed, 2, "both closed regardless of resolution");
    assert.equal(result.result.totalFixed, 1, "only closed+fixed counts as fixed");
    assert.equal(result.result.totalNotBug, 1, "willnotfix is not-bug");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("repository exports a zentao skill for skills add", () => {
  const skill = readFileSync(new URL("../skills/zentao/SKILL.md", import.meta.url), "utf8");
  assert.match(skill, /^---\nname: zentao\n/m);
  assert.match(skill, /npx skills add leeguooooo\/zentao-mcp -y -g/);
});

test("root help mentions skills add install path", () => {
  let output = "";
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk, encoding, callback) => {
    output += String(chunk);
    if (typeof callback === "function") callback();
    return true;
  });
  try {
    printRootHelp();
  } finally {
    process.stdout.write = originalWrite;
  }
  assert.match(output, /npx skills add leeguooooo\/zentao-mcp -y -g/);
});

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

test("formatStatsSimple prints product resolution rate", () => {
  const out = formatStatsSimple({
    groupBy: "product",
    hasTimeFilter: false,
    from: null,
    to: null,
    totalBugs: 150,
    totalResolved: 110,
    totalActive: 40,
    rate: 110 / 150,
    groups: [
      { productId: 3, productName: "ProductA", total: 100, resolved: 80, active: 20, rate: 0.8 },
      { productId: 5, productName: "ProductB", total: 50, resolved: 30, active: 20, rate: 0.6 },
    ],
  });
  assert.ok(out.includes("productId\tproductName\ttotal\tresolved\tactive\trate"));
  assert.ok(out.includes("3\tProductA\t100\t80\t20\t80.0%"));
  assert.ok(out.includes("5\tProductB\t50\t30\t20\t60.0%"));
  assert.ok(out.includes("total\t-\t150\t110\t40\t73.3%"));
  assert.ok(!out.includes("period"));
});

test("formatStatsSimple prints product count with time filter", () => {
  const out = formatStatsSimple({
    groupBy: "product",
    hasTimeFilter: true,
    from: "2026-01-01",
    to: "2026-04-09",
    totalBugs: 100,
    totalResolved: 15,
    totalActive: 40,
    groups: [
      { productId: 3, productName: "ProductA", total: 100, resolved: 15, active: 40 },
    ],
  });
  assert.ok(out.includes("period\t2026-01-01 ~ 2026-04-09"));
  assert.ok(out.includes("productId\tproductName\tresolvedInPeriod\ttotal"));
  assert.ok(out.includes("3\tProductA\t15\t100"));
  assert.ok(!out.includes("rate"));
});

test("formatStatsSimple prints person resolution rate", () => {
  const out = formatStatsSimple({
    groupBy: "person",
    hasTimeFilter: false,
    from: null,
    to: null,
    totalBugs: 100,
    totalResolved: 70,
    totalActive: 30,
    rate: 0.7,
    groups: [
      { person: "john", resolved: 40 },
      { person: "alice", resolved: 30 },
    ],
  });
  assert.ok(out.includes("person\tresolved"));
  assert.ok(out.includes("john\t40"));
  assert.ok(out.includes("alice\t30"));
  assert.ok(out.includes("(unresolved)\t30"));
  assert.ok(out.includes("total\t70/100\t70.0%"));
});

test("formatStatsSimple prints person count with time filter", () => {
  const out = formatStatsSimple({
    groupBy: "person",
    hasTimeFilter: true,
    from: "2026-03-01",
    to: null,
    totalBugs: 100,
    totalResolved: 25,
    totalActive: 30,
    groups: [
      { person: "john", resolved: 15 },
      { person: "alice", resolved: 10 },
    ],
  });
  assert.ok(out.includes("period\t2026-03-01"));
  assert.ok(out.includes("person\tresolvedInPeriod"));
  assert.ok(out.includes("john\t15"));
  assert.ok(out.includes("total\t25"));
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
    { products: [{ id: 1, name: "P1", totalBugs: 3 }], total: 1, limit: 1000 },
    { bugs: [
      { id: 101, status: "closed", resolution: "fixed", resolvedBy: { account: "john" }, resolvedDate: "2026-03-15T10:00:00Z" },
      { id: 102, status: "active", resolvedBy: null, resolvedDate: null },
      { id: 103, status: "closed", resolution: "fixed", resolvedBy: { account: "alice" }, resolvedDate: "2026-02-10T10:00:00Z" },
    ], total: 3, limit: 100 },
  );
  try {
    const client = new ZentaoClient({ baseUrl: "https://example.com/zentao", account: "leo", password: "pw" });
    const result = await bugsStats(client, { productIds: [1], groupBy: "product" });
    assert.equal(result.status, 1);
    assert.equal(result.result.totalBugs, 3);
    assert.equal(result.result.totalResolved, 2);
    assert.equal(result.result.totalActive, 1);
    assert.ok(result.result.rate > 0, "rate should exist without time filter");
    assert.equal(result.result.groups.length, 1);
    assert.equal(result.result.groups[0].productName, "P1");
    assert.equal(result.result.groups[0].resolved, 2);
    assert.equal(result.result.groups[0].active, 1);
    assert.ok(result.result.groups[0].rate > 0);
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
      { id: 103, status: "closed", resolution: "fixed", resolvedBy: { account: "alice" }, resolvedDate: "2026-02-10T10:00:00Z" },
      { id: 104, status: "active", resolvedBy: null, resolvedDate: null },
    ], total: 4, limit: 100 },
  );
  try {
    const client = new ZentaoClient({ baseUrl: "https://example.com/zentao", account: "leo", password: "pw" });
    const result = await bugsStats(client, { productIds: [1], groupBy: "person" });
    assert.equal(result.status, 1);
    assert.equal(result.result.totalBugs, 4);
    assert.equal(result.result.totalResolved, 3);
    assert.equal(result.result.totalActive, 1);
    assert.ok(result.result.rate > 0, "rate should exist without time filter");
    assert.equal(result.result.groups.length, 2);
    assert.equal(result.result.groups[0].person, "john");
    assert.equal(result.result.groups[0].resolved, 2);
    assert.equal(result.result.groups[1].person, "alice");
    assert.equal(result.result.groups[1].resolved, 1);
    assert.equal(result.result.groups[0].total, undefined, "per-person total removed");
    assert.equal(result.result.groups[0].rate, undefined, "per-person rate removed");
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
      { id: 103, status: "active", resolvedBy: null, resolvedDate: null },
    ], total: 3, limit: 100 },
  );
  try {
    const client = new ZentaoClient({ baseUrl: "https://example.com/zentao", account: "leo", password: "pw" });

    const result = await bugsStats(client, { productIds: [1], groupBy: "product", from: "2026-03-01", to: "2026-03-31" });
    assert.equal(result.status, 1);
    assert.equal(result.result.hasTimeFilter, true);
    assert.equal(result.result.rate, undefined, "no rate with time filter");
    assert.equal(result.result.groups[0].resolved, 1);
    assert.equal(result.result.groups[0].total, 3);
    assert.equal(result.result.groups[0].rate, undefined, "no rate with time filter");

    const result2 = await bugsStats(client, { productIds: [1], groupBy: "person", from: "2026-03-01", to: "2026-03-31" });
    assert.equal(result2.status, 1);
    assert.equal(result2.result.rate, undefined);
    assert.equal(result2.result.groups.length, 1);
    assert.equal(result2.result.groups[0].person, "john");
    assert.equal(result2.result.groups[0].resolved, 1);
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
          { id: 102, status: "active", resolvedBy: null, resolvedDate: null },
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

    const result2 = await bugsStats(client, { productIds: [1, 2], groupBy: "person" });
    assert.equal(result2.result.groups.length, 1);
    assert.equal(result2.result.groups[0].person, "john");
    assert.equal(result2.result.groups[0].resolved, 2);
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
    assert.equal(result.result.totalResolved, 0);
    assert.equal(result.result.groups[0].total, 0);

    const result2 = await bugsStats(client, { productIds: [1], groupBy: "person" });
    assert.equal(result2.status, 1);
    assert.equal(result2.result.totalBugs, 0);
    assert.equal(result2.result.groups.length, 0);
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

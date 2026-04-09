import process from "node:process";
import { extractCommand, hasHelpFlag, parseCliArgs } from "../cli/args.js";
import { createClientFromCli } from "../zentao/client.js";
import { listBugs, bugsMine, bugsStats } from "../zentao/bugs.js";

function parseCsvIntegers(value) {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) {
    const nested = value.flatMap((item) => String(item).split(/[,|]/));
    const parsed = nested.map((item) => Number(item)).filter((n) => Number.isFinite(n));
    return parsed.length ? parsed : null;
  }
  const tokens = String(value)
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const parsed = tokens.map((item) => Number(item)).filter((n) => Number.isFinite(n));
  return parsed.length ? parsed : null;
}

function printHelp() {
  process.stdout.write(`zentao bugs <subcommand>\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao bugs list --product <id> [--page N] [--limit N] [--json]\n`);
  process.stdout.write(
    `  zentao bugs mine [--scope assigned|opened|resolved|all] [--status active|resolved|closed|all] [--account <account>] [--product-ids 1,2] [--include-zero] [--per-page N] [--max-items N] [--limit N] [--include-details] [--json]\n`
  );
  process.stdout.write(
    `  zentao bugs stats --product-ids 1,2 --group-by product|person [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--json]\n`
  );
}

function formatAccount(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") return String(value.account || value.name || value.realname || "");
  return "";
}

export function formatBugsSimple(bugs) {
  const rows = [];
  rows.push(["id", "title", "status", "pri", "severity", "assignedTo"].join("\t"));
  for (const bug of bugs) {
    rows.push(
      [
        String(bug?.id ?? ""),
        String(bug?.title ?? ""),
        String(bug?.status ?? ""),
        String(bug?.pri ?? ""),
        String(bug?.severity ?? ""),
        formatAccount(bug?.assignedTo),
      ].join("\t")
    );
  }
  return `${rows.join("\n")}\n`;
}

export function formatBugsMineSimple(result) {
  const total = result?.total ?? 0;
  const products = Array.isArray(result?.products) ? result.products : [];
  const rows = [];
  rows.push(`total\t${total}`);
  rows.push(["id", "name", "myBugs", "totalBugs"].join("\t"));
  for (const product of products) {
    rows.push(
      [
        String(product?.id ?? ""),
        String(product?.name ?? ""),
        String(product?.myBugs ?? ""),
        String(product?.totalBugs ?? ""),
      ].join("\t")
    );
  }

  const bugs = Array.isArray(result?.bugs) ? result.bugs : [];
  if (bugs.length) {
    rows.push("");
    rows.push("bugs");
    rows.push(formatBugsSimple(bugs).trimEnd());
  }

  return `${rows.join("\n")}\n`;
}

function formatRate(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatStatsSimple(result) {
  const rows = [];
  const { groupBy, hasTimeFilter, from, to, totalBugs, groups } = result;

  if (hasTimeFilter) {
    const range = [from, to].filter(Boolean).join(" ~ ");
    rows.push(`period\t${range}`);
  }

  if (groupBy === "product") {
    if (hasTimeFilter) {
      rows.push(["productId", "productName", "resolvedInPeriod", "closedInPeriod", "fixedInPeriod", "total"].join("\t"));
      for (const g of groups) {
        rows.push([g.productId, g.productName, g.resolvedInPeriod, g.closedInPeriod, g.fixedInPeriod, g.total].join("\t"));
      }
      rows.push(["total", "-", result.totalResolvedInPeriod, result.totalClosedInPeriod, result.totalFixedInPeriod, totalBugs].join("\t"));
    } else {
      rows.push(["productId", "productName", "total", "resolved", "closed", "fixed", "active", "closeRate", "fixRate"].join("\t"));
      for (const g of groups) {
        rows.push([g.productId, g.productName, g.total, g.resolved, g.closed, g.fixed, g.active, formatRate(g.closeRate), formatRate(g.fixRate)].join("\t"));
      }
      rows.push(["total", "-", totalBugs, result.totalResolved, result.totalClosed, result.totalFixed, result.totalActive, formatRate(result.closeRate), formatRate(result.fixRate)].join("\t"));
    }
  }

  if (groupBy === "person") {
    if (hasTimeFilter) {
      rows.push(["person", "resolvedInPeriod", "closedInPeriod", "fixedInPeriod"].join("\t"));
      for (const g of groups) {
        rows.push([g.person, g.resolved, g.closed, g.fixed].join("\t"));
      }
      rows.push(["total", result.totalResolvedInPeriod, result.totalClosedInPeriod, result.totalFixedInPeriod].join("\t"));
    } else {
      rows.push(["person", "resolved", "closed", "fixed"].join("\t"));
      for (const g of groups) {
        rows.push([g.person, g.resolved, g.closed, g.fixed].join("\t"));
      }
      if (result.totalActive > 0) {
        rows.push(["(unresolved)", result.totalActive, "-", "-"].join("\t"));
      }
      rows.push(["total", `${result.totalResolved}/${totalBugs}`, `${result.totalClosed}/${totalBugs}`, `${result.totalFixed}/${totalBugs}`, `closeRate:${formatRate(result.closeRate)}`, `fixRate:${formatRate(result.fixRate)}`].join("\t"));
    }
  }

  return `${rows.join("\n")}\n`;
}

export async function runBugs({ argv = [], env = process.env } = {}) {
  if (hasHelpFlag(argv)) {
    printHelp();
    return;
  }

  const { command: sub, argv: argvWithoutSub } = extractCommand(argv);
  const cliArgs = parseCliArgs(argvWithoutSub);
  const api = createClientFromCli({ argv: argvWithoutSub, env });

  if (sub === "list") {
    const product = cliArgs.product;
    if (!product) throw new Error("Missing --product");
    const result = await listBugs(api, {
      product,
      page: cliArgs.page,
      limit: cliArgs.limit,
    });

    if (cliArgs.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    const bugs = result?.result?.bugs;
    if (!Array.isArray(bugs)) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    process.stdout.write(formatBugsSimple(bugs));
    return;
  }

  if (sub === "mine") {
    const includeDetails = Boolean(cliArgs["include-details"]);
    const includeZero = Boolean(cliArgs["include-zero"]);
    const productIds = parseCsvIntegers(cliArgs["product-ids"]);
    const perPage = cliArgs["per-page"];
    const maxItems = cliArgs["max-items"] ?? cliArgs.limit;
    const result = await bugsMine(api, {
      account: cliArgs.account,
      scope: cliArgs.scope,
      status: cliArgs.status,
      productIds,
      includeZero,
      perPage,
      maxItems,
      includeDetails,
    });

    if (cliArgs.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    process.stdout.write(formatBugsMineSimple(result?.result));
    return;
  }

  if (sub === "stats") {
    const productIds = parseCsvIntegers(cliArgs["product-ids"]);
    if (!productIds || !productIds.length) throw new Error("Missing --product-ids");
    const groupBy = cliArgs["group-by"] || "product";
    if (groupBy !== "product" && groupBy !== "person") {
      throw new Error(`--group-by must be "product" or "person", got "${groupBy}"`);
    }
    const from = cliArgs.from || null;
    const to = cliArgs.to || null;
    const perPage = cliArgs["per-page"];

    const result = await bugsStats(api, { productIds, groupBy, from, to, perPage });

    if (cliArgs.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    if (result.status !== 1) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    process.stdout.write(formatStatsSimple(result.result));
    return;
  }

  throw new Error(`Unknown bugs subcommand: ${sub || "(missing)"}`);
}

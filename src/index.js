#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const [flag, inlineValue] = raw.split("=", 2);
    const key = flag.replace(/^--/, "");
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
      continue;
    }
    args[key] = true;
  }
  return args;
}

function getOption(cliArgs, envName, cliName) {
  if (cliArgs[cliName]) return cliArgs[cliName];
  const envValue = process.env[envName];
  if (envValue) return envValue;
  return null;
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function toInt(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeResult(payload) {
  return { status: 1, msg: "success", result: payload };
}

function normalizeError(message, payload) {
  return { status: 0, msg: message || "error", result: payload ?? [] };
}

function normalizeAccountValue(value) {
  return String(value || "").trim().toLowerCase();
}

function extractAccounts(value) {
  if (value === undefined || value === null) return [];
  if (typeof value === "string" || typeof value === "number") {
    const normalized = normalizeAccountValue(value);
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractAccounts(item));
  }
  if (typeof value === "object") {
    const candidates = [];
    if (value.account) candidates.push(...extractAccounts(value.account));
    if (value.realname) candidates.push(...extractAccounts(value.realname));
    if (value.name) candidates.push(...extractAccounts(value.name));
    if (value.user) candidates.push(...extractAccounts(value.user));
    return candidates.filter(Boolean);
  }
  return [];
}

function matchesAccount(value, matchAccount) {
  const candidates = extractAccounts(value);
  return candidates.includes(matchAccount);
}

class ZentaoClient {
  constructor({ baseUrl, account, password }) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.account = account;
    this.password = password;
    this.token = null;
  }

  async ensureToken() {
    if (this.token) return;
    this.token = await this.getToken();
  }

  async getToken() {
    const url = `${this.baseUrl}/api.php/v1/tokens`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account: this.account,
        password: this.password,
      }),
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new Error(`Token response parse failed: ${text.slice(0, 200)}`);
    }

    if (json.error) {
      throw new Error(`Token request failed: ${json.error}`);
    }

    if (!json.token) {
      throw new Error(`Token missing in response: ${text.slice(0, 200)}`);
    }

    return json.token;
  }

  async request({ method, path, query = {}, body }) {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });

    const headers = {
      Token: this.token,
    };

    const options = { method, headers };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new Error(`Response parse failed: ${text.slice(0, 200)}`);
    }

    return json;
  }

  async listProducts({ page, limit }) {
    const payload = await this.request({
      method: "GET",
      path: "/api.php/v1/products",
      query: {
        page: toInt(page, 1),
        limit: toInt(limit, 1000),
      },
    });

    if (payload.error) return normalizeError(payload.error, payload);
    return normalizeResult(payload);
  }

  async listBugs({ product, page, limit }) {
    if (!product) throw new Error("product is required");

    const payload = await this.request({
      method: "GET",
      path: "/api.php/v1/bugs",
      query: {
        product,
        page: toInt(page, 1),
        limit: toInt(limit, 20),
      },
    });

    if (payload.error) return normalizeError(payload.error, payload);
    return normalizeResult(payload);
  }

  async fetchAllBugsForProduct({ product, perPage, maxItems }) {
    const bugs = [];
    let page = 1;
    let total = null;
    const pageSize = toInt(perPage, 100);
    const cap = toInt(maxItems, 0);

    while (true) {
      const payload = await this.request({
        method: "GET",
        path: "/api.php/v1/bugs",
        query: {
          product,
          page,
          limit: pageSize,
        },
      });

      if (payload.error) {
        throw new Error(payload.error);
      }

      const pageBugs = Array.isArray(payload.bugs) ? payload.bugs : [];
      total = payload.total ?? total;
      for (const bug of pageBugs) {
        bugs.push(bug);
        if (cap > 0 && bugs.length >= cap) {
          return { bugs, total };
        }
      }

      if (total !== null && payload.limit) {
        if (page * payload.limit >= total) break;
      } else if (pageBugs.length < pageSize) {
        break;
      }

      page += 1;
    }

    return { bugs, total };
  }

  async bugStats({ includeZero, limit }) {
    const productsResponse = await this.listProducts({ page: 1, limit: toInt(limit, 1000) });
    if (productsResponse.status !== 1) return productsResponse;

    const products = productsResponse.result.products || [];
    const rows = [];
    let total = 0;

    products.forEach((product) => {
      const totalBugs = toInt(product.totalBugs, 0);
      if (!includeZero && totalBugs === 0) return;
      total += totalBugs;
      rows.push({
        id: product.id,
        name: product.name,
        totalBugs,
        unresolvedBugs: toInt(product.unresolvedBugs, 0),
        closedBugs: toInt(product.closedBugs, 0),
        fixedBugs: toInt(product.fixedBugs, 0),
      });
    });

    return normalizeResult({
      total,
      products: rows,
    });
  }

  async bugsMine({
    account,
    scope,
    status,
    productIds,
    includeZero,
    perPage,
    maxItems,
    includeDetails,
  }) {
    const matchAccount = normalizeAccountValue(account || this.account);
    const targetScope = (scope || "assigned").toLowerCase();
    const rawStatus = status ?? "active";
    const statusList = Array.isArray(rawStatus)
      ? rawStatus
      : String(rawStatus).split(/[|,]/);
    const statusSet = new Set(
      statusList.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    );
    const allowAllStatus = statusSet.has("all") || statusSet.size === 0;

    const productsResponse = await this.listProducts({ page: 1, limit: 1000 });
    if (productsResponse.status !== 1) return productsResponse;
    const products = productsResponse.result.products || [];

    const productSet = Array.isArray(productIds) && productIds.length
      ? new Set(productIds.map((id) => Number(id)))
      : null;

    const rows = [];
    const bugs = [];
    let totalMatches = 0;
    const maxCollect = toInt(maxItems, 200);

    for (const product of products) {
      if (productSet && !productSet.has(Number(product.id))) continue;
      const { bugs: productBugs } = await this.fetchAllBugsForProduct({
        product: product.id,
        perPage,
      });

      const matches = productBugs.filter((bug) => {
        if (!allowAllStatus) {
          const bugStatus = String(bug.status || "").trim().toLowerCase();
          if (!statusSet.has(bugStatus)) return false;
        }
        const assigned = matchesAccount(bug.assignedTo, matchAccount);
        const opened = matchesAccount(bug.openedBy, matchAccount);
        const resolved = matchesAccount(bug.resolvedBy, matchAccount);
        if (targetScope === "assigned") return assigned;
        if (targetScope === "opened") return opened;
        if (targetScope === "resolved") return resolved;
        return assigned || opened || resolved;
      });

      if (!includeZero && matches.length === 0) continue;
      totalMatches += matches.length;

      rows.push({
        id: product.id,
        name: product.name,
        totalBugs: toInt(product.totalBugs, 0),
        myBugs: matches.length,
      });

      if (includeDetails && bugs.length < maxCollect) {
        for (const bug of matches) {
          if (bugs.length >= maxCollect) break;
          bugs.push({
            id: bug.id,
            title: bug.title,
            product: bug.product,
            status: bug.status,
            pri: bug.pri,
            severity: bug.severity,
            assignedTo: bug.assignedTo,
            openedBy: bug.openedBy,
            resolvedBy: bug.resolvedBy,
            openedDate: bug.openedDate,
          });
        }
      }
    }

    return normalizeResult({
      account: matchAccount,
      scope: targetScope,
      status: allowAllStatus ? "all" : Array.from(statusSet),
      total: totalMatches,
      products: rows,
      bugs: includeDetails ? bugs : [],
    });
  }
}

function createClient() {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const baseUrl = getOption(cliArgs, "ZENTAO_URL", "zentao-url");
  const account = getOption(cliArgs, "ZENTAO_ACCOUNT", "zentao-account");
  const password = getOption(cliArgs, "ZENTAO_PASSWORD", "zentao-password");

  if (!baseUrl) throw new Error("Missing ZENTAO_URL or --zentao-url");
  if (!account) throw new Error("Missing ZENTAO_ACCOUNT or --zentao-account");
  if (!password) throw new Error("Missing ZENTAO_PASSWORD or --zentao-password");
  return new ZentaoClient({ baseUrl, account, password });
}

let client;
function getClient() {
  if (!client) client = createClient();
  return client;
}

const server = new Server(
  {
    name: "zentao-mcp",
    version: "0.3.2",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const tools = [
  {
    name: "zentao_products_list",
    description: "List all products from ZenTao. Use this to get product IDs before querying bugs. Returns product information including ID, name, and bug counts.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "integer", description: "Page number (default 1)." },
        limit: { type: "integer", description: "Page size (default 1000)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "zentao_bugs_list",
    description: "List bugs (缺陷/问题) for a specific product in ZenTao. Use this when user asks to 'see bugs', 'view bugs', 'show bugs', '看bug', '查看bug', '显示bug', or wants to check issues for a product. Requires product ID which can be obtained from zentao_products_list.",
    inputSchema: {
      type: "object",
      properties: {
        product: { type: "integer", description: "Product ID (required). Get this from zentao_products_list first." },
        page: { type: "integer", description: "Page number (default 1)." },
        limit: { type: "integer", description: "Page size (default 20)." },
      },
      required: ["product"],
      additionalProperties: false,
    },
  },
  {
    name: "zentao_bugs_stats",
    description: "Get bug statistics (bug统计) across all products. Shows total bugs, unresolved bugs, closed bugs, and fixed bugs per product. Use when user asks for bug summary, statistics, overview, or 'bug统计'.",
    inputSchema: {
      type: "object",
      properties: {
        includeZero: { type: "boolean", description: "Include products with zero bugs (default false)." },
        limit: { type: "integer", description: "Max products to fetch (default 1000)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "zentao_bugs_mine",
    description: "List my bugs (我的Bug) by assignment or creator. Default scope is assigned. Use when user asks for 'my bugs', '我的bug', '分配给我', or personal bug list.",
    inputSchema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Account to match (default: login account)." },
        scope: {
          type: "string",
          description: "Filter scope: assigned|opened|resolved|all (default assigned).",
        },
        status: {
          type: ["string", "array"],
          description: "Status filter: active|resolved|closed|all (default active).",
        },
        productIds: {
          type: "array",
          items: { type: "integer" },
          description: "Optional product IDs to limit search.",
        },
        includeZero: { type: "boolean", description: "Include products with zero matches (default false)." },
        perPage: { type: "integer", description: "Page size when scanning products (default 100)." },
        maxItems: { type: "integer", description: "Max bug items to return (default 200)." },
        includeDetails: { type: "boolean", description: "Include bug details list (default false)." },
      },
      additionalProperties: false,
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments || {};
  try {
    const api = getClient();
    let result;
    switch (request.params.name) {
      case "zentao_products_list":
        result = await api.listProducts(args);
        break;
      case "zentao_bugs_list":
        result = await api.listBugs(args);
        break;
      case "zentao_bugs_stats":
        result = await api.bugStats(args);
        break;
      case "zentao_bugs_mine":
        result = await api.bugsMine(args);
        break;
      default:
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
        };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error.message }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

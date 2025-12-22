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
    version: "0.2.0",
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
    description: "List products (RESTful API).",
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
    description: "List bugs for a product (RESTful API).",
    inputSchema: {
      type: "object",
      properties: {
        product: { type: "integer", description: "Product ID." },
        page: { type: "integer", description: "Page number (default 1)." },
        limit: { type: "integer", description: "Page size (default 20)." },
      },
      required: ["product"],
      additionalProperties: false,
    },
  },
  {
    name: "zentao_bugs_stats",
    description: "Aggregate bug totals across products.",
    inputSchema: {
      type: "object",
      properties: {
        includeZero: { type: "boolean", description: "Include products with zero bugs." },
        limit: { type: "integer", description: "Max products to fetch (default 1000)." },
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

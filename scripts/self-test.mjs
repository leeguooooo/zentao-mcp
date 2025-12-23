#!/usr/bin/env node
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

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

async function run() {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const baseUrl = getOption(cliArgs, "ZENTAO_URL", "zentao-url");
  const account = getOption(cliArgs, "ZENTAO_ACCOUNT", "zentao-account");
  const password = getOption(cliArgs, "ZENTAO_PASSWORD", "zentao-password");
  const expectedRaw = cliArgs.expected ?? null;
  const expected = expectedRaw === null ? null : Number(expectedRaw);

  if (!baseUrl || !account || !password) {
    console.error("Missing ZENTAO_URL/ZENTAO_ACCOUNT/ZENTAO_PASSWORD (or CLI args).");
    process.exit(1);
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["src/index.js"],
    cwd: process.cwd(),
    env: {
      ZENTAO_URL: baseUrl,
      ZENTAO_ACCOUNT: account,
      ZENTAO_PASSWORD: password,
    },
    stderr: "pipe",
  });

  const client = new Client(
    { name: "zentao-self-test", version: "0.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: "zentao_bugs_mine",
      arguments: {
        scope: "assigned",
        status: "active",
        includeDetails: false,
      },
    });

    const text = result.content?.find((item) => item.type === "text")?.text;
    if (!text) {
      console.error("Missing tool response text.");
      process.exit(1);
    }

    const payload = JSON.parse(text);
    if (payload.status !== 1) {
      console.error(`Tool error: ${text}`);
      process.exit(1);
    }

    const total = payload.result?.total ?? 0;
    console.log(`assigned active bugs: ${total}`);

    const products = payload.result?.products ?? [];
    if (Array.isArray(products) && products.length) {
      const summary = products
        .map((item) => `${item.name}(${item.myBugs})`)
        .join(", ");
      console.log(`products: ${summary}`);
    }

    if (Number.isFinite(expected) && expected !== null) {
      if (total !== expected) {
        console.error(`Expected ${expected}, got ${total}.`);
        process.exit(2);
      }
    }
  } finally {
    await transport.close();
  }
}

run().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});

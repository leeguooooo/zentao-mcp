# zentao-mcp

MCP server for ZenTao RESTful APIs (products + bugs).

## Quick Start

### Cursor IDE

1. Open Cursor Settings (⌘, on Mac or Ctrl+, on Windows/Linux)
2. Navigate to **Features** → **Model Context Protocol**
3. Click **Edit Config** to open `~/.cursor/mcp.json` (or create it)
4. Add the following configuration:

```json
{
  "mcpServers": {
    "zentao-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@leeguoo/zentao-mcp",
        "--stdio",
        "--zentao-url=https://zentao.example.com/zentao",
        "--zentao-account=leo",
        "--zentao-password=***"
      ]
    }
  }
}
```

5. Restart Cursor IDE

### Other MCP Clients (Claude Desktop, etc.)

For clients using TOML configuration (e.g., Claude Desktop), add to your MCP config file:

```toml
[mcp_servers."zentao-mcp"]
command = "npx"
args = [
  "-y",
  "@leeguoo/zentao-mcp",
  "--stdio",
  "--zentao-url=https://zentao.example.com/zentao",
  "--zentao-account=leo",
  "--zentao-password=***"
]
```

**Config file locations:**
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.toml` (Mac) or `%APPDATA%\Claude\claude_desktop_config.toml` (Windows)
- Cursor: `~/.cursor/mcp.json` (JSON format)

## Configuration

### Required Parameters

You can configure the server using CLI arguments or environment variables:

**CLI Arguments:**
- `--zentao-url` (e.g. `https://zentao.example.com/zentao`)
- `--zentao-account`
- `--zentao-password`

**Environment Variables:**
- `ZENTAO_URL` (e.g. `https://zentao.example.com/zentao`)
- `ZENTAO_ACCOUNT`
- `ZENTAO_PASSWORD`

### Using Environment Variables in Cursor

If you prefer to use environment variables instead of CLI args, you can configure them in Cursor:

```json
{
  "mcpServers": {
    "zentao-mcp": {
      "command": "npx",
      "args": ["-y", "@leeguoo/zentao-mcp", "--stdio"],
      "env": {
        "ZENTAO_URL": "https://zentao.example.com/zentao",
        "ZENTAO_ACCOUNT": "leo",
        "ZENTAO_PASSWORD": "***"
      }
    }
  }
}
```

**Tip:** `ZENTAO_URL` should include the ZenTao base path (often `/zentao`).

## Tools

- `zentao_products_list` (page, limit)
- `zentao_bugs_list` (product, page, limit)
- `zentao_bugs_stats` (includeZero, limit)

Example tool input:

```json
{
  "product": 1,
  "page": 1,
  "limit": 20
}
```

## Local Development

```bash
pnpm install
ZENTAO_URL=https://zentao.example.com/zentao \\
ZENTAO_ACCOUNT=leo \\
ZENTAO_PASSWORD=*** \\
pnpm start
```

## Security

Do not commit credentials. Prefer environment variables in local runs.

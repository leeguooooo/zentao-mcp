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
        "--zentao-url=https://zentao.example.com/zentao",
        "--zentao-account=leo",
        "--zentao-password=***",
        "--stdio"
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
  "--zentao-url=https://zentao.example.com/zentao",
  "--zentao-account=leo",
  "--zentao-password=***",
  "--stdio"
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

The MCP server provides four tools that can be triggered by natural language in Cursor:

- **`zentao_products_list`** - List all products
- **`zentao_bugs_list`** - List bugs for a specific product
- **`zentao_bugs_stats`** - Get bug statistics across products
- **`zentao_bugs_mine`** - List my bugs by assignment or creator (status filter supported)

### Usage Examples

After configuring the MCP server in Cursor, you can use natural language to interact with ZenTao:

**English:**
- "Show me all products"
- "List bugs for product 1"
- "Show me bugs"
- "What's the bug statistics?"
- "Show my bugs"
- "List bugs assigned to me"
- "View bugs in product 2"

**Chinese (中文):**
- "看bug" / "查看bug" / "显示bug"
- "产品1的bug列表"
- "bug统计"
- "显示所有产品"
- "查看产品2的问题"
- "我的bug"
- "分配给我的bug"

The AI will automatically:
1. Use `zentao_products_list` to get product IDs when needed
2. Use `zentao_bugs_list` when you ask to see bugs
3. Use `zentao_bugs_stats` when you ask for statistics or overview
4. Use `zentao_bugs_mine` when you ask for your own bugs

### Tool Parameters

**zentao_products_list:**
```json
{
  "page": 1,
  "limit": 1000
}
```

**zentao_bugs_list:**
```json
{
  "product": 1,
  "page": 1,
  "limit": 20
}
```

**zentao_bugs_stats:**
```json
{
  "includeZero": false,
  "limit": 1000
}
```

**zentao_bugs_mine:**
```json
{
  "status": "active",
  "scope": "assigned",
  "includeZero": false,
  "includeDetails": true,
  "maxItems": 50
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

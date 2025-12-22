# zentao-mcp

MCP server for ZenTao RESTful APIs (products + bugs).

## Quick Start (npx)

Use this MCP server config in your client:

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

## Configuration

Required:
- `--zentao-url` / `ZENTAO_URL` (e.g. `https://zentao.example.com/zentao`)
- `--zentao-account` / `ZENTAO_ACCOUNT`
- `--zentao-password` / `ZENTAO_PASSWORD`

Tip: `ZENTAO_URL` should include the ZenTao base path (often `/zentao`).

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

## Publishing

```bash
git tag v0.2.1
git push origin main --tags
gh release create v0.2.1 --notes "Release v0.2.1"
npm publish --access public
```

## Security

Do not commit credentials. Prefer environment variables in local runs.

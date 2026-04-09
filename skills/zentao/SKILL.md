---
name: zentao
description: Use the zentao CLI to query and operate ZenTao bugs, tasks, stories, todos, products, programs, projects, executions, plans, releases, test cases, test tasks, test suites, docs, users, departments, issues, and risks. Use when the user mentions 禅道 or ZenTao, wants bug/task/story/todo/project/test/doc lookups or updates, wants bug resolution rate stats or reports (bug 解决率统计/解决数量统计/bug statistics/bug report) by product or person, or needs login / whoami / self-test for a 禅道 instance. ZENTAO_URL usually includes /zentao.
homepage: https://www.npmjs.com/package/@leeguoo/zentao-mcp
metadata: {"openclaw":{"emoji":"🐞","install":[{"id":"node","kind":"node","package":"@leeguoo/zentao-mcp","bins":["zentao"],"label":"Install zentao CLI (node)"}]}}
---

# zentao (ZenTao CLI)

## When to use this skill

Use this skill when the user asks anything about 禅道 / ZenTao, including:

- bugs: list, mine, stats, get, create, resolve, assign, comment, close, activate
- tasks: list, get, create, start, finish, pause, close
- stories: list, get, create
- todos: list, get, create, finish, close
- products, programs, projects, executions
- plans, releases, builds
- test cases, test tasks, test suites
- docs and doc libraries
- users and departments
- issues and risks
- login, whoami, self-test, JSON export

Typical user asks include:

- “帮我查禅道 bug / task / story / todo”
- “统计一下 bug 解决率” / “看看各产品的 bug 解决情况”
- “看一下产品、项目、执行、版本、计划、构建”
- “查测试单、测试用例、测试套件”
- “看文档库 / 文档 / 部门 / 用户”
- “查问题 / 风险”
- “帮我登录禅道” / “验证禅道连接”

## Installation

```bash
npx skills add leeguooooo/zentao-mcp -y -g
pnpm i -g @leeguoo/zentao-mcp
```

Fallbacks:

```bash
npm i -g @leeguoo/zentao-mcp
npx -y @leeguoo/zentao-mcp --help
```

`skills add` installs the skill definition; the CLI still needs to be available as `zentao` in PATH for normal usage.

## Login

```bash
zentao login --zentao-url="https://zentao.example.com/zentao" --zentao-account="leo" --zentao-password="***"
zentao whoami
```

IMPORTANT: `--zentao-url` usually must include `/zentao`.

## Quick start

```bash
zentao login --zentao-url="https://zentao.example.com/zentao" --zentao-account="leo" --zentao-password="***"
zentao whoami
zentao self-test
```

## Capability map

Use the singular command for one record or a state-changing action, and the plural command for list queries.

```bash
zentao login
zentao whoami
zentao self-test
zentao products list
zentao programs list
zentao projects list
zentao projects builds --id 22
zentao executions list
zentao bugs list --product 6
zentao bugs mine --status active --include-details
zentao bugs stats --product-ids 1,2 --group-by product|person [--from DATE] [--to DATE]
zentao bug get|create|resolve|assign|comment|close|activate ...
zentao tasks list --execution 25
zentao task get|create|start|finish|pause|close ...
zentao stories list --product 3
zentao story get|create ...
zentao todos list|get|create|finish|close ...
zentao plans list|get ...
zentao releases list|get ...
zentao testcases list|get ...
zentao testtasks list|get ...
zentao testsuites list|get ...
zentao docs libs|list|get ...
zentao users list
zentao departments list
zentao issues list|get ...
zentao risks list|get ...
```

## Auth and output rules

- All commands can read credentials from saved login config.
- Flags also work: `--zentao-url`, `--zentao-account`, `--zentao-password`
- Environment variables also work: `ZENTAO_URL`, `ZENTAO_ACCOUNT`, `ZENTAO_PASSWORD`
- Add `--json` when the caller wants raw machine-readable output.
- ZenTao URLs usually need the `/zentao` suffix.

## Bug commands

```bash
zentao bugs list --product 6
zentao bugs mine --scope assigned --status active --include-details
zentao bug get --id 1329
zentao bug create --product 6 --title "bug title" [--severity 3] [--pri 2] [--type codeerror] [--steps "..."] [--assigned-to account] [--opened-build trunk]
zentao bug resolve --id 1329 --resolution fixed [--resolved-build trunk] [--assigned-to kelly] [--comment "..."]
zentao bug assign --id 1329 --assigned-to rd-yitong [--comment "..."]
zentao bug close --id 1329 [--comment "..."]
zentao bug activate --id 1329 [--assigned-to account] [--comment "..."]
zentao bug comment --id 1329 --comment "已确认，等待修复"
```

Resolution values: `fixed`, `bydesign`, `duplicate`, `postponed`, `notrepro`, `willnotfix`, `tostory`, `external`

### Bug stats

```bash
# 按产品统计解决率
zentao bugs stats --product-ids 1,2 --group-by product

# 按人员统计解决率（按实际解决人 resolvedBy 分组）
zentao bugs stats --product-ids 1,2 --group-by person

# 按产品统计指定时间段内的解决数量
zentao bugs stats --product-ids 1,2 --group-by product --from 2026-01-01 --to 2026-04-09

# 按人员统计指定时间段内的解决数量
zentao bugs stats --product-ids 1,2 --group-by person --from 2026-03-01 --to 2026-03-31

# JSON 输出
zentao bugs stats --product-ids 1,2 --group-by product --json
```

- `--product-ids` 必填，逗号分隔
- `--group-by` 支持 `product` 或 `person`，默认 `product`
- 不指定 `--from`/`--to` 时输出解决率；指定时间段时输出该期间的解决数量
- 人员维度按 `resolvedBy`（实际解决人）分组

## Task commands

```bash
zentao tasks list --execution 25
zentao task get --id 388
zentao task create --execution 25 --name "task name" [--assigned-to account] [--pri 3] [--estimate 8] [--type devel] [--desc "..."]
zentao task start --id 388 [--consumed 2] [--left 6]
zentao task finish --id 388 [--finished-date "2026-04-08"] [--consumed 8]
zentao task pause --id 388
zentao task close --id 388 [--comment "done"]
```

## Story commands

```bash
zentao stories list --product 3
zentao story get --id 1
zentao story create --product 3 --title "story title" [--spec "description"] [--pri 2] [--estimate 3] [--type story] [--assigned-to account]
```

## Todo commands

```bash
zentao todos list
zentao todos get --id 1
zentao todos create --name "todo name" [--type custom] [--date 2026-04-08] [--begin 09:00] [--end 10:00] [--pri 3] [--desc "..."] [--assigned-to account]
zentao todos finish --id 1
zentao todos close --id 1
```

## Product, program, project, and execution commands

```bash
zentao products list
zentao programs list
zentao projects list
zentao projects builds --id 22
zentao executions list
```

## Product plans and releases

```bash
zentao plans list --product 3
zentao plans get --id 1
zentao releases list --product 3
zentao releases get --id 1
```

## Testing commands

```bash
zentao testcases list --product 3
zentao testcases get --id 1
zentao testtasks list
zentao testtasks get --id 1
zentao testsuites list --product 3
zentao testsuites get --id 1
```

## Organization & docs

```bash
zentao users list
zentao departments list
zentao docs libs
zentao docs list --lib 50
zentao docs get --id 1
```

## Issues & risks

```bash
zentao issues list
zentao issues get --id 1
zentao risks list
zentao risks get --id 1
```

## JSON output

All commands support `--json` for full JSON payload:

```bash
zentao whoami --json
zentao bugs list --product 6 --json
zentao task get --id 388 --json
zentao users list --json
zentao issues get --id 1 --json
```

## Recommended execution pattern

When helping a user operationally, prefer this sequence:

1. Ensure CLI exists: `zentao --help`
2. Ensure auth exists: `zentao whoami`
3. If auth may be broken, run: `zentao self-test`
4. Use the narrowest command that answers the request.
5. Add `--json` when the caller needs structured output for follow-up automation.

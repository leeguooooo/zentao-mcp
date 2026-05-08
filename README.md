# zentao-mcp

> ⚠️ **本项目不再维护。** 推荐改用禅道官方维护的 [`zentao-cli`](https://github.com/easysoft/zentao-cli) 和配套 Skills [`easysoft/zentao-skills`](https://github.com/easysoft/zentao-skills)：基于 RESTful API v2、内置 MCP server、模块覆盖更全，且持续更新。
>
> 已经在用本包的用户不受影响，可以继续装；新项目请优先选择上游：
>
> ```bash
> npm i -g zentao-cli
> npx skills add easysoft/zentao-skills
> ```

在命令行里查 Bug、任务、需求、待办、产品、项目、测试和文档，让你的 AI 助手也能直接操作禅道。

零依赖、单文件，装完即用。

## 快速开始

```bash
npx skills add leeguooooo/zentao-mcp -y -g
```

安装 CLI：

```bash
pnpm i -g @leeguoo/zentao-mcp
```

没有 pnpm？也可以用 npm：

```bash
npm i -g @leeguoo/zentao-mcp
```

不想装？直接跑：

```bash
npx -y @leeguoo/zentao-mcp --help
```

`skills add` 只负责安装 skill 文件；CLI 仍然建议全局安装后直接用 `zentao` 命令。

## 登录

只需登录一次，凭据会保存到本地配置文件：

```bash
zentao login \
  --zentao-url=https://zentao.example.com/zentao \
  --zentao-account=你的账号 \
  --zentao-password=你的密码
```

> **注意：** URL 通常需要包含 `/zentao` 路径。如果登录时看到 404，多半是少了这段。

验证登录状态：

```bash
zentao whoami
```

配置文件位置：`~/.config/zentao/config.toml`

## 支持的能力

当前 CLI 已支持这些对象和动作：

- 认证与连通性：`login`、`whoami`、`self-test`
- Bug：列表、查询、创建、指派、评论、解决、关闭、激活、查我的 Bug
- 任务：列表、查询、创建、开始、完成、暂停、关闭
- 需求：列表、查询、创建
- 待办：列表、查询、创建、完成、关闭
- 产品 / 项目 / 项目集 / 执行：列表，项目构建查询
- 计划 / 发布：列表、详情
- 测试用例 / 测试单 / 测试套件：列表、详情
- 文档库 / 文档：列表、详情
- 用户 / 部门：列表
- 问题 / 风险：列表、详情
- 机器可读输出：全部命令支持 `--json`

## 日常使用

### 查看产品列表

```bash
zentao products list
```

### 查看某个产品的 Bug

```bash
zentao bugs list --product 6
```

### 查看 Bug 详情

```bash
zentao bug get --id 1329
```

### 查看分配给我的 Bug

```bash
zentao bugs mine --status active
```

带详情：

```bash
zentao bugs mine --status active --include-details
```

### 需要原始 JSON？

任何命令后面加 `--json`：

```bash
zentao products list --json
zentao bugs list --product 6 --json
zentao bug get --id 1329 --json
zentao bugs mine --include-details --json
```

### 自检

验证 API 连接是否正常：

```bash
zentao self-test
```

## 命令总览

```bash
zentao login --zentao-url=... --zentao-account=... --zentao-password=...
zentao whoami
zentao self-test

zentao products list
zentao programs list
zentao projects list
zentao projects builds --id 22
zentao executions list

zentao bugs list --product 6
zentao bugs mine --status active --include-details
zentao bug get --id 1329
zentao bug create --product 6 --title "bug title"
zentao bug assign --id 1329 --assigned-to someone
zentao bug resolve --id 1329 --resolution fixed
zentao bug close --id 1329
zentao bug activate --id 1329
zentao bug comment --id 1329 --comment "comment"

zentao tasks list --execution 25
zentao task get --id 388
zentao task create --execution 25 --name "task name"
zentao task start --id 388
zentao task finish --id 388
zentao task pause --id 388
zentao task close --id 388

zentao stories list --product 3
zentao story get --id 1
zentao story create --product 3 --title "story title"

zentao todos list
zentao todos get --id 1
zentao todos create --name "todo name"
zentao todos finish --id 1
zentao todos close --id 1

zentao plans list --product 3
zentao plans get --id 1
zentao releases list --product 3
zentao releases get --id 1

zentao testcases list --product 3
zentao testcases get --id 1
zentao testtasks list
zentao testtasks get --id 1
zentao testsuites list --product 3
zentao testsuites get --id 1

zentao docs libs
zentao docs list --lib 50
zentao docs get --id 1
zentao users list
zentao departments list
zentao issues list
zentao issues get --id 1
zentao risks list
zentao risks get --id 1
```

## 让 AI 帮你查禅道

只需对你的 AI 助手（Cursor / Claude Code / Windsurf 等）说：

> 帮我执行 `npx skills add leeguooooo/zentao-mcp -y -g`，然后帮我登录禅道

安装后你就可以直接说：

- "帮我看下产品 6 有哪些未解决的 Bug"
- "查一下 Bug #1329 的详情"
- "我名下还有多少活跃 Bug？"
- "帮我看执行 25 下有哪些任务"
- "查一下产品 3 的需求 / 计划 / 发布"
- "列出测试单、测试用例、测试套件"
- "看一下项目问题和风险"
- "打开文档库 50 里的文档列表"

---

<!-- AI_SKILL_INSTALL: 以下内容供 AI 助手自动安装时读取 -->

<details>
<summary><strong>AI Skill 自动安装指引（AI 可直接执行）</strong></summary>

当用户要求安装本仓库为 skill 时，请按顺序执行：

**1. 安装 Skill**

```bash
npx skills add leeguooooo/zentao-mcp -y -g
```

**2. 安装 CLI**

```bash
pnpm i -g @leeguoo/zentao-mcp || npm i -g @leeguoo/zentao-mcp
```

**3. 验证安装**

```bash
zentao --help
```

**4. 引导登录**

提示用户提供禅道 URL、账号和密码，然后执行：

```bash
zentao login --zentao-url="<用户的禅道URL>" --zentao-account="<账号>" --zentao-password="<密码>"
```

> 注意：URL 通常需要包含 `/zentao`，如 `https://zentao.example.com/zentao`

**5. 验证**

```bash
zentao whoami
zentao self-test
```

全部通过后告知用户安装完成。

</details>

## 常见问题

**Q: 登录时报 404？**
A: URL 需要包含 `/zentao`，比如 `https://zentao.example.com/zentao`，而不是 `https://zentao.example.com/`。

**Q: 支持哪些禅道版本？**
A: 支持禅道开源版和企业版的 REST API（v1）。

**Q: 凭据安全吗？**
A: 凭据以明文 TOML 存储在 `~/.config/zentao/config.toml`，请确保文件权限安全。不要把配置文件提交到 Git。

## 链接

- [npm](https://www.npmjs.com/package/@leeguoo/zentao-mcp)
- [GitHub](https://github.com/leeguooooo/zentao-mcp)
- [问题反馈](https://github.com/leeguooooo/zentao-mcp/issues)

#!/usr/bin/env node
import process from "node:process";
import { extractCommand, hasHelpFlag } from "./cli/args.js";
import { printRootHelp } from "./cli/help.js";
import { runSelfTest } from "./commands/selftest.js";
import { runRelease } from "./commands/release.js";
import { runProducts } from "./commands/products.js";
import { runBugs } from "./commands/bugs.js";
import { runBug } from "./commands/bug.js";
import { runLogin } from "./commands/login.js";
import { runWhoami } from "./commands/whoami.js";
import { runTask } from "./commands/task.js";
import { runTasks } from "./commands/tasks.js";
import { runStory } from "./commands/story.js";
import { runStories } from "./commands/stories.js";
import { runUsers } from "./commands/users.js";
import { runExecutions } from "./commands/executions.js";
import { runPrograms } from "./commands/programs.js";
import { runProjects } from "./commands/projects.js";
import { runTodos } from "./commands/todos.js";
import { runTestcases } from "./commands/testcases.js";
import { runTesttasks } from "./commands/testtasks.js";
import { runTestsuites } from "./commands/testsuites.js";
import { runPlans } from "./commands/plans.js";
import { runReleases } from "./commands/releases.js";
import { runDepartments } from "./commands/departments.js";
import { runDocs } from "./commands/docs.js";
import { runIssues } from "./commands/issues.js";
import { runRisks } from "./commands/risks.js";

const COMMANDS = {
  "self-test": runSelfTest,
  release: runRelease,
  login: runLogin,
  whoami: runWhoami,
  products: runProducts,
  bugs: runBugs,
  bug: runBug,
  task: runTask,
  tasks: runTasks,
  story: runStory,
  stories: runStories,
  users: runUsers,
  executions: runExecutions,
  programs: runPrograms,
  projects: runProjects,
  todos: runTodos,
  testcases: runTestcases,
  testtasks: runTesttasks,
  testsuites: runTestsuites,
  plans: runPlans,
  releases: runReleases,
  departments: runDepartments,
  docs: runDocs,
  issues: runIssues,
  risks: runRisks,
};

// 每条命令跑完立刻 process.exit() 会在 Windows 上炸：
//   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c
// process.exit() 是同步的，libuv 里还有句柄正处在关闭中途时被强行拆掉就命中这条
// 断言（#1：self-test / login 等命令全都复现）。同样的同步退出在 Windows 管道下
// 还会截断没写完的 stdout。
//
// 所以正常路径只设 process.exitCode，让事件循环自己跑干净再退出。
// 唯一的风险是 fetch 的 keep-alive socket 可能把进程多吊住几秒，
// 所以留一个 unref 过的兜底定时器：它自己不会阻止退出，只在事件循环
// 真的空不下来时把进程收掉。
function scheduleExitFallback(code) {
  const timer = setTimeout(() => process.exit(code), 2000);
  if (typeof timer.unref === "function") timer.unref();
}

async function main() {
  const argv = process.argv.slice(2);
  const { command, argv: argvWithoutCommand } = extractCommand(argv);

  if (!command || hasHelpFlag(argv) || command === "help") {
    printRootHelp();
    return 0;
  }

  const handler = COMMANDS[command];
  if (!handler) throw new Error(`Unknown subcommand: ${command}`);

  await handler({ argv: argvWithoutCommand, env: process.env });
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = error?.exitCode || 1;
}
scheduleExitFallback(process.exitCode || 0);

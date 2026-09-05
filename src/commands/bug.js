import process from "node:process";
import { decodeEscapedNewlines, extractCommand, hasHelpFlag, parseCliArgs } from "../cli/args.js";
import { createClientFromCli } from "../zentao/client.js";
import { getBug, resolveBug, assignBug, commentBug, closeBug, activateBug, createBug } from "../zentao/bugs.js";

function printHelp() {
  process.stdout.write(`zentao bug - view and manage bugs\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao bug get --id <bugId> [--json]\n`);
  process.stdout.write(`  zentao bug resolve --id <bugId> --resolution <fixed|bydesign|duplicate|postponed|notrepro|willnotfix|tostory|external> [--resolved-build trunk] [--assigned-to <account>] [--comment "..."] [--json]\n`);
  process.stdout.write(`  zentao bug assign --id <bugId> --assigned-to <account> [--comment "..."] [--json]\n`);
  process.stdout.write(`  zentao bug comment --id <bugId> --comment "..." [--json]\n`);
  process.stdout.write(`  zentao bug create --product <id> --title "..." [--severity N] [--pri N] [--type codeerror|...] [--steps "..."] [--assigned-to account] [--opened-build trunk] [--json]\n`);
  process.stdout.write(`  zentao bug close --id <bugId> [--comment "..."] [--json]\n`);
  process.stdout.write(`  zentao bug activate --id <bugId> [--assigned-to account] [--comment "..."] [--json]\n`);
}

function formatAccount(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") return String(value.account || value.name || value.realname || "");
  return "";
}

export function formatBugSimple(bug) {
  const header = [
    "id",
    "title",
    "status",
    "pri",
    "severity",
    "assignedTo",
    "openedBy",
    "resolvedBy",
  ].join("\t");
  const row = [
    String(bug?.id ?? ""),
    String(bug?.title ?? ""),
    String(bug?.status ?? ""),
    String(bug?.pri ?? ""),
    String(bug?.severity ?? ""),
    formatAccount(bug?.assignedTo),
    formatAccount(bug?.openedBy),
    formatAccount(bug?.resolvedBy),
  ].join("\t");
  return `${header}\n${row}\n`;
}

export async function runBug({ argv = [], env = process.env } = {}) {
  if (hasHelpFlag(argv)) {
    printHelp();
    return;
  }

  const { command: sub, argv: argvWithoutSub } = extractCommand(argv);
  const cliArgs = parseCliArgs(argvWithoutSub);

  if (sub === "get") {
    return runBugGet(cliArgs, argvWithoutSub, env);
  }
  if (sub === "resolve") {
    return runBugResolve(cliArgs, argvWithoutSub, env);
  }
  if (sub === "assign") {
    return runBugAssign(cliArgs, argvWithoutSub, env);
  }
  if (sub === "comment") {
    return runBugComment(cliArgs, argvWithoutSub, env);
  }
  if (sub === "create") {
    return runBugCreate(cliArgs, argvWithoutSub, env);
  }
  if (sub === "close") {
    return runBugClose(cliArgs, argvWithoutSub, env);
  }
  if (sub === "activate") {
    return runBugActivate(cliArgs, argvWithoutSub, env);
  }

  throw new Error(`Unknown bug subcommand: ${sub || "(missing)"}`);
}

// 改状态的命令失败时必须让脚本知道：之前失败也只是往 stdout 打一段 JSON 然后
// 正常返回，退出码是 0，批量调用照样当成功——#3 里一次空关 10 个单就是这么过去的。
// 失败一律走 stderr + 非零退出码。
function failMutation(result) {
  process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  const err = new Error(result?.msg || "operation failed");
  err.exitCode = 1;
  throw err;
}

async function runBugGet(cliArgs, argv, env) {
  const id = cliArgs.id;
  if (!id) throw new Error("Missing --id");

  const api = createClientFromCli({ argv, env });
  const result = await getBug(api, { id });
  if (cliArgs.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const bug = result?.result?.bug ?? result?.result;
  if (!bug || typeof bug !== "object") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(formatBugSimple(bug));
}

async function runBugResolve(cliArgs, argv, env) {
  const id = cliArgs.id;
  if (!id) throw new Error("Missing --id");
  const resolution = cliArgs.resolution;
  if (!resolution) throw new Error("Missing --resolution (fixed|bydesign|duplicate|postponed|notrepro|willnotfix|tostory|external)");

  const api = createClientFromCli({ argv, env });
  const result = await resolveBug(api, {
    id,
    resolution,
    resolvedBuild: cliArgs["resolved-build"],
    assignedTo: cliArgs["assigned-to"],
    comment: decodeEscapedNewlines(cliArgs.comment),
  });

  if (result.status !== 1) failMutation(result);

  if (cliArgs.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const bug = result.result;
  process.stdout.write(`Bug #${bug.id} resolved (${bug.resolution || resolution}), assigned to ${formatAccount(bug.assignedTo)}\n`);
}

async function runBugAssign(cliArgs, argv, env) {
  const id = cliArgs.id;
  if (!id) throw new Error("Missing --id");
  const assignedTo = cliArgs["assigned-to"];
  if (!assignedTo) throw new Error("Missing --assigned-to <account>");

  const api = createClientFromCli({ argv, env });
  const result = await assignBug(api, {
    id,
    assignedTo,
    comment: decodeEscapedNewlines(cliArgs.comment),
  });

  if (cliArgs.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (result.status === 1) {
    const bug = result.result;
    process.stdout.write(`Bug #${bug.id} assigned to ${formatAccount(bug.assignedTo)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}

async function runBugComment(cliArgs, argv, env) {
  const id = cliArgs.id;
  if (!id) throw new Error("Missing --id");
  const comment = decodeEscapedNewlines(cliArgs.comment);
  if (!comment) throw new Error("Missing --comment");

  const api = createClientFromCli({ argv, env });
  const result = await commentBug(api, { id, comment });

  if (cliArgs.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (result.status === 1) {
    process.stdout.write(`Comment added to bug #${id}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}

async function runBugCreate(cliArgs, argv, env) {
  const product = cliArgs.product;
  if (!product) throw new Error("Missing --product <id>");
  const title = cliArgs.title;
  if (!title) throw new Error("Missing --title");

  const api = createClientFromCli({ argv, env });
  const result = await createBug(api, {
    product,
    title,
    severity: cliArgs.severity,
    pri: cliArgs.pri,
    type: cliArgs.type,
    steps: decodeEscapedNewlines(cliArgs.steps),
    assignedTo: cliArgs["assigned-to"],
    openedBuild: cliArgs["opened-build"],
  });

  if (cliArgs.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (result.status === 1) {
    const bug = result.result;
    process.stdout.write(`Bug #${bug.id} created: ${bug.title}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}

async function runBugClose(cliArgs, argv, env) {
  const id = cliArgs.id;
  if (!id) throw new Error("Missing --id");

  const api = createClientFromCli({ argv, env });
  const result = await closeBug(api, {
    id,
    comment: decodeEscapedNewlines(cliArgs.comment),
  });

  if (result.status !== 1) failMutation(result);

  if (cliArgs.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const bug = result.result;
  process.stdout.write(`Bug #${bug.id} closed\n`);
}

async function runBugActivate(cliArgs, argv, env) {
  const id = cliArgs.id;
  if (!id) throw new Error("Missing --id");

  const api = createClientFromCli({ argv, env });
  const result = await activateBug(api, {
    id,
    assignedTo: cliArgs["assigned-to"],
    comment: decodeEscapedNewlines(cliArgs.comment),
  });

  if (result.status !== 1) failMutation(result);

  if (cliArgs.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const bug = result.result;
  process.stdout.write(`Bug #${bug.id} activated, assigned to ${formatAccount(bug.assignedTo)}\n`);
}

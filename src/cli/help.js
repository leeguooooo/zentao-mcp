export function printRootHelp() {
  // Keep this plain text: many users run via npx and paste output.
  process.stdout.write(`zentao - ZenTao CLI\n\n`);
  process.stdout.write(`Install skill:\n`);
  process.stdout.write(`  npx skills add leeguooooo/zentao-mcp -y -g\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao login [--zentao-url ... --zentao-account ... --zentao-password ...] [--yes]\n`);
  process.stdout.write(`  zentao whoami\n`);
  process.stdout.write(`  zentao products list [--page N] [--limit N] [--json]\n`);
  process.stdout.write(`  zentao bugs list --product <id> [--page N] [--limit N] [--json]\n`);
  process.stdout.write(`  zentao bug get|resolve|assign|comment|create|close|activate ...\n`);
  process.stdout.write(
    `  zentao bugs mine [--scope ...] [--status ...] [--include-details] [--json]\n`
  );
  process.stdout.write(
    `  zentao bugs stats --product-ids 1,2 --group-by product|person [--from DATE] [--to DATE] [--json]\n`
  );
  process.stdout.write(`  zentao task get|create|start|finish|close ...\n`);
  process.stdout.write(`  zentao tasks list --execution <id> [--json]\n`);
  process.stdout.write(`  zentao story get|create ...\n`);
  process.stdout.write(`  zentao stories list --product <id> [--json]\n`);
  process.stdout.write(`  zentao users list [--json]\n`);
  process.stdout.write(`  zentao executions list [--json]\n`);
  process.stdout.write(`  zentao programs list [--json]\n`);
  process.stdout.write(`  zentao projects list|builds ...\n`);
  process.stdout.write(`  zentao todos list|get|create|finish|close ...\n`);
  process.stdout.write(`  zentao plans list|get --product <id> [--json]\n`);
  process.stdout.write(`  zentao releases list|get --product <id> [--json]\n`);
  process.stdout.write(`  zentao testcases list|get --product <id> [--json]\n`);
  process.stdout.write(`  zentao testtasks list|get [--json]\n`);
  process.stdout.write(`  zentao testsuites list|get --product <id> [--json]\n`);
  process.stdout.write(`  zentao departments list [--json]\n`);
  process.stdout.write(`  zentao docs libs|list|get ...\n`);
  process.stdout.write(`  zentao issues list|get [--json]\n`);
  process.stdout.write(`  zentao risks list|get [--json]\n`);
  process.stdout.write(`  zentao self-test [--expected N]\n`);
  process.stdout.write(`  zentao release [patch|minor|major] [--dry-run] [--yes]\n\n`);
  process.stdout.write(`Auth options:\n`);
  process.stdout.write(`  --zentao-url        or env ZENTAO_URL\n`);
  process.stdout.write(`  --zentao-account    or env ZENTAO_ACCOUNT\n`);
  process.stdout.write(`  --zentao-password   or env ZENTAO_PASSWORD\n`);
  process.stdout.write(`  --help, -h          show help\n\n`);
  process.stdout.write(`Subcommands:\n`);
  process.stdout.write(`  login               save credentials locally\n`);
  process.stdout.write(`  whoami              show current account\n`);
  process.stdout.write(`  products            ZenTao products\n`);
  process.stdout.write(`  bugs                ZenTao bugs\n`);
  process.stdout.write(`  bug                 ZenTao bug (get/resolve/assign/comment/create/close/activate)\n`);
  process.stdout.write(`  task                ZenTao task (get/create/start/finish/close)\n`);
  process.stdout.write(`  tasks               ZenTao tasks (list)\n`);
  process.stdout.write(`  story               ZenTao story (get/create)\n`);
  process.stdout.write(`  stories             ZenTao stories (list)\n`);
  process.stdout.write(`  users               ZenTao users (list)\n`);
  process.stdout.write(`  executions          ZenTao executions (list)\n`);
  process.stdout.write(`  programs            ZenTao programs (list)\n`);
  process.stdout.write(`  projects            ZenTao projects (list/builds)\n`);
  process.stdout.write(`  todos               ZenTao todos (list/get/create/finish/close)\n`);
  process.stdout.write(`  plans               product plans (list/get)\n`);
  process.stdout.write(`  releases            product releases (list/get)\n`);
  process.stdout.write(`  testcases           test cases (list/get)\n`);
  process.stdout.write(`  testtasks           test tasks (list/get)\n`);
  process.stdout.write(`  testsuites          test suites (list/get)\n`);
  process.stdout.write(`  departments         departments (list)\n`);
  process.stdout.write(`  docs                doc libs & docs (libs/list/get)\n`);
  process.stdout.write(`  issues              project issues (list/get)\n`);
  process.stdout.write(`  risks               project risks (list/get)\n`);
  process.stdout.write(`  self-test           run a basic API roundtrip\n`);
  process.stdout.write(`  release             version bump + tag + gh release + npm publish\n`);
}

export function printSelfTestHelp() {
  process.stdout.write(`zentao self-test - verify API access\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao self-test --zentao-url=... --zentao-account=... --zentao-password=...\n`);
  process.stdout.write(`  ZENTAO_URL=... ZENTAO_ACCOUNT=... ZENTAO_PASSWORD=... zentao self-test\n\n`);
  process.stdout.write(`Options:\n`);
  process.stdout.write(`  --expected N         exit 2 if total != N\n`);
  process.stdout.write(`  --help, -h           show help\n`);
}

export function printReleaseHelp() {
  process.stdout.write(`zentao release - create a new release\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  zentao release [patch|minor|major] [--dry-run] [--yes]\n\n`);
  process.stdout.write(`Options:\n`);
  process.stdout.write(`  --dry-run            print planned commands, do not run\n`);
  process.stdout.write(`  --yes                auto-confirm prompts (dirty git, npm login)\n`);
  process.stdout.write(`  --skip-push           do not push commits/tags\n`);
  process.stdout.write(`  --skip-github-release do not create GitHub release\n`);
  process.stdout.write(`  --skip-publish        do not npm publish\n`);
  process.stdout.write(`  --help, -h            show help\n`);
}

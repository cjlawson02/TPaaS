import { execSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

const devVars = ".dev.vars";
const devVarsTmp = ".dev.vars.__types_tmp";
const moved = existsSync(devVars);

if (moved) {
  renameSync(devVars, devVarsTmp);
}

try {
  const check = process.argv.includes("--check") ? " --check" : "";
  execSync(
    `wrangler types worker-configuration.d.ts --env-interface TpaasEnv${check}`,
    { stdio: "inherit" },
  );
} finally {
  if (moved && existsSync(devVarsTmp)) {
    renameSync(devVarsTmp, devVars);
  }
}

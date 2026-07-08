// C9 (tier b): npm does not enforce the `engines.bun` constraint, so
// `npm install -g codetrap` succeeds on a Node-only machine and then every
// invocation dies with "env: 'bun': No such file or directory". This runs
// under Node (npm's own runtime), so if it runs at all we can cheaply check
// whether the Bun runtime codetrap actually needs is present and, if not,
// print the same escape hatch as bin/codetrap. It must never fail the install.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const RELEASES_URL = "https://github.com/woertedetiankong/codetrap/releases";

export function bunMissingWarning() {
  return [
    "",
    "  codetrap runs on the Bun runtime, which was not found on your PATH.",
    "  It installed, but `codetrap` will not run until Bun is available.",
    "",
    "  Install Bun:",
    "    curl -fsSL https://bun.sh/install | bash",
    "    # or: npm install -g bun",
    "",
    "  Or download a prebuilt binary (no Bun needed):",
    `    ${RELEASES_URL}`,
    "",
  ].join("\n");
}

export function isBunInstalled(spawn = spawnSync) {
  try {
    const result = spawn("bun", ["--version"], { stdio: "ignore" });
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
}

export function warnIfBunMissing({ installed = isBunInstalled(), warn = (message) => console.warn(message) } = {}) {
  if (installed) return false;
  warn(bunMissingWarning());
  return true;
}

const isMainModule = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  try {
    warnIfBunMissing();
  } catch {
    // Never break `npm install` over a warning.
  }
}

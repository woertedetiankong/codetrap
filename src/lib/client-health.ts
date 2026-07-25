import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  BUNDLED_SKILLS,
  CLIENT_SPECS,
  resolveClientHome,
  TEMPLATE_MARKER,
  type SetupClient,
} from "./client-setup";
import type { DoctorNextAction } from "./doctor";

// Per-client integration health (roadmap §13.3 / §4.5): doctor reports, for
// each supported client, whether the bundled skills are installed and current,
// whether the project guidance file carries the codetrap template, and whether
// MCP registration is visible. Report-only for clients that are not integrated
// at all; next_actions fire only for broken or stale installs.
export type ClientMcpRegistration = "yes" | "no" | "unknown";

export type ClientHealth = {
  client: SetupClient;
  detected: boolean;
  home: string;
  skills: {
    current: string[];
    outdated: string[];
    missing: string[];
  };
  guidance: {
    path: string;
    present: boolean;
    current: boolean;
  } | null;
  mcp: {
    registered: ClientMcpRegistration;
  };
  setup_command: string;
};

export function buildClientHealth(
  client: SetupClient,
  projectRoot: string | null,
  clientHome?: string
): ClientHealth {
  const spec = CLIENT_SPECS[client];
  const home = resolveClientHome(client, clientHome);
  const skills = skillsHealth(home);
  const guidance = projectRoot ? guidanceHealth(projectRoot, spec.guidanceFile) : null;

  return {
    client,
    detected: existsSync(home),
    home,
    skills,
    guidance,
    mcp: { registered: mcpRegistration(client, home, projectRoot) },
    setup_command: `codetrap setup ${client}`,
  };
}

export function allClientHealth(projectRoot: string | null): ClientHealth[] {
  return (Object.keys(CLIENT_SPECS) as SetupClient[]).map((client) =>
    buildClientHealth(client, projectRoot)
  );
}

// A partial or stale install is actionable (setup is idempotent and
// self-healing, §4.5); a client with nothing installed may be deliberate, so
// it is reported but never nagged about.
export function clientNextActions(clients: ClientHealth[]): DoctorNextAction[] {
  const actions: DoctorNextAction[] = [];
  for (const health of clients) {
    if (!health.detected) continue;
    const label = CLIENT_SPECS[health.client].label;
    const installedCount = health.skills.current.length + health.skills.outdated.length;
    const partialSkills = installedCount > 0 && health.skills.missing.length > 0;
    const staleSkills = health.skills.outdated.length > 0;
    const staleGuidance = health.guidance !== null && health.guidance.present && !health.guidance.current;
    if (partialSkills || staleSkills || staleGuidance) {
      const reasons = [
        staleSkills ? `${health.skills.outdated.length} skill(s) differ from this codetrap build` : null,
        partialSkills ? `${health.skills.missing.length} bundled skill(s) missing` : null,
        staleGuidance ? `${health.guidance!.path} lacks the codetrap guidance section` : null,
      ].filter((reason): reason is string => reason !== null);
      actions.push({
        command: health.setup_command,
        reason: `${label} integration needs a refresh (${reasons.join("; ")}).`,
      });
    }
  }
  return actions;
}

export function formatClientHealthText(clients: ClientHealth[]): string[] {
  return clients.map((health) => {
    const total = BUNDLED_SKILLS.length;
    if (!health.detected) {
      return `  ${health.client}: not detected (${health.home} missing); run '${health.setup_command}' to integrate`;
    }
    const guidance = health.guidance
      ? health.guidance.present
        ? health.guidance.current
          ? "current"
          : "missing codetrap section"
        : "absent"
      : "(no project)";
    return [
      `  ${health.client}: skills ${health.skills.current.length}/${total} current`,
      health.skills.outdated.length > 0 ? `${health.skills.outdated.length} outdated` : null,
      `guidance ${guidance}`,
      `mcp ${health.mcp.registered}`,
    ]
      .filter((part): part is string => part !== null)
      .join(", ");
  });
}

function skillsHealth(home: string): ClientHealth["skills"] {
  const current: string[] = [];
  const outdated: string[] = [];
  const missing: string[] = [];
  for (const bundled of BUNDLED_SKILLS) {
    const installedPath = join(home, "skills", bundled.name, "SKILL.md");
    const installed = safeRead(installedPath);
    if (installed === null) missing.push(bundled.name);
    else if (installed === bundled.skill) current.push(bundled.name);
    else outdated.push(bundled.name);
  }
  return { current, outdated, missing };
}

function guidanceHealth(projectRoot: string, guidanceFile: string): NonNullable<ClientHealth["guidance"]> {
  const path = join(projectRoot, guidanceFile);
  const content = safeRead(path);
  return {
    path,
    present: content !== null,
    current: content !== null && content.includes(TEMPLATE_MARKER),
  };
}

// Best-effort registration probe: look for "codetrap" in the client's known
// MCP config locations. No config file readable → "unknown", never a guess.
function mcpRegistration(
  client: SetupClient,
  home: string,
  projectRoot: string | null
): ClientMcpRegistration {
  const candidates =
    client === "codex"
      ? [join(home, "config.toml")]
      : [
          join(home, ".claude.json"),
          join(process.env.HOME ?? process.env.USERPROFILE ?? homedir(), ".claude.json"),
          ...(projectRoot ? [join(projectRoot, ".mcp.json")] : []),
        ];
  let sawConfig = false;
  for (const candidate of candidates) {
    const content = safeRead(candidate);
    if (content === null) continue;
    sawConfig = true;
    if (content.includes("codetrap")) return "yes";
  }
  return sawConfig ? "no" : "unknown";
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

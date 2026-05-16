import { describe, expect, test } from "bun:test";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { toTrapActionCard } from "../lib/search-result-card";
import { trap } from "./helpers";

describe("trap action cards", () => {
  test("maps search results to compact drill-down cards with id and scope", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    repo.add(trap());

    const [result] = await repo.search("fetchWrapper", { mode: "fts" });
    const card = toTrapActionCard(result, "project");

    expect(card).toMatchObject({
      trap_id: result.trap.id,
      scope: "project",
      title: "Use fetchWrapper for HTTP requests",
      why_relevant: "When making network requests, use the project fetchWrapper.",
      avoid: "Calling fetch or axios directly bypasses retry and error handling.",
      do_instead: "Use fetchWrapper and follow the HTTP request convention.",
      severity: "warning",
      sources: ["fts"],
      next_action: {
        details_tool: "get_trap",
        details_args: { id: result.trap.id, scope: "project" },
      },
    });
    expect(card.score).not.toBeNull();
  });

  test("preserves scope when project and global traps have the same id", async () => {
    const projectRepo = new TrapRepository(openDatabase(":memory:"));
    const globalRepo = new TrapRepository(openDatabase(":memory:"));
    projectRepo.add(trap({ scope: "project", title: "Project fetchWrapper rule" }));
    globalRepo.add(trap({ scope: "global", title: "Global fetchWrapper rule" }));

    const [projectResult] = await projectRepo.search("fetchWrapper", { mode: "fts" });
    const [globalResult] = await globalRepo.search("fetchWrapper", { mode: "fts" });
    expect(projectResult.trap.id).toBe(globalResult.trap.id);

    const projectCard = toTrapActionCard(projectResult, "project");
    const globalCard = toTrapActionCard(globalResult, "global");

    expect(projectCard.next_action.details_args).toEqual({ id: projectResult.trap.id, scope: "project" });
    expect(globalCard.next_action.details_args).toEqual({ id: globalResult.trap.id, scope: "global" });
  });
});

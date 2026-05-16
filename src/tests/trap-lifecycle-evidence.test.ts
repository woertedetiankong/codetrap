import { describe, expect, test } from "bun:test";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { trap } from "./helpers";

describe("trap lifecycle and evidence", () => {
  test("schema v4 initializes lifecycle fields and evidence table", () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    const id = repo.add(trap());
    const details = repo.getDetails(id, "global");

    expect(details?.trap.status).toBe("active");
    expect(details?.trap.valid_from).toBeTruthy();
    expect(details?.trap.valid_until).toBeNull();
    expect(details?.evidence).toEqual([]);
  });

  test("default search excludes archived traps while status=all preserves history", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    const id = repo.add(trap({ title: "Old fetchWrapper convention" }));

    expect(repo.archive(id)).toBe(true);

    const activeResults = await repo.search("Old fetchWrapper convention", { mode: "fts" });
    expect(activeResults).toHaveLength(0);

    const allResults = await repo.search("Old fetchWrapper convention", { mode: "fts", status: "all" });
    expect(allResults.map((result) => result.trap.id)).toContain(id);
    expect(allResults[0]?.trap.status).toBe("archived");
  });

  test("supersede updates both traps in one lifecycle operation", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    const oldId = repo.add(trap({ title: "Old API convention", context: "legacyonly api convention" }));
    const newId = repo.add(trap({ title: "New API convention", context: "modernonly api convention" }));

    expect(repo.supersede(oldId, newId, "api-convention")).toBe(true);

    const oldTrap = repo.get(oldId);
    const newTrap = repo.get(newId);
    expect(oldTrap?.status).toBe("superseded");
    expect(oldTrap?.state_key).toBe("api-convention");
    expect(oldTrap?.valid_until).toBeTruthy();
    expect(newTrap?.status).toBe("active");
    expect(newTrap?.state_key).toBe("api-convention");
    expect(newTrap?.supersedes_id).toBe(oldId);

    const activeResults = await repo.search("legacyonly", { mode: "fts" });
    expect(activeResults).toHaveLength(0);
    const historicalResults = await repo.search("legacyonly", { mode: "fts", status: "all" });
    expect(historicalResults.map((result) => result.trap.id)).toContain(oldId);
  });

  test("supersede rejects self-supersession", () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    const id = repo.add(trap());

    expect(repo.supersede(id, id, "self")).toBe(false);
    expect(repo.get(id)?.status).toBe("active");
  });

  test("getDetails returns evidence while search results stay compact", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    const id = repo.add(trap());

    const evidenceId = repo.addEvidence(id, {
      source_type: "commit",
      source_ref: "abc123",
      related_files: ["src/api.ts"],
      note: "Fixed after review.",
    });

    expect(typeof evidenceId).toBe("number");
    const details = repo.getDetails(id, "global");
    expect(details?.evidence).toHaveLength(1);
    expect(details?.evidence[0]).toMatchObject({
      trap_id: id,
      source_type: "commit",
      source_ref: "abc123",
      note: "Fixed after review.",
    });
    expect(JSON.parse(details?.evidence[0]?.related_files ?? "[]")).toEqual(["src/api.ts"]);

    const [result] = await repo.search("fetchWrapper", { mode: "fts" });
    expect("evidence" in result.trap).toBe(false);
  });
});

import type { Database } from "bun:sqlite";
import type { Trap, TrapUpdate } from "../domain/trap";
import { revisionFields, trapRevisionHash, type RevisionCommit, type RevisionDraft } from "../domain/experience-revision";
import { getTrap } from "./queries";

const TABLE = "experience_revision_commits";
export function readRevisionCommit(db: Database, id: string, owner: string): RevisionCommit | null {
  if (!db.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(TABLE)) return null;
  const row = db.query(`SELECT receipt FROM ${TABLE} WHERE id=? AND owner=?`).get(id, owner) as { receipt: string } | null;
  return row ? JSON.parse(row.receipt) : null;
}
function requireActive(db: Database, id: number): Trap {
  const trap = getTrap(db, id);
  if (!trap || trap.status !== "active" || trap.graduated_at) throw new Error("The lesson is missing, retired, or graduated. Reopen its current state before revising.");
  return trap;
}
function stamp(db: Database, trap: Trap): Trap {
  const previous = Date.parse(trap.updated_at.includes("T") ? trap.updated_at : trap.updated_at.replace(" ", "T") + "Z");
  const at = new Date(Math.max(Date.now(), (Number.isFinite(previous) ? previous : 0) + 1)).toISOString();
  db.query("UPDATE traps SET updated_at=? WHERE id=?").run(at, trap.id);
  return getTrap(db, trap.id)!;
}
/** The mutation and its receipt use one immediate transaction, including on global stores. */
export function acceptRevision(db: Database, draft: RevisionDraft, update: (id: number, fields: TrapUpdate) => boolean): RevisionCommit {
  return db.transaction(() => {
    const prior = readRevisionCommit(db, draft.id, draft.owner);
    if (prior) {
      if (prior.digest !== draft.digest || prior.status !== "accepted") throw new Error("This revision was already finalized with a different state.");
      return prior;
    }
    const before = requireActive(db, draft.source.trap_id);
    if (before.scope !== draft.source.scope || trapRevisionHash(before) !== draft.base_hash) throw new Error("The lesson changed after this draft was created. Start a new revision from the current lesson.");
    db.exec(`CREATE TABLE IF NOT EXISTS ${TABLE} (id TEXT PRIMARY KEY, owner TEXT NOT NULL, receipt TEXT NOT NULL)`);
    if (!update(before.id, draft.fields)) throw new Error("The lesson could not be updated.");
    const after = stamp(db, before);
    const receipt: RevisionCommit = { id: draft.id, owner: draft.owner, scope: draft.source.scope, trap_id: before.id,
      source: draft.source, digest: draft.digest, before, after, status: "accepted", accepted_at: after.updated_at,
      rolled_back_at: null, rollback_revision: null };
    db.query(`INSERT INTO ${TABLE} (id, owner, receipt) VALUES (?, ?, ?)`).run(receipt.id, receipt.owner, JSON.stringify(receipt));
    return receipt;
  }).immediate();
}
export function rollbackRevision(db: Database, id: string, owner: string, update: (id: number, fields: TrapUpdate) => boolean): RevisionCommit {
  return db.transaction(() => {
    const receipt = readRevisionCommit(db, id, owner);
    if (!receipt) throw new Error("No accepted revision exists for this project.");
    if (receipt.status === "rolled_back") return receipt;
    const current = requireActive(db, receipt.trap_id);
    if (trapRevisionHash(current) !== trapRevisionHash(receipt.after)) throw new Error("The lesson changed after acceptance. Rollback will not overwrite later work.");
    if (!update(current.id, revisionFields(receipt.before))) throw new Error("The lesson could not be restored.");
    const restored = stamp(db, current);
    const next: RevisionCommit = { ...receipt, status: "rolled_back", rolled_back_at: restored.updated_at, rollback_revision: `${receipt.scope}:${restored.updated_at}` };
    db.query(`UPDATE ${TABLE} SET receipt=? WHERE id=? AND owner=?`).run(JSON.stringify(next), id, owner);
    return next;
  }).immediate();
}

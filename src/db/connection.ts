import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { getGlobalDB, getProjectDB } from "../lib/scope";
import { initSchema } from "./schema";

const globalDBs = new Map<string, Database>();
const projectDBs = new Map<string, Database>();

export function openDatabase(path = ":memory:"): Database {
  // L5: creating the DB is where the directory should come into being — SQLite
  // won't create missing parent directories, and path resolution no longer does.
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  configureDatabase(db);
  return db;
}

export function openGlobal(home?: string): Database {
  const path = getGlobalDB(home);
  if (!globalDBs.has(path)) {
    globalDBs.set(path, openDatabase(path));
  }
  return globalDBs.get(path)!;
}

export function openProject(root: string): Database {
  const path = getProjectDB(root);
  if (!projectDBs.has(path)) {
    const db = openDatabase(path);
    projectDBs.set(path, db);
  }
  return projectDBs.get(path)!;
}

function configureDatabase(db: Database): void {
  db.exec("PRAGMA busy_timeout=5000");
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");
  initSchema(db);
}

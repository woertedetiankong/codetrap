import { Database } from "bun:sqlite";
import { getGlobalDB, getProjectDB } from "../lib/scope";
import { initSchema } from "./schema";

let globalDB: Database | null = null;
const projectDBs = new Map<string, Database>();

export function openDatabase(path = ":memory:"): Database {
  const db = new Database(path);
  configureDatabase(db);
  return db;
}

export function openGlobal(): Database {
  if (!globalDB) {
    const path = getGlobalDB();
    globalDB = openDatabase(path);
  }
  return globalDB;
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
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("PRAGMA busy_timeout=5000");
  initSchema(db);
}

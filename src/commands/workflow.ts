import { TrapStore } from "../lib/store";
import { TrapOperations } from "../lib/trap-operations";
import { errorResult, type CommandResult } from "./command-result";
import { errorFrom } from "./command-args";
import {
  cmdAdd,
  cmdAddTrapEvidence,
  cmdArchiveTrap,
  cmdDelete,
  cmdEdit,
  cmdExport,
  cmdImport,
  cmdList,
  cmdSearch,
  cmdShow,
  cmdPack,
  cmdUseful,
  cmdStats,
  cmdSupersedeTrap,
} from "./trap-commands";
import { cmdSession } from "./session-commands";
import { cmdLearn } from "./learn-commands";
import { cmdPhase2 } from "./phase2-commands";
import { cmdPhase3 } from "./phase3-commands";
import {
  cmdDoctor,
  cmdEmbed,
  cmdEmbeddings,
  cmdInit,
  cmdScopeMigration,
  cmdSetup,
} from "./maintenance-commands";

export async function executeCommand(strip: string[], store: TrapStore): Promise<CommandResult> {
  const sub = strip[0];
  const args = strip.slice(1);
  try {
    return await dispatchCommand(sub, args, store);
  } catch (error) {
    return errorFrom(error, args);
  }
}

async function dispatchCommand(sub: string, args: string[], store: TrapStore): Promise<CommandResult> {
  const operations = new TrapOperations(store);

  switch (sub) {
    case "add":
      return cmdAdd(args, operations);
    case "search":
      return cmdSearch(args, operations);
    case "list":
      return cmdList(args, operations);
    case "show":
      return cmdShow(args, operations);
    case "useful":
      return cmdUseful(args, operations);
    case "pack":
      return cmdPack(args, operations, store.getProjectRoot());
    case "edit":
      return cmdEdit(args, operations);
    case "delete":
    case "rm":
      return cmdDelete(args, operations);
    case "add_trap_evidence":
    case "add-evidence":
      return cmdAddTrapEvidence(args, operations);
    case "archive_trap":
    case "archive":
      return cmdArchiveTrap(args, operations);
    case "supersede_trap":
    case "supersede":
      return cmdSupersedeTrap(args, operations);
    case "init":
      return cmdInit(args, store);
    case "export":
      return cmdExport(args, operations);
    case "import":
      return cmdImport(args, operations);
    case "stats":
      return cmdStats(args, operations);
    case "doctor":
      return cmdDoctor(args, store, operations);
    case "setup":
      return cmdSetup(args);
    case "repair-scope":
      return cmdScopeMigration("repair-scope", args, operations);
    case "migrate-project":
      return cmdScopeMigration("migrate-project", args, operations);
    case "embed":
      return cmdEmbed(args, store);
    case "embeddings":
      return cmdEmbeddings(args, store);
    case "learn":
      return cmdLearn(args, store, operations);
    case "session":
      return cmdSession(args, store, operations);
    case "phase2":
      return cmdPhase2(args, store, operations);
    case "phase3":
      return cmdPhase3(args, store, operations);
    default:
      return errorResult([
        `Unknown command: ${sub}`,
        "Commands: init, add, search, list, show, useful, pack, edit, delete, add_trap_evidence, archive_trap, supersede_trap, export, import, stats, doctor, setup, repair-scope, migrate-project, embed, embeddings, session, learn, phase2, phase3",
      ].join("\n"));
  }
}

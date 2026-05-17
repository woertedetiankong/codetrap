import { TrapStore } from "../lib/store";
import { renderCommandResult, type CommandResult } from "./command-result";
import { executeCommand as executeWorkflow, parseArgs } from "./workflow";

export { parseArgs };

export async function run(strip: string[], store: TrapStore): Promise<void> {
  renderCommandResult(await executeWorkflow(strip, store));
}

export async function executeCommand(strip: string[], store: TrapStore): Promise<CommandResult> {
  return executeWorkflow(strip, store);
}

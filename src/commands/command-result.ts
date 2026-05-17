export type CommandResult = {
  exitCode: number;
  stdout?: string;
  stderr?: string;
};

export function textResult(stdout = "", exitCode = 0): CommandResult {
  return { exitCode, stdout };
}

export function jsonResult(value: unknown, exitCode = 0): CommandResult {
  return textResult(JSON.stringify(value, null, 2), exitCode);
}

export function errorResult(message: string, exitCode = 1): CommandResult {
  return { exitCode, stderr: message };
}

export function renderCommandResult(result: CommandResult): void {
  if (result.stdout !== undefined && result.stdout !== "") {
    console.log(result.stdout);
  }
  if (result.stderr !== undefined && result.stderr !== "") {
    console.error(result.stderr);
  }
  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

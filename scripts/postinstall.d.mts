export function bunMissingWarning(): string;
export function isBunInstalled(
  spawn?: (command: string, args: string[], options?: unknown) => { error?: unknown; status: number | null }
): boolean;
export function warnIfBunMissing(options?: {
  installed?: boolean;
  warn?: (message: string) => void;
}): boolean;

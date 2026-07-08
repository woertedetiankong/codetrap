// Single source of truth for the codetrap version string used by the CLI
// (`--version`) and the MCP server handshake. tsconfig `rootDir` is `src`, so
// package.json can't be imported here; scripts/check-release-version.ts asserts
// this constant matches package.json "version" at release time (L7/L9).
export const CODETRAP_VERSION = "0.1.9";

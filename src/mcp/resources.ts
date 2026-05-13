export const resourceDefinitions = [
  {
    uri: "codetrap://project/recent",
    name: "Project Recent Traps",
    description: "The 10 most recently updated traps in the current project",
    mimeType: "application/json",
  },
  {
    uri: "codetrap://global/recent",
    name: "Global Recent Traps",
    description: "The 10 most recently updated traps in the global database",
    mimeType: "application/json",
  },
  {
    uri: "codetrap://project/top",
    name: "Project Top Traps",
    description: "The 20 most frequently hit traps in the current project",
    mimeType: "application/json",
  },
  {
    uri: "codetrap://global/top",
    name: "Global Top Traps",
    description: "The 20 most frequently hit traps in the global database",
    mimeType: "application/json",
  },
];

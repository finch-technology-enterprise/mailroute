import { execFileSync, spawnSync } from "node:child_process";

const prettierExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

function gitLines(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function extension(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
}

let files;
if (process.env.GIT_DIFF_BASE) {
  files = gitLines([
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    `${process.env.GIT_DIFF_BASE}...HEAD`,
  ]);
} else if (process.env.GITHUB_BASE_REF) {
  files = gitLines([
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    `origin/${process.env.GITHUB_BASE_REF}...HEAD`,
  ]);
} else if (process.env.CI) {
  files = gitLines([
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    "HEAD^",
    "HEAD",
  ]);
} else {
  files = [
    ...gitLines(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]),
    ...gitLines(["ls-files", "--others", "--exclude-standard"]),
  ];
}

const formattedFiles = [...new Set(files)].filter((path) =>
  prettierExtensions.has(extension(path)),
);

if (formattedFiles.length === 0) {
  console.log("No changed files require a Prettier check.");
  process.exit(0);
}

const result = spawnSync("npx", ["prettier", "--check", ...formattedFiles], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);

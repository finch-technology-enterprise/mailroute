import { execSync } from "child_process";
import path from "path";

export default async function globalSetup() {
  const rootDir = path.resolve(__dirname, "..");

  execSync("npm run build:admin", { cwd: rootDir, stdio: "inherit" });
}

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(project, "node_modules", "wrangler", "bin", "wrangler.js");
const child = spawn(process.execPath, [wrangler, "dev", "--config", "wrangler.dev.jsonc", "--local", "--port", process.env.PORT || "4173"], {
  cwd: project,
  stdio: "inherit",
});

child.on("error", (error) => {
  process.stderr.write(`No se pudo iniciar Wrangler. Ejecuta npm install. ${error.message}\n`);
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, writeJson } from "./env.js";

const APP = path.join(ROOT, "apps/tictactoe");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function discover() {
  const findings = [];
  const files = walk(path.join(APP, "src")).filter((f) => f.endsWith(".js"));
  const testDir = path.join(APP, "test");
  const tests = fs.existsSync(testDir)
    ? walk(testDir).filter((f) => f.endsWith(".js"))
    : [];
  const testBlob = tests.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const allSrc = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  for (const file of files) {
    const rel = path.relative(ROOT, file).replaceAll("\\", "/");
    const source = fs.readFileSync(file, "utf8");
    const exported = [...source.matchAll(/export function ([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    for (const name of exported) {
      const mentionedInTests = testBlob.includes(name);
      if (name.startsWith("unused")) {
        findings.push({
          severity: "low",
          kind: "dead_code",
          where: rel,
          detail: `${name} is exported and never imported. Safe to delete.`,
        });
        continue;
      }
      const uses = stripComments(allSrc).split(new RegExp(`\\b${name}\\b`)).length - 1;
      if (uses <= 1) {
        findings.push({
          severity: "medium",
          kind: "dead_code",
          where: rel,
          detail: `${name} appears unused outside its definition.`,
        });
      } else if (!mentionedInTests && ["loadState", "saveState", "clearState"].includes(name)) {
        findings.push({
          severity: "low",
          kind: "missing_tests",
          where: rel,
          detail: `${name} has no direct mention in tests.`,
        });
      }
    }
    if (/TODO|FIXME/.test(source)) {
      findings.push({
        severity: "low",
        kind: "todo",
        where: rel,
        detail: "File contains TODO/FIXME comments.",
      });
    }
  }

  const ui = fs.readFileSync(path.join(APP, "src/ui.js"), "utf8");
  if (!/keydown|keyboard/i.test(ui)) {
    findings.push({
      severity: "medium",
      kind: "a11y",
      where: "apps/tictactoe/src/ui.js",
      detail: "Board is click-only. Keyboard users cannot move between cells.",
    });
  }
  if (!/aria-live/.test(ui)) {
    findings.push({
      severity: "low",
      kind: "a11y",
      where: "apps/tictactoe/src/ui.js",
      detail: "Status text is not announced (no aria-live).",
    });
  }

  const testRun = spawnSync(process.execPath, ["--test", "apps/tictactoe/test/game.test.js"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (testRun.status !== 0) {
    findings.push({
      severity: "high",
      kind: "failing_tests",
      where: "apps/tictactoe/test/game.test.js",
      detail: testRun.stderr || testRun.stdout,
    });
  }

  const report = {
    at: new Date().toISOString(),
    summary: {
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
    },
    findings,
  };
  writeJson(path.join(ROOT, "loop/state/discoveries.json"), report);
  return report;
}

if (process.argv[1] && path.basename(process.argv[1]) === "discover.js") {
  const report = discover();
  console.log(JSON.stringify(report, null, 2));
  if (report.summary.high) process.exit(2);
}

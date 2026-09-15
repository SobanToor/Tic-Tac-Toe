import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, PENDING_PATH, remember, slug, writeJson } from "./env.js";
import { listOpenIssues, setIssueState, commentOnIssue } from "./linear.js";
import { hasGit, runGit, openPullRequest, mergePullRequest } from "./github.js";
import { implementTicket } from "./implement.js";
import { reviewPullRequest } from "./review.js";
import { discover } from "./discover.js";

function runTests() {
  const result = spawnSync(process.execPath, ["--test", "apps/tictactoe/test/game.test.js"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { ok: result.status === 0, output: result.stdout + result.stderr };
}

function planner(issue) {
  return [
    `Plan for ${issue.identifier}: ${issue.title}`,
    "1. Keep rules in src/game.js; do not fork win logic into the UI.",
    "2. Change only files the ticket needs.",
    "3. Run node tests before opening a PR.",
    "4. Leave a Linear comment with the PR URL.",
  ].join("\n");
}

export async function runCycle({ identifier } = {}) {
  const open = await listOpenIssues();
  const issue =
    (identifier && open.find((i) => i.identifier === identifier)) ||
    open.find((i) => /keyboard/i.test(i.title)) ||
    open[0];
  if (!issue) {
    throw new Error("No open tickets. Run `npm run loop:bootstrap` first.");
  }

  await setIssueState(issue, "progress");
  const plan = planner(issue);
  remember(`Picked up ${issue.identifier}`, plan);
  await commentOnIssue(issue, ["## Plan", "", plan].join("\n"));

  const impl = implementTicket(issue);
  const tests = runTests();
  if (!tests.ok) {
    await commentOnIssue(issue, `Tests failed:\n\n\`\`\`\n${tests.output}\n\`\`\``);
    throw new Error("Tests failed; not opening a PR.");
  }

  const discoveries = discover();
  const branch = `agent/${issue.identifier}-${slug(issue.title)}`;
  let sha = "working-tree";
  if (hasGit()) {
    try {
      runGit(["checkout", "-B", branch]);
      if (impl.changed.length) runGit(["add", ...impl.changed]);
      runGit(["add", "loop/state/discoveries.json"]);
      runGit(["status"]);
      const staged = spawnSync("git", ["diff", "--cached", "--name-only"], {
        cwd: ROOT,
        encoding: "utf8",
      });
      if (staged.stdout.trim()) {
        runGit(["commit", "-m", `${issue.identifier}: ${issue.title}`]);
      }
      sha = runGit(["rev-parse", "--short", "HEAD"]);
      try {
        runGit(["push", "-u", "origin", branch]);
      } catch (err) {
        process.stderr.write(`Push skipped: ${err.message}\n`);
      }
    } catch (err) {
      process.stderr.write(`Git step skipped: ${err.message}\n`);
    }
  }

  await setIssueState(issue, "review");
  const pr = await openPullRequest({
    title: `${issue.identifier}: ${issue.title}`,
    head: branch,
    body: [
      `Closes ${issue.identifier}`,
      "",
      issue.description || "",
      "",
      "## Agent notes",
      impl.note,
      "",
      "## Discoveries",
      JSON.stringify(discoveries.summary),
    ].join("\n"),
  });

  const review = await reviewPullRequest({ pullNumber: pr.number });
  await commentOnIssue(
    issue,
    [
      `PR: ${pr.html_url}`,
      `Review: ${review.event}`,
      impl.note,
    ].join("\n"),
  );

  const requireHuman = process.env.REQUIRE_HUMAN_MERGE === "1";
  if (requireHuman) {
    writeJson(PENDING_PATH, {
      issue,
      pr,
      reason: "Risky action gated: merge waits for npm run loop:approve",
    });
    await commentOnIssue(issue, "Merge gated. Human must run `npm run loop:approve`.");
    return { issue, plan, impl, tests, pr, review, merged: false, gated: true };
  }

  const merged =
    review.event === "APPROVE" && tests.ok
      ? await mergePullRequest(pr.number, { requireHuman })
      : { skipped: true, reason: "review or tests not clean" };

  if (!merged.skipped) {
    await setIssueState(issue, "done");
    await commentOnIssue(issue, "Merged. Ticket moved to Done.");
  } else if (review.event === "APPROVE" && tests.ok && pr.skipped) {
    await setIssueState(issue, "done");
    await commentOnIssue(
      issue,
      "No GitHub PR (token missing). Local/Linear ticket marked Done after a clean review so the demo loop still closes.",
    );
  }

  const result = { issue, plan, impl, tests: { ok: tests.ok }, pr, review: review.event, merged, sha };
  writeJson(path.join(ROOT, "loop/state/last-run.json"), result);
  return result;
}

if (process.argv[1] && path.basename(process.argv[1]) === "run.js") {
  const identifier = process.argv[2];
  const result = await runCycle({ identifier });
  console.log(JSON.stringify(result, null, 2));
}

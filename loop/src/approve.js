import { PENDING_PATH, readJson, remember } from "./env.js";
import { mergePullRequest } from "./github.js";
import { commentOnIssue, setIssueState } from "./linear.js";

const pending = readJson(PENDING_PATH, null);
if (!pending) {
  console.log("No pending merge.");
  process.exit(0);
}

const merged = await mergePullRequest(pending.pr.number, { requireHuman: false });
await setIssueState(pending.issue, "done");
await commentOnIssue(pending.issue, "Human approved merge. Ticket is Done.");
remember("Human approved a gated merge", pending.issue.identifier);
console.log(JSON.stringify({ pending, merged }, null, 2));

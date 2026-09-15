import { setIssueState, commentOnIssue, linearEnabled } from "./linear.js";

const haystack = `${process.env.PR_TITLE || ""}\n${process.env.PR_BODY || ""}`;
const match = haystack.match(/\b([A-Z]{2,5}-\d+)\b/);
if (!match) {
  console.log("No Linear identifier in PR title/body.");
  process.exit(0);
}
if (!linearEnabled()) {
  console.log("LINEAR_API_KEY/TEAM_ID not set; skip.");
  process.exit(0);
}

const identifier = match[1];
const issue = { id: identifier, identifier, source: "linear" };
await setIssueState(issue, "done");
await commentOnIssue(issue, "GitHub reports this PR merged. Moved to Done.");
console.log(`Marked ${identifier} done`);

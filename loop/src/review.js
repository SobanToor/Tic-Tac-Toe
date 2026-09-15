import path from "node:path";
import { discover } from "./discover.js";
import { postReview } from "./github.js";

export async function reviewPullRequest({ pullNumber } = {}) {
  const report = discover();
  const lines = [
    "## Agent PR review",
    "",
    `High: ${report.summary.high} · Medium: ${report.summary.medium} · Low: ${report.summary.low}`,
    "",
    ...report.findings.map(
      (f) => `- **${f.severity}** \`${f.kind}\` (${f.where}): ${f.detail}`,
    ),
    "",
    report.summary.high
      ? "Requesting changes because high-severity findings exist."
      : "No high-severity findings. Approval is for CI+review auto-merge.",
  ];
  const body = lines.join("\n");
  const event = report.summary.high ? "REQUEST_CHANGES" : "APPROVE";
  const posted = await postReview({
    pullNumber: Number(pullNumber || process.env.PR_NUMBER || 0),
    body,
    event,
  });
  return { event, body, posted, report };
}

if (process.argv[1] && path.basename(process.argv[1]) === "review.js") {
  const result = await reviewPullRequest({ pullNumber: process.argv[2] });
  console.log(result.body);
  console.log(`\nReview event: ${result.event}`);
  if (result.event === "REQUEST_CHANGES") process.exit(2);
}

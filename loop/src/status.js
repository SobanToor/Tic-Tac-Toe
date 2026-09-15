import { linearEnabled, listOpenIssues } from "./linear.js";
import { readJson, MEMORY_PATH, LOCAL_TICKETS } from "./env.js";

const tickets = linearEnabled() ? await listOpenIssues() : readJson(LOCAL_TICKETS, { issues: [] }).issues;
const memory = readJson(MEMORY_PATH, { decisions: [] });

console.log(linearEnabled() ? "Linear: connected" : "Linear: local ticket file (set LINEAR_API_KEY)");
console.log(`Open tickets: ${tickets.length}`);
for (const issue of tickets) {
  console.log(`- ${issue.identifier} [${issue.state?.name}] ${issue.title}`);
}
console.log(`Memory entries: ${memory.decisions.length}`);
for (const row of memory.decisions.slice(-5)) {
  console.log(`- ${row.at}: ${row.decision}`);
}

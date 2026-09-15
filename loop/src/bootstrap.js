import { createIssue, linearEnabled } from "./linear.js";
import { remember, LOCAL_TICKETS, readJson } from "./env.js";

const TICKETS = [
  {
    label: "core",
    title: "Two-player Tic Tac Toe rules: board, win, draw, illegal moves",
    description: [
      "## Why",
      "Need a tiny deterministic rules module so UI and tests share one source of truth.",
      "## Done when",
      "- 3x3 board",
      "- X and O alternate",
      "- Rows, columns, diagonals count as wins",
      "- Full board with no line is a draw",
      "- Occupied cells and moves after game-over are rejected",
    ].join("\n"),
  },
  {
    label: "ui",
    title: "Browser UI: click cells, show status, highlight winning line, reset",
    description: [
      "Render a board in the browser. Clicks call the rules module. Show whose turn, who won, or draw.",
      "Highlight the winning three cells. New game clears the board.",
    ].join("\n"),
  },
  {
    label: "persist",
    title: "Persist in-progress games in localStorage",
    description:
      "Store board + current player under a versioned key so a refresh restores the match. Reset must clear storage.",
  },
  {
    label: "a11y",
    title: "Add keyboard navigation for the board",
    description: [
      "Arrow keys move focus between cells. This is intentionally left for the agent loop to implement.",
      "Do not require a mouse.",
    ].join("\n"),
  },
];

export async function bootstrap() {
  if (!linearEnabled()) {
    const existing = readJson(LOCAL_TICKETS, { issues: [] }).issues;
    if (existing.length) {
      return { source: "local-fallback", created: existing, skipped: true };
    }
  }
  const created = [];
  for (const ticket of TICKETS) {
    created.push(await createIssue(ticket));
  }
  remember(
    "Bootstrap opened four Tic Tac Toe tickets (rules, UI, persist, keyboard).",
    "Keyboard is the leftover ticket so the loop has real work after the first agent pass.",
  );
  return { source: linearEnabled() ? "linear" : "local-fallback", created };
}

if (process.argv[1] && process.argv[1].endsWith("bootstrap.js")) {
  const result = await bootstrap();
  console.log(`Created ${result.created.length} tickets via ${result.source}`);
  for (const issue of result.created) {
    console.log(`- ${issue.identifier}: ${issue.title} (${issue.url})`);
  }
}

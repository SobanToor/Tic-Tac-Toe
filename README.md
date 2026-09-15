# Agent-driven development loop

Shayan Solutions intern evaluation. The app is a two-player **Tic Tac Toe** board in the browser. The thing under test is the loop around it: Linear ticket → agent change → CI → PR review → merge → ask an LLM about the code through MCP.

This workspace had no Linear key, no GitHub token, and no `git` on PATH when the loop was first wired. The scripts and workflows are real; the hosted Linear project and public GitHub repo still need your credentials. That gap is called out below instead of faked.

## How the loop runs

1. **Tickets.** `npm run loop:bootstrap` creates four Linear issues (rules, UI, persist, keyboard). If `LINEAR_API_KEY` and `LINEAR_TEAM_ID` are missing, it writes the same tickets to `loop/state/tickets.json`.
2. **Pickup.** `npm run loop:run` takes the next open ticket (keyboard is the leftover piece after the first agent pass), sets Linear to **In Progress**, writes a plan (planner) into Linear + `loop/memory.json`, then a specialised patcher (coder) edits the app.
3. **CI.** `.github/workflows/pr-loop.yml` runs `npm test` and the discovery script on every PR.
4. **Review.** The same workflow runs `node loop/src/review.js`, which posts a GitHub PR review (approve or request changes) from live findings, not a canned comment.
5. **Auto-merge.** If tests pass, the review is an approval, the PR is from this repo, and the PR is not labeled `hold-merge`, the same workflow squash-merges. CI, review, and merge are one workflow because a `GITHUB_TOKEN` event will not start a second workflow.
6. **Done.** `.github/workflows/linear-done.yml` reads `ENG-123` from the PR title and moves that Linear issue to Done after merge.
7. **Discover.** `npm run loop:discover` scans for dead exports, missing tests, a11y gaps, and failing tests. It already reports real issues: `unusedHighlightPalette` in `apps/tictactoe/src/game.js`, and missing keyboard / `aria-live` until those tickets land.
8. **MCP.** `node mcp-server/src/index.js` is a stdio MCP server. Tools read the live source, so answers to “what does the win check do?” and “where is state stored?” stay accurate after agents edit the files.

Play the app: `npm start` then open http://localhost:5173.

## Agents and MCP servers used

| Role | What actually runs |
| --- | --- |
| Coding agent | Cursor (this repo was generated and patched by the agent, not typed as a finished app by hand). Optional follow-up: Cursor SDK if you set `CURSOR_API_KEY`. |
| Planner vs coder | `loop/src/run.js` writes a plan, then `loop/src/implement.js` applies a ticket-specific patch. |
| Reviewer | `loop/src/review.js` inside GitHub Actions. |
| Discovery | `loop/src/discover.js`. |
| Ticket source | Linear GraphQL, with a local JSON fallback. |
| App MCP | `tictactoe-app` (`mcp-server/src/index.js`). No extra npm installs. Works with **Claude Code** and **Codex** over stdio. |

## Connect the MCP server

From the repo root. `node` must be on PATH.

**Claude Code**

```bash
claude mcp add tictactoe-app -- node mcp-server/src/index.js
```

Or merge `.mcp.json` from this repo into Claude Code’s MCP config. Restart Claude Code, then ask: “what does the win check do?” and “where is state stored?”

**Codex** (OpenAI Codex CLI) — add to `~/.codex/config.toml`:

```toml
[mcp_servers.tictactoe-app]
command = "node"
args = ["mcp-server/src/index.js"]
cwd = "REPLACE_WITH_ABSOLUTE_PATH_TO_THIS_REPO"
```

**Cursor** — `.cursor/mcp.json` is already in the repo. Enable the server in Cursor Settings → MCP.

Smoke test without an LLM:

```bash
node mcp-server/src/probe.js explain_win_check
node mcp-server/src/probe.js where_is_state_stored
```

## What you still have to do (honest)

- Install Git, push this tree to a **public GitHub** repo, and add Actions secrets `LINEAR_API_KEY` and `LINEAR_TEAM_ID`.
- Put those same values plus `GITHUB_TOKEN` / `GITHUB_REPO` in `.env` (see `.env.example`) so `npm run loop:run` can open PRs and move Linear issues.
- Record Linear tickets moving, and a 3–5 minute pass of: bootstrap → run → Actions CI/review/merge → MCP question in Claude Code or Codex.
- Permission gate: set `REQUIRE_HUMAN_MERGE=1` locally, or add the `hold-merge` label on GitHub. Approve with `npm run loop:approve` or by removing the label.
- Cursor SDK coding (instead of the small patcher) is not wired in this pass; the patcher is the working coder.

## What I would do next

- Replace `implement.js` with a Cursor SDK `Agent.prompt` call so arbitrary tickets are coded, not just keyboard / aria-live.
- Use a Linear webhook instead of parsing PR titles.
- Add a second MCP server that exposes Linear + last-run state, not only app source.
- Branch protection so merge only happens after the required check named `test`.

## Demo script (recording)

1. Show Linear (or `npm run loop:status` + `loop/state/tickets.json`).
2. `npm run loop:run` — ticket goes In Progress, UI changes, review text prints.
3. Push the branch, show the PR loop workflow going green and merging.
4. Ask Claude Code or Codex, with MCP connected: “what does the win check do?”

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "./protocol.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const appRoot = path.join(repoRoot, "apps/tictactoe");

function readRel(rel) {
  const full = path.resolve(appRoot, rel);
  const relToApp = path.relative(appRoot, full);
  if (relToApp.startsWith("..") || path.isAbsolute(relToApp)) {
    throw new Error("Path escapes app root");
  }
  return fs.readFileSync(full, "utf8");
}

function listSource() {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|css|html)$/.test(entry.name)) {
        out.push(path.relative(appRoot, full).replaceAll("\\", "/"));
      }
    }
  }
  walk(appRoot);
  return out.sort();
}

function extractFunction(source, name) {
  const start = source.indexOf(`export function ${name}(`);
  if (start === -1) return `Function ${name} not found.`;
  let depth = 0;
  let seen = false;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") {
      depth += 1;
      seen = true;
    } else if (source[i] === "}") {
      depth -= 1;
      if (seen && depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start, start + 500);
}

const server = new McpServer({
  name: "tictactoe-app",
  version: "1.0.0",
  instructions:
    "Answers questions about the Tic Tac Toe app by reading its source. Prefer these tools over guessing.",
});

server.resource(
  "game.js",
  "file:///apps/tictactoe/src/game.js",
  "Win detection and move rules",
  () => readRel("src/game.js"),
);

server.resource(
  "store.js",
  "file:///apps/tictactoe/src/store.js",
  "localStorage persistence",
  () => readRel("src/store.js"),
);

server.resource(
  "ui.js",
  "file:///apps/tictactoe/src/ui.js",
  "Browser UI and click handling",
  () => readRel("src/ui.js"),
);

server.tool(
  "app_overview",
  "Summarize what the app is and which files own which responsibility",
  {},
  async () => {
    const files = listSource();
    return [
      "Browser Tic Tac Toe for two local players.",
      "Rules live in src/game.js. Persistence lives in src/store.js (localStorage key tictactoe.v1).",
      "UI lives in src/ui.js. Entry is src/main.js.",
      `Source files: ${files.join(", ")}`,
    ].join("\n");
  },
);

server.tool(
  "explain_win_check",
  "Explain what the win check does, using the live source of checkWin",
  {},
  async () => {
    const source = readRel("src/game.js");
    const fn = extractFunction(source, "checkWin");
    return [
      "checkWin walks WIN_LINES (rows, columns, both diagonals).",
      "If three cells on a line share the same non-null mark, it returns { player, line }.",
      "Otherwise it returns null. isDraw is a full board with no winner.",
      "",
      "Live source:",
      fn,
    ].join("\n");
  },
);

server.tool(
  "where_is_state_stored",
  "Explain where board state lives in memory and on disk",
  {},
  async () => {
    const store = readRel("src/store.js");
    const ui = readRel("src/ui.js");
    return [
      "During a session, the board and currentPlayer variables live in createGame() in src/ui.js (in-memory closures).",
      "On every successful move they are serialized to browser localStorage under the key tictactoe.v1 by src/store.js.",
      "New game clears that key. There is no server-side store.",
      "",
      "store.js:",
      store.trim(),
      "",
      "Relevant ui.js excerpt: look for let board / persist() / storage.saveState.",
      ui.includes("let board") ? "Confirmed: ui.js holds `let board` and calls persist()." : "Could not confirm in-memory board.",
    ].join("\n");
  },
);

server.tool(
  "search_source",
  "Search app source for a string or regular expression",
  {
    query: { type: "string", description: "Substring or regex source" },
    regex: { type: "boolean", description: "Treat query as a regular expression", optional: true },
  },
  async ({ query, regex }) => {
    const hits = [];
    for (const rel of listSource()) {
      const text = readRel(rel);
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        const ok = regex ? new RegExp(query).test(line) : line.includes(query);
        if (ok) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    return hits.length ? hits.slice(0, 50).join("\n") : "No matches.";
  },
);

server.tool(
  "read_source_file",
  "Read one file under apps/tictactoe",
  { path: { type: "string", description: "Relative path, e.g. src/game.js" } },
  async ({ path: rel }) => readRel(rel),
);

server.tool(
  "list_source_files",
  "List source files in the Tic Tac Toe app",
  {},
  async () => listSource().join("\n"),
);

server.start();

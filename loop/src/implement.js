import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./env.js";

const UI = path.join(ROOT, "apps/tictactoe/src/ui.js");

export function implementTicket(issue) {
  const haystack = `${issue.title}\n${issue.description || ""}`;
  if (/keyboard/i.test(haystack)) {
    return addKeyboardNavigation();
  }
  if (/aria-live|screen reader/i.test(haystack)) {
    return addAriaLive();
  }
  return {
    changed: [],
    note: "No specialised patcher for this ticket. A coding agent should edit the app from the ticket body.",
  };
}

function addKeyboardNavigation() {
  let source = fs.readFileSync(UI, "utf8");
  if (source.includes("onKeyDown")) {
    return { changed: [], note: "Keyboard navigation already present." };
  }
  source = source.replace(
    "root.querySelector(\".board\").addEventListener(\"click\", onCellClick);",
    `root.querySelector(".board").addEventListener("click", onCellClick);
    root.querySelector(".board").addEventListener("keydown", onKeyDown);`,
  );
  if (!source.includes("function onKeyDown")) {
    source = source.replace(
      "function reset() {",
      `function onKeyDown(event) {
    const current = Number(event.target.dataset?.index);
    if (Number.isNaN(current)) return;
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const next = Math.min(8, Math.max(0, current + delta));
    root.querySelector(\`[data-index="\${next}"]\`)?.focus();
  }

  function reset() {`,
    );
  }
  source = source.replace(
    'return `<button class="cell${winSet.has(i) ? " win" : ""}" role="gridcell" data-index="${i}" ${disabled ? "disabled" : ""}>${cell ?? ""}</button>`;',
    'return `<button class="cell${winSet.has(i) ? " win" : ""}" role="gridcell" data-index="${i}" tabindex="${i === 0 ? 0 : -1}" ${disabled ? "disabled" : ""}>${cell ?? ""}</button>`;',
  );
  fs.writeFileSync(UI, source);
  return { changed: ["apps/tictactoe/src/ui.js"], note: "Added arrow-key navigation on the board." };
}

function addAriaLive() {
  let source = fs.readFileSync(UI, "utf8");
  if (source.includes("aria-live")) {
    return { changed: [], note: "aria-live already present." };
  }
  source = source.replace(
    '<p class="status" data-testid="status">',
    '<p class="status" data-testid="status" aria-live="polite">',
  );
  fs.writeFileSync(UI, source);
  return { changed: ["apps/tictactoe/src/ui.js"], note: "Status is now announced via aria-live." };
}

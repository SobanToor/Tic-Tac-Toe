import {
  checkWin,
  emptyBoard,
  nextPlayer,
  place,
  statusOf,
} from "./game.js";
import { clearState, loadState, saveState } from "./store.js";

export function createGame(root, storage = { loadState, saveState, clearState }) {
  let board = emptyBoard();
  let currentPlayer = "X";

  const restored = storage.loadState();
  if (restored) {
    board = restored.board;
    currentPlayer = restored.currentPlayer;
  }

  function persist() {
    storage.saveState({ board, currentPlayer });
  }

  function render() {
    const status = statusOf(board, currentPlayer);
    const win = checkWin(board);
    const winSet = new Set(win ? win.line : []);

    root.innerHTML = `
      <main class="shell">
        <h1>Tic Tac Toe</h1>
        <p class="status" data-testid="status">${statusText(status)}</p>
        <div class="board" role="grid" aria-label="Tic tac toe board">
          ${board
            .map((cell, i) => {
              const disabled = cell !== null || status.kind !== "playing";
              return `<button class="cell${winSet.has(i) ? " win" : ""}" role="gridcell" data-index="${i}" tabindex="${i === 0 ? 0 : -1}" ${disabled ? "disabled" : ""}>${cell ?? ""}</button>`;
            })
            .join("")}
        </div>
        <button type="button" class="reset" data-testid="reset">New game</button>
      </main>
    `;

    root.querySelector(".board").addEventListener("click", onCellClick);
    root.querySelector(".board").addEventListener("keydown", onKeyDown);
    root.querySelector("[data-testid=reset]").addEventListener("click", reset);
  }

  function onCellClick(event) {
    const button = event.target.closest("[data-index]");
    if (!button) return;
    const index = Number(button.dataset.index);
    try {
      board = place(board, index, currentPlayer);
      currentPlayer = nextPlayer(currentPlayer);
      persist();
      render();
    } catch {
      // Occupied / game-over clicks are ignored; rules live in game.js.
    }
  }

  function onKeyDown(event) {
    const current = Number(event.target.dataset?.index);
    if (Number.isNaN(current)) return;
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const next = Math.min(8, Math.max(0, current + delta));
    root.querySelector(`[data-index="${next}"]`)?.focus();
  }

  function reset() {
    board = emptyBoard();
    currentPlayer = "X";
    storage.clearState();
    render();
  }

  render();
  return {
    getBoard: () => board.slice(),
    getCurrentPlayer: () => currentPlayer,
  };
}

function statusText(status) {
  if (status.kind === "won") return `${status.player} wins`;
  if (status.kind === "draw") return "Draw";
  return `${status.player}'s turn`;
}

/** Pure game rules. UI must not duplicate this logic. */

export const PLAYERS = ["X", "O"];

export const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function emptyBoard() {
  return Array(9).fill(null);
}

/**
 * Returns the winning player and the three cell indexes, or null.
 * First matching line wins; overlapping wins are not scored separately.
 */
export function checkWin(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return { player: mark, line };
    }
  }
  return null;
}

export function isDraw(board) {
  return board.every((cell) => cell !== null) && checkWin(board) === null;
}

export function statusOf(board, currentPlayer) {
  const win = checkWin(board);
  if (win) return { kind: "won", player: win.player, line: win.line };
  if (isDraw(board)) return { kind: "draw" };
  return { kind: "playing", player: currentPlayer };
}

export function place(board, index, player) {
  if (index < 0 || index > 8) {
    throw new Error("Cell index must be 0-8");
  }
  if (board[index] !== null) {
    throw new Error("Cell is occupied");
  }
  if (checkWin(board) || isDraw(board)) {
    throw new Error("Game is already over");
  }
  if (!PLAYERS.includes(player)) {
    throw new Error("Player must be X or O");
  }
  const next = board.slice();
  next[index] = player;
  return next;
}

export function nextPlayer(player) {
  return player === "X" ? "O" : "X";
}

/** Intentionally unused. Left so the discovery agent has a real finding. */
export function unusedHighlightPalette() {
  return { win: "#7cffb2", hover: "#2a3344" };
}

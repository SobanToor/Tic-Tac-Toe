const KEY = "tictactoe.v1";

export function loadState() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.board) || parsed.board.length !== 9) return null;
    if (parsed.currentPlayer !== "X" && parsed.currentPlayer !== "O") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}

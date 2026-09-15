import test from "node:test";
import assert from "node:assert/strict";
import {
  checkWin,
  emptyBoard,
  isDraw,
  place,
  statusOf,
  nextPlayer,
} from "../src/game.js";

test("empty board has no winner", () => {
  assert.equal(checkWin(emptyBoard()), null);
});

test("detects a top-row win for X", () => {
  const board = ["X", "X", "X", "O", "O", null, null, null, null];
  assert.deepEqual(checkWin(board), { player: "X", line: [0, 1, 2] });
});

test("detects a diagonal win for O", () => {
  const board = ["O", "X", null, "X", "O", null, null, null, "O"];
  assert.deepEqual(checkWin(board), { player: "O", line: [0, 4, 8] });
});

test("draw when the board is full with no line", () => {
  const board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
  assert.equal(isDraw(board), true);
  assert.equal(checkWin(board), null);
});

test("place writes a mark and rejects occupied cells", () => {
  const next = place(emptyBoard(), 4, "X");
  assert.equal(next[4], "X");
  assert.throws(() => place(next, 4, "O"), /occupied/i);
});

test("cannot place after a win", () => {
  const board = ["X", "X", "X", "O", "O", null, null, null, null];
  assert.throws(() => place(board, 5, "O"), /already over/i);
});

test("status and player swap", () => {
  assert.equal(nextPlayer("X"), "O");
  assert.equal(statusOf(emptyBoard(), "X").kind, "playing");
});

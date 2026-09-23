import test from "node:test";
import assert from "node:assert/strict";

function minimumBid(startingBid: number, currentBid: number | null, increment: number) {
  return currentBid == null ? startingBid : currentBid + increment;
}

function availablePurse(initialPurse: number, spentPurse: number) {
  return Math.max(0, initialPurse - spentPurse);
}

function validSquadSize(size: number, min: number, max: number) {
  return size >= min && size <= max;
}

function canFinalize(squadSizes: number[], min: number, max: number) {
  return squadSizes.every((size) => validSquadSize(size, min, max));
}

test("minimum bid starts at starting bid", () => {
  assert.equal(minimumBid(100, null, 10), 100);
});

test("minimum bid advances by configured increment", () => {
  assert.equal(minimumBid(100, 150, 10), 160);
});

test("available purse never becomes negative", () => {
  assert.equal(availablePurse(1000, 250), 750);
  assert.equal(availablePurse(1000, 1200), 0);
});

test("squad size accepts configured boundaries", () => {
  assert.equal(validSquadSize(5, 5, 11), true);
  assert.equal(validSquadSize(11, 5, 11), true);
  assert.equal(validSquadSize(4, 5, 11), false);
  assert.equal(validSquadSize(12, 5, 11), false);
});

test("finalization requires every squad to satisfy constraints", () => {
  assert.equal(canFinalize([5, 7, 11], 5, 11), true);
  assert.equal(canFinalize([5, 4, 11], 5, 11), false);
  assert.equal(canFinalize([5, 12, 11], 5, 11), false);
});

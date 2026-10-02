const assert = require('node:assert/strict');
const { test } = require('node:test');
const { formatReferences } = require('../dist/reference');

// Model VS Code's normalized start/end positions, including upward selections.
function selection(anchorLine, anchorColumn, activeLine = anchorLine, activeColumn = anchorColumn) {
  const positions = [
    { line: anchorLine - 1, character: anchorColumn - 1 },
    { line: activeLine - 1, character: activeColumn - 1 },
  ].sort((a, b) => a.line - b.line || a.character - b.character);
  return { start: positions[0], end: positions[1], isEmpty: anchorLine === activeLine && anchorColumn === activeColumn };
}

test('cursor and single-line selection produce one line number', () => {
  assert.equal(formatReferences('src/a.ts', [selection(10, 3)]), 'src/a.ts:10');
  assert.equal(formatReferences('src/a.ts', [selection(10, 3, 10, 9)]), 'src/a.ts:10');
});

test('forward and reverse selections produce identical inclusive ranges', () => {
  assert.equal(formatReferences('src/a.ts', [selection(10, 3, 20, 9)]), 'src/a.ts:10-20');
  assert.equal(formatReferences('src/a.ts', [selection(20, 9, 10, 3)]), 'src/a.ts:10-20');
});

test('end at next line column one excludes that unselected line', () => {
  assert.equal(formatReferences('src/a.ts', [selection(10, 1, 21, 1)]), 'src/a.ts:10-20');
  assert.equal(formatReferences('src/a.ts', [selection(10, 1, 11, 1)]), 'src/a.ts:10');
  assert.equal(formatReferences('src/a.ts', [selection(21, 1, 10, 1)]), 'src/a.ts:10-20');
});

test('multiple ranges are sorted and duplicate line references removed', () => {
  assert.equal(formatReferences('src/a file.ts', [selection(20, 2), selection(2, 1, 5, 4), selection(20, 8)]),
    'src/a file.ts:2-5\nsrc/a file.ts:20');
});

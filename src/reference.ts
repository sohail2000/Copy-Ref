interface SelectionRange {
  readonly start: { readonly line: number; readonly character: number };
  readonly end: { readonly line: number; readonly character: number };
  readonly isEmpty: boolean;
}

export function formatReferences(path: string, selections: readonly SelectionRange[]): string {
  const references = selections.map((selection) => {
    const start = selection.start.line + 1;
    // Selection ends are exclusive. Column zero does not select that last line.
    const end = selection.end.line + 1 - (
      !selection.isEmpty && selection.end.line > selection.start.line && selection.end.character === 0 ? 1 : 0
    );
    return { start, end };
  }).sort((a, b) => a.start - b.start || a.end - b.end);

  return [...new Set(references.map(({ start, end }) =>
    `${path}:${start === end ? start : `${start}-${end}`}`
  ))].join("\n");
}

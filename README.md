# Copy Ref

A small extension for VS Code and Cursor that copies a file path with line numbers, relative to your workspace.

```text
packages/web/src/components/Example.tsx:29-43
```

## Install

To build the extension, install Node.js and npm, then run these commands in the project folder:

```sh
npm ci
npm run package
```

In VS Code or Cursor:

1. Open the Command Palette with **Cmd+Shift+P** on macOS or **Ctrl+Shift+P** on Windows/Linux.
2. Run **Extensions: Install from VSIX...**.
3. Select the generated `copy-ref-0.1.0.vsix` file in the project folder.

## Usage

1. Open a folder or workspace, then open a saved file inside it.
2. Place the cursor on a line or select some code.
3. Press **Option+C** on macOS or **Alt+C** on Windows/Linux.
4. Paste the reference wherever you need it.

You can also use **Copy Ref: Copy Relative Path with Lines** from the Command Palette or the editor's right-click menu. Normal copy shortcuts keep working.

| Selection | Copied reference |
| --- | --- |
| Cursor or single line | `src/file.ts:10` |
| Multiple lines | `src/file.ts:10-20` |
| Multiple selections | One reference per line, sorted by line number, with duplicates removed |

Selecting upward works the same as selecting downward. If a selection ends at the start of the next line, that line is excluded.

If the shortcut runs another command, open **Keyboard Shortcuts**, search for **Copy Ref**, and change its shortcut. Use **Show Same Keybindings** to check for conflicts.

## Notes

- Only the reference is copied, not the source code. The extension does not change files or make network requests.
- Untitled files, files outside the workspace, unsupported virtual documents, and file names with control characters are rejected.
- Paths are relative to the containing workspace folder. Folder names are not included to distinguish matching paths in different workspace roots.
- Line numbers match the version shown in the editor, including unsaved edits and local Git versions. References do not include a Git revision.
- Normal remote workspace files are supported. Remote Git virtual documents may not resolve.

## Development

```sh
npm run compile
npm test
```

- `src/extension.ts` registers the command and handles the editor and clipboard.
- `src/reference.ts` formats paths and line ranges.
- `test/` covers formatting, workspace validation, Git paths, and clipboard errors.

After installing, manually check the shortcut and staged/diff editors in VS Code or Cursor. Automated tests do not cover actual editor keyboard handling.

## License

This project is private and unlicensed.

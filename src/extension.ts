import * as vscode from "vscode";
import { formatReferences } from "./reference";
import { newChatLink } from "./links";

export function activate(context: vscode.ExtensionContext): void {
  for (const command of ["copyAndOpen", "openNewChat"] as const) {
    context.subscriptions.push(vscode.commands.registerCommand(`copyRefToCodex.${command}`, async () => {
      let copied = false;
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          await vscode.window.showWarningMessage("Copy Ref to Codex: Open a file in the editor first.");
          return;
        }

        const uri = editor.document.uri;
        if (editor.document.isUntitled || !["file", "git", "vscode-remote"].includes(uri.scheme)) {
          await vscode.window.showWarningMessage("Copy Ref to Codex: Open a saved workspace file to copy its reference.");
          return;
        }

        // Local Git index and revision editors use a git: URI for the original file path.
        const fileUri = uri.scheme === "git" ? vscode.Uri.file(uri.fsPath) : uri;
        const folder = vscode.workspace.getWorkspaceFolder(fileUri);
        if (!folder) {
          await vscode.window.showWarningMessage("Copy Ref to Codex: This file is outside the open workspace.");
          return;
        }

        const relativePath = vscode.workspace.asRelativePath(fileUri, false).replace(/\\/g, "/");
        // Avoid producing ambiguous multi-line references from unusual file names.
        if (/[\r\n\u0000-\u001f\u007f]/.test(relativePath)) {
          await vscode.window.showWarningMessage("Copy Ref to Codex: This file name contains unsupported control characters.");
          return;
        }

        const reference = formatReferences(relativePath, editor.selections);
        // Capture the source workspace before handing off to the desktop app.
        const workspacePath = folder.uri.fsPath;
        if (folder.uri.scheme !== "file" || vscode.env.remoteName) {
          await vscode.window.showWarningMessage("Copy Ref to Codex: New chat requires a local workspace. Copy remote references with the original Copy Ref extension and paste manually.");
          return;
        }
        const link = newChatLink(reference, workspacePath);
        await vscode.env.clipboard.writeText(reference);
        copied = true;
        if (!await vscode.env.openExternal(vscode.Uri.parse(link))) throw new Error("Open declined");
        vscode.window.setStatusBarMessage("Copy Ref to Codex: Reference copied; new-chat link opened. Check the draft before sending.", 4000);
      } catch {
        await vscode.window.showErrorMessage(copied
          ? "Copy Ref to Codex: Could not open Codex. Reference remains on the clipboard for manual paste."
          : "Copy Ref to Codex: Could not prepare or copy the reference. Please try again.");
      }
    }));
  }
}

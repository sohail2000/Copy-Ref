import * as vscode from "vscode";
import { formatReferences } from "./reference";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.commands.registerCommand("localCopyRef.copyReference", async () => {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.window.showWarningMessage("Copy Ref: Open a file in the editor first.");
        return;
      }

      const uri = editor.document.uri;
      if (editor.document.isUntitled || !["file", "git", "vscode-remote"].includes(uri.scheme)) {
        await vscode.window.showWarningMessage("Copy Ref: Open a saved workspace file to copy its reference.");
        return;
      }

      // Local Git index and revision editors use a git: URI for the original file path.
      const fileUri = uri.scheme === "git" ? vscode.Uri.file(uri.fsPath) : uri;
      if (!vscode.workspace.getWorkspaceFolder(fileUri)) {
        await vscode.window.showWarningMessage("Copy Ref: This file is outside the open workspace.");
        return;
      }

      const relativePath = vscode.workspace.asRelativePath(fileUri, false).replace(/\\/g, "/");
      // Avoid producing ambiguous multi-line references from unusual file names.
      if (/[\r\n\u0000-\u001f\u007f]/.test(relativePath)) {
        await vscode.window.showWarningMessage("Copy Ref: This file name contains unsupported control characters.");
        return;
      }

      const reference = formatReferences(relativePath, editor.selections);
      await vscode.env.clipboard.writeText(reference);
      vscode.window.setStatusBarMessage("Copy Ref: Reference copied.", 2000);
    } catch {
      await vscode.window.showErrorMessage("Copy Ref: Could not copy the reference. Please try again.");
    }
  }));
}

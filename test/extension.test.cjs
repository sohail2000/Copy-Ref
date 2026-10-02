const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');

let command;
let editor;
let clipboard;
let warnings;
let errors;
let status;
let clipboardFails;
let resolvedUri;
let relativePath;
const api = {
  commands: { registerCommand: (id, handler) => {
    assert.equal(id, 'localCopyRef.copyReference');
    command = handler;
    return { dispose() {} };
  } },
  Uri: { file: (path) => ({ scheme: 'file', fsPath: path }) },
  workspace: {
    getWorkspaceFolder: (uri) => {
      resolvedUri = uri;
      return uri.fsPath.startsWith('/project/') ? { name: 'project' } : undefined;
    },
    asRelativePath: (uri, includeRoot) => {
      assert.equal(includeRoot, false);
      return relativePath ?? uri.fsPath.slice('/project/'.length);
    },
  },
  window: {
    get activeTextEditor() { return editor; },
    showWarningMessage: async (message) => { warnings.push(message); },
    showErrorMessage: async (message) => { errors.push(message); },
    setStatusBarMessage: (message) => { status.push(message); },
  },
  env: { clipboard: { writeText: async (text) => {
    if (clipboardFails) throw new Error('Simulated clipboard failure');
    clipboard = text;
  } } },
};
// Inject only the editor API; command and formatting implementation run unchanged.
const originalLoad = Module._load;
let activate;
try {
  Module._load = function(id, ...args) {
    return id === 'vscode' ? api : originalLoad.call(this, id, ...args);
  };
  ({ activate } = require('../dist/extension'));
} finally {
  Module._load = originalLoad;
}

beforeEach(() => {
  editor = {
    document: { uri: { scheme: 'file', fsPath: '/project/src/a.ts' }, isUntitled: false },
    selections: [{ start: { line: 9, character: 0 }, end: { line: 20, character: 0 }, isEmpty: false }],
  };
  clipboard = 'previous clipboard';
  warnings = [];
  errors = [];
  status = [];
  clipboardFails = false;
  relativePath = undefined;
  activate({ subscriptions: [] });
});

test('copies a workspace reference and shows success only after clipboard write', async () => {
  await command();
  assert.equal(clipboard, 'src/a.ts:10-20');
  assert.equal(status.length, 1);
  assert.deepEqual(errors, []);
});

test('local staged Git editor resolves original path', async () => {
  editor.document.uri.scheme = 'git';
  await command();
  assert.equal(resolvedUri.scheme, 'file');
  assert.equal(clipboard, 'src/a.ts:10-20');
});

test('normal remote editor keeps its URI scheme', async () => {
  editor.document.uri.scheme = 'vscode-remote';
  await command();
  assert.equal(resolvedUri.scheme, 'vscode-remote');
  assert.equal(clipboard, 'src/a.ts:10-20');
});

for (const [name, invalidate] of [
  ['no active editor', () => { editor = undefined; }],
  ['untitled document without a stable path', () => { editor.document.isUntitled = true; }],
  ['file outside workspace', () => { editor.document.uri.fsPath = '/elsewhere/a.ts'; }],
  ['unsupported virtual document', () => { editor.document.uri.scheme = 'output'; }],
  ['file name containing a newline', () => { relativePath = 'src/bad\nname.ts'; }],
]) {
  test(`unsupported state: ${name} preserves clipboard and warns`, async () => {
    invalidate();
    await command();
    assert.equal(clipboard, 'previous clipboard');
    assert.equal(warnings.length, 1);
    assert.equal(status.length, 0);
  });
}

test('clipboard failure reports error without a success message', async () => {
  clipboardFails = true;
  await command();
  assert.equal(errors.length, 1);
  assert.equal(status.length, 0);
  assert.equal(clipboard, 'previous clipboard');
});

const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');

let command;
let commands;
let state;
let opened;
let input;
let onInput;
let openResult;
let openThrows;
let workspaceUri;
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
    commands[id] = handler;
    if (id === 'copyRefToCodex.copyAndOpen') command = handler;
    return { dispose() {} };
  } },
  Uri: { parse: (value) => ({ toString: () => value }), file: (path) => ({ scheme: 'file', fsPath: path }) },
  workspace: {
    workspaceFolders: [{}],
    getWorkspaceFolder: (uri) => {
      resolvedUri = uri;
      return uri.fsPath.startsWith('/project/') ? { name: 'project', uri: workspaceUri } : undefined;
    },
    asRelativePath: (uri, includeRoot) => {
      assert.equal(includeRoot, false);
      return relativePath ?? uri.fsPath.slice('/project/'.length);
    },
  },
  window: {
    get activeTextEditor() { return editor; },
    showInputBox: async (options) => { onInput?.(options); return input; },
    showInformationMessage: async (message) => { status.push(message); },
    showWarningMessage: async (message) => { warnings.push(message); },
    showErrorMessage: async (message) => { errors.push(message); },
    setStatusBarMessage: (message) => { status.push(message); },
  },
  env: { openExternal: async (uri) => { if (openThrows) throw new Error('open failed'); opened.push(uri.toString()); return openResult; }, clipboard: { writeText: async (text) => {
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
  commands = {}; state = new Map([['targetChat', 'codex://threads/01a0f711-2830-79c0-a2d0-aad820813f5c']]);
  opened = []; input = undefined; onInput = undefined; openResult = true; openThrows = false;
  workspaceUri = { scheme: 'file', fsPath: '/project' };
  activate({ subscriptions: [], workspaceState: { get: (key) => state.get(key), update: async (key, value) => { state.set(key, value); } } });
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

for (const throws of [false, true]) test(`opening failure (${throws}) retains copied reference`, async () => {
  openResult = false; openThrows = throws; await command();
  assert.equal(clipboard, 'src/a.ts:10-20'); assert.match(errors[0], /manual paste/);
});
test('clipboard failure does not open a chat', async () => {
  clipboardFails = true; await command(); assert.deepEqual(opened, []);
});
test('new chat uses containing workspace and ignores configured target', async () => {
  workspaceUri.fsPath = '/project/second root';
  await commands['copyRefToCodex.openNewChat']();
  const url = new URL(opened[0]); assert.equal(url.host, 'new');
  assert.equal(url.searchParams.get('path'), '/project/second root');
  assert.equal(url.searchParams.get('prompt'), 'src/a.ts:10-20');
});
test('remote new chat is rejected without replacing clipboard', async () => {
  workspaceUri.scheme = 'vscode-remote';
  await commands['copyRefToCodex.openNewChat']();
  assert.deepEqual(opened, []); assert.equal(clipboard, 'previous clipboard');
  assert.match(warnings[0], /local workspace/);
});
test('default command needs no setup and ignores old saved targets', async () => {
  state.set('targetChat', 'https://irrelevant.example');
  onInput = () => { throw new Error('Must not ask for configuration'); };
  await command();
  assert.equal(new URL(opened[0]).host, 'new');
  assert.equal(new URL(opened[0]).searchParams.get('prompt'), 'src/a.ts:10-20');
  assert.equal(commands['copyRefToCodex.setTargetChat'], undefined);
  assert.equal(commands['copyRefToCodex.clearTargetChat'], undefined);
});
test('repeated default invocations request new drafts, never existing chat prefill', async () => {
  await command(); await command();
  assert.equal(opened.length, 2);
  for (const link of opened) assert.equal(new URL(link).host, 'new');
});
test('default command also rejects remote workspace paths', async () => {
  workspaceUri.scheme = 'vscode-remote'; await command();
  assert.deepEqual(opened, []); assert.equal(clipboard, 'previous clipboard');
});

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { newChatLink } = require('../dist/links');
test('new chat URL safely roundtrips Unicode, spaces, punctuation and newlines', () => {
  const prompt = 'src/हिंदी #&?.ts:2-5\nsrc/हिंदी #&?.ts:9';
  const path = '/Users/example/a #&? हिंदी';
  const url = new URL(newChatLink(prompt, path));
  assert.equal(url.host, 'new');
  assert.equal(url.searchParams.get('prompt'), prompt);
  assert.equal(url.searchParams.get('path'), path);
  assert.equal(url.hash, '');
  assert.deepEqual([...url.searchParams.keys()], ['prompt', 'path']);
});

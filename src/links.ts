export function newChatLink(reference: string, workspacePath: string): string {
  const url = new URL('codex://new');
  url.searchParams.set('prompt', reference);
  url.searchParams.set('path', workspacePath);
  return url.toString();
}

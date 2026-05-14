// jest.setup.ts
// Node 18+ ships native fetch/Response/Request/Headers globally.
// jest-environment-jsdom re-sets the global scope and may lose them.
// Re-attach from the Node global if missing.
if (typeof global.Response === 'undefined') {
  // Node 18+ exposes these on globalThis
  const g = globalThis as any
  if (g.Response) {
    global.Response = g.Response
    global.Request = g.Request
    global.Headers = g.Headers
    global.fetch = g.fetch
  }
}

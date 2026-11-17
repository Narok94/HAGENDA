import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';

let server: Server, base: string;
before(async () => {
  // Disable dotenv and remove the connection BEFORE importing the real app.
  // This test cannot construct a Neon client or contact a production database.
  process.env.NODE_ENV = 'production';
  delete process.env.DATABASE_URL;
  process.env.APP_ACCESS_TOKEN = 'persistence-test-only';
  const { app, databaseReady } = await import('../api/index.js');
  await databaseReady;
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}/api`;
});
after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('the real app returns 503 for task reads and every persistence write without Neon', async () => {
  for (const [method, path] of [
    ['GET', '/tasks'], ['GET', '/settings'], ['POST', '/tasks'], ['DELETE', '/tasks/custom'],
    ['POST', '/tasks/reset'], ['POST', '/settings'], ['POST', '/workout-state'],
    ['POST', '/diet-state'], ['POST', '/subscribe']
  ]) {
    const response = await fetch(base + path, { method, headers: {
      Authorization: 'Bearer persistence-test-only', 'Content-Type': 'application/json'
    }, ...(method === 'POST' ? { body: '{}' } : {}) });
    assert.equal(response.status, 503, `${method} ${path}`);
    assert.notEqual((await response.json()).success, true);
  }
});

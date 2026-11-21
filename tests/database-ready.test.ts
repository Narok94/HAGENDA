import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createDatabaseInitializer } from '../api/_database-ready.js';

test('a transient Neon cold-start failure recovers and concurrent requests share initialization', async () => {
  let attempts = 0; const delays: number[] = [];
  const ensure = createDatabaseInitializer(async () => { if (++attempts < 3) throw new Error('Error connecting to database: TypeError: fetch failed'); }, { wait: async ms => { delays.push(ms); } });
  await Promise.all([ensure(), ensure(), ensure()]);
  assert.equal(attempts, 3); assert.deepEqual(delays, [250, 500]);
  await ensure(); assert.equal(attempts, 3);
});

test('exhausted initialization fails closed, then later API requests recover without redeploy', async () => {
  let attempts = 0, time = 0, online = false, writes = 0;
  const ensure = createDatabaseInitializer(async () => { attempts++; if (!online) throw Object.assign(new Error('fetch failed'), { code: 'ECONNRESET' }); }, { now: () => time, wait: async () => {} });
  // Match eager startup plus the real API gate, without a production connection.
  await assert.rejects(ensure()); assert.equal(attempts, 3);
  const app = express(); app.use(async (_req, res, next) => { try { await ensure(); next(); } catch { res.status(503).json({ error: 'Banco indisponível' }); } });
  app.post('/write', (_req, res) => { writes++; res.json({ success: true }); });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/write`;
    assert.equal((await fetch(url, { method: 'POST' })).status, 503);
    assert.equal(writes, 0); assert.equal(attempts, 3);
    time = 5000; online = true;
    const responses = await Promise.all([fetch(url, { method: 'POST' }), fetch(url, { method: 'POST' })]);
    assert.deepEqual(responses.map(r => r.status), [200, 200]);
    assert.equal(attempts, 4); assert.equal(writes, 2);
  } finally { await new Promise<void>(r => server.close(() => r())); }
});

test('schema errors are reported immediately rather than retried as network failures', async () => {
  let attempts = 0;
  const ensure = createDatabaseInitializer(async () => { attempts++; throw Object.assign(new Error('invalid schema'), { code: '42601' }); });
  await assert.rejects(ensure(), /invalid schema/);
  await assert.rejects(ensure(), /invalid schema/);
  assert.equal(attempts, 1);
});

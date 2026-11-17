import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TaskSync, reconcile } from '../src/utils/taskSync.js';
import type { Task } from '../src/types.js';

class MemoryStorage {
  values = new Map<string, string>();
  denyWrites = false;
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.denyWrites) throw new Error('Quota exceeded'); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const task = (id = 'test'): Task => ({ id, version: '1', title: 'Original', time: '10:00', date: '2026-11-17',
  category: 'Geral', icon: 'Circle', completed: false, priority: false, notes: '', recurrence: 'none', completedDates: [] });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function backend(initial: Task[] = [task()]) {
  const remote = new Map(initial.map(value => [value.id, copy(value)]));
  const calls: { method: string; path: string; body: any }[] = [];
  let revision = 10, failure = 0, lostResponse = false;
  let beforeWrite: (() => void) | undefined;
  let pauseRead: Promise<unknown> | undefined;
  const api: typeof fetch = async (input, options) => {
    const path = String(input), method = options?.method || 'GET';
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    calls.push({ method, path, body });
    if (method === 'GET') {
      const snapshot = copy([...remote.values()]);
      if (pauseRead) { const wait = pauseRead; pauseRead = undefined; await wait; }
      return json(snapshot);
    }
    if (failure) return json({ error: 'Simulated failure' }, failure);
    if (beforeWrite) { const work = beforeWrite; beforeWrite = undefined; work(); }
    if (method === 'POST') {
      const previous = remote.get(body.id);
      if ((previous && previous.version !== body.version) || (!previous && body.version)) return json({ error: 'Conflict' }, 409);
      const saved = { ...body, version: String(++revision) };
      remote.set(saved.id, saved);
      if (lostResponse) { lostResponse = false; throw new Error('Connection closed after commit'); }
      return json({ success: true, task: saved });
    }
    const id = decodeURIComponent(path.split('/').at(-1)!);
    const current = remote.get(id);
    if (!current || new Headers(options?.headers).get('If-Match') !== current.version) return json({ error: 'Conflict' }, 409);
    remote.delete(id);
    if (lostResponse) { lostResponse = false; throw new Error('Connection closed after commit'); }
    return json({ success: true });
  };
  return { remote, calls, api,
    fail: (status: number) => { failure = status; }, loseResponse: () => { lostResponse = true; },
    interleave: (work: () => void) => { beforeWrite = work; }, pauseRead: (promise: Promise<unknown>) => { pauseRead = promise; } };
}
async function fixture(initial?: Task[]) {
  const server = backend(initial), storage = new MemoryStorage();
  const store = new TaskSync({ storage, fetch: server.api });
  await store.refresh();
  return { store, storage, server };
}

test('failed completion stays unconfirmed, survives reload and retries without losing other data', async () => {
  const { store, storage, server } = await fixture();
  const before = copy(store.getSnapshot().tasks[0]);
  server.fail(503);
  await assert.rejects(store.saveTask(before, { ...before, completed: true }));
  assert.equal(store.getSnapshot().tasks[0].completed, false);
  assert.equal(store.getSnapshot().pending.length, 1);
  assert.equal(store.getSnapshot().pending[0].durable, true);
  const restored = new TaskSync({ storage, fetch: server.api });
  assert.equal(restored.getSnapshot().pending.length, 1);
  server.remote.set('test', { ...before, notes: 'Remote note', version: '2' });
  server.fail(0);
  await restored.retry();
  assert.equal(restored.getSnapshot().pending.length, 0);
  assert.equal(restored.getSnapshot().tasks[0].completed, true);
  assert.equal(server.remote.get('test')!.notes, 'Remote note');
});

test('401, 403, 500 and malformed success responses keep the pending intent', async () => {
  for (const status of [401, 403, 500]) {
    const { store, server } = await fixture();
    const before = store.getSnapshot().tasks[0];
    server.fail(status);
    await assert.rejects(store.saveTask(before, { ...before, priority: true }));
    assert.equal(store.getSnapshot().tasks[0].priority, false);
    assert.equal(store.getSnapshot().pending.length, 1);
  }
  const storage = new MemoryStorage();
  const store = new TaskSync({ storage, fetch: async (_input, options) => options?.method === 'POST' ? json({ success: true }) : json([task()]) });
  await store.refresh();
  await assert.rejects(store.saveTask(task(), { ...task(), priority: true }), /confirmou/);
  assert.equal(store.getSnapshot().pending.length, 1);
});

test('AI/voice creations keep their UUID and never appear saved before persistence', async () => {
  const { store, storage, server } = await fixture([]);
  const draft = { ...task('voice-draft'), version: undefined, title: 'Tarefa por voz' };
  server.fail(503);
  await assert.rejects(store.saveTask(null, draft));
  assert.deepEqual(store.getSnapshot().tasks, []);
  await assert.rejects(store.saveTask(null, draft));
  assert.equal(store.getSnapshot().pending.length, 1);
  const reloaded = new TaskSync({ storage, fetch: server.api });
  server.fail(0);
  await reloaded.retry();
  assert.equal(reloaded.getSnapshot().tasks[0].id, 'voice-draft');
  assert.equal(server.remote.size, 1);
});

test('an interrupted POST response is reconciled without duplicate creation', async () => {
  const { store, server } = await fixture([]);
  const draft = { ...task('ai-draft'), version: undefined };
  server.loseResponse();
  await assert.rejects(store.saveTask(null, draft));
  assert.equal(store.getSnapshot().pending.length, 1);
  await store.retry();
  assert.equal(store.getSnapshot().pending.length, 0);
  assert.equal(server.remote.size, 1);
  assert.equal(server.calls.filter(call => call.method === 'POST').length, 1);
});

test('failed DELETE and undo remain pending and do not pretend to succeed', async () => {
  const { store, server } = await fixture();
  const original = store.getSnapshot().tasks[0];
  server.fail(503);
  await assert.rejects(store.deleteTask(original));
  assert.equal(store.getSnapshot().tasks.length, 1);
  server.fail(0);
  await store.retry();
  assert.equal(store.getSnapshot().tasks.length, 0);
  server.fail(500);
  await assert.rejects(store.saveTask(null, { ...original, version: undefined }));
  assert.equal(store.getSnapshot().tasks.length, 0);
  assert.equal(store.getSnapshot().pending[0].after?.title, original.title);
  server.fail(0);
  await store.retry();
  assert.equal(store.getSnapshot().tasks[0].title, original.title);
});

test('an interrupted DELETE response is acknowledged only after confirming absence', async () => {
  const { store, server } = await fixture();
  server.loseResponse();
  await assert.rejects(store.deleteTask(store.getSnapshot().tasks[0]));
  await store.retry();
  assert.equal(store.getSnapshot().pending.length, 0);
  assert.deepEqual(store.getSnapshot().tasks, []);
  assert.equal(server.calls.filter(call => call.method === 'DELETE').length, 1);
});

test('same-field conflicts require an explicit decision; reapplying preserves unrelated remote fields', async () => {
  const { store, server } = await fixture();
  const original = store.getSnapshot().tasks[0];
  server.remote.set('test', { ...original, title: 'Outro dispositivo', notes: 'Preservar', version: '2' });
  await assert.rejects(store.saveTask(original, { ...original, title: 'Minha alteração' }));
  const pending = store.getSnapshot().pending[0];
  assert.deepEqual(pending.conflict, ['title']);
  assert.equal(server.remote.get('test')!.title, 'Outro dispositivo');
  assert.equal(server.calls.filter(call => call.method === 'POST').length, 0);
  await store.refresh(); // Focus does not discard the intent or its original base.
  assert.equal(store.getSnapshot().pending[0].after?.title, 'Minha alteração');
  await store.reapply(pending.id);
  assert.equal(server.remote.get('test')!.title, 'Minha alteração');
  assert.equal(server.remote.get('test')!.notes, 'Preservar');
  assert.equal(store.getSnapshot().pending.length, 0);
});

test('stale deletion requires review and stale editing never recreates a remotely deleted task', async () => {
  const { store, server } = await fixture();
  const original = store.getSnapshot().tasks[0];
  server.remote.set('test', { ...original, notes: 'Novo dado', version: '2' });
  await assert.rejects(store.deleteTask(original));
  assert.ok(server.remote.has('test'));
  store.discard(store.getSnapshot().pending[0].id);
  server.remote.delete('test');
  await assert.rejects(store.saveTask(original, { ...original, completed: true }));
  assert.equal(server.remote.size, 0);
  assert.deepEqual(store.getSnapshot().pending[0].conflict, ['exclusão']);
});

test('a 409 during the actual write triggers a fresh three-way merge', async () => {
  const { store, server } = await fixture();
  const original = store.getSnapshot().tasks[0];
  server.interleave(() => server.remote.set('test', { ...original, notes: 'Gravado durante envio', version: '2' }));
  await store.saveTask(original, { ...original, completed: true });
  assert.equal(server.remote.get('test')!.completed, true);
  assert.equal(server.remote.get('test')!.notes, 'Gravado durante envio');
  assert.equal(server.calls.filter(call => call.method === 'POST').length, 2);
});

test('a delayed focus read cannot replace a subsequent confirmed write', async () => {
  const { store, server } = await fixture();
  const original = store.getSnapshot().tasks[0];
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  server.pauseRead(delayed);
  const refresh = store.refresh();
  const mutation = store.saveTask(original, { ...original, completed: true });
  assert.equal(store.getSnapshot().tasks[0].completed, false);
  release();
  await Promise.all([refresh, mutation]);
  assert.equal(store.getSnapshot().tasks[0].completed, true);
  assert.equal(store.getSnapshot().pending.length, 0);
});

test('rapid edits from this page retain their causal order without self-conflicting', async () => {
  const { store, server } = await fixture();
  const original = store.getSnapshot().tasks[0];
  await Promise.all([
    store.saveTask(original, { ...original, title: 'A' }),
    store.saveTask(original, { ...original, title: 'AB' }),
    store.saveTask(original, { ...original, title: 'ABC' })
  ]);
  assert.equal(server.remote.get('test')!.title, 'ABC');
  assert.equal(store.getSnapshot().pending.length, 0);
});

test('different tabs never overwrite each other’s journal entries and independent edits reconcile', async () => {
  const { store, storage, server } = await fixture();
  const other = new TaskSync({ storage, fetch: server.api });
  const original = copy(store.getSnapshot().tasks[0]);
  server.fail(503);
  await Promise.allSettled([
    store.saveTask(original, { ...original, completed: true }),
    other.saveTask(original, { ...original, notes: 'Outra aba' })
  ]);
  assert.equal([...storage.values.keys()].filter(key => key.startsWith('momentum_task_pending:')).length, 2);
  server.fail(0);
  await other.retry();
  assert.equal(server.remote.get('test')!.completed, true);
  assert.equal(server.remote.get('test')!.notes, 'Outra aba');
  assert.equal(other.getSnapshot().pending.length, 0);
});

test('recurring postponement persists the whole intent before sending and resumes after partial failure', async () => {
  const { store, storage, server } = await fixture([{ ...task(), recurrence: 'semanal' }]);
  const original = store.getSnapshot().tasks[0];
  const child = { ...original, id: 'postponed', version: undefined, recurrence: 'none' as const, date: '2026-11-18' };
  server.fail(503);
  await assert.rejects(store.saveTaskBatch([
    { before: null, after: child }, { before: original, after: { ...original, completedDates: ['2026-11-17'] } }
  ]));
  const stored = store.getSnapshot().pending[0];
  assert.equal(stored.steps?.length, 2);
  assert.deepEqual(server.remote.get('test')!.completedDates, []);
  server.fail(0);
  const reloaded = new TaskSync({ storage, fetch: server.api });
  await reloaded.retry();
  assert.equal(server.remote.size, 2);
  assert.deepEqual(server.remote.get('test')!.completedDates, ['2026-11-17']);
  assert.equal(reloaded.getSnapshot().pending.length, 0);
});

test('unavailable local storage retains the intent in memory, reports it and does not send an unjournaled mutation', async () => {
  const { store, storage, server } = await fixture();
  storage.denyWrites = true;
  const original = store.getSnapshot().tasks[0];
  await assert.rejects(store.saveTask(original, { ...original, priority: true }));
  assert.equal(store.getSnapshot().pending[0].durable, false);
  assert.equal(server.calls.filter(call => call.method === 'POST').length, 0);
  storage.denyWrites = false;
  await store.retry();
  assert.equal(server.remote.get('test')!.priority, true);
});

test('completed dates reconcile per day and nested resource changes preserve unrelated keys', () => {
  const original = { ...task(), completedDates: ['2026-11-15'] };
  const result = reconcile('tasks', original, { ...original, completedDates: ['2026-11-17'] },
    { ...original, completedDates: ['2026-11-15', '2026-11-16'] });
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.value.completedDates, ['2026-11-16', '2026-11-17']);
  const base = { dietDate: '2026-11-17', completedMeals: {}, waterMl: 0 };
  const meal = reconcile('diet-state', base, { ...base, completedMeals: { lunch: true } },
    { ...base, completedMeals: { dinner: true }, waterMl: 1000 });
  assert.deepEqual(meal.conflicts, []);
  assert.deepEqual(meal.value.completedMeals, { lunch: true, dinner: true });
  assert.equal(meal.value.waterMl, 1000);
  assert.deepEqual(reconcile('diet-state', base, { ...base, waterMl: 2000 },
    { ...base, dietDate: '2026-11-18' }, true).conflicts, ['dietDate']);
});

test('an unreadable entry never hides or erases valid pending operations', async () => {
  const { store, storage, server } = await fixture();
  storage.setItem('momentum_task_pending:damaged', '{incomplete-json');
  const original = store.getSnapshot().tasks[0];
  await store.saveTask(original, { ...original, completed: true });
  assert.equal(server.remote.get('test')!.completed, true);
  assert.equal(storage.getItem('momentum_task_pending:damaged'), '{incomplete-json');
  assert.match(store.getSnapshot().error, /ilegível/);
});

test('journal enumeration failure cannot count as successful persistence', async () => {
  const { store, storage, server } = await fixture();
  const original = store.getSnapshot().tasks[0];
  Object.defineProperty(storage, 'length', { configurable: true, get() { throw new Error('Storage unavailable'); } });
  await assert.rejects(store.saveTask(original, { ...original, priority: true }), /confirmar/);
  assert.equal(server.remote.get('test')!.priority, false);
  assert.equal([...storage.values.keys()].filter(key => key.startsWith('momentum_task_pending:')).length, 1);
  Object.defineProperty(storage, 'length', { get() { return storage.values.size; } });
  await store.retry();
  assert.equal(server.remote.get('test')!.priority, true);
});

test('editing a failed creation updates the same task instead of creating competing drafts', async () => {
  const { store, server } = await fixture([]);
  server.fail(503);
  const first = { ...task('draft'), version: undefined, title: 'Primeiro rascunho' };
  await assert.rejects(store.saveTask(null, first));
  await assert.rejects(store.saveTask(null, { ...first, title: 'Rascunho revisado' }));
  server.fail(0);
  await store.retry();
  assert.equal(server.remote.size, 1);
  assert.equal(server.remote.get('draft')!.title, 'Rascunho revisado');
  assert.equal(store.getSnapshot().pending.length, 0);
});

test('resolving an early conflict keeps later edits in their original causal order', async () => {
  const { store, server } = await fixture();
  const original = store.getSnapshot().tasks[0];
  server.remote.set('test', { ...original, title: 'Remoto', version: '2' });
  await assert.rejects(store.saveTask(original, { ...original, title: 'A' }));
  await assert.rejects(store.saveTask(original, { ...original, title: 'AB' }));
  await store.reapply(store.getSnapshot().pending[0].id);
  assert.equal(server.remote.get('test')!.title, 'AB');
  assert.equal(store.getSnapshot().pending.length, 0);
});

test('partial recurring postponement resumes its second step without duplicate copies', async () => {
  const { store, storage, server } = await fixture([{ ...task(), recurrence: 'semanal' }]);
  const original = store.getSnapshot().tasks[0];
  const child = { ...original, id: 'copy', version: undefined, recurrence: 'none' as const, date: '2026-11-18' };
  server.interleave(() => server.fail(503)); // Commit the copy, fail the following parent update.
  await assert.rejects(store.saveTaskBatch([
    { before: null, after: child }, { before: original, after: { ...original, completedDates: ['2026-11-17'] } }
  ]));
  assert.ok(server.remote.has('copy'));
  assert.deepEqual(server.remote.get('test')!.completedDates, []);
  assert.equal(store.getSnapshot().pending.length, 1);
  server.fail(0);
  const reloaded = new TaskSync({ storage, fetch: server.api });
  await reloaded.retry();
  assert.equal(server.remote.size, 2);
  assert.deepEqual(server.remote.get('test')!.completedDates, ['2026-11-17']);
  assert.equal(server.calls.filter(call => call.method === 'POST' && call.body.id === 'copy').length, 1);
});

test('request timeout reports the failure and retains the durable operation', async () => {
  const storage = new MemoryStorage();
  storage.setItem('momentum_tasks', JSON.stringify([task()]));
  const hanging: typeof fetch = (_input, options) => new Promise<Response>((_resolve, reject) => {
    options!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  const store = new TaskSync({ storage, fetch: hanging, requestTimeoutMs: 5 });
  await assert.rejects(store.saveTask(task(), { ...task(), completed: true }), /demorou/);
  assert.equal(store.getSnapshot().pending.length, 1);
  assert.equal(store.getSnapshot().pending[0].durable, true);
  assert.equal(store.getSnapshot().tasks[0].completed, false);
});

test('water increments and changes of workout context cannot be silently accepted as a different action', () => {
  const base = { dietDate: '2026-11-17', completedMeals: {}, waterMl: 0 };
  assert.deepEqual(reconcile('diet-state', base, { ...base, waterMl: 250 }, { ...base, waterMl: 250 }).conflicts, ['waterMl']);
  const workout = { workoutDate: '2026-11-17', activeGroupId: 'A', completedExercises: {}, weights: {} };
  assert.deepEqual(reconcile('workout-state', workout, { ...workout, completedExercises: { exercise_a: true } },
    { ...workout, activeGroupId: 'B' }).conflicts, ['activeGroupId']);
});

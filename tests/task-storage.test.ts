import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTaskCache, writeTaskCache, isTaskList } from '../src/utils/taskStorage.js';

const tasks = [{ id: 'cached', title: 'Sem conexão', time: '10:00', date: '2026-11-17',
  category: 'Geral', icon: 'Circle', completed: false, priority: false, completedDates: ['2026-11-16'] }];

test('recovers cached tasks synchronously before initial state can overwrite them', () => {
  let saved = JSON.stringify(tasks);
  const storage = {
    getItem(key: string) { assert.equal(key, 'momentum_tasks'); return saved; },
    setItem(key: string, value: string) { assert.equal(key, 'momentum_tasks'); saved = value; }
  };
  const initial = readTaskCache(storage);
  assert.equal(initial.recovered, true);
  assert.deepEqual(initial.tasks, tasks);
  // The first persistence effect sees recovered state, even before fetch resolves.
  assert.equal(writeTaskCache(initial.tasks, storage), true);
  assert.deepEqual(JSON.parse(saved), tasks);
  assert.deepEqual(readTaskCache(storage).tasks, tasks); // StrictMode / remount
});

test('unreadable storage and malformed cache do not throw or authorize replacing it', () => {
  for (const saved of ['broken-json', '{}', '[{}]', 'null']) {
    const initial = readTaskCache({ getItem: () => saved });
    assert.equal(initial.recovered, false);
    assert.deepEqual(initial.tasks, []);
  }
  const initial = readTaskCache({ getItem: () => { throw new Error('Storage denied'); } });
  assert.equal(initial.recovered, false);
  assert.equal(writeTaskCache(tasks, { setItem: () => { throw new Error('Quota exceeded'); } }), false);
});

test('valid empty data and missing cache are accepted, invalid server payloads are rejected', () => {
  assert.deepEqual(readTaskCache({ getItem: () => null }), { tasks: [], recovered: true });
  assert.deepEqual(readTaskCache({ getItem: () => '[]' }), { tasks: [], recovered: true });
  assert.equal(isTaskList(tasks), true);
  for (const invalid of [{ error: 'Banco indisponível' }, null, [null], [{ ...tasks[0], completedDates: 'invalid' }]]) {
    assert.equal(isTaskList(invalid), false);
  }
});

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { installTaskPersistence, installSettingsPersistence, installPersistenceGuard, migrateTaskPersistence } from '../api/persistence.js';
import { migrateReminders } from '../api/reminders.js';

// This suite imports only injectable routes, never the production app or its env.
let db: PGlite, sql: any, server: Server, base: string;
let failReads = false, failWrites = false;
const task = {
  id: 'custom', title: 'Preservar tarefa', time: '10:00', date: '2026-11-17',
  category: 'Geral', icon: 'Circle', completed: false, priority: true,
  notes: 'Dados existentes', recurrence: 'none', completedDates: []
};

before(async () => {
  db = new PGlite();
  // Neon queries are lazy: constructing the transaction must not run its SQL.
  sql = (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, '');
    return { text, values, then(resolve: any, reject: any) {
      const result = (failReads && /SELECT/i.test(text)) || (failWrites && /INSERT|UPDATE|DELETE/i.test(text))
        ? Promise.reject(new Error('Banco indisponível (simulado)'))
        : db.query(text, values).then(result => result.rows);
      return result.then(resolve, reject);
    } };
  };
  sql.transaction = (queries: { text: string; values: any[] }[]) => db.transaction(async tx => {
    if (failWrites) throw new Error('Banco indisponível (simulado)');
    const results = [];
    for (const query of queries) results.push((await tx.query(query.text, query.values)).rows);
    return results;
  });
  await migrateTaskPersistence(sql);
  await migrateReminders(sql);
  await db.exec(`CREATE TABLE user_settings(id int PRIMARY KEY, user_name text, high_contrast boolean,
    reminder_minutes int, completed_study_dates text, updated_at timestamptz);
    CREATE TABLE diet_state(id int PRIMARY KEY,diet_date text,completed_meals text,water_ml int);
    CREATE TABLE workout_state(id int PRIMARY KEY,active_group_id text,workout_date text,completed_exercises text,weights text);`);
  const app = express(); app.use(express.json());
  const router = express.Router();
  installPersistenceGuard(router, () => sql);
  installTaskPersistence(router, () => sql);
  installSettingsPersistence(router, () => sql);
  app.use('/api', router);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await db?.close();
});

beforeEach(async () => {
  failReads = false; failWrites = false;
  await db.exec(`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS reject_seed;
    TRUNCATE tasks,reminder_configs,reminder_occurrences,reminder_deliveries,user_settings,diet_state,workout_state;`);
});

function request(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test('task CRUD round-trips existing data and flexible time through durable SQL', async () => {
  assert.equal((await request('/tasks', { ...task, time: 'Horário flexível' })).status, 200);
  const response = await request('/tasks');
  assert.equal(response.status, 200);
  const [saved] = await response.json();
  assert.equal(saved.time, 'Horário flexível');
  assert.equal(saved.notes, task.notes);
  assert.equal(saved.priority, true);
  assert.equal((await request('/tasks/custom', undefined, 'DELETE')).status, 200);
  assert.deepEqual(await (await request('/tasks')).json(), []);
});

test('GET /tasks fails with 503 on a query error, preserving existing rows', async () => {
  await request('/tasks', task);
  failReads = true;
  const response = await request('/tasks');
  assert.equal(response.status, 503);
  assert.ok(!Array.isArray(await response.json()));
  assert.equal((await db.query<{ title: string }>('SELECT title FROM tasks')).rows[0].title, task.title);
});

test('GET /tasks fails with 503 for corrupt stored JSON instead of serving defaults', async () => {
  await request('/tasks', task);
  await db.exec("UPDATE tasks SET completed_dates='broken-json'");
  assert.equal((await request('/tasks')).status, 503);
  assert.equal((await db.query<{ completed_dates: string }>('SELECT completed_dates FROM tasks')).rows[0].completed_dates, 'broken-json');
});

test('failed Neon writes are never acknowledged as success', async () => {
  failWrites = true;
  for (const [path, body, method] of [
    ['/tasks', task, 'POST'], ['/tasks/custom', undefined, 'DELETE'],
    ['/tasks/reset', {}, 'POST'], ['/settings', { userName: 'Teste' }, 'POST']
  ] as const) {
    const response = await request(path, body, method);
    assert.equal(response.status, 500, path);
    assert.notEqual((await response.json()).success, true);
  }
  assert.deepEqual((await db.query('SELECT * FROM tasks')).rows, []);
  assert.deepEqual((await db.query('SELECT * FROM user_settings')).rows, []);
});

test('time migration preserves a legacy row and is safe to run again', async () => {
  await db.exec('ALTER TABLE tasks ALTER COLUMN time TYPE VARCHAR(5)');
  assert.equal((await request('/tasks', task)).status, 200);
  await migrateTaskPersistence(sql);
  await migrateTaskPersistence(sql);
  const [saved] = (await db.query<{ title: string; time: string; notes: string }>('SELECT * FROM tasks')).rows;
  assert.equal(saved.title, task.title);
  assert.equal(saved.time, task.time);
  assert.equal(saved.notes, task.notes);
  assert.equal((await request('/tasks', { ...task, time: 'Horário flexível' })).status, 200);
});

test('reset creates all eight defaults including flexible time in the memory database', async () => {
  await request('/tasks', task);
  const response = await request('/tasks/reset', {});
  assert.equal(response.status, 200);
  const rows = (await db.query<{ id: string; time: string }>('SELECT id,time FROM tasks ORDER BY id')).rows;
  assert.equal(rows.length, 8);
  assert.equal(rows.find(row => row.id === 'task_estudo')?.time, 'Horário flexível');
  assert.ok(!rows.some(row => row.id === task.id));
});

test('reset rolls back tasks, reminder configs and cancellations if the last insert fails', async () => {
  await request('/tasks', task);
  await sql`INSERT INTO reminder_configs(activity_id,config,revision) VALUES('custom','{"mode":"none"}'::jsonb,'v1')`;
  await sql`INSERT INTO reminder_occurrences(activity_id,occurrence_date,revision,next_at) VALUES('custom','2026-11-17','v1',now())`;
  await db.exec("ALTER TABLE tasks ADD CONSTRAINT reject_seed CHECK (id <> 'task_estudo')");
  assert.equal((await request('/tasks/reset', {})).status, 500);
  assert.deepEqual((await db.query('SELECT id,title,notes FROM tasks')).rows,
    [{ id: task.id, title: task.title, notes: task.notes }]);
  assert.equal((await db.query<{ revision: string }>('SELECT revision FROM reminder_configs')).rows[0].revision, 'v1');
  assert.equal((await db.query<{ cancelled_at: string | null }>('SELECT cancelled_at FROM reminder_occurrences')).rows[0].cancelled_at, null);
});

test('settings preserve omitted study history and profile fields across partial requests', async () => {
  const dates = ['2026-10-01', '2026-10-02'];
  assert.equal((await request('/settings', { userName: 'Perfil', highContrast: true, reminderMinutes: 30, completedStudyDates: dates })).status, 200);
  const profile = await request('/settings', { userName: 'Novo nome' });
  assert.equal(profile.status, 200);
  assert.deepEqual((await profile.json()).settings, { userName: 'Novo nome', highContrast: true, reminderMinutes: 30, completedStudyDates: dates });
  const study = await request('/settings', { completedStudyDates: [...dates, '2026-10-03'] });
  assert.equal(study.status, 200);
  assert.deepEqual((await study.json()).settings, { userName: 'Novo nome', highContrast: true, reminderMinutes: 30, completedStudyDates: [...dates, '2026-10-03'] });
  const omitted = await request('/settings', {});
  assert.equal(omitted.status, 200);
  assert.deepEqual((await omitted.json()).settings.completedStudyDates, [...dates, '2026-10-03']);
});

test('explicit empty history is respected and invalid input cannot overwrite saved dates', async () => {
  await request('/settings', { completedStudyDates: ['2026-10-01'] });
  for (const completedStudyDates of [null, 'invalid', [42]]) {
    assert.equal((await request('/settings', { completedStudyDates })).status, 400);
  }
  assert.deepEqual((await (await request('/settings')).json()).completedStudyDates, ['2026-10-01']);
  const response = await request('/settings', { completedStudyDates: [] });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).settings.completedStudyDates, []);
});

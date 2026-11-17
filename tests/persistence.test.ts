import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { installTaskPersistence, installSettingsPersistence, installPersistenceGuard, migrateTaskPersistence } from '../api/persistence.js';
import { migrateReminders } from '../api/reminders.js';
import { installIntegratedPersistence } from '../api/integrated-persistence.js';
import { TaskSync } from '../src/utils/taskSync.js';
import { localDate } from '../api/reminder-policy.js';

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
  sql.query = async (text: string, values: any[]) => {
    if ((failReads && /SELECT/i.test(text)) || (failWrites && /INSERT|UPDATE|DELETE/i.test(text))) throw new Error('Banco indisponível (simulado)');
    return (await db.query(text, values)).rows;
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
    CREATE TABLE diet_state(id int PRIMARY KEY,diet_date text,completed_meals text,water_ml int,updated_at timestamptz);
    CREATE TABLE workout_state(id int PRIMARY KEY,active_group_id text,workout_date text,completed_exercises text,weights text,updated_at timestamptz);`);
  const app = express(); app.use(express.json());
  const router = express.Router();
  installPersistenceGuard(router, () => sql);
  installTaskPersistence(router, () => sql);
  installSettingsPersistence(router, () => sql);
  installIntegratedPersistence(router, () => sql);
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

async function request(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', headers: Record<string,string> = {}) {
  if (method === 'DELETE' && !headers['If-Match']) {
    const rows = (await db.query<{ version: string }>("SELECT xmin::text AS version FROM tasks WHERE id='custom'")).rows;
    headers['If-Match'] = rows[0]?.version || 'missing';
  }
  if (path === '/settings' && body && typeof body === 'object' && Object.hasOwn(body, 'completedStudyDates') && !headers['If-Match']) {
    const rows = (await db.query<{ version: string }>('SELECT xmin::text AS version FROM user_settings WHERE id=1')).rows;
    headers['If-Match'] = rows[0]?.version || 'absent';
  }
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers },
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
  const [current] = await (await request('/tasks')).json();
  assert.equal((await request('/tasks', { ...current, time: 'Horário flexível' })).status, 200);
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
  const {version: profileVersion, ...profileFields} = (await profile.json()).settings;
  assert.equal(typeof profileVersion, 'string');
  assert.deepEqual(profileFields, { userName: 'Novo nome', highContrast: true, reminderMinutes: 30, completedStudyDates: dates });
  const study = await request('/settings', { completedStudyDates: [...dates, '2026-10-03'] });
  assert.equal(study.status, 200);
  const {version: studyVersion, ...studyFields} = (await study.json()).settings;
  assert.equal(typeof studyVersion, 'string');
  assert.deepEqual(studyFields, { userName: 'Novo nome', highContrast: true, reminderMinutes: 30, completedStudyDates: [...dates, '2026-10-03'] });
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

async function currentTask() { return (await (await request('/tasks')).json())[0]; }

test('concurrent task writes from the same version allow exactly one winner', async () => {
  await request('/tasks', task);
  const original = await currentTask();
  assert.equal(typeof original.version, 'string');
  const results = await Promise.all([
    request('/tasks', { ...original, notes: 'Primeira alteração' }),
    request('/tasks', { ...original, title: 'Segunda alteração' })
  ]);
  assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
  const saved = await currentTask();
  assert.notEqual(saved.version, original.version);
  assert.ok((saved.notes === 'Primeira alteração' && saved.title === original.title) ||
    (saved.title === 'Segunda alteração' && saved.notes === original.notes));
});

test('stale updates cannot change reminder revision or overwrite notification completions', async () => {
  await request('/tasks', task);
  const original = await currentTask();
  await sql`INSERT INTO reminder_configs(activity_id,config,revision) VALUES('custom','{"mode":"none"}'::jsonb,'keep')`;
  await db.exec("UPDATE tasks SET completed=true WHERE id='custom'"); // Same path as a notification writer.
  assert.equal((await request('/tasks', { ...original, time: '20:00' })).status, 409);
  assert.equal((await currentTask()).completed, true);
  assert.equal((await db.query<{ revision: string }>('SELECT revision FROM reminder_configs')).rows[0].revision, 'keep');
});

test('stale deletes keep the task and its reminders and updates never recreate deleted rows', async () => {
  await request('/tasks', task);
  const original = await currentTask();
  await sql`INSERT INTO reminder_configs(activity_id,config,revision) VALUES('custom','{"mode":"none"}'::jsonb,'keep')`;
  assert.equal((await request('/tasks', { ...original, title: 'Salvar dado novo' })).status, 200);
  assert.equal((await request('/tasks/custom', undefined, 'DELETE', { 'If-Match': original.version })).status, 409);
  assert.equal((await db.query('SELECT * FROM reminder_configs')).rows.length, 1);
  const latest = await currentTask();
  assert.equal((await request('/tasks/custom', undefined, 'DELETE', { 'If-Match': latest.version })).status, 200);
  assert.equal((await request('/tasks', { ...latest, notes: 'Não ressuscitar' })).status, 409);
  assert.deepEqual(await (await request('/tasks')).json(), []);
});

test('unversioned requests can create but cannot overwrite or delete existing tasks', async () => {
  assert.equal((await request('/tasks', task)).status, 200);
  assert.equal((await request('/tasks', { ...task, title: 'Sobrescrita proibida' })).status, 409);
  const response = await fetch(base + '/tasks/custom', { method: 'DELETE' });
  assert.equal(response.status, 428);
  assert.equal((await currentTask()).title, task.title);
});

test('successful schedule editing and deletion still update the matching reminders atomically', async () => {
  await request('/tasks', task);
  const original = await currentTask();
  await sql`INSERT INTO reminder_configs(activity_id,config,revision) VALUES('custom','{"mode":"none"}'::jsonb,'old')`;
  await sql`INSERT INTO reminder_occurrences(activity_id,occurrence_date,revision,next_at) VALUES('custom','2026-11-17','old',now())`;
  assert.equal((await request('/tasks', { ...original, time: '12:00', completed: true })).status, 200);
  const [config] = await sql`SELECT * FROM reminder_configs`;
  assert.notEqual(config.revision, 'old');
  assert.ok((await sql`SELECT confirmed_at FROM reminder_occurrences`)[0].confirmed_at);
  const latest = await currentTask();
  assert.equal((await request('/tasks/custom', undefined, 'DELETE', { 'If-Match': latest.version })).status, 200);
  assert.equal((await sql`SELECT * FROM reminder_configs`).length, 0);
  assert.ok((await sql`SELECT cancelled_at FROM reminder_occurrences`)[0].cancelled_at);
});

test('integrated tasks expose versions and reject outdated snapshots without losing meals or weights', async () => {
  const diet = { dietDate: '2026-11-17', completedMeals: { lunch: true }, waterMl: 1000 };
  const initial = await request('/diet-state', diet, 'POST', { 'If-Match': 'absent' });
  assert.equal(initial.status, 200);
  const original = await (await request('/diet-state')).json();
  assert.equal(typeof original.version, 'string');
  assert.equal((await request('/diet-state', { ...diet, waterMl: 2000 }, 'POST', { 'If-Match': original.version })).status, 200);
  assert.equal((await request('/diet-state', { ...diet, completedMeals: {} }, 'POST', { 'If-Match': original.version })).status, 409);
  const saved = await (await request('/diet-state')).json();
  assert.equal(saved.waterMl, 2000);
  assert.deepEqual(saved.completedMeals, { lunch: true });
  const workout = { activeGroupId: 'A', workoutDate: '2026-11-17', completedExercises: {}, weights: { squat: '60' } };
  assert.equal((await request('/workout-state', workout, 'POST', { 'If-Match': 'absent' })).status, 200);
  const before = await (await request('/workout-state')).json();
  assert.equal((await request('/workout-state', { ...workout, weights: { squat: '80' } }, 'POST', { 'If-Match': before.version })).status, 200);
  assert.equal((await request('/workout-state', workout, 'POST', { 'If-Match': before.version })).status, 409);
  assert.deepEqual((await (await request('/workout-state')).json()).weights, { squat: '80' });
  assert.equal((await request('/diet-state', diet)).status, 428);
});

test('study history uses version comparisons while profile-only patches preserve all dates', async () => {
  await request('/settings', { completedStudyDates: ['2026-10-01'] });
  const original = await (await request('/settings')).json();
  assert.equal((await request('/settings', { completedStudyDates: ['2026-10-01', '2026-10-02'] }, 'POST', { 'If-Match': original.version })).status, 200);
  assert.equal((await request('/settings', { completedStudyDates: [] }, 'POST', { 'If-Match': original.version })).status, 409);
  assert.equal((await request('/settings', { userName: 'Nome atualizado' })).status, 200);
  assert.deepEqual((await (await request('/settings')).json()).completedStudyDates, ['2026-10-01', '2026-10-02']);
  assert.equal((await fetch(base + '/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completedStudyDates: [] }) })).status, 428);
});

test('the real client queue reconciles with the real SQL routes after a failure and remote edit', async () => {
  const entries = new Map<string, string>();
  const storage = { get length() { return entries.size; }, key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); } };
  const store = new TaskSync({ storage, fetch: (input, init) => fetch(new URL(String(input), base), init) });
  await request('/tasks', task);
  await store.refresh();
  const original = store.getSnapshot().tasks[0];
  failWrites = true;
  await assert.rejects(store.saveTask(original, { ...original, completed: true }));
  assert.equal(store.getSnapshot().pending.length, 1);
  assert.equal(store.getSnapshot().tasks[0].completed, false);
  failWrites = false;
  const remote = await currentTask();
  assert.equal((await request('/tasks', { ...remote, notes: 'Nota de outro dispositivo' })).status, 200);
  const reloaded = new TaskSync({ storage, fetch: (input, init) => fetch(new URL(String(input), base), init) });
  await reloaded.retry();
  assert.equal(reloaded.getSnapshot().pending.length, 0);
  assert.equal((await currentTask()).completed, true);
  assert.equal((await currentTask()).notes, 'Nota de outro dispositivo');
});

test('deliberate reopening survives focus without losing other completion history', async () => {
  const date = localDate(new Date());
  await request('/settings', { completedStudyDates: ['2026-10-01', '2026-10-02'] });
  await sql`INSERT INTO reminder_occurrences(activity_id,occurrence_date,revision,next_at,confirmed_at)
    VALUES('study_daily_summary','2026-10-01','v1',now(),now()),('study_daily_summary','2026-10-02','v1',now(),now())`;
  const study = await (await request('/settings')).json();
  assert.equal((await request('/settings', { ...study, completedStudyDates: ['2026-10-02'], removedStudyDates: ['2026-10-01'] },
    'POST', { 'If-Match': study.version })).status, 200);
  assert.deepEqual((await (await request('/settings')).json()).completedStudyDates, ['2026-10-02']);
  await request('/tasks', { ...task, id: 'task_cafe', date, category: 'Dieta' });
  assert.equal((await request('/diet-state', { dietDate: date, completedMeals: { cafe_manha: true }, waterMl: 1500 },
    'POST', { 'If-Match': 'absent' })).status, 200);
  await sql`INSERT INTO reminder_occurrences(activity_id,occurrence_date,revision,next_at,confirmed_at)
    VALUES('diet_cafe_manha',${date},'v1',now(),now()),('task_cafe',${date},'v1',now(),now())`;
  const diet = await (await request('/diet-state')).json();
  assert.equal((await request('/diet-state', { ...diet, completedMeals: { cafe_manha: false }, reopenedMeals: ['cafe_manha'] },
    'POST', { 'If-Match': diet.version })).status, 200);
  assert.equal((await (await request('/diet-state')).json()).completedMeals.cafe_manha, false);
  const cafe = (await (await request('/tasks')).json()).find((row: any) => row.id === 'task_cafe');
  assert.equal(cafe.completed, false);
  assert.equal((await (await request('/diet-state')).json()).waterMl, 1500);
});

test('a completed old workout never fabricates completion after advancing the group', async () => {
  const date = localDate(new Date());
  assert.equal((await request('/workout-state', { activeGroupId: 'A', workoutDate: date, completedExercises: {}, weights: {} },
    'POST', { 'If-Match': 'absent' })).status, 200);
  await sql`INSERT INTO reminder_occurrences(activity_id,occurrence_date,revision,next_at,confirmed_at)
    VALUES('workout_group_summary',${date},'v1',now(),now())`;
  const before = await (await request('/workout-state')).json();
  assert.equal((await request('/workout-state', { ...before, activeGroupId: 'B', completedExercises: {} },
    'POST', { 'If-Match': before.version })).status, 200);
  const focused = await (await request('/workout-state')).json();
  assert.equal(focused.activeGroupId, 'B');
  assert.deepEqual(focused.completedExercises, {});
});

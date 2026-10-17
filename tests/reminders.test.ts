import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import { once } from 'node:events';
import { migrateReminders, runReminders, installReminders, recordCompletedOccurrences, syncSeededMealCompletions, syncSeededWorkoutCompletion, integratedConfirmations } from '../api/reminders.js';
import { WORKOUT_GROUPS } from '../src/data/workoutData.js';
import { installAccess } from '../api/access.js';
import { actionToken, verifyActionToken, validateConfig, firstDue, localDate } from '../api/reminder-policy.js';

let db: PGlite, sql: any, server: any, base: string;
const now = new Date();
const today = localDate(now);
const config = { mode: 'persistent' as const, leadMinutes: 15, intervalMinutes: 5, snoozeMinutes: 10 };
before(async () => {
  process.env.REMINDER_ACTION_SECRET = 'test-action-secret-only';
  process.env.APP_ACCESS_TOKEN = 'test-access-only';
  process.env.CRON_SECRET = 'test-cron-only';
  process.env.REMINDERS_ENABLED = 'false';
  db = new PGlite();
  sql = async (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, '');
    return (await db.query(text, values)).rows;
  };
  await db.exec(`CREATE TABLE tasks(id text PRIMARY KEY,title text,time text,date text,category text,completed boolean DEFAULT false,
    recurrence text DEFAULT 'none',recurrence_day text,recurrence_days text DEFAULT '[]',completed_dates text DEFAULT '[]');
    CREATE TABLE diet_state(id int PRIMARY KEY,diet_date text,completed_meals text,water_ml int);
    CREATE TABLE workout_state(id int PRIMARY KEY,active_group_id text,workout_date text,completed_exercises text,weights text);
    CREATE TABLE user_settings(id int PRIMARY KEY,completed_study_dates text);
    CREATE TABLE push_subscriptions(id serial PRIMARY KEY,endpoint text,p256dh text,auth text);`);
  await migrateReminders(sql);
  await migrateReminders(sql);
  const app = express(); app.use(express.json());
  const router = express.Router(); installAccess(router); installReminders(router, () => sql);
  app.use('/api', router);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await db?.close(); });
beforeEach(async () => {
  await db.exec('TRUNCATE tasks,reminder_configs,reminder_occurrences,reminder_deliveries,push_subscriptions,diet_state,workout_state,user_settings');
});
async function seed(mode = 'persistent', id = 'test') {
  await sql`INSERT INTO tasks(id,title,time,date,category) VALUES(${id},'Teste','00:00',${today},'Geral')`;
  await sql`INSERT INTO reminder_configs(activity_id,config,revision,updated_at) VALUES(${id},${JSON.stringify({ ...config, mode })}::jsonb,'v1',${today + 'T00:00:00-03:00'})`;
  await sql`INSERT INTO reminder_occurrences(activity_id,occurrence_date,revision,next_at) VALUES(${id},${today},'v1',now()-interval '1 minute')`;
  for (const endpoint of ['https://push.test/a','https://push.test/b']) await sql`INSERT INTO push_subscriptions(endpoint,p256dh,auth) VALUES(${endpoint},'key','auth')`;
}
const sender = (calls: string[]) => async (sub: any) => { calls.push(sub.endpoint); return {} as any; };
async function request(path: string, body?: any, auth = true) {
  return fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test-access-only' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

test('validates ranges, modes, time, and signed capability expiration/tampering', () => {
  assert.deepEqual(validateConfig(config), config);
  for (const invalid of [{ ...config, mode: 'alarm' }, { ...config, intervalMinutes: 0 }, { ...config, leadMinutes: -1 }, { ...config, time: '25:61' }, { ...config, snoozeMinutes: 1.2 }]) assert.throws(() => validateConfig(invalid));
  const token = actionToken('test', today, 'v1', Date.now() + 60000);
  assert.equal(verifyActionToken(token).id, 'test');
  assert.throws(() => verifyActionToken(token + 'x'));
  assert.throws(() => verifyActionToken(token + '.suffix'));
  assert.throws(() => verifyActionToken(actionToken('test', today, 'v1', 0)));
});
test('weekly and monthly occurrences, completion, and lead time across midnight', () => {
  const weekly = { id: 'x', time: '00:05', date: '', recurrence: 'semanal', recurrenceDays: ['0'], completedDates: [] };
  assert.equal(firstDue(weekly, '2026-10-18', config)?.toISOString(), '2026-10-18T02:50:00.000Z');
  assert.equal(firstDue(weekly, '2026-10-19', config), null);
  assert.equal(firstDue({ ...weekly, completedDates: ['2026-10-18'] }, '2026-10-18', config), null);
  assert.equal(firstDue({ ...weekly, recurrence: 'mensal', recurrenceDay: '31' }, '2026-11-30', config), null);
});
test('simple delivery goes to both devices exactly once across repeated scheduler runs', async () => {
  await seed('simple'); const calls: string[] = [];
  assert.equal((await runReminders(sql, sender(calls), now)).sent, 2);
  assert.equal((await runReminders(sql, sender(calls), now)).sent, 0);
  assert.equal(calls.length, 2);
});
test('concurrent workers cannot claim the same device delivery twice', async () => {
  await seed('simple'); const calls: string[] = [];
  await Promise.all([runReminders(sql, sender(calls), now), runReminders(sql, sender(calls), now)]);
  assert.equal(calls.length, 2);
});
test('failed device remains unsent; retry does not resend to successful device', async () => {
  await seed(); const calls: string[] = [];
  const result = await runReminders(sql, async (sub: any) => {
    if (sub.endpoint.endsWith('/b')) throw Object.assign(new Error('offline'), { statusCode: 503 });
    calls.push(sub.endpoint); return {} as any;
  }, now);
  assert.equal(result.sent, 1); assert.equal(result.failed, 1);
  const pending = await sql`SELECT * FROM reminder_deliveries WHERE sent_at IS NULL`;
  assert.equal(pending.length, 1); assert.equal(pending[0].attempts, 1);
  assert.equal((await runReminders(sql, sender(calls), now)).sent, 0);
  await sql`UPDATE reminder_deliveries SET retry_at=now()-interval '1 minute'`;
  assert.equal((await runReminders(sql, sender(calls), now)).sent, 1);
  assert.deepEqual(calls, ['https://push.test/a','https://push.test/b']);
});
test('expired subscription is removed without blocking healthy devices', async () => {
  await seed();
  await runReminders(sql, async (sub: any) => {
    if (sub.endpoint.endsWith('/b')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    return {} as any;
  }, now);
  assert.equal((await sql`SELECT * FROM push_subscriptions`).length, 1);
  assert.equal((await sql`SELECT * FROM reminder_deliveries WHERE retired=true`).length, 1);
});
test('persistent reminder advances once and confirms only its occurrence', async () => {
  await seed(); const calls: string[] = [];
  await runReminders(sql, sender(calls), now);
  assert.equal((await sql`SELECT round FROM reminder_occurrences WHERE activity_id='test'`)[0].round, 1);
  await sql`UPDATE reminder_occurrences SET next_at=now()-interval '1 minute'`;
  await runReminders(sql, sender(calls), now);
  assert.equal(calls.length, 4);
  const token = actionToken('test', today, 'v1', Date.now() + 60000);
  assert.equal((await request('/reminder-action', { token, action: 'confirm' }, false)).status, 200);
  assert.equal((await request('/reminder-action', { token, action: 'confirm' }, false)).status, 200);
  await runReminders(sql, sender(calls), now); assert.equal(calls.length, 4);
  assert.equal((await sql`SELECT completed FROM tasks`)[0].completed, true);
});
test('snooze is idempotent and invalidates the current round on every device', async () => {
  await seed('simple'); const calls: string[] = [];
  await runReminders(sql, sender(calls), now);
  const token = actionToken('test', today, 'v1', Date.now() + 60000);
  assert.equal((await request('/reminder-action', { token, action: 'snooze' }, false)).status, 200);
  const [a] = await sql`SELECT round,next_at FROM reminder_occurrences`;
  await request('/reminder-action', { token, action: 'snooze' }, false);
  const [b] = await sql`SELECT round,next_at FROM reminder_occurrences`;
  assert.deepEqual(a,b);
  assert.equal((await runReminders(sql, sender(calls), now)).sent, 0);
  await sql`UPDATE reminder_occurrences SET next_at=now()-interval '1 minute'`;
  assert.equal((await runReminders(sql, sender(calls), now)).sent, 2);
});
test('confirmation during a send stops the following device', async () => {
  await seed(); const calls: string[] = [];
  await runReminders(sql, async (sub: any) => {
    calls.push(sub.endpoint);
    await sql`UPDATE reminder_occurrences SET confirmed_at=now() WHERE activity_id='test'`;
    return {} as any;
  }, now);
  assert.equal(calls.length, 1);
});
test('deletion, disabled mode and changed revision stop sends and reject old actions', async () => {
  await seed(); const calls: string[] = [];
  await sql`DELETE FROM tasks WHERE id='test'`;
  await runReminders(sql, sender(calls), now); assert.equal(calls.length,0);
  const token = actionToken('test', today, 'v1', Date.now()+60000);
  assert.equal((await request('/reminder-action',{ token,action:'confirm' },false)).status,410);
  await sql`UPDATE reminder_configs SET revision='v2'`;
  assert.equal((await request('/reminder-action',{ token,action:'snooze' },false)).status,410);
});
test('recurring completion does not suppress the next day', async () => {
  await seed();
  await sql`UPDATE tasks SET recurrence='semanal',recurrence_days='["0","1","2","3","4","5","6"]',date='',completed_dates=${JSON.stringify([today])}`;
  await recordCompletedOccurrences(sql,today);
  const calls: string[] = []; await runReminders(sql,sender(calls),now);
  assert.equal(calls.length,0);
  assert.ok((await sql`SELECT * FROM reminder_occurrences WHERE occurrence_date<>${today}`).length >= 1);
});
test('integrated water completion is durable when the next day replaces its snapshot', async () => {
  await sql`INSERT INTO reminder_configs(activity_id,config,revision) VALUES('water_daily',${JSON.stringify({...config,time:'12:00'})}::jsonb,'v1')`;
  await sql`INSERT INTO diet_state VALUES(1,${today},'{}',3000)`;
  await recordCompletedOccurrences(sql,today);
  assert.ok((await sql`SELECT confirmed_at FROM reminder_occurrences WHERE activity_id='water_daily'`)[0].confirmed_at);
  await sql`UPDATE diet_state SET diet_date='2099-01-01',water_ml=0`;
  const calls: string[]=[]; await runReminders(sql,sender(calls),now); assert.equal(calls.length,0);
});
test('APIs require access, cron requires independent secret, and session is HttpOnly', async () => {
  assert.equal((await request('/reminders',undefined,false)).status,401);
  assert.equal((await request('/reminders')).status,200);
  assert.equal((await request('/send-reminders')).status,401);
  assert.equal((await request('/reminder-action',{token:'bad',action:'confirm'},false)).status,401);
  const login = await request('/session',{token:'test-access-only'},false);
  assert.equal(login.status,200); assert.match(login.headers.get('set-cookie')!,/HttpOnly/);
  const session = await fetch(base+'/reminders',{headers:{Cookie:login.headers.get('set-cookie')!.split(';')[0]}});
  assert.equal(session.status,200);
});

test('seeded diet task confirmation stays synchronized with integrated meal progress', async () => {
  await seed('persistent','task_cafe');
  await sql`UPDATE tasks SET recurrence='semanal',recurrence_days='["0","1","2","3","4","5","6"]',date=''`;
  await sql`INSERT INTO diet_state VALUES(1,${today},'{"cafe_manha":true}',0)`;
  await syncSeededMealCompletions(sql,today,{cafe_manha:true});
  await recordCompletedOccurrences(sql,today);
  assert.ok(JSON.parse((await sql`SELECT completed_dates FROM tasks`)[0].completed_dates).includes(today));
  const calls: string[]=[]; await runReminders(sql,sender(calls),now); assert.equal(calls.length,0);
});

test('disabling mode prevents delivery, while no subscriptions never marks success', async () => {
  await seed(); const calls: string[]=[];
  await sql`UPDATE reminder_configs SET config=jsonb_set(config,'{mode}','"none"'::jsonb)`;
  await runReminders(sql,sender(calls),now); assert.equal(calls.length,0);
  await sql`UPDATE reminder_configs SET config=jsonb_set(config,'{mode}','"persistent"'::jsonb)`;
  await sql`DELETE FROM push_subscriptions`;
  await runReminders(sql,sender(calls),now);
  assert.equal((await sql`SELECT round FROM reminder_occurrences`)[0].round,0);
});

test('snooze receipt cannot be replayed after another valid snooze', async () => {
  await seed();
  const a = actionToken('test',today,'v1',Date.now()+60000);
  const b = actionToken('test',today,'v1',Date.now()+120000);
  for (const token of [a,b,a]) assert.equal((await request('/reminder-action',{token,action:'snooze'},false)).status,200);
  assert.equal((await sql`SELECT round FROM reminder_occurrences`)[0].round,2);
});

test('workout progress stops seeded task alerts and confirmation remains date-scoped', async () => {
  await seed('persistent','task_treino');
  await sql`UPDATE tasks SET recurrence='semanal',recurrence_days='["0","1","2","3","4","5","6"]',date=''`;
  const group=WORKOUT_GROUPS[0];
  await syncSeededWorkoutCompletion(sql,today,group.id,Object.fromEntries(group.exercises.map(e=>[e.id,true])));
  await recordCompletedOccurrences(sql,today);
  assert.equal((await integratedConfirmations(sql,today)).workout,true);
  assert.equal((await integratedConfirmations(sql,'2099-01-01')).workout,false);
});

test('cancelling an unavailable virtual activity never fabricates workout completion', async () => {
  await seed();
  await sql`UPDATE tasks SET category='Academia'`;
  await sql`INSERT INTO reminder_configs(activity_id,config,revision,updated_at) VALUES('workout_group_summary',${JSON.stringify({...config,time:'00:00'})}::jsonb,'v1',now()-interval '2 days')`;
  await sql`INSERT INTO reminder_occurrences(activity_id,occurrence_date,revision,next_at) VALUES('workout_group_summary',${today},'v1',now()-interval '1 minute')`;
  await runReminders(sql,sender([]),now);
  const [o]=await sql`SELECT confirmed_at,cancelled_at FROM reminder_occurrences WHERE activity_id='workout_group_summary'`;
  assert.equal(o.confirmed_at,null); assert.ok(o.cancelled_at);
  assert.equal((await integratedConfirmations(sql,today)).workout,false);
});

test('production fails closed when application access secret is missing', async () => {
  const previous=process.env.NODE_ENV;
  process.env.NODE_ENV='production'; delete process.env.APP_ACCESS_TOKEN;
  try { assert.equal((await request('/reminders',undefined,false)).status,503); }
  finally { process.env.APP_ACCESS_TOKEN='test-access-only'; if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=previous; }
});

test('scheduler uses its independent bearer secret and refuses a concurrent lease', async () => {
  process.env.VAPID_PRIVATE_KEY='test-only'; process.env.VITE_VAPID_PUBLIC_KEY='test-only';
  try {
    const disabled=await fetch(base+'/send-reminders',{headers:{Authorization:'Bearer test-cron-only'}});
    assert.deepEqual(await disabled.json(),{enabled:false});
    process.env.REMINDERS_ENABLED='true';
    await sql`UPDATE reminder_scheduler SET lease_until=now()+interval '1 minute' WHERE id=1`;
    const busy=await fetch(base+'/send-reminders',{headers:{Authorization:'Bearer test-cron-only'}});
    assert.equal(busy.status,202); assert.deepEqual(await busy.json(),{busy:true});
  } finally { process.env.REMINDERS_ENABLED='false'; delete process.env.VAPID_PRIVATE_KEY; delete process.env.VITE_VAPID_PUBLIC_KEY; }
});

test('durable generation cursor recovers missed recurrence dates after a long outage', async () => {
  await seed();
  await sql`UPDATE tasks SET recurrence='semanal',recurrence_days='["0","1","2","3","4","5","6"]',date=''`;
  await sql`UPDATE reminder_configs SET updated_at=now()-interval '5 days'`;
  await runReminders(sql,sender([]),now);
  const historical=await sql`SELECT * FROM reminder_occurrences WHERE occurrence_date<${today}`;
  assert.equal(historical.length,5);
  const [c]=await sql`SELECT generated_through FROM reminder_configs`;
  assert.ok(c.generated_through>today);
  await runReminders(sql,sender([]),now);
  assert.equal((await sql`SELECT * FROM reminder_occurrences WHERE occurrence_date<${today}`).length,5);
});

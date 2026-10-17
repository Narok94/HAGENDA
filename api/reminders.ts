import { randomUUID, createHash } from 'node:crypto';
import type { Router } from 'express';
import webpush from 'web-push';
import { MEAL_PLAN } from '../src/data/dietData.js';
import { WORKOUT_GROUPS } from '../src/data/workoutData.js';
import { isTaskOnDate, isTaskCompletedOnDate } from '../src/utils/taskDates.js';
import { actionToken, verifyActionToken, secureEqual, validateConfig, firstDue, localDate, offsetDate } from './reminder-policy.js';

const parse = (value: any, fallback: any) => typeof value === 'string' ? JSON.parse(value) : value ?? fallback;
const linkedMeals: Record<string, string> = { task_cafe: 'cafe_manha', task_lanche_pre: 'lanche_manha', task_almoco: 'almoco', task_lanche: 'lanche_tarde', task_jantar: 'jantar' };
export async function migrateReminders(sql: any) {
  await sql`CREATE TABLE IF NOT EXISTS reminder_configs (
    activity_id TEXT PRIMARY KEY, config JSONB NOT NULL, revision TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE reminder_configs ADD COLUMN IF NOT EXISTS generated_through TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS reminder_occurrences (
    activity_id TEXT NOT NULL, occurrence_date TEXT NOT NULL, revision TEXT NOT NULL,
    next_at TIMESTAMPTZ NOT NULL, round INTEGER NOT NULL DEFAULT 0,
    confirmed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ, snooze_token TEXT,
    PRIMARY KEY(activity_id, occurrence_date))`;
  await sql`CREATE INDEX IF NOT EXISTS reminder_occurrences_due ON reminder_occurrences(next_at) WHERE confirmed_at IS NULL`;
  await sql`ALTER TABLE reminder_occurrences ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`;
  await sql`CREATE TABLE IF NOT EXISTS reminder_deliveries (
    activity_id TEXT NOT NULL, occurrence_date TEXT NOT NULL, revision TEXT NOT NULL,
    round INTEGER NOT NULL, endpoint_hash TEXT NOT NULL,
    sent_at TIMESTAMPTZ, retired BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INTEGER NOT NULL DEFAULT 0, retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_until TIMESTAMPTZ, lease_token TEXT, last_error TEXT,
    PRIMARY KEY(activity_id, occurrence_date, revision, round, endpoint_hash))`;
  await sql`CREATE TABLE IF NOT EXISTS reminder_scheduler (
    id INTEGER PRIMARY KEY, lease_until TIMESTAMPTZ, lease_token TEXT,
    last_started_at TIMESTAMPTZ, last_finished_at TIMESTAMPTZ, last_error TEXT,
    sent_count INTEGER NOT NULL DEFAULT 0)`;
  await sql`CREATE TABLE IF NOT EXISTS reminder_actions (action_id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`INSERT INTO reminder_scheduler(id) VALUES(1) ON CONFLICT DO NOTHING`;
}

async function activities(sql: any, date: string) {
  const rows = await sql`SELECT * FROM tasks`;
  const tasks = rows.map((r: any) => ({ ...r, recurrenceDay: r.recurrence_day,
    recurrenceDays: parse(r.recurrence_days, []), completedDates: parse(r.completed_dates, []) }));
  const [diet] = await sql`SELECT * FROM diet_state WHERE id=1`;
  const [workout] = await sql`SELECT * FROM workout_state WHERE id=1`;
  const [settings] = await sql`SELECT * FROM user_settings WHERE id=1`;
  const todayTasks = tasks.filter((t: any) => isTaskOnDate(t, date));
  const meals = parse(diet?.completed_meals, {});
  const group = WORKOUT_GROUPS.find(g => g.id === workout?.active_group_id) || WORKOUT_GROUPS[0];
  const exercises = parse(workout?.completed_exercises, {});
  const virtual: any[] = MEAL_PLAN.filter(m => !todayTasks.some((t: any) =>
    t.title.toLowerCase().trim() === m.title.toLowerCase().trim() || (t.category?.toLowerCase() === 'dieta' && t.time === m.time)
  )).map(m => ({ id: `diet_${m.id}`, title: m.title, time: m.time, date,
    completed: diet?.diet_date === date && !!meals[m.id] }));
  if (!todayTasks.some((t: any) => t.category?.toLowerCase() === 'academia' || /treino|cardio/i.test(t.title))) {
    virtual.push({ id: 'workout_group_summary', title: 'Academia', time: '', date,
      completed: workout?.workout_date === date && group.exercises.every(ex => exercises[ex.id]) });
  }
  if (!todayTasks.some((t: any) => t.category?.toLowerCase() === 'estudo')) {
    virtual.push({ id: 'study_daily_summary', title: 'Estudo', time: '', date,
      completed: parse(settings?.completed_study_dates, []).includes(date) });
  }
  virtual.push({ id: 'water_daily', title: 'Água · meta diária de 3 L', time: '', date,
    completed: diet?.diet_date === date && Number(diet?.water_ml) >= 3000 });
  return [...tasks, ...virtual];
}

// Record integrated completions before daily diet/workout snapshots are replaced.
export async function recordCompletedOccurrences(sql: any, date: string) {
  if (!sql || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const list = await activities(sql, date);
  for (const task of list.filter((t: any) => isTaskOnDate(t, date) && isTaskCompletedOnDate(t, date))) {
    await sql`INSERT INTO reminder_occurrences(activity_id,occurrence_date,revision,next_at,confirmed_at)
      SELECT activity_id,${date},revision,now(),now() FROM reminder_configs WHERE activity_id=${task.id}
      ON CONFLICT(activity_id,occurrence_date) DO UPDATE SET confirmed_at=COALESCE(reminder_occurrences.confirmed_at,now())`;
  }
}

// The original seeded meal tasks represent the same meals as the Diet tab.
export async function syncSeededMealCompletions(sql: any, date: string, meals: Record<string, boolean>) {
  if (!sql) return;
  for (const [id, meal] of Object.entries(linkedMeals)) {
    if (meals[meal] !== true) continue;
    await sql`UPDATE tasks SET completed=CASE WHEN COALESCE(recurrence,'none')='none' AND date=${date} THEN true ELSE completed END,
      completed_dates=(SELECT jsonb_agg(DISTINCT d)::text FROM jsonb_array_elements_text(
        COALESCE(NULLIF(completed_dates,''),'[]')::jsonb || jsonb_build_array(${date}::text)) AS x(d)) WHERE id=${id}`;
  }
}

export async function syncSeededWorkoutCompletion(sql: any, date: string, groupId: string, exercises: Record<string, boolean>) {
  const group = WORKOUT_GROUPS.find(g => g.id === groupId);
  if (!sql || !group || !group.exercises.every(e => exercises[e.id])) return;
  await sql`UPDATE tasks SET completed_dates=(SELECT jsonb_agg(DISTINCT d)::text FROM jsonb_array_elements_text(
    COALESCE(NULLIF(completed_dates,''),'[]')::jsonb || jsonb_build_array(${date}::text)) AS x(d)),
    completed=CASE WHEN COALESCE(recurrence,'none')='none' AND date=${date} THEN true ELSE completed END WHERE id='task_treino'`;
}

export async function integratedConfirmations(sql: any, date: string) {
  const rows = await sql`SELECT activity_id FROM reminder_occurrences WHERE occurrence_date=${date} AND confirmed_at IS NOT NULL`;
  const ids = new Set(rows.map((r: any) => r.activity_id));
  const meals: Record<string, boolean> = {};
  for (const id of ids as Set<string>) {
    if (id.startsWith('diet_')) meals[id.slice(5)] = true;
    if (linkedMeals[id]) meals[linkedMeals[id]] = true;
  }
  return { meals, water: ids.has('water_daily'), workout: ids.has('workout_group_summary') || ids.has('task_treino') };
}

export function installReminders(router: Router, getDb: () => any) {
  router.get('/reminders', async (_req, res) => {
    try {
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Alertas exigem Neon configurado' });
      const configs = await sql`SELECT activity_id, config FROM reminder_configs`;
      const [scheduler] = await sql`SELECT last_started_at, last_finished_at, last_error, sent_count FROM reminder_scheduler WHERE id=1`;
      res.json({ configs: Object.fromEntries(configs.map((r: any) => [r.activity_id, r.config])), scheduler });
    } catch { res.status(503).json({ error: 'Não foi possível ler alertas' }); }
  });
  router.put('/reminders/:id', async (req, res) => {
    let config;
    try { config = validateConfig(req.body); } catch (e: any) { return res.status(400).json({ error: e.message }); }
    try {
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Alertas exigem Neon configurado' });
      const id = String(req.params.id);
      const known = await activities(sql, localDate(new Date()));
      // Hidden integrated activities may have an existing config, but cannot create orphan configs.
      if (!known.some((t: any) => t.id === id)) return res.status(404).json({ error: 'Atividade indisponível' });
      const task = known.find((t: any) => t.id === id);
      if (config.mode !== 'none' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(config.time || task.time)) return res.status(400).json({ error: 'Defina um horário para o alerta' });
      await sql`INSERT INTO reminder_configs(activity_id, config, revision) VALUES(${id}, ${JSON.stringify(config)}::jsonb, ${randomUUID()})
        ON CONFLICT(activity_id) DO UPDATE SET config=EXCLUDED.config, revision=EXCLUDED.revision, updated_at=now(), generated_through=NULL`;
      res.json({ success: true, config });
    } catch { res.status(503).json({ error: 'Não foi possível salvar o alerta' }); }
  });
  router.post('/reminder-action', async (req, res) => {
    let data;
    try { data = verifyActionToken(req.body.token); } catch { return res.status(401).json({ error: 'Ação inválida ou expirada' }); }
    if (!['confirm', 'snooze'].includes(req.body.action)) return res.status(400).json({ error: 'Ação inválida' });
    try {
      const sql = getDb();
      if (!sql) return res.sendStatus(503);
      const { id, date, revision } = data;
      const [config] = await sql`SELECT * FROM reminder_configs WHERE activity_id=${id} AND revision=${revision}`;
      const task = (await activities(sql, date)).find((t: any) => t.id === id);
      if (!config || !task || config.config.mode === 'none' || !isTaskOnDate(task, date)) return res.sendStatus(410);
      if (req.body.action === 'snooze') {
        const receipt = createHash('sha256').update(req.body.token).digest('hex');
        await sql`WITH accepted AS (
          INSERT INTO reminder_actions(action_id) VALUES(${receipt}) ON CONFLICT DO NOTHING RETURNING action_id
        ) UPDATE reminder_occurrences SET next_at=now() + ${config.config.snoozeMinutes} * interval '1 minute',
          snooze_token=${req.body.token}, round=round+1 WHERE activity_id=${id} AND occurrence_date=${date}
          AND revision=${revision} AND confirmed_at IS NULL AND cancelled_at IS NULL AND EXISTS(SELECT 1 FROM accepted)`;
      } else {
        // Authoritative occurrence completion stops every device even if a source UI subsequently writes stale state.
        await sql`UPDATE reminder_occurrences SET confirmed_at=COALESCE(confirmed_at, now())
          WHERE activity_id=${id} AND occurrence_date=${date} AND revision=${revision}`;
        await sql`UPDATE tasks SET completed=CASE WHEN COALESCE(recurrence,'none')='none' THEN true ELSE completed END,
          completed_dates=CASE WHEN COALESCE(recurrence,'none') <> 'none' THEN
            (SELECT jsonb_agg(DISTINCT d)::text FROM jsonb_array_elements_text(COALESCE(NULLIF(completed_dates,''),'[]')::jsonb || jsonb_build_array(${date}::text)) AS x(d))
            ELSE completed_dates END WHERE id=${id}`;
        // Integrated state is date-scoped; old notifications must never reset today's progress.
        if (date === localDate(new Date())) {
          if (id.startsWith('diet_') || linkedMeals[id]) {
            const meal = linkedMeals[id] || id.slice(5);
            await sql`INSERT INTO diet_state(id,diet_date,completed_meals,water_ml) VALUES(1,${date},${JSON.stringify({ [meal]: true })},0)
              ON CONFLICT(id) DO UPDATE SET diet_date=${date}, completed_meals=(CASE WHEN diet_state.diet_date=${date}
                THEN COALESCE(NULLIF(diet_state.completed_meals,''),'{}')::jsonb ELSE '{}'::jsonb END || ${JSON.stringify({ [meal]: true })}::jsonb)::text,
                water_ml=CASE WHEN diet_state.diet_date=${date} THEN diet_state.water_ml ELSE 0 END`;
          } else if (id === 'water_daily') {
            await sql`INSERT INTO diet_state(id,diet_date,completed_meals,water_ml) VALUES(1,${date},'{}',3000)
              ON CONFLICT(id) DO UPDATE SET diet_date=${date}, water_ml=GREATEST(CASE WHEN diet_state.diet_date=${date} THEN diet_state.water_ml ELSE 0 END,3000),
                completed_meals=CASE WHEN diet_state.diet_date=${date} THEN diet_state.completed_meals ELSE '{}' END`;
          } else if (id === 'study_daily_summary') {
            await sql`INSERT INTO user_settings(id,completed_study_dates) VALUES(1,${JSON.stringify([date])})
              ON CONFLICT(id) DO UPDATE SET completed_study_dates=(SELECT jsonb_agg(DISTINCT d)::text FROM
                jsonb_array_elements_text(COALESCE(NULLIF(user_settings.completed_study_dates,''),'[]')::jsonb || jsonb_build_array(${date}::text)) AS x(d))`;
          } else if (id === 'workout_group_summary' || id === 'task_treino') {
            const [state] = await sql`SELECT active_group_id FROM workout_state WHERE id=1`;
            const group = WORKOUT_GROUPS.find(g => g.id === state?.active_group_id) || WORKOUT_GROUPS[0];
            const completed = JSON.stringify(Object.fromEntries(group.exercises.map(e => [e.id, true])));
            await sql`INSERT INTO workout_state(id,active_group_id,workout_date,completed_exercises,weights) VALUES(1,${group.id},${date},${completed},'{}')
              ON CONFLICT(id) DO UPDATE SET workout_date=${date}, completed_exercises=${completed}`;
          }
        }
      }
      res.json({ success: true });
    } catch { res.status(503).json({ error: 'Não foi possível executar a ação; tente novamente' }); }
  });
  router.get('/send-reminders', async (req, res) => {
    if (!process.env.CRON_SECRET || !secureEqual(req.headers.authorization || '', `Bearer ${process.env.CRON_SECRET}`)) return res.sendStatus(401);
    const sql = getDb();
    if (!sql || !process.env.VAPID_PRIVATE_KEY || !process.env.VITE_VAPID_PUBLIC_KEY || !process.env.REMINDER_ACTION_SECRET) return res.status(503).json({ error: 'Configure Neon, VAPID e segredo de ações' });
    if (process.env.REMINDERS_ENABLED !== 'true') return res.json({ enabled: false });
    const lease = randomUUID();
    let locked = false;
    try {
      const acquired = await sql`UPDATE reminder_scheduler SET lease_token=${lease}, lease_until=now()+interval '5 minutes', last_started_at=now(), last_error=NULL
        WHERE id=1 AND (lease_until IS NULL OR lease_until < now()) RETURNING id`;
      if (!acquired.length) return res.status(202).json({ busy: true });
      locked = true;
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@hagenda.app', process.env.VITE_VAPID_PUBLIC_KEY.trim(), process.env.VAPID_PRIVATE_KEY.trim());
      const result = await runReminders(sql);
      await sql`UPDATE reminder_scheduler SET last_finished_at=now(), sent_count=${result.sent} WHERE id=1 AND lease_token=${lease}`;
      res.json(result);
    } catch (e) {
      if (locked) await sql`UPDATE reminder_scheduler SET last_error='Falha no processamento; consultar logs do servidor' WHERE id=1 AND lease_token=${lease}`;
      console.error('Reminder scheduler failed', e instanceof Error ? e.name : 'unknown');
      res.status(503).json({ error: 'Falha no agendamento' });
    } finally {
      if (locked) await sql`UPDATE reminder_scheduler SET lease_until=NULL WHERE id=1 AND lease_token=${lease}`;
    }
  });
}

export async function runReminders(sql: any, send = webpush.sendNotification.bind(webpush), now = new Date()) {
  const started = Date.now();
  const today = localDate(now);
  const configs = await sql`SELECT * FROM reminder_configs WHERE config->>'mode' <> 'none'`;
  // Durable generation cursor recovers every date since opt-in, even after a long scheduler outage.
  const cache = new Map<string, any[]>();
  for (const c of configs) {
    const startDate = c.generated_through ? offsetDate(c.generated_through, 1) : localDate(new Date(c.updated_at));
    const dates = new Set<string>([today, offsetDate(today, 1)]);
    for (let date=startDate; date<=offsetDate(today,1); date=offsetDate(date,1)) {
      dates.add(date);
      // Work through large backlogs in bounded batches; the cursor resumes on the next run.
      if (dates.size >= 32) break;
    }
    for (const date of [...dates].sort()) {
      if (Date.now()-started > 30000) break;
      if (!cache.has(date)) cache.set(date, await activities(sql,date));
      const list = cache.get(date)!;
      const task = list.find((t: any) => t.id === c.activity_id);
      const due = task ? firstDue(task, date, c.config) : null;
      // Never backfill past dates on opt-in; today's pending activity may start immediately.
      if (due && date >= localDate(new Date(c.updated_at))) {
        const effectiveDue = new Date(Math.max(due.getTime(), new Date(c.updated_at).getTime()));
        await sql`INSERT INTO reminder_occurrences(activity_id,occurrence_date,revision,next_at)
          VALUES(${c.activity_id},${date},${c.revision},${effectiveDue.toISOString()}) ON CONFLICT(activity_id,occurrence_date)
          DO UPDATE SET revision=EXCLUDED.revision,next_at=EXCLUDED.next_at,round=0,snooze_token=NULL,cancelled_at=NULL
          WHERE reminder_occurrences.revision <> EXCLUDED.revision AND reminder_occurrences.confirmed_at IS NULL`;
      }
      // Do not jump the cursor over unprocessed backlog when refreshing today's dates.
      if (date >= startDate && date === (c.generated_through ? offsetDate(c.generated_through,1) : startDate)) {
        await sql`UPDATE reminder_configs SET generated_through=${date} WHERE activity_id=${c.activity_id} AND revision=${c.revision}`;
        c.generated_through=date;
      }
    }
  }
  const due = await sql`SELECT o.*, c.config FROM reminder_occurrences o JOIN reminder_configs c ON c.activity_id=o.activity_id AND c.revision=o.revision
    WHERE o.confirmed_at IS NULL AND o.cancelled_at IS NULL AND o.next_at <= ${now.toISOString()} AND c.config->>'mode' <> 'none' ORDER BY o.next_at LIMIT 100`;
  const subscriptions = await sql`SELECT DISTINCT ON(endpoint) endpoint,p256dh,auth FROM push_subscriptions ORDER BY endpoint,id DESC`;
  let sent = 0, failed = 0, attempted = 0;
  for (const o of due) {
    if (Date.now() - started > 40000 || attempted >= 50) break;
    const id = o.activity_id, date = o.occurrence_date;
    const task = (await activities(sql, date)).find((t: any) => t.id === id);
    if (!task || !isTaskOnDate(task, date)) {
      await sql`UPDATE reminder_occurrences SET cancelled_at=now() WHERE activity_id=${id} AND occurrence_date=${date}`;
      continue;
    }
    if (isTaskCompletedOnDate(task, date)) {
      await sql`UPDATE reminder_occurrences SET confirmed_at=now() WHERE activity_id=${id} AND occurrence_date=${date}`;
      continue;
    }
    let settled = subscriptions.length > 0;
    for (const sub of subscriptions) {
      if (Date.now() - started > 40000 || attempted >= 50) { settled = false; break; }
      const hash = createHash('sha256').update(sub.endpoint).digest('hex');
      const token = randomUUID();
      const claim = await sql`INSERT INTO reminder_deliveries(activity_id,occurrence_date,revision,round,endpoint_hash,lease_token,lease_until,attempts)
        VALUES(${id},${date},${o.revision},${o.round},${hash},${token},now()+interval '2 minutes',1)
        ON CONFLICT(activity_id,occurrence_date,revision,round,endpoint_hash) DO UPDATE
        SET lease_token=${token},lease_until=now()+interval '2 minutes',attempts=reminder_deliveries.attempts+1
        WHERE reminder_deliveries.sent_at IS NULL AND NOT reminder_deliveries.retired
          AND reminder_deliveries.retry_at <= now() AND (reminder_deliveries.lease_until IS NULL OR reminder_deliveries.lease_until < now()) RETURNING attempts`;
      if (!claim.length) {
        const [delivery] = await sql`SELECT sent_at,retired FROM reminder_deliveries WHERE activity_id=${id} AND occurrence_date=${date} AND revision=${o.revision} AND round=${o.round} AND endpoint_hash=${hash}`;
        if (!delivery?.sent_at && !delivery?.retired) settled = false;
        continue;
      }
      // Recheck immediately before every device send, including confirmation, snooze, deletion and edits.
      const [current] = await sql`SELECT o.round FROM reminder_occurrences o JOIN reminder_configs c ON c.activity_id=o.activity_id AND c.revision=o.revision
        WHERE o.activity_id=${id} AND o.occurrence_date=${date} AND o.revision=${o.revision} AND o.round=${o.round}
          AND o.confirmed_at IS NULL AND o.cancelled_at IS NULL AND o.next_at<=now() AND c.config->>'mode'<>'none'`;
      const freshTask = (await activities(sql, date)).find((t: any) => t.id === id);
      if (!current || !freshTask || !isTaskOnDate(freshTask,date) || isTaskCompletedOnDate(freshTask,date)) { settled = false; break; }
      attempted++;
      const capability = actionToken(id, date, o.revision, now.getTime() + 7 * 86400000);
      try {
        await send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({
          title: `Lembrete: ${task.title}`, body: `${date.split('-').reverse().join('/')} · ${o.config.time || task.time}. Confirme ou adie o lembrete.`,
          tag: `reminder-${id}-${date}`, data: { id, date, token: capability, url: `/?activity=${encodeURIComponent(id)}&date=${date}` }
        }), { TTL: 60, timeout: 10000, topic: createHash('sha256').update(`${id}:${date}`).digest('base64url').slice(0,32) });
        await sql`UPDATE reminder_deliveries SET sent_at=now(),lease_until=NULL,last_error=NULL WHERE lease_token=${token}`;
        sent++;
      } catch (err: any) {
        const gone = err?.statusCode === 404 || err?.statusCode === 410;
        if (gone) await sql`DELETE FROM push_subscriptions WHERE endpoint=${sub.endpoint}`;
        const retry = Math.min(60, 2 ** Math.min(claim[0].attempts, 6));
        await sql`UPDATE reminder_deliveries SET retired=${gone},lease_until=NULL,last_error=${String(err?.statusCode || 'network')},
          retry_at=now()+${retry} * interval '1 minute' WHERE lease_token=${token}`;
        if (!gone) { settled = false; failed++; }
      }
    }
    if (settled) {
      // Simple alerts finish once; persistent alerts advance from actual processing time, never burst catch-up.
      await sql`UPDATE reminder_occurrences SET next_at=CASE WHEN ${o.config.mode}='simple' THEN 'infinity'::timestamptz
        ELSE now()+${o.config.intervalMinutes} * interval '1 minute' END, round=round+1
        WHERE activity_id=${id} AND occurrence_date=${date} AND revision=${o.revision} AND round=${o.round} AND confirmed_at IS NULL`;
    }
  }
  return { sent, failed, attempted };
}

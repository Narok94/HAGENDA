import type { Router } from "express";
import { recordCompletedOccurrences } from "./_reminders.js";
import { localDate } from "./_reminder-policy.js";
import { versionedWrite, expectedVersion } from './_versioned-write.js';

export function taskFromRow(row: any) {
  return {
    id: row.id, version: row.version, title: row.title, time: row.time, date: row.date,
    category: row.category, icon: row.icon, completed: !!row.completed, priority: !!row.priority,
    notes: row.notes || '', recurrence: row.recurrence || 'none', recurrenceDay: row.recurrence_day || '',
    recurrenceDays: row.recurrence_days ? JSON.parse(row.recurrence_days) : [],
    completedDates: row.completed_dates ? JSON.parse(row.completed_dates) : [], reminderSent: !!row.reminder_sent
  };
}

const DEFAULT_WEEKLY_TASKS = [
  {
    id: "task_cardio",
    title: "Cardio em jejum (moderado)",
    time: "07:30",
    date: "",
    category: "Saúde",
    icon: "Flame",
    completed: false,
    priority: false,
    notes: "Cardio moderado em jejum (Ter, Qui, Sáb)",
    recurrence: "semanal",
    recurrenceDay: "",
    recurrenceDays: ["2", "4", "6"],
    completedDates: []
  },
  {
    id: "task_cafe",
    title: "Café da manhã",
    time: "08:30",
    date: "",
    category: "Dieta",
    icon: "Coffee",
    completed: false,
    priority: false,
    notes: "Refeição matinal da dieta",
    recurrence: "semanal",
    recurrenceDay: "",
    recurrenceDays: ["0", "1", "2", "3", "4", "5", "6"],
    completedDates: []
  },
  {
    id: "task_lanche_pre",
    title: "Lanche (pré-treino)",
    time: "11:00",
    date: "",
    category: "Dieta",
    icon: "Apple",
    completed: false,
    priority: false,
    notes: "Lanche reforçado pré-treino",
    recurrence: "semanal",
    recurrenceDay: "",
    recurrenceDays: ["0", "1", "2", "3", "4", "5", "6"],
    completedDates: []
  },
  {
    id: "task_treino",
    title: "Treino de força",
    time: "11:30",
    date: "",
    category: "Academia",
    icon: "Dumbbell",
    completed: false,
    priority: false,
    notes: "Sessão diária de musculação / treino de força (Seg a Sex)",
    recurrence: "semanal",
    recurrenceDay: "",
    recurrenceDays: ["1", "2", "3", "4", "5"],
    completedDates: []
  },
  {
    id: "task_almoco",
    title: "Almoço (pós-treino)",
    time: "13:30",
    date: "",
    category: "Dieta",
    icon: "Apple",
    completed: false,
    priority: false,
    notes: "Refeição de almoço pós-treino",
    recurrence: "semanal",
    recurrenceDay: "",
    recurrenceDays: ["0", "1", "2", "3", "4", "5", "6"],
    completedDates: []
  },
  {
    id: "task_lanche",
    title: "Lanche",
    time: "17:30",
    date: "",
    category: "Dieta",
    icon: "Apple",
    completed: false,
    priority: false,
    notes: "Lanche da tarde",
    recurrence: "semanal",
    recurrenceDay: "",
    recurrenceDays: ["0", "1", "2", "3", "4", "5", "6"],
    completedDates: []
  },
  {
    id: "task_jantar",
    title: "Jantar",
    time: "20:30",
    date: "",
    category: "Dieta",
    icon: "Apple",
    completed: false,
    priority: false,
    notes: "Refeição noturna",
    recurrence: "semanal",
    recurrenceDay: "",
    recurrenceDays: ["0", "1", "2", "3", "4", "5", "6"],
    completedDates: []
  },
  {
    id: "task_estudo",
    title: "Estudo",
    time: "Horário flexível",
    date: "",
    category: "Estudo",
    icon: "BookOpen",
    completed: false,
    priority: false,
    notes: "Sessão diária de estudos",
    recurrence: "semanal",
    recurrenceDay: "",
    recurrenceDays: ["0", "1", "2", "3", "4", "5", "6"],
    completedDates: []
  }
];

export async function migrateTaskPersistence(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(255) PRIMARY KEY,
      title TEXT NOT NULL,
      time TEXT NOT NULL,
      date VARCHAR(10) NOT NULL,
      category TEXT NOT NULL,
      icon TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      priority BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      recurrence VARCHAR(50) DEFAULT 'none',
      recurrence_day VARCHAR(10),
      recurrence_days TEXT, -- Armazenado como string JSON array
      completed_dates TEXT, -- Armazenado como string JSON array
      reminder_sent BOOLEAN DEFAULT FALSE
    )
  `;
  // Widen existing installations without rewriting or truncating stored values.
  await sql`ALTER TABLE tasks ALTER COLUMN time TYPE TEXT`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE`;
}

export function installPersistenceGuard(apiRouter: Router, getDb: () => any) {
  apiRouter.use(['/tasks', '/settings', '/workout-state', '/diet-state', '/subscribe'], (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !getDb()) {
      return res.status(503).json({ error: 'Persistência indisponível: configure a conexão com o Neon' });
    }
    next();
  });
}

export function installTaskPersistence(apiRouter: Router, getDb: () => any) {
  // Task reads and writes must use durable storage.
  apiRouter.get("/tasks", async (req, res) => {
    try {
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      const rows = await sql`SELECT *,xmin::text AS version FROM tasks`;
      res.setHeader('Cache-Control', 'no-store');
      return res.json(rows.map(taskFromRow));
    } catch (error: any) {
      console.error("Erro ao buscar tarefas:", error);
      return res.status(503).json({ error: 'Não foi possível carregar as tarefas do banco' });
    }
  });

  apiRouter.post("/tasks", async (req, res) => {
    try {
      const task = req.body;
      if (!task.id || !task.title || typeof task.time !== 'string' ||
          !['none', 'semanal', 'mensal'].includes(task.recurrence || 'none')) {
        return res.status(400).json({ error: 'Tarefa inválida' });
      }
      if (task.version !== undefined && typeof task.version !== 'string') {
        return res.status(400).json({ error: 'Versão inválida' });
      }
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      const fields = {
        title: task.title, time: task.time, date: task.date, category: task.category, icon: task.icon,
        completed: !!task.completed, priority: !!task.priority, notes: task.notes || '',
        recurrence: task.recurrence || 'none', recurrence_day: task.recurrenceDay || '',
        recurrence_days: JSON.stringify(task.recurrenceDays || []),
        completed_dates: JSON.stringify(task.completedDates || []), reminder_sent: !!task.reminderSent
      };
      // No version means create-only. A stale update must never recreate a deleted task.
      const write = versionedWrite('tasks', task.id, fields, fields, task.version ?? null);
      const rows = await sql.query(`
        WITH previous AS (SELECT * FROM tasks WHERE id=$1), saved AS (${write.query}),
        revised AS (
          UPDATE reminder_configs r SET revision=gen_random_uuid()::text, updated_at=now(), generated_through=NULL
          FROM saved s, previous p WHERE r.activity_id=s.id AND
            (s.time IS DISTINCT FROM p.time OR s.date IS DISTINCT FROM p.date
             OR s.recurrence IS DISTINCT FROM p.recurrence OR s.recurrence_day IS DISTINCT FROM p.recurrence_day
             OR s.recurrence_days IS DISTINCT FROM p.recurrence_days)
        ), confirmed AS (
          UPDATE reminder_occurrences o SET confirmed_at=COALESCE(o.confirmed_at,now()) FROM saved s
          WHERE o.activity_id=s.id AND (s.completed AND s.recurrence='none'
            OR o.occurrence_date IN (SELECT jsonb_array_elements_text(s.completed_dates::jsonb)))
        ) SELECT * FROM saved`, write.parameters);
      if (!rows.length) return res.status(409).json({ error: 'A tarefa mudou em outro dispositivo. Revise a alteração pendente.' });
      return res.json({ success: true, task: taskFromRow(rows[0]) });
    } catch (error: any) {
      console.error('Erro ao salvar tarefa:', error);
      return res.status(500).json({ error: 'Não foi possível persistir a tarefa' });
    }
  });

  apiRouter.delete('/tasks/:id', async (req, res) => {
    try {
      const version = req.get('If-Match');
      if (!version) return res.status(428).json({ error: 'Atualize a tarefa antes de excluir' });
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      const rows = await sql`
        WITH removed AS (DELETE FROM tasks WHERE id=${req.params.id} AND xmin::text=${version} RETURNING id),
        configs AS (DELETE FROM reminder_configs WHERE activity_id IN (SELECT id FROM removed)),
        occurrences AS (UPDATE reminder_occurrences SET cancelled_at=now() WHERE activity_id IN (SELECT id FROM removed))
        SELECT id FROM removed`;
      if (!rows.length) return res.status(409).json({ error: 'A tarefa mudou ou já foi excluída. Revise a alteração pendente.' });
      return res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir tarefa:', error);
      return res.status(500).json({ error: 'Não foi possível persistir a exclusão' });
    }
  });

  apiRouter.post("/tasks/reset", async (req, res) => {
    try {
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      await sql.transaction([
        sql`DELETE FROM reminder_configs`,
        sql`UPDATE reminder_occurrences SET cancelled_at=now()`,
        sql`DELETE FROM tasks`,
        ...DEFAULT_WEEKLY_TASKS.map(t => sql`
            INSERT INTO tasks (
              id, title, time, date, category, icon, completed, priority, notes, recurrence, recurrence_day, recurrence_days, completed_dates, reminder_sent
            ) VALUES (
              ${t.id},
              ${t.title},
              ${t.time},
              ${t.date},
              ${t.category},
              ${t.icon},
              ${t.completed},
              ${t.priority},
              ${t.notes},
              ${t.recurrence},
              ${t.recurrenceDay},
              ${JSON.stringify(t.recurrenceDays)},
              ${JSON.stringify(t.completedDates)},
              false
            )
          `)
      ]);
      return res.json({ success: true, tasks: DEFAULT_WEEKLY_TASKS });
    } catch (error: any) {
      console.error("Erro ao resetar tarefas:", error);
      return res.status(500).json({ error: error.message });
    }
  });
}

export function installSettingsPersistence(apiRouter: Router, getDb: () => any) {
  // Endpoint 5: Settings GET and POST
  apiRouter.get("/settings", async (req, res) => {
    try {
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      res.setHeader('Cache-Control', 'no-store');
      const rows = await sql`SELECT user_name, high_contrast, reminder_minutes, completed_study_dates,xmin::text AS version FROM user_settings WHERE id = 1`;
      const studyConfirmations = await sql`SELECT occurrence_date FROM reminder_occurrences WHERE activity_id='study_daily_summary' AND confirmed_at IS NOT NULL`;
      if (rows.length > 0) {
        return res.json({
          version: rows[0].version,
          userName: rows[0].user_name ?? "Henrique",
          highContrast: !!rows[0].high_contrast,
          reminderMinutes: rows[0].reminder_minutes ?? 15,
          completedStudyDates: [...new Set([...(rows[0].completed_study_dates ? JSON.parse(rows[0].completed_study_dates) : []), ...studyConfirmations.map((r: any) => r.occurrence_date)])]
        });
      }
      return res.json({ userName: 'Henrique', highContrast: false, reminderMinutes: 15, completedStudyDates: [], version: null });
    } catch (error: any) {
      console.error("Erro ao buscar configurações:", error);
      return res.status(503).json({ error: 'Não foi possível carregar as configurações do banco' });
    }
  });

  apiRouter.post("/settings", async (req, res) => {
    try {
      const { userName, highContrast, reminderMinutes, completedStudyDates } = req.body;
      const hasStudyDates = completedStudyDates !== undefined;
      if (hasStudyDates && (!Array.isArray(completedStudyDates) || completedStudyDates.some((date: unknown) => typeof date !== 'string'))) {
        return res.status(400).json({ error: 'completedStudyDates deve ser uma lista de datas' });
      }
      if (hasStudyDates && !req.get('If-Match')) return res.status(428).json({ error: 'Atualize o histórico de estudos antes de salvar' });
      const nameToSave = userName ?? "Henrique";
      const contrastToSave = !!highContrast;
      const minutesToSave = [5, 10, 15, 30, 60].includes(Number(reminderMinutes)) ? Number(reminderMinutes) : 15;
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      const fields = { user_name: nameToSave, high_contrast: contrastToSave, reminder_minutes: minutesToSave,
        completed_study_dates: JSON.stringify(completedStudyDates ?? []), updated_at: new Date().toISOString() };
      const changes: Record<string, unknown> = { updated_at: fields.updated_at };
      if (userName !== undefined) changes.user_name = fields.user_name;
      if (highContrast !== undefined) changes.high_contrast = fields.high_contrast;
      if (reminderMinutes !== undefined) changes.reminder_minutes = fields.reminder_minutes;
      if (hasStudyDates) changes.completed_study_dates = fields.completed_study_dates;
      // Profile-only legacy requests still patch just their supplied fields.
      const write = versionedWrite('user_settings', 1, fields, changes, expectedVersion(req.get('If-Match')));
      const [saved] = await sql.query(write.query, write.parameters);
      if (!saved) return res.status(409).json({ error: 'As configurações mudaram. Revise a alteração pendente.' });
      if (hasStudyDates && Array.isArray(req.body.removedStudyDates)) {
        const removed = req.body.removedStudyDates.filter((date: unknown) => typeof date === 'string' && !completedStudyDates.includes(date));
        await sql`UPDATE reminder_occurrences SET confirmed_at=NULL WHERE activity_id='study_daily_summary'
          AND occurrence_date IN (SELECT jsonb_array_elements_text(${JSON.stringify(removed)}::jsonb))`;
      }
      await recordCompletedOccurrences(sql, localDate(new Date()));
      return res.json({ success: true, settings: {
        version: saved.version,
        userName: saved.user_name,
        highContrast: saved.high_contrast,
        reminderMinutes: saved.reminder_minutes,
        completedStudyDates: saved.completed_study_dates ? JSON.parse(saved.completed_study_dates) : []
      } });
    } catch (error: any) {
      console.error("Erro ao salvar configurações:", error);
      return res.status(500).json({ error: error.message });
    }
  });
}

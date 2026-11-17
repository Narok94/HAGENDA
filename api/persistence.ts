import type { Router } from "express";
import { recordCompletedOccurrences } from "./reminders.js";
import { localDate } from "./reminder-policy.js";

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
      const rows = await sql`SELECT * FROM tasks`;
      const tasks = rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        time: row.time,
        date: row.date,
        category: row.category,
        icon: row.icon,
        completed: !!row.completed,
        priority: !!row.priority,
        notes: row.notes || "",
        recurrence: row.recurrence || "none",
        recurrenceDay: row.recurrence_day || "",
        recurrenceDays: row.recurrence_days ? JSON.parse(row.recurrence_days) : [],
        completedDates: row.completed_dates ? JSON.parse(row.completed_dates) : [],
        reminderSent: !!row.reminder_sent
      }));
      return res.json(tasks);
    } catch (error: any) {
      console.error("Erro ao buscar tarefas:", error);
      return res.status(503).json({ error: 'Não foi possível carregar as tarefas do banco' });
    }
  });

  apiRouter.post("/tasks", async (req, res) => {
    try {
      const task = req.body;
      if (!task.id) {
        return res.status(400).json({ error: "O id da tarefa é obrigatório." });
      }
      if (!task.title || typeof task.time !== "string" || !["none", "semanal", "mensal"].includes(task.recurrence || "none")) return res.status(400).json({ error: "Tarefa inválida" });
      const reminderSentVal = task.reminderSent !== undefined ? !!task.reminderSent : false;
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      const reviseReminders = sql`UPDATE reminder_configs SET revision=gen_random_uuid()::text, updated_at=now(), generated_through=NULL WHERE activity_id=${task.id}
        AND EXISTS(SELECT 1 FROM tasks WHERE id=${task.id} AND (time IS DISTINCT FROM ${task.time}
          OR date IS DISTINCT FROM ${task.date} OR recurrence IS DISTINCT FROM ${task.recurrence || 'none'}
          OR recurrence_day IS DISTINCT FROM ${task.recurrenceDay || ''}
          OR recurrence_days IS DISTINCT FROM ${JSON.stringify(task.recurrenceDays || [])}))`;
      const saveTask = sql`
        INSERT INTO tasks (
          id, title, time, date, category, icon, completed, priority, notes, recurrence, recurrence_day, recurrence_days, completed_dates, reminder_sent
        ) VALUES (
          ${task.id},
          ${task.title},
          ${task.time},
          ${task.date},
          ${task.category},
          ${task.icon},
          ${!!task.completed},
          ${!!task.priority},
          ${task.notes || ""},
          ${task.recurrence || "none"},
          ${task.recurrenceDay || ""},
          ${JSON.stringify(task.recurrenceDays || [])},
          ${JSON.stringify(task.completedDates || [])},
          ${reminderSentVal}
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          time = EXCLUDED.time,
          date = EXCLUDED.date,
          category = EXCLUDED.category,
          icon = EXCLUDED.icon,
          completed = EXCLUDED.completed,
          priority = EXCLUDED.priority,
          notes = EXCLUDED.notes,
          recurrence = EXCLUDED.recurrence,
          recurrence_day = EXCLUDED.recurrence_day,
          recurrence_days = EXCLUDED.recurrence_days,
          completed_dates = EXCLUDED.completed_dates,
          reminder_sent = ${reminderSentVal}
      `;
      const confirmOccurrences = sql`UPDATE reminder_occurrences SET confirmed_at=COALESCE(confirmed_at,now()) WHERE activity_id=${task.id}
        AND (${!!task.completed} AND ${task.recurrence || 'none'}='none'
          OR occurrence_date IN (SELECT jsonb_array_elements_text(${JSON.stringify(task.completedDates || [])}::jsonb)))`;
      await sql.transaction([reviseReminders, saveTask, confirmOccurrences]);
      return res.json({ success: true, task });
    } catch (error: any) {
      console.error("Erro ao salvar tarefa:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  apiRouter.delete("/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      await sql.transaction([
        sql`DELETE FROM reminder_configs WHERE activity_id=${id}`,
        sql`UPDATE reminder_occurrences SET cancelled_at=now() WHERE activity_id=${id}`,
        sql`DELETE FROM tasks WHERE id = ${id}`
      ]);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Erro ao deletar tarefa:", error);
      return res.status(500).json({ error: error.message });
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
      const rows = await sql`SELECT user_name, high_contrast, reminder_minutes, completed_study_dates FROM user_settings WHERE id = 1`;
      const studyConfirmations = await sql`SELECT occurrence_date FROM reminder_occurrences WHERE activity_id='study_daily_summary' AND confirmed_at IS NOT NULL`;
      if (rows.length > 0) {
        return res.json({
          userName: rows[0].user_name ?? "Henrique",
          highContrast: !!rows[0].high_contrast,
          reminderMinutes: rows[0].reminder_minutes ?? 15,
          completedStudyDates: [...new Set([...(rows[0].completed_study_dates ? JSON.parse(rows[0].completed_study_dates) : []), ...studyConfirmations.map((r: any) => r.occurrence_date)])]
        });
      }
      return res.json({ userName: 'Henrique', highContrast: false, reminderMinutes: 15, completedStudyDates: [] });
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
      const nameToSave = userName ?? "Henrique";
      const contrastToSave = !!highContrast;
      const minutesToSave = [5, 10, 15, 30, 60].includes(Number(reminderMinutes)) ? Number(reminderMinutes) : 15;
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      // Preserve omitted columns inside the upsert, including concurrent updates.
      const [saved] = await sql`
          INSERT INTO user_settings (id, user_name, high_contrast, reminder_minutes, completed_study_dates, updated_at)
          VALUES (1, ${nameToSave}, ${contrastToSave}, ${minutesToSave}, ${JSON.stringify(completedStudyDates ?? [])}, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            user_name = CASE WHEN ${userName !== undefined} THEN EXCLUDED.user_name ELSE user_settings.user_name END,
            high_contrast = CASE WHEN ${highContrast !== undefined} THEN EXCLUDED.high_contrast ELSE user_settings.high_contrast END,
            reminder_minutes = CASE WHEN ${reminderMinutes !== undefined} THEN EXCLUDED.reminder_minutes ELSE user_settings.reminder_minutes END,
            completed_study_dates = CASE WHEN ${hasStudyDates} THEN EXCLUDED.completed_study_dates ELSE user_settings.completed_study_dates END,
            updated_at = CURRENT_TIMESTAMP
          RETURNING user_name, high_contrast, reminder_minutes, completed_study_dates
        `;
      await recordCompletedOccurrences(sql, localDate(new Date()));
      return res.json({ success: true, settings: {
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

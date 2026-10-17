import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { neon } from "@neondatabase/serverless";
import { installReminders, migrateReminders, recordCompletedOccurrences, syncSeededMealCompletions, syncSeededWorkoutCompletion, integratedConfirmations } from "./reminders.js";
import { WORKOUT_GROUPS } from "../src/data/workoutData.js";
import { localDate } from "./reminder-policy.js";
import { installAccess } from "./access.js";

if (process.env.NODE_ENV !== "production") {
  try {
    dotenv.config();
  } catch (error) {
    console.warn("Failed to load .env file, using existing environment variables.");
  }
}

const app = express();
app.use(express.json());

const apiRouter = express.Router();
installAccess(apiRouter);
apiRouter.use(async (_req, res, next) => {
  try { await databaseReady; next(); } catch { res.status(503).json({ error: "Banco indisponível" }); }
});
installReminders(apiRouter, getDb);

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

// In-memory fallback
let memoryTasks: any[] = [...DEFAULT_WEEKLY_TASKS];
let memorySubscriptions: any[] = [];
let memoryUserSettings: { userName: string; highContrast: boolean; reminderMinutes: number; completedStudyDates: string[] } = {
  userName: "Henrique",
  highContrast: false,
  reminderMinutes: 15,
  completedStudyDates: [],
};
let memoryWorkoutState: {
  activeGroupId: string;
  workoutDate: string;
  completedExercises: Record<string, boolean>;
  weights: Record<string, string>;
} = {
  activeGroupId: "A",
  workoutDate: "",
  completedExercises: {},
  weights: {},
};
let memoryDietState: {
  dietDate: string;
  completedMeals: Record<string, boolean>;
  waterMl: number;
} = {
  dietDate: "",
  completedMeals: {},
  waterMl: 0,
};

// Helper for database queries
let dbClient: any = null;

function getDb() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!dbClient) {
    try {
      dbClient = neon(process.env.DATABASE_URL);
    } catch (err) {
      console.error("Erro ao inicializar o cliente Neon:", err);
      return null;
    }
  }
  return dbClient;
}

async function setupDatabase() {
  const sql = getDb();
  if (!sql) {
    console.log("DATABASE_URL não configurada ou inválida. O aplicativo usará persistência em memória no servidor.");
    return;
  }
  try {
    // Create database tables if they do not exist
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(255) PRIMARY KEY,
        title TEXT NOT NULL,
        time VARCHAR(5) NOT NULL,
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
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE`;
    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        user_name TEXT,
        high_contrast BOOLEAN DEFAULT FALSE,
        reminder_minutes INTEGER DEFAULT 15,
        completed_study_dates TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 15`;
    await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS completed_study_dates TEXT`;
    await sql`
      CREATE TABLE IF NOT EXISTS workout_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        active_group_id VARCHAR(1),
        workout_date VARCHAR(10),
        completed_exercises TEXT,
        weights TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS diet_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        diet_date VARCHAR(10),
        completed_meals TEXT,
        water_ml INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await migrateReminders(sql);
    console.log("Neon PostgreSQL conectado com sucesso! Tabelas verificadas/criadas.");
  } catch (error) {
    console.error("Erro ao configurar tabela no Neon PostgreSQL");
    throw error;
  }
}

// Ensure database is initialized in serverless environments
const databaseReady = setupDatabase();
// Observe rejection immediately; requests still fail closed through databaseReady.
databaseReady.catch(() => {});

// Lazy initialization of Google Gen AI to prevent crashing if the key is missing on startup
let aiClient: GoogleGenAI | null = null;

function getAi() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  if (!aiClient) {
    try {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } catch (err) {
      console.error("Erro ao inicializar o cliente Google Gen AI:", err);
      return null;
    }
  }
  return aiClient;
}

// Endpoint 0: Check Database Connection status
apiRouter.get("/db-status", async (req, res) => {
  const sql = getDb();
  if (!sql) {
    return res.json({ connected: false, mode: "memory" });
  }
  try {
    await sql`SELECT 1`;
    return res.json({ connected: true, mode: "neon" });
  } catch (error: any) {
    console.error("Erro ao verificar conexao do banco:", error);
    return res.json({ connected: false, mode: "neon_error", error: error.message });
  }
});

// Endpoint 1: Parse Task with NLP (Gemini Structured Outputs)
apiRouter.post("/parse-task", async (req, res) => {
  try {
    const { text, currentDate } = req.body;
    if (!text) {
      return res.status(400).json({ error: "O texto para análise é obrigatório." });
    }

    const ai = getAi();
    if (!ai) {
      return res.status(500).json({ error: "Chave de API do Gemini não configurada no servidor." });
    }

    const today = currentDate || new Date().toISOString().split('T')[0];
    const systemInstruction = `Você é um assistente de IA especialista em produtividade e organização.
Sua missão é extrair as informações de uma frase em português e gerar um JSON estruturado para uma tarefa da agenda.
Data atual de referência (hoje): ${today}.

Instruções para os campos:
1. title: O que precisa ser feito (título curto, claro, bem escrito).
2. date: Calcule a data absoluta (YYYY-MM-DD) com base em expressões relativas como "hoje" (${today}), "amanhã" (dia seguinte), "segunda que vem", "dia 20", etc. Se for uma tarefa recorrente semanal ou sem data fixa, pode deixar em branco.
3. time: Formato HH:MM de 24 horas. Se não mencionado, use "12:00".
4. category: Defina uma categoria coerente (ex: 'Saúde' para exercícios/médicos, 'Trabalho' para tarefas profissionais, 'Estudos' para aulas/leituras, 'Finanças', 'Pessoal', 'Geral').
5. priority: boolean (true se houver tom de urgência ou se disser "prioridade", "urgente", "importante", "foco máximo").
6. icon: Escolha exatamente um da lista: 'Circle', 'Sparkles', 'BookOpen', 'Briefcase', 'Coffee', 'Dumbbell', 'Target', 'Star', 'Zap', 'ShoppingBag', 'Flame'.
   - 'Dumbbell' para academia/treino/físico
   - 'BookOpen' para estudos/leitura
   - 'Briefcase' para trabalho/reunião
   - 'Coffee' para pausa/café/lazer/almoço
   - 'ShoppingBag' para compras/mercado
   - 'Flame' ou 'Zap' para prioridades críticas ou energia
   - 'Target' ou 'Sparkles' para metas/hábitos
7. recurrence: 'none', 'semanal' ou 'mensal'. (ex: "toda segunda" -> semanal, "todo dia 5" -> mensal).
8. recurrenceDay: se recurrence for 'mensal', defina o dia do mês (ex: "todo dia 10" -> "10").
9. recurrenceDays: se recurrence for 'semanal', forneça um array de strings representando os dias da semana desejados ('0' para domingo, '1' para segunda, ..., '6' para sábado). (ex: "toda segunda e quarta" -> ["1", "3"]).
10. notes: Observações ou descrição complementar extraída.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Frase para extrair: "${text}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            time: { type: Type.STRING },
            category: { type: Type.STRING },
            priority: { type: Type.BOOLEAN },
            icon: { type: Type.STRING },
            recurrence: { type: Type.STRING },
            recurrenceDay: { type: Type.STRING },
            recurrenceDays: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            notes: { type: Type.STRING }
          },
          required: ["title", "time", "category", "priority", "icon", "recurrence"]
        }
      }
    });

    const parsedJson = JSON.parse(response.text || "{}");
    res.json(parsedJson);

  } catch (error: any) {
    console.error("Erro em /api/parse-task:", error);
    res.status(500).json({ error: "Erro ao processar criação de tarefa com IA: " + error.message });
  }
});

// Endpoint 1.5: Transcribe and Parse Task from Audio
apiRouter.post("/transcribe-task", async (req, res) => {
  try {
    const { audio, currentDate, mimeType } = req.body;
    if (!audio) {
      return res.status(400).json({ error: "Áudio é obrigatório." });
    }

    const ai = getAi();
    if (!ai) {
      return res.status(500).json({ error: "Chave de API não configurada." });
    }

    const today = currentDate || new Date().toISOString().split('T')[0];
    const systemInstruction = `Você é um assistente de IA especialista em produtividade e organização.
Sua missão é transcrever o áudio fornecido em português e gerar um JSON estruturado para uma tarefa da agenda baseado na transcrição.
Data atual de referência (hoje): ${today}.

Instruções para os campos:
1. title: O que precisa ser feito (título curto, claro, bem escrito baseado no áudio).
2. date: Calcule a data absoluta (YYYY-MM-DD) com base em expressões relativas como "hoje", "amanhã", etc. Se for uma tarefa recorrente semanal ou sem data fixa, deixe em branco.
3. time: Formato HH:MM de 24 horas. Se não mencionado, use "12:00".
4. category: Defina uma categoria coerente.
5. priority: boolean (true se houver urgência).
6. icon: Escolha um da lista: 'Circle', 'Sparkles', 'BookOpen', 'Briefcase', 'Coffee', 'Dumbbell', 'Target', 'Star', 'Zap', 'ShoppingBag', 'Flame'.
7. recurrence: 'none', 'semanal' ou 'mensal'.
8. recurrenceDay: se recurrence for 'mensal', defina o dia do mês.
9. recurrenceDays: se recurrence for 'semanal', forneça os dias da semana desejados ('0' a '6').
10. notes: Adicione a transcrição exata e completa do áudio ao final das notas para referência do usuário.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: mimeType || "audio/webm",
            data: audio
          }
        },
        { text: "Extraia a tarefa do áudio em anexo." }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            time: { type: Type.STRING },
            category: { type: Type.STRING },
            priority: { type: Type.BOOLEAN },
            icon: { type: Type.STRING },
            recurrence: { type: Type.STRING },
            recurrenceDay: { type: Type.STRING },
            recurrenceDays: { type: Type.ARRAY, items: { type: Type.STRING } },
            notes: { type: Type.STRING }
          },
          required: ["title", "time", "category", "priority", "icon", "recurrence"]
        }
      }
    });

    const parsedJson = JSON.parse(response.text || "{}");
    res.json(parsedJson);
  } catch (error: any) {
    console.error("Erro em /api/transcribe-task:", error);
    res.status(500).json({ error: "Erro ao transcrever áudio: " + error.message });
  }
});

// Endpoint 2: Generate Coach Motivation based on today's tasks
apiRouter.post("/generate-inspiration", async (req, res) => {
  try {
    const { tasks, userName } = req.body;
    const ai = getAi();
    if (!ai) {
      return res.status(200).json({ text: "Foco, determinação e consistência! Vença o seu dia." });
    }

    const tasksSummary = tasks && tasks.length > 0
      ? tasks.map((t: any) => `- ${t.title} (${t.category})${t.priority ? ' [Alta Prioridade]' : ''}`).join("\n")
      : "Nenhuma tarefa agendada para hoje.";

    const prompt = `Você é o coach de inteligência e disciplina do HAGENDA. O usuário ${userName || "Campeão"} possui as seguintes tarefas hoje:
${tasksSummary}

Gere uma frase de motivação e foco ultra-personalizada de apenas uma linha (no máximo 150 caracteres).
Misture o foco físico, mental ou profissional dependendo das categorias de tarefas (ex: misture treinos e trabalho se houver ambos). Seja enérgico, direto, empático e focado em ação e autodisciplina. Chame o usuário pelo nome se fizer sentido. Não use aspas na resposta final.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Gere apenas uma única linha inspiradora de até 150 caracteres para motivar o usuário baseado em suas tarefas do dia. Seja extremamente direto, evite introduções ou conclusões ou aspas.",
        temperature: 0.8
      }
    });

    res.json({ text: response.text?.trim().replace(/^["']|["']$/g, "") || "Vença o seu dia com foco e disciplina!" });
  } catch (error: any) {
    console.error("Erro em /api/generate-inspiration:", error);
    res.json({ text: "Foque na execução. A disciplina é o segredo para alcançar qualquer meta hoje!" });
  }
});

// Endpoint 3: CRUD for Tasks (Neon DB / Memory Fallback)
apiRouter.get("/tasks", async (req, res) => {
  try {
    const sql = getDb();
    if (sql) {
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
    } else {
      return res.json(memoryTasks);
    }
  } catch (error: any) {
    console.error("Erro ao buscar tarefas:", error);
    return res.json(memoryTasks);
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
    if (sql) {
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
    } else {
      const idx = memoryTasks.findIndex(t => t.id === task.id);
      const newTask = { ...task, reminderSent: reminderSentVal };
      if (idx >= 0) {
        memoryTasks[idx] = newTask;
      } else {
        memoryTasks.push(newTask);
      }
      return res.json({ success: true, task: newTask });
    }
  } catch (error: any) {
    console.error("Erro ao salvar tarefa:", error);
    return res.status(500).json({ error: error.message });
  }
});

apiRouter.delete("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const sql = getDb();
    if (sql) {
      await sql.transaction([
        sql`DELETE FROM reminder_configs WHERE activity_id=${id}`,
        sql`UPDATE reminder_occurrences SET cancelled_at=now() WHERE activity_id=${id}`,
        sql`DELETE FROM tasks WHERE id = ${id}`
      ]);
    }
    memoryTasks = memoryTasks.filter(t => t.id !== id);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao deletar tarefa:", error);
    return res.status(500).json({ error: error.message });
  }
});

apiRouter.post("/tasks/reset", async (req, res) => {
  try {
    memoryTasks = [...DEFAULT_WEEKLY_TASKS];
    const sql = getDb();
    if (sql) {
      await sql.transaction([sql`DELETE FROM reminder_configs`, sql`UPDATE reminder_occurrences SET cancelled_at=now()`, sql`DELETE FROM tasks`]);
      for (const t of DEFAULT_WEEKLY_TASKS) {
        await sql`
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
        `;
      }
    }
    return res.json({ success: true, tasks: DEFAULT_WEEKLY_TASKS });
  } catch (error: any) {
    console.error("Erro ao resetar tarefas:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint 4: Subscribe to Push Notifications
apiRouter.post("/subscribe", async (req, res) => {
  try {
    const { endpoint, p256dh, auth, keys } = req.body;
    const actualP256dh = p256dh || keys?.p256dh;
    const actualAuth = auth || keys?.auth;

    if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || !actualP256dh || !actualAuth) {
      return res.status(400).json({ error: "endpoint, p256dh e auth são obrigatórios." });
    }

    const sql = getDb();
    if (!sql) {
      // Memory fallback for subscriptions
      const existingIdx = memorySubscriptions.findIndex(s => s.endpoint === endpoint);
      if (existingIdx >= 0) {
        memorySubscriptions[existingIdx] = { endpoint, p256dh: actualP256dh, auth: actualAuth };
      } else {
        memorySubscriptions.push({ endpoint, p256dh: actualP256dh, auth: actualAuth });
      }
      return res.json({ success: true, message: "Inscrição de notificações salva com sucesso (memória)!" });
    }

    // Verificar se a inscrição já existe
    const existing = await sql`SELECT 1 FROM push_subscriptions WHERE endpoint = ${endpoint}`;
    if (existing.length > 0) {
      // Atualizar as chaves caso tenham mudado
      await sql`
        UPDATE push_subscriptions
        SET p256dh = ${actualP256dh}, auth = ${actualAuth}
        WHERE endpoint = ${endpoint}
      `;
    } else {
      // Inserir nova inscrição
      await sql`
        INSERT INTO push_subscriptions (endpoint, p256dh, auth)
        VALUES (${endpoint}, ${actualP256dh}, ${actualAuth})
      `;
    }

    return res.json({ success: true, message: "Inscrição de notificações salva com sucesso!" });
  } catch (error: any) {
    console.error("Erro ao registrar inscrição push:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint 5: Settings GET and POST
apiRouter.get("/settings", async (req, res) => {
  try {
    const sql = getDb();
    if (sql) {
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
    }
    return res.json(memoryUserSettings);
  } catch (error: any) {
    console.error("Erro ao buscar configurações:", error);
    return res.json(memoryUserSettings);
  }
});

apiRouter.post("/settings", async (req, res) => {
  try {
    const { userName, highContrast, reminderMinutes, completedStudyDates } = req.body;
    const nameToSave = userName ?? "Henrique";
    const contrastToSave = !!highContrast;
    const minutesToSave = [5, 10, 15, 30, 60].includes(Number(reminderMinutes)) ? Number(reminderMinutes) : 15;
    const studyDatesArr = Array.isArray(completedStudyDates) ? completedStudyDates : (memoryUserSettings.completedStudyDates || []);

    memoryUserSettings = {
      userName: nameToSave,
      highContrast: contrastToSave,
      reminderMinutes: minutesToSave,
      completedStudyDates: studyDatesArr
    };

    const sql = getDb();
    if (sql) {
      await sql`
        INSERT INTO user_settings (id, user_name, high_contrast, reminder_minutes, completed_study_dates, updated_at)
        VALUES (1, ${nameToSave}, ${contrastToSave}, ${minutesToSave}, ${JSON.stringify(studyDatesArr)}, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          user_name = EXCLUDED.user_name,
          high_contrast = EXCLUDED.high_contrast,
          reminder_minutes = EXCLUDED.reminder_minutes,
          completed_study_dates = EXCLUDED.completed_study_dates,
          updated_at = CURRENT_TIMESTAMP
      `;
    }
    await recordCompletedOccurrences(sql, localDate(new Date()));
    return res.json({ success: true, settings: memoryUserSettings });
  } catch (error: any) {
    console.error("Erro ao salvar configurações:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint 6: Workout State GET and POST
apiRouter.get("/workout-state", async (req, res) => {
  try {
    const sql = getDb();
    if (sql) {
      const rows = await sql`SELECT active_group_id, workout_date, completed_exercises, weights FROM workout_state WHERE id = 1`;
      const today = localDate(new Date());
      const confirmations = await integratedConfirmations(sql, today);
      if (confirmations.workout) {
        const group = WORKOUT_GROUPS.find(g => g.id === rows[0]?.active_group_id) || WORKOUT_GROUPS[0];
        return res.json({ activeGroupId: group.id, workoutDate: today,
          completedExercises: Object.fromEntries(group.exercises.map(e => [e.id, true])), weights: rows[0]?.weights ? JSON.parse(rows[0].weights) : {} });
      }
      if (rows.length > 0) {
        const row = rows[0];
        let completedExercises = {};
        let weights = {};
        try {
          completedExercises = row.completed_exercises ? JSON.parse(row.completed_exercises) : {};
        } catch (e) {}
        try {
          weights = row.weights ? JSON.parse(row.weights) : {};
        } catch (e) {}

        return res.json({
          activeGroupId: row.active_group_id || "A",
          workoutDate: row.workout_date || "",
          completedExercises,
          weights
        });
      }
    }
    return res.json(memoryWorkoutState);
  } catch (error: any) {
    console.error("Erro ao buscar estado do treino:", error);
    return res.json(memoryWorkoutState);
  }
});

apiRouter.post("/workout-state", async (req, res) => {
  try {
    const { activeGroupId, workoutDate, completedExercises, weights } = req.body;
    const group = activeGroupId || "A";
    const dateStr = workoutDate || "";
    const exercisesObj = typeof completedExercises === "object" && completedExercises !== null ? completedExercises : {};
    const weightsObj = typeof weights === "object" && weights !== null ? weights : {};

    const exercisesJsonStr = JSON.stringify(exercisesObj);
    const weightsJsonStr = JSON.stringify(weightsObj);

    memoryWorkoutState = {
      activeGroupId: group,
      workoutDate: dateStr,
      completedExercises: exercisesObj,
      weights: weightsObj
    };

    const sql = getDb();
    if (sql) {
      await sql`
        INSERT INTO workout_state (id, active_group_id, workout_date, completed_exercises, weights, updated_at)
        VALUES (1, ${group}, ${dateStr}, ${exercisesJsonStr}, ${weightsJsonStr}, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          active_group_id = EXCLUDED.active_group_id,
          workout_date = EXCLUDED.workout_date,
          completed_exercises = EXCLUDED.completed_exercises,
          weights = EXCLUDED.weights,
          updated_at = CURRENT_TIMESTAMP
      `;
    }
    await syncSeededWorkoutCompletion(sql, dateStr, group, exercisesObj);
    await recordCompletedOccurrences(sql, dateStr);
    return res.json({ success: true, workoutState: memoryWorkoutState });
  } catch (error: any) {
    console.error("Erro ao salvar estado do treino:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint 7: Diet State GET and POST
apiRouter.get("/diet-state", async (req, res) => {
  try {
    const sql = getDb();
    if (sql) {
      const rows = await sql`SELECT diet_date, completed_meals, water_ml FROM diet_state WHERE id = 1`;
      const today = localDate(new Date());
      const confirmations = await integratedConfirmations(sql, today);
      if (confirmations.water || Object.keys(confirmations.meals).length) {
        const current = rows[0]?.diet_date === today ? rows[0] : null;
        return res.json({ dietDate: today, completedMeals: { ...(current?.completed_meals ? JSON.parse(current.completed_meals) : {}), ...confirmations.meals },
          waterMl: Math.max(Number(current?.water_ml) || 0, confirmations.water ? 3000 : 0) });
      }
      if (rows.length > 0) {
        const row = rows[0];
        let completedMeals = {};
        try {
          completedMeals = row.completed_meals ? JSON.parse(row.completed_meals) : {};
        } catch (e) {}

        return res.json({
          dietDate: row.diet_date || "",
          completedMeals,
          waterMl: Number(row.water_ml) || 0
        });
      }
    }
    return res.json(memoryDietState);
  } catch (error: any) {
    console.error("Erro ao buscar estado da dieta:", error);
    return res.json(memoryDietState);
  }
});

apiRouter.post("/diet-state", async (req, res) => {
  try {
    const { dietDate, completedMeals, waterMl } = req.body;
    const dateStr = dietDate || "";
    const mealsObj = typeof completedMeals === "object" && completedMeals !== null ? completedMeals : {};
    const water = Number(waterMl) || 0;

    const mealsJsonStr = JSON.stringify(mealsObj);

    memoryDietState = {
      dietDate: dateStr,
      completedMeals: mealsObj,
      waterMl: water
    };

    const sql = getDb();
    if (sql) {
      await sql`
        INSERT INTO diet_state (id, diet_date, completed_meals, water_ml, updated_at)
        VALUES (1, ${dateStr}, ${mealsJsonStr}, ${water}, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          diet_date = EXCLUDED.diet_date,
          completed_meals = EXCLUDED.completed_meals,
          water_ml = EXCLUDED.water_ml,
          updated_at = CURRENT_TIMESTAMP
      `;
    }
    await syncSeededMealCompletions(sql, dateStr, mealsObj);
    await recordCompletedOccurrences(sql, dateStr);
    return res.json({ success: true, dietState: memoryDietState });
  } catch (error: any) {
    console.error("Erro ao salvar estado da dieta:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.use("/api", apiRouter);

export { app, setupDatabase, databaseReady };
export default app;

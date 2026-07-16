import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { neon } from "@neondatabase/serverless";

dotenv.config();

const app = express();
app.use(express.json());

const apiRouter = express.Router();

// In-memory fallback
let memoryTasks: any[] = [];

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
        completed_dates TEXT  -- Armazenado como string JSON array
      )
    `;
    console.log("Neon PostgreSQL conectado com sucesso! Tabela 'tasks' criada ou já existente.");
  } catch (error) {
    console.error("Erro ao configurar tabela no Neon PostgreSQL:", error);
  }
}

// Ensure database is initialized in serverless environments
setupDatabase();

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
        completedDates: row.completed_dates ? JSON.parse(row.completed_dates) : []
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
    const sql = getDb();
    if (sql) {
      await sql`
        INSERT INTO tasks (
          id, title, time, date, category, icon, completed, priority, notes, recurrence, recurrence_day, recurrence_days, completed_dates
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
          ${JSON.stringify(task.completedDates || [])}
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
          completed_dates = EXCLUDED.completed_dates
      `;
      return res.json({ success: true, task });
    } else {
      const idx = memoryTasks.findIndex(t => t.id === task.id);
      if (idx >= 0) {
        memoryTasks[idx] = task;
      } else {
        memoryTasks.push(task);
      }
      return res.json({ success: true, task });
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
      await sql`DELETE FROM tasks WHERE id = ${id}`;
    }
    memoryTasks = memoryTasks.filter(t => t.id !== id);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao deletar tarefa:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.use("/api", apiRouter);
app.use("/", apiRouter);

export { app, setupDatabase };
export default app;

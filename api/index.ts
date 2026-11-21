import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { neon } from "@neondatabase/serverless";
import { installReminders, migrateReminders } from "./reminders.js";
import { installAccess } from "./access.js";
import { installIntegratedPersistence } from "./integrated-persistence.js";
import { installTaskPersistence, installSettingsPersistence, installPersistenceGuard, migrateTaskPersistence } from "./persistence.js";

import { installMarketing, migrateMarketing } from "./marketing.js";

if (process.env.NODE_ENV !== "production") {
  try {
    dotenv.config();
  } catch (error) {
    console.warn("Failed to load .env file, using existing environment variables.");
  }
}

const app = express();
app.use(express.json({ limit: "10mb" }));

const apiRouter = express.Router();
installAccess(apiRouter);
apiRouter.use(async (_req, res, next) => {
  try { await databaseReady; next(); } catch { res.status(503).json({ error: "Banco indisponível" }); }
});
installPersistenceGuard(apiRouter, getDb);
installReminders(apiRouter, getDb);

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
    console.warn("DATABASE_URL não configurada ou inválida. Gravações serão recusadas até o Neon estar disponível.");
    return;
  }
  try {
    // Create database tables if they do not exist
    await migrateTaskPersistence(sql);
    await migrateMarketing(sql);
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
    return res.json({ connected: false, mode: "unavailable" });
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

installTaskPersistence(apiRouter, getDb);
installMarketing(apiRouter, getDb);

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
    if (!sql) return res.status(503).json({ error: 'Banco indisponível' });

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

installSettingsPersistence(apiRouter, getDb);

installIntegratedPersistence(apiRouter, getDb);

app.use("/api", apiRouter);

export { app, setupDatabase, databaseReady };
export default app;

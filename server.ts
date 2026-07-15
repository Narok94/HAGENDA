import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google Gen AI
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Endpoint 1: Parse Task with NLP (Gemini Structured Outputs)
app.post("/api/parse-task", async (req, res) => {
  try {
    const { text, currentDate } = req.body;
    if (!text) {
      return res.status(400).json({ error: "O texto para análise é obrigatório." });
    }

    if (!apiKey) {
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

// Endpoint 2: Generate Coach Motivation based on today's tasks
app.post("/api/generate-inspiration", async (req, res) => {
  try {
    const { tasks, userName } = req.body;
    if (!apiKey) {
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

// Vite middleware and serving app
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

initServer();

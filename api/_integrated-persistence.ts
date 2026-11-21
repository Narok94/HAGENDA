import type { Router } from 'express';
import { WORKOUT_GROUPS } from '../src/data/workoutData.js';
import { localDate } from './_reminder-policy.js';
import { integratedConfirmations, recordCompletedOccurrences, syncSeededMealCompletions, syncSeededWorkoutCompletion } from './_reminders.js';
import { expectedVersion, versionedWrite } from './_versioned-write.js';

const linkedMeals: Record<string, string> = { task_cafe: 'cafe_manha', task_lanche_pre: 'lanche_manha', task_almoco: 'almoco', task_lanche: 'lanche_tarde', task_jantar: 'jantar' };
async function reopen(sql: any, ids: string[], date: string) {
  if (!ids.length) return;
  await sql`UPDATE reminder_occurrences SET confirmed_at=NULL WHERE occurrence_date=${date}
    AND activity_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))`;
  await sql`UPDATE tasks SET completed=CASE WHEN recurrence='none' AND date=${date} THEN false ELSE completed END,
    completed_dates=COALESCE((SELECT jsonb_agg(d) FROM jsonb_array_elements_text(COALESCE(NULLIF(completed_dates,''),'[]')::jsonb) AS x(d) WHERE d<>${date}), '[]'::jsonb)::text
    WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))`;
}

export function workoutFromRow(row: any) {
  return { version: row?.version ?? null, activeGroupId: row?.active_group_id || 'A', workoutDate: row?.workout_date || '',
    completedExercises: row?.completed_exercises ? JSON.parse(row.completed_exercises) : {},
    weights: row?.weights ? JSON.parse(row.weights) : {} };
}

export function dietFromRow(row: any) {
  return { version: row?.version ?? null, dietDate: row?.diet_date || '',
    completedMeals: row?.completed_meals ? JSON.parse(row.completed_meals) : {}, waterMl: Number(row?.water_ml) || 0 };
}

export function installIntegratedPersistence(router: Router, getDb: () => any) {
  router.get('/workout-state', async (_req, res) => {
    try {
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      const [row] = await sql`SELECT *,xmin::text AS version FROM workout_state WHERE id=1`;
      const state = workoutFromRow(row);
      const today = localDate(new Date());
      // Version-checked current-day snapshots are authoritative. Old notification
      // confirmations must not undo a deliberate reopening or a group change.
      if ((await integratedConfirmations(sql, today)).workout && state.workoutDate !== today) {
        const group = WORKOUT_GROUPS.find(g => g.id === state.activeGroupId) || WORKOUT_GROUPS[0];
        state.workoutDate = today;
        state.completedExercises = Object.fromEntries(group.exercises.map(e => [e.id, true]));
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json(state);
    } catch { res.status(503).json({ error: 'Não foi possível carregar o treino' }); }
  });

  router.get('/diet-state', async (_req, res) => {
    try {
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      const [row] = await sql`SELECT *,xmin::text AS version FROM diet_state WHERE id=1`;
      const state = dietFromRow(row);
      const today = localDate(new Date());
      const confirmations = await integratedConfirmations(sql, today);
      if (state.dietDate !== today && (confirmations.water || Object.keys(confirmations.meals).length)) {
        if (state.dietDate !== today) { state.completedMeals = {}; state.waterMl = 0; }
        state.dietDate = today;
        state.completedMeals = { ...state.completedMeals, ...confirmations.meals };
        if (confirmations.water) state.waterMl = Math.max(state.waterMl, 3000);
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json(state);
    } catch { res.status(503).json({ error: 'Não foi possível carregar a dieta' }); }
  });

  router.post('/workout-state', async (req, res) => {
    try {
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      if (!req.get('If-Match')) return res.status(428).json({ error: 'Atualize o treino antes de salvar' });
      const { activeGroupId, workoutDate, completedExercises, weights } = req.body;
      if (!WORKOUT_GROUPS.some(g => g.id === activeGroupId) || !/^\d{4}-\d{2}-\d{2}$/.test(workoutDate) ||
          !completedExercises || typeof completedExercises !== 'object' || !weights || typeof weights !== 'object') {
        return res.status(400).json({ error: 'Treino inválido' });
      }
      const fields = { active_group_id: activeGroupId, workout_date: workoutDate,
        completed_exercises: JSON.stringify(completedExercises), weights: JSON.stringify(weights), updated_at: new Date().toISOString() };
      const write = versionedWrite('workout_state', 1, fields, fields, expectedVersion(req.get('If-Match')));
      const [row] = await sql.query(write.query, write.parameters);
      if (!row) return res.status(409).json({ error: 'O treino mudou. Revise a alteração pendente.' });
      if (req.body.reopenWorkout === true) await reopen(sql, ['workout_group_summary', 'task_treino'], workoutDate);
      await syncSeededWorkoutCompletion(sql, workoutDate, activeGroupId, completedExercises);
      await recordCompletedOccurrences(sql, workoutDate);
      res.json({ success: true, workoutState: workoutFromRow(row) });
    } catch { res.status(503).json({ error: 'Não foi possível persistir o treino' }); }
  });

  router.post('/diet-state', async (req, res) => {
    try {
      const sql = getDb();
      if (!sql) return res.status(503).json({ error: 'Banco indisponível' });
      if (!req.get('If-Match')) return res.status(428).json({ error: 'Atualize a dieta antes de salvar' });
      const { dietDate, completedMeals, waterMl } = req.body;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dietDate) || !completedMeals || typeof completedMeals !== 'object' ||
          !Number.isFinite(waterMl) || waterMl < 0) return res.status(400).json({ error: 'Dieta inválida' });
      const fields = { diet_date: dietDate, completed_meals: JSON.stringify(completedMeals), water_ml: waterMl, updated_at: new Date().toISOString() };
      const write = versionedWrite('diet_state', 1, fields, fields, expectedVersion(req.get('If-Match')));
      const [row] = await sql.query(write.query, write.parameters);
      if (!row) return res.status(409).json({ error: 'A dieta mudou. Revise a alteração pendente.' });
      if (Array.isArray(req.body.reopenedMeals)) {
        const meals = req.body.reopenedMeals.filter((meal: unknown): meal is string => typeof meal === 'string' && completedMeals[meal] !== true);
        await reopen(sql, [...meals.map((meal: string) => `diet_${meal}`), ...Object.keys(linkedMeals).filter(id => meals.includes(linkedMeals[id]))], dietDate);
      }
      await syncSeededMealCompletions(sql, dietDate, completedMeals);
      await recordCompletedOccurrences(sql, dietDate);
      res.json({ success: true, dietState: dietFromRow(row) });
    } catch { res.status(503).json({ error: 'Não foi possível persistir a dieta' }); }
  });
}

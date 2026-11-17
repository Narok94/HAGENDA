import React from 'react';
import { useTaskSync } from '../hooks/useTaskSync';

const labels: Record<string, string> = { title: 'Título', notes: 'Notas', time: 'Horário', date: 'Data', priority: 'Prioridade',
  completed: 'Conclusão', completedDates: 'Dias concluídos', completedStudyDates: 'Dias de estudo', recurrence: 'Recorrência',
  recurrenceDay: 'Dia de recorrência', recurrenceDays: 'Dias da semana', dietDate: 'Dia da dieta', workoutDate: 'Dia do treino',
  completedMeals: 'Refeições', waterMl: 'Água (ml)', completedExercises: 'Exercícios', weights: 'Cargas', category: 'Categoria',
  activeGroupId: 'Grupo do treino', icon: 'Ícone', id: 'Identificador', exclusão: 'Exclusão' };
const valueAt = (value: any, path: string) => path.split('.').reduce((current, key) => current?.[key], value);
const display = (value: any) => value === undefined || value === null ? '(vazio)' : typeof value === 'boolean'
  ? value ? 'Sim' : 'Não' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export default function TaskSyncStatus() {
  const { pending, error, syncing, store, tasks, documents } = useTaskSync();
  if (!pending.length && !error) return null;
  return <aside role="status" aria-live="polite" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-[#0E1730]">
    {pending.length > 0 && <p className="font-semibold">{pending.length} alteração(ões) pendente(s). O servidor ainda não confirmou o salvamento.</p>}
    {error && <p>{error} <button className="underline" onClick={store.dismissError}>Fechar aviso</button></p>}
    {pending.map(change => <div key={change.id} className="mt-2">
      <strong>{change.title}</strong>{change.error && <p>{change.error}</p>}
      {change.conflict && <details><summary className="cursor-pointer">Conferir conflito antes de resolver</summary>
        {change.conflict.map(field => {
          const remote = change.resource === 'tasks' ? tasks.find(task => task.id === change.entityId) : documents[change.resource];
          return <p className="break-words" key={field}>
            {labels[field.split('.')[0]] || field}: servidor — {display(field === 'exclusão' ? remote?.title : valueAt(remote, field))};
            {' '}minha alteração — {display(field === 'exclusão' ? change.after?.title ?? 'Excluir' : valueAt(change.after, field))}.
          </p>;
        })}
        <p>Reaplicar usa sua alteração nos campos em conflito e preserva os demais.</p>
      </details>}
      <div className="flex flex-wrap gap-4">
        <button disabled={syncing} className="underline disabled:opacity-50" onClick={() => { void store.retry().catch(store.reportError); }}>Tentar novamente</button>
        {change.conflict && <>
          {!change.steps && !change.conflict.some(field => field === 'dietDate' || field === 'workoutDate' || field === 'activeGroupId') &&
            <button disabled={syncing} className="underline disabled:opacity-50" onClick={() => { void store.reapply(change.id).catch(store.reportError); }}>
              {change.conflict.includes('id') ? 'Criar cópia' : change.conflict.includes('exclusão') && change.after ? 'Recriar tarefa' : 'Reaplicar minha alteração'}
            </button>}
          <button disabled={syncing} className="underline disabled:opacity-50" onClick={() => store.discard(change.id)}>Descartar pendência</button>
        </>}
      </div>
    </div>)}
  </aside>;
}

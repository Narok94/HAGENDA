import type { Task } from '../types';

const TASK_CACHE_KEY = 'momentum_tasks';

export function isTaskList(value: unknown): value is Task[] {
  return Array.isArray(value) && value.every(task => task &&
    ['id', 'title', 'time', 'date', 'category', 'icon'].every(key => typeof task[key] === 'string') &&
    typeof task.completed === 'boolean' && typeof task.priority === 'boolean' &&
    ['recurrenceDays', 'completedDates'].every(key => task[key] === undefined ||
      (Array.isArray(task[key]) && task[key].every((item: unknown) => typeof item === 'string'))));
}

// Recover before the first render can persist state. Keep an unreadable cache intact
// until a valid server response supplies a replacement.
export function readTaskCache(storage?: Pick<Storage, 'getItem'>): { tasks: Task[]; recovered: boolean } {
  try {
    const saved = (storage ?? localStorage).getItem(TASK_CACHE_KEY);
    if (saved === null) return { tasks: [], recovered: true };
    const tasks: unknown = JSON.parse(saved);
    if (!isTaskList(tasks)) throw new Error('Cache de tarefas inválido');
    return { tasks, recovered: true };
  } catch (error) {
    console.error('Não foi possível recuperar o cache de tarefas:', error);
    return { tasks: [], recovered: false };
  }
}

export function writeTaskCache(tasks: Task[], storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    (storage ?? localStorage).setItem(TASK_CACHE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.error('Não foi possível salvar o cache de tarefas:', error);
    return false;
  }
}

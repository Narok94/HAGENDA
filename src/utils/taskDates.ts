import { Task } from '../types';

export const formatDateLocal = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isTaskOnDate = (task: Task, dateStr: string): boolean => {
  if (task.recurrence !== 'semanal' && task.date && task.date > dateStr) return false;

  if (!task.recurrence || task.recurrence === 'none') {
    return task.date === dateStr;
  }

  if (task.recurrence === 'semanal') {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay().toString(); // "0" para Domingo, "1" para Segunda, etc.
    
    if (task.recurrenceDays) {
      return task.recurrenceDays.includes(dayOfWeek);
    }
    return dayOfWeek === task.recurrenceDay;
  }

  if (task.recurrence === 'mensal') {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dayOfMonth = day.toString();
    return dayOfMonth === task.recurrenceDay;
  }

  return false;
};

export const isTaskCompletedOnDate = (task: Task, dateStr: string): boolean => {
  if (task.id === 'workout_group_summary' || task.id === 'study_daily_summary' || task.id.startsWith('diet_')) {
    return task.completed;
  }
  if (!task.recurrence || task.recurrence === 'none') {
    return task.completed;
  }
  return !!task.completedDates?.includes(dateStr);
};


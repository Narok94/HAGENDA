export interface Task {
  id: string;
  title: string;
  time: string;
  date: string;
  category: string;
  icon: string;
  completed: boolean;
  priority: boolean;
  notes?: string;
  recurrence?: 'none' | 'semanal' | 'mensal';
  recurrenceDay?: string; // "0"-"6" for Sunday-Saturday or "1"-"31" for monthly day
  completedDates?: string[]; // list of dates (YYYY-MM-DD) when this task was completed
}

export interface UserProfile {
  name: string;
  avatarUrl: string | null;
}

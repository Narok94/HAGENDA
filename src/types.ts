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
  recurrenceDay?: string; // "1"-"31" for monthly day
  recurrenceDays?: string[]; // ["0"-"6"] for multiple days of the week
  completedDates?: string[]; // list of dates (YYYY-MM-DD) when this task was completed
}

export interface UserProfile {
  name: string;
  avatarUrl: string | null;
}

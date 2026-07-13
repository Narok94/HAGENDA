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
}

export interface UserProfile {
  name: string;
  avatarUrl: string | null;
}

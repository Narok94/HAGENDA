export interface Task {
  id: string;
  title: string;
  time: string;
  category: string;
  icon: string;
  completed: boolean;
}

export interface UserProfile {
  name: string;
  avatarUrl: string | null;
}

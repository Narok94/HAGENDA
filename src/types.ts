export interface Item {
  id: string;
  title: string;
  date: string; // Format: YYYY-MM-DD
  time?: string; // Format: HH:mm (optional)
  category?: string; // ID of the category
  priority?: 'baixa' | 'média' | 'alta';
  note?: string;
  completed: boolean;
  recurring?: 'diario' | 'semanal' | 'mensal' | null;
}

export interface Category {
  id: string;
  name: string;
  color: string; // Hex color code (e.g. #FF5733)
  bgClass?: string; // Tailwind bg class if any (fallback)
}

export type ActiveTab = 'hoje' | 'semana' | 'mes' | 'painel';

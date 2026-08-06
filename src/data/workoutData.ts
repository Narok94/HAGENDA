export interface Exercise {
  id: string;
  name: string;
  series: number;
  reps: string;
  cargaDefault?: string;
  notes?: string;
}

export interface WorkoutGroup {
  id: 'A' | 'B' | 'C' | 'D' | 'E';
  title: string;
  subtitle: string;
  accentColor: string;
  exercises: Exercise[];
}

export const WORKOUT_GROUPS: WorkoutGroup[] = [
  {
    id: 'A',
    title: 'TREINO A',
    subtitle: 'Peito e Bíceps',
    accentColor: '#3B82F6',
    exercises: [
      { id: 'a1', name: 'Supino Reto (Barra)', series: 4, reps: '8 - 10' },
      { id: 'a2', name: 'Supino Inclinado (Halteres)', series: 3, reps: '10 - 12' },
      { id: 'a3', name: 'Supino Inclinado Máquina', series: 4, reps: '8' },
      { id: 'a4', name: 'Crucifixo na Máquina', series: 3, reps: '12 - 15' },
      { id: 'a5', name: 'Rosca Direta (Barra)', series: 3, reps: '10 - 12' },
      { id: 'a6', name: 'Rosca Alternada (Halteres)', series: 3, reps: '12', notes: 'CADA BRAÇO' },
      { id: 'a7', name: 'Rosca Martelo', series: 5, reps: '15' },
    ],
  },
  {
    id: 'B',
    title: 'TREINO B',
    subtitle: 'Quadríceps e Panturrilha',
    accentColor: '#F97316',
    exercises: [
      { id: 'b1', name: 'Agachamento Livre', series: 4, reps: '8 - 10' },
      { id: 'b2', name: 'Leg Press 45º', series: 3, reps: '12 - 15' },
      { id: 'b3', name: 'Cadeira Extensora', series: 3, reps: '12 - 15' },
      { id: 'b4', name: 'Afundo', series: 3, reps: '10', notes: 'CADA PERNA' },
      { id: 'b5', name: 'Panturrilha em Pé', series: 3, reps: '15 - 20' },
      { id: 'b6', name: 'Panturrilha Sentada', series: 3, reps: '15 - 20' },
    ],
  },
  {
    id: 'C',
    title: 'TREINO C',
    subtitle: 'Costas e Tríceps',
    accentColor: '#10B981',
    exercises: [
      { id: 'c1', name: 'Puxada Alta (Pulley Frente)', series: 4, reps: '10 - 12' },
      { id: 'c2', name: 'Remada Curvada (Barra)', series: 4, reps: '8 - 10' },
      { id: 'c3', name: 'Remada Sentada', series: 3, reps: '8 - 10' },
      { id: 'c4', name: 'Remada Cavalinho', series: 3, reps: '10 - 12' },
      { id: 'c5', name: 'Tríceps Testa (Barra W)', series: 3, reps: '10 - 12' },
      { id: 'c6', name: 'Tríceps Francês', series: 4, reps: '10' },
      { id: 'c7', name: 'Tríceps Pulley (Corda)', series: 3, reps: '12 - 15' },
    ],
  },
  {
    id: 'D',
    title: 'TREINO D',
    subtitle: 'Ombro, Panturrilha e Trapézio',
    accentColor: '#8B5CF6',
    exercises: [
      { id: 'd1', name: 'Elevação Frontal (Haltere)', series: 4, reps: '8 - 10' },
      { id: 'd2', name: 'Desenvolvimento (Haltere)', series: 4, reps: '12 - 15' },
      { id: 'd3', name: 'Elevação Lateral (Haltere)', series: 4, reps: '12 - 15' },
      { id: 'd4', name: 'Encolhimento de Ombros (Halteres)', series: 3, reps: '12 - 15' },
      { id: 'd5', name: 'Panturrilha em Pé', series: 4, reps: '15 - 20' },
      { id: 'd6', name: 'Abdominal Supra (Máquina)', series: 3, reps: '15 - 20' },
      { id: 'd7', name: 'Prancha Abdominal', series: 3, reps: '45 - 60s' },
    ],
  },
  {
    id: 'E',
    title: 'TREINO E',
    subtitle: 'Posterior de Perna, Glúteo e Cardio',
    accentColor: '#EC4899',
    exercises: [
      { id: 'e1', name: 'Stiff (Barra ou Halter)', series: 4, reps: '8 - 10', notes: 'Foco no alongamento do posterior' },
      { id: 'e2', name: 'Mesa Flexora', series: 3, reps: '12 - 15', notes: 'Contrair bem o posterior' },
      { id: 'e3', name: 'Cadeira Flexora', series: 4, reps: '10' },
      { id: 'e4', name: 'Elevação Pélvica (Hip Thrust)', series: 3, reps: '10 - 12', notes: 'Foco na contração máxima do glúteo' },
      { id: 'e5', name: 'Cadeira Abdutora', series: 3, reps: '15 - 20', notes: 'Para glúteo médio' },
      { id: 'e6', name: 'Cardio (Esteira/Bike)', series: 1, reps: '20 - 30 min', notes: 'Intensidade moderada a alta' },
    ],
  },
];

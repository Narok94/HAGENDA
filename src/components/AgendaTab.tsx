import React, { useState, useEffect, useRef } from 'react';
import { User, CheckCircle2, Circle, Flame, Sparkles, BookOpen, Coffee, Briefcase, ChevronRight, Plus, Clock, Tag, RefreshCw, Trash2, Mic, MicOff, Loader2, Send, X, BoxSelect, RotateCw, Check, Bell, Trophy, Cloud, CloudOff, Dumbbell, Apple, Utensils, GraduationCap, Laptop, Footprints, MoreVertical, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, useReducedMotion } from 'motion/react';
import { Task } from '../types';
import { formatDateLocal, isTaskOnDate, isTaskCompletedOnDate } from '../utils/taskDates';
import { WORKOUT_GROUPS } from '../data/workoutData';
import { MEAL_PLAN } from '../data/dietData';
import { getIcon } from '../utils/icons';
import TaskModal from './TaskModal';
import ProgressRing from './ProgressRing';

const CATEGORY_META: Record<string, { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>; accent: string }> = {
  Estudo: { icon: BookOpen, accent: '#0EA5E9' },
  Academia: { icon: Dumbbell, accent: '#F97316' },
  Dieta: { icon: Apple, accent: '#22C55E' },
  Trabalho: { icon: Briefcase, accent: '#A855F7' },
};

const CATEGORIES_LIST = ['Estudo', 'Academia', 'Dieta', 'Trabalho'];

const getCategoryColor = (category: string): string => {
  const name = category.trim().toLowerCase();
  if (name === 'saúde' || name === 'saude') return '#0BAD77';
  if (name === 'academia' || name === 'estudo') return '#7952E8';
  if (name === 'dieta') return '#2879F3';
  if (name === 'trabalho') return '#F47716';
  return '#6C5CE7';
};

// Presentation only: retain each saved icon and provide icons for integrated routines.
const agendaIcon = (task: Task, size = 20) => {
  if (task.icon === 'Apple' || task.category.toLowerCase() === 'dieta') {
    return /café|cafe|lanche da manhã/i.test(task.title) ? <Coffee size={size} /> : <Utensils size={size} />;
  }
  if (/cardio/i.test(task.title)) return <Footprints size={size} />;
  if (task.category.toLowerCase() === 'estudo') return <GraduationCap size={size} />;
  if (task.category.toLowerCase() === 'trabalho' && task.icon === 'Briefcase') return <Laptop size={size} />;
  return getIcon(task.icon, size);
};

interface TaskRowItemProps {
  task: Task;
  targetDate: string;
  isCompleted: boolean;
  isNext?: boolean;
  isOverdue?: boolean;
  onToggle: () => void;
  onPostpone: () => void;
  onOpenDetails: () => void;
  key?: string;
}

function TaskRowItem({ task, isCompleted, isNext, isOverdue, onToggle, onPostpone, onOpenDetails }: TaskRowItemProps) {
  const x = useMotionValue(0);
  const wasDragged = useRef(false);
  const reduceMotion = useReducedMotion();
  const isDailyRoutine = task.id.startsWith('diet_') || task.id === 'study_daily_summary';
  const recurrenceLabel = isDailyRoutine ? 'Todos os dias' : task.recurrence === 'mensal' ? 'Mensal' : (() => {
    if (!task.recurrenceDays?.length) return 'Semanal';
    if (task.recurrenceDays.length === 7) return 'Todos os dias';
    if (task.recurrenceDays.length === 5 && ['1','2','3','4','5'].every(d => task.recurrenceDays!.includes(d))) return 'Dias úteis';
    const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return task.recurrenceDays.map(d => names[Number(d)]).join(', ');
  })();
  return (
    <motion.div layout={!reduceMotion} drag="x" style={{ x, '--agenda-category': getCategoryColor(task.category) } as React.CSSProperties}
      dragConstraints={{ left: 0, right: 0 }} dragElastic={0.35}
      onPointerDownCapture={() => { wasDragged.current = false; }}
      onDragStart={() => { wasDragged.current = true; }}
      onClickCapture={event => {
        if (wasDragged.current && event.detail > 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onDragEnd={(_, info) => { if (info.offset.x > 100) onToggle(); else if (info.offset.x < -100) onPostpone(); }}
      className={`reference-task ${isCompleted ? 'is-complete' : ''} ${isNext ? 'is-next' : ''} ${isOverdue ? 'is-overdue' : ''}`}>
      <button role="checkbox" aria-checked={isCompleted} aria-label={`${isCompleted ? 'Reabrir' : 'Concluir'} ${task.title}`} onClick={onToggle} className="reference-checkbox">{isCompleted && <Check size={14} strokeWidth={3} />}</button>
      <button onClick={onOpenDetails} className="reference-task-symbol" aria-label={`Abrir ${task.title}`}>{agendaIcon(task, 23)}</button>
      <button onClick={onOpenDetails} className="reference-task-content">
        <span className="reference-task-title">{task.title}{task.priority && !isCompleted && <Flame size={11} aria-label="Prioridade alta" />}</span>
        <span className="reference-task-meta"><span className={isOverdue ? 'reference-overdue-time' : undefined}><Clock size={10} />{task.time}</span><span className="reference-category"><Tag size={10} />{task.category}</span>
          {isOverdue && <span className="reference-overdue-label">Atrasada</span>}
          {((task.recurrence && task.recurrence !== 'none') || isDailyRoutine) && <span><RefreshCw size={10} />{recurrenceLabel}</span>}
        </span>
      </button>
      <button className="reference-task-menu" aria-label={`Opções de ${task.title}`} onClick={onOpenDetails}><MoreVertical size={17} /></button>
    </motion.div>
  );
}

export interface AgendaHomeAction {
  taskId: string;
  action: 'complete' | 'details' | 'toggle' | 'create';
  date?: string;
}

interface AgendaTabProps {
  userName: string;
  avatarUrl: string | null;
  openNewTaskTrigger?: number;
  onTodayTasksChange?: (tasks: Task[] | null) => void;
  onCalendarTasksChange?: (tasks: Task[] | null) => void;
  homeAction?: AgendaHomeAction | null;
}

const getTodayStr = () => {
  return formatDateLocal(new Date());
};

const getEndOfWeekStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return formatDateLocal(d);
};

const getNext7Days = (startDateStr: string): string[] => {
  const dates: string[] = [];
  const [year, month, day] = startDateStr.split('-').map(Number);
  for (let i = 0; i < 7; i++) {
    const d = new Date(year, month - 1, day + i);
    dates.push(formatDateLocal(d));
  }
  return dates;
};

const getMonthDays = (startDateStr: string): string[] => {
  const [year, month] = startDateStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const dayStr = i.toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    dates.push(`${year}-${monthStr}-${dayStr}`);
  }
  return dates;
};

const getTaskTargetDateForFilter = (task: Task, filter: 'hoje' | 'semana' | 'mes', todayStr: string): string => {
  if (filter === 'hoje') return todayStr;
  if (!task.recurrence || task.recurrence === 'none') return task.date;
  
  if (filter === 'semana') {
    const dates = getNext7Days(todayStr);
    const activeDate = dates.find(d => isTaskOnDate(task, d));
    return activeDate || todayStr;
  }
  
  if (filter === 'mes') {
    const dates = getMonthDays(todayStr);
    const activeDate = dates.find(d => isTaskOnDate(task, d));
    return activeDate || todayStr;
  }
  
  return todayStr;
};

export default function AgendaTab({ userName, avatarUrl, openNewTaskTrigger, onTodayTasksChange, onCalendarTasksChange, homeAction }: AgendaTabProps) {
  const [now, setNow] = useState(() => new Date());
  const reduceMotion = useReducedMotion();
  const todayStr = formatDateLocal(now);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  
  const handledHomeAction = useRef<AgendaHomeAction | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; mode: string }>({ connected: false, mode: 'loading' });

  useEffect(() => {
    if (openNewTaskTrigger && openNewTaskTrigger > 0) {
      openCreateModal();
    }
  }, [openNewTaskTrigger]);

  // Workout, Diet & Study states for virtual task synthesis
  const [todayCompletedExercises, setTodayCompletedExercises] = useState<Record<string, boolean>>({});
  const [activeGroupId, setActiveGroupId] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');
  const [workoutWeights, setWorkoutWeights] = useState<Record<string, string>>({});
  const [completedMeals, setCompletedMeals] = useState<Record<string, boolean>>({});
  const [waterIntakeMl, setWaterIntakeMl] = useState<number>(0);
  const [completedStudyDates, setCompletedStudyDates] = useState<string[]>([]);

  const fetchWorkoutState = async () => {
    try {
      const res = await fetch('/api/workout-state');
      if (!res.ok) return;
      const data = await res.json();
      setActiveGroupId((data.activeGroupId as 'A' | 'B' | 'C' | 'D' | 'E') || 'A');
      if (data.workoutDate === todayStr) {
        setTodayCompletedExercises(data.completedExercises || {});
      } else {
        setTodayCompletedExercises({});
      }
      setWorkoutWeights(data.weights || {});
    } catch (e) {
      console.error('Erro ao buscar workout state em AgendaTab:', e);
    }
  };

  const fetchDietState = async () => {
    try {
      const res = await fetch('/api/diet-state');
      if (!res.ok) return;
      const data = await res.json();
      if (data.dietDate === todayStr) {
        setCompletedMeals(data.completedMeals || {});
        setWaterIntakeMl(Number(data.waterMl) || 0);
      } else {
        setCompletedMeals({});
        setWaterIntakeMl(0);
      }
    } catch (e) {
      console.error('Erro ao buscar diet state em AgendaTab:', e);
    }
  };

  const fetchSettingsState = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      if (data.completedStudyDates && Array.isArray(data.completedStudyDates)) {
        setCompletedStudyDates(data.completedStudyDates);
      }
    } catch (e) {
      console.error('Erro ao buscar settings em AgendaTab:', e);
    }
  };

  useEffect(() => {
    fetchWorkoutState();
    fetchDietState();
    fetchSettingsState();
  }, [todayStr]);

  // Listen for workout/diet sync events across tabs/components
  useEffect(() => {
    const handleWorkoutSync = () => fetchWorkoutState();
    const handleDietSync = () => fetchDietState();

    window.addEventListener('momentum_workout_update', handleWorkoutSync);
    window.addEventListener('momentum_diet_update', handleDietSync);

    return () => {
      window.removeEventListener('momentum_workout_update', handleWorkoutSync);
      window.removeEventListener('momentum_diet_update', handleDietSync);
    };
  }, [todayStr]);

  // Single virtual task for today's workout ("Academia") with flexible time
  const workoutVirtualTasks: Task[] = React.useMemo(() => {
    const hasCustomWorkoutTask = tasks.some(t =>
      (t.category?.toLowerCase() === 'academia' || t.title.toLowerCase().includes('treino') || t.title.toLowerCase().includes('cardio')) && isTaskOnDate(t, todayStr)
    );
    if (hasCustomWorkoutTask) {
      return [];
    }

    const activeGroup = WORKOUT_GROUPS.find(g => g.id === activeGroupId) || WORKOUT_GROUPS[0];
    const isAllCompleted = activeGroup.exercises.length > 0 && activeGroup.exercises.every(ex => !!todayCompletedExercises[ex.id]);

    return [{
      id: 'workout_group_summary',
      title: 'Academia',
      date: todayStr,
      time: 'Horário flexível',
      category: 'Academia',
      icon: 'Dumbbell',
      priority: false,
      completed: isAllCompleted,
      notes: `Treino ${activeGroup.id}: ${activeGroup.subtitle} (${activeGroup.exercises.length} exercícios)`
    }];
  }, [activeGroupId, todayCompletedExercises, todayStr, tasks]);

  // Single virtual task for today's study ("Estudo") with flexible time
  const studyVirtualTasks: Task[] = React.useMemo(() => {
    const hasCustomStudyTask = tasks.some(t =>
      t.category?.toLowerCase() === 'estudo' && isTaskOnDate(t, todayStr)
    );

    if (hasCustomStudyTask) {
      return [];
    }

    const isCompleted = completedStudyDates.includes(todayStr);

    return [{
      id: 'study_daily_summary',
      title: 'Estudo',
      date: todayStr,
      time: 'Horário flexível',
      category: 'Estudo',
      icon: 'BookOpen',
      priority: false,
      completed: isCompleted,
      notes: 'Sessão diária de estudos'
    }];
  }, [tasks, completedStudyDates, todayStr]);

  const dietVirtualTasks: Task[] = React.useMemo(() => {
    return MEAL_PLAN.map(meal => {
      const hasCustom = tasks.some(t =>
        (t.title.toLowerCase().trim() === meal.title.toLowerCase().trim() ||
         (t.category?.toLowerCase() === 'dieta' && t.time === meal.time)) && isTaskOnDate(t, todayStr)
      );
      if (hasCustom) return null;

      return {
        id: `diet_${meal.id}`,
        title: meal.title,
        date: todayStr,
        time: meal.time,
        category: 'Dieta',
        icon: 'Apple',
        priority: false,
        completed: !!completedMeals[meal.id],
        notes: meal.options[0]?.items?.slice(0, 2).join(', ') || '',
      };
    }).filter(Boolean) as Task[];
  }, [completedMeals, todayStr, tasks]);

  // Combined tasks list (Custom tasks + Workout + Study + Diet)
  const allCombinedTasks = React.useMemo(() => {
    const customTasksFiltered = tasks.filter(t => !t.id.startsWith('workout_') && t.id !== 'workout_group_summary');
    return [...customTasksFiltered, ...workoutVirtualTasks, ...studyVirtualTasks, ...dietVirtualTasks];
  }, [tasks, workoutVirtualTasks, studyVirtualTasks, dietVirtualTasks]);

  const checkDbStatus = async () => {
    try {
      const res = await fetch('/api/db-status');
      if (res.ok) {
        const status = await res.json();
        setDbStatus(status);
      } else {
        setDbStatus({ connected: false, mode: 'error' });
      }
    } catch (error) {
      console.error('Erro ao verificar conexão do banco:', error);
      setDbStatus({ connected: false, mode: 'offline' });
    }
  };

  // Synchronize tasks state with DB and local state
  const syncTaskToDb = async (task: Task, strict = false) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
      if (!response.ok) throw new Error('Não foi possível salvar a tarefa no servidor');
    } catch (error) {
      console.error('Erro ao sincronizar tarefa com o banco:', error);
      if (strict) throw error;
    }
  };

  const syncDeleteToDb = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Erro ao excluir tarefa do banco:', error);
    }
  };

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const res = await fetch('/api/tasks');
        if (res.ok) {
          const data = await res.json();
          setTasks(data);
        } else {
          throw new Error('Falha ao obter dados do banco');
        }
      } catch (error) {
        console.error('Erro ao carregar tarefas do banco:', error);
        const saved = localStorage.getItem('momentum_tasks');
        if (saved) setTasks(JSON.parse(saved));
      } finally {
        setTasksLoaded(true);
      }
    };
    loadTasks();
    checkDbStatus();
  }, []);

  const [viewFilter, setViewFilter] = useState<'hoje' | 'semana' | 'mes'>('hoje');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // AI & Voice State
  const [aiInput, setAiInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  
  // MediaRecorder Ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Coach Inspiration State
  const [inspiration, setInspiration] = useState(() => {
    return localStorage.getItem('momentum_coach_quote') || 'A disciplina é a ponte entre metas e realizações.';
  });
  const [loadingInspiration, setLoadingInspiration] = useState(false);

  // Undo Delete State
  const [undoDeleteState, setUndoDeleteState] = useState<{ task: Task | null, timeoutId: NodeJS.Timeout | null }>({ task: null, timeoutId: null });

  // Postpone State
  const [postponeTask, setPostponeTask] = useState<Task | null>(null);

  // Helper to trigger UI refresh
  const [forceRender, setForceRender] = useState(0);

  const handleFabClick = () => {
    openCreateModal();
  };

  const handleAssistantClick = () => {
    setIsAssistantOpen(true);
    setVoiceError('');
  };

  // Parse Text with IA (POST to backend)
  const handleParseAiTask = async (textToParse: string) => {
    const textClean = textToParse || aiInput;
    if (!textClean.trim()) return;

    setIsParsing(true);
    try {
      const response = await fetch('/api/parse-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textClean, currentDate: todayStr })
      });

      if (!response.ok) throw new Error('Falha no servidor');
      const parsed = await response.json();

      const newTask: Task = {
        id: Date.now().toString(),
        title: parsed.title || textClean,
        date: parsed.date || todayStr,
        time: parsed.time || '12:00',
        category: parsed.category || 'Geral',
        icon: parsed.icon || 'Circle',
        priority: parsed.priority || false,
        completed: false,
        notes: parsed.notes || '',
        recurrence: parsed.recurrence || 'none',
        recurrenceDay: parsed.recurrenceDay,
        recurrenceDays: parsed.recurrenceDays,
      };

      setTasks(prev => [...prev, newTask]);
      syncTaskToDb(newTask);
      setAiInput('');
      setIsAssistantOpen(false);
    } catch (error) {
      console.error('Erro ao analisar tarefa com IA:', error);
    } finally {
      setIsParsing(false);
    }
  };

  // Voice recognition via MediaRecorder and Backend
  const startRecording = async () => {
    setVoiceError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        // Clean up tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result?.toString().split(',')[1];
          if (!base64Audio) return;
          
          setIsParsing(true);
          try {
            const response = await fetch('/api/transcribe-task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                audio: base64Audio, 
                currentDate: todayStr,
                mimeType: audioBlob.type
              })
            });

            if (!response.ok) throw new Error('Falha na transcrição');
            const parsed = await response.json();

            const newTask: Task = {
              id: Date.now().toString(),
              title: parsed.title || 'Tarefa de áudio não compreendida',
              date: parsed.date || todayStr,
              time: parsed.time || '12:00',
              category: parsed.category || 'Geral',
              icon: parsed.icon || 'Circle',
              priority: parsed.priority || false,
              completed: false,
              notes: parsed.notes || '',
              recurrence: parsed.recurrence || 'none',
              recurrenceDay: parsed.recurrenceDay,
              recurrenceDays: parsed.recurrenceDays,
            };

            setTasks(prev => [...prev, newTask]);
            syncTaskToDb(newTask);
            setIsAssistantOpen(false);
          } catch (error) {
            console.error('Erro ao transcrever:', error);
            setVoiceError('Erro ao transcrever o áudio.');
          } finally {
            setIsParsing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error('Erro de permissão de microfone', err);
      setVoiceError('Permissão de microfone negada ou indisponível.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  // Fetch Coach inspiration phrase
  const fetchInspiration = async (forceUpdate = false) => {
    const cachedDate = localStorage.getItem('momentum_coach_date');
    if (!forceUpdate && cachedDate === todayStr) {
      return; // Already generated today
    }

    setLoadingInspiration(true);
    try {
      const todayTasks = tasks.filter(t => isTaskOnDate(t, todayStr));
      const response = await fetch('/api/generate-inspiration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: todayTasks, userName })
      });
      if (!response.ok) throw new Error(`Erro do servidor: ${response.status}`);
      const data = await response.json();
      if (data.text) {
        setInspiration(data.text);
        localStorage.setItem('momentum_coach_quote', data.text);
        localStorage.setItem('momentum_coach_date', todayStr);
      }
    } catch (err) {
      console.error('Erro ao gerar inspiração:', err);
    } finally {
      setLoadingInspiration(false);
    }
  };

  // Fetch inspiration quote on mount
  useEffect(() => {
    fetchInspiration();
  }, [userName]);

  useEffect(() => {
    localStorage.setItem('momentum_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const toggleTaskOnDate = (id: string, dateStr: string) => {
    const updatedTasks = tasks.map(t => {
      if (t.id !== id) return t;
      let updated: Task;
      if (!t.recurrence || t.recurrence === 'none') {
        updated = { ...t, completed: !t.completed };
      } else {
        const completedDates = t.completedDates || [];
        const exists = completedDates.includes(dateStr);
        const newCompletedDates = exists 
          ? completedDates.filter(d => d !== dateStr) 
          : [...completedDates, dateStr];
        updated = { ...t, completedDates: newCompletedDates };
      }
      syncTaskToDb(updated);
      return updated;
    });
    setTasks(updatedTasks);
  };

  const handleSaveTask = async (task: Task) => {
    await syncTaskToDb(task, true);
    setTasks(current => [...current.filter(t => t.id !== task.id), task]);
  };

  const handleDeleteTask = (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    if (undoDeleteState.timeoutId) {
      clearTimeout(undoDeleteState.timeoutId);
    }

    setTasks(tasks.filter(t => t.id !== id));
    syncDeleteToDb(id);
    closeModal();

    const timeoutId = setTimeout(() => {
      setUndoDeleteState({ task: null, timeoutId: null });
    }, 5000);

    setUndoDeleteState({ task: taskToDelete, timeoutId });
  };

  const handleUndoDelete = () => {
    if (undoDeleteState.task) {
      setTasks([...tasks, undoDeleteState.task]);
      syncTaskToDb(undoDeleteState.task);
    }
    if (undoDeleteState.timeoutId) {
      clearTimeout(undoDeleteState.timeoutId);
    }
    setUndoDeleteState({ task: null, timeoutId: null });
  };

  const handlePostpone = (days: number) => {
    if (!postponeTask) return;
    const task = postponeTask;
    
    // Calcula a nova data
    const newDate = new Date(todayStr);
    newDate.setDate(newDate.getDate() + days);
    const newDateStr = newDate.toISOString().split('T')[0];

    if (!task.recurrence || task.recurrence === 'none') {
      const updated = { ...task, date: newDateStr };
      setTasks(tasks.map(t => t.id === task.id ? updated : t));
      syncTaskToDb(updated);
    } else {
      // Se for recorrente, esconde hoje adicionando aos completedDates
      const completedDates = task.completedDates || [];
      const updatedTask = { ...task, completedDates: [...completedDates, todayStr] };
      // Cria uma nova tarefa apenas para a nova data, não recorrente
      const newTask: Task = { ...task, id: Date.now().toString(), date: newDateStr, recurrence: 'none', completedDates: [] };
      setTasks([...tasks.filter(t => t.id !== task.id), updatedTask, newTask]);
      syncTaskToDb(updatedTask);
      syncTaskToDb(newTask);
    }
    setPostponeTask(null);
  };

  const openCreateModal = () => {
    setSelectedTask(null);
    setIsCreating(true);
    setIsModalOpen(true);
  };

  const openTaskDetails = (task: Task) => {
    setSelectedTask(task);
    setIsCreating(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedTask(null);
      setIsCreating(false);
    }, 200); // Wait for exit animation
  };

  const openedPushActivity = useRef(false);
  useEffect(() => {
    if (!tasksLoaded || openedPushActivity.current) return;
    const params = new URLSearchParams(location.search);
    const id = params.get('activity');
    const task = allCombinedTasks.find(t => t.id === id);
    if (task) { openedPushActivity.current = true; openTaskDetails(task); }
  }, [tasksLoaded, allCombinedTasks]);

  useEffect(() => {
    const refresh = () => {
      fetch('/api/tasks').then(r => r.ok ? r.json() : null).then(data => { if (data) setTasks(data); }).catch(() => {});
      fetchWorkoutState(); fetchDietState(); fetchSettingsState();
    };
    const message = (event: MessageEvent) => { if (event.data?.type === 'reminder-updated') refresh(); };
    navigator.serviceWorker?.addEventListener('message', message);
    window.addEventListener('focus', refresh);
    return () => { navigator.serviceWorker?.removeEventListener('message', message); window.removeEventListener('focus', refresh); };
  }, [todayStr]);

  const handleToggleTask = (task: Task) => {
    if (task.id === 'workout_group_summary' || task.id.startsWith('workout_')) {
      const activeGroup = WORKOUT_GROUPS.find(g => g.id === activeGroupId) || WORKOUT_GROUPS[0];
      const isCurrentlyAllCompleted = activeGroup.exercises.length > 0 && activeGroup.exercises.every(ex => !!todayCompletedExercises[ex.id]);
      const newCompletedState = !isCurrentlyAllCompleted;

      const updated: Record<string, boolean> = { ...todayCompletedExercises };
      activeGroup.exercises.forEach(ex => {
        updated[ex.id] = newCompletedState;
      });
      setTodayCompletedExercises(updated);

      fetch('/api/workout-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeGroupId,
          workoutDate: todayStr,
          completedExercises: updated,
          weights: workoutWeights
        })
      }).then(() => {
        window.dispatchEvent(new Event('momentum_workout_update'));
      }).catch(err => console.error(err));
      return;
    }

    if (task.id === 'study_daily_summary') {
      const isCompleted = completedStudyDates.includes(todayStr);
      const newDates = isCompleted
        ? completedStudyDates.filter(d => d !== todayStr)
        : [...completedStudyDates, todayStr];

      setCompletedStudyDates(newDates);

      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedStudyDates: newDates
        })
      }).catch(err => console.error(err));
      return;
    }

    if (task.id.startsWith('diet_')) {
      const mealId = task.id.replace('diet_', '');
      const updated = {
        ...completedMeals,
        [mealId]: !completedMeals[mealId]
      };
      setCompletedMeals(updated);
      fetch('/api/diet-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dietDate: todayStr,
          completedMeals: updated,
          waterMl: waterIntakeMl
        })
      }).then(() => {
        window.dispatchEvent(new Event('momentum_diet_update'));
      }).catch(err => console.error(err));
      return;
    }

    toggleTaskOnDate(task.id, getTaskTargetDateForFilter(task, viewFilter, todayStr));
  };

  // Filtering Logic using allCombinedTasks (custom + academia + estudo + dieta)
  const filteredTasks = allCombinedTasks.filter(task => {
    if (activeCategory && task.category.toLowerCase() !== activeCategory.toLowerCase()) {
      return false;
    }
    if (viewFilter === 'hoje') return isTaskOnDate(task, todayStr);
    if (viewFilter === 'semana') {
      const dates = getNext7Days(todayStr);
      return dates.some(d => isTaskOnDate(task, d));
    }
    if (viewFilter === 'mes') {
      const dates = getMonthDays(todayStr);
      return dates.some(d => isTaskOnDate(task, d));
    }
    return true;
  }).sort((a, b) => {
    const isAFlex = a.time === 'Horário flexível' || a.time === 'Flexível';
    const isBFlex = b.time === 'Horário flexível' || b.time === 'Flexível';
    if (isAFlex && !isBFlex) return 1;
    if (!isAFlex && isBFlex) return -1;
    return a.time.localeCompare(b.time);
  });

  const uncompletedTodayTasksList = allCombinedTasks.filter(t => isTaskOnDate(t, todayStr) && !isTaskCompletedOnDate(t, todayStr));
  const todayTasksList = allCombinedTasks.filter(t => isTaskOnDate(t, todayStr));
  const isTodayFullyCompleted = todayTasksList.length > 0 && uncompletedTodayTasksList.length === 0;

  const nowHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const hasScheduledTime = (task: Task) => /^\d{2}:\d{2}$/.test(task.time);
  const pendingByTime = [...uncompletedTodayTasksList].sort((a, b) =>
    Number(!hasScheduledTime(a)) - Number(!hasScheduledTime(b)) || a.time.localeCompare(b.time)
  );
  const overdueTasks = allCombinedTasks.filter(task =>
    !isTaskCompletedOnDate(task, todayStr) && (
      (isTaskOnDate(task, todayStr) && hasScheduledTime(task) && task.time < nowHourMin) ||
      ((!task.recurrence || task.recurrence === 'none') && task.date < todayStr)
    )
  ).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const priorityTask = pendingByTime.find(task => hasScheduledTime(task) && task.time >= nowHourMin)
    || pendingByTime.find(task => !hasScheduledTime(task)) || null;
  // The highlight always represents today's occurrence, independently of the list filter.
  const completeTodayTask = (task: Task) => {
    if (tasks.some(saved => saved.id === task.id)) toggleTaskOnDate(task.id, todayStr);
    else handleToggleTask(task);
  };

  const todayCompletedCount = todayTasksList.length - uncompletedTodayTasksList.length;
  const todayProgress = todayTasksList.length ? Math.round(todayCompletedCount / todayTasksList.length * 100) : 0;
  // The three summary groups partition today's occurrences: a late task is
  // counted only in Atrasadas, and completion always wins over its scheduled time.
  const todayOverdueCount = uncompletedTodayTasksList.filter(task => hasScheduledTime(task) && task.time < nowHourMin).length;
  const todayPendingCount = uncompletedTodayTasksList.length - todayOverdueCount;
  const nextTimeLabel = (() => {
    if (!priorityTask || !hasScheduledTime(priorityTask)) return 'Horário flexível';
    const [hour, minute] = priorityTask.time.split(':').map(Number);
    const remaining = hour * 60 + minute - (now.getHours() * 60 + now.getMinutes());
    if (remaining < 0) return 'Horário passou';
    if (remaining === 0) return 'Agora';
    return `em ${remaining >= 60 ? `${Math.floor(remaining / 60)}h ` : ''}${remaining % 60}min`;
  })();

  // Navigation actions reuse the existing form and persistence handlers.
  useEffect(() => {
    if (!homeAction || handledHomeAction.current === homeAction) return;
    if (homeAction.action === 'create') {
      handledHomeAction.current = homeAction;
      openCreateModal();
      setSelectedTask({ id: '', title: '', date: homeAction.date || todayStr, time: '12:00', category: '', icon: 'Circle', completed: false, priority: false });
      return;
    }
    const date = homeAction.date || todayStr;
    const task = allCombinedTasks.find(item => item.id === homeAction.taskId && isTaskOnDate(item, date));
    if (!task) return;
    handledHomeAction.current = homeAction;
    if (homeAction.action === 'details') openTaskDetails(task);
    else if (homeAction.action === 'toggle' || !isTaskCompletedOnDate(task, date)) {
      if (tasks.some(saved => saved.id === task.id)) toggleTaskOnDate(task.id, date);
      else if (date === todayStr) handleToggleTask(task);
    }
  }, [homeAction, allCombinedTasks, todayStr]);

  // Share a read-only view of the exact occurrences used by the Agenda.
  // Keeping Agenda mounted preserves its existing editing and persistence flows.
  const homeTodayTasks = React.useMemo(() => tasksLoaded
    ? allCombinedTasks.filter(task => isTaskOnDate(task, todayStr)).map(task => ({ ...task, completed: isTaskCompletedOnDate(task, todayStr) }))
    : null, [allCombinedTasks, todayStr, tasksLoaded]);
  useEffect(() => { onTodayTasksChange?.(homeTodayTasks); }, [homeTodayTasks, onTodayTasksChange]);

  useEffect(() => { onCalendarTasksChange?.(tasksLoaded ? allCombinedTasks : null); }, [tasksLoaded, allCombinedTasks, onCalendarTasksChange]);

  // Tasks list (includes all tasks for viewFilter so next upcoming task appears both at the top card and in the list below)
  const finalFilteredTasks = filteredTasks;

  // Group tasks by date for "semana" and "mes" views
  const groupedTasks = React.useMemo(() => {
    if (viewFilter === 'hoje') {
      return [{ date: todayStr, tasks: finalFilteredTasks }];
    }
    const groups: Record<string, Task[]> = {};
    finalFilteredTasks.forEach(task => {
      const targetDate = getTaskTargetDateForFilter(task, viewFilter, todayStr);
      if (!groups[targetDate]) {
        groups[targetDate] = [];
      }
      groups[targetDate].push(task);
    });
    
    return Object.keys(groups).sort().map(date => ({
      date,
      tasks: groups[date]
    }));
  }, [finalFilteredTasks, viewFilter, todayStr]);

  const completedCount = finalFilteredTasks.filter(t => {
    const targetDate = getTaskTargetDateForFilter(t, viewFilter, todayStr);
    return isTaskCompletedOnDate(t, targetDate);
  }).length;
  const progressPercentage = finalFilteredTasks.length === 0 ? 0 : Math.round((completedCount / finalFilteredTasks.length) * 100);

  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
  const todayFormatted = new Date().toLocaleDateString('pt-BR', dateOptions);
  const dateDisplay = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  // Dynamic Header Info Box: "3 tarefas hoje" or "Próxima tarefa às 09:00"
  const uncompletedTodayTasks = allCombinedTasks.filter(t => isTaskOnDate(t, todayStr) && !isTaskCompletedOnDate(t, todayStr));
  const nextUncompletedTask = uncompletedTodayTasks.sort((a, b) => a.time.localeCompare(b.time))[0];

  let headerSubtitle = '';
  if (nextUncompletedTask) {
    const isFlex = nextUncompletedTask.time === 'Horário flexível' || nextUncompletedTask.time === 'Flexível';
    if (isFlex) {
      headerSubtitle = `• Próxima tarefa: ${nextUncompletedTask.title} (horário flexível)`;
    } else {
      headerSubtitle = `• Próxima tarefa às ${nextUncompletedTask.time}`;
    }
  } else {
    const count = allCombinedTasks.filter(t => isTaskOnDate(t, todayStr)).length;
    headerSubtitle = `• ${count} ${count === 1 ? 'tarefa' : 'tarefas'} hoje`;
  }

  return (
    <div className="reference-agenda">
      <AnimatePresence>
        {isAssistantOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssistantOpen(false)}
              className="absolute inset-0 bg-[#0E1730]/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-[22px] p-5 border border-[#E3E8F1] shadow-2xl overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-32 h-32 bg-[#2F5CFF]/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#0E1730]">
                  <Sparkles size={16} className="text-[#2F5CFF] animate-pulse" />
                  <span>Criar Tarefa por IA (NLP & Voz)</span>
                </div>
                <button onClick={() => setIsAssistantOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F3F5FA] hover:bg-[#E3E8F1] text-[#69708A] transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>
              
              <div className="flex gap-2.5 items-center">
                <div className="flex-1 relative flex items-center bg-[#F3F5FA] rounded-[16px] border border-[#E3E8F1] focus-within:border-[#2F5CFF]/50 transition-all">
                  <input 
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleParseAiTask(aiInput);
                      }
                    }}
                    placeholder="Ex: Treino hoje às 18h..."
                    disabled={isParsing || isListening}
                    className="w-full bg-transparent px-4 py-3.5 pr-12 text-sm text-[#0E1730] placeholder-[#9AA1B8] outline-none disabled:opacity-50"
                  />
                  <div className="absolute right-2 flex items-center">
                    {isParsing ? (
                      <Loader2 size={18} className="text-[#2F5CFF] animate-spin mr-1" />
                    ) : (
                      <button
                        onClick={() => handleParseAiTask(aiInput)}
                        disabled={!aiInput.trim() || isListening}
                        className="w-9 h-9 flex items-center justify-center rounded-[10px] text-[#2F5CFF] hover:bg-[#E3E8F1] disabled:opacity-30 transition-all cursor-pointer"
                      >
                        <Send size={16} />
                      </button>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={isListening ? stopRecording : startRecording}
                  type="button"
                  className={`w-[48px] h-[48px] rounded-[16px] flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                    isListening 
                      ? 'bg-[#FF5252] text-white animate-pulse shadow-[0_0_12px_rgba(255,82,82,0.4)]' 
                      : 'bg-[#2F5CFF]/10 border border-[#2F5CFF]/20 text-[#2F5CFF] hover:bg-[#2F5CFF]/15'
                  }`}
                  title={isListening ? "Ouvindo... Toque para parar" : "Falar comando de voz"}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              </div>
              {isListening && (
                <p className="text-[11px] text-[#FF5252] font-semibold animate-pulse mt-3 text-center">
                  🎙️ Ouvindo sua voz em tempo real...
                </p>
              )}
              {voiceError && (
                <p className="text-[11px] text-[#FF5252] font-semibold mt-3 text-center">
                  {voiceError}
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="reference-highlight" aria-label="Próxima tarefa">
        <div className="reference-highlight-top"><span><Flame size={17} fill="currentColor" />{isTodayFullyCompleted ? 'DIA CONCLUÍDO' : 'PRÓXIMA TAREFA RELEVANTE'}</span>{priorityTask && <span className="reference-time-badge">{nextTimeLabel}</span>}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={priorityTask?.id || 'empty'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.15 }} className="reference-highlight-body" aria-live="polite">
            <div className="reference-highlight-icon">{priorityTask ? agendaIcon(priorityTask, 27) : <CheckCircle2 size={27} />}</div>
            <button className="reference-highlight-copy" onClick={() => priorityTask && openTaskDetails(priorityTask)} disabled={!priorityTask}>
              <h2>{priorityTask?.title || (isTodayFullyCompleted ? 'Todas as tarefas concluídas!' : (uncompletedTodayTasksList.length ? 'Nenhuma atividade futura' : 'Nenhuma tarefa para hoje'))}</h2>
              {priorityTask && <span className="reference-highlight-chips"><span><Clock size={12} />{priorityTask.time}</span><span><Tag size={12} />{priorityTask.category}</span></span>}
            </button>
            {priorityTask && <button className="reference-highlight-complete" aria-label={`Concluir próxima atividade: ${priorityTask.title}`} onClick={() => completeTodayTask(priorityTask)}><CheckCircle2 size={15} fill="currentColor" /><span>Concluir</span></button>}
          </motion.div>
        </AnimatePresence>
      </section>
      <section className="reference-summary" aria-label="Resumo diário">
        <div className="reference-summary-progress" role="progressbar" aria-label="Progresso diário" aria-valuenow={todayProgress} aria-valuemin={0} aria-valuemax={100}>
          <ProgressRing pct={todayProgress} color="#0753D6" size={38} stroke={4} />
          <div className="reference-summary-copy"><p><strong>{todayCompletedCount} de {todayTasksList.length}</strong> concluídas</p><div className="reference-summary-track"><span style={{ width: `${todayProgress}%` }} /></div></div>
        </div>
        <div className="reference-stat reference-pending" title="Tarefas de hoje no horário ou sem horário definido"><span><Clock size={12} /><strong>{todayPendingCount}</strong></span><small>Pendentes</small></div>
        <div className="reference-stat reference-done"><span><CheckCircle2 size={12} fill="currentColor" /><strong>{todayCompletedCount}</strong></span><small>Concluídas</small></div>
        <div className="reference-stat reference-late"><span><AlertCircle size={12} fill="currentColor" /><strong>{todayOverdueCount}</strong></span><small>Atrasadas</small></div>
      </section>

      {/* 2. LISTA DE TAREFAS */}
      <section className="reference-task-section">
        <div className="reference-task-heading">
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-bold text-[#0E1730] tracking-tight flex items-center gap-2 font-display">
              Tarefas
              {activeCategory && (
                <span className="text-xs font-normal text-[#69708A]">({activeCategory})</span>
              )}
              <span className="text-xs font-semibold bg-[#2F5CFF]/10 text-[#2F5CFF] px-2.5 py-0.5 rounded-full">
                {finalFilteredTasks.length}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {activeCategory && (
              <button
                onClick={() => setActiveCategory(null)}
                className="text-xs font-semibold text-[#69708A] hover:text-[#2F5CFF] flex items-center gap-1 transition-colors cursor-pointer mr-1"
              >
                Ver todas <ChevronRight size={12} />
              </button>
            )}

            <button
              onClick={openCreateModal}
              className="reference-new-task"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Nova Tarefa</span>
            </button>
          </div>
        </div>

        {/* Segmented Control */}
        <div className="reference-filters">
          {['hoje', 'semana', 'mes'].map(filter => {
            const isActive = viewFilter === filter;
            const labelMap: Record<string, string> = { hoje: 'Hoje', semana: 'Semana', mes: 'Mês' };
            return (
              <button
                key={filter}
                aria-pressed={isActive}
                onClick={() => setViewFilter(filter as any)}
                className={`relative flex-1 text-xs md:text-sm font-semibold py-2 rounded-lg transition-all z-10 capitalize cursor-pointer ${
                  isActive ? 'text-white' : 'text-[#69708A] hover:text-[#0E1730]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeFilterTab"
                    className="absolute inset-0 bg-[#0B1440] rounded-lg shadow-sm"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}
                <span className="relative z-20">{labelMap[filter]}</span>
              </button>
            );
          })}
        </div>

        {/* Task List */}
        <div className="reference-task-list">
          {finalFilteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 md:py-14 text-[#69708A] bg-white rounded-[16px] border border-[#E3E8F1]">
              <div className="w-12 h-12 bg-[#F3F5FA] rounded-xl flex items-center justify-center mb-3">
                <BoxSelect size={24} className="text-[#9AA1B8] opacity-50" />
              </div>
              <p className="text-sm font-medium">Nenhuma tarefa para este período.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {groupedTasks.map(group => {
                const dateHeader = new Date(group.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
                return (
                  <div key={group.date} className="reference-task-group">
                    {viewFilter !== 'hoje' && (
                      <h3 className="text-[10px] font-bold text-[#69708A] uppercase tracking-widest mt-2 ml-1 font-display">
                        {dateHeader}
                      </h3>
                    )}
                    {group.tasks.map(task => {
                      const targetDate = group.date;
                      const isCompleted = isTaskCompletedOnDate(task, targetDate);
                      return (
                        <TaskRowItem 
                          key={`${task.id}-${targetDate}`}
                          task={task}
                          targetDate={targetDate}
                          isCompleted={isCompleted}
                          isNext={task.id === priorityTask?.id && targetDate === todayStr && hasScheduledTime(task) && task.time >= nowHourMin}
                          isOverdue={!isCompleted && (targetDate < todayStr || (targetDate === todayStr && hasScheduledTime(task) && task.time < nowHourMin))}
                          onToggle={() => handleToggleTask(task)}
                          onPostpone={() => setPostponeTask(task)}
                          onOpenDetails={() => openTaskDetails(task)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </section>

      <details className="reference-extras"><summary>Mais opções da agenda</summary><button className="reference-assistant" onClick={handleAssistantClick}><Sparkles size={14} />Criar tarefa por texto ou voz</button>
      {/* 4. CARD DE INSPIRAÇÃO (SMALL MENSAGEM MOTIVACIONAL) */}
      <section className="px-1 flex items-start gap-3 mt-2">
        <div className={`mt-0.5 text-[#2F5CFF] shrink-0 ${loadingInspiration ? 'animate-pulse' : ''}`}>
          <Sparkles size={14} className={loadingInspiration ? 'animate-spin' : 'opacity-100'} />
        </div>
        
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[#69708A] uppercase tracking-widest flex items-center gap-1 font-display">
              Foco Diário
              {loadingInspiration && <span className="text-[8px] lowercase font-normal text-[#9AA1B8] animate-pulse">(recalculando...)</span>}
            </span>
            <button 
              onClick={() => fetchInspiration(true)}
              className="p-1 min-w-11 min-h-11 flex items-center justify-end text-[#9AA1B8] hover:text-[#2F5CFF] cursor-pointer transition-colors"
            >
              <RefreshCw size={12} className={loadingInspiration ? 'animate-spin text-[#2F5CFF]' : ''} />
            </button>
          </div>
          <p className="text-xs font-medium text-[#69708A] leading-relaxed -mt-1">
            "{inspiration}"
          </p>
        </div>
      </section>

      </details>

      {/* Undo Delete Toast */}
      <AnimatePresence>
        {undoDeleteState.task && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
            className="fixed left-1/2 -translate-x-1/2 bg-[#0B1440]/95 backdrop-blur-md border border-white/10 px-4 py-3 rounded-full flex items-center gap-4 shadow-xl z-50 w-max"
          >
            <span className="text-sm font-medium text-white">Tarefa excluída</span>
            <button 
              onClick={handleUndoDelete}
              className="text-[#FF8A24] font-bold text-sm hover:underline cursor-pointer min-w-11 min-h-11 flex items-center justify-center -my-2 -mr-2"
            >
              Desfazer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Postpone Bottom Sheet */}
      <AnimatePresence>
        {postponeTask && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPostponeTask(null)}
              className="absolute inset-0 bg-[#0E1730]/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white rounded-t-[24px] border-t border-[#E3E8F1] p-6 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-[#9AA1B8]/30 rounded-full mx-auto mb-6" />
              <h3 className="text-lg font-bold text-[#0E1730] mb-4 font-display">Adiar Tarefa</h3>
              <p className="text-sm text-[#69708A] mb-6 line-clamp-1">{postponeTask.title}</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handlePostpone(1)}
                  className="w-full bg-[#F3F5FA] hover:bg-[#E3E8F1] border border-[#E3E8F1] text-[#0E1730] font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw size={16} className="text-[#2F5CFF]" /> Amanhã
                </button>
                <button 
                  onClick={() => handlePostpone(7)}
                  className="w-full bg-[#F3F5FA] hover:bg-[#E3E8F1] border border-[#E3E8F1] text-[#0E1730] font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw size={16} className="text-[#2F5CFF]" /> Próxima Semana
                </button>
                <button 
                  onClick={() => setPostponeTask(null)}
                  className="w-full bg-transparent hover:bg-[#F3F5FA] text-[#69708A] font-bold py-4 rounded-xl transition-all mt-2 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Modal */}
      {isModalOpen && (
        <TaskModal 
          task={selectedTask || undefined}
          onClose={closeModal}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  );
}

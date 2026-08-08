import React, { useState, useEffect, useRef } from 'react';
import { User, CheckCircle2, Circle, Flame, Sparkles, BookOpen, Coffee, Briefcase, ChevronRight, Plus, Clock, Tag, RefreshCw, Trash2, Mic, MicOff, Loader2, Send, X, BoxSelect, RotateCw, Check, Bell, Trophy, Cloud, CloudOff, Dumbbell, Apple, Settings } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { Task } from '../types';
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
  const cat = category.toLowerCase();
  if (cat === 'trabalho') return '#2F5CFF';
  if (cat === 'saúde' || cat === 'saude') return '#16A34A';
  if (cat === 'casa') return '#FF8A24';
  return '#6C5CE7'; // Geral
};

interface TaskRowItemProps {
  task: Task;
  targetDate: string;
  isCompleted: boolean;
  onToggle: () => void;
  onPostpone: () => void;
  onOpenDetails: () => void;
  key?: string;
}

function TaskRowItem({ task, targetDate, isCompleted, onToggle, onPostpone, onOpenDetails }: TaskRowItemProps) {
  const x = useMotionValue(0);
  const greenOpacity = useTransform(x, [0, 80], [0, 1]);
  const redOpacity = useTransform(x, [-80, 0], [1, 0]);

  return (
    <div className="relative overflow-hidden rounded-[16px] w-full">
      {/* Background swipe reveals */}
      <div className="absolute inset-0 flex items-center justify-between rounded-[16px] pointer-events-none select-none overflow-hidden z-0">
        {/* Left Side: Green Concluir (Drag Right) */}
        <motion.div 
          style={{ opacity: greenOpacity }}
          className="absolute inset-y-0 left-0 bg-[#16A34A]/20 flex items-center pl-5 pr-12 rounded-[16px] w-1/2 justify-start"
        >
          <div className="flex items-center gap-2 text-[#16A34A] font-bold text-xs">
            <CheckCircle2 size={16} strokeWidth={3} className="animate-pulse" />
            <span>Concluir</span>
          </div>
        </motion.div>

        {/* Right Side: Red Adiar (Drag Left) */}
        <motion.div 
          style={{ opacity: redOpacity }}
          className="absolute inset-y-0 right-0 bg-[#FF8A24]/15 flex items-center pr-5 pl-12 rounded-[16px] w-1/2 justify-end"
        >
          <div className="flex items-center gap-2 text-[#FF8A24] font-bold text-xs">
            <RotateCw size={16} className="animate-pulse" />
            <span>Adiar</span>
          </div>
        </motion.div>
      </div>

      <motion.div 
        layout
        drag="x"
        style={{ x }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0.5 }}
        onDragEnd={(event, info) => {
          if (info.offset.x > 100) {
            onToggle();
          } else if (info.offset.x < -100) {
            onPostpone();
          }
        }}
        whileTap={{ scale: 0.985 }}
        onClick={onOpenDetails}
        className={`relative z-10 group flex items-center gap-3.5 p-3.5 md:p-4 rounded-[16px] border cursor-pointer transition-all shadow-xs pl-6 ${
          task.priority && !isCompleted 
            ? 'bg-[#FF8A24]/10 border-[#FF8A24]/30 hover:border-[#FF8A24]/50' 
            : 'bg-white border-border-discreet hover:border-[#2F5CFF]/30'
        }`}
      >
        {/* SOLID BAR COLOR Strip on left edge */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-[16px]"
          style={{ backgroundColor: getCategoryColor(task.category) }}
        />

        <button 
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="shrink-0 flex items-center justify-center w-10 h-10 cursor-pointer"
        >
          <div className={`w-5 h-5 flex items-center justify-center rounded-[6px] border-[2px] transition-all duration-200 ${
            isCompleted 
              ? 'bg-[#16A34A] border-[#16A34A] text-white scale-105' 
              : 'border-[#9AA1B8] text-transparent hover:border-[#2F5CFF] bg-[#F3F5FA]'
          }`}>
            {isCompleted && <Check size={12} strokeWidth={4} className="text-white" />}
          </div>
        </button>
        
        <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${isCompleted ? 'opacity-40' : 'opacity-100'}`}>
          <div className="flex items-center gap-2">
            <h3 className={`text-sm md:text-base font-semibold text-[#0E1730] truncate font-display ${isCompleted ? 'line-through decoration-[#0E1730]/30 text-[#69708A]' : ''}`}>
              {task.title}
            </h3>
            {task.priority && !isCompleted && (
              <Flame size={12} className="text-[#FF8A24] shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] text-[#69708A] font-medium flex items-center gap-1 shrink-0">
              <Clock size={10} className="text-[#9AA1B8]" />
              {task.time}
            </span>
            <span className="w-1 h-1 rounded-full bg-[#E3E8F1] shrink-0" />
            <span className="text-[11px] text-[#69708A] font-medium flex items-center gap-1 shrink-0">
              <Tag size={10} className="text-[#9AA1B8]" />
              {task.category}
            </span>
            {task.recurrence === 'semanal' && (
              <>
                <span className="w-1 h-1 rounded-full bg-[#E3E8F1] shrink-0" />
                <span className="text-[11px] text-[#2F5CFF] font-semibold shrink-0 flex items-center gap-1">
                  <RefreshCw size={10} />
                  {(() => {
                    if (!task.recurrenceDays || task.recurrenceDays.length === 0) return 'Semanal';
                    if (task.recurrenceDays.length === 7) return 'Todos os dias';
                    const isWeekdays = ['1','2','3','4','5'].every(d => task.recurrenceDays!.includes(d)) && task.recurrenceDays.length === 5;
                    if (isWeekdays) return 'Dias úteis';
                    const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                    return task.recurrenceDays.map(d => names[Number(d)]).join(', ');
                  })()}
                </span>
              </>
            )}
          </div>
        </div>
        
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200 ${isCompleted ? 'bg-white/5 text-text-meta' : 'bg-[#2F5CFF]/10 text-[#2F5CFF] group-hover:bg-[#2F5CFF]/15'}`}>
          {getIcon(task.icon)}
        </div>
      </motion.div>
    </div>
  );
}

interface AgendaTabProps {
  userName: string;
  avatarUrl: string | null;
  onOpenSettings: () => void;
}

const formatDateLocal = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

const isTaskOnDate = (task: Task, dateStr: string): boolean => {
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

const isTaskCompletedOnDate = (task: Task, dateStr: string): boolean => {
  if (task.id === 'workout_group_summary' || task.id === 'study_daily_summary' || task.id.startsWith('diet_')) {
    return task.completed;
  }
  if (!task.recurrence || task.recurrence === 'none') {
    return task.completed;
  }
  return !!task.completedDates?.includes(dateStr);
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

export default function AgendaTab({ userName, avatarUrl, onOpenSettings }: AgendaTabProps) {
  const todayStr = getTodayStr();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; mode: string }>({ connected: false, mode: 'loading' });

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
  const syncTaskToDb = async (task: Task) => {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
    } catch (error) {
      console.error('Erro ao sincronizar tarefa com o banco:', error);
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

  const handleSaveTask = (task: Task) => {
    if (isCreating) {
      setTasks([...tasks, task]);
    } else {
      setTasks(tasks.map(t => t.id === task.id ? task : t));
    }
    syncTaskToDb(task);
    closeModal();
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
    return a.time.localeCompare(b.time) || a.date.localeCompare(b.date);
  });

  const uncompletedTodayTasksList = allCombinedTasks.filter(t => isTaskOnDate(t, todayStr) && !isTaskCompletedOnDate(t, todayStr));
  const todayTasksList = allCombinedTasks.filter(t => isTaskOnDate(t, todayStr));
  const isTodayFullyCompleted = todayTasksList.length > 0 && uncompletedTodayTasksList.length === 0;

  const priorityTask = (() => {
    if (uncompletedTodayTasksList.length === 0) return null;
    const nowHourMin = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

    const priorityPending = uncompletedTodayTasksList.filter(t => t.priority);
    if (priorityPending.length > 0) {
      const upcoming = priorityPending.filter(t => t.time >= nowHourMin);
      if (upcoming.length > 0) return upcoming.sort((a, b) => a.time.localeCompare(b.time))[0];
      return priorityPending.sort((a, b) => a.time.localeCompare(b.time))[0];
    }

    const upcoming = uncompletedTodayTasksList.filter(t => t.time >= nowHourMin && t.time !== 'Horário flexível' && t.time !== 'Flexível');
    if (upcoming.length > 0) {
      return upcoming.sort((a, b) => a.time.localeCompare(b.time))[0];
    }

    return uncompletedTodayTasksList.sort((a, b) => {
      const isAFlex = a.time === 'Horário flexível' || a.time === 'Flexível';
      const isBFlex = b.time === 'Horário flexível' || b.time === 'Flexível';
      if (isAFlex && !isBFlex) return 1;
      if (!isAFlex && isBFlex) return -1;
      return a.time.localeCompare(b.time);
    })[0];
  })();

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
    <div className="w-full min-h-full p-5 pt-8 md:p-8 md:pt-14 flex flex-col gap-6 md:gap-8 max-w-3xl mx-auto pb-32">
      {/* HEADER */}
      <header className="flex justify-between items-start px-1 relative">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#69708A] uppercase tracking-wider font-display">
              {dateDisplay}
            </span>
            
            <button 
              onClick={checkDbStatus}
              title={dbStatus.connected ? "Neon Conectado" : dbStatus.mode === 'loading' ? "Verificando..." : "Local (Offline)"}
              className="inline-flex items-center justify-center p-1 rounded-md bg-[#F3F5FA] hover:bg-[#E3E8F1] transition-all cursor-pointer border border-[#E3E8F1] select-none"
            >
              {dbStatus.connected ? (
                <Cloud size={13} className="text-[#16A34A] fill-[#16A34A]/25" />
              ) : dbStatus.mode === 'loading' ? (
                <Cloud size={13} className="text-[#9AA1B8] animate-pulse" />
              ) : (
                <CloudOff size={13} className="text-[#69708A]" />
              )}
            </button>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#0E1730] flex items-center gap-2 mt-1 font-display">
            Bom dia, {userName} <span className="text-xl md:text-2xl">👋</span>
          </h1>
        </div>
        
        <button 
          onClick={onOpenSettings}
          className="absolute top-0 right-1 p-2 text-[#9AA1B8] hover:text-[#0E1730] transition-colors cursor-pointer active:scale-95"
        >
          <Settings size={20} strokeWidth={1.5} />
        </button>
      </header>

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

      {/* 1. PRÓXIMA TAREFA (PRIORITY / NEXT TASK) - HERO COMPACTO */}
      {(priorityTask || isTodayFullyCompleted) && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[#FF8A24] font-bold text-[10px] md:text-xs uppercase tracking-wider ml-1">
            {isTodayFullyCompleted ? (
              <Trophy size={14} className="text-[#FF8A24]" />
            ) : (
              <Flame size={14} className="text-[#FF8A24]" />
            )}
            <span>{isTodayFullyCompleted ? 'Parabéns!' : 'Próxima Tarefa Relevante'}</span>
          </div>
          {priorityTask ? (
            <motion.div 
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.995 }}
              onClick={() => openTaskDetails(priorityTask)}
              className="group flex items-center gap-4 bg-gradient-to-br from-[#1E3FD6] to-[#0B1440] h-[90px] px-4 rounded-[22px] cursor-pointer transition-all shadow-md relative overflow-hidden text-white"
            >
              {/* Watermark icon */}
              <div className="absolute right-3 bottom-[-14px] text-white/10 scale-[2.2] pointer-events-none transition-transform group-hover:scale-[2.4] duration-300">
                {getIcon(priorityTask.icon)}
              </div>
              
              {/* Translucent Checkbox */}
              <button 
                onClick={(e) => { e.stopPropagation(); handleToggleTask(priorityTask); }}
                className="shrink-0 flex items-center justify-center w-10 h-10 cursor-pointer"
              >
                <div className={`w-5 h-5 flex items-center justify-center rounded-full border-[2px] transition-all duration-200 ${
                  isTaskCompletedOnDate(priorityTask, todayStr) 
                    ? 'bg-[#16A34A] border-[#16A34A] text-white scale-105' 
                    : 'border-white/30 text-transparent hover:border-white/70 bg-white/10'
                }`}>
                  <CheckCircle2 size={12} strokeWidth={3.5} className={isTaskCompletedOnDate(priorityTask, todayStr) ? 'opacity-100' : 'opacity-0'} />
                </div>
              </button>
              
              {/* Title + horizontal chips */}
              <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${isTaskCompletedOnDate(priorityTask, todayStr) ? 'opacity-40' : 'opacity-100'}`}>
                <h3 className={`text-sm md:text-base font-bold text-white font-display truncate ${isTaskCompletedOnDate(priorityTask, todayStr) ? 'line-through decoration-white/30 text-white/50' : ''}`}>
                  {priorityTask.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] md:text-xs text-white/95 font-medium bg-white/10 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <Clock size={10} className="text-[#FF8A24]" />
                    {priorityTask.time}
                  </span>
                  <span className="text-[10px] md:text-xs text-white/95 font-medium bg-white/10 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <Tag size={10} className="text-white/70" />
                    {priorityTask.category}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group flex items-center gap-4 bg-gradient-to-br from-[#1E3FD6] to-[#0B1440] h-[90px] px-6 rounded-[22px] transition-all shadow-md relative overflow-hidden text-white"
            >
              {/* Watermark icon */}
              <div className="absolute right-4 bottom-[-10px] text-white/10 scale-[2.2] pointer-events-none">
                <Trophy size={40} />
              </div>
              
              {/* Trophy Icon */}
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-[#FF8A24] shrink-0">
                <Trophy size={20} className="animate-bounce" />
              </div>
              
              {/* Text */}
              <div className="flex flex-col flex-1 min-w-0">
                <h3 className="text-sm md:text-base font-bold text-white font-display">
                  Dia concluído! 🎉
                </h3>
                <p className="text-xs text-white/70 mt-0.5">
                  Todas as tarefas de hoje foram feitas.
                </p>
              </div>
            </motion.div>
          )}
        </section>
      )}

      {/* 2. LISTA DE TAREFAS */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-base md:text-lg font-bold text-[#0E1730] tracking-tight flex items-center gap-2 font-display">
            Tarefas
            {activeCategory && (
              <span className="text-xs font-normal text-[#69708A]">({activeCategory})</span>
            )}
            <span className="text-xs font-semibold bg-[#2F5CFF]/10 text-[#2F5CFF] px-2.5 py-0.5 rounded-full">
              {finalFilteredTasks.length}
            </span>
          </h2>
          {activeCategory && (
            <button 
              onClick={() => setActiveCategory(null)} 
              className="text-xs font-semibold text-[#69708A] hover:text-[#2F5CFF] flex items-center gap-1 transition-colors cursor-pointer"
            >
              Ver todas <ChevronRight size={12} />
            </button>
          )}
        </div>
        
        {/* Segmented Control */}
        <div className="flex p-1 bg-[#F3F5FA] rounded-xl border border-[#E3E8F1] w-full relative">
          {['hoje', 'semana', 'mes'].map(filter => {
            const isActive = viewFilter === filter;
            const labelMap: Record<string, string> = { hoje: 'Hoje', semana: 'Semana', mes: 'Mês' };
            return (
              <button
                key={filter}
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
        <div className="flex flex-col gap-3">
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
                  <div key={group.date} className="flex flex-col gap-2">
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

      {/* 3. PROGRESSO DIÁRIO */}
      {viewFilter === 'hoje' && (
        <section className="px-1 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-[#69708A] uppercase tracking-wider font-display">Progresso de Hoje</span>
            <span className="text-[11px] font-bold text-[#69708A] font-display">
              {completedCount} de {filteredTasks.length}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 bg-[#F3F5FA] border border-[#E3E8F1] rounded-full overflow-hidden relative">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-[#2F5CFF] to-[#FF8A24] rounded-full relative"
              />
            </div>
            <span className="text-xs font-bold text-[#0E1730] font-display shrink-0">
              {progressPercentage}%
            </span>
          </div>
        </section>
      )}

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

      {/* FABs */}
      <div 
        style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
        className="fixed right-6 md:right-10 flex flex-col gap-3 z-40 items-center"
      >
        <button 
          onClick={handleAssistantClick}
          className="w-12 h-12 bg-white border border-[#E3E8F1] text-[#2F5CFF] rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-all active:scale-95 cursor-pointer"
        >
          <Sparkles size={20} />
        </button>
        <button 
          onClick={handleFabClick}
          className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-[#2F5CFF] to-[#0B1440] text-white rounded-full flex items-center justify-center shadow-lg shadow-[#2F5CFF]/25 transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <Plus size={24} className="md:w-7 md:h-7" />
        </button>
      </div>

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

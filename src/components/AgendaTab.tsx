import React, { useState, useEffect, useRef } from 'react';
import { User, CheckCircle2, Circle, Flame, Sparkles, BookOpen, Coffee, Briefcase, ChevronRight, Plus, Clock, Tag, RefreshCw, Trash2, Mic, MicOff, Loader2, Send, X, BoxSelect, RotateCw, Check, Bell, Trophy } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { Task } from '../types';
import { getIcon } from '../utils/icons';
import TaskModal from './TaskModal';

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
        className="relative z-10 group flex items-center gap-3.5 bg-white p-3.5 md:p-4 rounded-[16px] border border-border-discreet cursor-pointer hover:border-[#2F5CFF]/30 transition-all shadow-xs pl-6"
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

const getTodayStr = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const getEndOfWeekStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const getNext7Days = (startDateStr: string): string[] => {
  const dates: string[] = [];
  const [year, month, day] = startDateStr.split('-').map(Number);
  for (let i = 0; i < 7; i++) {
    const d = new Date(year, month - 1, day + i);
    const offset = d.getTimezoneOffset() * 60000;
    const localStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
    dates.push(localStr);
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
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('momentum_tasks');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [viewFilter, setViewFilter] = useState<'hoje' | 'semana' | 'mes'>('hoje');
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
    setTasks(tasks.map(t => {
      if (t.id !== id) return t;
      if (!t.recurrence || t.recurrence === 'none') {
        return { ...t, completed: !t.completed };
      }
      const completedDates = t.completedDates || [];
      const exists = completedDates.includes(dateStr);
      const newCompletedDates = exists 
        ? completedDates.filter(d => d !== dateStr) 
        : [...completedDates, dateStr];
      return { ...t, completedDates: newCompletedDates };
    }));
  };

  const handleSaveTask = (task: Task) => {
    if (isCreating) {
      setTasks([...tasks, task]);
    } else {
      setTasks(tasks.map(t => t.id === task.id ? task : t));
    }
    closeModal();
  };

  const handleDeleteTask = (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    if (undoDeleteState.timeoutId) {
      clearTimeout(undoDeleteState.timeoutId);
    }

    setTasks(tasks.filter(t => t.id !== id));
    closeModal();

    const timeoutId = setTimeout(() => {
      setUndoDeleteState({ task: null, timeoutId: null });
    }, 5000);

    setUndoDeleteState({ task: taskToDelete, timeoutId });
  };

  const handleUndoDelete = () => {
    if (undoDeleteState.task) {
      setTasks([...tasks, undoDeleteState.task]);
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
      setTasks(tasks.map(t => t.id === task.id ? { ...t, date: newDateStr } : t));
    } else {
      // Se for recorrente, esconde hoje adicionando aos completedDates
      const completedDates = task.completedDates || [];
      const updatedTask = { ...task, completedDates: [...completedDates, todayStr] };
      // Cria uma nova tarefa apenas para a nova data, não recorrente
      const newTask: Task = { ...task, id: Date.now().toString(), date: newDateStr, recurrence: 'none', completedDates: [] };
      setTasks([...tasks.filter(t => t.id !== task.id), updatedTask, newTask]);
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

  // Filtering Logic
  const filteredTasks = tasks.filter(task => {
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
  }).sort((a, b) => a.time.localeCompare(b.time) || a.date.localeCompare(b.date));

  const priorityTask = tasks.find(t => t.priority && isTaskOnDate(t, todayStr) && !isTaskCompletedOnDate(t, todayStr))
    || tasks.find(t => t.priority && isTaskOnDate(t, todayStr));

  // Remove priority duplicate if it's highlighted at the top (i.e. if it's the priorityTask and viewFilter is 'hoje')
  const finalFilteredTasks = filteredTasks.filter(t => {
    if (viewFilter !== 'hoje') return true;
    if (priorityTask && t.id === priorityTask.id && !isTaskCompletedOnDate(priorityTask, todayStr)) return false;
    return true;
  });

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
  const uncompletedTodayTasks = tasks.filter(t => isTaskOnDate(t, todayStr) && !isTaskCompletedOnDate(t, todayStr));
  const nextUncompletedTask = uncompletedTodayTasks.sort((a, b) => a.time.localeCompare(b.time))[0];

  let headerSubtitle = '';
  if (nextUncompletedTask) {
    headerSubtitle = `• Próxima tarefa às ${nextUncompletedTask.time}`;
  } else {
    const count = tasks.filter(t => isTaskOnDate(t, todayStr)).length;
    headerSubtitle = `• ${count} ${count === 1 ? 'tarefa' : 'tarefas'} hoje`;
  }

  return (
    <div className="w-full min-h-full p-5 pt-8 md:p-8 md:pt-14 flex flex-col gap-6 md:gap-8 max-w-3xl mx-auto pb-32">
      {/* HEADER */}
      <header className="flex justify-between items-center px-1">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-[#69708A] uppercase tracking-wider font-display">
            {dateDisplay}
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#0E1730] flex items-center gap-2 mt-1 font-display">
            Bom dia, {userName} <span className="text-xl md:text-2xl">👋</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Notification Bell with Amber Badge */}
          <button className="w-11 h-11 rounded-xl bg-white border border-[#E3E8F1] flex items-center justify-center text-[#69708A] hover:text-[#0E1730] hover:border-[#2F5CFF]/30 transition-all shadow-xs relative cursor-pointer">
            <Bell size={18} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#FF8A24]" />
          </button>

          {/* Square Rounded Avatar with Initials/Photo */}
          <button 
            onClick={onOpenSettings}
            className="w-11 h-11 md:w-12 md:h-12 rounded-xl overflow-hidden bg-white border border-[#E3E8F1] flex items-center justify-center shrink-0 hover:border-[#2F5CFF]/50 transition-all duration-300 shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="text-sm font-bold text-[#2F5CFF] font-display">
                {userName ? userName.slice(0, 2).toUpperCase() : 'HE'}
              </div>
            )}
          </button>
        </div>
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
      {priorityTask && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[#FF8A24] font-bold text-[10px] md:text-xs uppercase tracking-wider ml-1">
            <Flame size={14} className="text-[#FF8A24]" />
            <span>Próxima Tarefa Relevante</span>
          </div>
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
              onClick={(e) => { e.stopPropagation(); toggleTaskOnDate(priorityTask.id, todayStr); }}
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
        </section>
      )}

      {/* LINHA DE ESTATÍSTICAS */}
      <section className="grid grid-cols-3 gap-3">
        {/* Card 1: Sequência */}
        <div className="bg-white border border-[#E3E8F1] p-3 rounded-[16px] flex items-center gap-2.5 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#FF8A24]/10 text-[#FF8A24] flex items-center justify-center shrink-0">
            <Flame size={16} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-[#69708A] font-medium leading-none">Sequência</span>
            <span className="text-xs font-bold text-[#0E1730] font-display mt-1">5 Dias</span>
          </div>
        </div>

        {/* Card 2: Concluídas */}
        <div className="bg-white border border-[#E3E8F1] p-3 rounded-[16px] flex items-center gap-2.5 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-[#69708A] font-medium leading-none">Concluídas</span>
            <span className="text-xs font-bold text-[#0E1730] font-display mt-1">
              {tasks.filter(t => isTaskOnDate(t, todayStr) && isTaskCompletedOnDate(t, todayStr)).length} / {tasks.filter(t => isTaskOnDate(t, todayStr)).length}
            </span>
          </div>
        </div>

        {/* Card 3: Progresso */}
        <div className="bg-white border border-[#E3E8F1] p-3 rounded-[16px] flex items-center gap-2.5 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#2F5CFF]/10 text-[#2F5CFF] flex items-center justify-center shrink-0">
            <Trophy size={16} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-[#69708A] font-medium leading-none">Progresso</span>
            <span className="text-xs font-bold text-[#0E1730] font-display mt-1">
              {(() => {
                const todayTotal = tasks.filter(t => isTaskOnDate(t, todayStr)).length;
                const todayCompleted = tasks.filter(t => isTaskOnDate(t, todayStr) && isTaskCompletedOnDate(t, todayStr)).length;
                return todayTotal === 0 ? '0%' : `${Math.round((todayCompleted / todayTotal) * 100)}%`;
              })()}
            </span>
          </div>
        </div>
      </section>

      {/* 2. LISTA DE TAREFAS */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-base md:text-lg font-bold text-[#0E1730] tracking-tight flex items-center gap-2 font-display">
            Tarefas
            <span className="text-xs font-semibold bg-[#2F5CFF]/10 text-[#2F5CFF] px-2.5 py-0.5 rounded-full">
              {finalFilteredTasks.length}
            </span>
          </h2>
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
                          onToggle={() => toggleTaskOnDate(task.id, targetDate)}
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
              Coach de IA
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
      <div className="fixed bottom-[100px] md:bottom-8 right-6 md:right-10 flex flex-col gap-3 z-40 items-center">
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
            className="fixed bottom-[110px] md:bottom-10 left-1/2 -translate-x-1/2 bg-[#0B1440]/95 backdrop-blur-md border border-white/10 px-4 py-3 rounded-full flex items-center gap-4 shadow-xl z-50 w-max"
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

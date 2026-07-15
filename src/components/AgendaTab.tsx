import React, { useState, useEffect } from 'react';
import { User, CheckCircle2, Circle, Flame, Sparkles, BookOpen, Coffee, Briefcase, ChevronRight, Plus, Clock, Tag, RefreshCw, Trash2, Mic, MicOff, Loader2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task } from '../types';
import { getIcon } from '../utils/icons';
import TaskModal from './TaskModal';

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

  // Coach Inspiration State
  const [inspiration, setInspiration] = useState(() => {
    return localStorage.getItem('momentum_coach_quote') || 'A disciplina é a ponte entre metas e realizações.';
  });
  const [loadingInspiration, setLoadingInspiration] = useState(false);

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

      // Pre-fill a new task with temporary ID
      const prefilledTask: Task = {
        id: 'temp',
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

      setSelectedTask(prefilledTask);
      setIsCreating(true);
      setIsModalOpen(true);
      setAiInput(''); // Clear input
    } catch (error) {
      console.error('Erro ao analisar tarefa com IA:', error);
    } finally {
      setIsParsing(false);
    }
  };

  // Voice recognition via SpeechRecognition
  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu celular ou navegador não suporta reconhecimento de voz nativo.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (e: any) => {
      console.error('Erro no reconhecimento de voz:', e);
      alert('Erro no microfone. Verifique as permissões de gravação do navegador.');
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiInput(transcript);
      handleParseAiTask(transcript);
    };

    recognition.start();
  };

  // Fetch Coach inspiration phrase based on today's tasks
  const fetchInspiration = async () => {
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
      }
    } catch (err) {
      console.error('Erro ao gerar inspiração:', err);
    } finally {
      setLoadingInspiration(false);
    }
  };

  // Fetch inspiration quote when tasks array changes
  useEffect(() => {
    fetchInspiration();
  }, [tasks, userName]);

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
    setTasks(tasks.filter(t => t.id !== id));
    closeModal();
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

  const completedCount = filteredTasks.filter(t => {
    const targetDate = getTaskTargetDateForFilter(t, viewFilter, todayStr);
    return isTaskCompletedOnDate(t, targetDate);
  }).length;
  const progressPercentage = filteredTasks.length === 0 ? 0 : Math.round((completedCount / filteredTasks.length) * 100);

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
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Bom dia, {userName} <span className="text-xl md:text-2xl animate-bounce-slow">👋</span>
          </h1>
          <div className="flex items-center gap-2 text-xs md:text-sm font-semibold">
            <span className="text-text-sub">{dateDisplay}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
            <span className="text-brand-primary font-bold">{headerSubtitle}</span>
          </div>
        </div>
        
        <button 
          onClick={onOpenSettings}
          className="w-11 h-11 md:w-12 md:h-12 rounded-full overflow-hidden bg-app-card border border-border-discreet flex items-center justify-center shrink-0 hover:border-brand-primary transition-all duration-300 shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User size={18} className="text-text-sec" />
          )}
        </button>
      </header>

      {/* INPUT INTELIGENTE DE TAREFAS COM IA (NLP + VOZ) */}
      <section className="bg-app-card rounded-[22px] p-4.5 border border-border-discreet flex flex-col gap-3 relative overflow-hidden shadow-md">
        {/* Subtle decorative glow */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-2 text-xs font-bold text-text-sec">
          <Sparkles size={14} className="text-brand-primary animate-pulse" />
          <span>Criar Tarefa por IA (NLP & Voz)</span>
        </div>
        
        <div className="flex gap-2.5 items-center">
          <div className="flex-1 relative flex items-center bg-app-card-sec rounded-[16px] border border-border-discreet focus-within:border-brand-primary/50 transition-all">
            <input 
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleParseAiTask(aiInput);
                }
              }}
              placeholder="Treino de pernas hoje às 18h..."
              disabled={isParsing}
              className="w-full bg-transparent px-4 py-3.5 pr-20 text-sm text-white placeholder-text-meta outline-none disabled:opacity-50"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {isParsing ? (
                <Loader2 size={16} className="text-brand-primary animate-spin mr-2" />
              ) : (
                <button
                  onClick={() => handleParseAiTask(aiInput)}
                  disabled={!aiInput.trim()}
                  className="w-8 h-8 flex items-center justify-center rounded-[10px] text-brand-primary hover:bg-brand-primary/10 disabled:opacity-30 transition-all cursor-pointer"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
          
          <button
            onClick={handleVoiceInput}
            type="button"
            className={`w-[48px] h-[48px] rounded-[16px] flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isListening 
                ? 'bg-[#FF5252] text-white animate-pulse shadow-[0_0_12px_rgba(255,82,82,0.4)]' 
                : 'bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/15'
            }`}
            title={isListening ? "Ouvindo... Toque para parar" : "Falar comando de voz"}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        </div>
        {isListening && (
          <p className="text-[11px] text-[#FF5252] font-semibold animate-pulse ml-1">
            🎙️ Ouvindo sua voz em tempo real... Fale e ao terminar, analisaremos seu comando.
          </p>
        )}
      </section>

      {/* 1. PRÓXIMA TAREFA (PRIORITY / NEXT TASK) */}
      {priorityTask && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[#FF5252] font-bold text-[10px] md:text-xs uppercase tracking-wider ml-1">
            <Flame size={14} className="animate-pulse" />
            <span>Próxima Tarefa Relevante</span>
          </div>
          <motion.div 
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.995 }}
            onClick={() => openTaskDetails(priorityTask)}
            className="group flex items-center gap-4 bg-app-card p-4 md:p-5 rounded-[22px] border border-border-discreet cursor-pointer hover:border-white/20 transition-all shadow-md relative overflow-hidden"
          >
            {/* Subtle light glow */}
            <div className="absolute right-0 top-0 w-24 h-24 bg-brand-primary/5 rounded-full blur-2xl pointer-events-none" />
            
            <button 
              onClick={(e) => { e.stopPropagation(); toggleTaskOnDate(priorityTask.id, todayStr); }}
              className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-[2px] transition-all duration-200 cursor-pointer ${
                isTaskCompletedOnDate(priorityTask, todayStr) 
                  ? 'bg-brand-primary border-brand-primary text-white scale-105 shadow-[0_0_8px_rgba(123,109,255,0.4)]' 
                  : 'border-text-sec text-transparent hover:border-brand-primary hover:scale-105'
              }`}
            >
              <CheckCircle2 size={16} strokeWidth={3.5} className={isTaskCompletedOnDate(priorityTask, todayStr) ? 'opacity-100' : 'opacity-0'} />
            </button>
            
            <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${isTaskCompletedOnDate(priorityTask, todayStr) ? 'opacity-40' : 'opacity-100'}`}>
              <h3 className={`text-base font-bold text-white truncate ${isTaskCompletedOnDate(priorityTask, todayStr) ? 'line-through decoration-white/30 text-white/50' : ''}`}>
                {priorityTask.title}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-text-sub font-semibold bg-white/10 px-2.5 py-1 rounded-md flex items-center gap-1 border border-white/5 shrink-0">
                  <Clock size={11} className="text-brand-primary" />
                  {priorityTask.time}
                </span>
                <span className="w-1 h-1 rounded-full bg-white/15" />
                <span className="text-xs text-white font-bold bg-white/10 px-2.5 py-1 rounded-md flex items-center gap-1 border border-white/5 shrink-0">
                  <Tag size={11} className="text-brand-primary" />
                  {priorityTask.category}
                </span>
              </div>
            </div>
            
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-[12px] md:rounded-[14px] flex items-center justify-center shrink-0 transition-colors duration-200 ${isTaskCompletedOnDate(priorityTask, todayStr) ? 'bg-white/5 text-white/30' : 'bg-brand-primary/10 text-brand-primary group-hover:bg-brand-primary/15'}`}>
              {getIcon(priorityTask.icon)}
            </div>
          </motion.div>
        </section>
      )}

      {/* 2. LISTA DE TAREFAS */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            Tarefas
            <span className="text-xs font-semibold bg-brand-primary/10 text-brand-primary px-2.5 py-0.5 rounded-full">
              {filteredTasks.length}
            </span>
          </h2>
        </div>
        
        {/* Segmented Control */}
        <div className="flex p-1 bg-app-card-sec rounded-[18px] border border-border-discreet w-full relative">
          {['hoje', 'semana', 'mes'].map(filter => {
            const isActive = viewFilter === filter;
            const labelMap: Record<string, string> = { hoje: 'Hoje', semana: 'Semana', mes: 'Mês' };
            return (
              <button
                key={filter}
                onClick={() => setViewFilter(filter as any)}
                className={`relative flex-1 text-xs md:text-sm font-bold py-2.5 rounded-[14px] transition-all z-10 capitalize cursor-pointer ${
                  isActive ? 'text-white' : 'text-text-meta hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeFilterTab"
                    className="absolute inset-0 bg-gradient-to-r from-[#7B6DFF] to-[#8A79FF] rounded-[14px] shadow-md shadow-brand-primary/20"
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
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-text-sec text-xs md:text-sm bg-app-card/20 rounded-[20px] border border-border-discreet">
              Nenhuma tarefa para este período.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filteredTasks.map(task => {
                const targetDate = getTaskTargetDateForFilter(task, viewFilter, todayStr);
                const isCompleted = isTaskCompletedOnDate(task, targetDate);
                return (
                  <div key={task.id} className="relative overflow-hidden rounded-[20px] w-full">
                    {/* Background swipe reveals */}
                    <div className="absolute inset-0 flex items-center justify-between rounded-[20px] pointer-events-none select-none overflow-hidden z-0">
                      {/* Left Side: Green Concluir (Drag Right) */}
                      <div className="absolute inset-y-0 left-0 bg-emerald-500/20 flex items-center pl-6 pr-12 rounded-[20px] w-1/2 justify-start">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                          <CheckCircle2 size={16} strokeWidth={3} className="animate-pulse" />
                          <span>Concluir</span>
                        </div>
                      </div>

                      {/* Right Side: Red Excluir (Drag Left) */}
                      <div className="absolute inset-y-0 right-0 bg-rose-500/20 flex items-center pr-6 pl-12 rounded-[20px] w-1/2 justify-end">
                        <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                          <Trash2 size={16} className="animate-pulse" />
                          <span>Excluir</span>
                        </div>
                      </div>
                    </div>

                    <motion.div 
                      layout
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={{ left: 0.5, right: 0.5 }}
                      onDragEnd={(event, info) => {
                        if (info.offset.x > 120) {
                          // Swipe right to toggle completion
                          toggleTaskOnDate(task.id, targetDate);
                        } else if (info.offset.x < -120) {
                          // Swipe left to delete task
                          setTasks(prev => prev.filter(t => t.id !== task.id));
                        }
                      }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => openTaskDetails(task)}
                      className="relative z-10 group flex items-center gap-4 bg-app-card p-4 md:p-5 rounded-[20px] border border-border-discreet cursor-pointer hover:border-white/20 transition-all shadow-sm hover:shadow-md"
                    >
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleTaskOnDate(task.id, targetDate); }}
                        className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-[2px] transition-all duration-200 cursor-pointer ${
                          isCompleted 
                            ? 'bg-brand-primary border-brand-primary text-white scale-105 shadow-[0_0_8px_rgba(123,109,255,0.4)]' 
                            : 'border-text-sec text-transparent hover:border-brand-primary hover:scale-105'
                        }`}
                      >
                        <CheckCircle2 size={15} strokeWidth={3.5} className={isCompleted ? 'opacity-100' : 'opacity-0'} />
                      </button>
                      
                      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${isCompleted ? 'opacity-40' : 'opacity-100'}`}>
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm md:text-base font-bold text-white truncate ${isCompleted ? 'line-through decoration-white/30 text-white/50' : ''}`}>
                            {task.title}
                          </h3>
                          {task.priority && !isCompleted && (
                            <Flame size={14} className="text-[#FF5252] shrink-0 animate-pulse" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-text-sub font-semibold bg-white/10 px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0 border border-white/5">
                            <Clock size={11} className="text-brand-primary" />
                            {task.time}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-white/15 shrink-0" />
                          <span className="text-xs text-white font-bold bg-white/10 px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0 border border-white/5">
                            <Tag size={11} className="text-brand-primary" />
                            {task.category}
                          </span>
                          {task.recurrence === 'semanal' && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-white/15 shrink-0" />
                              <span className="text-xs text-brand-primary font-bold shrink-0 flex items-center gap-1">
                                <RefreshCw size={11} className="animate-spin-slow" />
                                {task.recurrenceDays && task.recurrenceDays.length > 0
                                  ? `Semanal (${task.recurrenceDays.map(d => {
                                      const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                                      return names[Number(d)];
                                    }).join(', ')})`
                                  : 'Semanal'}
                              </span>
                            </>
                          )}
                          {viewFilter !== 'hoje' && task.recurrence !== 'semanal' && task.date && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-white/15 shrink-0" />
                              <span className="text-xs text-text-sub font-semibold font-mono shrink-0 bg-white/10 px-2.5 py-1 rounded-md border border-white/5">
                                {task.date.split('-').reverse().slice(0,2).join('/')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-[12px] flex items-center justify-center shrink-0 transition-colors duration-200 ${isCompleted ? 'bg-white/5 text-white/30' : 'bg-brand-primary/10 text-brand-primary group-hover:bg-brand-primary/15'}`}>
                        {getIcon(task.icon)}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* 3. PROGRESSO DIÁRIO */}
      {viewFilter === 'hoje' && (
        <section className="bg-app-card rounded-[22px] p-5 border border-border-discreet shadow-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-text-sub uppercase tracking-wider">Progresso de Hoje</span>
            <span className="text-xs font-extrabold text-white bg-brand-primary/20 border border-brand-primary/30 px-3 py-1 rounded-full">
              {completedCount} de {filteredTasks.length} {filteredTasks.length === 1 ? 'tarefa' : 'tarefas'}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="h-[10px] flex-1 bg-app-card-sec border border-white/10 rounded-full overflow-hidden relative">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-[#7B6DFF] to-[#8A79FF] rounded-full relative shadow-[0_0_12px_rgba(123,109,255,0.4)]"
              />
            </div>
            <span className="text-sm font-black text-white font-mono w-10 text-right shrink-0">
              {progressPercentage}%
            </span>
          </div>
        </section>
      )}

      {/* 4. CARD DE INSPIRAÇÃO (SMALL MENSAGEM MOTIVACIONAL) */}
      <section className="bg-app-card-sec/40 rounded-[20px] p-4.5 border border-border-discreet flex items-center gap-3.5 relative overflow-hidden">
        {/* Subtle background blur accent */}
        <div className="absolute -left-6 -top-6 w-16 h-16 bg-brand-primary/10 rounded-full blur-xl pointer-events-none" />
        
        <div className={`w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0 ${loadingInspiration ? 'animate-pulse' : ''}`}>
          <Sparkles size={14} className={loadingInspiration ? 'animate-spin' : 'opacity-100'} />
        </div>
        
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1">
            Coach de IA
            {loadingInspiration && <span className="text-[8px] lowercase font-normal text-text-meta animate-pulse">(recalculando...)</span>}
          </span>
          <p className="text-xs font-semibold text-white leading-relaxed italic">
            "{inspiration}"
          </p>
        </div>
      </section>

      {/* FAB (Add Task) */}
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={openCreateModal}
        className="fixed bottom-[100px] md:bottom-8 right-6 md:right-10 w-14 h-14 md:w-16 md:h-16 bg-gradient-to-r from-brand-primary to-brand-hover text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-primary/30 hover:shadow-xl hover:shadow-brand-primary/40 transition-all z-40 cursor-pointer"
      >
        <Plus size={24} className="md:w-7 md:h-7" />
      </motion.button>

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

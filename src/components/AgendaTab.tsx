import React, { useState, useEffect } from 'react';
import { User, CheckCircle2, Circle, Flame, Sparkles, BookOpen, Coffee, Briefcase, ChevronRight, Plus } from 'lucide-react';
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

export default function AgendaTab({ userName, avatarUrl, onOpenSettings }: AgendaTabProps) {
  const todayStr = getTodayStr();
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('momentum_tasks');
    if (saved) return JSON.parse(saved);
    
    // Default data
    return [
      { id: '1', title: 'Meditação matinal', time: '06:00', date: todayStr, category: 'Bem-estar', icon: 'Sparkles', completed: true, priority: false },
      { id: '2', title: 'Reunião de alinhamento', time: '09:00', date: todayStr, category: 'Trabalho', icon: 'Briefcase', completed: false, priority: true, notes: 'Preparar slides de apresentação sobre o Q3.' },
      { id: '3', title: 'Leitura diária', time: '20:30', date: todayStr, category: 'Hábito', icon: 'BookOpen', completed: false, priority: false },
    ];
  });

  const [viewFilter, setViewFilter] = useState<'hoje' | 'semana' | 'mes'>('hoje');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    localStorage.setItem('momentum_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
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
    if (viewFilter === 'hoje') return task.date === todayStr;
    if (viewFilter === 'semana') return task.date >= todayStr && task.date <= getEndOfWeekStr();
    if (viewFilter === 'mes') return task.date.startsWith(todayStr.substring(0, 7)); // Simple YYYY-MM match
    return true;
  }).sort((a, b) => a.time.localeCompare(b.time) || a.date.localeCompare(b.date));

  const priorityTask = tasks.find(t => t.priority && t.date === todayStr && !t.completed);

  const completedCount = filteredTasks.filter(t => t.completed).length;
  const progressPercentage = filteredTasks.length === 0 ? 0 : Math.round((completedCount / filteredTasks.length) * 100);

  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
  const todayFormatted = new Date().toLocaleDateString('pt-BR', dateOptions);
  const dateDisplay = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  return (
    <div className="w-full h-full p-6 pt-12 flex flex-col gap-8">
      {/* HEADER */}
      <header className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            Bom dia, {userName} <span className="text-xl">👋</span>
          </h1>
          <p className="text-sm text-[#A1A1AA] font-medium">{dateDisplay}</p>
        </div>
        
        <button 
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-full overflow-hidden bg-[#171A21] border border-white/10 flex items-center justify-center shrink-0 hover:border-[#7C5CFF] transition-colors"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User size={20} className="text-[#A1A1AA]" />
          )}
        </button>
      </header>

      {/* MOTIVATIONAL / PRIORITY CARD */}
      {priorityTask ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-red-500 font-semibold text-xs tracking-wider uppercase ml-2">
            <span>Prioridade</span>
            <Flame size={14} />
          </div>
          <div 
            onClick={() => openTaskDetails(priorityTask)}
            className="group flex items-center gap-4 bg-[#171A21] p-4 rounded-[20px] border border-white/5 cursor-pointer hover:border-white/10 transition-all active:scale-[0.98]"
          >
            <button 
              onClick={(e) => { e.stopPropagation(); toggleTask(priorityTask.id); }}
              className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-colors ${
                priorityTask.completed 
                  ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white' 
                  : 'border-[#A1A1AA] text-transparent group-hover:border-[#7C5CFF]/50'
              }`}
            >
              <CheckCircle2 size={16} strokeWidth={3} className={priorityTask.completed ? 'opacity-100' : 'opacity-0'} />
            </button>
            
            <div className={`flex flex-col flex-1 min-w-0 transition-opacity ${priorityTask.completed ? 'opacity-50' : 'opacity-100'}`}>
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-medium text-white truncate ${priorityTask.completed ? 'line-through' : ''}`}>
                  {priorityTask.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-[#A1A1AA] font-mono">{priorityTask.time}</span>
                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                <span className="text-[11px] text-[#A1A1AA]">{priorityTask.category}</span>
              </div>
            </div>
            
            <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${priorityTask.completed ? 'bg-white/5 text-white/30' : 'bg-[#7C5CFF]/10 text-[#7C5CFF]'}`}>
              {getIcon(priorityTask.icon)}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-gradient-to-br from-[#171A21] to-[#12141A] rounded-[20px] p-5 border border-white/5 relative overflow-hidden shadow-lg">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#7C5CFF]/20 rounded-full blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[#7C5CFF] font-medium text-xs tracking-wider uppercase">
              <Flame size={14} />
              <span>Inspiração</span>
            </div>
            <p className="text-base font-medium text-white/90 leading-relaxed">
              "A disciplina é a ponte entre metas e realizações."
            </p>
          </div>
        </section>
      )}

      {/* FILTER TABS & TASKS LIST */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-base font-semibold text-white">Tarefas</h2>
        </div>
        
        {/* Segmented Control */}
        <div className="flex p-1 bg-[#171A21] rounded-[16px] border border-white/5 w-full">
          {['hoje', 'semana', 'mes'].map(filter => (
            <button
              key={filter}
              onClick={() => setViewFilter(filter as any)}
              className={`flex-1 text-sm font-medium py-2 rounded-[12px] transition-all capitalize ${
                viewFilter === filter 
                  ? 'bg-[#7C5CFF] text-white shadow-md' 
                  : 'text-[#A1A1AA] hover:text-white hover:bg-white/5'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="flex flex-col gap-3 mt-2">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-[#A1A1AA] text-sm">
              Nenhuma tarefa encontrada.
            </div>
          ) : (
            filteredTasks.map(task => (
              <div 
                key={task.id}
                onClick={() => openTaskDetails(task)}
                className="group flex items-center gap-4 bg-[#171A21] p-4 rounded-[20px] border border-white/5 cursor-pointer hover:border-white/10 transition-all active:scale-[0.98]"
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                  className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-colors ${
                    task.completed 
                      ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white' 
                      : 'border-[#A1A1AA] text-transparent group-hover:border-[#7C5CFF]/50'
                  }`}
                >
                  <CheckCircle2 size={16} strokeWidth={3} className={task.completed ? 'opacity-100' : 'opacity-0'} />
                </button>
                
                <div className={`flex flex-col flex-1 min-w-0 transition-opacity ${task.completed ? 'opacity-50' : 'opacity-100'}`}>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-medium text-white truncate ${task.completed ? 'line-through' : ''}`}>
                      {task.title}
                    </h3>
                    {task.priority && !task.completed && (
                      <Flame size={14} className="text-[#7C5CFF] shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-[#A1A1AA] font-mono">{task.time}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20"></span>
                    <span className="text-[11px] text-[#A1A1AA]">{task.category}</span>
                    {viewFilter !== 'hoje' && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                        <span className="text-[11px] text-[#A1A1AA]">{task.date.split('-').reverse().slice(0,2).join('/')}</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${task.completed ? 'bg-white/5 text-white/30' : 'bg-[#7C5CFF]/10 text-[#7C5CFF]'}`}>
                  {getIcon(task.icon)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* DAILY PROGRESS */}
      {viewFilter === 'hoje' && (
        <section className="bg-[#171A21] rounded-[20px] p-5 border border-white/5 mt-2 mb-8">
          <div className="flex justify-between items-end mb-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#A1A1AA] uppercase tracking-wider">Progresso Diário</span>
              <span className="text-xl font-bold text-white">{progressPercentage}% Completo</span>
            </div>
            <span className="text-sm font-medium text-[#7C5CFF]">
              {completedCount} de {filteredTasks.length}
            </span>
          </div>
          <div className="h-2 w-full bg-[#0F1115] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#7C5CFF] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </section>
      )}

      {/* FAB (Add Task) */}
      <button 
        onClick={openCreateModal}
        className="fixed bottom-24 right-6 w-14 h-14 bg-[#7C5CFF] text-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(124,92,255,0.4)] hover:scale-105 active:scale-95 transition-all z-30"
      >
        <Plus size={24} />
      </button>

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


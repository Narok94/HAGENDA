import React, { useState } from 'react';
import { User, CheckCircle2, Circle, Flame, Sparkles, BookOpen, Coffee, Briefcase, ChevronRight } from 'lucide-react';
import { Task } from '../types';

interface AgendaTabProps {
  userName: string;
  avatarUrl: string | null;
  onOpenSettings: () => void;
}

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Meditação matinal', time: '06:00', category: 'Bem-estar', icon: 'Sparkles', completed: true },
  { id: '2', title: 'Leitura diária (20 págs)', time: '06:30', category: 'Hábito', icon: 'BookOpen', completed: true },
  { id: '3', title: 'Reunião de alinhamento', time: '09:00', category: 'Trabalho', icon: 'Briefcase', completed: false },
  { id: '4', title: 'Pausa para café', time: '15:00', category: 'Pausa', icon: 'Coffee', completed: false },
];

export default function AgendaTab({ userName, avatarUrl, onOpenSettings }: AgendaTabProps) {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progressPercentage = Math.round((completedCount / tasks.length) * 100) || 0;

  // Format current date: "Sexta, 12 de Jan"
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
  const todayFormatted = new Date().toLocaleDateString('pt-BR', dateOptions);
  // Capitalize first letter
  const dateDisplay = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  // Horizontal Calendar (Static for visual mockup as requested)
  const days = [
    { day: 'SEG', num: '08', active: false },
    { day: 'TER', num: '09', active: false },
    { day: 'QUA', num: '10', active: false },
    { day: 'QUI', num: '11', active: false },
    { day: 'SEX', num: '12', active: true },
    { day: 'SÁB', num: '13', active: false },
    { day: 'DOM', num: '14', active: false },
  ];

  const getIcon = (name: string) => {
    switch (name) {
      case 'Sparkles': return <Sparkles size={18} />;
      case 'BookOpen': return <BookOpen size={18} />;
      case 'Briefcase': return <Briefcase size={18} />;
      case 'Coffee': return <Coffee size={18} />;
      default: return <Circle size={18} />;
    }
  };

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

      {/* MOTIVATIONAL CARD */}
      <section className="bg-gradient-to-br from-[#171A21] to-[#12141A] rounded-[20px] p-5 border border-white/5 relative overflow-hidden shadow-lg">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#7C5CFF]/20 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[#7C5CFF] font-medium text-xs tracking-wider uppercase">
            <Flame size={14} />
            <span>Foco do Dia</span>
          </div>
          <p className="text-base font-medium text-white/90 leading-relaxed">
            "A disciplina é a ponte entre metas e realizações."
          </p>
        </div>
      </section>

      {/* HORIZONTAL CALENDAR */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-white">Agenda</h2>
          <button className="text-[#A1A1AA] hover:text-white transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex justify-between items-center gap-2">
          {days.map((d, i) => (
            <div 
              key={i} 
              className={`flex flex-col items-center justify-center w-11 h-16 rounded-[16px] border transition-colors cursor-pointer ${
                d.active 
                  ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white shadow-[0_0_15px_rgba(124,92,255,0.3)]' 
                  : 'bg-[#171A21] border-transparent text-[#A1A1AA] hover:bg-[#1C1F28]'
              }`}
            >
              <span className="text-[10px] font-medium mb-1">{d.day}</span>
              <span className={`text-sm font-semibold ${d.active ? 'text-white' : 'text-white/80'}`}>{d.num}</span>
            </div>
          ))}
        </div>
      </section>

      {/* TASKS LIST */}
      <section className="flex flex-col gap-3">
        {tasks.map(task => (
          <div 
            key={task.id}
            onClick={() => toggleTask(task.id)}
            className="group flex items-center gap-4 bg-[#171A21] p-4 rounded-[20px] border border-white/5 cursor-pointer hover:border-white/10 transition-all active:scale-[0.98]"
          >
            <button className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-colors ${
              task.completed 
                ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white' 
                : 'border-[#A1A1AA] text-transparent group-hover:border-[#7C5CFF]/50'
            }`}>
              <CheckCircle2 size={16} strokeWidth={3} className={task.completed ? 'opacity-100' : 'opacity-0'} />
            </button>
            
            <div className={`flex flex-col flex-1 min-w-0 transition-opacity ${task.completed ? 'opacity-50' : 'opacity-100'}`}>
              <h3 className={`text-sm font-medium text-white truncate ${task.completed ? 'line-through' : ''}`}>
                {task.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-[#A1A1AA] font-mono">{task.time}</span>
                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                <span className="text-[11px] text-[#A1A1AA]">{task.category}</span>
              </div>
            </div>
            
            <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${task.completed ? 'bg-white/5 text-white/30' : 'bg-[#7C5CFF]/10 text-[#7C5CFF]'}`}>
              {getIcon(task.icon)}
            </div>
          </div>
        ))}
      </section>

      {/* DAILY PROGRESS */}
      <section className="bg-[#171A21] rounded-[20px] p-5 border border-white/5 mt-2 mb-8">
        <div className="flex justify-between items-end mb-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#A1A1AA] uppercase tracking-wider">Progresso Diário</span>
            <span className="text-xl font-bold text-white">{progressPercentage}% Completo</span>
          </div>
          <span className="text-sm font-medium text-[#7C5CFF]">
            {completedCount} de {tasks.length}
          </span>
        </div>
        <div className="h-2 w-full bg-[#0F1115] rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#7C5CFF] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </section>
    </div>
  );
}

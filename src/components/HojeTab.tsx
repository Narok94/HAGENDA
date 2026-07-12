import React, { useState } from 'react';
import { Item, Category } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, AlertCircle, Plus, Check, Clock, Edit2, Sparkles, AlertTriangle } from 'lucide-react';

interface HojeTabProps {
  items: Item[];
  categories: Category[];
  onToggleComplete: (itemId: string, dateStr: string) => void;
  onEditItem: (item: Item) => void;
  onQuickAdd: (title: string, time?: string) => void;
  selectedDateStr: string; // "YYYY-MM-DD"
}

export default function HojeTab({
  items,
  categories,
  onToggleComplete,
  onEditItem,
  onQuickAdd,
  selectedDateStr
}: HojeTabProps) {
  const [quickTitle, setQuickTitle] = useState('');
  const [quickTime, setQuickTime] = useState('');
  const [isOverdueExpanded, setIsOverdueExpanded] = useState(false);

  // Handle inline quick addition
  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    onQuickAdd(quickTitle.trim(), quickTime || undefined);
    setQuickTitle('');
    setQuickTime('');
  };

  const getLongDateCompact = () => {
    const d = new Date(selectedDateStr + 'T12:00:00');
    const day = d.getDate();
    const month = d.toLocaleDateString('pt-BR', { month: 'short' });
    const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}. • ${day} de ${month}`;
  };

  // Helper to check if a recurring item falls on a specific date
  const isItemRecurringOnDate = (item: Item, targetStr: string): boolean => {
    if (!item.recurring) return item.date === targetStr;
    if (item.date > targetStr) return false; // Future item cannot recur in past
    
    const itemDate = new Date(item.date + 'T00:00:00');
    const targetDate = new Date(targetStr + 'T00:00:00');

    if (item.recurring === 'diario') return true;
    if (item.recurring === 'semanal') return itemDate.getDay() === targetDate.getDay();
    if (item.recurring === 'mensal') return itemDate.getDate() === targetDate.getDate();
    return false;
  };

  // Helper to get completion state on specific date
  const isItemCompletedOnDate = (item: Item, targetStr: string): boolean => {
    if (!item.recurring) return item.completed;
    // For recurring, let's assume we store completed dates in a custom list, or check standard completed
    // Let's support an array `completedDates` or fallback to item.completed
    const customItem = item as any;
    if (customItem.completedDates && Array.isArray(customItem.completedDates)) {
      return customItem.completedDates.includes(targetStr);
    }
    return item.completed;
  };

  // Today items
  const todayAllItems = items.filter(item => {
    return item.date === selectedDateStr || isItemRecurringOnDate(item, selectedDateStr);
  });

  // Segregate timed vs untimed today tasks
  const timedItems = todayAllItems
    .filter(item => item.time)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const untimedItems = todayAllItems.filter(item => !item.time);

  // Overdue items: date < selectedDateStr, not completed, and not recurring (or not completed on those past days)
  const overdueItems = items.filter(item => {
    if (item.recurring) return false; // Recurring items don't accumulate as overdue in the same way, they just show up on their respective days
    return item.date < selectedDateStr && !item.completed;
  });

  // Completed math
  const completedCount = todayAllItems.filter(item => isItemCompletedOnDate(item, selectedDateStr)).length;
  const totalCount = todayAllItems.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  // Progress Ring Geometry
  const radius = 26;
  const strokeWidth = 3.5;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Render nicely formatted long date in Portuguese
  const getLongDate = () => {
    const d = new Date(selectedDateStr + 'T12:00:00');
    const day = d.getDate();
    const month = d.toLocaleDateString('pt-BR', { month: 'long' });
    const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} de ${month}`;
  };

  return (
    <div className="space-y-6">
      {/* Card do dia (Styled exactly like the workout card in the screenshot) */}
      <div className="bg-gradient-to-br from-brand-accent via-[#1646C7] to-[#0A1E5C] text-white p-6 rounded-[24px] shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[150px] transition-all">
        {/* Subtle decorative grid/mesh in the background */}
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex justify-between items-center gap-4 z-10">
          <div className="space-y-2">
            {/* Transparent elegant pill label */}
            <span className="inline-block bg-white/15 backdrop-blur-md text-[10px] font-mono font-bold tracking-widest px-3 py-1 rounded-full text-blue-100 leading-none">
              COMPROMISSOS DE HOJE
            </span>
            <h1 className="font-sans font-extrabold text-xl sm:text-2xl tracking-tight leading-snug text-white">
              {getLongDate()}
            </h1>
            <span className="text-[11px] text-blue-200/80 font-mono tracking-wide block">
              {totalCount > 0 
                ? `${completedCount} de ${totalCount} tarefas concluídas` 
                : 'Sua rotina, um só lugar.'}
            </span>
          </div>

          {/* CIRCULAR PROGRESS RING - Smoothly animated, exactly as requested */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-14 h-14 transform -rotate-90">
                {/* Background path circle */}
                <circle
                  className="text-white/10"
                  strokeWidth={strokeWidth}
                  stroke="currentColor"
                  fill="transparent"
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
                {/* Foreground path circle with smooth CSS transition */}
                <circle
                  className="text-cyan-300 transition-all duration-700 ease-out"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  style={{ strokeDashoffset }}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
              </svg>
              {/* Inner Percentage Label */}
              <span className="absolute text-[10px] font-mono font-bold text-white tabular-nums">
                {percentage}%
              </span>
            </div>
            <span className="text-[8px] font-mono text-cyan-200 uppercase tracking-widest mt-1 font-bold">Progresso</span>
          </div>
        </div>

        {/* Lower indicator line */}
        {totalCount > 0 && (
          <div className="w-full bg-white/10 h-1 rounded-full mt-5 overflow-hidden z-10">
            <div 
              className="bg-cyan-300 h-full transition-all duration-500 rounded-full" 
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
      </div>

      {/* OVERDUE SECTION (ATRASADOS) - COLLAPSIBLE BANNER */}
      {overdueItems.length > 0 && (
        <div className="bg-[#FEECEC] dark:bg-red-950/20 rounded-lg overflow-hidden transition-all duration-200">
          <button
            type="button"
            onClick={() => setIsOverdueExpanded(!isOverdueExpanded)}
            className="w-full flex items-center justify-between px-4 py-1.5 text-[#7F1D1D] dark:text-red-300 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wide">
              <span>{overdueItems.length} {overdueItems.length === 1 ? 'COMPROMISSO ATRASADO' : 'COMPROMISSOS ATRASADOS'}</span>
            </div>
            <span className="text-[9px] font-mono font-bold hover:underline">
              {isOverdueExpanded ? 'Recolher' : 'Visualizar'}
            </span>
          </button>
          
          {isOverdueExpanded && (
            <div className="px-3 pb-2.5 pt-0.5 space-y-1.5 bg-[#FEECEC]/50 dark:bg-black/10">
              {overdueItems.map(item => {
                const overdueDate = new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
                
                return (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between bg-white dark:bg-dark-card px-3 py-1.5 rounded-md shadow-xs transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        onClick={() => onToggleComplete(item.id, item.date)}
                        className="w-4 h-4 rounded border border-red-200 dark:border-red-800 flex items-center justify-center hover:bg-red-50 text-red-600 transition-colors shrink-0 cursor-pointer"
                      >
                        <Check size={10} className="opacity-0 hover:opacity-100" />
                      </button>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gray-800 dark:text-gray-200 font-medium truncate">{item.title}</span>
                          <span className="text-[9px] font-mono text-red-600 dark:text-red-400 font-bold shrink-0">
                            ({overdueDate})
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onEditItem(item)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-dark-hover rounded text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <Edit2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QUICK ADD LINE (ALWAYS VISIBLE) - Compacted */}
      <form onSubmit={handleQuickSubmit} className="bg-white dark:bg-dark-card p-2 rounded-2xl shadow-xs border border-gray-100 dark:border-dark-border flex flex-col sm:flex-row items-center gap-2">
        <div className="relative w-full flex-1">
          <input
            type="text"
            required
            placeholder="Adicione rapidamente um compromisso..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            className="w-full bg-transparent border-0 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 px-2 sm:px-0">
          <input
            type="time"
            value={quickTime}
            onChange={(e) => setQuickTime(e.target.value)}
            className="bg-gray-50 dark:bg-dark-inner border border-gray-200/60 dark:border-dark-border rounded-xl px-2.5 py-1.5 text-xs text-gray-800 dark:text-gray-200 font-mono focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent-dark shrink-0 w-24 text-center"
          />
          <button
            type="submit"
            className="flex-1 sm:flex-initial bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold text-[11px] font-mono uppercase tracking-wider py-1.5 px-4 rounded-xl flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
          >
            <Plus size={12} strokeWidth={2.5} />
            <span>ADICIONAR</span>
          </button>
        </div>
      </form>

      {/* TASKS LIST */}
      <div className="space-y-6">
        
        {/* State Empty Illustration */}
        {todayAllItems.length === 0 && (
          <div className="bg-white dark:bg-dark-card p-12 rounded-2xl border border-gray-100 dark:border-dark-border flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-brand-accent/5 dark:bg-brand-accent-dark/10 flex items-center justify-center text-brand-accent dark:text-brand-accent-dark">
              <Sparkles size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="font-display font-semibold text-lg text-gray-900 dark:text-white">Céu limpo por hoje</h3>
              <p className="text-sm text-gray-500 dark:text-[#8A94A6] mt-1.5">
                Você concluiu todos os seus compromissos ou não agendou nada para hoje. Aproveite este momento para respirar ou planejar sua semana!
              </p>
            </div>
          </div>
        )}

        {/* Timed Tasks Section */}
        {timedItems.length > 0 && (
          <div>
            <div className="text-xs font-mono font-bold text-gray-400 dark:text-[#8A94A6] tracking-widest uppercase mb-3 flex items-center gap-2">
              <Clock size={13} className="text-brand-accent dark:text-brand-accent-dark" />
              <span>COMPROMISSOS COM HORÁRIO</span>
            </div>
            
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {timedItems.map(item => {
                  const isCompleted = isItemCompletedOnDate(item, selectedDateStr);
                  const cat = categories.find(c => c.id === item.category);
                  
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={`relative flex items-center justify-between p-4 pl-5 bg-white dark:bg-dark-card rounded-2xl shadow-xs transition-all ${
                        isCompleted 
                          ? 'opacity-65' 
                          : 'hover:shadow-sm'
                      }`}
                    >
                      {/* Priority left border line indicator */}
                      <div 
                        className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-md ${
                          item.priority === 'alta' 
                            ? 'bg-red-500' 
                            : item.priority === 'baixa'
                              ? 'bg-brand-accent'
                              : 'bg-amber-400'
                        }`}
                      />

                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Interactive satisfying Checkbox */}
                        <button
                          onClick={() => onToggleComplete(item.id, selectedDateStr)}
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                            isCompleted 
                              ? 'bg-emerald-500 border-emerald-600 text-white shadow-inner scale-95 shadow-emerald-700/20' 
                              : 'border-gray-200 dark:border-dark-border hover:border-brand-accent dark:hover:border-brand-accent-dark text-transparent hover:text-brand-accent dark:hover:text-brand-accent-dark'
                          }`}
                        >
                          <Check size={12} strokeWidth={3.5} className={isCompleted ? "block" : "opacity-0 hover:opacity-100"} />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium text-gray-900 dark:text-white truncate transition-all duration-300 ${
                              isCompleted ? 'line-through text-gray-400 dark:text-gray-500 font-normal' : 'font-semibold'
                            }`}>
                              {item.title}
                            </span>

                            {item.recurring && (
                              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500" title={`Recorrente: ${item.recurring}`}>
                                ↺
                              </span>
                            )}
                          </div>
                          
                          {/* Note if exists */}
                          {item.note && (
                            <p className={`text-xs mt-0.5 truncate ${
                              isCompleted ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {item.note}
                            </p>
                          )}

                          {/* Metadata row: maximum 2 items */}
                          <div className="flex items-center gap-2 mt-1.5">
                            {/* Metadata 1: Time */}
                            {item.time && (
                              <span className="font-mono text-[10px] font-semibold text-brand-accent dark:text-brand-accent-dark tracking-wide tabular-nums">
                                {item.time}
                              </span>
                            )}
                            {/* Metadata 2: Category (only if present) */}
                            {cat && (
                              <>
                                {item.time && <span className="text-gray-300 dark:text-gray-700 text-[10px]">•</span>}
                                <span 
                                  className="text-[10px] font-medium"
                                  style={{ color: cat.color }}
                                >
                                  {cat.name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onEditItem(item)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-inner rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Untimed Tasks Section */}
        {untimedItems.length > 0 && (
          <div>
            <div className="text-xs font-mono font-bold text-gray-400 dark:text-[#8A94A6] tracking-widest uppercase mb-3 flex items-center gap-2">
              <Calendar size={13} className="text-brand-accent dark:text-brand-accent-dark" />
              <span>OUTROS COMPROMISSOS DO DIA</span>
            </div>
            
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {untimedItems.map(item => {
                  const isCompleted = isItemCompletedOnDate(item, selectedDateStr);
                  const cat = categories.find(c => c.id === item.category);
                  
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={`relative flex items-center justify-between p-4 pl-5 bg-white dark:bg-dark-card rounded-2xl shadow-xs transition-all ${
                        isCompleted 
                          ? 'opacity-65' 
                          : 'hover:shadow-sm'
                      }`}
                    >
                      {/* Priority left border line indicator */}
                      <div 
                        className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-md ${
                          item.priority === 'alta' 
                            ? 'bg-red-500' 
                            : item.priority === 'baixa'
                              ? 'bg-brand-accent'
                              : 'bg-amber-400'
                        }`}
                      />

                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Interactive satisfying Checkbox */}
                        <button
                          onClick={() => onToggleComplete(item.id, selectedDateStr)}
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                            isCompleted 
                              ? 'bg-emerald-500 border-emerald-600 text-white shadow-inner scale-95 shadow-emerald-700/20' 
                              : 'border-gray-200 dark:border-dark-border hover:border-brand-accent dark:hover:border-brand-accent-dark text-transparent hover:text-brand-accent dark:hover:text-brand-accent-dark'
                          }`}
                        >
                          <Check size={12} strokeWidth={3.5} className={isCompleted ? "block" : "opacity-0 hover:opacity-100"} />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium text-gray-900 dark:text-white truncate transition-all duration-300 ${
                              isCompleted ? 'line-through text-gray-400 dark:text-gray-500 font-normal' : 'font-semibold'
                            }`}>
                              {item.title}
                            </span>

                            {item.recurring && (
                              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500" title={`Recorrente: ${item.recurring}`}>
                                ↺
                              </span>
                            )}
                          </div>
                          
                          {/* Note if exists */}
                          {item.note && (
                            <p className={`text-xs mt-0.5 truncate ${
                              isCompleted ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {item.note}
                            </p>
                          )}

                          {/* Metadata row: maximum 2 items */}
                          <div className="flex items-center gap-2 mt-1.5">
                            {cat && (
                              <span 
                                className="text-[10px] font-medium"
                                style={{ color: cat.color }}
                              >
                                {cat.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onEditItem(item)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-inner rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

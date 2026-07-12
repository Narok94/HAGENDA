import React, { useState } from 'react';
import { Item, Category } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, AlertCircle, Plus, Check, Clock, Edit2, Sparkles, AlertTriangle } from 'lucide-react';

interface HojeTabProps {
  items: Item[];
  categories: Category[];
  onToggleComplete: (itemId: string, dateStr: string) => void;
  onEditItem: (item: Item) => void;
  onAddTaskOnDate?: (dateStr: string) => void;
  selectedDateStr: string; // "YYYY-MM-DD"
}

export default function HojeTab({
  items,
  categories,
  onToggleComplete,
  onEditItem,
  onAddTaskOnDate,
  selectedDateStr
}: HojeTabProps) {
  const [isOverdueExpanded, setIsOverdueExpanded] = useState(false);

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
    if (item.recurring) return false; // Recurring items don't accumulate as overdue
    return item.date < selectedDateStr && !item.completed;
  });

  // Completed math
  const completedCount = todayAllItems.filter(item => isItemCompletedOnDate(item, selectedDateStr)).length;
  const totalCount = todayAllItems.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
      {/* REDESIGNED PREMIUM HERO CARD - Reduced height, elegant, Apple Fitness/Things hybrid */}
      <div 
        style={{ background: 'linear-gradient(135deg, #163A8A 0%, #1D4ED8 45%, #0F2E63 100%)' }}
        className="text-white p-5 rounded-[18px] shadow-[0_6px_18px_rgba(15,23,42,0.06)] relative overflow-hidden flex flex-col justify-between min-h-[110px] transition-all"
      >
        {/* Subtle decorative mesh */}
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
        
        {/* Discrete progress badge in the top right corner */}
        <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-mono font-bold tracking-wide text-blue-200">
          {completedCount}/{totalCount} • {percentage}%
        </div>

        <div className="space-y-1 z-10 max-w-[70%]">
          <h1 className="font-sans font-bold text-lg sm:text-xl tracking-tight text-white leading-tight">
            {getLongDate()}
          </h1>
          <p className="text-xs text-blue-100/70 font-normal leading-relaxed">
            {totalCount > 0 
              ? `${completedCount} de ${totalCount} compromissos finalizados` 
              : 'Sua agenda está livre para hoje.'}
          </p>
        </div>

        {/* Discrete primary action button */}
        <div className="mt-3.5 z-10 self-start">
          <button
            onClick={() => {
              if (onAddTaskOnDate) {
                onAddTaskOnDate(selectedDateStr);
              }
            }}
            className="bg-white hover:bg-blue-50 text-[#163A8A] font-sans font-semibold text-xs px-4 py-2 rounded-[16px] transition-all shadow-sm active:scale-98 cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>Novo Compromisso</span>
          </button>
        </div>
      </div>

      {/* OVERDUE SECTION (ATRASADOS) - COLLAPSIBLE BANNER */}
      {overdueItems.length > 0 && (
        <div className="bg-white border border-red-200 rounded-[14px] shadow-[0_6px_18px_rgba(15,23,42,0.06)] overflow-hidden transition-all duration-200">
          <button
            type="button"
            onClick={() => setIsOverdueExpanded(!isOverdueExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 text-[#C21E1E] transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2 font-sans text-xs font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>{overdueItems.length} {overdueItems.length === 1 ? 'COMPROMISSO ATRASADO' : 'COMPROMISSOS ATRASADOS'}</span>
            </div>
            <span className="text-xs font-sans font-medium text-gray-500 hover:text-gray-900 hover:underline">
              {isOverdueExpanded ? 'Recolher' : 'Visualizar'}
            </span>
          </button>
          
          {isOverdueExpanded && (
            <div className="px-4 pb-3 pt-1 space-y-2 border-t border-red-100 bg-red-50/20">
              {overdueItems.map(item => {
                const overdueDate = new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
                
                return (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-red-100 shadow-[0_2px_6px_rgba(194,30,30,0.02)] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        onClick={() => onToggleComplete(item.id, item.date)}
                        className="w-4 h-4 rounded-full border border-red-200 flex items-center justify-center hover:bg-red-50 text-red-600 transition-colors shrink-0 cursor-pointer"
                      >
                        <Check size={10} className="opacity-0 hover:opacity-100" />
                      </button>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-800 font-medium truncate">{item.title}</span>
                          <span className="text-[10px] font-mono text-red-500 font-bold shrink-0">
                            ({overdueDate})
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onEditItem(item)}
                      className="p-1 hover:bg-gray-50 rounded text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
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



      {/* TASKS LIST */}
      <div className="space-y-6">
        
        {/* State Empty Illustration */}
        {todayAllItems.length === 0 && (
          <div className="bg-white p-12 rounded-[18px] border border-[#E2E5EC] shadow-[0_6px_18px_rgba(15,23,42,0.06)] flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-[#1D4ED8]">
              <Sparkles size={24} />
            </div>
            <div className="max-w-md">
              <h3 className="font-sans font-semibold text-base text-gray-900">Céu limpo por hoje</h3>
              <p className="text-xs text-gray-400 mt-1.5">
                Você concluiu todos os seus compromissos ou não agendou nada para hoje. Aproveite este momento para respirar ou planejar sua semana!
              </p>
            </div>
          </div>
        )}

        {/* Timed Tasks Section */}
        {timedItems.length > 0 && (
          <div>
            <div className="text-[10px] font-mono font-bold text-gray-400 tracking-widest uppercase mb-3 flex items-center gap-2 pl-1">
              <Clock size={12} className="text-[#1D4ED8]" />
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
                      className={`relative flex items-center justify-between p-3.5 pl-4 bg-white rounded-[14px] border border-[#E2E5EC] shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all ${
                        isCompleted 
                          ? 'opacity-60' 
                          : 'hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* 1. Checkbox */}
                        <button
                          onClick={() => onToggleComplete(item.id, selectedDateStr)}
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                            isCompleted 
                              ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white' 
                              : 'border-gray-300 hover:border-[#1D4ED8] text-transparent hover:text-[#1D4ED8]'
                          }`}
                        >
                          <Check size={11} strokeWidth={3.5} className="block" />
                        </button>

                        {/* 2. Horário */}
                        <span className="font-mono text-xs font-semibold text-[#163A8A] tracking-tight shrink-0 tabular-nums min-w-[42px]">
                          {item.time}
                        </span>

                        {/* 3. Título */}
                        <div className="min-w-0 flex-1">
                          <span 
                            onClick={() => onEditItem(item)}
                            className={`text-sm text-gray-900 leading-tight block truncate cursor-pointer ${
                              isCompleted 
                                ? 'line-through text-gray-400 font-normal' 
                                : 'font-medium hover:text-[#1D4ED8]'
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>

                        {/* 4. Categoria */}
                        {cat && (
                          <span 
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                            style={{ color: cat.color, backgroundColor: `${cat.color}12` }}
                          >
                            {cat.name}
                          </span>
                        )}

                        {/* 5. Prioridade */}
                        <div className="flex items-center gap-1.5 shrink-0 pl-1">
                          <span 
                            className={`w-1.5 h-1.5 rounded-full block ${
                              item.priority === 'alta' 
                                ? 'bg-red-500' 
                                : item.priority === 'baixa'
                                  ? 'bg-gray-300'
                                  : 'bg-amber-500'
                            }`}
                            title={`Prioridade ${item.priority}`}
                          />
                        </div>
                      </div>

                      {/* Edit Button */}
                      <button
                        onClick={() => onEditItem(item)}
                        className="ml-3 p-1 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0"
                      >
                        <Edit2 size={12} />
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
            <div className="text-[10px] font-mono font-bold text-gray-400 tracking-widest uppercase mb-3 flex items-center gap-2 pl-1">
              <Calendar size={12} className="text-[#1D4ED8]" />
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
                      className={`relative flex items-center justify-between p-3.5 pl-4 bg-white rounded-[14px] border border-[#E2E5EC] shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all ${
                        isCompleted 
                          ? 'opacity-60' 
                          : 'hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* 1. Checkbox */}
                        <button
                          onClick={() => onToggleComplete(item.id, selectedDateStr)}
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                            isCompleted 
                              ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white' 
                              : 'border-gray-300 hover:border-[#1D4ED8] text-transparent hover:text-[#1D4ED8]'
                          }`}
                        >
                          <Check size={11} strokeWidth={3.5} className="block" />
                        </button>

                        {/* 2. Sem horário - placeholder para alinhamento horizontal se necessário */}

                        {/* 3. Título */}
                        <div className="min-w-0 flex-1">
                          <span 
                            onClick={() => onEditItem(item)}
                            className={`text-sm text-gray-900 leading-tight block truncate cursor-pointer ${
                              isCompleted 
                                ? 'line-through text-gray-400 font-normal' 
                                : 'font-medium hover:text-[#1D4ED8]'
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>

                        {/* 4. Categoria */}
                        {cat && (
                          <span 
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                            style={{ color: cat.color, backgroundColor: `${cat.color}12` }}
                          >
                            {cat.name}
                          </span>
                        )}

                        {/* 5. Prioridade */}
                        <div className="flex items-center gap-1.5 shrink-0 pl-1">
                          <span 
                            className={`w-1.5 h-1.5 rounded-full block ${
                              item.priority === 'alta' 
                                ? 'bg-red-500' 
                                : item.priority === 'baixa'
                                  ? 'bg-gray-300'
                                  : 'bg-amber-500'
                            }`}
                            title={`Prioridade ${item.priority}`}
                          />
                        </div>
                      </div>

                      {/* Edit Button */}
                      <button
                        onClick={() => onEditItem(item)}
                        className="ml-3 p-1 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0"
                      >
                        <Edit2 size={12} />
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

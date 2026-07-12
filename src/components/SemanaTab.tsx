import React from 'react';
import { Item, Category } from '../types';
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Check } from 'lucide-react';

interface SemanaTabProps {
  items: Item[];
  categories: Category[];
  referenceDate: Date;
  onSetReferenceDate: (date: Date) => void;
  onToggleComplete: (itemId: string, dateStr: string) => void;
  onAddTaskOnDate: (dateStr: string) => void;
  onEditItem: (item: Item) => void;
}

export default function SemanaTab({
  items,
  categories,
  referenceDate,
  onSetReferenceDate,
  onToggleComplete,
  onAddTaskOnDate,
  onEditItem
}: SemanaTabProps) {
  
  // Calculate Monday through Sunday dates for the week containing referenceDate
  const getWeekDays = (ref: Date): Date[] => {
    const d = new Date(ref);
    const day = d.getDay(); // 0 is Sunday, 1 is Monday...
    // Adjust so Monday is first day (offset calculation)
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(d.setDate(diff));
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      days.push(nextDay);
    }
    return days;
  };

  const weekDays = getWeekDays(referenceDate);

  // Navigations
  const handlePrevWeek = () => {
    const prev = new Date(referenceDate);
    prev.setDate(referenceDate.getDate() - 7);
    onSetReferenceDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(referenceDate);
    next.setDate(referenceDate.getDate() + 7);
    onSetReferenceDate(next);
  };

  const handleTodayWeek = () => {
    onSetReferenceDate(new Date());
  };

  // Helper to check if a recurring item falls on a specific date
  const isItemRecurringOnDate = (item: Item, targetStr: string): boolean => {
    if (!item.recurring) return item.date === targetStr;
    if (item.date > targetStr) return false;
    
    const itemDate = new Date(item.date + 'T00:00:00');
    const targetDate = new Date(targetStr + 'T00:00:00');

    if (item.recurring === 'diario') return true;
    if (item.recurring === 'semanal') return itemDate.getDay() === targetDate.getDay();
    if (item.recurring === 'mensal') return itemDate.getDate() === targetDate.getDate();
    return false;
  };

  // Helper to check if item is completed on date
  const isItemCompletedOnDate = (item: Item, targetStr: string): boolean => {
    if (!item.recurring) return item.completed;
    const customItem = item as any;
    if (customItem.completedDates && Array.isArray(customItem.completedDates)) {
      return customItem.completedDates.includes(targetStr);
    }
    return item.completed;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const weekNumber = Math.ceil((referenceDate.getDate() - weekDays[0].getDate() + 1) / 7) + 1; // simple week estimate

  return (
    <div className="space-y-6">
      
      {/* Week Controller Header - Sem caixa própria, sem borda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-white p-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-accent/10 dark:bg-brand-accent-dark/10 text-brand-accent dark:text-brand-accent-dark rounded-xl shrink-0">
            <CalendarDays size={20} />
          </div>
          <div>
            <span className="text-xs font-mono font-bold uppercase text-brand-accent dark:text-brand-accent-dark tracking-wider">VISÃO SEMANAL</span>
            <h1 className="font-display font-bold text-lg text-gray-900 dark:text-white mt-0.5">
              {weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – {weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={handleTodayWeek}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 dark:bg-dark-card dark:hover:bg-dark-hover text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-dark-border rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            ESTA SEMANA
          </button>
          
          <div className="flex items-center border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden bg-white dark:bg-dark-card shadow-xs">
            <button
              onClick={handlePrevWeek}
              className="p-2 hover:bg-gray-50 dark:hover:bg-dark-hover text-gray-600 dark:text-[#8A94A6] hover:text-brand-accent dark:hover:text-brand-accent-dark border-r border-gray-200 dark:border-dark-border transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-gray-50 dark:hover:bg-dark-hover text-gray-600 dark:text-[#8A94A6] hover:text-brand-accent dark:hover:text-brand-accent-dark transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const dateStr = day.toISOString().split('T')[0];
          const isToday = dateStr === todayStr;
          
          const weekdayName = day.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3).toUpperCase();
          const dayNum = day.getDate();

          // Get items for this day
          const dayItems = items.filter(item => {
            return item.date === dateStr || isItemRecurringOnDate(item, dateStr);
          });

          // Sort day items: timed first, then untimed
          const sortedDayItems = [...dayItems].sort((a, b) => {
            if (a.time && b.time) return a.time.localeCompare(b.time);
            if (a.time) return -1;
            if (b.time) return 1;
            return 0;
          });

          return (
            <div 
              key={dateStr}
              className={`flex flex-col bg-[#F8FAFC] dark:bg-white rounded-2xl shadow-xs min-h-[360px] md:min-h-[480px] transition-all overflow-hidden ${
                isToday 
                  ? 'ring-2 ring-brand-accent dark:ring-brand-accent-dark' 
                  : 'border border-gray-200/40 dark:border-dark-border/40'
              }`}
            >
              {/* Day Header */}
              <div 
                onClick={() => onAddTaskOnDate(dateStr)}
                className={`p-3 text-center cursor-pointer transition-colors flex items-center justify-between md:flex-col md:gap-0.5 select-none ${
                  isToday 
                    ? 'bg-brand-accent/5 dark:bg-brand-accent-dark/10 border-b border-brand-accent/10' 
                    : 'bg-white dark:bg-dark-card border-b border-gray-100/60 dark:border-dark-border/40 hover:bg-gray-50 dark:hover:bg-dark-hover'
                }`}
              >
                <div className="text-left md:text-center">
                  <span className={`text-[10px] font-mono font-bold tracking-wider block ${
                    isToday ? 'text-brand-accent dark:text-brand-accent-dark' : 'text-gray-400 dark:text-[#8A94A6]'
                  }`}>
                    {weekdayName}
                  </span>
                  <span className={`font-display text-lg font-bold tabular-nums block ${
                    isToday ? 'text-brand-accent dark:text-brand-accent-dark' : 'text-gray-900 dark:text-white'
                  }`}>
                    {dayNum}
                  </span>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTaskOnDate(dateStr);
                  }}
                  className={`p-1 rounded-md transition-colors ${
                    isToday 
                      ? 'text-brand-accent dark:text-brand-accent-dark hover:bg-brand-accent/10 dark:hover:bg-brand-accent-dark/10' 
                      : 'text-gray-400 hover:text-brand-accent dark:hover:text-brand-accent-dark hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                  title="Adicionar compromisso para este dia"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Day Tasks Area */}
              <div className="p-2 flex-1 space-y-2 overflow-y-auto bg-white/50 dark:bg-dark-card/30">
                {sortedDayItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center select-none text-gray-300 dark:text-gray-700">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-medium opacity-50">Livre</span>
                  </div>
                ) : (
                  sortedDayItems.map(item => {
                    const isCompleted = isItemCompletedOnDate(item, dateStr);
                    const cat = categories.find(c => c.id === item.category);

                    return (
                      <div
                        key={`${item.id}-${dateStr}`}
                        onClick={() => onEditItem(item)}
                        className={`group relative p-2.5 pl-3.5 rounded-xl text-left cursor-pointer transition-all ${
                          isCompleted
                            ? 'opacity-60 bg-white border border-gray-100'
                            : 'bg-white border border-[#E2E5EC] shadow-[0_2px_8px_rgba(16,24,40,0.06)] hover:shadow-md'
                        }`}
                      >
                        {/* Priority left border line indicator */}
                        <div 
                          className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r-md ${
                            item.priority === 'alta' 
                              ? 'bg-[#E23D3D]' 
                              : item.priority === 'baixa'
                                ? 'bg-[#B9BFC9]'
                                : 'bg-[#E8A33D]'
                          }`}
                        />

                        <div className="flex items-start gap-2">
                          {/* Compact complete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete(item.id, dateStr);
                            }}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 mt-0.5 cursor-pointer ${
                              isCompleted
                                ? 'bg-emerald-500 border-emerald-600 text-white scale-95 shadow-inner'
                                : 'border-gray-200 dark:border-dark-border text-transparent hover:border-brand-accent dark:hover:border-brand-accent-dark'
                            }`}
                          >
                            <Check size={10} strokeWidth={3.5} className={isCompleted ? "block" : "opacity-0 hover:opacity-100"} />
                          </button>

                          <div className="min-w-0 flex-1">
                            <h4 className={`text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight break-words truncate transition-all duration-300 ${
                              isCompleted ? 'line-through text-gray-400 dark:text-gray-600 font-normal' : 'font-semibold'
                            }`}>
                              {item.title}
                            </h4>

                            {/* Metadata row: maximum 2 items */}
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              {item.time && (
                                <span className="font-mono text-[9px] font-bold text-brand-accent dark:text-brand-accent-dark tracking-wide tabular-nums">
                                  {item.time}
                                </span>
                              )}
                              {cat && (
                                <>
                                  {item.time && <span className="text-gray-300 text-[8px]">•</span>}
                                  <span className="text-[9px] font-medium" style={{ color: cat.color }}>
                                    {cat.name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

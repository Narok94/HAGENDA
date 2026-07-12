import React from 'react';
import { Item, Category } from '../types';
import { Clock, Calendar, CheckCircle, ArrowRight } from 'lucide-react';

interface SchedulePanelProps {
  items: Item[];
  categories: Category[];
  onTaskClick?: (itemId: string) => void;
}

export default function SchedulePanel({ items, categories, onTaskClick }: SchedulePanelProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Helper to check if a recurring item falls on a date
  function isItemRecurringOnDate(item: Item, dateStr: string): boolean {
    if (!item.recurring) return item.date === dateStr;
    if (item.date > dateStr) return false; // Starts in the future
    
    const itemDate = new Date(item.date + 'T00:00:00');
    const targetDate = new Date(dateStr + 'T00:00:00');
    
    if (item.recurring === 'diario') {
      return true;
    }
    if (item.recurring === 'semanal') {
      return itemDate.getDay() === targetDate.getDay();
    }
    if (item.recurring === 'mensal') {
      return itemDate.getDate() === targetDate.getDate();
    }
    return false;
  }

  // Find all pending items today
  const todayPending = items.filter(item => {
    const isToday = item.date === todayStr || (item.recurring && isItemRecurringOnDate(item, todayStr));
    return isToday && !item.completed;
  });

  // Sort today's pending items by time
  const sortedTodayPending = [...todayPending].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });

  // Find overall next pending item if none today
  const overallPending = items.filter(item => !item.completed && item.date >= todayStr);
  const sortedOverallPending = [...overallPending].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });

  // Determine next item to feature
  const featuredItem = sortedTodayPending.length > 0 
    ? sortedTodayPending[0] 
    : (sortedOverallPending.length > 0 ? sortedOverallPending[0] : null);

  const isFeaturedToday = featuredItem ? (featuredItem.date === todayStr || isItemRecurringOnDate(featuredItem, todayStr)) : false;

  const featuredCategory = featuredItem && categories.find(c => c.id === featuredItem.category);

  // Stats for the day
  const todayItems = items.filter(item => {
    return item.date === todayStr || (item.recurring && isItemRecurringOnDate(item, todayStr));
  });
  const todayCompleted = todayItems.filter(item => item.completed).length;
  const todayRemainingCount = todayItems.length - todayCompleted;

  return (
    <div className="w-full space-y-4">
      {/* HERO GRADIENT CARD (Horus style) */}
      <div className="bg-horus-gradient text-white rounded-[20px] p-5 shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[160px]">
        {/* Subtle mesh background accent */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]"></div>
        
        {/* Top bar with tag */}
        <div className="flex items-center justify-between relative z-10">
          <span className="bg-white/15 backdrop-blur-md text-[10px] font-mono font-bold tracking-widest px-2.5 py-1 rounded text-cyan-200">
            {isFeaturedToday ? 'TREINO DE HOJE' : 'PRÓXIMO COMPROMISSO'}
          </span>
          <span className="text-xs font-mono font-medium text-white/75 tabular-nums">
            {todayRemainingCount} pendente{todayRemainingCount !== 1 ? 's' : ''} hoje
          </span>
        </div>

        {/* Featured Item Details */}
        <div className="my-4 relative z-10">
          {featuredItem ? (
            <div 
              className="group cursor-pointer text-left"
              onClick={() => onTaskClick?.(featuredItem.id)}
            >
              <div className="flex items-baseline gap-2">
                {featuredItem.time && (
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-black/20 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <Clock size={10} />
                    {featuredItem.time}
                  </span>
                )}
                {!isFeaturedToday && (
                  <span className="text-[10px] font-mono text-cyan-300">
                    {new Date(featuredItem.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
              
              <h3 className="font-display font-black text-lg md:text-xl text-white tracking-tight mt-1.5 line-clamp-2 leading-snug group-hover:text-cyan-200 transition-colors">
                {featuredItem.title.toUpperCase()}
              </h3>
              
              {featuredItem.note && (
                <p className="text-xs text-white/70 line-clamp-1 font-sans mt-1">
                  {featuredItem.note}
                </p>
              )}
            </div>
          ) : (
            <div>
              <h3 className="font-display font-black text-lg text-white tracking-tight leading-snug uppercase">
                AGENDA CONCLUÍDA!
              </h3>
              <p className="text-xs text-cyan-200 mt-1 font-sans">
                Você não tem mais compromissos pendentes.
              </p>
            </div>
          )}
        </div>

        {/* Bottom bar with status summary */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-[10px] font-mono text-cyan-100 uppercase tracking-wider">
              {todayCompleted} de {todayItems.length} concluídos
            </span>
          </div>
          
          {featuredItem && onTaskClick && (
            <button 
              onClick={() => onTaskClick(featuredItem.id)}
              className="text-xs font-mono font-bold text-white flex items-center gap-1 hover:text-cyan-200 transition-colors cursor-pointer"
            >
              <span>DETALHES</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

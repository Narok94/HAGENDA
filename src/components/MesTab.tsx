import React, { useState } from 'react';
import { Item, Category } from '../types';
import { ChevronLeft, ChevronRight, CalendarRange, Plus, Check, Edit2, X, AlertTriangle } from 'lucide-react';

interface MesTabProps {
  items: Item[];
  categories: Category[];
  referenceDate: Date;
  onSetReferenceDate: (date: Date) => void;
  onToggleComplete: (itemId: string, dateStr: string) => void;
  onAddTaskOnDate: (dateStr: string) => void;
  onEditItem: (item: Item) => void;
}

export default function MesTab({
  items,
  categories,
  referenceDate,
  onSetReferenceDate,
  onToggleComplete,
  onAddTaskOnDate,
  onEditItem
}: MesTabProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth(); // 0-indexed

  // Navigation handlers
  const handlePrevMonth = () => {
    const prev = new Date(currentYear, currentMonth - 1, 1);
    onSetReferenceDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentYear, currentMonth + 1, 1);
    onSetReferenceDate(next);
  };

  const handleTodayMonth = () => {
    const today = new Date();
    onSetReferenceDate(today);
    setSelectedDate(today);
  };

  // Helper to generate calendar cells (6 rows x 7 columns = 42 cells)
  const getMonthCells = (year: number, month: number): Date[] => {
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon...
    
    // Adjust to Monday-start. Sunday (0) gets 6, others get firstDayOfWeek - 1
    const leadingOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - leadingOffset);
    
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const cell = new Date(startDate);
      cell.setDate(startDate.getDate() + i);
      cells.push(cell);
    }
    return cells;
  };

  const cells = getMonthCells(currentYear, currentMonth);

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

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  // Items for selected day in side drawer
  const selectedDayItems = items.filter(item => {
    return item.date === selectedDateStr || isItemRecurringOnDate(item, selectedDateStr);
  }).sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });

  const monthNames = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];

  const weekdayNames = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];

  return (
    <div className="space-y-6 relative">
      
      {/* Month Navigation Control - Sem caixa própria, sem borda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-[#1D4ED8] rounded-[14px] shrink-0">
            <CalendarRange size={20} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-[#1D4ED8] tracking-widest block">VISÃO MENSAL</span>
            <h1 className="font-sans font-bold text-lg text-gray-900 mt-0.5 tabular-nums">
              {monthNames[currentMonth]} {currentYear}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 font-sans text-xs">
          <button
            onClick={handleTodayMonth}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-[#E2E5EC] rounded-[16px] shadow-[0_2px_6px_rgba(15,23,42,0.02)] transition-all cursor-pointer font-semibold active:scale-98"
          >
            Este Mês
          </button>
          
          <div className="flex items-center border border-[#E2E5EC] rounded-[16px] overflow-hidden bg-white shadow-[0_2px_6px_rgba(15,23,42,0.02)]">
            <button
              onClick={handlePrevMonth}
              className="p-2.5 hover:bg-gray-50 text-gray-600 hover:text-[#1D4ED8] border-r border-[#E2E5EC] transition-colors cursor-pointer"
              title="Mês Anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2.5 hover:bg-gray-50 text-gray-600 hover:text-[#1D4ED8] transition-colors cursor-pointer"
              title="Próximo Mês"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid & Sliding Side Panel Container */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        
        {/* Grid Area */}
        <div className="w-full flex-1 bg-white p-5 rounded-[18px] border border-[#E2E5EC] shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
          {/* Weekday columns labels */}
          <div className="grid grid-cols-7 gap-1 text-center border-b border-gray-100 pb-2 mb-3">
            {weekdayNames.map(dayName => (
              <span key={dayName} className="text-[10px] font-mono font-bold text-gray-400 tracking-wider py-1">
                {dayName.substring(0, 3)}
              </span>
            ))}
          </div>

          {/* Calendar Grid cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cellDate, idx) => {
              const cellDateStr = cellDate.toISOString().split('T')[0];
              const isCurrentMonth = cellDate.getMonth() === currentMonth;
              const isToday = cellDateStr === todayStr;
              const isSelected = cellDateStr === selectedDateStr;

              // Filter tasks on this specific cell day
              const cellItems = items.filter(item => {
                return item.date === cellDateStr || isItemRecurringOnDate(item, cellDateStr);
              });

              // Extract unique category colors represented this day
              const representedCategories = Array.from(
                new Set(
                  cellItems
                    .map(item => item.category)
                    .filter(Boolean)
                )
              ).map(catId => categories.find(c => c.id === catId)).filter(Boolean) as Category[];

              // Limit categories to 4 mini dots maximum to prevent layout explosion
              const limitedCategories = representedCategories.slice(0, 4);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedDate(cellDate);
                    setIsDrawerOpen(true);
                  }}
                  className={`aspect-square p-2 flex flex-col justify-between rounded-[12px] border cursor-pointer select-none transition-all relative ${
                    isCurrentMonth 
                      ? 'bg-transparent text-gray-900' 
                      : 'bg-gray-50/40 text-gray-300 border-transparent'
                  } ${
                    isToday 
                      ? 'border-[#1D4ED8] font-bold bg-blue-50/30' 
                      : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                  } ${
                    isSelected 
                      ? 'bg-blue-50 border-[#1D4ED8] text-[#1D4ED8] font-bold shadow-[0_2px_8px_rgba(29,78,216,0.05)]' 
                      : ''
                  }`}
                >
                  {/* Day Number */}
                  <span className={`text-xs font-mono tabular-nums leading-none ${
                    isToday ? 'text-[#1D4ED8] text-sm font-extrabold' : ''
                  }`}>
                    {cellDate.getDate()}
                  </span>

                  {/* MINI-MARKERS COLOR DOTS BY CATEGORY */}
                  <div className="flex gap-1 justify-center flex-wrap pb-0.5 h-2.5 overflow-hidden">
                    {limitedCategories.map((cat, dotIdx) => (
                      <span
                        key={dotIdx}
                        className="w-1.5 h-1.5 rounded-full block shrink-0"
                        style={{ backgroundColor: cat.color }}
                        title={cat.name}
                      />
                    ))}
                    {representedCategories.length > 4 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 block shrink-0 opacity-75" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DETAILS SIDE PANEL (DRAWER) */}
        {isDrawerOpen && (
          <div className="w-full lg:w-[360px] bg-white rounded-[18px] border border-[#E2E5EC] shadow-[0_6px_18px_rgba(15,23,42,0.06)] overflow-hidden flex flex-col shrink-0 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#1D4ED8]">DETALHES DO DIA</span>
                <h3 className="font-sans font-bold text-sm text-gray-900 tabular-nums">
                  {selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </h3>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Drawer Tasks Content */}
            <div className="p-4 space-y-3 max-h-[380px] lg:max-h-[460px] overflow-y-auto flex-1">
              {selectedDayItems.length === 0 ? (
                <div className="text-center py-12 select-none">
                  <p className="text-xs text-gray-400">Nenhum compromisso para este dia.</p>
                  <button
                    onClick={() => onAddTaskOnDate(selectedDateStr)}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#1D4ED8] font-sans hover:underline cursor-pointer font-bold"
                  >
                    <Plus size={12} />
                    <span>Adicionar Compromisso</span>
                  </button>
                </div>
              ) : (
                selectedDayItems.map(item => {
                  const isCompleted = isItemCompletedOnDate(item, selectedDateStr);
                  const cat = categories.find(c => c.id === item.category);

                  return (
                    <div
                      key={item.id}
                      className={`group relative p-3 pl-3.5 rounded-[14px] text-left flex items-start gap-3 transition-all ${
                        isCompleted
                          ? 'opacity-60 bg-white border border-gray-100'
                          : 'bg-white border border-[#E2E5EC] shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:border-gray-300'
                      }`}
                    >
                      {/* Tick check */}
                      <button
                        onClick={() => onToggleComplete(item.id, selectedDateStr)}
                        className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-all shrink-0 mt-0.5 cursor-pointer ${
                          isCompleted
                            ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white scale-95 shadow-inner'
                            : 'border-gray-200 hover:border-[#1D4ED8] text-transparent hover:text-[#1D4ED8]'
                        }`}
                      >
                        <Check size={10} strokeWidth={3.5} className="block" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <h4 className={`text-xs text-gray-800 leading-tight break-words truncate transition-all duration-300 ${
                          isCompleted ? 'line-through text-gray-400 font-normal' : 'font-semibold hover:text-[#1D4ED8]'
                        }`}>
                          {item.title}
                        </h4>

                        {/* Metadata row: maximum 2 items */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {item.time && (
                            <span className="font-mono text-[9px] font-bold text-[#163A8A] tracking-tight shrink-0 tabular-nums">
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
                          {item.recurring && (
                            <>
                              {(item.time || cat) && <span className="text-gray-300 text-[8px]">•</span>}
                              <span className="text-[9px] font-mono text-gray-400">
                                ↺ {item.recurring === 'diario' ? 'Diário' : item.recurring === 'semanal' ? 'Semanal' : 'Mensal'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => onEditItem(item)}
                        className="p-1 hover:bg-gray-50 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0 cursor-pointer self-center"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Actions */}
            {selectedDayItems.length > 0 && (
              <div className="p-3 bg-gray-50/50 border-t border-gray-100">
                <button
                  onClick={() => onAddTaskOnDate(selectedDateStr)}
                  className="w-full bg-[#1D4ED8] hover:bg-[#163A8A] text-white font-sans font-semibold text-xs py-2.5 rounded-[16px] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-98"
                >
                  <Plus size={13} strokeWidth={2.5} />
                  <span>Novo Compromisso</span>
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

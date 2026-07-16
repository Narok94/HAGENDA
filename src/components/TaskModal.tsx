import React, { useState } from 'react';
import { X, Trash2, Edit3, Save, Flame, Calendar as CalendarIcon, Clock, AlignLeft, Tag } from 'lucide-react';
import { Task } from '../types';
import { getIcon, AVAILABLE_ICONS } from '../utils/icons';

interface TaskModalProps {
  task?: Task;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete?: (id: string) => void;
}

export default function TaskModal({ task, onClose, onSave, onDelete }: TaskModalProps) {
  const isCreateMode = !task || !task.id || task.id === 'temp';
  const [isEditing, setIsEditing] = useState(isCreateMode);

  // Form State
  const [title, setTitle] = useState(task?.title || '');
  const [date, setDate] = useState(task?.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(task?.time || '12:00');
  const [category, setCategory] = useState(task?.category || '');
  const [icon, setIcon] = useState(task?.icon || 'Circle');
  const [priority, setPriority] = useState(task?.priority || false);
  const [notes, setNotes] = useState(task?.notes || '');
  const [recurrence, setRecurrence] = useState<'none' | 'semanal' | 'mensal'>(task?.recurrence || 'none');
  const [recurrenceDay, setRecurrenceDay] = useState(task?.recurrenceDay || '1');
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>(
    task?.recurrenceDays || (task?.recurrenceDay && task.recurrence === 'semanal' ? [task.recurrenceDay] : ['1'])
  );

  const handleSave = () => {
    if (!title.trim()) return;
    
    const finalDate = recurrence === 'semanal' 
      ? '' 
      : (date || new Date().toISOString().split('T')[0]);

    onSave({
      id: task?.id || Date.now().toString(),
      title,
      date: finalDate,
      time,
      category: category || 'Geral',
      icon,
      priority,
      notes,
      completed: task?.completed || false,
      recurrence,
      recurrenceDay: recurrence === 'mensal' ? recurrenceDay : undefined,
      recurrenceDays: recurrence === 'semanal' ? recurrenceDays : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0E1730]/60 backdrop-blur-sm p-0 sm:p-4 pb-0">
      <div className="bg-white w-full max-w-lg rounded-t-[24px] sm:rounded-[24px] shadow-2xl border-t border-x sm:border border-[#E3E8F1] overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[#E3E8F1] bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-3 min-w-11 min-h-11 rounded-full bg-[#F3F5FA] hover:bg-[#E3E8F1] text-[#69708A] hover:text-[#0E1730] transition-colors flex items-center justify-center -ml-3">
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold text-[#0E1730] font-display">
              {isCreateMode ? 'Nova Tarefa' : isEditing ? 'Editar Tarefa' : 'Detalhes da Tarefa'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!isCreateMode && !isEditing && onDelete && (
              <button onClick={() => onDelete(task.id)} className="p-3 min-w-11 min-h-11 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-[#FF5252] transition-colors">
                <Trash2 size={18} />
              </button>
            )}
            {!isCreateMode && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="p-3 min-w-11 min-h-11 flex items-center justify-center rounded-full bg-[#F3F5FA] hover:bg-[#E3E8F1] text-[#69708A] hover:text-[#0E1730] transition-colors">
                <Edit3 size={18} />
              </button>
            )}
            {isEditing && (
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2.5 bg-[#2F5CFF] hover:bg-[#1E3FD6] text-white rounded-[12px] text-sm font-semibold transition-colors shadow-md shadow-[#2F5CFF]/15 cursor-pointer">
                <Save size={16} />
                Salvar
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 scrollbar-hide">
          
          {/* Title Area */}
          <div className="flex flex-col gap-2">
            {isEditing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="O que precisa ser feito?"
                autoFocus
                className="w-full bg-transparent border-b border-[#E3E8F1] px-0 py-2 text-2xl font-bold text-[#0E1730] font-display focus:outline-none focus:border-[#2F5CFF] transition-colors placeholder:text-[#9AA1B8]"
              />
            ) : (
              <h1 className="text-2xl font-bold text-[#0E1730] font-display">{title}</h1>
            )}
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            {recurrence !== 'semanal' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#69708A] flex items-center gap-1 font-display">
                  <CalendarIcon size={14} /> Data
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-[#F3F5FA] border border-[#E3E8F1] rounded-[12px] px-3 py-2 text-sm text-[#0E1730] focus:outline-none focus:border-[#2F5CFF] transition-colors w-full font-medium"
                  />
                ) : (
                  <p className="text-sm text-[#0E1730] bg-[#F3F5FA] border border-[#E3E8F1] rounded-[12px] px-3 py-2.5 font-semibold">
                    {date.split('-').reverse().join('/')}
                  </p>
                )}
              </div>
            )}

            {/* Time */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#69708A] flex items-center gap-1 font-display">
                <Clock size={14} /> Horário
              </label>
              {isEditing ? (
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-[#F3F5FA] border border-[#E3E8F1] rounded-[12px] px-3 py-2 text-sm text-[#0E1730] focus:outline-none focus:border-[#2F5CFF] transition-colors w-full font-medium"
                />
              ) : (
                <p className="text-sm text-[#0E1730] bg-[#F3F5FA] border border-[#E3E8F1] rounded-[12px] px-3 py-2.5 font-semibold">
                  {time}
                </p>
              )}
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#69708A] flex items-center gap-1 font-display">
                <Tag size={14} /> Categoria
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Trabalho, Saúde"
                  className="bg-[#F3F5FA] border border-[#E3E8F1] rounded-[12px] px-3 py-2 text-sm text-[#0E1730] focus:outline-none focus:border-[#2F5CFF] transition-colors w-full font-medium"
                />
              ) : (
                <p className="text-sm text-[#0E1730] bg-[#F3F5FA] border border-[#E3E8F1] rounded-[12px] px-3 py-2.5 font-semibold">
                  {category}
                </p>
              )}
            </div>

            {/* Priority Flag */}
            <div className="flex flex-col gap-1 justify-center pt-5">
              {isEditing ? (
                <label className="flex items-center gap-3 cursor-pointer group min-h-11">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={priority} 
                    onChange={() => setPriority(!priority)} 
                  />
                  <div className={`w-10 h-6 rounded-full transition-colors relative flex items-center ${priority ? 'bg-[#FF8A24]' : 'bg-[#F3F5FA] border border-[#E3E8F1]'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute transition-transform ${priority ? 'translate-x-5' : 'translate-x-1'} shadow-xs`} />
                  </div>
                  <span className={`text-sm font-semibold transition-colors ${priority ? 'text-[#FF8A24]' : 'text-[#69708A]'}`}>
                    Prioridade
                  </span>
                </label>
              ) : (
                priority && (
                  <div className="flex items-center gap-2 text-[#FF8A24] bg-[#FF8A24]/10 border border-[#FF8A24]/20 w-max px-3 py-1.5 rounded-[10px]">
                    <Flame size={16} />
                    <span className="text-sm font-bold">Prioridade</span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Icon Selector */}
          {isEditing && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#69708A] font-display">Ícone</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_ICONS.map(i => (
                  <button
                    key={i}
                    onClick={() => setIcon(i)}
                    className={`w-10 h-10 rounded-[12px] flex items-center justify-center transition-colors cursor-pointer ${icon === i ? 'bg-[#2F5CFF] text-white shadow-md shadow-[#2F5CFF]/15' : 'bg-[#F3F5FA] text-[#69708A] hover:bg-[#E3E8F1]'}`}
                  >
                    {getIcon(i)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isEditing && (
            <div className="flex items-center gap-3 bg-[#F3F5FA] p-3 rounded-[12px] border border-[#E3E8F1] w-max">
              <div className="text-[#2F5CFF]">{getIcon(icon)}</div>
              <span className="text-xs font-bold text-[#69708A]">Ícone selecionado</span>
            </div>
          )}

          {/* Recorrência */}
          <div className="bg-[#F3F5FA] p-4 rounded-[16px] border border-[#E3E8F1] space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#69708A] font-display">Recorrência</label>
              {isEditing ? (
                <select
                  value={recurrence}
                  onChange={(e) => {
                    const val = e.target.value as 'none' | 'semanal' | 'mensal';
                    setRecurrence(val);
                    if (val === 'semanal') {
                      setRecurrenceDay('1'); // Segunda por padrão
                    } else if (val === 'mensal') {
                      setRecurrenceDay('1'); // Dia 1 por padrão
                    }
                  }}
                  className="bg-white border border-[#E3E8F1] rounded-[12px] px-3 py-2 text-sm text-[#0E1730] focus:outline-none focus:border-[#2F5CFF] transition-colors w-full font-medium"
                >
                  <option value="none">Não se repete</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                </select>
              ) : (
                <p className="text-sm text-[#0E1730] font-semibold">
                  {recurrence === 'none' && 'Não se repete'}
                  {recurrence === 'semanal' && 'Repete semanalmente'}
                  {recurrence === 'mensal' && 'Repete mensalmente'}
                </p>
              )}
            </div>

            {recurrence === 'semanal' && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#69708A] font-display">Dias da Semana</label>
                {isEditing ? (
                  <div className="flex flex-wrap gap-2 justify-between bg-white p-2 rounded-[16px] border border-[#E3E8F1]">
                    {[
                      { value: '1', label: 'S', fullName: 'Segunda' },
                      { value: '2', label: 'T', fullName: 'Terça' },
                      { value: '3', label: 'Q', fullName: 'Quarta' },
                      { value: '4', label: 'Q', fullName: 'Quinta' },
                      { value: '5', label: 'S', fullName: 'Sexta' },
                      { value: '6', label: 'S', fullName: 'Sábado' },
                      { value: '0', label: 'D', fullName: 'Domingo' },
                    ].map(day => {
                      const isSelected = recurrenceDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (recurrenceDays.length > 1) {
                                setRecurrenceDays(recurrenceDays.filter(d => d !== day.value));
                              }
                            } else {
                              const order = ['1', '2', '3', '4', '5', '6', '0'];
                              const newDays = [...recurrenceDays, day.value].sort((a, b) => order.indexOf(a) - order.indexOf(b));
                              setRecurrenceDays(newDays);
                            }
                          }}
                          className={`w-10 h-10 rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-[#2F5CFF] text-white shadow-md' 
                              : 'bg-[#F3F5FA] text-[#69708A] hover:bg-[#E3E8F1]'
                          }`}
                        >
                          <span>{day.label}</span>
                          <span className="text-[7px] opacity-70 leading-none mt-0.5">{day.fullName.slice(0,3)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: '1', fullName: 'Segunda-feira' },
                      { value: '2', fullName: 'Terça-feira' },
                      { value: '3', fullName: 'Quarta-feira' },
                      { value: '4', fullName: 'Quinta-feira' },
                      { value: '5', fullName: 'Sexta-feira' },
                      { value: '6', fullName: 'Sábado' },
                      { value: '0', fullName: 'Domingo' },
                    ].map(day => {
                      const isSelected = recurrenceDays.includes(day.value);
                      if (!isSelected) return null;
                      return (
                        <span key={day.value} className="px-3 py-1 bg-[#2F5CFF]/15 text-[#2F5CFF] rounded-full text-xs font-semibold border border-[#2F5CFF]/30">
                          {day.fullName}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {recurrence === 'mensal' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#69708A] font-display">Dia do Mês</label>
                {isEditing ? (
                  <select
                    value={recurrenceDay}
                    onChange={(e) => setRecurrenceDay(e.target.value)}
                    className="bg-white border border-[#E3E8F1] rounded-[12px] px-3 py-2 text-sm text-[#0E1730] focus:outline-none focus:border-[#2F5CFF] transition-colors w-full font-medium"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num.toString()}>{num}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-[#0E1730] font-bold">
                    Todo dia {recurrenceDay}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Notes / Observations */}
          <div className="flex flex-col gap-2 pb-6 sm:pb-0">
            <label className="text-xs font-semibold text-[#69708A] flex items-center gap-1 font-display">
              <AlignLeft size={14} /> Observações
            </label>
            {isEditing ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione detalhes importantes sobre esta tarefa..."
                className="bg-[#F3F5FA] border border-[#E3E8F1] rounded-[12px] px-4 py-3 text-sm text-[#0E1730] focus:outline-none focus:border-[#2F5CFF] transition-colors w-full min-h-[120px] resize-none font-medium placeholder:text-[#9AA1B8]"
              />
            ) : (
              <div className="bg-[#F3F5FA] border border-[#E3E8F1] rounded-[12px] px-4 py-3 text-sm text-[#0E1730] min-h-[120px] whitespace-pre-wrap font-medium">
                {notes || <span className="text-[#9AA1B8] italic font-semibold">Nenhuma observação adicionada.</span>}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

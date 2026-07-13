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
  const isCreateMode = !task;
  const [isEditing, setIsEditing] = useState(isCreateMode);

  // Form State
  const [title, setTitle] = useState(task?.title || '');
  const [date, setDate] = useState(task?.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(task?.time || '12:00');
  const [category, setCategory] = useState(task?.category || '');
  const [icon, setIcon] = useState(task?.icon || 'Circle');
  const [priority, setPriority] = useState(task?.priority || false);
  const [notes, setNotes] = useState(task?.notes || '');

  const handleSave = () => {
    if (!title.trim()) return;
    
    onSave({
      id: task?.id || Date.now().toString(),
      title,
      date,
      time,
      category: category || 'Geral',
      icon,
      priority,
      notes,
      completed: task?.completed || false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 pb-0">
      <div className="bg-[#171A21] w-full max-w-lg rounded-t-[24px] sm:rounded-[24px] shadow-2xl border-t border-x sm:border border-white/5 overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-white/5 bg-[#171A21] sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-[#A1A1AA] hover:text-white transition-colors">
              <X size={20} />
            </button>
            <h2 className="text-lg font-semibold text-white">
              {isCreateMode ? 'Nova Tarefa' : isEditing ? 'Editar Tarefa' : 'Detalhes da Tarefa'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!isCreateMode && !isEditing && onDelete && (
              <button onClick={() => onDelete(task.id)} className="p-2 rounded-full hover:bg-red-500/10 text-[#A1A1AA] hover:text-red-400 transition-colors">
                <Trash2 size={18} />
              </button>
            )}
            {!isCreateMode && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="p-2 rounded-full hover:bg-white/5 text-[#A1A1AA] hover:text-white transition-colors">
                <Edit3 size={18} />
              </button>
            )}
            {isEditing && (
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-[#7C5CFF] hover:bg-[#6b4ce6] text-white rounded-[12px] text-sm font-medium transition-colors">
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
                className="w-full bg-transparent border-b border-white/10 px-0 py-2 text-2xl font-semibold text-white focus:outline-none focus:border-[#7C5CFF] transition-colors placeholder:text-[#A1A1AA]/50"
              />
            ) : (
              <h1 className="text-2xl font-semibold text-white">{title}</h1>
            )}
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#A1A1AA] flex items-center gap-1">
                <CalendarIcon size={14} /> Data
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-[#0F1115] border border-white/5 rounded-[12px] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C5CFF] transition-colors w-full"
                />
              ) : (
                <p className="text-sm text-white bg-[#0F1115] border border-white/5 rounded-[12px] px-3 py-2">
                  {date.split('-').reverse().join('/')}
                </p>
              )}
            </div>

            {/* Time */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#A1A1AA] flex items-center gap-1">
                <Clock size={14} /> Horário
              </label>
              {isEditing ? (
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-[#0F1115] border border-white/5 rounded-[12px] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C5CFF] transition-colors w-full"
                />
              ) : (
                <p className="text-sm text-white bg-[#0F1115] border border-white/5 rounded-[12px] px-3 py-2">
                  {time}
                </p>
              )}
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#A1A1AA] flex items-center gap-1">
                <Tag size={14} /> Categoria
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Trabalho, Saúde"
                  className="bg-[#0F1115] border border-white/5 rounded-[12px] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7C5CFF] transition-colors w-full"
                />
              ) : (
                <p className="text-sm text-white bg-[#0F1115] border border-white/5 rounded-[12px] px-3 py-2">
                  {category}
                </p>
              )}
            </div>

            {/* Priority Flag */}
            <div className="flex flex-col gap-1 justify-center pt-5">
              {isEditing ? (
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-10 h-6 rounded-full transition-colors relative flex items-center ${priority ? 'bg-[#7C5CFF]' : 'bg-[#0F1115] border border-white/10'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute transition-transform ${priority ? 'translate-x-5' : 'translate-x-1'}`} />
                  </div>
                  <span className={`text-sm font-medium transition-colors ${priority ? 'text-[#7C5CFF]' : 'text-[#A1A1AA]'}`}>
                    Prioridade
                  </span>
                </label>
              ) : (
                priority && (
                  <div className="flex items-center gap-2 text-[#7C5CFF] bg-[#7C5CFF]/10 w-max px-3 py-1.5 rounded-[10px]">
                    <Flame size={16} />
                    <span className="text-sm font-medium">Prioridade</span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Icon Selector */}
          {isEditing && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#A1A1AA]">Ícone</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_ICONS.map(i => (
                  <button
                    key={i}
                    onClick={() => setIcon(i)}
                    className={`w-10 h-10 rounded-[12px] flex items-center justify-center transition-colors ${icon === i ? 'bg-[#7C5CFF] text-white' : 'bg-[#0F1115] text-[#A1A1AA] hover:bg-white/5'}`}
                  >
                    {getIcon(i)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isEditing && (
            <div className="flex items-center gap-3 bg-[#0F1115] p-3 rounded-[12px] border border-white/5 w-max">
               <div className="text-[#7C5CFF]">{getIcon(icon)}</div>
               <span className="text-sm font-medium text-[#A1A1AA]">Ícone selecionado</span>
            </div>
          )}

          {/* Notes / Observations */}
          <div className="flex flex-col gap-2 pb-6 sm:pb-0">
            <label className="text-xs font-medium text-[#A1A1AA] flex items-center gap-1">
              <AlignLeft size={14} /> Observações
            </label>
            {isEditing ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione detalhes importantes sobre esta tarefa..."
                className="bg-[#0F1115] border border-white/5 rounded-[12px] px-4 py-3 text-sm text-white focus:outline-none focus:border-[#7C5CFF] transition-colors w-full min-h-[120px] resize-none"
              />
            ) : (
              <div className="bg-[#0F1115] border border-white/5 rounded-[12px] px-4 py-3 text-sm text-white min-h-[120px] whitespace-pre-wrap">
                {notes || <span className="text-[#A1A1AA] italic">Nenhuma observação adicionada.</span>}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

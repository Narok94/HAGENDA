import React, { useState, useEffect, useRef } from 'react';
import { Item, Category } from '../types';
import { X, Calendar, Clock, Tag, AlertTriangle, FileText, RefreshCw } from 'lucide-react';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<Item, 'id'> & { id?: string }) => void;
  categories: Category[];
  initialDate?: string; // Pre-filled date format YYYY-MM-DD
  editingItem?: Item | null;
  onDelete?: (itemId: string) => void;
}

export default function QuickAddModal({
  isOpen,
  onClose,
  onSave,
  categories,
  initialDate,
  editingItem,
  onDelete
}: QuickAddModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'baixa' | 'média' | 'alta'>('média');
  const [note, setNote] = useState('');
  const [recurring, setRecurring] = useState<'diario' | 'semanal' | 'mensal' | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Initialize fields on open or edit
  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setTitle(editingItem.title);
        setDate(editingItem.date);
        setTime(editingItem.time || '');
        setCategory(editingItem.category || '');
        setPriority(editingItem.priority || 'média');
        setNote(editingItem.note || '');
        setRecurring(editingItem.recurring || null);
      } else {
        setTitle('');
        setDate(initialDate || new Date().toISOString().split('T')[0]);
        setTime('');
        setCategory(categories[0]?.id || '');
        setPriority('média');
        setNote('');
        setRecurring(null);
      }
      
      // Auto-focus title input
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, editingItem, initialDate, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    onSave({
      id: editingItem?.id,
      title: title.trim(),
      date,
      time: time || undefined,
      category: category || undefined,
      priority,
      note: note.trim() || undefined,
      completed: editingItem ? editingItem.completed : false,
      recurring
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm dark:backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
      ></div>
 
      {/* Modal Dialog */}
      <div className="bg-white border border-[#E2E5EC] text-gray-900 rounded-[18px] shadow-[0_10px_30px_rgba(15,23,42,0.08)] w-full max-w-lg overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 bg-gray-50/50">
          <h2 className="font-sans font-bold text-sm tracking-tight text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1D4ED8] animate-pulse"></span>
            {editingItem ? 'EDITAR COMPROMISSO' : 'NOVO COMPROMISSO'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-[#8A94A6] hover:text-gray-900 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
 
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Title */}
          <div>
            <label className="block text-[10px] font-mono font-bold uppercase text-gray-400 tracking-widest mb-1.5 pl-0.5">Título do Item</label>
            <input
              ref={titleInputRef}
              type="text"
              required
              placeholder="Ex: Alinhamento trimestral com a diretoria"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-[14px] px-3.5 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#1D4ED8] text-sm transition-colors"
            />
          </div>
 
          {/* Date & Time Grid */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-gray-400 tracking-widest mb-1.5 pl-0.5 flex items-center gap-1.5">
                <Calendar size={12} className="text-[#1D4ED8]" />
                Data
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-[14px] px-3.5 py-2.5 text-gray-900 focus:outline-none focus:border-[#1D4ED8] text-sm font-mono transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-gray-400 tracking-widest mb-1.5 pl-0.5 flex items-center gap-1.5">
                <Clock size={12} className="text-[#1D4ED8]" />
                Horário <span className="text-[9px] text-gray-400 font-normal lowercase">(opcional)</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-[14px] px-3.5 py-2.5 text-gray-900 focus:outline-none focus:border-[#1D4ED8] text-sm font-mono transition-colors"
              />
            </div>
          </div>
 
          {/* Category & Priority Grid */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-gray-400 tracking-widest mb-1.5 pl-0.5 flex items-center gap-1.5">
                <Tag size={12} className="text-[#1D4ED8]" />
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-[14px] px-3.5 py-2.5 text-gray-900 focus:outline-none focus:border-[#1D4ED8] text-sm transition-colors cursor-pointer"
              >
                <option value="">Sem Categoria</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-gray-400 tracking-widest mb-1.5 pl-0.5 flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-[#1D4ED8]" />
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-200 rounded-[14px] px-3.5 py-2.5 text-gray-900 focus:outline-none focus:border-[#1D4ED8] text-sm transition-colors cursor-pointer"
              >
                <option value="baixa">Baixa</option>
                <option value="média">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>
 
          {/* Recurrence Selection */}
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-gray-400 tracking-widest mb-1.5 pl-0.5 flex items-center gap-1.5">
              <RefreshCw size={12} className="text-[#1D4ED8]" />
              Recorrência
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Nenhuma', value: null },
                { label: 'Diária', value: 'diario' },
                { label: 'Semanal', value: 'semanal' },
                { label: 'Mensal', value: 'mensal' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setRecurring(opt.value as any)}
                  className={`py-2 px-1 text-xs font-mono rounded-[12px] border transition-all cursor-pointer ${
                    recurring === opt.value
                      ? 'bg-blue-50 border-[#1D4ED8] text-[#1D4ED8] font-bold shadow-[0_2px_6px_rgba(29,78,216,0.03)]'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
 
          {/* Note */}
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-gray-400 tracking-widest mb-1.5 pl-0.5 flex items-center gap-1.5">
              <FileText size={12} className="text-[#1D4ED8]" />
              Nota Curta
            </label>
            <input
              type="text"
              placeholder="Ex: Levar documento de identidade impresso"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-[14px] px-3.5 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#1D4ED8] text-sm transition-colors"
            />
          </div>
 
          {/* Actions Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-6">
            <div>
              {editingItem && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Tem certeza de que deseja remover este compromisso?')) {
                      onDelete(editingItem.id);
                      onClose();
                    }
                  }}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-sans text-xs font-semibold rounded-[16px] border border-red-100 transition-colors cursor-pointer"
                >
                  Excluir
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-sans text-xs font-semibold rounded-[16px] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                className="px-5 py-2 bg-[#1D4ED8] hover:bg-[#163A8A] text-white font-sans font-semibold text-xs rounded-[16px] shadow-sm transition-all cursor-pointer active:scale-98"
              >
                Salvar
              </button>
            </div>
          </div>
 
        </form>
      </div>
    </div>
  );
}
